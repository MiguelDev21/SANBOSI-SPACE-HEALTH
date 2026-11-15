"""Traducción ES → EN de los textos que genera la estación (hallazgos, recomendaciones, riesgos NASA, bitácora, voz).

La estación razona y guarda todo en español; cuando el panel o el reloj piden `?lang=en`, las respuestas JSON se
traducen al vuelo en los campos de texto visibles. Los valores que la interfaz usa como claves (estado, severidad,
riesgo, actividad…) NO se traducen: la interfaz los traduce con su propio diccionario.
"""
import re

EXACT = {
    # ---- estados / severidades (solo si llegan como texto libre) ----
    "Revisar sensor": "Check sensor",
    # ---- títulos de hallazgos ----
    "Bradicardia": "Bradycardia", "Desaturación de oxígeno": "Oxygen desaturation", "EVA en curso · monitoreo reforzado": "EVA in progress · enhanced monitoring",
    "Estado de ánimo bajo": "Low mood", "Estrés detectado en la voz": "Stress detected in voice", "Fatiga detectada en la voz": "Fatigue detected in voice",
    "Hipotensión / intolerancia ortostática": "Hypotension / orthostatic intolerance", "Hipoxemia severa": "Severe hypoxemia",
    "Posible fatiga / estrés: sueño corto + pulso alto + VFC baja": "Possible fatigue / stress: short sleep + high pulse + low HRV",
    "Presión arterial elevada": "High blood pressure", "Presión de traje baja": "Low suit pressure", "Reloj sin enlace con la estación": "Watch not linked to the station",
    "Respuesta de estrés agudo": "Acute stress response", "Señal de baja calidad": "Low-quality signal", "Sin datos del reloj": "No watch data",
    "Sin movimiento y respiración lenta": "No movement and slow breathing", "Sobreesfuerzo en EVA": "EVA overexertion", "Sueño corto anoche": "Short sleep last night",
    "Taquicardia en reposo": "Resting tachycardia", "Taquipnea en reposo": "Resting tachypnea",
    "Tasa de dosis elevada (probable paso por la Anomalía del Atlántico Sur)": "Elevated dose rate (likely South Atlantic Anomaly pass)",
    "Tasa de dosis muy alta": "Very high dose rate", "Tasa metabólica alta en EVA": "High metabolic rate during EVA",
    "Variabilidad cardíaca baja (fatiga / estrés)": "Low heart-rate variability (fatigue / stress)", "CO2 alto dentro del traje": "High CO2 inside the suit",
    "CO2 de cabina elevado": "Elevated cabin CO2", "Deshidratación probable": "Probable dehydration", "Ritmo cardíaco irregular (posible arritmia)": "Irregular heart rhythm (possible arrhythmia)",
    "Temperatura elevada (posible infección)": "Elevated temperature (possible infection)", "Síntoma reportado por el reloj": "Symptom reported by the watch",
    "Pidió hablar con el médico de vuelo": "Asked to talk to the flight surgeon", "En el refugio blindado": "In the shielded shelter",
    "Salió del refugio y está bien": "Left the shelter and is fine",
    # ---- recomendaciones ----
    "Activar modo de purga y regresar a la esclusa": "Activate purge mode and return to the airlock",
    "Ajustar el horario de descanso y revisar ruido y luz en su cabina": "Adjust the rest schedule and check noise and light in their quarters",
    "Ajustar la correa del reloj": "Tighten the watch strap", "Beber 500 ml de agua; meta diaria de hidratación": "Drink 500 ml of water; daily hydration goal",
    "Contactar al astronauta de inmediato; alerta a la tripulación": "Contact the astronaut immediately; alert the crew",
    "Mantener ritmo de trabajo; hidratación por bolsa del traje": "Keep a steady work pace; hydrate from the suit drink bag",
    "Ofrecer conferencia privada con soporte psicológico": "Offer a private conference with psychological support",
    "Oxígeno suplementario inmediato y verificar ppO2": "Immediate supplemental oxygen and check ppO2",
    "Pausar la tarea y descansar en posición estable": "Pause the task and rest in a stable position",
    "Pedir que ajuste el reloj en la muñeca; el reloj guarda datos y los reenvía": "Ask them to adjust the watch on the wrist; it stores data and resends it",
    "Permanecer en módulo blindado y evitar EVA hasta que baje": "Stay in a shielded module and avoid EVA until it drops",
    "Posición supina, carga de fluidos, prendas de compresión": "Supine position, fluid loading, compression garments",
    "Refugiarse en el módulo con más blindaje; posponer EVA": "Take shelter in the most shielded module; postpone EVA",
    "Registrar ECG de 12 derivaciones y reposo; notificar a cirujano de vuelo": "Record a 12-lead ECG and rest; notify the flight surgeon",
    "Respiración guiada 4-7-8 durante 3 min; ofrecer contacto con soporte psicológico": "Guided 4-7-8 breathing for 3 min; offer contact with psychological support",
    "Siesta programada y revisar el horario de descanso": "Scheduled nap and review the rest schedule",
    "Terminar EVA, repressurizar y tratar con O2": "End EVA, repressurize and treat with O2", "Transitorio; se registra en la dosis acumulada": "Transient; added to the cumulative dose",
    "Verificar que el reloj esté puesto y emparejado": "Check that the watch is worn and paired",
    "Contactar al astronauta hoy": "Contact the astronaut today", "Registrar el evento en su historial de dosis": "Log the event in their dose history",
    "Acción hecha desde el reloj": "Action taken from the watch", "Lo pidió desde el reloj": "Requested from the watch",
    # ---- riesgos NASA (HSRB) ----
    "Cardiovascular": "Cardiovascular", "Intolerancia ortostática": "Orthostatic intolerance", "Tromboembolismo venoso": "Venous thromboembolism",
    "Hipoxia": "Hypoxia", "Exposición a CO2": "CO2 exposure", "Carcinogénesis por radiación": "Radiation carcinogenesis",
    "Sueño, ritmo circadiano y carga de trabajo": "Sleep, circadian rhythm and workload", "Salud conductual": "Behavioral health", "Equipo": "Team",
    "Operaciones EVA": "EVA operations", "Enfermedad por descompresión": "Decompression sickness", "Inmunológico": "Immune",
    "Interacción huésped-microorganismo": "Host-microorganism interactions", "Condiciones médicas en vuelo": "Inflight medical conditions",
    "Operaciones independientes de la Tierra (EIHSO)": "Earth-independent operations (EIHSO)", "Sensoriomotor": "Sensorimotor",
    "Síndrome neuro-ocular (SANS)": "Spaceflight neuro-ocular syndrome (SANS)", "Cálculos renales": "Renal stones", "Retención urinaria": "Urinary retention",
    "Capacidad aeróbica": "Aerobic capacity", "Músculo": "Muscle", "Fractura ósea": "Bone fracture", "Alimentación y nutrición": "Food and nutrition",
    "Medicamentos": "Medications", "Pérdida auditiva": "Hearing loss", "Radiación no ionizante": "Non-ionizing radiation", "Sustancias tóxicas": "Toxic substances",
    "Polvo": "Dust", "Cargas dinámicas": "Dynamic loads", "Choque eléctrico": "Electrical shock", "Salida de la tripulación": "Crew egress",
    # ---- contramedidas ----
    "Ejercicio aeróbico y de resistencia diario": "Daily aerobic and resistance exercise", "ECG de 12 derivaciones si hay arritmia sostenida": "12-lead ECG if arrhythmia persists",
    "Consulta con cirujano de vuelo": "Consult the flight surgeon", "Carga de fluidos y sal antes del reingreso": "Fluid and salt loading before reentry",
    "Prendas de compresión": "Compression garments", "Posición supina si hay síntomas": "Supine position if symptomatic",
    "Ultrasonido de vena yugular a bordo": "Onboard jugular vein ultrasound", "Algoritmo NASA de evaluación y tratamiento de trombosis": "NASA thrombosis assessment and treatment algorithm",
    "Verificar ppO2 de cabina/traje": "Check cabin/suit ppO2", "Oxígeno suplementario": "Supplemental oxygen", "Suspender actividad física": "Stop physical activity",
    "Verificar CDRA/scrubbers": "Check the CDRA/CO2 scrubbers", "Aumentar ventilación local": "Increase local ventilation", "Reducir carga de trabajo hasta normalizar": "Reduce workload until normal",
    "Refugio en módulo con más blindaje durante eventos solares": "Shelter in the most shielded module during solar events", "Postergar EVA": "Postpone EVA",
    "Registro de dosis personal (dosímetro activo)": "Personal dose log (active dosimeter)", "Ajuste de horario y siesta programada": "Schedule adjustment and planned nap",
    "Higiene lumínica": "Light hygiene", "Redistribuir tareas críticas": "Redistribute critical tasks", "Conferencia privada con psicología de soporte": "Private conference with support psychologist",
    "Tiempo de recreación y contacto familiar": "Recreation time and family contact", "Técnicas de respiración": "Breathing techniques",
    "Debriefing de tripulación": "Crew debriefing", "Protocolos de comunicación": "Communication protocols", "Pausa de trabajo y control de ritmo": "Work break and pace control",
    "Ajustar refrigeración LCVG": "Adjust LCVG cooling", "Abortar EVA si persiste": "Abort EVA if it persists", "Repressurizar el traje": "Repressurize the suit",
    "Terminar EVA y tratamiento con O2": "End EVA and treat with O2", "Notificar a cirujano de vuelo": "Notify the flight surgeon",
    "Control de temperatura seriado": "Serial temperature checks", "Aislamiento relativo si hay infección": "Relative isolation if infected",
    "Kit médico: antipiréticos según protocolo": "Medical kit: antipyretics per protocol", "Muestreo microbiano ambiental": "Environmental microbial sampling",
    "Higiene de superficies": "Surface hygiene", "Protocolo del kit médico ISS": "ISS medical kit protocol", "Telemedicina cuando hay enlace": "Telemedicine when linked",
    "Diagnóstico a bordo (este sistema)": "Onboard assessment (this system)", "Protocolos autónomos": "Autonomous protocols", "Sincronización DTN al recuperar enlace": "DTN sync when the link returns",
    "Restricción de movimientos de cabeza": "Restrict head movements", "Medicación antimareo según protocolo": "Anti-motion-sickness medication per protocol",
    "Examen de fondo de ojo / OCT a bordo": "Onboard fundoscopy / OCT", "Registro de agudeza visual": "Visual acuity log", "Meta de hidratación diaria": "Daily hydration goal",
    "Citrato de potasio según protocolo": "Potassium citrate per protocol", "Ultrasonido renal": "Renal ultrasound", "Cateterismo según protocolo": "Catheterization per protocol",
    "Prescripción de ejercicio en cinta/cicloergómetro": "Treadmill/cycle ergometer exercise prescription", "Ejercicio de resistencia (ARED)": "Resistance exercise (ARED)",
    "Ejercicio de impacto/resistencia": "Impact/resistance exercise", "Nutrición con calcio y vitamina D": "Calcium and vitamin D nutrition", "Registro de ingesta": "Intake log",
    "Ajuste calórico según gasto": "Caloric adjustment to expenditure", "Revisar caducidad y almacenamiento del kit": "Check kit expiry and storage",
    "Protección auditiva": "Hearing protection", "Dosimetría acústica": "Acoustic dosimetry", "Controles operacionales de emisores": "Operational emitter controls",
    "Máscara y evacuación del módulo": "Mask and evacuate the module", "Análisis de calidad de aire": "Air quality analysis", "Control de polvo en esclusa": "Airlock dust control",
    "Asientos y restricciones adecuadas": "Proper seats and restraints", "Desenergizar y evaluar ECG": "De-energize and assess ECG", "Evaluación ortostática pre-reingreso": "Pre-reentry orthostatic assessment",
    # ---- voz ----
    "voz más monótona que su base (menor variación de tono)": "flatter voice than baseline (less pitch variation)", "habla más lenta": "speaking more slowly",
    "habla más rápida": "speaking faster", "más pausas de lo habitual": "more pauses than usual", "tono más agudo (activación/estrés)": "higher pitch (arousal/stress)",
    "tono más grave de lo habitual": "lower pitch than usual", "lenguaje con carga negativa": "negative language", "lenguaje positivo": "positive language",
    "voz dentro de su rango habitual": "voice within its usual range",
    # ---- tripulación / roles ----
    "Comandante": "Commander", "Ingeniero de vuelo": "Flight engineer", "Especialista de misión": "Mission specialist", "Médico de vuelo": "Flight surgeon",
    # ---- bitácora ----
    "Pérdida de señal forzada (LOS)": "Forced loss of signal (LOS)", "Señal restablecida (AOS)": "Signal restored (AOS)",
}

