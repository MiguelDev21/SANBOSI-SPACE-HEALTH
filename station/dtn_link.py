"""Enlace Estación ⇄ Tierra con DTN (Bundle Protocol) usando el framework open source del paper
"An Open-Source Framework to Emulate Delay and Disruption Tolerant Networks for ISS Communication"
(Grover & Ponce, arXiv:2605.21624, https://github.com/kritgrover/iss-simulator), vendorizado en dtn-framework/.

Modos:
  embedded  -> importa el núcleo del framework (DTNBundleManager: BSP HMAC-SHA256 + AES-256-CBC, fragmentación,
               custodia ACK/NAK, colas por prioridad, SQLite) y lo maneja con las ventanas de contacto sintéticas del
               propio framework (experiment_runner), aceleradas DTN_TIME_SCALE veces. No requiere nada externo.
  external  -> se conecta al backend completo del framework (FastAPI + SGP4/Skyfield con TLE real de la ISS,
               presupuesto de enlace, globo 3D) corriendo en DTN_EXTERNAL_URL, vía su REST y su WebSocket.
"""
import asyncio
import contextlib
import io
import itertools
import json
import sys
import threading
import time
from datetime import datetime

import requests

from . import config

sys.path.insert(0, str(config.DTN_FRAMEWORK_BACKEND))


def _iso_to_ts(s):
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00")).timestamp()
    except Exception:
        return time.time()


