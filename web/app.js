// SANBOSI · panel único de la estación: Monitoreo (Tripulación · cada astronauta en 3D · Tierra), Alertas, Estación y datos.
const {$, $$, esc, fmt} = AV;
const t = s => AV.t(s);
const S = {labs: {}, view: "monitor", pick: "crew", sel: null, ov: null, detail: null, alertSel: null, lastChat: 0, radHist: [], point: "corazon", layer: "mitad", body: null, earth: null};
const TITLES = {monitor: "Monitoreo", alertas: "Alertas", estacion: "Estación y datos"};
// avatares del diseño del equipo (canvas "Panel — Astronauta en 3D")
const FACES = {
  "CM-01": {bg1: "#3A2F5E", bg2: "#16122A", piel: "#C98D69", sombra: "#9E6447", labio: "#A85A4E", pelo: "#2A1A12", brillo: "#5A3A28", iris: "#3B2416", atras: "M17 29c0-11 6-18 15-18s15 7 15 18c0 7 1 13 3 18H14c2-5 3-11 3-18z", frente: "M20 26c0-8 5-14 12-14s12 5 12 12c-4-2-7-5-9-8-2 4-7 8-15 10z", barba: ""},
  "CM-02": {bg1: "#1C3A4D", bg2: "#0B1820", piel: "#8A5636", sombra: "#64391F", labio: "#6E3A2C", pelo: "#17100D", brillo: "#3A2A22", iris: "#2A1A10", atras: "", frente: "M20.5 24c0-7 5-12 11.5-12s11.5 5 11.5 12c-1.5-2.5-3-3.5-4.5-3.8-2-1.6-4.3-2.2-7-2.2s-5 .6-7 2.2c-1.5.3-3 1.3-4.5 3.8z", barba: "M21.5 31c.5 6 4.5 11 10.5 11s10-5 10.5-11c-1.2 2.3-2.6 3.6-4 4.1-1.8-1-4-1.4-6.5-1.4s-4.7.4-6.5 1.4c-1.4-.5-2.8-1.8-4-4.1z"},
  "CM-03": {bg1: "#1F4A33", bg2: "#0B1A12", piel: "#F0C6A6", sombra: "#CF9B7A", labio: "#C9776B", pelo: "#B88A52", brillo: "#E2BE84", iris: "#4A6A7A", atras: "M26 9.5a6 5.5 0 1 0 12 0a6 5.5 0 1 0 -12 0z", frente: "M20 27c-.5-9 5-15 12-15s12.5 6 12 15c-1.6-4-4.2-7-7.5-8.4-1.4 1.2-2.9 2-4.5 2.2-1.6-.2-3.1-1-4.5-2.2-3.3 1.4-5.9 4.4-7.5 8.4z", barba: ""},
  "CM-04": {bg1: "#4A2622", bg2: "#1A0D0B", piel: "#E2B48D", sombra: "#BF8C66", labio: "#B87264", pelo: "#0E0E11", brillo: "#34343C", iris: "#24160F", atras: "", frente: "M20.5 23c.5-7 5.5-11 11.5-11 6.5 0 11 4 11.5 10.5-2.5-2-5.5-3.2-9-3.5-3 1.2-6 2-9.5 2-2 .4-3.5 1.1-4.5 2z", barba: ""}};
function face(id, size = 44) {
  const c = FACES[id] || FACES["CM-01"], k = id.replace(/\W/g, "") + size;
  return `<svg width="${size}" height="${size}" viewBox="0 0 64 64" aria-hidden="true" style="flex-shrink:0;border-radius:50%"><defs><radialGradient id="fb${k}" cx=".5" cy=".3" r=".8"><stop offset="0" stop-color="${c.bg1}"/><stop offset="1" stop-color="${c.bg2}"/></radialGradient><linearGradient id="fs${k}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c.piel}"/><stop offset="1" stop-color="${c.sombra}"/></linearGradient><linearGradient id="fh${k}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c.brillo}"/><stop offset=".5" stop-color="${c.pelo}"/></linearGradient><linearGradient id="ft${k}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F7F6F4"/><stop offset="1" stop-color="#BDB9B4"/></linearGradient></defs><circle cx="32" cy="32" r="32" fill="url(#fb${k})"/><path d="${c.atras}" fill="url(#fh${k})"/><path d="M6 64c1-11 10-18 26-18s25 7 26 18z" fill="url(#ft${k})"/><path d="M20 49c3 3.5 7 5 12 5s9-1.5 12-5" fill="none" stroke="#5B82F0" stroke-width="2.2"/><circle cx="44" cy="57" r="2.6" fill="#4F7BFF" opacity=".85"/><path d="M27 37c0 5-1 8-3 10 2 2 5 3 8 3s6-1 8-3c-2-2-3-5-3-10z" fill="url(#fs${k})"/><ellipse cx="20.6" cy="29" rx="2.2" ry="3.4" fill="${c.sombra}"/><ellipse cx="43.4" cy="29" rx="2.2" ry="3.4" fill="${c.sombra}"/><path d="M32 13c-7 0-12 5-12 13 0 5 1 9 3 12 2 4 6 7 9 7s7-3 9-7c2-3 3-7 3-12 0-8-5-13-12-13z" fill="url(#fs${k})"/><path d="${c.barba}" fill="url(#fh${k})"/><path d="${c.frente}" fill="url(#fh${k})"/><path d="M25.4 25.4c1.5-.9 3.3-1 4.7-.4M38.6 25.4c-1.5-.9-3.3-1-4.7-.4" fill="none" stroke="${c.pelo}" stroke-width="1.1" stroke-linecap="round"/><ellipse cx="27.8" cy="28.5" rx="1.95" ry="1.15" fill="#F4EFEA"/><ellipse cx="36.2" cy="28.5" rx="1.95" ry="1.15" fill="#F4EFEA"/><circle cx="27.9" cy="28.5" r=".95" fill="${c.iris}"/><circle cx="36.1" cy="28.5" r=".95" fill="${c.iris}"/><path d="M32.3 29.2v4.6c0 .7-.8 1.1-1.9.9" fill="none" stroke="${c.sombra}" stroke-width=".9" stroke-linecap="round"/><path d="M29.4 37.6c.9-.5 1.8-.4 2.6 0 .8-.4 1.7-.5 2.6 0-.9.9-1.7 1.3-2.6 1.3s-1.7-.4-2.6-1.3z" fill="${c.labio}"/></svg>`;
}
$$("[data-i]").forEach(el => el.outerHTML = AV.icon[el.dataset.i] || "");
AV.tr(document.body); { const vt = document.getElementById("vtext"); if (vt) vt.textContent = AV.t(vt.textContent); }

// Actualiza el DOM solo si cambió (sin parpadeo) y traduce si el panel está en inglés
function setH(el, html) { if (typeof el === "string") el = $(el); if (el && el.__h !== html) { el.innerHTML = html; el.__h = html; AV.tr(el); } }
function setT(sel, txt) { const el = $(sel); const v = t(txt); if (el && el.textContent !== v) el.textContent = v; }
function voiceWord(ix) { if (!ix) return ["Sin charla", "var(--muted)"]; if (ix.fatigue >= 65) return ["Más apagada", "var(--warn)"]; if (ix.stress >= 65) return ["Más tensa", "var(--warn)"]; if (ix.mood <= 30) return ["Ánimo bajo", "var(--warn)"]; return ["Habitual", "var(--text)"]; }
const STC = {"Normal": "#8FD9A8", "Observación": "#9AB8FF", "Atención": "#F2C27B", "Crítica": "#FF8A7A", "Revisar sensor": "#A8A29E", "SIN DATOS": "#A8A29E"};