# Fragmentos para textos dinámicos (evidencias con números, bitácora con nombres, acciones del reloj…)
PHRASES = [
    ("Dicho por el astronauta:", "Said by the astronaut:"), ("Síntoma referido:", "Reported symptom:"), ("Anomalía estadística en", "Statistical anomaly in"),
    ("Evento de partículas solares", "Solar particle event"), ("de latidos fuera de rango en 60 s", "of beats out of range in 60 s"),
    ("Última muestra hace", "Last sample"), ("No se han recibido muestras", "No samples received"), ("Índice de calidad", "Quality index"),
    (": se omiten alertas de esta ventana", ": alerts suppressed for this window"), ("Índice de hidratación", "Hydration index"),
    ("Índice de fatiga", "Fatigue index"), ("Índice de estrés", "Stress index"), ("Índice de ánimo", "Mood index"),
    ("respecto a su línea base personal", "vs. personal baseline"), ("sobre su base", "above baseline"), ("habitual", "usual"),
    ("Temp. piel", "Skin temp"), ("Durmió", "Slept"), ("en reposo", "at rest"), ("despierto", "awake"), ("sostenida", "sustained"),
    ("ppCO2 traje", "suit ppCO2"), ("(nominal 4.3)", "(nominal 4.3)"), ("(máx. EMU ~580 W)", "(EMU max ~580 W)"),
    ("Acelerómetro ~0 g, FR baja", "Accelerometer ~0 g, low RR"), ("dolor articular (rodilla/hombro)", "joint pain (knee/shoulder)"),
    (" vs base ", " vs baseline "), ("(base ", "(baseline "), (" lpm", " bpm"), (" rpm", " br/min"), ("FC ", "HR "), ("PAS ", "SBP "), ("FR ", "RR "),
    (" con ", " with "), (" en rest", " at rest"), (" en sleep", " asleep"), (" en work", " at work"), (" y ", " and "),
    ("habla ", "speaking "), (" dB más bajo que su base", " dB quieter than baseline"), (" dB más fuerte que su base", " dB louder than baseline"),
    # acciones del reloj
    ("Registró un vaso de agua", "Logged a glass of water"), ("Quitó un vaso de agua", "Removed a glass of water"), ("Registró una comida", "Logged a meal"),
    ("Marcó como hecha una actividad de la rutina", "Marked a routine activity as done"), ("Pospuso una actividad 15 min", "Snoozed an activity 15 min"),
    ("Hizo una pausa de respiración", "Took a breathing break"), ("Confirmó que está en el refugio", "Confirmed being in the shelter"),
    ("Confirmó que está bien tras la tormenta", "Confirmed being fine after the storm"), ("Pidió hablar con el médico de vuelo", "Asked to talk to the flight surgeon"),
    ("Programó un recordatorio", "Set a reminder"), ("Cambió 'No molestar'", "Toggled 'Do not disturb'"), ("Cambió el modo sueño", "Toggled sleep mode"),
    ("Pausó/reanudó el micrófono", "Paused/resumed the microphone"), ("Sincronizó el reloj con la estación", "Synced the watch with the station"),
    ("almuerzo", "lunch"), ("desayuno", "breakfast"), ("cena", "dinner"), ("activado", "on"), ("desactivado", "off"), ("en pausa 15 min", "paused 15 min"), ("reanudado", "resumed"),
    # bitácora
    ("Estación SANBOSI en línea", "SANBOSI station online"), ("Escenario '", "Scenario '"), ("' aplicado a ", "' applied to "),
    ("Mensaje de Tierra recibido por DTN", "Earth message received via DTN"), ("Enlace reloj→estación CORTADO (simulación)", "Watch→station link CUT (simulation)"),
    ("Enlace reloj→estación restablecido", "Watch→station link restored"), ("Perfil de misión:", "Mission profile:"), ("retardo luz", "light delay"),
    ("registró un autorreporte", "logged a self-report"), ("marcada como revisada", "marked as reviewed"), ("Alerta '", "Alert '"), ("' de ", "' for "),
    # mensajes de Houston / sistema
    ("Houston:", "Houston:"),
]
_PHR = [(re.compile((r"(?<!\w)" if es[:1].isalnum() else "") + re.escape(es) + (r"(?!\w)" if es[-1:].isalnum() else "")), en)
        for es, en in sorted(PHRASES, key=lambda p: -len(p[0]))]
TEXT_KEYS = {"title", "evidence", "recommendation", "risk_name", "explanations", "role", "name_role", "countermeasures", "text", "desc"}


def translate(s):
    if not isinstance(s, str) or not s:
        return s
    if s in EXACT:
        return EXACT[s]
    out = s
    # oraciones compuestas: "Título. Recomendación" (avisos que llegan al reloj)
    for es, en in EXACT.items():
        if len(es) > 12 and es in out:
            out = out.replace(es, en)
    for rx, en in _PHR:
        out = rx.sub(en, out)
    return out


def tr_obj(obj, lang, key=None, parent=None):
    if lang != "en":
        return obj
    if isinstance(obj, dict):
        skip_text = obj.get("role") in ("astronauta", "houston")
        return {k: (v if (k == "text" and skip_text) or k == "transcript" else tr_obj(v, lang, k, obj)) for k, v in obj.items()}
    if isinstance(obj, list):
        return [tr_obj(v, lang, key, parent) for v in obj]
    if isinstance(obj, str) and key in TEXT_KEYS:
        return translate(obj)
    return obj
