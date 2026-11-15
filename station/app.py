"""Servidor de la estación SANBOSI (Starlette/ASGI).

  python -m station.app            -> http://localhost:8700  (panel de la estación)
                                      http://localhost:8700/watch  (reloj virtual con micrófono)
                                      http://localhost:8700/earth  (consola de Tierra / cirujano de vuelo)
"""
import asyncio
import csv
import io
import json
import time
from contextlib import asynccontextmanager

from starlette.applications import Starlette
from starlette.middleware import Middleware
from starlette.requests import Request
from starlette.responses import FileResponse, JSONResponse, Response, StreamingResponse
from starlette.routing import Mount, Route
from starlette.staticfiles import StaticFiles

from . import ai, config
from .i18n import tr_obj
from .core import Station
from .risk_engine import KB

station = Station()


def J(obj, status=200):
    return Response(json.dumps(obj, ensure_ascii=False, default=str), status_code=status, media_type="application/json")


def crew_card(s):
    v = s.get("vitals") or {}
    return {"id": s["crew"]["id"], "name": s["crew"]["name"], "role": s["crew"]["role"], "status": s["status"],
            "score": s["score"], "scenario": s["scenario"], "watch_age_s": s["watch_age_s"],
            "vitals": {k: v.get(k) for k in ("activity", "hr", "spo2", "skin_temp", "resp_rate", "sbp", "dbp", "rmssd",
                                             "irregularity", "battery", "hydration", "suit", "steps", "sleep_h", "quality")},
            "baseline": s["crew"]["baseline"],
            "top": s["findings"][:3], "water": station.watch_counters.get(s["crew"]["id"], {}).get("water", 0), "voice": (s.get("voice") or {}).get("indices"), "dose_mgy": s.get("dose_mgy"), "dose_msv": s.get("dose_msv"),
            "device": s.get("device")}


def overview():
    any_s = next(iter(station.state.values()))
    return {"ts": time.time(), "crew": [crew_card(s) for s in station.state.values() if "crew" in s],
            "env": any_s.get("env"), "rad": any_s.get("rad"), "dtn": station.dtn.status(),
            "alerts": list(station.store.alerts)[:25], "events": list(station.store.events)[:25],
            "ai": ai.status(), "watch_link_down": station.watch_link_down,
            "mission": {"product": config.PRODUCT, "day": config.MISSION_DAY, "surgeon": config.FLIGHT_SURGEON},
            "open_alerts": sum(1 for a in station.store.alerts if a.get("estado") == "abierta")}


# ---------------------------------------------------------------- páginas
async def index(request):
    return FileResponse(config.WEB_DIR / "index.html")


async def watch_page(request):
    return FileResponse(config.WEB_DIR / "watch.html")


async def earth_page(request):
    return FileResponse(config.WEB_DIR / "earth.html")


# ---------------------------------------------------------------- API reloj
async def api_crew(request):
    return J({"crew": config.CREW})


async def api_ingest(request):
    return J(station.ingest(await request.json()))


async def api_watch_commands(request):
    hyd = dict(station.hydration_cmds)
    for k in station.hydration_cmds:
        station.hydration_cmds[k] = 0
    return J({"scenarios": station.scenarios, "watch_link_down": station.watch_link_down, "water": hyd})


async def api_watch_action(request):
    return J(station.watch_action(request.path_params["crew_id"], await request.json()))


async def api_watch_view(request):
    """Todo lo que necesita la interfaz del reloj en una sola llamada."""
    cid = request.path_params["crew_id"]
    if cid not in config.CREW_BY_ID:
        return J({"error": "no existe"}, 404)
    s = station.state[cid]
    since = float(request.query_params.get("since", 0))
    voice = [v for v in station.store.voice if v["crew_id"] == cid][:6]
    chat = [m for m in station.store.chat if m["crew_id"] in (cid, "ALL")][-12:]
    dev = station.store.device.get(cid) or {}
    return J({"card": crew_card(s) if "crew" in s else None, "findings": s.get("findings", []),
              "rad": s.get("rad"), "env": s.get("env"), "dtn": station.dtn.status(),
              "mission": {"day": config.MISSION_DAY, "surgeon": config.FLIGHT_SURGEON},
              "voice": voice, "chat": chat, "reports": station.reports.get(cid, [])[-5:],
              "actions": station.watch_actions.get(cid, [])[-30:], "counters": station.watch_counters.get(cid),
              "feed": [m for m in station.watch_feed.get(cid, []) if m["ts"] > since],
              "series": [[p["ts"], p.get("hr")] for p in list(station.store.series[cid])[-60:]],
              "last_rx": dev.get("rx"), "buffered": dev.get("buffered", 0), "week": station.week_history(cid)})