// ------------------------------------------------------------------ navegación
function route() {
  const h = (location.hash || "#monitor").slice(1);
  S.view = TITLES[h] ? h : "monitor";
  $$(".view").forEach(v => v.classList.toggle("on", v.id === "v-" + S.view));
  $$(".nav[data-v]").forEach(a => a.classList.toggle("on", a.dataset.v === S.view));
  setT("#title", TITLES[S.view]);
  if (S.ov) render();
  if (S.view === "estacion") loadSources();
}
window.addEventListener("hashchange", route);
function pick(p) {                       // "crew" | "earth" | id de astronauta
  S.pick = p; if (p !== "crew" && p !== "earth") { S.sel = p; S.lastChat = 0; }
  if (location.hash && location.hash !== "#monitor") location.hash = "#monitor"; else route();
  $$(".pane").forEach(x => x.classList.toggle("on", x.id === "p-" + (p === "crew" ? "crew" : p === "earth" ? "earth" : "astro")));
  renderPicker(); if (S.pick !== "crew" && S.pick !== "earth") { ensureBody(); loadDetail(); } if (S.pick === "earth") loadEarth();
  window.scrollTo({top: 0, behavior: "smooth"});
}
document.addEventListener("click", e => { const b = e.target.closest("[data-pick]"); if (b) pick(b.dataset.pick); });

