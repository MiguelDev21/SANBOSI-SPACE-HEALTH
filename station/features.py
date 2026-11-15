"""Extracción de indicadores a partir de las muestras crudas del reloj (ventanas deslizantes)."""
import math
import statistics as st


def hrv(rr_ms):
    """Métricas estándar de variabilidad de la frecuencia cardíaca (Task Force ESC/NASPE 1996)."""
    rr = [x for x in rr_ms if 250 <= x <= 2000]
    if len(rr) < 8:
        return {}
    diffs = [b - a for a, b in zip(rr, rr[1:])]
    rmssd = math.sqrt(sum(d * d for d in diffs) / len(diffs))
    sdnn = st.pstdev(rr)
    pnn50 = 100.0 * sum(1 for d in diffs if abs(d) > 50) / len(diffs)
    mean_rr = st.mean(rr)
    # índice de irregularidad latido a latido: proporción de intervalos que cambian >15% respecto al anterior.
    # No se ve afectado por cambios lentos de FC (ejercicio, ortostatismo), sí por extrasístoles o fibrilación.
    irregular = sum(1 for a, b in zip(rr, rr[1:]) if abs(b - a) / a > 0.15) / len(diffs)
    return {"rmssd": round(rmssd, 1), "sdnn": round(sdnn, 1), "pnn50": round(pnn50, 1),
            "mean_rr": round(mean_rr), "irregularity": round(irregular, 3), "beats": len(rr)}


def summarize(window):
    """Agrega una ventana de paquetes (1 Hz) en un punto de serie."""
    if not window:
        return None
    last = window[-1]
    def avg(k):
        vals = [p[k] for p in window if k in p and p[k] is not None]
        return round(st.mean(vals), 2) if vals else None
    rr = [x for p in window for x in p.get("rr_ms", [])]
    out = {
        "ts": last["ts"], "activity": last.get("activity"), "scenario": last.get("scenario"),
        "hr": avg("hr"), "spo2": avg("spo2"), "spo2_min": min((p["spo2"] for p in window), default=None),
        "skin_temp": avg("skin_temp"), "resp_rate": avg("resp_rate"), "sbp": avg("sbp"), "dbp": avg("dbp"),
        "accel_g": avg("accel_g"), "battery": last.get("battery"), "hydration": last.get("hydration"),
        "steps": last.get("steps"), "sleep_h": last.get("sleep_h"), "quality": avg("quality"),
    }
    out.update(hrv(rr))
    if "suit" in last:
        out["suit"] = last["suit"]
    if any("symptom" in p for p in window):
        out["symptom"] = next(p["symptom"] for p in reversed(window) if "symptom" in p)
    return out


class Baseline:
    """Línea base personal adaptativa (EWMA de media y varianza) por astronauta y métrica.

    El sistema aprende el "normal" de cada persona en vez de usar solo umbrales poblacionales; es la base de
    la detección de anomalías estadísticas (z-score)."""
    METRICS = ["hr", "spo2", "skin_temp", "resp_rate", "sbp", "rmssd"]

    def __init__(self, seed: dict, alpha=0.01):
        self.alpha = alpha
        self.mean = {"hr": seed["hr"] * 1.1, "spo2": seed["spo2"], "skin_temp": seed["skin_temp"],
                     "resp_rate": seed["resp"], "sbp": seed["sbp"], "rmssd": seed["rmssd"]}
        self.var = {"hr": 64, "spo2": 1.0, "skin_temp": 0.16, "resp_rate": 4, "sbp": 64, "rmssd": 100}
        self.n = 0

    def z(self, point):
        out = {}
        for m in self.METRICS:
            v = point.get(m)
            if v is None:
                continue
            out[m] = round((v - self.mean[m]) / math.sqrt(max(self.var[m], 1e-6)), 2)
        return out

    def update(self, point, frozen=False):
        """Solo aprende de puntos nominales para no "normalizar" una enfermedad."""
        if frozen:
            return
        self.n += 1
        a = self.alpha if self.n > 30 else 0.1
        for m in self.METRICS:
            v = point.get(m)
            if v is None:
                continue
            d = v - self.mean[m]
            self.mean[m] += a * d
            self.var[m] = (1 - a) * (self.var[m] + a * d * d)
