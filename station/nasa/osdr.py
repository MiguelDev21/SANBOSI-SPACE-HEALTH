"""Biblioteca de evidencia: estudios de humanos en el NASA Open Science Data Repository (Inspiration4).

Se consulta la API de metadatos de OSDR para mostrar título/descripción reales de cada estudio y se usan como
contexto de referencia para la IA (no son datos en vivo del astronauta). Datos procesados públicos; los crudos
individuales requieren solicitud con aprobación ética.
"""
import json
import threading

import requests

from .. import config

I4_STUDIES = {
    "OSD-569": "Inspiration4 – Sangre total", "OSD-570": "Inspiration4 – PBMC",
    "OSD-571": "Inspiration4 – Plasma", "OSD-575": "Inspiration4 – Suero (paneles metabólicos, CBC)",
    "OSD-572": "Inspiration4 – Hisopos piel/oral/nasal", "OSD-573": "Inspiration4 – Ambiente cápsula Dragon",
    "OSD-574": "Inspiration4 – Biopsias de piel", "OSD-630": "Inspiration4 – Heces",
    "OSD-656": "Inspiration4 – Orina", "OSD-687": "Inspiration4 – Células T",
}
CACHE = config.CACHE_DIR / "osdr_studies.json"


class OSDR:
    def __init__(self):
        self.studies = [{"id": k, "title": v, "url": f"https://osdr.nasa.gov/bio/repo/data/studies/{k}", "source": "STATIC"}
                        for k, v in I4_STUDIES.items()]
        self.error = None

    def start(self):
        if CACHE.exists():
            try:
                self.studies = json.loads(CACHE.read_text())
            except Exception:
                pass
        if config.NASA_MODE != "sim":
            threading.Thread(target=self._fetch, daemon=True).start()

    def _fetch(self):
        out, ok = [], 0
        for k, v in I4_STUDIES.items():
            item = {"id": k, "title": v, "url": f"https://osdr.nasa.gov/bio/repo/data/studies/{k}", "source": "STATIC"}
            try:
                r = requests.get(config.OSDR_META_URL.format(num=k.split("-")[1]), timeout=20)
                r.raise_for_status()
                j = r.json()
                study = (j.get("study") or {})
                body = next(iter(study.values()), {}) if isinstance(study, dict) else {}
                s0 = (body.get("studies") or [{}])[0]
                item["title"] = s0.get("title") or item["title"]
                item["description"] = (s0.get("description") or "")[:600]
                item["source"] = "LIVE"
                ok += 1
            except Exception as e:
                self.error = f"OSDR: {e}"
            out.append(item)
        self.studies = out
        if ok:
            CACHE.write_text(json.dumps(out))

    def snapshot(self):
        return {"studies": self.studies, "error": self.error}
