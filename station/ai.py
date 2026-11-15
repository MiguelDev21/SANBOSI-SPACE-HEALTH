"""Asistente de salud de a bordo (SANBOSI).

Arquitectura (sin nube, Earth-independent):
  1. El motor de reglas (risk_engine) produce hallazgos explicables con evidencia numérica.
  2. Se recuperan de la base de conocimiento HSRB/OCHMO los riesgos relevantes (RAG por palabras clave).
  3. Un LLM local (Ollama, p.ej. llama3.2:3b o qwen2.5:7b) redacta la respuesta en lenguaje natural usando SOLO
     ese contexto. Si no hay LLM disponible, un redactor determinista genera la respuesta.
El LLM nunca decide umbrales ni inventa mediciones: conversa sobre hallazgos verificables.
"""
import json
import time

import requests

from . import config
from .risk_engine import KB, RISKS, detect_symptoms

SYSTEM = (
    "Eres SANBOSI, el asistente de salud a bordo que habla a través del reloj del astronauta. Hablas español, con "
    "frases cortas, cálidas y claras porque tu respuesta se escucha por voz. Usa SOLO los datos del CONTEXTO; no "
    "inventes mediciones. NO diagnosticas enfermedades: describes cambios respecto a la línea base de la persona y "
    "sugieres un siguiente paso. Si hay un cambio crítico, dilo primero con la acción inmediata. "
    "Cita el riesgo NASA (Human System Risk) correspondiente. Recuerda que no reemplazas al cirujano de vuelo; "
    "indica cuándo escalar a Houston (el mensaje viajará por DTN cuando haya contacto). Máximo 90 palabras."
)

_status = {"ollama": None, "checked": 0, "model": config.OLLAMA_MODEL}


def ollama_available():
    if time.time() - _status["checked"] < 30:
        return _status["ollama"]
    _status["checked"] = time.time()
    try:
        r = requests.get(config.OLLAMA_URL + "/api/tags", timeout=1.5)
        models = [m["name"] for m in r.json().get("models", [])]
        if models and config.OLLAMA_MODEL not in models:
            _status["model"] = next((m for m in models if config.OLLAMA_MODEL.split(":")[0] in m), models[0])
        else:
            _status["model"] = config.OLLAMA_MODEL
        _status["ollama"] = bool(models)
    except Exception:
        _status["ollama"] = False
    return _status["ollama"]


def retrieve(question, findings, k=3):
    q = (question or "").lower()
    scores = {}
    for r in KB["risks"]:
        s = 0
        if r["name"].lower() in q:
            s += 3
        s += sum(2 for kw in r.get("keywords", []) if kw in q)
        s += sum(1 for w in r["desc"].lower().split() if len(w) > 6 and w in q)
        s += sum(4 for f in findings if f["risk"] == r["id"])
        if s:
            scores[r["id"]] = s
    return [RISKS[i] for i, _ in sorted(scores.items(), key=lambda x: -x[1])[:k]]


def build_context(crew, state, question):
    f = state.get("findings", [])
    v = state.get("vitals") or {}
    ctx = {
        "astronauta": {"id": crew["id"], "nombre": crew["name"], "rol": crew["role"]},
        "estado": state.get("status"), "puntaje_salud": state.get("score"),
        "signos_vitales": {k: v.get(k) for k in ("activity", "hr", "spo2", "skin_temp", "resp_rate", "sbp", "dbp", "rmssd") if v.get(k) is not None},
        "hallazgos": [{"riesgo": x["risk_name"], "severidad": x["severity"], "titulo": x["title"], "evidencia": x["evidence"],
                       "accion": x["recommendation"]} for x in f[:6]],
        "ambiente_iss": {k: state.get("env", {}).get(k) for k in ("ppco2_mmhg", "ppo2_mmhg", "pressure_mmhg", "temp_c", "source")},
        "radiacion": {k: state.get("rad", {}).get(k) for k in ("dose_rate_ugy_h", "goes_10mev_pfu", "noaa_scale", "source")},
        "voz": (state.get("voice") or {}).get("indices"),
        "enlace_tierra": state.get("dtn"),
        "conocimiento_nasa": [{"riesgo": r["name"], "descripcion": r["desc"], "contramedidas": r["countermeasures"], "fuente": r["url"]}
                              for r in retrieve(question, f)],
    }
    return ctx


