"""Almacenamiento de la estación: buffers en memoria para tiempo real + SQLite para persistencia/auditoría."""
import collections
import json
import sqlite3
import threading
import time

from . import config


class Store:
    def __init__(self, db_path=None):
        self.lock = threading.RLock()
        self.packets = {c["id"]: collections.deque(maxlen=3600) for c in config.CREW}   # 1 h a 1 Hz
        self.series = {c["id"]: collections.deque(maxlen=720) for c in config.CREW}     # puntos agregados 5 s
        self.last_seen = {c["id"]: 0.0 for c in config.CREW}
        self.device = {c["id"]: {} for c in config.CREW}
        self.alerts = collections.deque(maxlen=500)
        self.voice = collections.deque(maxlen=200)
        self.chat = collections.deque(maxlen=200)
        self.events = collections.deque(maxlen=300)
        self.db = sqlite3.connect(str(db_path or (config.DATA_DIR / "sanbosi.db")), check_same_thread=False)
        self.db.executescript("""
        CREATE TABLE IF NOT EXISTS vitals(ts REAL, crew_id TEXT, data TEXT);
        CREATE TABLE IF NOT EXISTS alerts(ts REAL, crew_id TEXT, risk TEXT, severity TEXT, data TEXT);
        CREATE TABLE IF NOT EXISTS voice(ts REAL, crew_id TEXT, data TEXT);
        CREATE TABLE IF NOT EXISTS chat(ts REAL, crew_id TEXT, role TEXT, text TEXT);
        CREATE INDEX IF NOT EXISTS iv ON vitals(crew_id, ts);
        """)
        self._last_persist = {}

    # ---- ingestión ----
    def add_packets(self, crew_id, packets, device_meta):
        with self.lock:
            dq = self.packets.setdefault(crew_id, collections.deque(maxlen=3600))
            last_ts = dq[-1]["ts"] if dq else 0
            new = sorted((p for p in packets if p.get("ts", 0) > last_ts), key=lambda p: p["ts"])
            dq.extend(new)
            if new:
                self.last_seen[crew_id] = time.time()
            self.device[crew_id] = device_meta
            return len(new)

    def window(self, crew_id, seconds):
        with self.lock:
            dq = self.packets.get(crew_id, ())
            if not dq:
                return []
            cutoff = dq[-1]["ts"] - seconds
            return [p for p in dq if p["ts"] >= cutoff]

    def latest(self, crew_id):
        with self.lock:
            dq = self.packets.get(crew_id)
            return dq[-1] if dq else None

    def add_series_point(self, crew_id, point):
        with self.lock:
            self.series[crew_id].append(point)
        if time.time() - self._last_persist.get(crew_id, 0) > 10:
            self._last_persist[crew_id] = time.time()
            self.db.execute("INSERT INTO vitals VALUES(?,?,?)", (point["ts"], crew_id, json.dumps(point)))
            self.db.commit()

    def add_alert(self, alert):
        with self.lock:
            self.alerts.appendleft(alert)
        self.db.execute("INSERT INTO alerts VALUES(?,?,?,?,?)",
                        (alert["ts"], alert["crew_id"], alert["risk"], alert["severity"], json.dumps(alert)))
        self.db.commit()

    def add_voice(self, rec):
        with self.lock:
            self.voice.appendleft(rec)
        self.db.execute("INSERT INTO voice VALUES(?,?,?)", (rec["ts"], rec["crew_id"], json.dumps(rec)))
        self.db.commit()

    def add_chat(self, crew_id, role, text, extra=None):
        msg = {"ts": time.time(), "crew_id": crew_id, "role": role, "text": text, **(extra or {})}
        with self.lock:
            self.chat.append(msg)
        self.db.execute("INSERT INTO chat VALUES(?,?,?,?)", (msg["ts"], crew_id, role, text))
        self.db.commit()
        return msg

    def event(self, kind, text, **kw):
        e = {"ts": time.time(), "kind": kind, "text": text, **kw}
        with self.lock:
            self.events.appendleft(e)
        return e

    def history(self, crew_id, since_s=3600):
        cur = self.db.execute("SELECT data FROM vitals WHERE crew_id=? AND ts>=? ORDER BY ts",
                              (crew_id, time.time() - since_s))
        return [json.loads(r[0]) for r in cur.fetchall()]
