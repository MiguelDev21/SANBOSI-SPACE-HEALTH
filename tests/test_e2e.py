#!/usr/bin/env python3
"""Prueba extremo a extremo: estación + relojes simulados + escenarios + voz + DTN a Tierra.

  python tests/test_e2e.py          (arranca todo en puertos de prueba y lo apaga al final)
"""
import io
import json
import os
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

import numpy as np
from scipy.io import wavfile

ROOT = Path(__file__).resolve().parent.parent
PORT = int(os.environ.get("TEST_PORT", "8799"))
BASE = f"http://localhost:{PORT}"


def req(method, path, body=None, raw=None, ctype="application/json"):
    data = raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
    r = urllib.request.Request(BASE + path, data=data, method=method, headers={"Content-Type": ctype})
    with urllib.request.urlopen(r, timeout=30) as resp:
        return json.loads(resp.read().decode())


def synth_voice(f0=200, sd=30, rate=4.5, pause=0.15, amp=0.2, dur=6, sr=16000, seed=0):
    rng = np.random.default_rng(seed)
    t = np.arange(int(dur * sr)) / sr
    f = f0 + sd * np.sin(2 * np.pi * 0.7 * t)
    ph = 2 * np.pi * np.cumsum(f) / sr
    x = sum(np.sin(k * ph) / k for k in range(1, 8)) * 0.5 * (1 + np.sin(2 * np.pi * rate * t))
    g = np.ones_like(t); g[(t % 1.6) > 1.6 * (1 - pause)] = 0
    y = x * g + rng.normal(0, 0.002, len(t))
    b = io.BytesIO(); wavfile.write(b, sr, (y / np.max(np.abs(y)) * amp * 32767).astype(np.int16))
    return b.getvalue()


def wait_for(cond, timeout, msg):
    t0 = time.time()
    while time.time() - t0 < timeout:
        try:
            v = cond()
            if v:
                return v
        except Exception:
            pass
        time.sleep(1)
    raise AssertionError("timeout: " + msg)


def main():
    env = dict(os.environ, SANBOSI_PORT=str(PORT), NASA_MODE=os.environ.get("NASA_MODE", "auto"),
               SANBOSI_DATA=str(ROOT / "station" / "data" / "test"), SUMMARY_DOWNLINK_SECONDS="10")
    srv = subprocess.Popen([sys.executable, "-m", "station.app"], cwd=ROOT, env=env)
    watch = None
    ok = []
    try:
        wait_for(lambda: req("GET", "/api/crew"), 20, "estación")
        watch = subprocess.Popen([sys.executable, "watch/simulator.py", "--station", BASE], cwd=ROOT)
        wait_for(lambda: all(c["vitals"]["hr"] for c in req("GET", "/api/state")["crew"]), 30, "datos de relojes")
        ok.append("relojes → estación (4 astronautas)")

        cases = {"CM-01": ("hypoxia", "HYPOXIA"), "CM-02": ("fever", "IMM"), "CM-03": ("arrhythmia", "CV"), "CM-04": ("eva_co2", "CO2")}
        for cid, (sc, _) in cases.items():
            req("POST", "/api/scenario", {"crew_id": cid, "scenario": sc})
        for cid, (sc, risk) in cases.items():
            wait_for(lambda: any(f["risk"] == risk for f in req("GET", f"/api/crew/{cid}")["findings"]), 120, f"{sc} → {risk}")
            ok.append(f"escenario {sc} detectado como riesgo {risk} en {cid}")
        st = req("GET", "/api/state")
        assert any(a["severity"] == "critical" for a in st["alerts"]), "sin alertas críticas"
        ok.append(f"{len(st['alerts'])} alertas generadas")

        req("POST", "/api/scenario", {"crew_id": "ALL", "scenario": "solar_storm"})
        wait_for(lambda: any(f["risk"] == "RAD" for f in req("GET", "/api/crew/CM-01")["findings"]), 20, "tormenta solar")
        ok.append("tormenta solar → riesgo RAD")
        req("POST", "/api/scenario", {"crew_id": "ALL", "scenario": "cabin_co2"})
        wait_for(lambda: any(f["risk"] == "CO2" for f in req("GET", "/api/crew/CM-02")["findings"]), 20, "CO2 cabina")
        ok.append("CO2 de cabina (ISS Live + inyección) → riesgo CO2")
        req("POST", "/api/scenario", {"crew_id": "ALL", "scenario": "nominal"})

        for i in range(3):
            req("POST", "/api/voice/CM-03?transcript=" + urllib.parse.quote("hola, todo bien por aquí"), raw=synth_voice(seed=i), ctype="audio/wav")
        r = req("POST", "/api/voice/CM-03?transcript=" + urllib.parse.quote("estoy muy cansada, no dormí y me duele la cabeza"),
                raw=synth_voice(f0=185, sd=8, rate=2.5, pause=0.4, amp=0.08, seed=7), ctype="audio/wav")
        ix = r["voice"]["indices"]
        assert ix["fatigue"] > 65, ix
        assert any(s["risk"] == "CO2" for s in r["voice"]["symptoms"]), r["voice"]["symptoms"]
        assert r["reply"]["text"], "sin respuesta IA"
        ok.append(f"voz: fatiga {ix['fatigue']} estrés {ix['stress']} ánimo {ix['mood']}; síntoma 'dolor de cabeza'; IA: {r['reply']['engine']}")

        bid = req("POST", "/api/earth/send", {"text": "CM-03, descansa 2 horas. Houston.", "crew_id": "CM-03"})["bundle_id"]
        assert bid
        wait_for(lambda: any(m["role"] == "houston" for m in req("GET", "/api/crew/CM-03")["chat"]), 400, "uplink Houston→estación")
        ok.append("uplink Tierra → estación por DTN")
        inbox = wait_for(lambda: [m for m in req("GET", "/api/earth/inbox")["inbox"] if m["payload"]["type"] == "summary"], 400, "downlink resumen")
        types = {m["payload"]["type"] for m in req("GET", "/api/earth/inbox")["inbox"]}
        ok.append(f"downlink estación → Tierra por DTN: {len(inbox)} resúmenes, tipos {sorted(types)}")

        req("POST", "/api/dtn", {"blackout": True})
        n0 = req("GET", "/api/earth/inbox")["dtn"]["delivered_down"]
        time.sleep(15)
        n1 = req("GET", "/api/earth/inbox")["dtn"]["delivered_down"]
        assert n1 - n0 <= 3, (n0, n1)   # solo pueden terminar los paquetes que ya iban en vuelo
        req("POST", "/api/dtn", {"blackout": False})
        wait_for(lambda: req("GET", "/api/earth/inbox")["dtn"]["delivered_down"] > n1, 120, "entrega tras LOS")
        ok.append("pérdida de señal: datos custodiados a bordo y entregados al recuperar contacto")

        csv_txt = urllib.request.urlopen(BASE + "/api/export/CM-01.csv", timeout=10).read().decode()
        assert csv_txt.startswith("ts,"), csv_txt[:50]
        ok.append("exportación CSV")
        print("\n✅ PRUEBA E2E OK")
        for x in ok:
            print("  ·", x)
    finally:
        if watch:
            watch.terminate()
        srv.terminate()


if __name__ == "__main__":
    import urllib.parse  # noqa
    main()
