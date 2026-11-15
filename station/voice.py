"""Análisis de voz a bordo: biomarcadores vocales de fatiga, estrés y estado de ánimo.

El reloj graba la voz del astronauta (PCM 16 kHz) y la estación extrae, sin nube:
  * Intensidad: nivel RMS en dBFS y estimación en dB SPL (calibrable), rango dinámico.
  * Tono (F0) por autocorrelación normalizada: media, desviación (monotonía) y rango.
  * Calidad vocal: jitter y shimmer (aproximación por tramas) y HNR (armónicos/ruido).
  * Ritmo: tasa de habla (núcleos silábicos/s), proporción y número de pausas.
  * Espectro: centroide y pendiente espectral (voz "apagada" vs "tensa").
Los índices se calculan como desviación respecto a la LÍNEA BASE PERSONAL de cada astronauta (las primeras
grabaciones o el botón "calibrar"), porque la voz varía mucho entre personas.

Literatura de referencia (biomarcadores vocales de fatiga/estrés): menor variación de F0, menor intensidad,
habla más lenta y más pausas se asocian a fatiga; mayor F0, intensidad y velocidad a activación/estrés.
Son indicadores de apoyo, no diagnósticos clínicos.
"""
import io
import math
import time

import numpy as np
from scipy.io import wavfile
from scipy.signal import resample_poly

POS = ["bien", "excelente", "feliz", "contento", "contenta", "tranquilo", "tranquila", "genial", "perfecto",
       "listo", "lista", "descansado", "descansada", "ánimo", "gracias", "motivado", "motivada", "increíble", "hermoso", "orgulloso"]
NEG = ["mal", "cansado", "cansada", "agotado", "agotada", "triste", "solo", "sola", "ansioso", "ansiosa", "estresado",
       "estresada", "dolor", "preocupado", "preocupada", "frustrado", "enojado", "miedo", "mareo", "náusea", "horrible",
       "peor", "no puedo", "duele", "fatal", "harto", "irritable", "deprimido"]

DEFAULT_BASE = {"F": {"f0": 205, "f0_sd": 32, "db": -26, "rate": 4.2, "pause_ratio": 0.18, "jitter": 0.035},
                "M": {"f0": 120, "f0_sd": 20, "db": -26, "rate": 4.2, "pause_ratio": 0.18, "jitter": 0.035}}


