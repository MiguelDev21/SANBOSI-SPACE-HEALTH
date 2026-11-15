"""Motor de diagnóstico a bordo: reglas clínicas explicables mapeadas a los riesgos del Human System Risk Board.

Cada hallazgo incluye la evidencia numérica, la recomendación y la fuente, para que el astronauta (y el
cirujano de vuelo cuando haya enlace) sepa por qué el sistema concluyó algo. Las reglas son deterministas;
la IA generativa solo redacta y conversa sobre estos hallazgos, nunca los inventa.
"""
import json
import re
import time

from . import config

KB = json.loads((config.STATION_DIR / "knowledge" / "hsrb_risks.json").read_text(encoding="utf-8"))
RISKS = {r["id"]: r for r in KB["risks"]}
SEV_W = {"info": 2, "watch": 8, "warning": 20, "critical": 45}
SEV_ORDER = ["info", "watch", "warning", "critical"]
# palabras que sirven para buscar conocimiento (RAG) pero no son síntomas
TOPIC_WORDS = {"radiación", "tormenta solar", "dosis", "sin señal", "houston", "medicina", "pastilla", "aterrizaje",
               "polvo", "láser", "corriente", "corazón", "sueño", "fatiga"}


def finding(risk, severity, title, evidence, recommendation=None):
    r = RISKS.get(risk, {"name": risk, "countermeasures": [], "url": ""})
    return {"risk": risk, "risk_name": r["name"], "severity": severity, "title": title, "evidence": evidence,
            "recommendation": recommendation or (r["countermeasures"][0] if r["countermeasures"] else ""),
            "source": r.get("url", "")}