// ------------------------------------------------------------------ cabecera + selector
function renderChips(ov) {
  const r = ov.rad || {}, d = ov.dtn, storm = r.noaa_scale && r.noaa_scale !== "S0";
  const live = [ov.env && ov.env.source, r.source, r.goes_source].some(x => (x || "").startsWith("LIVE"));
  setH("#chips", `<span class="pill lg ${storm ? "p-crit" : "p-ok"}"><span class="d"></span>${storm ? t("Tormenta solar") + " " + r.noaa_scale : t("Clima espacial tranquilo")}</span>
    <span class="pill lg ${d.contact ? "p-ok" : "p-warn"}"><span class="d"></span>${t(d.contact ? "Tierra en contacto" : "Sin señal con Tierra")}</span>
    <span class="pill lg p-gray">${t(live ? "Ambiente y radiación en vivo · fisiología simulada" : "Datos simulados")}</span>`);
  setT("#sub", `${t("Día")} ${ov.mission.day} ${t("de misión")} · ${new Date().toLocaleTimeString(AV.lang, {hour: "2-digit", minute: "2-digit", hour12: false})}`);
  $("#surgeon").textContent = ov.mission.surgeon.name;
  $("#navCnt").textContent = ov.open_alerts; $("#navCnt").style.visibility = ov.open_alerts ? "visible" : "hidden";
}
function renderPicker() {
  const ov = S.ov; if (!ov) return; const d = ov.dtn;
  setH("#picker", `<button class="pk ${S.pick === "crew" ? "on" : ""}" data-pick="crew" role="tab"><span class="pi" style="background:#1A2340;color:#8FB0FF">${AV.icon.crew}</span><span class="tx"><b>Tripulación</b><small>${ov.crew.length} ${t("astronautas")}</small></span></button>
    ${ov.crew.map(c => `<button class="pk ${S.pick === c.id ? "on" : ""}" data-pick="${c.id}" role="tab">${face(c.id, 42)}<span class="tx"><b>${esc(c.name)}</b><small>${esc(c.role)}</small></span><span class="dt" style="background:${STC[c.status] || "#A8A29E"}" title="${esc(c.status)}"></span></button>`).join("")}
    <button class="pk ${S.pick === "earth" ? "on" : ""}" data-pick="earth" role="tab"><span class="pi" style="background:#12261A;color:#8FD9A8">${AV.icon.earth}</span><span class="tx"><b>Tierra</b><small>${t(d.contact ? "En contacto" : "Sin señal")}</small></span></button>`);
}

// ------------------------------------------------------------------ tripulación
function renderCrew(ov) {
  const r = ov.rad || {};
  $("#radNow").textContent = fmt(r.dose_rate_ugy_h);
  const st = r.noaa_scale !== "S0" ? ["Tormenta solar · refugio", "c-crit"] : r.dose_rate_ugy_h > 50 ? ["Elevada (paso por la SAA)", "c-warn"] : ["Normal", "c-ok"];
  setT("#radState", st[0]); $("#radState").className = st[1];
  AV.chart($("#radSpark"), [{label: "", color: AV.css("--rad"), data: S.radHist}], {height: 70});
  setT("#radNote", `${t(r.source === "LIVE" ? "Dosímetro DosTel real (RadLab) reproducido" : "Modelo de dosis")} · GOES ${fmt(r.goes_10mev_pfu, 1)} pfu`);
  const open = ov.alerts.filter(a => a.estado === "abierta"), n = s => open.filter(a => a.severity === s).length;
  $("#openAl").textContent = open.length;
  setT("#openAlSub", `${n("critical")} ${t("críticas")} · ${n("warning")} ${t("de atención")} · ${open.filter(a => a.technical).length} ${t("técnicas")}`);
  const d = ov.dtn;
  setH("#linkBig", d.contact ? `<span class="c-ok">En contacto</span>` : `<span class="c-warn">Sin señal</span>`);
  setT("#linkSub", `${d.delivered_down} ${t("paquetes entregados")} · ${t("latencia")} ${d.avg_latency_s ?? "—"} s`);
  const talked = ov.crew.filter(c => c.voice).length, pend = ov.crew.filter(c => !c.voice).map(c => c.name.split(" ")[0]);
  $("#talks").textContent = `${talked} ${t("de")} ${ov.crew.length}`;
  setT("#talksSub", pend.length ? `${pend.join(", ")} ${t(pend.length > 1 ? "aún no hablan" : "aún no habla")}` : t("Todos hablaron hoy"));
  const box = $("#crew");
  if (box.dataset.ids !== ov.crew.map(c => c.id).join()) {
    box.innerHTML = ov.crew.map(c => `<button class="card crewcard" data-pick="${c.id}"></button>`).join("");
    box.dataset.ids = ov.crew.map(c => c.id).join();
  }
  ov.crew.forEach(c => {
    const v = c.vitals || {}, [vw, vc] = voiceWord(c.voice), top = c.top[0];
    const el = box.querySelector(`[data-pick="${c.id}"]`);
    el.classList.toggle("warn", c.status === "Atención"); el.classList.toggle("crit", c.status === "Crítica");
    setH(el, `<div style="display:flex;align-items:center;gap:12px;width:100%">${face(c.id, 46)}
        <span style="flex:1;display:flex;flex-direction:column"><span style="font-size:17px;font-weight:500">${esc(c.name)}</span><span class="muted" style="font-size:13px"><span>${esc(c.role)}</span> · <span>${AV.ACT[v.activity] || "—"}</span></span></span>${AV.pill(c.status)}</div>
      <div class="m4" style="width:100%">
        <span><span class="lbl">Radiación misión</span><span class="val num">≈ ${fmt(c.dose_msv, 1)} mSv</span></span>
        <span><span class="lbl">Pulso</span><span class="val num">${v.hr ? fmt(v.hr) + " lpm" : t("Sin datos")}</span></span>
        <span><span class="lbl">Sueño</span><span class="val num" style="color:${v.sleep_h < 6 ? "var(--warn)" : "var(--text)"}">${AV.hm(v.sleep_h)}</span></span>
        <span><span class="lbl">Voz</span><span class="val" style="color:${vc}">${vw}</span></span></div>
      <span class="lbl" style="margin-top:auto">${top ? esc(top.title) : `${t("Reloj sincronizado hace")} ${fmt(c.watch_age_s)} s`} · ${t("agua")} ${c.water || 0}/8 · ${t("Ver en 3D ›")}</span>`);
  });
}

// ------------------------------------------------------------------ astronauta: cuerpo 3D (módulo SambosiCuerpo del equipo)
const POINTS = [["mente", "Mente", "#B9A7F5"], ["voz", "Voz", "#B9A7F5"], ["oxigeno", "Oxígeno", "#8CCBF0"], ["corazon", "Corazón", "#F49B8E"],
  ["temp", "Temperatura", "#F2A65A"], ["comida", "Alimentación", "#8FD9A8"], ["rad", "Radiación", "#E8D36B"], ["sangre", "Sangre", "#E26D6D"]];
// función de cada parte del cuerpo (lo que pide el reto: cada parte muestra su FUNCIÓN y su estado de salud)
const FUNCION = {
  mente: "Regula el ánimo, el sueño y la concentración. En misiones largas, el aislamiento, el encierro y la falta de sueño aumentan el estrés.",
  voz: "Refleja cansancio y tensión: cambian el tono, las pausas y la velocidad del habla. Permite vigilar la salud mental sin cuestionarios largos.",
  oxigeno: "Los pulmones pasan oxígeno a la sangre; la saturación (SpO₂) indica cuánto llega. Una falla del soporte vital, una fuga o el CO₂ alto en la cabina pueden bajarla.",
  corazon: "Bombea la sangre a todo el cuerpo. En microgravedad los líquidos suben hacia la cabeza y el corazón trabaja distinto; al volver a la gravedad puede haber mareo al ponerse de pie.",
  temp: "Muestra si el cuerpo mantiene su calor normal. La fiebre puede indicar una infección; en el espacio las defensas se alteran y el calor se disipa peor.",
  comida: "La comida y el agua dan energía y protegen huesos y músculos. En el espacio se pierde hueso y músculo y la sed disminuye, por eso se vigilan las comidas y la hidratación.",
  rad: "No es un órgano: es la exposición del cuerpo. La radiación espacial puede dañar el ADN y aumentar el riesgo de cáncer; por eso se suma la dosis y se compara con el límite de carrera de la NASA.",
  sangre: "Transporta oxígeno, nutrientes y defensas. Los exámenes muestran la glucosa (energía), el potasio (ritmo del corazón y músculos) y los glóbulos blancos (defensas), y cómo cambiaron tras el vuelo.",
};
const LAYERS = [["mitad", "Mitad", "linear-gradient(90deg,#C9444C 50%,#8FB0FF 50%)"], ["musculos", "Músculos", "#C9444C"], ["esqueleto", "Esqueleto", "#E3D6BD"], ["organos", "Órganos", "#E28A93"], ["piel", "Piel", "#C98D69"]];
function aGLB(texto) {
  const g = JSON.parse(texto), uri = g.buffers[0].uri, bin = atob(uri.slice(uri.indexOf(",") + 1)), n = bin.length, bytes = new Uint8Array(n);
  for (let i = 0; i < n; i++) bytes[i] = bin.charCodeAt(i);
  delete g.buffers[0].uri; g.buffers[0].byteLength = n;
  const json = new TextEncoder().encode(JSON.stringify(g)), jl = Math.ceil(json.length / 4) * 4, bl = Math.ceil(n / 4) * 4, total = 28 + jl + bl;
  const buf = new ArrayBuffer(total), dv = new DataView(buf), u8 = new Uint8Array(buf);
  dv.setUint32(0, 0x46546C67, true); dv.setUint32(4, 2, true); dv.setUint32(8, total, true); dv.setUint32(12, jl, true); dv.setUint32(16, 0x4E4F534A, true);
  u8.set(json, 20); for (let j = 20 + json.length; j < 20 + jl; j++) u8[j] = 0x20;
  const o = 20 + jl; dv.setUint32(o, bl, true); dv.setUint32(o + 4, 0x004E4942, true); u8.set(bytes, o + 8);
  return buf;
}
function ensureBody() {
  setH("#layers", LAYERS.map(([id, n, c]) => `<button class="capa ${S.layer === id ? "on" : ""}" data-layer="${id}"><i style="background:${c}"></i>${n}</button>`).join(""));
  $$("#layers .capa").forEach(b => b.onclick = () => { S.layer = b.dataset.layer; if (S.body) S.body.modo(S.layer); ensureBody(); });
  if (S.body || S.bodyTried) return;
  S.bodyTried = true;
  const T = window.THREE;
  if (!T || !T.GLTFLoader || !T.OrbitControls || !window.SambosiCuerpo) { setT("#sMsg", "No se pudo cargar el modelo 3D (librería)"); return; }
  setTimeout(() => {
    try {
      S.body = window.SambosiCuerpo.crear(T, {canvas: $("#body3d"), stage: $("#stage"), url: "/static/vendor/astronauta-modelo.json", aGLB,
        modo: S.layer, punto: S.point, onEstado: e => { if (e.listo) $("#sMsg").style.display = "none"; else if (e.error) setT("#sMsg", t("No se pudo cargar el modelo 3D") + " · " + e.error); }});
      if (S.body) { S.body.punto(S.point); syncBody(); }
    } catch (err) { setT("#sMsg", "No se pudo cargar el modelo 3D · " + err.message); }
  }, 60);
}
function syncBody() {
  if (!S.body || !S.detail) return; const c = S.detail.card, v = c.vitals || {}, vi = c.voice;
  if (v.hr) S.body.bpm(v.hr);
  S.body.mente(!!(vi && (vi.stress >= 65 || vi.fatigue >= 65)) || c.status === "Atención" || c.status === "Crítica");
  if (S._skin !== c.id && S.body.piel) { S._skin = c.id; S.body.piel((FACES[c.id] || FACES["CM-01"]).piel); }
}
function sparkPts(arr) { const a = arr.filter(x => x != null && !isNaN(x)); if (a.length < 2) return ""; const lo = Math.min(...a), hi = Math.max(...a), r = (hi - lo) || 1;
  return a.map((x, i) => `${Math.round(i * 300 / (a.length - 1))},${Math.round(56 - (x - lo) / r * 46)}`).join(" "); }
function pointData(d) {
  const c = d.card, v = c.vitals || {}, b = c.baseline, ser = d.series || [], vr = d.voice || [], vl = vr[0], f = d.findings || [], cnt = d.watch_counters || {water: 0, meals: []};
  const sev = risks => { const x = f.filter(y => risks.includes(y.risk) && y.severity !== "info"); return x.some(y => y.severity === "critical") ? "Crítica" : x.some(y => y.severity === "warning") ? "Atención" : x.length ? "Observación" : "Normal"; };
  const col = k => ser.map(p => p[k]), hrs = col("hr").filter(Boolean), rep = (d.reports || []).slice(-1)[0];
  const r = S.ov.rad || {}, mission = c.dose_msv ?? S.ov.mission.day * (r.iss_msv_per_day || 0.35), lim = r.career_limit_msv || 600;
  const eqSes = (r.cumulative_msv || {})[c.id];
  const h = vl ? vl.indices.vs_habitual || {} : {};
  const pct = x => x == null ? "—" : (x > 0 ? "+" : x < 0 ? "−" : "") + Math.abs(x) + " %";
  return {
    mente: {titulo: "Mente", fuente: "Voz + diario + sueño", valor: vl ? (vl.indices.stress >= 65 ? "Tensa" : vl.indices.fatigue >= 65 ? "Cansada" : vl.indices.mood <= 30 ? "Decaída" : "Tranquila") : t("Sin charla hoy"), unidad: "",
      estado: vl ? sev(["BHP", "SLEEP", "TEAM"]) : "Sin datos", serie: vr.slice(0, 7).reverse().map(x => x.indices.mood),
      filas: [["Sueño", AV.hm(v.sleep_h)], ["Charlas con el reloj", String(vr.length)], ["Último diario", rep ? `${t(rep.sueno || "—")} · ${t(rep.animo || "—")}` : "—"]], nota: "No es un diagnóstico: se contrasta con la voz, el sueño y los demás indicadores."},
    voz: {titulo: "Voz", fuente: "Se analiza en cada charla", valor: vl ? pct(h.tono_pct) : "—", unidad: "tono vs. su habitual", estado: vl ? sev(["BHP", "SLEEP"]) : "Sin datos",
      serie: vr.slice(0, 7).reverse().map(x => x.indices.energy), filas: [["Pausas", pct(h.pausas_pct)], ["Intensidad", h.intensidad_db == null ? "—" : `${h.intensidad_db > 0 ? "+" : ""}${h.intensidad_db} dB`], ["Velocidad del habla", pct(h.velocidad_pct)], ["Energía", vl ? `${vl.indices.energy}/100` : "—"]], nota: ""},
    oxigeno: {titulo: "Oxígeno en sangre", fuente: "Reloj · sensor de pulso", valor: fmt(v.spo2), unidad: "%", estado: sev(["HYPOXIA"]), serie: col("spo2"),
      filas: [["Mínimo reciente", `${fmt(Math.min(...col("spo2").filter(Boolean)))} %`], ["Habitual", `${b.spo2} %`], ["Respiración", `${fmt(v.resp_rate)} ${t("por min")}`]], nota: ""},
    corazon: {titulo: "Corazón", fuente: "Reloj · intervalos entre latidos", valor: fmt(v.hr), unidad: "lpm", estado: sev(["CV", "OI", "EVA"]), serie: col("hr"),
      filas: [["Habitual en reposo", `${b.hr} lpm`], ["Máximo reciente", `${fmt(hrs.length ? Math.max(...hrs) : null)} lpm`], ["Presión estimada", `${fmt(v.sbp)}/${fmt(v.dbp)}`], ["Variabilidad (VFC)", `${fmt(v.rmssd)} ms`]], nota: ""},
    temp: {titulo: "Temperatura", fuente: "Reloj · sensor de contacto (piel)", valor: fmt(v.skin_temp, 1), unidad: "°C", estado: sev(["IMM"]), serie: col("skin_temp"),
      filas: [["Habitual (piel)", `${b.skin_temp} °C`], ["Diferencia", `${v.skin_temp ? (v.skin_temp - b.skin_temp > 0 ? "+" : "") + (v.skin_temp - b.skin_temp).toFixed(1) : "—"} °C`]], nota: "La piel de la muñeca está unos 3–4 °C por debajo de la temperatura central."},
    comida: {titulo: "Alimentación", fuente: "Lo que registra en el reloj", valor: `${cnt.meals.length} ${t("de")} 3`, unidad: "comidas hoy", estado: sev(["RENAL", "NUTR"]), serie: [],
      filas: [["Agua", `${cnt.water} ${t("de")} 8 ${t("vasos")}`], ["Hidratación medida", `${fmt((v.hydration || 0) * 100)} %`], ["Última comida", cnt.meals.length ? AV.time(cnt.meals[cnt.meals.length - 1].ts) : "—"]], nota: ""},
    rad: {titulo: "Radiación", fuente: r.source === "LIVE" ? "Dosímetro DosTel real (RadLab)" : "Dosímetro · modelo", valor: "≈ " + fmt(mission, 1), unidad: "mSv estimados en la misión", estado: sev(["RAD"]),
      serie: S.radHist.slice(-40).map(p => p[1]), filas: [["Ahora", `${fmt(r.dose_rate_ugy_h, 1)} µGy/h`], ["Del límite de carrera", `${fmt(mission / lim * 100, 1)} % ${t("de")} ${lim} mSv`],
        ["Dosis absorbida (sesión)", `${fmt(c.dose_mgy, 3)} mGy`], ["Dosis equivalente (sesión)", `${fmt(eqSes, 3)} mSv${r.equiv_measured ? "" : " · Q=1"}`], ["Protones GOES", `${fmt(r.goes_10mev_pfu, 1)} pfu · ${r.noaa_scale}`]], nota: `Estimado = ${S.ov.mission.day} días × ${r.iss_msv_per_day || 0.35} mSv/día (punto medio del rango NASA en la Estación, 0,2–0,5) + la dosis equivalente que midió el dosímetro. ${r.equiv_measured ? "" : "Este dosímetro no reporta dosis equivalente: se suma la absorbida con Q=1. "}Requiere calibración del dosímetro.`},
    sangre: bloodPoint(c.id)
  };
}
// exámenes de sangre reales de Inspiration4 (NASA OSDR) pareados con el tripulante
function bloodPoint(id) {
  const L = S.labs[id];
  if (!L || !L.labs) return {titulo: "Sangre", fuente: L === null ? "Cargando exámenes…" : "Exámenes de Inspiration4 (NASA OSDR)", valor: "—", unidad: "", estado: "Sin datos", serie: [], filas: [], nota: ""};
  const by = Object.fromEntries(L.labs.map(x => [x.key, x])), g = by.glucose;
  const n = x => x == null ? "—" : (Math.abs(x) >= 20 ? Math.round(x) : Math.round(x * 10) / 10);
  const fila = (k, nom) => { const x = by[k]; return x ? [nom, `${n(x.baseline_pre)} → ${n(x.r1)} ${x.unit} (${x.change_r1_pct > 0 ? "+" : ""}${x.change_r1_pct} %)${x.flag_r1 ? " ⚠" : ""}`] : [nom, "—"]; };
  const estado = L.labs.some(x => x.flag_r1) ? "Atención" : L.labs.some(x => Math.abs(x.change_r1_pct) >= 20) ? "Observación" : "Normal";
  return {titulo: "Sangre", fuente: `Exámenes reales · tripulante ${L.osdr_crew} de Inspiration4 (NASA OSDR)`, valor: n(g.r1), unidad: "mg/dL glucosa al regresar", estado,
    serie: Object.values(g.values), serieLbl: "Glucosa antes y después del vuelo (L-92 → R+194)", filas: [fila("glucose", "Glucosa"), fila("potassium", "Potasio"), fila("wbc", "Glóbulos blancos"), fila("lymph", "Linfocitos")],
    nota: "Datos reales tomados antes y después del vuelo; en órbita no hubo exámenes clínicos. El nombre del demo es ficticio."};
}
function renderBody(d) {
  const P = pointData(d), c = d.card, sel = P[S.point];
  $("#sName").textContent = c.name; setT("#sRole", `${t(c.role)} · ${t("Día")} ${S.ov.mission.day} ${t("de misión")}`);
  setH("#hotspots", POINTS.map(([id, n]) => { const col = STC[P[id].estado] || "#A8A29E", on = id === S.point;
    return `<button type="button" class="hs" data-hs="${id}" aria-label="${n}"><span class="pg" style="background:${col}"></span><span class="co" style="width:${on ? 16 : 12}px;height:${on ? 16 : 12}px;background:${col};box-shadow:0 0 0 ${on ? 4 : 0}px rgba(255,255,255,.9),0 0 14px ${col}"></span>${on ? `<span class="tg">${n}</span>` : ""}</button>`; }).join(""));
  $$("#hotspots .hs").forEach(b => b.onclick = () => selPoint(b.dataset.hs));
  setH("#ptList", POINTS.map(([id, n, tono]) => `<button class="pt ${id === S.point ? "on" : ""}" data-pt="${id}"><i style="background:${STC[P[id].estado] || "#A8A29E"}"></i><span>${n}</span><span>${esc(String(P[id].valor))} ${esc(P[id].unidad.split(" ")[0] || "")}</span></button>`).join(""));
  $$("#ptList .pt").forEach(b => b.onclick = () => selPoint(b.dataset.pt));
  const tono = POINTS.find(p => p[0] === S.point)[2], st = AV.ST[sel.estado] || ["p-gray", sel.estado];
  setH("#infoCard", `<div style="display:flex;align-items:center;gap:10px"><span style="width:12px;height:12px;border-radius:50%;background:${tono};box-shadow:0 0 10px ${tono}"></span><span style="flex:1;font-size:19px;font-weight:500">${sel.titulo}</span><span class="pill ${st[0]}">${st[1]}</span></div>
    <span class="lbl">${sel.fuente}</span>
    ${FUNCION[S.point] ? `<p class="soft" style="margin:4px 0 8px;font-size:13px;line-height:1.5">${FUNCION[S.point]}</p>` : ""}
    <span class="bigv"><b>${esc(String(sel.valor))}</b><span class="muted">${sel.unidad}</span></span>
    ${sel.serie.filter(x => x != null).length > 1 ? `<svg viewBox="0 0 300 60" preserveAspectRatio="none" style="width:100%;height:60px" role="img" aria-label="${sel.titulo}"><polyline points="${sparkPts(sel.serie)}" fill="none" stroke="${tono}" stroke-width="2.5" vector-effect="non-scaling-stroke" stroke-linecap="round"/></svg><span class="lbl">${sel.serieLbl || "Tendencia reciente"}</span>` : ""}
    <div>${sel.filas.map(([k, x]) => `<div class="frow"><span>${k}</span><span>${esc(String(x))}</span></div>`).join("")}</div>
    ${sel.nota ? `<p class="lbl" style="margin:0">${sel.nota}</p>` : ""}`);
}
function selPoint(p) { S.point = p; if (S.body) { S.body.punto(p); S.body.enfocar(p); } if (S.detail) renderBody(S.detail); }

// ------------------------------------------------------------------ astronauta: estadísticas, voz, diario, chat
function tile(k, v, u, color, base) { return `<div class="tile"><span class="lbl">${k}</span><span class="v" style="color:${color}">${v}</span><span class="b">${u}${base ? " · " + t("base") + " " + base : ""}</span></div>`; }
function pctTxt(v, unit = "%") { if (v === null || v === undefined) return "—"; return (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v) + (unit === "dB" ? " dB" : " %"); }
function renderAstronauta(d) {
  const c = d.card, v = c.vitals || {}, b = c.baseline;
  setH("#aHead", `${face(c.id, 46)}<span style="display:flex;flex-direction:column"><span style="font-size:19px;font-weight:500">${esc(c.name)}</span><span class="muted" style="font-size:13px"><span>${esc(c.role)}</span> · <span>${AV.ACT[v.activity] || "—"}</span> · <span>${t("reloj")} ${c.device ? esc(c.device.device_id) : "—"}</span></span></span>${AV.pill(c.status, true)}`);
  $("#csv").href = `/api/export/${c.id}.csv`;
  const s = v.suit;
  setH("#tiles", [
    tile("Pulso", fmt(v.hr), "lpm", "var(--hr)", b.hr), tile("Oxígeno (SpO2)", fmt(v.spo2), "%", "var(--spo2)", b.spo2),
    tile("Temperatura de piel", fmt(v.skin_temp, 1), "°C", "var(--temp)", b.skin_temp), tile("Respiración", fmt(v.resp_rate), t("por min"), "var(--resp)", b.resp),
    tile("Presión estimada", `${fmt(v.sbp)}/${fmt(v.dbp)}`, "mmHg", "var(--bp)", `${b.sbp}/${b.dbp}`), tile("Variabilidad (VFC)", fmt(v.rmssd), `ms RMSSD · ${t("irregular")} ${fmt((v.irregularity || 0) * 100)}%`, "var(--hrv)", b.rmssd),
    tile("Sueño anoche", AV.hm(v.sleep_h), "", v.sleep_h < 6 ? "var(--warn)" : "var(--text)", AV.hm(b.sleep_h)),
    s ? tile("Traje (EVA)", `${fmt(s.metabolic_w)} W`, `${fmt(s.pressure_psi, 2)} psi · CO2 ${fmt(s.ppco2_mmhg, 1)} mmHg · O2 ${fmt(s.o2_pct)}%`, "var(--warn)")
      : tile("Agua", `${d.watch_counters ? d.watch_counters.water : 0} / 8`, `${t("hidratación")} ${fmt((v.hydration || 0) * 100)}% · ${t("batería")} ${fmt(v.battery)}%`, "var(--teal)")].join(""));
  const ser = d.series, P = k => ser.map(p => [p.ts, p[k]]), band = (m, w, col) => [{from: m - w, to: m + w, color: col}];
  AV.chart($("#cHr"), [{label: t("Pulso"), color: AV.css("--hr"), data: P("hr")}, {label: t("VFC"), color: AV.css("--hrv"), data: P("rmssd"), fill: false}], {bands: band(b.hr * 1.1, 12, "#F49B8E14")});
  AV.chart($("#cSpo2"), [{label: "SpO2 %", color: AV.css("--spo2"), data: P("spo2")}], {min: 85, max: 100, bands: band(b.spo2, 1.5, "#8CCBF014"), thresholds: [{v: 94, color: AV.css("--warn"), label: "94%"}, {v: 90, color: AV.css("--crit"), label: "90%"}]});
  AV.chart($("#cTemp"), [{label: t("Temp. piel °C"), color: AV.css("--temp"), data: P("skin_temp")}], {dec: 1, bands: band(b.skin_temp, 0.5, "#F2C27B14")});
  AV.chart($("#cBp"), [{label: t("Sistólica"), color: AV.css("--bp"), data: P("sbp")}, {label: t("Diastólica"), color: "#5FAF7C", data: P("dbp"), fill: false}, {label: t("Respiración"), color: AV.css("--resp"), data: P("resp_rate"), fill: false}]);
  setT("#nf", d.findings.length ? `${d.findings.length} ${t("cambios")}` : "");
  setH("#findings", d.findings.map(f => `<div class="item"><div class="t">${AV.sev(f.severity, f.technical)}<span>${esc(f.title)}</span></div>
    <div class="e">${esc(f.evidence)}</div><div class="a"><span>Siguiente paso:</span> ${esc(f.recommendation)}</div>
    <div class="e"><span>Riesgo NASA:</span> <a href="${f.source}" target="_blank" rel="noopener">${esc(f.risk_name)}</a></div></div>`).join("")
    || `<div class="item"><div class="t c-ok">Todo dentro de su rango habitual</div><div class="e">Pulso, oxígeno, temperatura, respiración, presión, VFC y sueño cerca de su línea base personal.</div></div>`);
  // mente y voz
  const vr = d.voice[0];
  if (vr) {
    const ix = vr.indices, f = vr.features, h = ix.vs_habitual || {}, col = (x, bad) => x == null ? "var(--muted)" : (bad(x) ? "var(--warn)" : "var(--text)");
    setT("#vWhen", `${t("Última charla")} ${AV.time(vr.ts)} · ${t("base")} ${d.voice_baseline.n}/3`);
    setH("#vs", [["Tono (frecuencia)", pctTxt(h.tono_pct), col(h.tono_pct, x => Math.abs(x) > 10)], ["Intensidad", pctTxt(h.intensidad_db, "dB"), col(h.intensidad_db, x => Math.abs(x) > 3)],
      ["Pausas", pctTxt(h.pausas_pct), col(h.pausas_pct, x => x > 30)], ["Velocidad del habla", pctTxt(h.velocidad_pct), col(h.velocidad_pct, x => Math.abs(x) > 15)]]
      .map(([k, x, cc]) => `<div><span class="lbl">${k}</span><b style="color:${cc}">${x}</b></div>`).join(""));
    setH("#gauges", AV.gauge(ix.fatigue, "Fatiga", AV.css("--warn")) + AV.gauge(ix.stress, "Tensión", AV.css("--cuerpo")) + AV.gauge(ix.mood, "Ánimo", AV.css("--mente")) + AV.gauge(ix.energy, "Energía", AV.css("--ok")));
    setT("#vexpl", `${t("Lo que cambió")}: ${ix.explanations.join("; ")}.`);
    setH("#vtext", `“${esc(vr.transcript || t("sin transcripción"))}” <span class="dim">· ${fmt(f.db_mean, 1)} dBFS (≈${fmt(f.spl_est_db)} dB SPL) · F0 ${fmt(f.f0_mean)} Hz · ${fmt(f.speech_rate_syl_s, 1)} syl/s · jitter ${fmt((f.jitter || 0) * 100, 2)}% · HNR ${fmt(f.hnr_db, 1)} dB</span>`);
  } else {
    setT("#vWhen", "Sin charlas todavía");
    setH("#vs", ["Tono (frecuencia)", "Intensidad", "Pausas", "Velocidad del habla"].map(k => `<div><span class="lbl">${k}</span><b class="muted">—</b></div>`).join(""));
    setH("#gauges", ["Fatiga", "Tensión", "Ánimo", "Energía"].map(l => AV.gauge(null, l, AV.css("--dim"))).join("")); setT("#vexpl", "");
  }
  const diary = [...d.voice.map(v => ({ts: v.ts, t: `“${v.transcript || t("(sin transcripción)")}”`, k: "Charla con el reloj", user: true})),
    ...d.reports.map(r => ({ts: r.ts, t: `${t("Sueño")} ${t(r.sueno || "—")} · ${t("ánimo")} ${t(r.animo || "—")}${r.sintomas || r.nota ? " · " + (r.sintomas || r.nota) : ""}`, k: "Autorreporte", user: true})),
    ...(d.watch_actions || []).map(a => ({ts: a.ts, t: a.text, k: "En el reloj"}))].sort((a, b) => b.ts - a.ts);
  setH("#diary", diary.map(x => `<div class="item"><div class="t" style="font-size:13px"><span>${x.k}</span><span class="when">${AV.time(x.ts)}</span></div><div class="e" ${x.user ? "data-notr" : ""}>${esc(x.t)}</div></div>`).join("") || `<div class="muted">Sin entradas todavía.</div>`);
  setH("#chat", d.chat.map(m => `<div class="msg ${m.role}" ${m.role !== "ia" ? "data-notr" : ""}>${esc(m.text)}<small>${m.role === "ia" ? "SANBOSI · " + esc(m.engine || "") : m.role === "houston" ? "Houston · DTN · " + (m.latency_s ?? "") + " s" : esc(c.name.split(" ")[0]) + " · " + esc(m.source || "")} · ${AV.time(m.ts)}</small></div>`).join("") || `<div class="muted">Aún no hay conversación.</div>`);
  $("#chat").scrollTop = 1e6;
  const last = d.chat.filter(m => m.role !== "astronauta").slice(-1)[0];
  if (last && S.lastChat && last.ts > S.lastChat && S.view === "monitor" && S.pick === c.id) AV.speak(last.text, $("#tts").checked);
  S.lastChat = last ? last.ts : (S.lastChat || Date.now() / 1000);
  renderBody(d); syncBody();
}

// ------------------------------------------------------------------ Tierra (consola del cirujano de vuelo, dentro del mismo panel)
async function loadEarth() {
  if (S.pick !== "earth") return;
  const d = await AV.get("/api/earth/inbox"), s = d.dtn, inbox = d.inbox;
  setH("#eBanner", `<div><span class="lbl">Enlace con la estación</span><div class="v ${s.contact ? "c-ok" : "c-warn"}">${t(s.contact ? "En contacto" : "Sin señal")}</div></div>
    <div><span class="lbl">Nodo terrestre</span><div class="v">${esc(s.mission_control)}</div></div>
    <div><span class="lbl">Paquetes recibidos</span><div class="v num">${s.delivered_down}</div></div>
    <div><span class="lbl">Latencia media</span><div class="v num">${s.avg_latency_s ?? "—"} s</div></div>
    <div><span class="lbl">Perfil de misión</span><div class="v">${s.destination} <span class="lbl">${t("luz")} ${s.light_delay_s} s</span></div></div>
    <p class="lbl" style="max-width:440px;margin:0">Esta vista solo muestra lo que llegó a Tierra por DTN (cifrado y firmado con BSP). Si se pierde la señal, los datos quedan en custodia a bordo y llegan al recuperar el contacto.</p>`);
  const sums = inbox.filter(m => m.payload.type === "summary"), last = sums[sums.length - 1];
  if (last) {
    setT("#eSumAge", `${t("generado")} ${AV.time(last.created)} · ${t("recibido")} ${AV.time(last.arrived)} (${last.latency_s} s)`);
    setH("#eCrew", last.payload.crew.map(c => { const v = c.vitals || {};
      return `<div class="item"><div class="t">${face(c.crew_id, 30)}<span>${esc(c.name)}</span><span style="margin-left:auto">${AV.pill(c.status)}</span></div>
      <div class="e">${t("Pulso")} <b class="soft">${fmt(v.hr)}</b> · SpO2 <b class="soft">${fmt(v.spo2)}</b> · ${t("Temp")} <b class="soft">${fmt(v.skin_temp, 1)}</b> · ${t("PA")} <b class="soft">${fmt(v.sbp)}/${fmt(v.dbp)}</b></div>
      ${c.findings.slice(0, 2).map(f => `<div class="e" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">${AV.sev(f.sev)} <span>${esc(f.title)}</span></div>`).join("") || `<div class="e c-ok">Sin cambios frente a su línea base</div>`}</div>`; }).join(""));
  }
  setH("#eAlerts", inbox.filter(m => m.payload.type === "alert").reverse().map(m => { const a = m.payload.alert;
    return `<div class="item"><div class="t">${AV.sev(a.severity, a.technical)}<span>${esc(a.crew_name)}</span><span class="when">+${m.latency_s} s</span></div><div class="e" style="color:var(--text)">${esc(a.title)}</div><div class="e">${esc(a.evidence)}</div></div>`; }).join("") || `<span class="muted">Ninguna</span>`);
  setH("#eVoice", inbox.filter(m => m.payload.type === "voice").reverse().map(m => { const p = m.payload, n = (S.ov.crew.find(c => c.id === p.crew_id) || {}).name || p.crew_id;
    return `<div class="item"><div class="t"><span>${esc(n)}</span><span class="when">+${m.latency_s} s</span></div><div class="e"><span>${t("energía")} ${p.indices.energy} · ${t("tensión")} ${p.indices.stress} · ${t("ánimo")} ${p.indices.mood}</span></div><div class="e" data-notr>“${esc(p.transcript || "—")}”</div></div>`; }).join("") || `<span class="muted">Ninguno</span>`);
  setH("#eLog", inbox.slice().reverse().slice(0, 50).map(m => `<div class="item"><div class="t" style="font-size:13px"><span class="pill p-tech">${t({summary: "resumen", alert: "alerta", voice: "voz"}[m.payload.type] || m.payload.type)}</span><span class="dim">${m.bundle_id.slice(0, 8)}</span><span class="when">${AV.time(m.arrived)} · ${m.latency_s} s</span></div></div>`).join(""));
  const to = $("#eTo"); if (to.options.length === 1) { to.innerHTML += S.ov.crew.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join(""); AV.tr(to); }
}

// ------------------------------------------------------------------ alertas
function renderAlertas(ov) {
  const al = ov.alerts;
  setT("#alSub", `${ov.open_alerts} ${t("abiertas · cambios importantes, sensores y datos faltantes")}`);
  if (!S.alertSel && al.length) S.alertSel = al[0].id;
  setH("#alist", al.map(a => `<button class="aitem ${a.id === S.alertSel ? "sel" : ""}" data-id="${a.id}">
     <span style="display:flex;gap:8px;align-items:center">${a.estado === "revisada" ? `<span class="pill p-ok">Revisada</span>` : AV.sev(a.severity, a.technical)}<span class="lbl" style="margin-left:auto">${AV.time(a.ts)}</span></span>
     <span style="font-size:15px;font-weight:400">${esc(a.title)}</span><span class="lbl">${esc(a.crew_name)}</span></button>`).join("") || `<div class="muted">Sin alertas. Prueba un escenario en “Estación y datos”.</div>`);
  $$(".aitem").forEach(b => b.onclick = () => { S.alertSel = b.dataset.id; renderAlertas(S.ov); });
  const a = al.find(x => x.id === S.alertSel);
  setH("#adet", a ? `<div style="display:flex;flex-direction:column;gap:12px">
     <div>${a.estado === "revisada" ? `<span class="pill p-ok lg">Revisada</span>` : AV.sev(a.severity, a.technical)}</div>
     <h2 style="margin:0;font-size:24px;font-weight:500">${esc(a.title)}</h2>
     <span class="muted">${esc(a.crew_name)} · ${new Date(a.ts * 1000).toLocaleString(AV.lang, {hour12: false})}</span>
     <p class="soft" style="margin:0;font-size:15px;line-height:1.5">${esc(a.evidence)}</p>
     <div class="item"><span class="lbl">Siguiente paso sugerido</span><div style="font-size:15px;margin-top:4px">${esc(a.recommendation)}</div></div>
     <span class="lbl"><span>Riesgo NASA asociado:</span> <a href="${a.source}" target="_blank" rel="noopener">${esc(a.risk_name)}</a></span>
     <p class="lbl" style="margin:0">Las recomendaciones médicas deben seguir los protocolos validados de la misión.</p>
     <div style="display:flex;gap:8px;flex-wrap:wrap">${a.estado === "abierta" ? `<button class="btn primary" id="rev">Marcar como revisada</button>` : `<span class="pill p-ok lg">✓ Revisada</span>`}
     <button class="btn" data-pick="${a.crew_id}"><span>Ver en 3D</span></button></div></div>` : `<span class="muted">Selecciona una alerta.</span>`);
  if ($("#rev")) $("#rev").onclick = async () => { await fetch(`/alertas/${a.id}`, {method: "PATCH", headers: {"Content-Type": "application/json"}, body: JSON.stringify({estado: "revisada"})}); a.estado = "revisada"; renderAlertas(S.ov); };
}

// ------------------------------------------------------------------ estación y datos
function renderEstacion(ov) {
  const e = ov.env || {}, v = e.values || {}, r = ov.rad || {}, d = ov.dtn;
  setH("#envSrc", AV.srcBadge(e.source));
  const co2 = e.ppco2_mmhg, cc = co2 > 5 ? "c-crit" : co2 > 3 ? "c-warn" : "c-ok";
  setH("#env", `<dt>CO2 de cabina</dt><dd class="${cc}">${fmt(co2, 2)} mmHg</dd><dt>Oxígeno (ppO2)</dt><dd>${fmt(e.ppo2_mmhg, 1)} mmHg</dd>
    <dt>Nitrógeno (ppN2)</dt><dd>${fmt(v.ppn2_torr, 1)} mmHg</dd><dt>Presión de cabina</dt><dd>${fmt(e.pressure_mmhg, 1)} mmHg</dd>
    <dt>Temperatura</dt><dd>${fmt(e.temp_c, 1)} °C</dd><dt>Presión de la esclusa</dt><dd>${fmt(v.airlock_pressure_torr, 0)} mmHg</dd>
    <dt>Producción de O2</dt><dd>${fmt(v.o2_production_lb_day, 1)} lb/d</dd>`);
  setT("#envErr", e.error ? t("ISS Live no conectado") + ": " + e.error.slice(0, 90) : e.updated ? t("Actualizado hace") + " " + AV.ago(e.updated) : "");
  setH("#radSrc", AV.srcBadge(r.source));
  const cum = Object.entries(r.cumulative_mgy || {}).map(([k, x]) => { const c = ov.crew.find(y => y.id === k); return `<dt>${esc(c ? c.name : k)}</dt><dd>${fmt(x, 3)} mGy · ${fmt((r.cumulative_msv || {})[k], 3)} mSv</dd>`; }).join("");
  setH("#rad", `<dl class="kv"><dt>Tasa de dosis</dt><dd>${fmt(r.dose_rate_ugy_h, 1)} µGy/h</dd>
    <dt>Dosis equivalente</dt><dd>${fmt(r.dose_equiv_usv_h, 1)} µSv/h</dd><dt>Protones GOES ≥10 MeV</dt><dd>${fmt(r.goes_10mev_pfu, 2)} pfu</dd>
    <dt>Escala NOAA</dt><dd class="${r.noaa_scale === "S0" ? "c-ok" : "c-crit"}">${r.noaa_scale}</dd>${cum}<dt>Límite de carrera NASA</dt><dd>${r.career_limit_msv} mSv</dd></dl>`);
  setH("#dtnMode", AV.srcBadge(d.mode.toUpperCase()));
  const st = ["toronto", "washington", "london", "moscow", "bengaluru", "singapore", "tokyo", "sydney", "saopaulo"];
  setH("#dtn", `<dl class="kv"><dt>Estado</dt><dd class="${d.contact ? "c-ok" : "c-warn"}">${t(d.contact ? "En contacto (AOS)" : "Sin señal (LOS)")}</dd>
    <dt>Próximo pase</dt><dd>${d.contact ? t("ahora") : (d.next_pass_min ?? "—") + " min"}</dd>
    <dt>Paquetes a Tierra · entregados</dt><dd>${d.bundles_down} · ${d.delivered_down}</dd><dt>Mensajes de Houston · recibidos</dt><dd>${d.bundles_up} · ${d.delivered_up}</dd>
    <dt>Latencia media</dt><dd>${d.avg_latency_s ?? "—"} s</dd><dt>Perfil · retardo de luz</dt><dd>${d.destination} · ${d.light_delay_s} s</dd></dl>
    <div class="stations">${st.map(s => `<span class="${d.visible_stations.includes(s) ? "on" : ""}">${s}</span>`).join("")}</div>
    <p class="lbl" style="margin:6px 0 0">Bundle Protocol · BSP · ${esc(d.framework)}</p>`);
  setT("#los", d.blackout ? "Restablecer señal" : "Forzar pérdida de señal"); $("#los").classList.toggle("on", d.blackout);
  setT("#wlink", ov.watch_link_down ? "Restablecer enlace del reloj" : "Cortar enlace del reloj"); $("#wlink").classList.toggle("on", ov.watch_link_down);
  $("#dest").value = d.destination;
  setH("#events", ov.events.map(x => `<div class="item"><div class="t" style="font-size:13px;font-weight:300"><span>${esc(x.text)}</span><span class="when">${AV.time(x.ts)}</span></div></div>`).join(""));
  const sel = $("#scTarget"), opts = [["ALL", t("Toda la tripulación")], ...ov.crew.map(c => [c.id, c.name])];
  if (sel.options.length !== opts.length) sel.innerHTML = opts.map(([k, n]) => `<option value="${k}">${esc(n)}</option>`).join("");
}
async function loadSources() {
  const d = await AV.get("/api/sources");
  setH("#sources", d.sources.map(s => `<tr><td style="width:120px">${AV.srcBadge(s.status)}</td><td><span style="font-weight:400">${esc(s.name)}</span><div class="lbl" style="word-break:break-all">${esc(s.url)}</div>${s.error ? `<div class="c-warn" style="font-size:12px">${esc(s.error)}</div>` : ""}</td></tr>`).join(""));
}

// ------------------------------------------------------------------ ciclo
function render() {
  const ov = S.ov; renderChips(ov); renderPicker();
  S.radHist.push([Date.now() / 1000, (ov.rad || {}).dose_rate_ugy_h]); S.radHist = S.radHist.slice(-300);
  if (S.view === "monitor" && S.pick === "crew") renderCrew(ov);
  if (S.view === "alertas") renderAlertas(ov);
  if (S.view === "estacion") renderEstacion(ov);
  setH("#aiEng", ov.ai.ollama ? `<span class="pill p-ok">IA local · ${esc(ov.ai.model)}</span>` : `<span class="pill p-gray">Reglas + base NASA (sin LLM)</span>`);
}
async function loadDetail() {
  if (!S.ov || S.view !== "monitor" || S.pick === "crew" || S.pick === "earth") return;
  if (!S.sel) S.sel = S.ov.crew[0].id;
  S.detail = await AV.get(`/api/crew/${S.sel}`);
  const id = S.sel;
  if (!(id in S.labs)) { S.labs[id] = null; fetch(`/api/labs/${id}`).then(r => r.ok ? r.json() : false).then(x => { S.labs[id] = x || false; if (S.detail && S.sel === id) renderAstronauta(S.detail); }).catch(() => { S.labs[id] = false; }); }
  renderAstronauta(S.detail);
}
function initControls() {
  $$(".lg").forEach(b => { b.classList.toggle("on", b.dataset.lang === AV.lang); b.onclick = () => AV.setLang(b.dataset.lang); });
  setH("#scen", Object.entries(AV.SCEN).map(([k, v]) => `<button class="btn" data-sc="${k}">${v}</button>`).join(""));
  $$("#scen .btn").forEach(b => b.onclick = () => AV.post("/api/scenario", {crew_id: $("#scTarget").value, scenario: b.dataset.sc}));
  $("#scReset").onclick = () => AV.post("/api/scenario", {crew_id: "ALL", scenario: "nominal"});
  $("#los").onclick = () => AV.post("/api/dtn", {blackout: !S.ov.dtn.blackout});
  $("#wlink").onclick = () => AV.post("/api/watch/link", {down: !S.ov.watch_link_down});
  $("#dest").onchange = e => AV.post("/api/dtn", {destination: e.target.value});
  $("#chatForm").onsubmit = async e => { e.preventDefault(); const x = $("#chatIn").value.trim(); if (!x) return; $("#chatIn").value = ""; await AV.post(`/api/chat/${S.sel}`, {text: x}); loadDetail(); };
  $("#repForm").onsubmit = async e => { e.preventDefault(); await AV.post("/autorreportes", {tripulante: S.sel, sueno: $("#rSleep").value, animo: $("#rMood").value, sintomas: $("#rNote").value}); $("#rNote").value = ""; loadDetail(); };
  $("#eSend").onclick = async () => { const x = $("#eTxt").value.trim(); if (!x) return;
    const r = await AV.post("/api/earth/send", {text: x, crew_id: $("#eTo").value || null}); $("#eTxt").value = "";
    setT("#eRes", r.ok ? `${t("Paquete")} ${r.bundle_id.slice(0, 8)} ${t("en cola: viajará en la próxima ventana de contacto.")}` : t("No se pudo crear el paquete")); };
  const btn = $("#recBtn"); let rec = null;
  const start = async e => { e.preventDefault(); if (rec) return;
    rec = new AV.Recorder(db => { $("#meter").style.width = Math.max(0, Math.min(100, (db + 70) * 1.6)) + "%"; $("#db").textContent = db.toFixed(0) + " dBFS"; });
    rec.onText = x => $("#vtext").textContent = "“" + x + "”";
    try { await rec.start(); setT("#recTxt", "Escuchando… suelta para enviar"); } catch (err) { alert(t("No se pudo abrir el micrófono") + ": " + err); rec = null; } };
  const stop = async () => { if (!rec) return; const r = rec; rec = null; setT("#recTxt", "Analizando…");
    const res = await AV.sendVoice(S.sel, await r.stop(), r.transcript, $("#cal").checked); setT("#recTxt", "Mantener para hablar"); $("#meter").style.width = 0;
    if (res.error) alert(res.error); S.lastChat = 0; loadDetail(); if (res.reply) AV.speak(res.reply.text, true); };
  btn.addEventListener("mousedown", start); btn.addEventListener("touchstart", start); window.addEventListener("mouseup", stop); window.addEventListener("touchend", stop);
}

initControls(); route();
const es = new EventSource(AV.L("/api/stream"));
es.onmessage = ev => { const first = !S.ov; S.ov = JSON.parse(ev.data); render(); if (first) { const h0 = new URLSearchParams(location.search).get("ver"); pick(h0 || "crew"); } };
es.onerror = () => { setH("#chips", `<span class="pill lg p-crit"><span class="d"></span>Sin conexión con el servidor de la estación</span>`); };
setInterval(loadDetail, 2500); setInterval(loadEarth, 2500); setInterval(() => S.view === "estacion" && loadSources(), 10000);
window.addEventListener("resize", () => S.detail && S.pick !== "crew" && S.pick !== "earth" && renderAstronauta(S.detail));