def _lc(t):
    if not t or (len(t) > 1 and t[1].isupper()):      # siglas como CO2, EVA, SANS
        return t
    return t[:1].lower() + t[1:]


import re
import unicodedata

LABS = json.loads((config.STATION_DIR / "knowledge" / "inspiration4_labs.json").read_text(encoding="utf-8"))
STATUS_EN = {"Normal": "normal", "Observación": "under observation", "Atención": "attention", "Crítica": "critical",
             "Revisar sensor": "sensor check", "SIN DATOS": "no data yet"}
# temas que la persona puede pedir que le expliquen → riesgo NASA de la base de conocimiento
EXPLAIN = [("BONE", ["hueso", "osea", "oseo", "bone"]), ("MUSCLE", ["musculo", "muscle"]), ("RAD", ["radiacion", "radiation", "cancer"]),
           ("SLEEP", ["sueno", "dormir", "sleep", "circadian", "fatiga", "fatigue"]), ("CO2", ["co2", "dioxido", "carbon dioxide"]),
           ("SANS", ["vision", "ojo", "eye", "sans"]), ("RENAL", ["rinon", "renal", "kidney"]), ("CV", ["corazon", "cardio", "heart"]),
           ("OI", ["ortostat", "orthostat", "desmay", "faint"]), ("SM", ["mareo", "nausea", "dizz", "vertigo", "space sickness", "sensoriomotor"]),
           ("IMM", ["inmun", "immun", "defensa", "infecc", "infection"]), ("BHP", ["estres", "stress", "mental", "aislamiento", "isolation", "psicolog", "psycholog", "conductual", "behavior"]),
           ("DCS", ["descompres", "decompress", "bends"]), ("HYPOXIA", ["hipoxia", "hypoxia", "falta de oxigeno", "lack of oxygen"]),
           ("NUTR", ["nutric", "nutrition", "aliment", "diet"]), ("HEAR", ["oido", "audit", "hearing", "ruido", "noise"]),
           ("EVA", ["caminata espacial", "spacewalk", "eva "]), ("VTE", ["trombo", "coagul", "clot"]), ("AEROBIC", ["aerobic", "aerobi", "capacidad fisica", "fitness"]),
           ("MEDS", ["medicamento", "medicina", "medication", "medicine", "pastilla", "pill"]), ("TOX", ["toxic", "humo", "smoke"]), ("EIHSO", ["sin senal", "autonom", "independ"])]
EXPLAIN_Q = ["que es", "que son", "por que", "porque", "como afecta", "que pasa con", "que le pasa", "explica", "explicame", "cuentame sobre", "hablame de", "que riesgo",
             "what is", "what are", "why", "how does", "how do", "explain", "tell me about", "what happens", "what risk"]
LAB_EN = {"Glucosa": "glucose", "Potasio": "potassium", "Glóbulos blancos": "white blood cells", "Linfocitos": "lymphocytes",
          "Neutrófilos": "neutrophils", "Hemoglobina": "hemoglobin", "Hematocrito": "hematocrit", "Plaquetas": "platelets",
          "Sodio": "sodium", "Albúmina": "albumin"}


def _norm(t):
    t = unicodedata.normalize("NFD", (t or "").lower())
    t = "".join(c for c in t if unicodedata.category(c) != "Mn")
    return " " + re.sub(r"[^a-z0-9ñ ]+", " ", t).strip() + " "


def _has(q, *words):
    """True si alguna palabra/raíz aparece al inicio de una palabra de la pregunta normalizada."""
    return any(re.search(r"(?<![a-z])" + w, q) for w in words)


def _f(x, d=0):
    try:
        return f"{float(x):.{d}f}"
    except (TypeError, ValueError):
        return "—"


