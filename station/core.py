"""Núcleo de la estación: une reloj -> análisis -> diagnóstico -> IA -> DTN -> Tierra."""
import threading
import time
import uuid
from datetime import datetime

from . import ai, config, features, risk_engine, voice
from .dtn_link import DTNLink
from .nasa.iss_live import ISSLive
from .nasa.osdr import OSDR
from .nasa.radiation import Radiation
from .store import Store

ENV_SCENARIOS = {"cabin_co2": "iss", "solar_storm": "rad"}


class Station:
    def __init__(self):
        self.store = Store()
        self.iss = ISSLive()
        self.rad = Radiation()
        self.osdr = OSDR()
        self.dtn = DTNLink()
        self.baselines = {c["id"]: features.Baseline(c["baseline"]) for c in config.CREW}
        self.voice_base = voice.VoiceBaselines(config.CREW)
        self.scenarios = {c["id"]: "nominal" for c in config.CREW}
        self.watch_link_down = False
        self.state = {c["id"]: {"status": "SIN DATOS", "score": None, "findings": []} for c in config.CREW}
        self.symptoms = {c["id"]: [] for c in config.CREW}
        self.watch_feed = {c["id"]: [] for c in config.CREW}
        self.reports = {}
        # Interacciones hechas en el reloj (agua, comidas, rutina, respiración, refugio, pedir médico…)
        self.watch_actions = {c["id"]: [] for c in config.CREW}
        self.watch_counters = {c["id"]: {"water": 0, "meals": [], "routine": {}, "breaths": 0} for c in config.CREW}
        self.hydration_cmds = {c["id"]: 0 for c in config.CREW}
        self._alert_seen = {}
        self._last_summary = 0
        self.started = time.time()

    def start(self):
        self.iss.start(); self.rad.start(); self.osdr.start(); self.dtn.start()
        threading.Thread(target=self._loop, daemon=True).start()
        self.store.event("system", "Estación SANBOSI en línea (DTN " + self.dtn.mode + ")")

    # ------------------------------------------------------------------ ingestión
    # Formato del contrato del equipo (Backend ⇄ Hardware):
    # {"dispositivo":"band-01","tripulante":"CM-01","t":"2026-10-04T14:05:00Z","metrica":"FC","valor":72,"calidad":0.93}
    METRIC_MAP = {"FC": "hr", "SPO2": "spo2", "TEMP": "skin_temp", "FR": "resp_rate", "PAS": "sbp", "PAD": "dbp",
                  "ACC": "accel_g", "RR": "rr_ms", "SUENO": "sleep_h", "HIDRATACION": "hydration", "BATERIA": "battery"}

    def ingest_team_format(self, items):
        by = {}
        for it in items if isinstance(items, list) else [items]:
            cid = it.get("tripulante")
            m = self.METRIC_MAP.get(str(it.get("metrica", "")).upper())
            if cid not in config.CREW_BY_ID or not m:
                continue
            t = it.get("t")
            try:
                ts = datetime.fromisoformat(str(t).replace("Z", "+00:00")).timestamp() if isinstance(t, str) else float(t or time.time())
            except ValueError:
                ts = time.time()
            ts = round(ts)
            key = (cid, ts)
            pkt = by.setdefault(key, {"crew_id": cid, "ts": ts, "activity": "work", "quality": it.get("calidad", 1.0),
                                      "_dev": it.get("dispositivo")})
            v = it.get("valor")
            pkt[m] = [v] if m == "rr_ms" and not isinstance(v, list) else v
            pkt["quality"] = min(pkt["quality"], it.get("calidad", 1.0))
        res = {}
        for (cid, ts), pkt in sorted(by.items(), key=lambda kv: kv[0][1]):
            dev = pkt.pop("_dev")
            last = self.store.latest(cid) or {}
            merged = {**{k: last.get(k) for k in ("hr", "spo2", "skin_temp", "resp_rate", "sbp", "dbp", "accel_g", "sleep_h", "hydration", "battery") if last.get(k) is not None}, **pkt}
            merged.setdefault("rr_ms", [])
            res[cid] = res.get(cid, 0) + self.store.add_packets(cid, [merged], {"device_id": dev, "buffered": 0, "rx": time.time()})
        return {"ok": True, "accepted": res}

    def ingest(self, body):
        if isinstance(body, list) or "tripulante" in body:
            return self.ingest_team_format(body)
        cid = body.get("crew_id")
        if cid not in config.CREW_BY_ID:
            return {"ok": False, "error": "crew_id desconocido"}
        n = self.store.add_packets(cid, body.get("packets", []), {
            "device_id": body.get("device_id"), "buffered": body.get("buffered", 0), "rx": time.time()})
        return {"ok": True, "accepted": n}

    def set_scenario(self, crew_id, sc):
        targets = list(self.scenarios) if crew_id in (None, "ALL") else [crew_id]
        for t in targets:
            self.scenarios[t] = sc
        vals = set(self.scenarios.values())
        self.iss.injection = "cabin_co2" if "cabin_co2" in vals else None
        self.rad.injection = "solar_storm" if "solar_storm" in vals else None
        self.store.event("scenario", f"Escenario '{sc}' aplicado a {', '.join(targets)}")
        return {"ok": True, "scenarios": self.scenarios}

    def notify_watch(self, crew_id, kind, text, vibrate=False):
        targets = list(self.watch_feed) if crew_id in (None, "ALL") else [crew_id]
        for t in targets:
            self.watch_feed[t].append({"ts": time.time(), "kind": kind, "text": text, "vibrate": vibrate})
            self.watch_feed[t] = self.watch_feed[t][-50:]

    # ------------------------------------------------------------------ interacciones del reloj
    ACTION_TEXT = {"water": "Registró un vaso de agua", "water_remove": "Quitó un vaso de agua", "meal": "Registró una comida",
                   "routine_done": "Marcó como hecha una actividad de la rutina", "routine_snooze": "Pospuso una actividad 15 min",
                   "breathe": "Hizo una pausa de respiración", "shelter": "Confirmó que está en el refugio",
                   "safe": "Confirmó que está bien tras la tormenta", "doctor": "Pidió hablar con el médico de vuelo",
                   "reminder": "Programó un recordatorio", "dnd": "Cambió 'No molestar'", "sleep_mode": "Cambió el modo sueño",
                   "mic": "Pausó/reanudó el micrófono", "sync": "Sincronizó el reloj con la estación",
                   "dictation": "Dictó un valor del control médico"}

    def week_history(self, crew_id):
        """Últimos 7 días para las gráficas de los avisos del reloj. Hoy sale de los datos en vivo; los 6 días
        anteriores son un historial simulado estable (semilla por tripulante y día) alrededor de su línea base."""
        import random
        crew = config.CREW_BY_ID[crew_id]
        b = crew["baseline"]
        s = self.state.get(crew_id, {})
        v = (s.get("vitals") or {})
        day0 = int(time.time() // 86400)
        days = []
        for i in range(6, 0, -1):
            r = random.Random(f"{crew_id}-{day0 - i}")
            days.append({"sleep_h": round(b["sleep_h"] + r.uniform(-0.6, 0.5), 2), "rest_hr": round(b["hr"] + r.uniform(-2.5, 2.5), 1),
                         "energy": round(r.uniform(52, 70)), "lunch": r.random() > 0.12, "sim": True})
        hrs = [p.get("hr") for p in list(self.store.series[crew_id])[-60:] if p.get("hr")]
        voice = next((x for x in self.store.voice if x["crew_id"] == crew_id), None)
        today = time.strftime("%Y-%m-%d")
        lunch = any(m.get("name") == "almuerzo" and time.strftime("%Y-%m-%d", time.localtime(m["ts"])) == today
                    for m in self.watch_counters[crew_id]["meals"])
        days.append({"sleep_h": v.get("sleep_h"), "rest_hr": round(min(hrs), 1) if hrs else v.get("hr"),
                     "energy": voice["indices"]["energy"] if voice else None, "lunch": lunch, "sim": False})
        return days

    def watch_action(self, crew_id, body):
        if crew_id not in config.CREW_BY_ID:
            return {"ok": False, "error": "tripulante desconocido"}
        kind = body.get("type", "")
        data = body.get("data") or {}
        crew = config.CREW_BY_ID[crew_id]
        cnt = self.watch_counters[crew_id]
        if kind == "water":
            cnt["water"] += 1
            self.hydration_cmds[crew_id] += 1            # el reloj simulado sube su índice de hidratación
        elif kind == "water_remove":
            cnt["water"] = max(0, cnt["water"] - 1)
        elif kind == "meal":
            cnt["meals"].append({"ts": time.time(), "name": data.get("name", "comida")})
        elif kind in ("routine_done", "routine_snooze"):
            cnt["routine"][data.get("item", "?")] = "hecho" if kind == "routine_done" else "pospuesto"
        elif kind == "breathe":
            cnt["breaths"] += 1
        elif kind == "dictation":                       # presión / glucosa que le dio el médico, dictadas por voz
            dic = cnt.setdefault("dictated", {})
            for k in ("bp", "glucose"):
                if data.get(k):
                    dic[k] = {"value": data[k], "ts": time.time()}
        text = self.ACTION_TEXT.get(kind, kind) + (f": {data.get('label')}" if data.get("label") else "")
        act = {"ts": time.time(), "crew_id": crew_id, "type": kind, "text": text, "data": data}
        self.watch_actions[crew_id].append(act)
        self.watch_actions[crew_id] = self.watch_actions[crew_id][-200:]
        if kind in ("doctor", "shelter", "safe"):
            sev = "warning" if kind == "doctor" else "watch"
            title = {"doctor": "Pidió hablar con el médico de vuelo", "shelter": "En el refugio blindado",
                     "safe": "Salió del refugio y está bien"}[kind]
            alert = {"id": uuid.uuid4().hex[:10], "ts": time.time(), "crew_id": crew_id, "crew_name": crew["name"],
                     "estado": "abierta", "risk": "BHP" if kind == "doctor" else "RAD",
                     "risk_name": "Salud conductual" if kind == "doctor" else "Carcinogénesis por radiación",
                     "severity": sev, "title": title, "evidence": data.get("reason") or "Acción hecha desde el reloj",
                     "recommendation": "Contactar al astronauta hoy" if kind == "doctor" else "Registrar el evento en su historial de dosis",
                     "source": "https://www.nasa.gov/hhp/human-system-risks/"}
            self.store.add_alert(alert)
            self.dtn.send_down("alert", {"alert": alert}, "EXPEDITED")
        self.store.event("reloj", f"{crew['name']}: {text}")
        return {"ok": True, "action": act, "counters": cnt}

    # ------------------------------------------------------------------ análisis periódico
    def _loop(self):
        while True:
            try:
                self.analyze_all()
                for m in self.dtn.pop_iss_messages():
                    p = m["payload"]
                    txt = p.get("text", "")
                    cid = p.get("crew_id")
                    self.store.add_chat(cid or "ALL", "houston", txt, {"latency_s": m["latency_s"], "bundle_id": m["bundle_id"]})
                    self.notify_watch(cid, "houston", f"Houston: {txt}", vibrate=True)
                    self.store.event("dtn", f"Mensaje de Tierra recibido por DTN ({m['latency_s']} s)")
            except Exception as e:
                self.store.event("error", f"loop: {e}")
            time.sleep(2)

    def analyze_all(self):
        now = time.time()
        env = self.iss.snapshot()
        acts = {cid: (self.store.latest(cid) or {}).get("activity") for cid in self.scenarios}
        rad = self.rad.snapshot(acts)
        dtn = self.dtn.status()
        for crew in config.CREW:
            cid = crew["id"]
            p5 = features.summarize(self.store.window(cid, 5))
            p60 = features.summarize(self.store.window(cid, 60))
            age = now - self.store.last_seen[cid] if self.store.last_seen[cid] else 1e9
            bl = self.baselines[cid]
            if p5:
                point = dict(p5)
                if p60 and p60.get("rmssd") is not None:
                    point["rmssd"] = p60["rmssd"]
                    point["irregularity"] = p60.get("irregularity")
                z = bl.z(point)
            else:
                point, z = None, {}
            vrec = next((v for v in self.store.voice if v["crew_id"] == cid), None)
            fnd = risk_engine.evaluate(crew, point, p60, bl, env, rad, vrec, self.symptoms[cid], age, z)
            sc, status = risk_engine.score(fnd)
            if point and age < 30:
                bl.update(point, frozen=any(f["severity"] in ("warning", "critical") for f in fnd))
                if not self.store.series[cid] or point["ts"] - self.store.series[cid][-1]["ts"] >= 4.5:
                    self.store.add_series_point(cid, {**{k: point.get(k) for k in (
                        "ts", "hr", "spo2", "skin_temp", "resp_rate", "sbp", "dbp", "rmssd", "accel_g", "activity")},
                        "score": sc, "dose": rad["dose_rate_ugy_h"]})
            self.state[cid] = {"crew": crew, "vitals": point, "zscores": z, "findings": fnd, "score": sc if point else None,
                               "status": status if point else "SIN DATOS", "env": env, "rad": rad, "dtn": dtn,
                               "voice": vrec, "watch_age_s": round(age, 1) if age < 1e8 else None,
                               "device": self.store.device.get(cid), "scenario": self.scenarios[cid],
                               "dose_mgy": rad["cumulative_mgy"].get(cid, 0),
                               # mSv estimados de la misión = días × tasa NASA en la Estación + lo que midió el dosímetro
                               "dose_msv": round(config.MISSION_DAY * config.T["iss_msv_per_day"] + rad["cumulative_msv"].get(cid, 0), 3)}
            warmup = now - self.started < 45
            for f in fnd:
                if f["severity"] in ("warning", "critical") and not (warmup and point is None):
                    key = (cid, f["risk"], f["title"])
                    if now - self._alert_seen.get(key, 0) > 120:
                        self._alert_seen[key] = now
                        alert = {"id": uuid.uuid4().hex[:10], "ts": now, "crew_id": cid, "crew_name": crew["name"],
                                 "estado": "abierta", **f}
                        self.store.add_alert(alert)
                        self.notify_watch(cid, "alert", f"{f['title']}. {f['recommendation']}", vibrate=True)
                        if f["severity"] == "critical":
                            self.dtn.send_down("alert", {"alert": alert, "vitals": point}, "EXPEDITED")
        if now - self._last_summary > config.SUMMARY_DOWNLINK_SECONDS:
            self._last_summary = now
            self.dtn.send_down("summary", {"crew": [{
                "crew_id": cid, "name": s["crew"]["name"], "status": s["status"], "score": s["score"],
                "vitals": {k: (s["vitals"] or {}).get(k) for k in ("activity", "hr", "spo2", "skin_temp", "resp_rate", "sbp", "dbp", "rmssd")},
                "findings": [{"risk": f["risk_name"], "sev": f["severity"], "title": f["title"], "evidence": f["evidence"]} for f in s["findings"][:4]],
                "voice": (s["voice"] or {}).get("indices"), "dose_mgy": s["dose_mgy"], "dose_msv": s.get("dose_msv")} for cid, s in self.state.items()],
                "env": {k: env.get(k) for k in ("ppco2_mmhg", "ppo2_mmhg", "pressure_mmhg", "temp_c", "source")},
                "rad": {k: rad.get(k) for k in ("dose_rate_ugy_h", "goes_10mev_pfu", "noaa_scale", "source")}}, "NORMAL")

    # ------------------------------------------------------------------ alertas y autorreportes
    def review_alert(self, alert_id, estado="revisada"):
        for a in self.store.alerts:
            if a.get("id") == alert_id:
                a["estado"] = estado
                a["reviewed_at"] = time.time()
                self.store.event("alerta", f"Alerta '{a['title']}' de {a['crew_name']} marcada como {estado}")
                return a
        return None

    def self_report(self, body):
        cid = body.get("tripulante") or body.get("crew_id")
        if cid not in config.CREW_BY_ID:
            return {"ok": False, "error": "tripulante desconocido"}
        rep = {"ts": time.time(), "crew_id": cid, "sintomas": body.get("sintomas", ""), "animo": body.get("animo"),
               "sueno": body.get("sueno"), "nota": body.get("nota", "")}
        self.reports.setdefault(cid, []).append(rep)
        text = " ".join(str(x) for x in (rep["sintomas"], rep["animo"] or "", rep["nota"]))
        for s in risk_engine.detect_symptoms(text):
            self.symptoms[cid].append({**s, "ts": time.time(), "text": text})
        self.store.event("autorreporte", f"{config.CREW_BY_ID[cid]['name']} registró un autorreporte")
        return {"ok": True, "report": rep}

    # ------------------------------------------------------------------ voz y chat
    def process_voice(self, crew_id, wav, transcript="", calibrate=False, ask=True, lang="es", log=True):
        crew = config.CREW_BY_ID[crew_id]
        feats = voice.analyze(wav)
        if not transcript:
            transcript = voice.transcribe(wav, config.WHISPER_MODEL) or ""
        calibrated = self.voice_base.calibrate(crew_id, feats, force=calibrate) if (calibrate or self.voice_base.base[crew_id]["n"] < 3) else False
        ix = self.voice_base.indices(crew_id, feats, transcript)
        syms = risk_engine.detect_symptoms(transcript)
        for s in syms:
            self.symptoms[crew_id].append({**s, "ts": time.time(), "text": transcript})
        rec = {"ts": time.time(), "crew_id": crew_id, "features": feats, "indices": ix, "transcript": transcript,
               "symptoms": syms, "calibration_sample": calibrated}
        self.store.add_voice(rec)
        self.analyze_all()
        reply = None
        if transcript.strip() and ask:
            reply = self.chat(crew_id, transcript, source="voz", lang=lang)
        elif transcript.strip() and log:
            self.store.add_chat(crew_id, "astronauta", transcript, {"source": "voz (comando)"})
        self.dtn.send_down("voice", {"crew_id": crew_id, "indices": ix, "transcript": transcript, "symptoms": syms,
                                     "features": {k: feats[k] for k in ("db_mean", "spl_est_db", "f0_mean", "f0_sd", "speech_rate_syl_s", "pause_ratio", "jitter", "hnr_db")}},
                           "EXPEDITED" if syms else "NORMAL")
        return {"voice": rec, "reply": reply}

    def chat(self, crew_id, text, source="texto", lang="es"):
        crew = config.CREW_BY_ID[crew_id]
        self.store.add_chat(crew_id, "astronauta", text, {"source": source})
        syms = risk_engine.detect_symptoms(text)
        if source != "voz":
            for s in syms:
                self.symptoms[crew_id].append({**s, "ts": time.time(), "text": text})
            if syms:
                self.analyze_all()
        res = ai.answer(crew, {**self.state.get(crew_id, {}), "counters": self.watch_counters.get(crew_id, {})}, text, lang)
        msg = self.store.add_chat(crew_id, "ia", res["text"], {"engine": res["engine"]})
        self.notify_watch(crew_id, "ai", res["text"])
        return {**msg, "engine": res["engine"]}