def evaluate(crew, p, w60, baseline, env, rad, voice, symptoms, watch_age_s, zscores):
    """p: resumen 5 s; w60: resumen 60 s; env: ambiente ISS; rad: radiación; voice: último análisis de voz."""
    T = config.T
    f = []
    if p is None:
        x = finding("IMC", "warning", "Sin datos del reloj", "No se han recibido muestras", "Verificar que el reloj esté puesto y emparejado")
        x["technical"] = True
        return [x]
    act = p.get("activity")
    resting = act in ("rest", "sleep")
    if (p.get("quality") or 1) < config.T["min_quality"]:
        x = finding("IMC", "watch", "Señal de baja calidad", f"Índice de calidad {p['quality']:.2f}: se omiten alertas de esta ventana",
                    "Ajustar la correa del reloj")
        x["technical"] = True
        return [x]
    hr, spo2 = p.get("hr") or 0.0, p.get("spo2")
    b = crew["baseline"]

    if watch_age_s > T["watch_timeout_s"]:
        x = finding("EIHSO", "warning", "Reloj sin enlace con la estación",
                    f"Última muestra hace {watch_age_s:.0f} s", "Pedir que ajuste el reloj en la muñeca; el reloj guarda datos y los reenvía")
        x["technical"] = True
        f.append(x)

    # ---- Cardiovascular ----
    if hr is not None:
        if resting and hr > T["hr_rest_high"]:
            f.append(finding("CV", "warning", "Taquicardia en reposo", f"FC {hr:.0f} lpm en {act} (base {b['hr']})"))
        if act == "eva" and hr > T["hr_eva_high"]:
            f.append(finding("EVA", "critical", "Sobreesfuerzo en EVA", f"FC {hr:.0f} lpm sostenida", "Pausar la tarea y descansar en posición estable"))
        if hr < T["hr_low"] and act != "sleep":
            f.append(finding("CV", "warning", "Bradicardia", f"FC {hr:.0f} lpm despierto"))
    irr = (w60 or {}).get("irregularity")
    if irr is not None and irr > 0.12 and (w60 or {}).get("beats", 0) > 30:
        sev = "critical" if irr > 0.25 else "warning"
        f.append(finding("CV", sev, "Ritmo cardíaco irregular (posible arritmia)",
                         f"{irr*100:.0f}% de latidos fuera de rango en 60 s", "Registrar ECG de 12 derivaciones y reposo; notificar a cirujano de vuelo"))
    sbp = p.get("sbp")
    if sbp is not None:
        if sbp < T["sbp_low"] or (b["sbp"] - sbp > 20 and hr and hr > b["hr"] + 25):
            f.append(finding("OI", "warning", "Hipotensión / intolerancia ortostática", f"PAS {sbp:.0f} mmHg con FC {hr:.0f}",
                             "Posición supina, carga de fluidos, prendas de compresión"))
        elif sbp > T["sbp_high"] and resting:
            f.append(finding("CV", "watch", "Presión arterial elevada", f"PAS {sbp:.0f} mmHg en reposo"))

    # ---- Oxigenación / CO2 ----
    if spo2 is not None:
        if spo2 < T["spo2_crit"]:
            f.append(finding("HYPOXIA", "critical", "Hipoxemia severa", f"SpO2 {spo2:.0f}%", "Oxígeno suplementario inmediato y verificar ppO2"))
        elif spo2 < T["spo2_warn"]:
            f.append(finding("HYPOXIA", "warning", "Desaturación de oxígeno", f"SpO2 {spo2:.0f}%"))
    rr_ = p.get("resp_rate")
    ppco2 = (env or {}).get("ppco2_mmhg")
    if ppco2 is not None and ppco2 > T["cabin_ppco2_warn_mmhg"]:
        sev = "critical" if ppco2 > T["cabin_ppco2_crit_mmhg"] else "warning"
        extra = f" y FR {rr_:.0f} rpm" if rr_ else ""
        f.append(finding("CO2", sev, "CO2 de cabina elevado", f"ppCO2 {ppco2:.1f} mmHg ({env.get('source', '')}){extra}"))
    if rr_ is not None and resting and rr_ > T["resp_high"]:
        f.append(finding("CO2" if (ppco2 or 0) > 2.5 else "IMC", "watch", "Taquipnea en reposo", f"FR {rr_:.0f} rpm"))

    # ---- Inmune / temperatura ----
    t = p.get("skin_temp")
    if t is not None:
        dt_ = t - b["skin_temp"]     # la piel de la muñeca es ~3-4 °C menor que la temperatura central: se usa el delta personal
        if t > T["skin_temp_fever"] or dt_ > T["skin_temp_delta_fever"]:
            sev = "critical" if dt_ > 2.5 or t > 37.6 else "warning" if dt_ > 1.6 or t > T["skin_temp_fever"] else "watch"
            f.append(finding("IMM", sev, "Temperatura elevada (posible infección)",
                             f"Temp. piel {t:.1f} °C (+{dt_:.1f} °C sobre su base) con FC {hr:.0f}"))

    # ---- Estrés agudo (activación simpática en reposo) ----
    if act in ("rest", "sleep", "work") and hr > b["hr"] + 20 and (sbp or 0) > b["sbp"] + 8 and (rr_ or 0) > b["resp"] + 3:
        f.append(finding("BHP", "watch", "Respuesta de estrés agudo",
                         f"FC +{hr - b['hr']:.0f} lpm, PAS +{(sbp or 0) - b['sbp']:.0f} mmHg y FR {rr_:.0f} rpm en reposo",
                         "Respiración guiada 4-7-8 durante 3 min; ofrecer contacto con soporte psicológico"))

    # ---- Sueño de la noche anterior + regla combinada del área de Software/Salud ----
    sl = p.get("sleep_h")
    if sl is not None and sl < T["sleep_short_h"]:
        rm = (w60 or {}).get("rmssd")
        if rm is not None and rm < b["rmssd"] * 0.75 and hr > b["hr"] + 5:
            f.append(finding("SLEEP", "warning", "Posible fatiga / estrés: sueño corto + pulso alto + VFC baja",
                             f"Durmió {int(sl)} h {round((sl % 1) * 60):02d} · FC {hr:.0f} (base {b['hr']}) · RMSSD {rm:.0f} ms (base {b['rmssd']})",
                             "Ajustar el horario de descanso y revisar ruido y luz en su cabina"))
        else:
            f.append(finding("SLEEP", "watch", "Sueño corto anoche", f"{int(sl)} h {round((sl % 1) * 60):02d} (habitual {b.get('sleep_h', 7)} h)",
                             "Siesta programada y revisar el horario de descanso"))

    # ---- Sueño / fatiga (HRV) ----
    rmssd = (w60 or {}).get("rmssd")
    if rmssd is not None and act not in ("exercise", "eva") and rmssd < b["rmssd"] * T["rmssd_drop_ratio"] and (irr or 0) < 0.12:
        f.append(finding("SLEEP", "watch", "Variabilidad cardíaca baja (fatiga / estrés)",
                         f"RMSSD {rmssd:.0f} ms vs base {b['rmssd']} ms"))

    # ---- Hidratación / renal ----
    hyd = p.get("hydration")
    if hyd is not None and hyd < 0.85:
        f.append(finding("RENAL", "watch" if hyd > 0.75 else "warning", "Deshidratación probable",
                         f"Índice de hidratación {hyd*100:.0f}% con FC {hr:.0f}", "Beber 500 ml de agua; meta diaria de hidratación"))

    # ---- EVA / traje ----
    suit = p.get("suit")
    if suit:
        if suit.get("metabolic_w", 0) > T["metabolic_eva_high_w"]:
            f.append(finding("EVA", "warning", "Tasa metabólica alta en EVA", f"{suit['metabolic_w']} W (máx. EMU ~580 W)"))
        if suit.get("ppco2_mmhg", 0) > T["suit_ppco2_warn_mmhg"]:
            f.append(finding("CO2", "critical", "CO2 alto dentro del traje", f"ppCO2 traje {suit['ppco2_mmhg']:.1f} mmHg",
                             "Activar modo de purga y regresar a la esclusa"))
        if suit.get("pressure_psi", 4.3) < 3.9:
            f.append(finding("DCS", "warning", "Presión de traje baja", f"{suit['pressure_psi']:.2f} psi (nominal 4.3)"))
    if suit and not any(x["risk"] in ("EVA", "CO2", "DCS") for x in f):
        f.append(finding("EVA", "info", "EVA en curso · monitoreo reforzado",
                         f"{suit.get('metabolic_w')} W · traje {suit.get('pressure_psi', 0):.2f} psi · CO2 {suit.get('ppco2_mmhg', 0):.1f} mmHg · O2 {suit.get('o2_pct', 0):.0f}%",
                         "Mantener ritmo de trabajo; hidratación por bolsa del traje"))
    if p.get("symptom"):
        f.append(finding("DCS" if act == "eva" else "IMC", "critical" if act == "eva" else "warning",
                         "Síntoma reportado por el reloj", p["symptom"], "Terminar EVA, repressurizar y tratar con O2" if act == "eva" else None))

    # ---- Inmovilidad ----
    acc = p.get("accel_g")
    if acc is not None and acc < 0.003 and act != "sleep" and (rr_ if rr_ is not None else 99) < 10:
        f.append(finding("IMC", "critical", "Sin movimiento y respiración lenta", "Acelerómetro ~0 g, FR baja",
                         "Contactar al astronauta de inmediato; alerta a la tripulación"))

    # ---- Radiación ----
    if rad:
        if rad.get("goes_10mev_pfu", 0) >= T["goes_10mev_s1_pfu"]:
            f.append(finding("RAD", "critical" if rad["goes_10mev_pfu"] > 100 else "warning",
                             f"Evento de partículas solares ({rad.get('noaa_scale', 'S1')})",
                             f"GOES ≥10 MeV: {rad['goes_10mev_pfu']:.0f} pfu", "Refugiarse en el módulo con más blindaje; posponer EVA"))
        dr = rad.get("dose_rate_ugy_h", 0)
        if dr > T["dose_rate_warn_ugy_h"]:
            f.append(finding("RAD", "warning", "Tasa de dosis muy alta", f"{dr:.1f} µGy/h ({rad.get('source', '')})",
                             "Permanecer en módulo blindado y evitar EVA hasta que baje"))
        elif dr > T["dose_rate_high_ugy_h"]:
            f.append(finding("RAD", "info", "Tasa de dosis elevada (probable paso por la Anomalía del Atlántico Sur)",
                             f"{dr:.1f} µGy/h ({rad.get('source', '')})", "Transitorio; se registra en la dosis acumulada"))

    # ---- Voz ----
    if voice and time.time() - voice["ts"] < 900:
        ix = voice.get("indices", {})
        if ix.get("fatigue", 0) >= 65:
            f.append(finding("SLEEP", "watch", "Fatiga detectada en la voz", f"Índice de fatiga {ix['fatigue']}/100"))
        if ix.get("stress", 0) >= 65:
            f.append(finding("BHP", "watch", "Estrés detectado en la voz", f"Índice de estrés {ix['stress']}/100"))
        if ix.get("mood", 50) <= 30:
            f.append(finding("BHP", "watch", "Estado de ánimo bajo", f"Índice de ánimo {ix['mood']}/100",
                             "Ofrecer conferencia privada con soporte psicológico"))
    for s in symptoms or []:
        if time.time() - s["ts"] < 1800:
            f.append(finding(s["risk"], "warning", f"Síntoma referido: “{s['phrase']}”", "Dicho por el astronauta: “" + s.get("text", "")[:90] + "”"))

    # ---- Anomalías estadísticas vs línea base personal ----
    serious = any(x["severity"] in ("warning", "critical") for x in f)
    for m, z in (zscores or {}).items():
        if abs(z) >= 4 and not serious and act not in ("exercise", "eva"):
            f.append(finding("IMC", "info", f"Anomalía estadística en {m}", f"z = {z:+.1f} respecto a su línea base personal"))

    # quitar duplicados por (riesgo, título)
    seen, out = set(), []
    for x in sorted(f, key=lambda x: -SEV_ORDER.index(x["severity"])):
        k = (x["risk"], x["title"])
        if k not in seen:
            seen.add(k)
            out.append(x)
    return out