# Intenciones: (clave, raíces en español, raíces en inglés). Se evalúan TODAS y se responde a las que coincidan.
INTENTS = [
    ("hello", ["hola", "buenos dias", "buenas", "que tal"], ["hello", "hi ", "hey", "good morning", "good evening", "whats up"]),
    ("thanks", ["gracias"], ["thank"]),
    ("who", ["quien eres", "que eres", "que puedes", "que sabes hacer", "como funcionas", "ayuda"], ["who are you", "what are you", "what can you", "how do you work", "help me with", "what do you do"]),
    ("status", ["como estoy", "como voy", "como me ve", "mi estado", "estado general", "resumen", "estoy bien", "todo bien", "mi salud"],
               ["how am i", "how m i", "am i ok", "am i okay", "am i fine", "my status", "my health", "summary", "how do i look", "how im doing", "how am i doing", "overall"]),
    ("heart", ["corazon", "pulso", "latido", "frecuencia card", "ritmo card", "pulsacion"], ["heart", "pulse", "heartbeat", "beats", "bpm", "heart rate"]),
    ("spo2", ["saturacion", "oxigeno en (la )?sangre", "oxigenacion", "mi oxigeno", "cuanto oxigeno", "spo2"], ["saturation", "blood oxygen", "my oxygen", "oxygen level", "spo2", "oxygen saturation"]),
    ("temp", ["temperatura", "fiebre", "calentura", "tengo calor", "tengo frio"], ["temperature", "fever", "feel hot", "feel cold", "temp "]),
    ("bp", ["presion", "tension arterial"], ["blood pressure", "pressure"]),
    ("breath", ["respiracion", "respiro", "frecuencia resp"], ["breathing rate", "respiration", "how am i breathing"]),
    ("hrv", ["variabilidad", "vfc", "hrv"], ["variability", "hrv"]),
    ("sleep", ["dormi", "sueno", "descans", "dormir", "insomnio"], ["sleep", "slept", "rest ", "rested", "insomnia", "tired"]),
    ("water", ["agua", "hidrat", "vasos", "sed "], ["water", "hydrat", "glasses", "thirst", "drink"]),
    ("food", ["comi", "comida", "almuerz", "almorce", "desayun", "cena", "aliment", "hambre", "nutric"], ["food", "eat", "ate ", "lunch", "breakfast", "dinner", "meal", "hungry", "nutrition"]),
    ("rad", ["radiacion", "dosis", "tormenta", "solar", "rayos", "sievert", "gray", "refugio"], ["radiation", "dose", "storm", "solar", "sievert", "gray", "shelter", "cosmic"]),
    ("cabin", ["cabina", "aire", "co2", "dioxido", "ambiente", "presion de la cabina"], ["cabin", "air ", "co2", "carbon dioxide", "environment", "air quality"]),
    ("mind", ["animo", "estres", "estresad", "tension", "ansie", "ansios", "triste", "nervios", "mi voz", "como sueno", "energia", "agotad", "cansad"],
             ["mood", "stress", "anxious", "anxiety", "sad", "nervous", "my voice", "how do i sound", "energy", "exhausted", "burned out"]),
    ("alerts", ["aviso", "alerta", "algo raro", "algun problema", "hay problema"], ["alert", "warning", "anything wrong", "any problem", "issues"]),
    ("labs", ["sangre", "examen", "analisis", "glucosa", "azucar", "potasio", "globulos", "laboratorio", "hemoglobina", "defensas"],
             ["blood test", "blood work", "lab", "test result", "glucose", "sugar", "potassium", "white cell", "white blood", "hemoglobin"]),
    ("earth", ["tierra", "houston", "control de mision", "contacto", "senal", "dtn", "mensaje"], ["earth", "houston", "mission control", "contact", "signal", "dtn", "message"]),
    ("doctor", ["medico", "doctora", "doctor", "cirujan"], ["doctor", "surgeon", "physician", "medic "]),
    ("day", ["que dia", "dia de mision", "dia de la mision", "que hora", "cuantos dias"], ["what day", "mission day", "what time", "how many days"]),
    ("exercise", ["ejercicio", "entren", "caminadora", "bicicleta"], ["exercise", "workout", "training", "treadmill"]),
    ("advice", ["que hago", "que debo", "que me recomiendas", "consejo", "recomendacion", "que sigue"], ["what should i", "what do i do", "advice", "recommend", "what now", "what next", "whats next"]),
]


