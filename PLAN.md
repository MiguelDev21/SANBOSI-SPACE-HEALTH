# SANBOSI – Plan del software de la estación (NASA Space Apps 2026 · Health Monitoring Software)

Equipo Sanbosi-FET (Neiva, Huila). Este software es el **cerebro a bordo** que recibe y procesa lo que envía el reloj
diseñado en el canvas del equipo ("SANBOSI — reloj y panel de monitoreo"). Usa el mismo lenguaje visual (Lexend,
fondo negro, tarjetas #141416, estados Bien / Observación / Atención / Crítica / Revisar sensor), la misma tripulación
(Ana Ríos, Marco Silva, Lena Ortiz, Kenji Mori), la médico de vuelo Dra. Paula Vega y las mismas secciones del panel
(Tripulación · Astronauta · Mente y voz · Alertas).

## 0. Cómo encaja con el diseño del reloj y con el plan del equipo

| Pantalla del reloj (canvas) | Qué la alimenta en este software |
|---|---|
| 1 · Esfera (Cuerpo / Mente / Comida, radiación, avisos) | `/api/watch/{id}/feed`: puntaje de Cuerpo, Mente (voz), Agua (hidratación), estado de radiación y avisos |
| 2 · Siempre listo / 5 · Energía por tu voz | `/api/voice/{id}`: dB, tono, pausas, velocidad → energía, tensión, ánimo, fatiga frente a su voz habitual |
| 8 · Sueño, 16 · Aviso de sueño | `sleep_h` del reloj + regla combinada (sueño corto + pulso alto + VFC baja) |
| 11 · Signos vitales, 13 · Aviso de tensión, 19 · Aviso de cuerpo | motor de reglas por riesgo NASA y línea base personal |
| 14 · Enviado a la estación | ingesta + store-and-forward del reloj |
| 20–22 · Radiación, tormenta solar, refugio | RadLab (dosímetros ISS) + NOAA GOES → aviso de refugio |
| 23 · Diario por voz | transcripciones + autorreportes (`POST /autorreportes`) |
| P1–P4 · Panel del médico de vuelo | `/` (Tripulación, Astronauta, Mente y voz, Alertas) + Estación y datos |

| Plan del área de Software (docx) | Estado aquí |
|---|---|
| Edge-first, alertas a bordo primero al tripulante | ✅ todo corre en el servidor de la estación; la Tierra recibe copias por DTN |
| Formato de mensaje `{"dispositivo","tripulante","t","metrica","valor","calidad"}` | ✅ `POST /ingesta/lote` (y `/api/ingest`) |
| Endpoints `/tripulantes`, `/resumen`, `/metricas/{codigo}`, `/linea-base`, `/alertas` GET/PATCH, `/autorreportes`, `/ingesta/lote` | ✅ implementados (`tests/test_contrato.py`) |
| WebSocket en vivo | ⚠️ se usa SSE (`/api/stream`), equivalente para el panel; WS puede añadirse con FastAPI |
| Línea base individual + z-score, filtro de calidad | ✅ EWMA personal + z-score; se descartan ventanas con calidad < 0,5 (escenario “Reloj flojo”) |
| PostgreSQL + TimescaleDB, MQTT, NeuroKit2 | ⏭ siguiente paso: hoy SQLite + HTTP para que corra en cualquier laptop sin Docker |
| Estados Normal / Observación / Alerta y “no diagnosticar” | ✅ textos y estados alineados con Salud |

## 1. Objetivo

Software que recoge indicadores de salud del astronauta desde un reloj de muñeca (incluida su voz), los procesa
con IA **a bordo de la estación** y le devuelve diagnósticos y acciones al instante, aunque no haya enlace con la
Tierra (riesgo NASA *EIHSO – Earth-Independent Human System Operations*). La Tierra recibe resúmenes y alertas por
**DTN (Delay/Disruption Tolerant Networking)** cuando hay contacto.

El hardware (reloj) es la visión; lo que se presenta es el **software completo funcionando**, con el reloj simulado.

## 2. Arquitectura

```
 ┌──────────── RELOJ (simulado) ────────────┐        ┌──────────────── ESTACIÓN (station/) ────────────────┐        ┌──── TIERRA ────┐
 │ watch/physiology.py  modelo fisiológico   │  HTTP  │ /api/ingest  → store (RAM + SQLite)                 │        │ /earth          │
 │  FC + intervalos RR, SpO2, temp. piel,    │ ─────► │ features.py   HRV (RMSSD, SDNN, pNN50, irregular.)  │  DTN   │ Consola cirujano│
 │  FR, PA estimada, acelerómetro, traje EVA │ (BLE/  │ Baseline      línea base personal + z-scores        │ ─────► │ de vuelo: solo  │
 │ watch/simulator.py  firmware: lotes,      │  WiFi) │ risk_engine   reglas → 30 riesgos NASA HSRB         │ Bundle │ ve lo que llegó │
 │  store-and-forward, comandos              │        │ voice.py      dB, F0, jitter, HNR, ritmo, pausas    │Protocol│ por DTN         │
 │ web/watch.html  reloj virtual + micrófono │ ◄───── │ ai.py         Dr. Vita: LLM local (Ollama) + RAG    │ ◄───── │ Mensajes ↑      │
 └───────────────────────────────────────────┘ alertas│ dtn_link.py   framework iss-simulator (arXiv)       │        └────────────────┘
                                                       │ nasa/         ISS Live · RadLab · GOES · OSDR       │
                                                       │ web/index.html  panel de la estación                │
                                                       └─────────────────────────────────────────────────────┘
```

## 3. Componentes y estado

| # | Componente | Qué hace | Estado |
|---|-----------|----------|--------|
| 1 | Framework DTN open source | `dtn-framework/` = repo `kritgrover/iss-simulator` (paper arXiv:2605.21624). Bundle Protocol con BSP (HMAC-SHA256 + AES-256-CBC), fragmentación, custodia ACK/NAK, prioridades, SQLite | ✅ integrado (modo embebido) y ✅ puente al backend completo (modo external) |
| 2 | Simulador del reloj | 4 relojes, 14 escenarios clínicos, store-and-forward, pérdida de enlace | ✅ |
| 3 | Ingesta + almacenamiento | Buffers de 1 h a 1 Hz, serie agregada cada 5 s, SQLite, exportación CSV | ✅ |
| 4 | Motor de diagnóstico | Reglas explicables por riesgo HSRB + anomalías vs línea base personal + puntaje 0-100 | ✅ |
| 5 | Análisis de voz | Grabación en navegador (WAV 16 kHz), dB, tono, jitter, shimmer, HNR, ritmo, pausas → fatiga, estrés, ánimo, energía; detección de síntomas en lo dicho | ✅ |
| 6 | IA conversacional | Dr. Vita: Ollama local + RAG sobre la base HSRB/OCHMO; respaldo determinista si no hay LLM; respuesta hablada | ✅ |
| 7 | Datos reales NASA/NOAA | ISS Live (Lightstreamer), RadLab (dosímetros ISS), GOES (protones), OSDR (Inspiration4) con caché y respaldo simulado etiquetado | ✅ (requiere internet en la Mac) |
| 8 | Panel estación | Tripulación, signos, tendencias, hallazgos, voz, chat IA, ambiente, radiación, DTN, alertas, fuentes | ✅ |
| 9 | Reloj virtual | Esfera con signos, anillo de estado, pulsar-para-hablar, vúmetro en dB, notificaciones, SOS | ✅ |
| 10 | Consola de Tierra | Resúmenes/alertas/voz recibidos por DTN con latencia, envío de mensajes ↑ | ✅ |
| 11 | Pruebas | `tests/test_e2e.py`: 8 escenarios, voz, uplink, downlink, pérdida de señal, CSV | ✅ pasa |

## 4. Qué es real y qué es simulado (decirlo así ante el jurado)

- **Real**: telemetría ambiental de la ISS (ppCO2, ppO2, presión, temperatura, esclusa) vía ISS Live; dosis de
  radiación medida por dosímetros de la ISS (RadLab; por defecto se reproduce la tormenta Gannon de mayo 2024);
  protones solares GOES en tiempo real; metadatos de estudios humanos OSDR; el protocolo DTN/BSP del framework.
- **Simulado**: las señales fisiológicas del reloj (no existe un API público con signos vitales de astronautas;
  los datos médicos individuales del LSDA/NLSP requieren solicitud formal). El modelo usa magnitudes de los
  technical briefs de OCHMO y del EMU (290 W promedio, 580 W máx.).
- **Tu voz es real**: el micrófono del navegador graba y la estación la analiza de verdad.

## 5. Guion de demo (5 minutos)

1. **Panel de la estación** (`/`): 4 astronautas en NOMINAL; mostrar fuentes LIVE (ISS Live, GOES) y el enlace DTN con estaciones terrenas en contacto.
2. **Reloj** (`/watch`): un integrante habla: *“Me siento muy cansado, casi no dormí y me duele la cabeza”*. Se ve el vúmetro en dB; la estación devuelve fatiga/estrés/ánimo y Dr. Vita responde en voz alta citando el riesgo NASA (CO2 / sueño).
3. **Escenario EVA + falla de CO2** en CM-04 → alerta crítica en el reloj (vibración) y en el panel, con evidencia y acción.
4. **Forzar pérdida de señal** → la IA sigue diagnosticando a bordo; los bundles se quedan en custodia. Restablecer señal → la consola de Tierra recibe todo con su latencia.
5. **Perfil Marte** (10 min de retardo de luz): explicar por qué la IA debe estar a bordo.
6. **Tormenta solar**: protones GOES → riesgo de radiación → “refugiarse en módulo blindado”.
7. Cierre: arquitectura y mapa a los 30 riesgos del HSRB; próximo paso, el reloj físico (ESP32-S3 + MAX30102 + MAX30205 + IMU + micrófono I2S).

## 6. Reparto sugerido del equipo

- **Backend/IA**: `station/` (reglas, voz, Ollama, conectores NASA).
- **Frontend**: `web/` (panel, reloj, Tierra) y guion visual.
- **Redes/DTN**: `dtn-framework/` + `station/dtn_link.py`, modo `--full` con globo 3D.
- **Ciencia/pitch**: validar umbrales con NASA-STD-3001 y los boletines OCHMO, slides y video.

## 7. Siguientes pasos (si sobra tiempo)

1. Instalar Ollama (`ollama pull llama3.2:3b` o `qwen2.5:7b`) para respuestas generativas.
2. `pip install faster-whisper` para transcripción 100 % local (sin el dictado del navegador).
3. Firmware real en ESP32-S3 que haga POST a `/api/ingest` con el mismo formato JSON (ver README).
4. Validar el modelo de anomalías con datasets abiertos (PhysioNet MIT-BIH para arritmias, PPG-DaLiA para PPG en muñeca).
5. Ajustar umbrales finales contra NASA-STD-3001 Vol. 1/2 (están centralizados en `station/config.py`).
