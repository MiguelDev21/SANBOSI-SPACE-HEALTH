"""Modelo fisiológico del reloj SANBOSI.

Genera señales plausibles para un astronauta en microgravedad: frecuencia cardíaca con intervalos RR
(para HRV), SpO2, temperatura de piel, frecuencia respiratoria, presión arterial estimada (sin manguito),
acelerómetro y, durante EVA, telemetría del traje. Los escenarios reproducen los riesgos del Human System
Risk Board de NASA para probar el motor de diagnóstico de la estación.

Referencias de magnitudes: OCHMO technical briefs (orthostatic intolerance, DCS, suited CO2), NTRS 20140009556
(tasa metabólica EMU ~290 W promedio, 580 W máx.).
"""
import math
import random
import time

ACTIVITIES = {
    #            factor HR, resp extra, accel g, temp delta, sbp delta
    "sleep":    (0.88, -2, 0.01, -0.3, -10),
    "rest":     (1.00, 0, 0.03, 0.0, 0),
    "work":     (1.15, 2, 0.10, 0.1, 5),
    "exercise": (1.95, 12, 0.60, 0.6, 30),
    "eva":      (1.75, 8, 0.25, -0.4, 18),
}

SCENARIOS = {
    "nominal":      "Sin anomalías",
    "eva":          "Caminata espacial (EVA) con alta demanda metabólica",
    "eva_co2":      "EVA con falla de absorción de CO2 en el traje",
    "dcs":          "EVA + síntomas de descompresión (baja presión de traje)",
    "cabin_co2":    "CO2 elevado en cabina (falla de CDRA)",
    "hypoxia":      "Desaturación de oxígeno progresiva",
    "arrhythmia":   "Arritmia (latidos irregulares / fibrilación)",
    "fever":        "Infección con fiebre (riesgo inmune)",
    "fatigue":      "Privación de sueño y sobrecarga (HRV baja)",
    "orthostatic":  "Intolerancia ortostática (reingreso a gravedad)",
    "dehydration":  "Deshidratación (riesgo de cálculo renal)",
    "solar_storm":  "Evento de partículas solares (radiación)",
    "stress":       "Estrés agudo / ansiedad",
    "unresponsive": "Astronauta sin movimiento (emergencia)",
    "sensor_loose": "Reloj flojo en la muñeca (señal de baja calidad)",
}