def intents_of(question):
    q = _norm(question)
    found = []
    for key, es, en in INTENTS:
        if _has(q, *[re.escape(w).replace(r"\(", "(").replace(r"\)", ")").replace(r"\?", "?") for w in es + en]):
            found.append(key)
    # "oxígeno" a secas: si habla de cabina/aire es ambiente, si no, es la saturación en sangre
    if "spo2" not in found and _has(q, "oxigeno", "oxygen") and "cabin" not in found:
        found.append("spo2")
    if "cabin" in found and "bp" in found and _has(q, "cabina", "cabin"):
        found.remove("bp")
    return found


def rule_answer(crew, state, question, lang="es"):
    """Respuesta corta y natural (se escucha en el reloj) a LO QUE SE PREGUNTÓ, armada solo con los datos medidos."""
    from .i18n import translate
    en = lang == "en"
    L = (lambda es, e: e) if en else (lambda es, e: es)
    T = translate if en else (lambda x: x)
    f = state.get("findings", []) or []
    v = state.get("vitals") or {}
    b = crew.get("baseline", {})
    name = crew["name"].split()[0]
    status = state.get("status") or "Normal"
    st = STATUS_EN.get(status, "normal") if en else status.lower()
    cnt = state.get("counters") or {}
    q = _norm(question)
    it = intents_of(question)
    parts, named = [], set()

    # 1) lo que la persona acaba de contar (síntomas)
    for s in detect_symptoms(question)[:2]:
        r = RISKS[s["risk"]]
        named.add(s["risk"])
        parts.append(L(f"Anoté que mencionaste “{s['phrase']}”. Puede relacionarse con el riesgo NASA de {_lc(r['name'])}. Te sugiero: {_lc(r['countermeasures'][0])}.",
                       f"I noted you mentioned “{s['phrase']}”. It may relate to NASA's {_lc(translate(r['name']))} risk. My suggestion: {_lc(translate(r['countermeasures'][0]))}."))
    if named:
        parts.append(L("Lo verá la médico de vuelo en tu ficha.", "The flight surgeon will see it in your record."))

    # 0) "¿qué es…?", "¿por qué…?": explicar con la base de conocimiento NASA antes que leer datos
    if not named and _has(q, *[re.escape(w) for w in EXPLAIN_Q]):
        rid = next((rid for rid, ws in EXPLAIN if _has(q, *[re.escape(w) for w in ws])), None)
        if rid:
            r = RISKS[rid]
            return L(f"Sobre {_lc(r['name'])}: {r['desc']} Lo que ayuda: {_lc(r['countermeasures'][0])}." + (f" {r['countermeasures'][1]}." if len(r['countermeasures']) > 1 else ""),
                     f"About {_lc(translate(r['name']))}: {r.get('desc_en') or translate(r['desc'])} What helps: {_lc(translate(r['countermeasures'][0]))}." + (f" {translate(r['countermeasures'][1])}." if len(r['countermeasures']) > 1 else ""))

    has_v = bool(v)
    def need_v():
        return L("Todavía no recibo datos de tu reloj. Revisa que esté bien puesto.", "I'm not getting data from your watch yet. Check that it's on properly.")

    for k in it:
        if k == "hello" and len(it) == 1 and not named:
            parts.append(L(f"Hola {name}. Tu estado es {st}. Pregúntame por tu pulso, tu sueño, la radiación o cómo vas hoy.",
                           f"Hi {name}. Your status is {st}. Ask me about your pulse, your sleep, radiation or how your day is going."))
        elif k == "thanks" and len(it) == 1:
            parts.append(L("Con gusto. Aquí estoy cuando me necesites.", "You're welcome. I'm here whenever you need me."))
        elif k == "who":
            parts.append(L("Soy SANBOSI, tu asistente de salud a bordo. Vigilo tus signos, tu sueño, tu voz y la radiación, te aviso si algo cambia frente a lo habitual y le paso la información a la médico de vuelo. No hago diagnósticos.",
                           "I'm SANBOSI, your onboard health assistant. I watch your vitals, sleep, voice and radiation, tell you when something changes from your usual, and pass it to the flight surgeon. I don't diagnose."))
        elif k == "status":
            if not has_v:
                parts.append(need_v()); continue
            top = [x for x in f if x["severity"] in ("warning", "critical") and x["risk"] not in named]
            s1 = L(f"Tu estado general es {st}. Pulso {_f(v.get('hr'))}, oxígeno {_f(v.get('spo2'))} por ciento y dormiste {_f(v.get('sleep_h'), 1)} horas.",
                   f"Your overall status is {st}. Pulse {_f(v.get('hr'))}, oxygen {_f(v.get('spo2'))} percent, and you slept {_f(v.get('sleep_h'), 1)} hours.")
            s2 = (L(f"Lo que más cambió: {_lc(top[0]['title'])}. {top[0]['recommendation']}.", f"The main change: {_lc(T(top[0]['title']))}. {T(top[0]['recommendation'])}.")
                  if top else L("Todo está dentro de tu rango habitual.", "Everything is within your usual range."))
            parts += [s1, s2]
        elif k == "heart":
            if not has_v:
                parts.append(need_v()); continue
            d = (v.get("hr") or 0) - b.get("hr", 0)
            cmp_ = (L("parecido a tu habitual", "close to your usual") if abs(d) < 8 else
                    L(f"{_f(abs(d))} más que tu habitual en reposo", f"{_f(abs(d))} above your usual resting rate") if d > 0 else
                    L(f"{_f(abs(d))} menos que tu habitual", f"{_f(abs(d))} below your usual"))
            irr = (v.get("irregularity") or 0) > 0.1
            parts.append(L(f"Tu pulso está en {_f(v.get('hr'))} latidos por minuto, {cmp_}." + (" Noto el ritmo algo irregular; quédate en reposo y lo sigo vigilando." if irr else " El ritmo se ve regular."),
                           f"Your pulse is {_f(v.get('hr'))} beats per minute, {cmp_}." + (" The rhythm looks a bit irregular; please rest and I'll keep watching it." if irr else " The rhythm looks regular.")))
        elif k == "spo2":
            if not has_v:
                parts.append(need_v()); continue
            low = (v.get("spo2") or 100) < 94
            parts.append(L(f"Tu oxígeno en sangre está en {_f(v.get('spo2'))} por ciento." + (" Está bajo: respira despacio y avisaré a la médico si no sube." if low else " Está bien."),
                           f"Your blood oxygen is {_f(v.get('spo2'))} percent." + (" That's low: breathe slowly, and I'll alert the surgeon if it doesn't rise." if low else " That's good.")))
        elif k == "temp":
            if not has_v:
                parts.append(need_v()); continue
            d = (v.get("skin_temp") or 0) - b.get("skin_temp", 33.6)
            parts.append(L(f"La temperatura de tu piel es {_f(v.get('skin_temp'), 1)} grados" + (f", {_f(d, 1)} por encima de lo habitual. Puede ser el inicio de fiebre; descansa, hidrátate y lo vigilo." if d > 0.8 else ", normal para ti. La piel de la muñeca suele estar unos 3 grados por debajo de la temperatura central."),
                           f"Your skin temperature is {_f(v.get('skin_temp'), 1)} degrees" + (f", {_f(d, 1)} above your usual. It could be the start of a fever; rest, drink water and I'll keep watching." if d > 0.8 else ", normal for you. Wrist skin is usually about 3 degrees below core temperature.")))
        elif k == "bp":
            if not has_v:
                parts.append(need_v()); continue
            parts.append(L(f"Tu presión estimada es {_f(v.get('sbp'))} sobre {_f(v.get('dbp'))}; tu habitual es {b.get('sbp', '—')} sobre {b.get('dbp', '—')}. Es una estimación del reloj; para un valor exacto usa el tensiómetro y díctamelo.",
                           f"Your estimated blood pressure is {_f(v.get('sbp'))} over {_f(v.get('dbp'))}; your usual is {b.get('sbp', '—')} over {b.get('dbp', '—')}. It's a watch estimate; for an exact value use the cuff and tell me the reading."))
        elif k == "breath" and has_v:
            parts.append(L(f"Respiras {_f(v.get('resp_rate'))} veces por minuto; tu habitual es {b.get('resp', '—')}.", f"You're breathing {_f(v.get('resp_rate'))} times per minute; your usual is {b.get('resp', '—')}."))
        elif k == "hrv" and has_v:
            parts.append(L(f"Tu variabilidad cardíaca es {_f(v.get('rmssd'))} milisegundos; tu habitual es {b.get('rmssd', '—')}. Si baja mucho suele indicar cansancio o estrés.",
                           f"Your heart rate variability is {_f(v.get('rmssd'))} milliseconds; your usual is {b.get('rmssd', '—')}. A big drop usually means fatigue or stress."))
        elif k == "sleep":
            h = v.get("sleep_h")
            if h is None:
                parts.append(need_v()); continue
            hh, mm = int(h), round((h % 1) * 60)
            tip = (L(" Es poco: hoy intenta acostarte 30 minutos antes y evita pantallas antes de dormir.", " That's short: try going to bed 30 minutes earlier tonight and avoid screens before sleep.") if h < 6 else
                   L(" Dormiste bien.", " You slept well.") if h >= b.get("sleep_h", 7) - 0.5 else L(" Un poco menos de lo habitual.", " A bit less than usual."))
            parts.append(L(f"Anoche dormiste {hh} horas y {mm} minutos; tu habitual es {_f(b.get('sleep_h', 7), 1)} horas.", f"Last night you slept {hh} hours and {mm} minutes; your usual is {_f(b.get('sleep_h', 7), 1)} hours.") + tip)
        elif k == "water":
            n = cnt.get("water", 0)
            hyd = v.get("hydration")
            parts.append(L(f"Llevas {n} de 8 vasos de agua hoy." + (" Toma uno ahora; en el espacio la sed se siente menos." if n < 8 else " Meta cumplida.") + (f" El reloj mide tu hidratación en {_f((hyd or 0) * 100)} por ciento." if hyd is not None else ""),
                           f"You've had {n} of 8 glasses of water today." + (" Have one now; in space you feel less thirsty." if n < 8 else " Goal reached.") + (f" The watch reads your hydration at {_f((hyd or 0) * 100)} percent." if hyd is not None else "")))
        elif k == "food":
            meals = cnt.get("meals", [])
            names = ", ".join(m.get("name", "") for m in meals if isinstance(m, dict)) if meals else ""
            parts.append(L(f"Hoy registraste {len(meals)} comidas" + (f": {names}." if names else ".") + (" Recuerda comer a tus horas: protege tus músculos y huesos." if len(meals) < 3 else ""),
                           f"Today you logged {len(meals)} meals" + (f": {names}." if names else ".") + (" Remember to eat on schedule: it protects your muscles and bones." if len(meals) < 3 else "")))
        elif k == "rad":
            r = state.get("rad", {})
            storm = str(r.get("noaa_scale", "S0")) not in ("S0", "None", "")
            msv = state.get("dose_msv")
            parts.append(L(f"La radiación está en {_f(r.get('dose_rate_ugy_h'), 1)} microgray por hora y la escala solar en {r.get('noaa_scale', 'S0')}." + (f" Llevas cerca de {_f(msv, 1)} milisievert en la misión, {_f((msv or 0) / 6, 1)} por ciento del límite de carrera de la NASA." if msv is not None else "") + (" Hay tormenta solar: ve al refugio blindado." if storm else " No hay tormenta solar."),
                           f"Radiation is {_f(r.get('dose_rate_ugy_h'), 1)} micrograys per hour and the solar scale is {r.get('noaa_scale', 'S0')}." + (f" You're at about {_f(msv, 1)} millisieverts this mission, {_f((msv or 0) / 6, 1)} percent of NASA's career limit." if msv is not None else "") + (" There's a solar storm: go to the shielded shelter." if storm else " There's no solar storm.")))
        elif k == "cabin":
            e = state.get("env", {})
            co2 = e.get("ppco2_mmhg") or 0
            parts.append(L(f"En la cabina el CO2 está en {_f(co2, 1)} milímetros de mercurio" + (", algo alto: puede dar dolor de cabeza; ventila tu zona." if co2 > 3 else ", dentro de lo normal.") + f" La temperatura es {_f(e.get('temp_c'), 1)} grados.",
                           f"In the cabin, CO2 is {_f(co2, 1)} millimeters of mercury" + (", a bit high: it can cause headaches; improve airflow around you." if co2 > 3 else ", within normal range.") + f" Temperature is {_f(e.get('temp_c'), 1)} degrees."))
        elif k == "mind":
            vi = (state.get("voice") or {}).get("indices")
            if vi:
                parts.append(L(f"En tu última charla tu voz mostró energía {vi.get('energy', '—')}, tensión {vi.get('stress', '—')} y ánimo {vi.get('mood', '—')} sobre 100.",
                               f"In your last talk your voice showed energy {vi.get('energy', '—')}, tension {vi.get('stress', '—')} and mood {vi.get('mood', '—')} out of 100.")
                             + (L(" Suenas cansado o tenso: tómate 10 minutos y respira conmigo si quieres.", " You sound tired or tense: take 10 minutes and breathe with me if you like.") if max(vi.get("fatigue", 0), vi.get("stress", 0)) > 65 else ""))
            elif not named:
                parts.append(L("Aún no he escuchado tu voz hoy. Háblame unos segundos y te digo cómo suenas. Si te sientes tenso, puedo guiarte a respirar.",
                               "I haven't heard your voice today. Talk to me for a few seconds and I'll tell you how you sound. If you feel tense, I can guide your breathing."))
        elif k == "alerts":
            top = [x for x in f if x["severity"] in ("watch", "warning", "critical")]
            parts.append(L(f"Tienes {len(top)} avisos. " + " ".join(f"{x['title']}." for x in top[:2]), f"You have {len(top)} alerts. " + " ".join(f"{T(x['title'])}." for x in top[:2]))
                         if top else L("No tienes avisos. Todo está dentro de tu rango habitual.", "You have no alerts. Everything is within your usual range."))
        elif k == "labs":
            c = LABS["crew"].get(crew["id"])
            if not c:
                continue
            lab = {x["key"]: x for x in c["labs"]}
            want = [x for x in ("glucose", "potassium", "wbc", "lymph", "hgb", "sodium") if _has(q, *{"glucose": ["gluc", "azucar", "sugar"], "potassium": ["potas"], "wbc": ["globulos", "white", "defens", "immune"],
                    "lymph": ["linfo", "lymph"], "hgb": ["hemog", "hemoglobin"], "sodium": ["sodio", "sodium"]}[x])] or ["glucose", "potassium", "wbc"]
            seg = []
            for kk in want[:3]:
                x = lab[kk]
                nm = LAB_EN.get(x["name"], x["name"]) if en else x["name"].lower()
                fl = (L(f", {x['flag_r1']} para el rango", f", {'high' if x['flag_r1'] == 'alto' else 'low'} for the range") if x["flag_r1"] else "")
                nb = lambda y: _f(y, 0 if abs(y) >= 20 else 1)
                seg.append(L(f"{nm} pasó de {nb(x['baseline_pre'])} a {nb(x['r1'])} {x['unit']} al regresar ({x['change_r1_pct']:+.0f} %{fl})",
                             f"{nm} went from {nb(x['baseline_pre'])} to {nb(x['r1'])} {x['unit']} after landing ({x['change_r1_pct']:+.0f} %{fl})"))
            parts.append(L(f"Tus exámenes de sangre de referencia son reales, del tripulante {c['osdr_crew']} de Inspiration4: ", f"Your reference blood tests are real data from Inspiration4 crew member {c['osdr_crew']}: ") + "; ".join(seg) + ".")
        elif k == "earth":
            d = state.get("dtn") or {}
            parts.append(L("Hay contacto con la Tierra" + (f" por {str(d.get('mission_control')).title()}" if d.get("mission_control") else "") + ". Tus resúmenes llegan cifrados por DTN." if d.get("contact") else
                           "Ahora no hay señal con la Tierra. Tus datos quedan guardados a bordo y se envían solos al recuperar el contacto.",
                           "We're in contact with Earth" + (f" through {str(d.get('mission_control')).title()}" if d.get("mission_control") else "") + ". Your summaries travel encrypted over DTN." if d.get("contact") else
                           "There's no signal with Earth right now. Your data stays safe on board and is sent automatically when contact returns."))
        elif k == "doctor":
            parts.append(L(f"La médico de vuelo es la {config.FLIGHT_SURGEON['name']} y ya ve tus datos. Si quieres que te contacte, dime “avisa al médico”.",
                           f"The flight surgeon is {config.FLIGHT_SURGEON['name'].replace('Dra.', 'Dr.')} and can already see your data. If you want her to contact you, say “call the doctor”."))
        elif k == "day":
            import datetime as _dt
            parts.append(L(f"Hoy es el día {config.MISSION_DAY} de la misión y son las {_dt.datetime.now().strftime('%H:%M')}.",
                           f"Today is mission day {config.MISSION_DAY} and it's {_dt.datetime.now().strftime('%H:%M')}."))
        elif k == "exercise":
            parts.append(L("Haz tus dos horas de ejercicio diario: caminadora, bicicleta y resistencia. En microgravedad se pierde hueso y músculo, y el ejercicio es la mejor protección.",
                           "Do your two hours of daily exercise: treadmill, bike and resistance. In microgravity you lose bone and muscle, and exercise is the best protection."))
        elif k == "advice" and not named:
            top = [x for x in f if x["severity"] in ("warning", "critical")]
            parts.append(L(f"Lo más importante ahora: {top[0]['recommendation']}." if top else "Sigue con tu plan del día: hidrátate, come a tus horas y haz tu ejercicio.",
                           f"Most important now: {T(top[0]['recommendation'])}." if top else "Keep up your plan for the day: drink water, eat on schedule and do your exercise."))

    # 2) si no entendí la pregunta, uso la base de conocimiento NASA (RAG) o doy un resumen corto
    if not parts:
        rr = retrieve(question, [])
        if rr and _has(q, "que es", "por que", "porque", "como afecta", "que pasa", "explica", "what is", "why", "how does", "explain", "what happens"):
            r = rr[0]
            parts.append(L(f"Sobre {_lc(r['name'])}: {r['desc']} Lo que ayuda: {_lc(r['countermeasures'][0])}.",
                           f"About {_lc(translate(r['name']))}: {r.get('desc_en') or translate(r['desc'])} What helps: {_lc(translate(r['countermeasures'][0]))}."))
        elif has_v:
            parts.append(L(f"No estoy seguro de haber entendido. Tu estado es {st}, con pulso {_f(v.get('hr'))} y oxígeno {_f(v.get('spo2'))} por ciento. Puedes preguntarme por tu sueño, la radiación, tu agua o tus avisos.",
                           f"I'm not sure I understood. Your status is {st}, with pulse {_f(v.get('hr'))} and oxygen {_f(v.get('spo2'))} percent. You can ask me about your sleep, radiation, water or alerts."))
        else:
            parts.append(need_v())

    # 3) un cambio crítico siempre se dice, aunque no hayan preguntado por él
    crit = [x for x in f if x["severity"] == "critical" and x["risk"] not in named]
    if crit and "status" not in it and "alerts" not in it:
        x = crit[0]
        parts.insert(0, L(f"Importante: {x['title']}. {x['recommendation']}.", f"Important: {T(x['title'])}. {T(x['recommendation'])}."))
    return " ".join(parts[:4])


