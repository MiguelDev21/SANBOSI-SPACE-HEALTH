#!/usr/bin/env python3
"""Prueba del contrato del equipo: formato de mensaje del hardware y endpoints Backend ⇄ Frontend.
Requiere la estación corriendo:  python tests/test_contrato.py [http://localhost:8700]"""
import json, sys, time, urllib.request
B = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8700"
def req(m, p, b=None):
    r = urllib.request.Request(B + p, data=json.dumps(b).encode() if b is not None else None, method=m, headers={"Content-Type": "application/json"})
    return json.loads(urllib.request.urlopen(r, timeout=20).read())
t = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time() + 5))
lote = [{"dispositivo": "band-01", "tripulante": "CM-02", "t": t, "metrica": k, "valor": v, "calidad": 0.93}
        for k, v in (("FC", 72), ("SPO2", 97), ("TEMP", 33.5), ("FR", 14))]
r = req("POST", "/ingesta/lote", lote); assert r["ok"] and r["accepted"].get("CM-02") == 1, r
ts = req("GET", "/tripulantes"); assert len(ts) == 4 and {"id", "nombre", "estado"} <= set(ts[0]), ts
rs = req("GET", "/tripulantes/CM-02/resumen"); assert "metricas" in rs and "estado" in rs, rs
ms = req("GET", "/tripulantes/CM-01/metricas/FC"); assert ms["metrica"] == "FC", ms
lb = req("GET", "/tripulantes/CM-01/linea-base"); assert "fisiologica" in lb and "voz" in lb, lb
ar = req("POST", "/autorreportes", {"tripulante": "CM-01", "sintomas": "dolor de cabeza", "animo": "Estresada", "sueno": "Mal"}); assert ar["ok"], ar
req("POST", "/api/scenario", {"crew_id": "CM-03", "scenario": "hypoxia"})
for _ in range(90):
    al = req("GET", "/alertas")
    if any(a["crew_id"] == "CM-03" for a in al): break
    time.sleep(1)
a = next(a for a in al if a["crew_id"] == "CM-03")
p = req("PATCH", f"/alertas/{a['id']}", {"estado": "revisada"}); assert p["estado"] == "revisada", p
req("POST", "/api/scenario", {"crew_id": "ALL", "scenario": "nominal"})
print("✅ CONTRATO OK · ingesta formato equipo, /tripulantes, resumen, métricas, línea base, autorreportes, alertas (GET/PATCH)")