def load_wav(data: bytes, target_sr=16000):
    sr, x = wavfile.read(io.BytesIO(data))
    x = x.astype(np.float64)
    if x.ndim > 1:
        x = x.mean(axis=1)
    m = np.max(np.abs(x)) if x.size else 1
    if m > 1.5:
        x = x / (32768.0 if m <= 32768 else 2147483648.0)
    if sr != target_sr:
        g = math.gcd(int(sr), target_sr)
        x = resample_poly(x, target_sr // g, int(sr) // g)
        sr = target_sr
    return sr, x


def _f0_frame(fr, sr, fmin=70, fmax=400):
    fr = fr - fr.mean()
    if not np.any(fr):
        return None, 0.0
    w = fr * np.hanning(len(fr))
    ac = np.correlate(w, w, mode="full")[len(w) - 1:]
    if ac[0] <= 0:
        return None, 0.0
    ac = ac / ac[0]
    lo, hi = int(sr / fmax), min(int(sr / fmin), len(ac) - 1)
    if hi <= lo:
        return None, 0.0
    k = lo + int(np.argmax(ac[lo:hi]))
    r = float(ac[k])
    if r < 0.45:
        return None, r
    # interpolación parabólica para afinar el periodo
    if 1 <= k < len(ac) - 1:
        a, b, c = ac[k - 1], ac[k], ac[k + 1]
        den = a - 2 * b + c
        k = k + (0.5 * (a - c) / den if den != 0 else 0)
    return sr / k, r


def analyze(data: bytes, spl_offset=90.0):
    sr, x = load_wav(data)
    dur = len(x) / sr
    if dur < 0.6:
        raise ValueError("Grabación demasiado corta (mín. 0.6 s)")
    flen, hop = int(0.03 * sr), int(0.01 * sr)
    n = max(1, 1 + (len(x) - flen) // hop)
    frames = np.lib.stride_tricks.sliding_window_view(x, flen)[::hop][:n]
    rms = np.sqrt(np.mean(frames ** 2, axis=1) + 1e-12)
    db = 20 * np.log10(rms + 1e-12)
    floor = float(np.percentile(db, 10))
    speech = (db > max(floor + 10, -55))

    f0s, rs, amps = [], [], []
    for i in np.where(speech)[0]:
        f0, r = _f0_frame(frames[i], sr)
        if f0:
            f0s.append(f0); rs.append(r); amps.append(float(np.max(np.abs(frames[i]))))
    f0s = np.array(f0s)
    # pausas entre segmentos de habla
    idx = np.where(speech)[0]
    pauses, pause_time = 0, 0.0
    if idx.size:
        seg = speech[idx[0]: idx[-1] + 1]
        run = 0
        for s in seg:
            if not s:
                run += 1
            else:
                if run * 0.01 >= 0.25:
                    pauses += 1; pause_time += run * 0.01
                run = 0
        active = (idx[-1] - idx[0] + 1) * 0.01
    else:
        active = 0.0
    speech_time = float(speech.sum()) * 0.01
    # núcleos silábicos: picos de la envolvente de energía suavizada
    env = np.convolve(db, np.ones(5) / 5, mode="same")
    peaks, last = 0, -100
    thr = floor + 14
    for i in range(1, len(env) - 1):
        if env[i] > thr and env[i] >= env[i - 1] and env[i] > env[i + 1] and i - last >= 12:
            peaks += 1; last = i
    # espectro
    spec = np.abs(np.fft.rfft(x * np.hanning(len(x))))
    freqs = np.fft.rfftfreq(len(x), 1 / sr)
    centroid = float((spec * freqs).sum() / (spec.sum() + 1e-12))
    low = spec[(freqs > 80) & (freqs < 1000)].sum() + 1e-12
    high = spec[(freqs >= 1000) & (freqs < 4000)].sum() + 1e-12
    tilt = float(20 * np.log10(high / low))

    feats = {
        "duration_s": round(dur, 2), "speech_time_s": round(speech_time, 2),
        "db_mean": round(float(db[speech].mean()) if speech.any() else float(db.mean()), 1),
        "db_max": round(float(db.max()), 1), "db_dynamic_range": round(float(np.percentile(db, 95) - np.percentile(db, 15)), 1),
        "spl_est_db": None, "noise_floor_db": round(floor, 1),
        "f0_mean": round(float(f0s.mean()), 1) if f0s.size else None,
        "f0_sd": round(float(f0s.std()), 1) if f0s.size else None,
        "f0_range": round(float(np.percentile(f0s, 95) - np.percentile(f0s, 5)), 1) if f0s.size > 4 else None,
        "jitter": round(float(np.mean(np.abs(np.diff(1 / f0s))) / np.mean(1 / f0s)), 4) if f0s.size > 3 else None,
        "shimmer": round(float(np.mean(np.abs(np.diff(amps))) / (np.mean(amps) + 1e-9)), 4) if len(amps) > 3 else None,
        "hnr_db": round(float(np.mean([10 * math.log10(r / (1 - r)) for r in rs if r < 0.999])), 1) if rs else None,
        "voiced_ratio": round(len(f0s) / max(1, int(speech.sum())), 2),
        "speech_rate_syl_s": round(peaks / speech_time, 2) if speech_time > 0.3 else None,
        "pauses": pauses, "pause_ratio": round(float(pause_time / active), 3) if active > 0 else None,
        "spectral_centroid_hz": round(centroid), "spectral_tilt_db": round(tilt, 1),
    }
    feats["spl_est_db"] = round(feats["db_mean"] + spl_offset, 1)
    return feats


def sentiment(text):
    t = " " + (text or "").lower() + " "
    s = 0
    for w in POS:
        if f" {w} " in t or f" {w}," in t or f" {w}." in t:
            s += -1 if f" no {w}" in t or f" no estoy {w}" in t else 1
    for w in NEG:
        if w in t:
            s -= 1
    return max(-1.0, min(1.0, s / 3.0))


class VoiceBaselines:
    """Línea base vocal personal: promedio de las primeras grabaciones (o recalibración manual)."""

    def __init__(self, crew):
        self.base = {c["id"]: dict(DEFAULT_BASE[c.get("sex", "M")], n=0) for c in crew}

    def calibrate(self, crew_id, feats, force=False):
        b = self.base[crew_id]
        if force:
            b["n"] = 0
        if b["n"] >= 3:
            return False
        k = 1.0 / (b["n"] + 1) if b["n"] else 1.0
        for key, fk in (("f0", "f0_mean"), ("f0_sd", "f0_sd"), ("db", "db_mean"), ("rate", "speech_rate_syl_s"),
                        ("pause_ratio", "pause_ratio"), ("jitter", "jitter")):
            v = feats.get(fk)
            if v is not None:
                b[key] = b[key] * (1 - k) + v * k
        b["n"] += 1
        return True

    def indices(self, crew_id, feats, text=""):
        b = self.base[crew_id]
        def rel(v, base, scale=None):
            if v is None or base in (None, 0):
                return 0.0
            return (v - base) / (scale if scale else abs(base))
        d_f0 = rel(feats.get("f0_mean"), b["f0"])
        d_sd = rel(feats.get("f0_sd"), b["f0_sd"])
        d_db = rel(feats.get("db_mean"), b["db"], 6.0)
        d_rate = rel(feats.get("speech_rate_syl_s"), b["rate"])
        d_pause = (feats.get("pause_ratio") or b["pause_ratio"]) - b["pause_ratio"]
        d_jit = rel(feats.get("jitter"), b["jitter"])
        sent = sentiment(text)
        fat = -1.4 * d_sd - 0.7 * d_db - 1.2 * d_rate + 2.5 * d_pause + 0.3 * d_jit - 0.6 * d_f0
        stress = 2.2 * d_f0 + 0.7 * d_db + 1.0 * d_rate + 0.4 * d_jit - 0.8 * d_pause - 0.4 * sent
        mood = 0.6 * d_sd + 0.1 * d_db + 1.4 * sent - 0.35 * fat - 0.35 * max(0.0, stress)
        to100 = lambda r: int(round(50 + 50 * math.tanh(r)))
        ix = {"fatigue": to100(fat), "stress": to100(stress), "mood": to100(mood),
              "energy": to100(0.8 * d_db + 0.6 * d_rate + 0.6 * d_sd), "sentiment": round(sent, 2)}
        expl = []
        if d_sd < -0.25: expl.append("voz más monótona que su base (menor variación de tono)")
        if d_db < -0.5: expl.append(f"habla {abs(d_db*6):.0f} dB más bajo que su base")
        if d_db > 0.5: expl.append(f"habla {d_db*6:.0f} dB más fuerte que su base")
        if d_rate < -0.2: expl.append("habla más lenta")
        if d_rate > 0.2: expl.append("habla más rápida")
        if d_pause > 0.1: expl.append("más pausas de lo habitual")
        if d_f0 > 0.12: expl.append("tono más agudo (activación/estrés)")
        if d_f0 < -0.1: expl.append("tono más grave de lo habitual")
        if sent < -0.3: expl.append("lenguaje con carga negativa")
        if sent > 0.3: expl.append("lenguaje positivo")
        pct = lambda v, base: None if v is None or not base else round(100 * (v - base) / base)
        ix["vs_habitual"] = {"tono_pct": pct(feats.get("f0_mean"), b["f0"]),
                             "intensidad_db": round(feats["db_mean"] - b["db"], 1) if feats.get("db_mean") is not None else None,
                             "pausas_pct": (pct(feats.get("pause_ratio"), b["pause_ratio"]) if b["pause_ratio"] > 0.03
                                            else None if feats.get("pause_ratio") is None else round(100 * (feats["pause_ratio"] - b["pause_ratio"]))),
                             "velocidad_pct": pct(feats.get("speech_rate_syl_s"), b["rate"])}
        ix["explanations"] = expl or ["voz dentro de su rango habitual"]
        ix["baseline_samples"] = b["n"]
        return ix


_whisper = {"model": None, "tried": False}


def transcribe(wav_bytes, model_name="base"):
    """Transcripción local con faster-whisper si está instalado (opcional, 100% a bordo)."""
    if not _whisper["tried"]:
        _whisper["tried"] = True
        try:
            from faster_whisper import WhisperModel
            _whisper["model"] = WhisperModel(model_name, device="cpu", compute_type="int8")
        except Exception:
            _whisper["model"] = None
    m = _whisper["model"]
    if not m:
        return None
    import tempfile
    with tempfile.NamedTemporaryFile(suffix=".wav") as f:
        f.write(wav_bytes); f.flush()
        segs, _ = m.transcribe(f.name, language="es")
        return " ".join(s.text.strip() for s in segs).strip()