class DTNLink:
    def __init__(self):
        self.mode = config.DTN_MODE
        self.mcc = config.MISSION_CONTROL_STATION
        self.lock = threading.RLock()
        self.blackout = False
        self.destination = "ISS"          # ISS / LUNA / MARTE (añade retardo de luz)
        self.stations = []
        self.visible = []
        self.next_pass_min = None
        self.sent = []                    # bundles creados en la estación
        self.earth_inbox = []             # lo que realmente llegó al nodo terrestre (descifrado)
        self.iss_inbox = []               # mensajes de Houston que llegaron a la estación
        self._seen_earth, self._seen_iss = set(), set()
        self.error = None
        self.clock = 0.0
        self.log = io.StringIO()
        self.stats = {"bundles_down": 0, "bundles_up": 0, "delivered_down": 0, "delivered_up": 0, "latencies": []}

    # ================================================================== arranque
    def start(self):
        if self.mode == "external":
            threading.Thread(target=lambda: asyncio.run(self._external_ws()), daemon=True).start()
            threading.Thread(target=self._external_poll_iss, daemon=True).start()
        else:
            self._embedded_init()
            threading.Thread(target=self._embedded_loop, daemon=True).start()

    # ================================================================== EMBEDDED
    def _embedded_init(self):
        with contextlib.redirect_stdout(self.log):
            import experiment_runner as er
            from dtn_bundle_manager import DTNBundleManager
            self.er = er
            ids = [s["id"] for s in er.GROUND_STATIONS]
            mesh = list(itertools.combinations(ids, 2))     # red terrestre (NISN) totalmente conectada
            db = config.DATA_DIR / "dtn_bundles.db"
            if db.exists():
                db.unlink()                                # sesión limpia en cada arranque de la demo
            self.mgr = DTNBundleManager(er.GROUND_STATIONS, mesh_connections=mesh, db_path=str(db))
        self.stations = er.GROUND_STATIONS

    def _embedded_loop(self):
        er, m = self.er, self.mgr
        while True:
            try:
                dt = config.DTN_TIME_SCALE
                with self.lock, contextlib.redirect_stdout(self.log):
                    self.clock += dt
                    m.metrics.set_sim_clock(self.clock)
                    sd, cs, vs = er.get_synthetic_station_data(self.clock)
                    if self.blackout:
                        cs = {k: False for k in cs}
                        for s in sd:
                            s["is_visible"] = False
                        vs = []
                    comp = m.update_transmissions(dt, cs)
                    er._process_completed(m, comp)
                    m.check_timeouts(cs)
                    act = sorted(vs, key=lambda s: -s["look_angles"]["elevation"])[0]["id"] if vs else None
                    er._schedule_transmissions(m, sd, act, {})
                    self.visible = [s["id"] for s in vs]
                    self.next_pass_min = None if vs else min((s["next_pass_minutes"] for s in sd), default=None)
                    self._stations_data = sd
                    self._collect_embedded()
                if self.log.tell() > 2_000_000:
                    self.log = io.StringIO()
            except Exception as e:
                self.error = f"DTN embedded: {e}"
            time.sleep(1.0)

    def _collect_embedded(self):
        for msg in self.mgr.station_decrypted_messages.get(self.mcc, []):
            self._accept_earth(msg)
        for b in self.mgr.get_iss_delivered_bundles():
            bid = b["parent_bundle_id"]
            if b.get("is_complete") and bid not in self._seen_iss:
                r = self.mgr.reassemble_and_decrypt_bundle(b["bundle_id"])
                if r:
                    self._seen_iss.add(bid)
                    self._accept_iss(bid, r.get("decrypted_payload", ""), r.get("source_station"), b.get("created_at"))

    # ================================================================== EXTERNAL
    async def _external_ws(self):
        try:
            import websockets
        except Exception as e:
            self.error = f"Instala 'websockets' para DTN_MODE=external ({e})"
            return
        url = config.DTN_EXTERNAL_URL.replace("http", "ws", 1) + "/ws/orbital_tracking"
        while True:
            try:
                async with websockets.connect(url, max_size=2 ** 24) as ws:
                    self.error = None
                    async for raw in ws:
                        d = json.loads(raw)
                        if d.get("type") == "connection":
                            self.stations = d.get("stations", [])
                        if d.get("type") != "orbital_update":
                            continue
                        with self.lock:
                            sd = d.get("stations", [])
                            self.visible = [s["id"] for s in sd if s.get("is_visible")]
                            self.next_pass_min = None if self.visible else min((s.get("next_pass_minutes", 999) for s in sd), default=None)
                            for msg in (d.get("station_decrypted_messages") or {}).get(self.mcc, []):
                                self._accept_earth(msg)
            except Exception as e:
                self.error = f"DTN external WS ({url}): {e}"
                await asyncio.sleep(3)

    def _external_poll_iss(self):
        base = config.DTN_EXTERNAL_URL
        while True:
            try:
                msgs = requests.get(base + "/api/iss/messages", timeout=5).json().get("messages", [])
                for b in msgs:
                    pid = b.get("parent_bundle_id", b["bundle_id"])
                    if b.get("is_complete") and pid not in self._seen_iss:
                        r = requests.post(f"{base}/api/iss/messages/{b['bundle_id']}/reassemble", timeout=5).json()
                        if r.get("success"):
                            self._seen_iss.add(pid)
                            m = r["message"]
                            with self.lock:
                                self._accept_iss(pid, m.get("decrypted_payload", ""), m.get("source_station"), b.get("created_at"))
            except Exception as e:
                self.error = f"DTN external REST: {e}"
            time.sleep(2)

    # ================================================================== común
    def _accept_earth(self, msg):
        bid = msg.get("bundle_id")
        if bid in self._seen_earth or msg.get("source_station", "").upper() != "ISS":
            return
        self._seen_earth.add(bid)
        try:
            payload = json.loads(msg.get("decrypted_payload", "{}"))
        except Exception:
            payload = {"type": "raw", "text": msg.get("decrypted_payload")}
        created = payload.get("_created", time.time())
        arrived = _iso_to_ts(msg.get("reassembled_at", "")) + config.LIGHT_DELAY.get(self.destination, 0)
        self.earth_inbox.append({"bundle_id": bid, "arrived": arrived, "created": created, "payload": payload,
                                 "latency_s": round(arrived - created, 1), "via": "DTN/BSP"})
        self.earth_inbox = self.earth_inbox[-400:]
        self.stats["delivered_down"] += 1
        self.stats["latencies"] = (self.stats["latencies"] + [arrived - created])[-200:]

    def _accept_iss(self, bid, text, src, created_iso):
        try:
            payload = json.loads(text)
        except Exception:
            payload = {"type": "chat", "text": text}
        created = payload.get("_created") or _iso_to_ts(created_iso or "")
        arrived = time.time() + config.LIGHT_DELAY.get(self.destination, 0)
        self.iss_inbox.append({"bundle_id": bid, "from": src, "payload": payload, "arrived": arrived,
                               "latency_s": round(arrived - created, 1)})
        self.stats["delivered_up"] += 1

    def send_down(self, kind, payload, priority="NORMAL"):
        """Estación -> Tierra (Houston)."""
        body = json.dumps({"type": kind, "_created": time.time(), **payload}, ensure_ascii=False, default=str)
        try:
            if self.mode == "external":
                r = requests.post(config.DTN_EXTERNAL_URL + "/api/iss/messages/reply", timeout=5, json={
                    "destination_station": self.mcc, "payload": body, "priority": priority, "ttl_hours": 24}).json()
                bid = r.get("bundle", {}).get("bundle_id")
            else:
                with self.lock, contextlib.redirect_stdout(self.log):
                    bid = self.mgr.create_iss_reply_bundle(destination_station=self.mcc, payload=body,
                                                           priority=priority, ttl_hours=24).bundle_id
            self.stats["bundles_down"] += 1
            self.sent.append({"ts": time.time(), "bundle_id": bid, "kind": kind, "priority": priority, "bytes": len(body)})
            self.sent = self.sent[-200:]
            return bid
        except Exception as e:
            self.error = f"send_down: {e}"
            return None

    def send_up(self, text, crew_id=None, sender="Flight Surgeon"):
        """Tierra (Houston) -> Estación."""
        body = json.dumps({"type": "chat", "_created": time.time(), "text": text, "crew_id": crew_id, "from": sender}, ensure_ascii=False)
        try:
            if self.mode == "external":
                r = requests.post(config.DTN_EXTERNAL_URL + "/api/bundle/create", timeout=5, json={
                    "source_station": self.mcc, "destination": "ISS", "payload": body, "priority": "EXPEDITED", "ttl_hours": 24}).json()
                bid = r.get("bundle", {}).get("bundle_id")
            else:
                with self.lock, contextlib.redirect_stdout(self.log):
                    bid = self.mgr.create_bundle(source_station=self.mcc, destination="ISS", payload=body,
                                                 priority="EXPEDITED", ttl_hours=24).bundle_id
            self.stats["bundles_up"] += 1
            return bid
        except Exception as e:
            self.error = f"send_up: {e}"
            return None

    def queues(self):
        if self.mode == "external":
            return {"iss_queue": None}
        with self.lock:
            return {"iss_queue": len(self.mgr.iss_queue),
                    "ground_queues": {k: len(v) for k, v in self.mgr.station_queues.items() if v},
                    "in_flight": len(self.mgr.active_transmissions), "waiting_ack": len(self.mgr.pending_acknowledgments)}

    def status(self):
        lat = self.stats["latencies"]
        return {"mode": self.mode, "framework": "kritgrover/iss-simulator (arXiv:2605.21624)",
                "contact": bool(self.visible), "visible_stations": self.visible, "next_pass_min": self.next_pass_min,
                "blackout": self.blackout, "destination": self.destination,
                "light_delay_s": config.LIGHT_DELAY.get(self.destination, 0), "mission_control": self.mcc,
                "time_scale": config.DTN_TIME_SCALE, "orbit_clock_s": round(self.clock),
                "bundles_down": self.stats["bundles_down"], "bundles_up": self.stats["bundles_up"],
                "delivered_down": self.stats["delivered_down"], "delivered_up": self.stats["delivered_up"],
                "avg_latency_s": round(sum(lat) / len(lat), 1) if lat else None, **self.queues(), "error": self.error}

    def earth_view(self, limit=150):
        now = time.time()
        return [m for m in self.earth_inbox if m["arrived"] <= now][-limit:]

    def pop_iss_messages(self):
        now = time.time()
        ready = [m for m in self.iss_inbox if m["arrived"] <= now]
        self.iss_inbox = [m for m in self.iss_inbox if m["arrived"] > now]
        return ready
