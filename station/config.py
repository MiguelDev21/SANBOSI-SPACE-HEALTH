"""Configuración central de SANBOSI (estación). Todo se puede sobreescribir con variables de entorno."""
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
STATION_DIR = ROOT / "station"
DATA_DIR = Path(os.environ.get("SANBOSI_DATA", STATION_DIR / "data"))
CACHE_DIR = DATA_DIR / "cache"
WEB_DIR = ROOT / "web"
DTN_FRAMEWORK_BACKEND = ROOT / "dtn-framework" / "backend"
DATA_DIR.mkdir(parents=True, exist_ok=True)
CACHE_DIR.mkdir(parents=True, exist_ok=True)

HOST = os.environ.get("SANBOSI_HOST", "0.0.0.0")
PORT = int(os.environ.get("SANBOSI_PORT", "8700"))

# ---- Fuentes NASA / NOAA ----
# "auto" = intenta en vivo y cae a caché/simulación; "live" = solo vivo; "sim" = nunca sale a internet
NASA_MODE = os.environ.get("NASA_MODE", "auto")
LIGHTSTREAMER_URL = os.environ.get("LIGHTSTREAMER_URL", "https://push.lightstreamer.com")
LIGHTSTREAMER_ADAPTER = os.environ.get("LIGHTSTREAMER_ADAPTER", "ISSLIVE")
RADLAB_URLS = [
    "https://visualization.osdr.nasa.gov/radlab/api",
    "https://visualization.osdr.nasa.gov/api",
]
# Ventana real que se "reproduce" en bucle. Por defecto: tormenta geomagnética Gannon (10-11 mayo 2024)
RADLAB_REPLAY_START = os.environ.get("RADLAB_REPLAY_START", "2024-05-10T00:00")
RADLAB_REPLAY_END = os.environ.get("RADLAB_REPLAY_END", "2024-05-12T00:00")
RADLAB_INSTRUMENT = os.environ.get("RADLAB_INSTRUMENT", "DosTel")
GOES_PROTONS_URL = os.environ.get(
    "GOES_PROTONS_URL", "https://services.swpc.noaa.gov/json/goes/primary/integral-protons-1-day.json")
OSDR_META_URL = "https://osdr.nasa.gov/osdr/data/osd/meta/{num}"

# ---- DTN ----
# "embedded": usa el núcleo del framework iss-simulator dentro del proceso (no requiere nada más)
# "external": se conecta al backend completo del framework (python main.py en dtn-framework/backend, puerto 8000)
DTN_MODE = os.environ.get("DTN_MODE", "embedded")
DTN_EXTERNAL_URL = os.environ.get("DTN_EXTERNAL_URL", "http://localhost:8000")
DTN_TIME_SCALE = float(os.environ.get("DTN_TIME_SCALE", "20"))   # 1 s real = 20 s de órbita
MISSION_CONTROL_STATION = os.environ.get("MCC_STATION", "washington")  # nodo terrestre que actúa como Houston
SUMMARY_DOWNLINK_SECONDS = float(os.environ.get("SUMMARY_DOWNLINK_SECONDS", "30"))
# Retardo de luz adicional por destino (s, un sentido) para demostrar Luna/Marte
LIGHT_DELAY = {"ISS": 0.0, "LUNA": 1.3, "MARTE": 600.0}

# ---- IA ----
OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "llama3.2:3b")
WHISPER_MODEL = os.environ.get("WHISPER_MODEL", "base")   # si faster-whisper está instalado

# ---- Umbrales clínicos (punto de partida para la demo; validar contra NASA-STD-3001 / OCHMO) ----
T = {
    "hr_rest_high": 100, "hr_low": 45, "hr_eva_high": 160,
    "spo2_warn": 94, "spo2_crit": 90,
    "skin_temp_fever": 36.9, "skin_temp_delta_fever": 1.2,
    "sbp_high": 140, "sbp_low": 90,
    "resp_high": 22,
    "rmssd_drop_ratio": 0.6,        # RMSSD < 60% de la línea base personal
    "cabin_ppco2_warn_mmhg": 3.0,   # referencia operativa ISS (ver Suited CO2 bulletin / NASA-STD-3001 V2)
    "cabin_ppco2_crit_mmhg": 5.0,
    "suit_ppco2_warn_mmhg": 8.0,
    "metabolic_eva_high_w": 580,    # ~2000 BTU/h, máximo EMU (NTRS 20140009556)
    "goes_10mev_s1_pfu": 10,        # NOAA escala S1 de tormenta de radiación solar
    "dose_rate_high_ugy_h": 50, "dose_rate_warn_ugy_h": 300,
    "career_limit_msv": 600,        # límite de carrera NASA (dosis efectiva)
    "iss_msv_per_day": 0.35,        # dosis efectiva en la Estación: punto medio del rango NASA 0,2–0,5 mSv/día
    "watch_timeout_s": 20, "sleep_short_h": 6.0, "min_quality": 0.5,
}

# Tripulación y médico de vuelo del diseño SANBOSI (canvas del equipo)
PRODUCT = "SANBOSI"
VERSION = "1.5.0"   # la interfaz del reloj comprueba que la estación corra esta versión
MISSION_DAY = int(os.environ.get("MISSION_DAY", "42"))
FLIGHT_SURGEON = {"name": "Dra. Paula Vega", "role": "Médico de vuelo"}
CREW = [
    {"id": "CM-01", "name": "Ana Ríos", "role": "Comandante", "age": 44, "sex": "F",
     "baseline": {"hr": 64, "rmssd": 48, "spo2": 98, "skin_temp": 33.6, "resp": 13, "sbp": 114, "dbp": 72, "sleep_h": 7.1}},
    {"id": "CM-02", "name": "Marco Silva", "role": "Ingeniero de vuelo", "age": 38, "sex": "M",
     "baseline": {"hr": 62, "rmssd": 45, "spo2": 98, "skin_temp": 33.4, "resp": 14, "sbp": 120, "dbp": 78, "sleep_h": 7.1}},
    {"id": "CM-03", "name": "Lena Ortiz", "role": "Especialista de misión", "age": 36, "sex": "F",
     "baseline": {"hr": 68, "rmssd": 40, "spo2": 97, "skin_temp": 33.8, "resp": 14, "sbp": 110, "dbp": 70, "sleep_h": 7.5}},
    {"id": "CM-04", "name": "Kenji Mori", "role": "Especialista de misión", "age": 40, "sex": "M",
     "baseline": {"hr": 60, "rmssd": 58, "spo2": 98, "skin_temp": 33.3, "resp": 12, "sbp": 118, "dbp": 74, "sleep_h": 6.9}},
]
CREW_BY_ID = {c["id"]: c for c in CREW}
