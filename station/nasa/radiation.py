"""Radiación: datos REALES de dosímetros de la ISS (NASA OSDR RadLab API) + protones solares en tiempo real (NOAA GOES).

* RadLab (https://visualization.osdr.nasa.gov/radlab/gui/data-api): tasas de dosis absorbida (µGy/h) y
  equivalente (µSv/h) de DosTel, TEPC, Timepix, Liulin, ALTEA... Se descarga una ventana histórica real y se
  "reproduce" en bucle con la hora actual (por defecto la tormenta Gannon del 10-11 de mayo de 2024).
* NOAA SWPC GOES integral protons (1 día): flujo ≥10 MeV en pfu; ≥10 pfu = tormenta de radiación S1.
"""
import csv
import io
import json
import math
import random
import threading
import time
from datetime import datetime, timezone

import requests

from .. import config

RAD_CACHE = config.CACHE_DIR / "radlab_replay.json"
GOES_CACHE = config.CACHE_DIR / "goes_protons.json"


def _parse_ts(s):
    s = s.strip().replace("Z", "")
    for fmt in ("%Y-%m-%dT%H:%M:%S.%f", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M"):
        try:
            return datetime.strptime(s[:26], fmt).replace(tzinfo=timezone.utc).timestamp()
        except ValueError:
            continue
    try:
        return float(s)
    except ValueError:
        return None


def noaa_scale(pfu):
    for lvl, thr in (("S5", 1e5), ("S4", 1e4), ("S3", 1e3), ("S2", 1e2), ("S1", 10)):
        if pfu >= thr:
            return lvl
    return "S0"


class Radiation:
    def __init__(self):
        self.rad_series = []      # [(t_rel_s, absorbed_ugy_h, equiv_usv_h)]
        self.rad_source = "SIM"
        self.rad_error = None
        self.rad_meta = {}
        self.goes = {"pfu": 0.3, "time_tag": None}
        self.goes_source = "SIM"
        self.goes_error = None
        self.goes_history = []
        self.injection = None
        self.t0 = time.time()
        self.cumulative = {}      # crew_id -> mGy acumulados en la sesión (dosis absorbida)
        self.cumulative_msv = {}  # crew_id -> mSv acumulados en la sesión (dosis equivalente del dosímetro)
        self._last_acc = time.time()

    def start(self):
        for path, attr in ((RAD_CACHE, "rad"), (GOES_CACHE, "goes")):
            if path.exists():
                try:
                    c = json.loads(path.read_text())
                    if attr == "rad":
                        self.rad_series, self.rad_meta, self.rad_source = c["series"], c["meta"], "CACHE"
                    else:
                        self.goes, self.goes_history, self.goes_source = c["goes"], c.get("history", []), "CACHE"
                except Exception:
                    pass
        if config.NASA_MODE != "sim":
            threading.Thread(target=self._fetch_radlab, daemon=True).start()
            threading.Thread(target=self._goes_loop, daemon=True).start()

    # ---------------- RadLab ----------------
    def _fetch_radlab(self):
        params = (f"?spacecraft=ISS&instrument={config.RADLAB_INSTRUMENT}"
                  f"&timestamp>={config.RADLAB_REPLAY_START}&timestamp<{config.RADLAB_REPLAY_END}"
                  f"&absorbed_dose_rate&dose_equivalent_rate&format=csv")
        for base in config.RADLAB_URLS:
            url = base + params
            try:
                r = requests.get(url, timeout=60)
                r.raise_for_status()
                rows = list(csv.DictReader(io.StringIO(r.text)))
                if not rows:
                    raise ValueError("respuesta vacía")
                keys = rows[0].keys()
                kt = next(k for k in keys if "timestamp" in k.lower())
                ka = next(k for k in keys if "absorbed" in k.lower())
                ke = next((k for k in keys if "equivalent" in k.lower()), None)
                pts = []
                for row in rows:
                    t = _parse_ts(row[kt])
                    try:
                        a = float(row[ka])
                    except (TypeError, ValueError):
                        continue
                    e = None
                    if ke:
                        try:
                            e = float(row[ke])
                        except (TypeError, ValueError):
                            e = None
                    if t is not None:
                        pts.append((t, a, e))
                pts.sort()
                if len(pts) < 10:
                    raise ValueError(f"solo {len(pts)} puntos")
                t_first = pts[0][0]
                self.rad_series = [(t - t_first, a, e) for t, a, e in pts]
                self.rad_meta = {"instrument": config.RADLAB_INSTRUMENT, "window": [config.RADLAB_REPLAY_START, config.RADLAB_REPLAY_END],
                                 "points": len(pts), "url": url}
                self.rad_source, self.rad_error = "LIVE", None
                RAD_CACHE.write_text(json.dumps({"series": self.rad_series, "meta": self.rad_meta}))
                return
            except Exception as e:
                self.rad_error = f"RadLab: {e}"

    def _rad_now(self):
        """Valor reproducido de la serie real (o modelo con picos de la Anomalía del Atlántico Sur)."""
        if self.rad_series:
            span = self.rad_series[-1][0] or 1
            # 1 s real = 60 s de la serie histórica para que en la demo se vean pasos por la SAA
            tr = ((time.time() - self.t0) * 60) % span
            lo, hi = 0, len(self.rad_series) - 1
            while lo < hi:
                mid = (lo + hi) // 2
                if self.rad_series[mid][0] < tr:
                    lo = mid + 1
                else:
                    hi = mid
            _, a, e = self.rad_series[lo]
            return a, e, self.rad_source
        ph = ((time.time() - self.t0) * 20) % 5520 / 5520
        saa = 120 * math.exp(-((ph - 0.3) ** 2) / 0.002)       # paso por la SAA una vez por órbita
        a = 12 + 6 * math.sin(ph * 2 * math.pi * 2) ** 2 + saa + random.gauss(0, 0.8)
        return max(1.0, a), max(1.0, a) * 2.1, "SIM"

    # ---------------- GOES ----------------
    def _goes_loop(self):
        while True:
            try:
                r = requests.get(config.GOES_PROTONS_URL, timeout=20)
                r.raise_for_status()
                data = [d for d in r.json() if str(d.get("energy", "")).startswith(">=10")]
                if data:
                    self.goes = {"pfu": float(data[-1]["flux"]), "time_tag": data[-1]["time_tag"],
                                 "satellite": data[-1].get("satellite")}
                    self.goes_history = [(d["time_tag"], float(d["flux"])) for d in data[-288:]]
                    self.goes_source, self.goes_error = "LIVE", None
                    GOES_CACHE.write_text(json.dumps({"goes": self.goes, "history": self.goes_history}))
            except Exception as e:
                self.goes_error = f"GOES: {e}"
            time.sleep(300)

    # ---------------- estado ----------------
    def snapshot(self, crew_activity=None):
        a, e, src = self._rad_now()
        pfu, gsrc = self.goes.get("pfu", 0.3), self.goes_source
        if self.injection == "solar_storm":
            pfu, gsrc = max(pfu, 850.0), gsrc + "+INYECCIÓN"
            a, e = a * 8, (e * 8 if e else None)        # sin factor inventado: si no hay equivalente medido, no se inventa
        # dosis acumulada por astronauta (EVA ~ x2.5 por menor blindaje)
        now = time.time()
        dt_h = (now - self._last_acc) / 3600.0
        self._last_acc = now
        for cid, act in (crew_activity or {}).items():
            f = 2.5 if act == "eva" else 1.0
            self.cumulative[cid] = self.cumulative.get(cid, 0.0) + a * f * dt_h * config.DTN_TIME_SCALE / 1000.0
            # mSv: dosis equivalente que mide el dosímetro (µSv/h). Si la serie no la trae (p. ej. DosTel en RadLab),
            # se suma la absorbida con factor de calidad 1: es un mínimo, no se infla con un factor supuesto.
            self.cumulative_msv[cid] = self.cumulative_msv.get(cid, 0.0) + (e if e else a) * f * dt_h * config.DTN_TIME_SCALE / 1000.0
        return {"dose_rate_ugy_h": round(a, 2), "dose_equiv_usv_h": round(e, 2) if e else None, "source": src,
                "radlab_meta": self.rad_meta, "radlab_error": self.rad_error,
                "goes_10mev_pfu": round(pfu, 2), "noaa_scale": noaa_scale(pfu), "goes_source": gsrc,
                "goes_time": self.goes.get("time_tag"), "goes_error": self.goes_error,
                "cumulative_mgy": {k: round(v, 4) for k, v in self.cumulative.items()},
                "cumulative_msv": {k: round(v, 4) for k, v in self.cumulative_msv.items()},
                "equiv_measured": bool(e), "iss_msv_per_day": config.T["iss_msv_per_day"],
                "career_limit_msv": config.T["career_limit_msv"]}
