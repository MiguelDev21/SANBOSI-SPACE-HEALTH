"""Telemetría ambiental REAL de la ISS vía ISS Live! (Lightstreamer de NASA JSC, push.lightstreamer.com / ISSLIVE).

Parámetros públicos usados (ver https://iss-mimic.github.io/Mimic/ para la lista completa):
  USLAB000058 presión de cabina [torr]      USLAB000059 temperatura de cabina [°C]
  USLAB000053 ppO2 Lab [torr]               USLAB000054 ppN2 Lab [torr]       USLAB000055 ppCO2 Lab [torr]
  NODE3000001 ppO2 Node3 [torr]             NODE3000003 ppCO2 Node3 [torr]
  AIRLOCK000049 presión crewlock [torr]     AIRLOCK000054 presión airlock [torr]
  NODE3000011 producción de O2 [lb/día]     NODE3000005 tanque de orina [%]
1 torr = 1 mmHg. Si la librería o la red no están disponibles, cae a caché y luego a simulación
(marcado claramente como SIM en el panel).
"""
import json
import math
import random
import threading
import time

from .. import config

ITEMS = {
    "USLAB000058": "cabin_pressure_torr", "USLAB000059": "cabin_temp_c",
    "USLAB000053": "ppo2_torr", "USLAB000054": "ppn2_torr", "USLAB000055": "ppco2_lab_torr",
    "NODE3000001": "ppo2_node3_torr", "NODE3000003": "ppco2_node3_torr",
    "AIRLOCK000049": "crewlock_pressure_torr", "AIRLOCK000054": "airlock_pressure_torr",
    "NODE3000011": "o2_production_lb_day", "NODE3000005": "urine_tank_pct",
}
CACHE = config.CACHE_DIR / "iss_live.json"


class ISSLive:
    def __init__(self):
        self.values = {}
        self.source = "SIM"
        self.updated = 0.0
        self.error = None
        self.injection = None          # escenario de prueba (p.ej. falla de CDRA)
        self._lock = threading.Lock()
        self._client = None

    # ------------------------------------------------------------------
    def start(self):
        if CACHE.exists():
            try:
                c = json.loads(CACHE.read_text())
                self.values, self.updated, self.source = c["values"], c["updated"], "CACHE"
            except Exception:
                pass
        if config.NASA_MODE != "sim":
            threading.Thread(target=self._connect, daemon=True).start()
        threading.Thread(target=self._sim_loop, daemon=True).start()

    def _connect(self):
        try:
            from lightstreamer.client import LightstreamerClient, Subscription, SubscriptionListener
        except Exception as e:  # librería no instalada
            self.error = f"lightstreamer-client-lib no instalada ({e.__class__.__name__}); usando caché/simulación"
            return
        outer = self

        class Listener(SubscriptionListener):
            def onItemUpdate(self, update):
                try:
                    name = update.getItemName()
                    val = update.getValue("Value")
                    if name in ITEMS and val not in (None, ""):
                        with outer._lock:
                            outer.values[ITEMS[name]] = float(val)
                            outer.source = "LIVE"
                            outer.updated = time.time()
                            outer.error = None
                except Exception as ex:
                    outer.error = str(ex)

        try:
            client = LightstreamerClient(config.LIGHTSTREAMER_URL, config.LIGHTSTREAMER_ADAPTER)
            client.connect()
            sub = Subscription("MERGE", list(ITEMS.keys()), ["Value", "TimeStamp"])
            sub.setRequestedSnapshot("yes")
            sub.addListener(Listener())
            client.subscribe(sub)
            self._client = client
        except Exception as e:
            self.error = f"Lightstreamer: {e}"

    def _sim_loop(self):
        """Valores nominales de la ISS si no hay datos reales recientes; persiste caché si son reales."""
        last_cache = 0
        while True:
            now = time.time()
            with self._lock:
                stale = now - self.updated > 120
                if self.source == "LIVE" and now - last_cache > 60:
                    CACHE.write_text(json.dumps({"values": self.values, "updated": self.updated}))
                    last_cache = now
                if stale and self.source != "CACHE":
                    ph = now / 600.0
                    self.values = {
                        "cabin_pressure_torr": 759 + 2 * math.sin(ph) + random.gauss(0, 0.2),
                        "cabin_temp_c": 22.5 + 0.6 * math.sin(ph / 2) + random.gauss(0, 0.05),
                        "ppo2_torr": 163 + 3 * math.sin(ph / 3) + random.gauss(0, 0.3),
                        "ppn2_torr": 590 + random.gauss(0, 0.5),
                        "ppco2_lab_torr": 2.4 + 0.3 * math.sin(ph) + random.gauss(0, 0.03),
                        "ppo2_node3_torr": 162 + random.gauss(0, 0.3),
                        "ppco2_node3_torr": 2.5 + 0.3 * math.sin(ph + 1) + random.gauss(0, 0.03),
                        "crewlock_pressure_torr": 758.0, "airlock_pressure_torr": 758.0,
                        "o2_production_lb_day": 5.4, "urine_tank_pct": 40 + 10 * math.sin(ph / 5),
                    }
                    self.source = "SIM"
            time.sleep(2)

    # ------------------------------------------------------------------
    def snapshot(self):
        with self._lock:
            v = dict(self.values)
            src = self.source
        ppco2 = max(v.get("ppco2_lab_torr", 0) or 0, v.get("ppco2_node3_torr", 0) or 0) or None
        out = {"values": v, "ppco2_mmhg": ppco2, "ppo2_mmhg": v.get("ppo2_torr"),
               "pressure_mmhg": v.get("cabin_pressure_torr"), "temp_c": v.get("cabin_temp_c"),
               "source": src, "updated": self.updated, "error": self.error}
        if self.injection == "cabin_co2":
            out["ppco2_mmhg"] = round((ppco2 or 2.5) + 4.2, 2)
            out["source"] = src + "+INYECCIÓN"
        if out["values"].get("airlock_pressure_torr") is not None and out["values"]["airlock_pressure_torr"] < 300:
            out["eva_in_progress"] = True   # esclusa despresurizada en la ISS real
        return out