async def api_watch_feed(request):
    cid = request.path_params["crew_id"]
    since = float(request.query_params.get("since", 0))
    s = station.state.get(cid, {})
    return J({"feed": [m for m in station.watch_feed.get(cid, []) if m["ts"] > since],
              "card": crew_card(s) if "crew" in s else None})


async def api_watch_link(request):
    station.watch_link_down = bool((await request.json()).get("down"))
    station.store.event("watch", "Enlace reloj→estación " + ("CORTADO (simulación)" if station.watch_link_down else "restablecido"))
    return J({"ok": True, "watch_link_down": station.watch_link_down})


# ---------------------------------------------------------------- API estación
async def api_state(request):
    return J(overview())


async def api_stream(request):
    async def gen():
        while True:
            if await request.is_disconnected():
                break
            yield "data: " + json.dumps(overview(), ensure_ascii=False, default=str) + "\n\n"
            await asyncio.sleep(1.0)
    return StreamingResponse(gen(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


async def api_crew_detail(request):
    cid = request.path_params["crew_id"]
    if cid not in config.CREW_BY_ID:
        return J({"error": "no existe"}, 404)
    s = station.state[cid]
    return J({"card": crew_card(s), "findings": s["findings"], "zscores": s.get("zscores"),
              "baseline": station.baselines[cid].mean, "series": list(station.store.series[cid])[-240:],
              "raw_last": station.store.latest(cid),
              "voice": [v for v in station.store.voice if v["crew_id"] == cid][:10],
              "voice_baseline": station.voice_base.base[cid],
              "chat": [m for m in station.store.chat if m["crew_id"] in (cid, "ALL")][-40:],
              "reports": station.reports.get(cid, [])[-10:],
              "watch_actions": station.watch_actions.get(cid, [])[-30:], "watch_counters": station.watch_counters.get(cid),
              "alerts": [a for a in station.store.alerts if a["crew_id"] == cid][:20]})


async def api_scenario(request):
    b = await request.json()
    return J(station.set_scenario(b.get("crew_id", "ALL"), b.get("scenario", "nominal")))


async def api_voice(request):
    cid = request.path_params["crew_id"]
    if cid not in config.CREW_BY_ID:
        return J({"error": "no existe"}, 404)
    wav = await request.body()
    q = request.query_params
    try:
        res = await asyncio.to_thread(station.process_voice, cid, wav, q.get("transcript", ""), q.get("calibrate") == "1", q.get("ask", "1") != "0", q.get("lang", "es"), q.get("log", "1") != "0")
        return J(res)
    except Exception as e:
        return J({"error": str(e)}, 400)


async def api_chat(request):
    cid = request.path_params["crew_id"]
    b = await request.json()
    src = "voz" if b.get("source") == "voz" else "texto"      # voz: el reloj ya manda el audio aparte (síntomas y análisis van por /api/voice)
    return J(await asyncio.to_thread(station.chat, cid, b.get("text", ""), src, request.query_params.get("lang", b.get("lang", "es"))))


async def api_dtn(request):
    b = await request.json()
    if "blackout" in b:
        station.dtn.blackout = bool(b["blackout"])
        station.store.event("dtn", "Pérdida de señal forzada (LOS)" if station.dtn.blackout else "Señal restablecida (AOS)")
    if b.get("destination") in config.LIGHT_DELAY:
        station.dtn.destination = b["destination"]
        station.store.event("dtn", f"Perfil de misión: {b['destination']} (retardo luz {config.LIGHT_DELAY[b['destination']]} s)")
    return J(station.dtn.status())


async def api_earth_inbox(request):
    return J({"inbox": station.dtn.earth_view(), "dtn": station.dtn.status(), "sent_up": station.dtn.stats["bundles_up"]})


async def api_earth_send(request):
    b = await request.json()
    bid = station.dtn.send_up(b.get("text", ""), b.get("crew_id"), b.get("from", "Flight Surgeon"))
    return J({"ok": bool(bid), "bundle_id": bid})


def _short(e):
    if not e:
        return None
    e = str(e)
    if "403" in e or "ProxyError" in e or "Max retries" in e:
        return "Sin acceso de red al host (bloqueado o sin internet): usando caché/simulación"
    return e[:160]


async def api_sources(request):
    env, rad = station.iss.snapshot(), station.rad.snapshot()
    return J({"sources": [
        {"name": "ISS Live! (NASA JSC Lightstreamer)", "url": config.LIGHTSTREAMER_URL + " · " + config.LIGHTSTREAMER_ADAPTER,
         "status": env["source"], "error": _short(env.get("error")), "data": env["values"]},
        {"name": "NASA OSDR RadLab API (dosímetros ISS)", "url": config.RADLAB_URLS[0], "status": rad["source"],
         "error": _short(rad.get("radlab_error")), "data": rad.get("radlab_meta")},
        {"name": "NOAA SWPC GOES protones ≥10 MeV", "url": config.GOES_PROTONS_URL, "status": rad["goes_source"],
         "error": _short(rad.get("goes_error")), "data": {"pfu": rad["goes_10mev_pfu"], "time": rad["goes_time"]}},
        {"name": "NASA OSDR – estudios Inspiration4", "url": "https://osdr.nasa.gov", "status": station.osdr.studies[0]["source"],
         "error": _short(station.osdr.error), "data": station.osdr.snapshot()["studies"]},
        {"name": "DTN – framework iss-simulator (arXiv:2605.21624)", "url": "https://github.com/kritgrover/iss-simulator",
         "status": station.dtn.mode.upper(), "error": _short(station.dtn.error), "data": station.dtn.status()},
        {"name": "IA local (Ollama)", "url": config.OLLAMA_URL, "status": "LIVE" if ai.status()["ollama"] else "FALLBACK",
         "error": None, "data": ai.status()},
    ]})


LABS = json.loads((config.STATION_DIR / "knowledge" / "inspiration4_labs.json").read_text(encoding="utf-8"))


async def api_labs(request):
    """Exámenes de sangre reales de Inspiration4 (NASA OSDR OSD-569/575) pareados con cada tripulante del demo."""
    c = LABS["crew"].get(request.path_params["crew_id"])
    if not c:
        return J({"error": "sin exámenes para este tripulante"}, 404)
    return J({**c, "source": LABS["source"]})


async def api_version(request):
    return J({"version": config.VERSION, "product": config.PRODUCT})


async def api_knowledge(request):
    return J(KB)


async def api_export(request):
    cid = request.path_params["crew_id"]
    rows = station.store.history(cid, 24 * 3600)
    buf = io.StringIO()
    keys = ["ts", "activity", "hr", "spo2", "skin_temp", "resp_rate", "sbp", "dbp", "rmssd", "accel_g", "score", "dose"]
    w = csv.DictWriter(buf, fieldnames=keys, extrasaction="ignore")
    w.writeheader()
    for r in rows:
        w.writerow(r)
    return Response(buf.getvalue(), media_type="text/csv",
                    headers={"Content-Disposition": f"attachment; filename=sanbosi_{cid}.csv"})


# ---------------------------------------------------------------- contrato API del equipo (Backend ⇄ Frontend)
METRIC_KEYS = {"FC": "hr", "SPO2": "spo2", "TEMP": "skin_temp", "FR": "resp_rate", "PAS": "sbp", "PAD": "dbp",
               "VFC": "rmssd", "RMSSD": "rmssd", "SCORE": "score", "DOSIS": "dose"}


async def t_list(request):
    return J([{"id": c["id"], "nombre": c["name"], "rol": c["role"], "estado": c["status"], "puntaje": c["score"]}
              for c in overview()["crew"]])


async def t_resumen(request):
    cid = request.path_params["id"]
    if cid not in config.CREW_BY_ID:
        return J({"error": "no existe"}, 404)
    s = station.state[cid]
    v = s.get("vitals") or {}
    z = s.get("zscores") or {}
    return J({"tripulante": cid, "estado": s["status"], "puntaje": s["score"],
              "metricas": {k: {"valor": v.get(m), "z": z.get(m)} for k, m in METRIC_KEYS.items() if m in v},
              "cambios": s["findings"]})


async def t_metricas(request):
    cid, cod = request.path_params["id"], request.path_params["codigo"].upper()
    key = METRIC_KEYS.get(cod)
    if cid not in config.CREW_BY_ID or not key:
        return J({"error": "tripulante o métrica desconocidos", "metricas": list(METRIC_KEYS)}, 404)
    q = request.query_params
    desde = float(q.get("desde", time.time() - 3600))
    hasta = float(q.get("hasta", time.time()))
    rows = [r for r in list(station.store.series[cid]) if desde <= r["ts"] <= hasta]
    return J({"tripulante": cid, "metrica": cod, "serie": [[r["ts"], r.get(key)] for r in rows]})


async def t_linea_base(request):
    cid = request.path_params["id"]
    if cid not in config.CREW_BY_ID:
        return J({"error": "no existe"}, 404)
    return J({"tripulante": cid, "fisiologica": station.baselines[cid].mean, "voz": station.voice_base.base[cid],
              "referencia": config.CREW_BY_ID[cid]["baseline"]})


async def alertas(request):
    if request.method == "PATCH":
        b = await request.json()
        a = station.review_alert(request.path_params["id"], b.get("estado", "revisada"))
        return J(a or {"error": "no existe"}, 200 if a else 404)
    return J(list(station.store.alerts))


async def autorreportes(request):
    return J(station.self_report(await request.json()))


async def ingesta_lote(request):
    return J(station.ingest(await request.json()))


@asynccontextmanager
async def lifespan(app):
    station.start()
    yield


routes = [
    Route("/", index), Route("/watch", watch_page), Route("/earth", earth_page),
    Route("/api/crew", api_crew), Route("/api/ingest", api_ingest, methods=["POST"]),
    Route("/api/watch/commands", api_watch_commands), Route("/api/watch/link", api_watch_link, methods=["POST"]),
    Route("/api/watch/{crew_id}/feed", api_watch_feed),
    Route("/api/watch/{crew_id}/view", api_watch_view), Route("/api/watch/{crew_id}/action", api_watch_action, methods=["POST"]),
    Route("/api/state", api_state), Route("/api/stream", api_stream),
    Route("/api/crew/{crew_id}", api_crew_detail), Route("/api/scenario", api_scenario, methods=["POST"]),
    Route("/api/voice/{crew_id}", api_voice, methods=["POST"]), Route("/api/chat/{crew_id}", api_chat, methods=["POST"]),
    Route("/api/dtn", api_dtn, methods=["POST"]),
    Route("/api/earth/inbox", api_earth_inbox), Route("/api/earth/send", api_earth_send, methods=["POST"]),
    Route("/api/version", api_version), Route("/api/labs/{crew_id}", api_labs), Route("/api/sources", api_sources), Route("/api/knowledge", api_knowledge),
    Route("/api/export/{crew_id}.csv", api_export),
    Route("/tripulantes", t_list), Route("/tripulantes/{id}/resumen", t_resumen),
    Route("/tripulantes/{id}/metricas/{codigo}", t_metricas), Route("/tripulantes/{id}/linea-base", t_linea_base),
    Route("/alertas", alertas), Route("/alertas/{id}", alertas, methods=["GET", "PATCH"]),
    Route("/autorreportes", autorreportes, methods=["POST"]), Route("/ingesta/lote", ingesta_lote, methods=["POST"]),
    Mount("/static", StaticFiles(directory=str(config.WEB_DIR)), name="static"),
]


class Translate:
    """Si la petición trae ?lang=en, traduce los textos visibles de las respuestas JSON y del stream SSE."""
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or b"lang=en" not in scope.get("query_string", b""):
            return await self.app(scope, receive, send)
        state = {"kind": None, "start": None, "buf": b""}

        async def _send(msg):
            if msg["type"] == "http.response.start":
                ct = dict((k.lower(), v) for k, v in msg.get("headers", [])).get(b"content-type", b"")
                state["kind"] = "json" if b"json" in ct else "sse" if b"event-stream" in ct else None
                if state["kind"] == "json":
                    state["start"] = msg
                    return
                return await send(msg)
            if msg["type"] == "http.response.body":
                if state["kind"] == "json":
                    state["buf"] += msg.get("body", b"")
                    if msg.get("more_body"):
                        return
                    try:
                        body = json.dumps(tr_obj(json.loads(state["buf"]), "en"), ensure_ascii=False, default=str).encode()
                    except Exception:
                        body = state["buf"]
                    start = state["start"]
                    start["headers"] = [(k, v) for k, v in start.get("headers", []) if k.lower() != b"content-length"] + [(b"content-length", str(len(body)).encode())]
                    await send(start)
                    return await send({"type": "http.response.body", "body": body})
                if state["kind"] == "sse":
                    chunk = msg.get("body", b"")
                    if chunk.startswith(b"data: "):
                        try:
                            chunk = b"data: " + json.dumps(tr_obj(json.loads(chunk[6:].decode()), "en"), ensure_ascii=False, default=str).encode() + b"\n\n"
                        except Exception:
                            pass
                    return await send({**msg, "body": chunk})
            await send(msg)
        await self.app(scope, receive, _send)


class NoCache:
    """Evita que el navegador use una versión vieja del reloj o del panel tras actualizar archivos (ASGI puro)."""
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        path = scope.get("path", "")
        nocache = path.startswith("/static") or path in ("/", "/watch", "/earth")

        async def _send(msg):
            if nocache and msg["type"] == "http.response.start":
                msg["headers"] = [h for h in msg.get("headers", []) if h[0].lower() != b"cache-control"] + [(b"cache-control", b"no-store")]
            await send(msg)
        await self.app(scope, receive, _send)


app = Starlette(routes=routes, lifespan=lifespan, middleware=[Middleware(NoCache), Middleware(Translate)])

if __name__ == "__main__":
    import uvicorn
    print(f"🛰️  SANBOSI · estación en http://localhost:{config.PORT}  (reloj: /watch · Tierra: /earth)")
    uvicorn.run(app, host=config.HOST, port=config.PORT, log_level="warning")