def deterministic_answer(crew, state, question):
    return rule_answer(crew, state, question, "es")


def deterministic_answer_en(crew, state, question):
    return rule_answer(crew, state, question, "en")


def answer(crew, state, question, lang="es"):
    ctx = build_context(crew, state, question)
    if ollama_available():
        try:
            r = requests.post(config.OLLAMA_URL + "/api/chat", timeout=60, json={
                "model": _status["model"], "stream": False, "options": {"temperature": 0.2},
                "messages": [{"role": "system", "content": SYSTEM + (" ANSWER IN ENGLISH. Your name is SANBOSI." if lang == "en" else "")},
                             {"role": "user", "content": "CONTEXTO:\n" + json.dumps(ctx, ensure_ascii=False) + "\n\nPREGUNTA DEL ASTRONAUTA: " + (question or "¿Cómo estoy?")}]})
            txt = r.json()["message"]["content"].strip()
            if txt:
                return {"text": txt, "engine": f"ollama:{_status['model']}", "context": ctx}
        except Exception as e:
            ctx["llm_error"] = str(e)
    if lang == "en":
        return {"text": rule_answer(crew, state, question, "en"), "engine": "rules+RAG (no LLM)", "context": ctx}
    return {"text": rule_answer(crew, state, question, "es"), "engine": "reglas+RAG (sin LLM)", "context": ctx}


def status():
    return {"ollama": ollama_available(), "model": _status["model"], "url": config.OLLAMA_URL}