def score(findings):
    s = 100
    for x in findings:
        s -= SEV_W[x["severity"]]
    s = max(0, s)
    worst = max((SEV_ORDER.index(x["severity"]) for x in findings), default=-1)
    # Estados acordados con el área de Salud: el sistema detecta variaciones, no diagnostica
    status = ["Normal", "Normal", "Observación", "Atención", "Crítica"][worst + 1]
    if worst <= 2 and any(x.get("technical") for x in findings) and not any(
            x["severity"] in ("warning", "critical") and not x.get("technical") for x in findings):
        status = "Revisar sensor"
    return s, status


QUESTION_START = re.compile(r"^\s*[¿]?\s*(qu[eé]|c[oó]mo|cu[aá]nt[oa]s?|cu[aá]l|hay|d[oó]nde|por qu[eé]|what|how|whats|what's|hows|how's|is|are|do|does|did|can|could|tell me|show me|check)\b", re.I)
PAIN = re.compile(r"(dolor|duele|duelen|ardor|arden|mareo|n[aá]use|v[oó]mit|me siento|no puedo|me falta|pain|hurt|ache|dizzy|nause|vomit|i feel|i can't|i cannot|i'm|(?<!do )i am|(?<!do )i have)", re.I)


def is_question(text):
    t = (text or "").strip()
    return ("?" in t or "¿" in t or bool(QUESTION_START.search(t)))


def detect_symptoms(text):
    """Busca frases de síntomas en lo que dijo el astronauta y las asocia a un riesgo HSRB.
    Una PREGUNTA sobre un dato ("¿tengo fiebre?", "how is my heart?") no se toma como síntoma referido;
    sí cuenta si describe una molestia ("¿qué hago si me duele la cabeza?")."""
    if is_question(text) and not PAIN.search(text or ""):
        return []
    t = " " + re.sub(r"[^\wáéíóúñü ]", " ", (text or "").lower()) + " "
    hits = []
    for r in KB["risks"]:
        for kw in r.get("keywords", []) + r.get("keywords_en", []):
            if kw in TOPIC_WORDS:
                continue
            if re.search(r"(?<![\wáéíóúñü])" + re.escape(kw) + r"(?![\wáéíóúñü])", t):
                hits.append({"risk": r["id"], "phrase": kw})
                break
    if len(hits) > 1:      # "dolor"/"me siento mal" genéricos solo cuentan si no hubo algo más específico
        hits = [h for h in hits if h["risk"] != "IMC"] or hits
    return hits
