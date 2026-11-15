#!/usr/bin/env python3
"""Simulador del hardware: un reloj SANBOSI por cada astronauta.

Emula lo que haría el firmware del ESP32 en la muñeca:
  * muestrea sensores a 1 Hz (modelo fisiológico en physiology.py)
  * empaqueta lotes cada --batch segundos y los envía al gateway de la estación (equivale al enlace BLE/Wi-Fi)
  * store-and-forward: si el gateway no responde (o se simula pérdida de enlace) guarda en memoria
    y reenvía cuando vuelve la conexión, igual que DTN pero a escala del cuerpo
  * consulta comandos de la estación (escenarios de prueba, mensajes de Houston, vibración de alerta)

Uso:  python watch/simulator.py --station http://localhost:8700
"""
import argparse
import collections
import json
import random
import sys
import threading
import time
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from physiology import Astronaut  # noqa: E402

FALLBACK_CREW = [
    {"id": "CM-01", "name": "CM-01", "baseline": {"hr": 58, "rmssd": 52, "spo2": 98, "skin_temp": 33.6, "resp": 13, "sbp": 114, "dbp": 72}},
    {"id": "CM-02", "name": "CM-02", "baseline": {"hr": 62, "rmssd": 45, "spo2": 98, "skin_temp": 33.4, "resp": 14, "sbp": 120, "dbp": 78}},
]


def http_json(method, url, body=None, timeout=4):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode() or "{}")


class Watch:
    """Un dispositivo físico (uno por astronauta)."""

    def __init__(self, astro: Astronaut, device_id: str, max_buffer: int = 3600):
        self.astro = astro
        self.device_id = device_id
        self.buffer = collections.deque(maxlen=max_buffer)   # memoria flash del reloj
        self.sent = 0
        self.dropped_link = 0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--station", default="http://localhost:8700")
    ap.add_argument("--batch", type=float, default=2.0, help="segundos por lote enviado")
    ap.add_argument("--drop-rate", type=float, default=0.0, help="probabilidad de perder un envío (enlace BLE ruidoso)")
    ap.add_argument("--speed", type=float, default=1.0, help=">1 acelera el reloj del simulador")
    args = ap.parse_args()
    base = args.station.rstrip("/")

    crew = None
    for _ in range(30):
        try:
            crew = http_json("GET", base + "/api/crew")["crew"]
            break
        except Exception:
            print("⌚ esperando a la estación en", base, "...")
            time.sleep(1)
    crew = crew or FALLBACK_CREW
    watches = {c["id"]: Watch(Astronaut(c), f"AVW-{c['id']}") for c in crew}
    print(f"⌚ {len(watches)} relojes emparejados con la estación: {', '.join(watches)}")

    link_forced_down = {"v": False}

    def poll_commands():
        while True:
            try:
                cmd = http_json("GET", base + "/api/watch/commands")
                for cid, sc in cmd.get("scenarios", {}).items():
                    if cid in watches:
                        watches[cid].astro.set_scenario(sc)
                link_forced_down["v"] = bool(cmd.get("watch_link_down"))
                for cid, n in (cmd.get("water") or {}).items():
                    if n and cid in watches:
                        watches[cid].astro.drink(n)
            except Exception:
                pass
            time.sleep(1.5)

    threading.Thread(target=poll_commands, daemon=True).start()

    last_send = time.time()
    while True:
        t0 = time.time()
        for w in watches.values():
            w.buffer.append(w.astro.step(1.0))
        if time.time() - last_send >= args.batch:
            last_send = time.time()
            for w in watches.values():
                if not w.buffer:
                    continue
                if link_forced_down["v"] or random.random() < args.drop_rate:
                    w.dropped_link += 1
                    continue
                pkts = list(w.buffer)[:300]          # tamaño máximo de lote
                try:
                    http_json("POST", base + "/api/ingest", {
                        "device_id": w.device_id, "crew_id": w.astro.id,
                        "buffered": len(w.buffer), "packets": pkts})
                    for _ in pkts:
                        w.buffer.popleft()
                    w.sent += len(pkts)
                except Exception as e:  # gateway caído: se queda en el buffer
                    w.dropped_link += 1
                    if w.dropped_link % 10 == 1:
                        print(f"⚠️  {w.device_id} sin enlace ({e}); {len(w.buffer)} muestras en memoria")
        time.sleep(max(0.0, 1.0 / args.speed - (time.time() - t0)))


if __name__ == "__main__":
    main()