class Astronaut:
    def __init__(self, crew: dict, seed: int = 0):
        self.id = crew["id"]
        self.name = crew["name"]
        self.b = dict(crew["baseline"])
        self.rng = random.Random(hash(self.id) + seed)
        self.activity = "work"
        self.activity_until = time.time() + self.rng.uniform(40, 120)
        self.scenario = "nominal"
        self.scenario_started = time.time()
        # estado dinámico
        self.hr = self.b["hr"] * 1.1
        self.spo2 = self.b["spo2"]
        self.skin_temp = self.b["skin_temp"]
        self.resp = self.b["resp"]
        self.sbp = self.b["sbp"]
        self.dbp = self.b["dbp"]
        self.suit = {"pressure_psi": 4.3, "ppco2_mmhg": 1.5, "o2_pct": 100.0, "temp_c": 20.0}
        self.steps = 0
        self.battery = 100.0 - self.rng.uniform(0, 15)
        self.hydration = 1.0
        self.last_rr = 60.0 / self.hr
        self.sleep_h = self.b.get("sleep_h", 7.0) + self.rng.uniform(-0.4, 0.3)

    # ------------------------------------------------------------------
    def drink(self, glasses: int):
        """Un vaso registrado en el reloj sube el índice de hidratación (~6 % por vaso)."""
        self.hydration = min(1.0, self.hydration + 0.06 * glasses)

    def set_scenario(self, name: str):
        if name not in SCENARIOS:
            name = "nominal"
        if name != self.scenario:
            self.scenario = name
            self.scenario_started = time.time()
            if name in ("eva", "eva_co2", "dcs"):
                self.activity = "eva"
                self.suit = {"pressure_psi": 4.3, "ppco2_mmhg": 1.5, "o2_pct": 100.0, "temp_c": 20.0}
            elif name == "unresponsive":
                self.activity = "rest"
            elif self.activity == "eva":
                self.activity = "rest"

    def _choose_activity(self, now):
        if self.scenario in ("eva", "eva_co2", "dcs"):
            self.activity = "eva"
            return
        if self.scenario in ("unresponsive", "orthostatic", "hypoxia", "arrhythmia", "fever", "stress"):
            # escenarios clínicos: el astronauta está en reposo/actividad ligera para que la señal sea interpretable
            if self.activity not in ("rest", "work") or self.scenario in ("unresponsive", "orthostatic"):
                self.activity = "rest"
            return
        if now >= self.activity_until:
            r = self.rng.random()
            self.activity = "exercise" if r < 0.15 else "rest" if r < 0.45 else "work"
            if self.scenario == "fatigue" and self.rng.random() < 0.3:
                self.activity = "sleep"
            self.activity_until = now + self.rng.uniform(45, 150)

    @staticmethod
    def _lag(cur, target, k):
        return cur + (target - cur) * k

    # ------------------------------------------------------------------
    def step(self, dt: float = 1.0) -> dict:
        now = time.time()
        self._choose_activity(now)
        sc = self.scenario
        el = now - self.scenario_started          # segundos dentro del escenario
        ramp = min(1.0, el / 60.0)                 # rampa de 1 minuto
        f_hr, resp_x, accel_g, temp_d, sbp_d = ACTIVITIES[self.activity]
        n = self.rng.gauss

        hr_t = self.b["hr"] * f_hr
        spo2_t = self.b["spo2"]
        temp_t = self.b["skin_temp"] + temp_d
        resp_t = self.b["resp"] + resp_x
        sbp_t = self.b["sbp"] + sbp_d
        dbp_t = self.b["dbp"] + sbp_d * 0.4
        rmssd = self.b["rmssd"] * (0.45 if self.activity in ("exercise", "eva") else 1.15 if self.activity == "sleep" else 1.0)
        irregular = 0.0

        if sc == "cabin_co2":
            resp_t += 5 * ramp; hr_t += 8 * ramp; spo2_t -= 1 * ramp
        elif sc == "hypoxia":
            spo2_t -= 11 * ramp; hr_t += 18 * ramp; resp_t += 6 * ramp
        elif sc == "arrhythmia":
            irregular = 0.35 * ramp; hr_t += 20 * ramp
        elif sc == "fever":
            temp_t += 2.4 * ramp; hr_t += 22 * ramp; resp_t += 3 * ramp; rmssd *= 0.7
        elif sc == "fatigue":
            hr_t += 9 * ramp; rmssd *= (1 - 0.55 * ramp)
        elif sc == "orthostatic":
            sbp_t -= 32 * ramp; dbp_t -= 14 * ramp; hr_t += 35 * ramp
        elif sc == "dehydration":
            self.hydration = max(0.6, self.hydration - 0.002 * dt)
            hr_t += 14 * ramp; temp_t += 0.5 * ramp; sbp_t -= 8 * ramp
        elif sc == "stress":
            hr_t += 25 * ramp; rmssd *= (1 - 0.5 * ramp); resp_t += 5 * ramp; sbp_t += 14 * ramp
        elif sc == "unresponsive":
            accel_g = 0.0; hr_t = self.b["hr"] * 0.75; resp_t = 8; spo2_t -= 4 * ramp
        if sc in ("eva", "eva_co2", "dcs"):
            hr_t = self.b["hr"] * 1.75 + 25 * math.sin(el / 40.0) ** 2 + (15 if sc == "eva_co2" else 0) * ramp
            if sc == "eva_co2":
                resp_t += 8 * ramp
        if sc != "dehydration":
            self.hydration = min(1.0, self.hydration + 0.001 * dt)

        # dinámica de primer orden + ruido
        self.hr = max(35, self._lag(self.hr, hr_t, 0.15) + n(0, 1.2))
        self.spo2 = min(100, max(70, self._lag(self.spo2, spo2_t, 0.08) + n(0, 0.25)))
        self.skin_temp = self._lag(self.skin_temp, temp_t, 0.03) + n(0, 0.03)
        self.resp = max(5, self._lag(self.resp, resp_t, 0.1) + n(0, 0.4))
        self.sbp = self._lag(self.sbp, sbp_t, 0.08) + n(0, 1.5)
        self.dbp = self._lag(self.dbp, dbp_t, 0.08) + n(0, 1.0)

        # intervalos RR del último segundo (ms) -> permite HRV real en la estación
        rr_list, acc = [], 0.0
        mean_rr = 60.0 / self.hr
        sd = (rmssd / 1000.0) / math.sqrt(2)
        while acc < dt:
            rr = mean_rr + n(0, sd)
            if irregular and self.rng.random() < irregular:
                rr *= self.rng.choice([0.62, 0.7, 1.35, 1.5])
            rr = max(0.25, min(2.0, 0.5 * rr + 0.5 * self.last_rr + n(0, sd)))
            self.last_rr = rr
            rr_list.append(round(rr * 1000))
            acc += rr

        accel = max(0.0, accel_g + abs(n(0, accel_g * 0.3 + 0.002))) if accel_g > 0 else abs(n(0, 0.0005))
        if self.activity in ("work", "exercise"):
            self.steps += int(accel * 3)
        self.battery = max(0.0, self.battery - 0.0015 * dt)

        pkt = {
            "crew_id": self.id, "ts": now, "activity": self.activity, "scenario": sc,
            "hr": round(self.hr, 1), "rr_ms": rr_list, "spo2": round(self.spo2, 1),
            "skin_temp": round(self.skin_temp, 2), "resp_rate": round(self.resp, 1),
            "sbp": round(self.sbp), "dbp": round(self.dbp), "accel_g": round(accel, 4),
            "steps": self.steps, "battery": round(self.battery, 1), "hydration": round(self.hydration, 3),
            "sleep_h": round(min(self.sleep_h, 5.4) if sc == "fatigue" else self.sleep_h, 2),
            "quality": round(self.rng.uniform(0.15, 0.4), 2) if sc == "sensor_loose" else round(max(0.55, min(1.0, 0.97 - accel * 0.4 + self.rng.gauss(0, 0.02))), 2),
        }
        if self.activity == "eva":
            s = self.suit
            if sc == "eva_co2":
                s["ppco2_mmhg"] = min(15.0, s["ppco2_mmhg"] + 0.09 * dt)
            else:
                s["ppco2_mmhg"] = self._lag(s["ppco2_mmhg"], 2.0, 0.05) + n(0, 0.05)
            s["pressure_psi"] = self._lag(s["pressure_psi"], 3.6 if sc == "dcs" else 4.3, 0.02) + n(0, 0.01)
            s["o2_pct"] = max(0.0, s["o2_pct"] - 0.004 * dt)
            s["temp_c"] = self._lag(s["temp_c"], 22 + (self.hr - 100) * 0.05, 0.05)
            # tasa metabólica estimada a partir de la FC (relación lineal aproximada FC-VO2)
            met_w = max(120.0, 290 + (self.hr - 110) * 6.5)
            pkt["suit"] = {k: round(v, 2) for k, v in s.items()}
            pkt["suit"]["metabolic_w"] = round(met_w)
            if sc == "dcs" and el > 45:
                pkt["symptom"] = "dolor articular (rodilla/hombro)"
        return pkt
