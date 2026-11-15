// SANBOSI · reloj interactivo conectado a la estación.
// Réplica 1:1 del "Reloj interactivo" del canvas del equipo (RelojDemo + las 25 pantallas): 6 páginas deslizables,
// accesos rápidos (↓), avisos (↑), corona (inicio/apps), botón lateral (hablar) y todas las vistas con datos en vivo
// de /api/watch/{id}/view. Medidas, colores, textos y animaciones vienen del canvas.
(() => {
const {$, $$, esc, fmt} = AV;
const W = {crew: null, crewList: [], d: null, h: 0, layer: null, stack: [], mic: true, micUntil: 0, dnd: false, sleep: false,
  syncing: 0, doc: false, torch: false, since: 0, seenFeed: false, stormAck: false, inShelter: false, stormDose: 0, shelterHist: [],
  lastVoiceTs: 0, tensionShown: 0, diary: {i: 0, a: {}}, reminders: {}, remindAt: {}, asked: {}, firstSeen: {}, rFlash: null,
  breath: null, rec: null, result: null, suppress: false, drag: null, returnTo: []};
const PAGES = [-1, 0, 1, 2, 3, 4], WPX = 396, HPX = 484;
const ROUTINE = [["07:00", "Charla de bienestar", "charla", "Cómo dormiste y cómo te sientes · 3 preguntas", ""],
  ["07:30", "Desayuno", "desayuno", "Dímelo en voz alta cuando comas", ""], ["12:30", "Almuerzo", "almuerzo", "Dímelo en voz alta cuando comas", ""],
  ["15:00", "Ejercicio", "ejercicio", "Bicicleta estática · 45 min", " · 45 min"], ["18:00", "Revisión de salud y radiación", "revision", "Signos, dosis y diario con el médico", ""],
  ["22:00", "Preparar para dormir", "dormir", "Luz tenue y sin pantallas", ""]];
const MEALS = ["desayuno", "almuerzo", "cena"];
const CAT = {SLEEP: "sueno", BHP: "mente", TEAM: "mente", RAD: "radiacion", RENAL: "comida", NUTR: "comida"};
const CATN = {sueno: ["Sueño", "#B9A7F5"], mente: ["Mente", "#B9A7F5"], cuerpo: ["Cuerpo", "#F49B8E"], comida: ["Comida", "#8FD9A8"], radiacion: ["Radiación", "#E8D36B"], reloj: ["Reloj", "#8CCBF0"]};
const SEVC = {critical: "#FF8A7A", warning: "#F2C27B", watch: "#8CCBF0"};
const SEVN = {critical: "Crítica", warning: "Atención", watch: "Observación"};

// ---------------------------------------------------------------- iconos (los del canvas)
const sv = (w, body, sw = 2, extra = "") => `<svg width="${w}" height="${w}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${body}</svg>`;
const I = {
  chev: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#A8A29E" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 6-6 6 6 6"/></svg>',
  chev22: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#D6D3D1" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 6-6 6 6 6"/></svg>',
  check: (w, c, s) => `<svg width="${w}" height="${w}" viewBox="0 0 24 24" fill="none" stroke="${c || "currentColor"}" stroke-width="${s || 2.6}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>`,
  heart: sv(20, '<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/>'),
  mind: sv(20, '<circle cx="12" cy="12" r="9"/><path d="M8.5 14.5a4 4 0 0 0 7 0"/><path d="M9 9.5h.01M15 9.5h.01"/>'),
  fork: sv(20, '<path d="M6 3v7a2 2 0 0 0 4 0V3M8 10v11"/><path d="M17 3c-1.5 0-3 2-3 5v4h3v9"/>'),
  heartFill: w => `<svg width="${w}" height="${w}" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-8-5.2-8-11.2A4.6 4.6 0 0 1 12 7a4.6 4.6 0 0 1 8 2.8C20 15.8 12 21 12 21z" fill="#F49B8E"/></svg>`,
  // accesos rápidos
  mic: sv(28, '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>'),
  moon: sv(28, '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>'),
  bed: sv(28, '<path d="M3 18h18M5 18v-6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v6M7 10V7a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v3"/>'),
  sync: sv(28, '<path d="M20 12a8 8 0 0 1-14 5.3M4 12a8 8 0 0 1 14-5.3"/><path d="M18 3v4h-4M6 21v-4h4"/>'),
  torch: sv(28, '<path d="M8 2h8l-1 6H9z"/><path d="M9 8h6v12a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2z"/><path d="M12 12v3"/>'),
  plus: sv(28, '<path d="M12 5v14M5 12h14"/>'),
  // apps
  wave: sv(28, '<path d="M4 10v4M8 7v10M12 4v16M16 7v10M20 10v4"/>'),
  clock: sv(28, '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  wind: sv(28, '<path d="M3 8h11a3 3 0 1 0-3-3M3 16h15a3 3 0 1 1-3 3M3 12h7"/>'),
  drop: sv(28, '<path d="M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z"/>'),
  rad: sv(28, '<circle cx="12" cy="12" r="2"/><path d="M12 3a9 9 0 0 1 7.8 4.5L14 11M4.2 7.5A9 9 0 0 1 12 3M12 21a9 9 0 0 1-7.8-4.5L10 13M19.8 16.5A9 9 0 0 1 12 21"/>'),
  heart28: sv(28, '<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/>'),
  list: sv(28, '<path d="M6 4v16M6 6h10M6 12h12M6 18h8"/>'),
  bell: sv(28, '<path d="M6 16v-5a6 6 0 1 1 12 0v5l2 2H4z"/><path d="M10 21h4"/>'),
  station: sv(28, '<rect x="3" y="4" width="18" height="14" rx="2"/><path d="M9 21h6"/>'),
  mind28: sv(28, '<circle cx="12" cy="12" r="9"/><path d="M8.5 14.5a4 4 0 0 0 7 0"/><path d="M9 9.5h.01M15 9.5h.01"/>'),
  // vistas
  watchBox: sv(28, '<rect x="6" y="6" width="12" height="12" rx="3"/><path d="M9 6V3h6v3M9 18v3h6v-3"/>', 1.8),
  monitor: sv(28, '<rect x="3" y="4" width="18" height="14" rx="2"/><path d="M9 21h6"/>', 1.8),
  micOff: sv(34, '<path d="M9 9v-3a3 3 0 0 1 6 0v5"/><path d="M5 11a7 7 0 0 0 11.3 5.5M19 11a7 7 0 0 1-.4 2.3M12 18v3"/><path d="m3 3 18 18"/>', 1.8),
  shieldOk: sv(20, '<path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6z"/><path d="m9 12 2 2 4-4"/>'),
  shield: sv(30, '<path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6z"/>', 1.8),
  vib: sv(20, '<rect x="8" y="5" width="8" height="14" rx="2"/><path d="M4 9v6M20 9v6M2 11v2M22 11v2"/>')
};
const APPS = [["diario", "Diario", I.wave, "#241B40", "#B9A7F5"], ["rutina", "Rutina", I.clock, "#10222E", "#8CCBF0"], ["respira", "Respira", I.wind, "#0F1A30", "#8FB0FF"],
  ["agua", "Agua", I.drop, "#10222E", "#8CCBF0"], ["radiacion", "Radiación", I.rad, "#2A2612", "#E8D36B"], ["corazon", "Signos", I.heart28, "#2A1715", "#F49B8E"],
  ["momentos", "Momentos", I.list, "#1C1C1F", "#D6D3D1"], ["sueno", "Sueño", I.moon, "#241B40", "#B9A7F5"], ["avisos", "Avisos", I.bell, "#2A2112", "#F2C27B"],
  ["sync", "Estación", I.station, "#0F1A30", "#8FB0FF"], ["recuerda", "Recuerda", I.mind28, "#241B40", "#B9A7F5"], ["escucha", "Escucha", I.mic, "#12261A", "#8FD9A8"]];

// ---------------------------------------------------------------- utilidades
const nowHM = () => new Date().toLocaleTimeString("es", {hour: "2-digit", minute: "2-digit", hour12: false});
const tsHM = ts => new Date(ts * 1000).toLocaleTimeString("es", {hour: "2-digit", minute: "2-digit", hour12: false});
const nowMin = () => new Date().getHours() * 60 + new Date().getMinutes();
const sameDay = ts => new Date(ts * 1000).toDateString() === new Date().toDateString();
const clamp = (x, a = 0, b = 100) => Math.max(a, Math.min(b, x || 0));
const hmin = h => h == null ? "—" : `${Math.floor(h)} h ${Math.round((h % 1) * 60)} min`;
const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;
const first = () => (W.d && W.d.card ? W.d.card.name.split(" ")[0] : "");
const card = () => (W.d && W.d.card) || {vitals: {}, baseline: {}};
const vit = () => card().vitals || {};
const cnt = () => (W.d && W.d.counters) || {water: 0, meals: [], routine: {}};
const voiceLast = () => (W.d && W.d.voice && W.d.voice[0]) || null;
function energyWord(ix) { if (!ix) return "Sin medir"; return ix.energy >= 62 ? "Alta" : ix.energy >= 38 ? "Media" : "Baja"; }
function energyColor(ix) { if (!ix) return "#3A3A40"; return ix.energy >= 62 ? "#8FD9A8" : ix.energy >= 38 ? "#F2C27B" : "#F49B8E"; }
function moodWord(ix) { if (!ix) return "—"; if (ix.stress >= 65) return "Tensa"; if (ix.fatigue >= 65) return "Cansada"; if (ix.mood <= 30) return "Decaída"; if (ix.mood >= 60) return "Tranquila"; return "Normal"; }
function mindPct() { const v = voiceLast(); return v ? Math.round((v.indices.mood + (100 - v.indices.stress)) / 2) : 70; }
function mealsToday() { return cnt().meals.filter(m => sameDay(m.ts)); }
function radInfo() {
  const r = (W.d && W.d.rad) || {}, rate = r.dose_rate_ugy_h || 0, storm = !!(r.noaa_scale && r.noaa_scale !== "S0");
  const st = storm ? ["Tormenta solar", "#FF8A7A", "#2E1613"] : rate > 50 ? ["Exposición elevada", "#F2C27B", "#2A2112"] : ["Exposición normal", "#8FD9A8", "#12261A"];
  // mSv estimados de la misión = días × tasa NASA en la Estación (0,35 mSv/día, rango 0,2–0,5) + dosis equivalente medida
  const mission = card().dose_msv ?? ((W.d && W.d.mission.day) || 42) * (r.iss_msv_per_day || 0.35);
  const pct = (mission / (r.career_limit_msv || 600)) * 100;
  // escala del canvas: normal 0–50 %, elevada 50–80 %, tormenta 80–100 %
  const pos = storm ? 80 + Math.min(18, Math.log10(Math.max(1, r.goes_10mev_pfu || 10)) * 4) : rate > 50 ? 50 + Math.min(28, (rate - 50) / 10) : Math.min(48, Math.max(2, rate));
  return {r, rate, storm, st, mission, pct, pos};
}
function findingsCat() {
  const f = ((W.d && W.d.findings) || []).filter(x => x.severity !== "info");
  return f.map(x => { if (!W.firstSeen[x.title]) W.firstSeen[x.title] = Date.now() / 1000; return {...x, cat: x.technical ? "reloj" : CAT[x.risk] || "cuerpo", ts: x.ts || W.firstSeen[x.title]}; });
}
function routineState() {
  const c = cnt(), mins = nowMin(), meals = mealsToday().map(m => m.name);
  const diaryToday = ((W.d && W.d.reports) || []).some(r => sameDay(r.ts));
  return ROUTINE.map(([h, t, k, detail, short]) => { const [hh, mm] = h.split(":").map(Number), at = hh * 60 + mm;
    const done = c.routine[k] === "hecho" || meals.includes(k) || (k === "charla" && diaryToday), snooze = c.routine[k] === "pospuesto";
    return {h, t, k, detail, short, at, done, snooze, past: at < mins - 30}; });
}
function nextRoutine() { const r = routineState(), mins = nowMin(); return r.find(x => !x.done && x.at >= mins - 60) || r.find(x => !x.done) || null; }
async function act(type, data) { if (!W.crew) return; try { const r = await AV.post(`/api/watch/${W.crew}/action`, {type, data: data || {}}); if (r.counters && W.d) W.d.counters = r.counters; } catch (e) {} poll(); }
function speak(t) { say(t); }
function vibrate() { if (navigator.vibrate && !W.dnd) navigator.vibrate([200, 100, 200]); }

// ---------------------------------------------------------------- navegación
function go(v) { W.layer = null; W.stack.push(v); W.viewHTML = null; onEnter(v); renderView(true); applyLayers(); }
function back() { W.stack.pop(); W.viewHTML = null; renderView(true); applyLayers(); }
function home() { W.stack = []; W.layer = null; W.h = 0; W.viewHTML = null; renderView(true); applyLayers(); }
function crown() { press("#crownBtn"); if (W.stack.length) { W.stack = []; renderView(true); } else if (W.layer || W.h !== 0) { W.layer = null; W.h = 0; } else W.layer = "apps"; applyLayers(); }
function press(sel) { const b = $(sel); b.classList.add("press"); setTimeout(() => b.classList.remove("press"), 220); }
function side() { press("#sideBtn"); W.returnTo = W.stack.slice(); W.stack = []; renderView(true);
  if (W.rec) { finishListen(); return; }
  W.layer = "listen"; applyLayers();
  if (!W.mic) { listenUI("Micrófono en pausa", "Actívalo en accesos rápidos o toca Reanudar", "Reanudar", "micOn"); return; }
  startListen(true); }
function onEnter(v) { if (v === "respira") startBreath(); }

function applyLayers(dx = 0, dy = 0, dragging = false) {
  const tr = dragging ? "none" : "transform .45s cubic-bezier(.2,.8,.2,1)";
  const free = !W.layer && !W.stack.length;
  let mx = dragging && W.drag && W.drag.mode === "h" && free ? dx : 0;
  if ((W.h === -1 && mx > 0) || (W.h === 4 && mx < 0)) mx *= 0.3;
  const my = dragging && W.drag && W.drag.mode === "v" ? dy : 0;
  const t = $("#track"); t.style.transition = tr; t.style.transform = `translateX(${-(W.h + 1) * WPX + mx}px)`;
  const q = $("#quick"), s = $("#sheet");
  q.style.transition = s.style.transition = tr;
  q.style.transform = `translateY(${W.layer === "quick" ? Math.min(0, my) : free && my > 0 ? -HPX + Math.min(my, HPX) : -HPX - 10}px)`;
  s.style.transform = `translateY(${W.layer === "sheet" ? Math.max(0, my) : free && my < 0 ? HPX + Math.max(my, -HPX) : HPX + 10}px)`;
  $("#apps").classList.toggle("on", W.layer === "apps");
  $("#listen").classList.toggle("on", W.layer === "listen");
  $("#view").classList.toggle("on", W.stack.length > 0);
  $("#dots").style.opacity = W.h !== 0 && !W.layer && !W.stack.length ? 1 : 0;
  $("#dots").innerHTML = PAGES.map(i => `<span style="width:${i === W.h ? 18 : 6}px;background:${i === W.h ? "#F2F2F0" : "#4A4A50"}"></span>`).join("");
}
function gesture(dir) {
  if (W.stack.length) { if (dir === "der") back(); return; }
  if (W.layer === "quick") { if (dir === "arriba") W.layer = null; applyLayers(); return; }
  if (W.layer === "sheet") { if (dir === "abajo") W.layer = null; applyLayers(); return; }
  if (W.layer === "apps") { if (dir === "der" || dir === "abajo") W.layer = null; applyLayers(); return; }
  if (W.layer === "listen") return;
  if (dir === "izq") W.h = Math.min(W.h + 1, 4); else if (dir === "der") W.h = Math.max(W.h - 1, -1);
  else if (dir === "abajo") W.layer = "quick"; else if (dir === "arriba") W.layer = "sheet";
  applyLayers();
}
const scr = $("#screen");
scr.addEventListener("pointerdown", e => { W.drag = {x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, mode: null, id: e.pointerId}; });
scr.addEventListener("pointermove", e => { const g = W.drag; if (!g) return; g.lx = e.clientX; g.ly = e.clientY;
  const dx = g.lx - g.x, dy = g.ly - g.y;
  if (!g.mode && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) { g.mode = Math.abs(dx) > Math.abs(dy) ? "h" : "v"; try { scr.setPointerCapture(g.id); } catch (er) {} }
  if (g.mode && !g.raf) g.raf = requestAnimationFrame(() => { if (W.drag) { W.drag.raf = 0; applyLayers(W.drag.lx - W.drag.x, W.drag.ly - W.drag.y, true); } }); });
function endDrag() { const g = W.drag; if (!g) return; W.drag = null; const dx = g.lx - g.x, dy = g.ly - g.y;
  if (Math.abs(dx) > 10 || Math.abs(dy) > 10) { W.suppress = true; setTimeout(() => W.suppress = false, 80); }
  if (Math.abs(dx) >= 40 || Math.abs(dy) >= 40) { if (Math.abs(dx) > Math.abs(dy)) gesture(dx < 0 ? "izq" : "der"); else gesture(dy > 0 ? "abajo" : "arriba"); }
  else applyLayers(); }
scr.addEventListener("pointerup", endDrag); scr.addEventListener("pointercancel", endDrag);
scr.addEventListener("dragstart", e => e.preventDefault());
// el foco de un botón no debe "desplazar" la pantalla del reloj (contenedores con overflow oculto)
[scr, $("#view")].forEach(el => el.addEventListener("scroll", () => { el.scrollLeft = 0; el.scrollTop = 0; }));

// ---------------------------------------------------------------- acciones (delegación)
function flash(k, type) { W.rFlash = {k, type, until: Date.now() + 2600}; setTimeout(() => { if (W.stack[W.stack.length - 1] === "rutina") renderView(true); }, 2700); }
function remindTarget(hh, mm) { const d = new Date(); d.setHours(hh, mm, 0, 0); return d.getTime() > Date.now() ? d.getTime() : Date.now() + 20e3; }
const ACTIONS = {
  side, crown, back, home, quick: () => { home(); W.layer = "quick"; applyLayers(); }, sheet: () => { W.stack = []; renderView(true); W.layer = "sheet"; applyLayers(); },
  next: () => { W.stack = []; renderView(true); W.layer = null; W.h = W.h >= 4 ? -1 : W.h + 1; applyLayers(); }, page1: () => { W.h = 1; applyLayers(); },
  mic: () => { W.mic = !W.mic; W.micUntil = W.mic ? 0 : Date.now() + 15 * 60e3; act("mic", {label: W.mic ? "reanudado" : "en pausa 15 min"}); paint(); },
  micOn: () => { W.mic = true; W.micUntil = 0; startListen(true); paint(); },
  pause15: () => { W.mic = false; W.micUntil = Date.now() + 15 * 60e3; act("mic", {label: "en pausa 15 min"}); paint(); renderView(true); },
  resume: () => { W.mic = true; W.micUntil = 0; act("mic", {label: "reanudado"}); paint(); renderView(true); },
  dnd: () => { W.dnd = !W.dnd; act("dnd", {label: W.dnd ? "activado" : "desactivado"}); paint(); },
  sleep: () => { W.sleep = !W.sleep; scr.classList.toggle("sleepmode", W.sleep); act("sleep_mode", {label: W.sleep ? "activado" : "desactivado"}); paint(); },
  sync: () => doSync(), syncOpen: () => { go("sync"); doSync(); },
  torch: () => { W.torch = !W.torch; $("#torch").classList.toggle("on", W.torch); paint(); },
  doctor: () => { if (W.doc) return; W.doc = true; act("doctor", {reason: "Lo pidió desde el reloj"}); paint(); renderView(true); },
  listenDone: () => finishListen(),
  water: () => act("water"), waterRm: () => { if (cnt().water > 0) act("water_remove"); },
  meal: e => { act("meal", {name: e.dataset.arg || "almuerzo", label: e.dataset.arg}); if (W.stack[W.stack.length - 1] === "recordatorio") back(); },
  rDone: e => { const k = e.dataset.arg; if (MEALS.includes(k)) act("meal", {name: k, label: k}); else act("routine_done", {item: k, label: e.dataset.label}); flash(k, "done"); },
  rSnooze: e => { act("routine_snooze", {item: e.dataset.arg, label: e.dataset.label}); flash(e.dataset.arg, "snooze"); },
  remind: e => { const k = e.dataset.arg; W.reminders[k] = e.dataset.label; W.remindAt[k] = k === "dormir" ? remindTarget(22, 30) : remindTarget(12, 30);
    act("reminder", {label: e.dataset.label}); renderView(true); },
  diary: e => diaryPick(e.dataset.arg), diaryReset: () => { W.diary = {i: 0, a: {}}; renderView(true); },
  shelter: () => { W.stormAck = true; W.inShelter = true; W.stormDose = 0; W.shelterHist = []; act("shelter"); W.stack = ["refugio"]; renderView(true); applyLayers(); },
  safe: () => { W.inShelter = false; act("safe"); home(); },
  stormDemo: () => { AV.post("/api/scenario", {crew_id: "ALL", scenario: "solar_storm"}); W.stormAck = false; },
  breathe: () => startBreath(), calibrate: () => { W.calibrate = true; banner("Calibrar mi voz", "En la próxima charla habla normal 5–10 s."); },
  banner: () => { const b = $("#banner"); b.classList.remove("on"); if (W.bannerGo) go(W.bannerGo); }
};
document.addEventListener("click", e => {
  if (W.suppress) { e.preventDefault(); return; }
  const g = e.target.closest("[data-go]"), a = e.target.closest("[data-act]");
  const el = (g && a) ? (g.contains(a) ? a : g) : (g || a);
  if (!el) return;
  e.preventDefault();
  if (el.dataset.go) { if (!W.stack.length && W.layer === "sheet") W.layer = null; go(el.dataset.go); }
  else if (ACTIONS[el.dataset.act]) ACTIONS[el.dataset.act](el);
});
$("#crownBtn").onclick = e => { e.stopPropagation(); crown(); };
$("#sideBtn").onclick = e => { e.stopPropagation(); side(); };

// ---------------------------------------------------------------- piezas de las vistas
const hd = (title, right, act = "back") => `<div class="vh"><button class="vback" data-act="${act}" aria-label="Volver">${I.chev}${title}</button><span class="vr">${right ?? `<span data-l="clock"></span>`}</span></div>`;
const vw = (style, inner, cls = "") => `<div class="vw ${cls}" style="${style}">${inner}</div>`;
// brillo de fondo del canvas (manchas de color que se desplazan); cols = 3 colores, d = duraciones [A, B, C, D?]
function glowV({h = "58%", bottom = "-12%", anim = "glowIdle 7s ease-in-out infinite", cols = ["#4F7BFF", "#8B5CF6", "#2DD4BF"], d = [10, 12, 11], o4 = .7}) {
  const b = (pos, c, an) => `<span style="${pos};background:radial-gradient(closest-side,${c} 0%,transparent 100%);animation:${an}"></span>`;
  return `<div class="vglow" aria-hidden="true" style="bottom:${bottom};height:${h};animation:${anim}">${b("left:0;bottom:0;width:60%;height:80%", cols[0], `driftA ${d[0]}s ease-in-out infinite`)}${b("left:30%;bottom:8%;width:55%;height:70%", cols[1], `driftB ${d[1]}s ease-in-out infinite`)}${b("left:55%;bottom:0;width:55%;height:75%", cols[2], `driftC ${d[2]}s ease-in-out infinite`)}${d[3] ? b(`left:15%;bottom:22%;width:45%;height:45%;opacity:${o4}`, "#F472B6", `driftD ${d[3]}s ease-in-out infinite`) : ""}</div>`;
}
const ARC = "M 20 120 A 100 100 0 0 1 220 120";
const arcSvg = (pct, color, anim, label) => `<svg width="240" height="132" viewBox="0 0 240 132" ${label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"'}><path d="${ARC}" fill="none" stroke="#1C1C1E" stroke-width="12" stroke-linecap="round"/><path d="${ARC}" fill="none" stroke="${color}" stroke-width="12" stroke-linecap="round" stroke-dasharray="314" stroke-dashoffset="${(314 * (1 - clamp(pct) / 100)).toFixed(0)}" style="${anim ? "animation:arc 2s cubic-bezier(.2,.8,.2,1) .2s both" : "transition:stroke-dashoffset 1s"}"/></svg>`;
const edgeGlow = `<div aria-hidden="true" style="position:absolute;z-index:-1;inset:0;border-radius:88px;box-shadow:inset 0 0 34px 4px rgba(79,123,255,.55),inset 0 -40px 60px -10px rgba(45,212,191,.45),inset 0 30px 50px -20px rgba(139,92,246,.45);animation:edge 2.4s ease-in-out infinite;pointer-events:none"></div>`;
const pdone = (text, bg, color, extra = "") => `<span class="pd" style="background:${bg};color:${color};${extra}">${I.check(16)}${text}</span>`;
const DAYL = () => EN() ? ["S", "M", "T", "W", "T", "F", "S"] : ["D", "L", "M", "M", "J", "V", "S"];
const dayLetters = (w, gap) => { const t = new Date().getDay(); return `<div aria-hidden="true" style="display:flex;${gap ? `gap:${gap}px` : "justify-content:space-between"};padding:0 4px;font-size:12px;font-weight:300;color:#A8A29E">${[6, 5, 4, 3, 2, 1, 0].map(i => `<span style="${w ? `width:${w}px` : "flex:1"};text-align:center${i === 0 ? ";color:#F2F2F0" : ""}">${i === 0 ? L2("Hoy", "Today") : DAYL()[(t - i + 7) % 7]}</span>`).join("")}</div>`; };
const lineOf = (vals, lo, hi, h, pad = 4) => vals.map((v, i) => v == null ? null : `${(i / (vals.length - 1) * 320).toFixed(0)},${(h - pad - (v - lo) / Math.max(1e-6, hi - lo) * (h - 2 * pad)).toFixed(1)}`).filter(Boolean).join(" ");

// ---------------------------------------------------------------- vistas (estructura estable + valores en vivo [data-l])
const V = {
  // los valores y las barras se llenan en live() (data-l="hv-*" / "hb-*") para no repetir las animaciones cada segundo
  hoy: () => { const vl = voiceLast(), ix = vl && vl.indices;
    const items = [["radiacion", "Radiación", "rad", "#E8D36B"], ["corazon", "Cuerpo", "body", "#F49B8E"], [ix && ix.stress >= 65 ? "tension" : "voz", "Mente", "mind", "#B9A7F5"],
      ["agua", "Comida y agua", "food", "#8FD9A8"], ["voz", "Energía", "energy", energyColor(ix)]];
    return vw("gap:10px;padding:28px 30px 30px", hd("Tu día") + `<div style="display:flex;flex-direction:column;gap:8px">${items.map(([g, l, k, col], i) =>
      `<button class="hcard fu" data-go="${g}" style="animation-delay:${(i * .06).toFixed(2)}s"><span class="t"><span>${l}</span><b data-l="hv-${k}"></b></span><span class="b"><i data-l="hb-${k}" style="width:3%;background:${col};animation-delay:${(.1 + i * .1).toFixed(1)}s;transition:width .8s"></i></span></button>`).join("")}</div>`); },

  corazon: () => { const dic = cnt().dictated || {};
    return vw("", hd("Signos vitales", `<span style="font-size:14px;font-weight:300;color:#F49B8E">En vivo</span>`) + `
    <div style="display:flex;align-items:center;gap:16px;padding:10px 6px 0"><span data-l="beat" style="width:56px;height:56px;display:flex;align-items:center;justify-content:center;animation:beat .9s ease-in-out infinite">${I.heartFill(46)}</span>
      <span class="bignum"><b data-l="hr" style="font-size:68px">—</b><small>lpm</small></span></div>
    <svg width="100%" height="56" viewBox="0 0 320 56" preserveAspectRatio="none" role="img" aria-label="Ritmo cardíaco en vivo"><polyline data-l="ecg" points="0,30 40,30 52,30 60,12 68,48 76,30 120,30 160,30 172,30 180,12 188,48 196,30 240,30 280,30 292,30 300,12 308,48 316,30 320,30" fill="none" stroke="#F49B8E" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" stroke-dasharray="640" vector-effect="non-scaling-stroke" style="animation:ecg 3.2s linear infinite"/></svg>
    <div class="vcard fu" style="margin-top:auto;padding:14px 18px;display:flex;flex-direction:column;gap:6px;animation-delay:.3s">
      <span class="krow"><span>Oxígeno</span><span data-l="spo2"></span></span><span class="krow"><span>Temperatura de piel</span><span data-l="temp"></span></span>
      <span class="krow"><span>Presión · ${dic.bp ? "dictada" : "estimada"}</span><span data-l="bp"></span></span><span class="krow"><span>Glucosa · dictada</span><span data-l="glu"></span></span></div>
    <span style="margin-top:-4px;padding:0 6px;font-size:12px;font-weight:300;color:#A8A29E">Presión y glucosa: dime el valor que te dio el médico</span>`); },

  radiacion: () => { const ri = radInfo(), src = ri.r.source === "LIVE" ? "Dosímetro real" : ri.r.source === "CACHE" ? "Caché" : "Simulado";
    return vw("", hd("Radiación", `<span style="height:24px;padding:0 10px;border-radius:12px;background:#1C1C1E;display:flex;align-items:center;font-size:12px;font-weight:400;color:#A8A29E">${src}</span>`) + `
    <div class="fu" style="display:flex;flex-direction:column;gap:2px;padding:0 6px;animation-duration:.6s"><span class="bignum"><b data-l="rad" style="font-size:56px">—</b><small>µGy/h</small></span>
      <span data-l="radst" style="display:flex;align-items:center;gap:8px;font-size:15px;font-weight:400"></span></div>
    <button data-go="tormenta" aria-label="Escala de exposición; abrir clima espacial y tormenta solar" style="display:block;padding:0 6px;width:100%">
      <span class="rscale"><i></i><i></i><i></i></span><span style="position:relative;display:block;height:14px"><span data-l="radmk" style="position:absolute;left:0;top:2px;width:2px;height:10px;border-radius:1px;background:#F2F2F0;transition:left 1.2s cubic-bezier(.2,.8,.2,1)"></span></span></button>
    <div class="vcard fu" style="padding:16px 18px;display:flex;flex-direction:column;gap:10px;animation-delay:.25s">
      <span style="display:flex;justify-content:space-between;align-items:baseline"><span style="font-size:15px;font-weight:300;color:#A8A29E">En la misión</span><span data-l="raddose" style="font-size:20px;font-weight:500"></span></span>
      <span style="display:block;height:4px;border-radius:2px;background:#1F1F22"><span data-l="radbar" style="display:block;width:0;height:4px;border-radius:2px;background:#E8D36B;transition:width 1.4s cubic-bezier(.2,.8,.2,1)"></span></span>
      <span data-l="radpct" style="font-size:14px;font-weight:300;color:#A8A29E"></span></div>
    <span data-l="radsrc" style="margin-top:auto;padding:0 6px;font-size:13px;font-weight:300;color:#A8A29E"></span>`); },

  tormenta: () => { const ri = radInfo();
    if (!ri.storm) return vw("gap:12px", hd("Clima espacial") + `<span style="margin-top:22px;width:72px;height:72px;border-radius:50%;background:#12261A;color:#8FD9A8;display:flex;align-items:center;justify-content:center">${I.shield}</span>
      <span class="vt" style="text-align:center">Sin tormenta solar ahora</span><span class="vs" style="text-align:center">${L2('Protones GOES ≥10 MeV: <span data-l="goes"></span>. Si suben, vibro y te pido que vayas al refugio.', 'GOES protons ≥10 MeV: <span data-l="goes"></span>. If they rise, I\'ll vibrate and ask you to go to the shelter.')}</span>
      <button class="pghost" data-act="stormDemo" style="margin-top:auto;align-self:stretch;height:54px;border-radius:27px">Simular tormenta (prueba)</button>`, "c");
    return `<div class="vw c" style="background:#120606;gap:12px;padding:40px 32px 32px"><div aria-hidden="true" style="position:absolute;z-index:-1;inset:0;border-radius:88px;box-shadow:inset 0 0 42px 8px rgba(255,90,70,.75);animation:alarm 1s ease-in-out infinite;pointer-events:none"></div>
      <span style="display:flex;align-items:center;gap:8px;font-size:14px;font-weight:500;color:#FF8A7A;animation:shake .6s ease-in-out infinite">${I.vib}Vibrando</span>
      <div class="fu" style="display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center;animation-duration:.4s"><span style="font-size:30px;font-weight:600">Tormenta solar</span>
        <span style="font-size:16px;font-weight:300;color:#F5C9C2">La radiación subió a <span data-l="rad"></span> µGy/h · NOAA <span data-l="scale"></span></span></div>
      <div style="align-self:stretch;margin-top:8px;border-radius:20px;background:rgba(255,107,94,.14);border:1px solid rgba(255,107,94,.4);padding:16px 18px;text-align:center;font-size:20px;font-weight:500;line-height:1.35">Ve al refugio blindado ahora</div>
      <div class="bottom"><button class="pb" data-act="shelter" style="height:56px;border-radius:28px;background:#FF6B5E;font-size:17px!important;font-weight:600">Ya estoy en el refugio</button>
        <span style="font-size:13px;font-weight:300;color:#D6B5AF">El médico de vuelo ya recibió el aviso</span></div></div>`; },

  refugio: () => { const ri = radInfo();
    return vw("gap:14px;padding:36px 34px 32px", `<div class="fu" style="display:flex;align-items:center;gap:12px;padding:0 4px"><span style="width:40px;height:40px;flex-shrink:0;border-radius:50%;background:#12261A;color:#8FD9A8;display:flex;align-items:center;justify-content:center">${I.shieldOk}</span><span style="font-size:22px;font-weight:500">Estás en el refugio</span></div>
    <div style="position:relative;height:90px;margin:6px 4px 0"><svg width="100%" height="90" viewBox="0 0 320 90" preserveAspectRatio="none" role="img" aria-label="Tasa de radiación desde que entraste al refugio"><polyline data-l="shelterline" points="0,45 320,45" fill="none" stroke="#8FD9A8" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg></div>
    <span style="padding:0 4px;font-size:16px;font-weight:400">Ahora <span data-l="rad"></span> µGy/h <span data-l="radtrend"></span></span>
    <span style="padding:0 4px;margin-top:-8px;font-size:14px;font-weight:300;color:#A8A29E">Dosis de este evento: <span data-l="stormdose"></span> mGy</span>
    <div class="bottom fu" style="animation-delay:.4s"><span style="font-size:14px;font-weight:300;color:${ri.storm ? "#D6D3D1" : "#8FD9A8"};text-align:center">${ri.storm ? "Te aviso cuando sea seguro salir" : "La tormenta terminó. Ya es seguro salir"}</span>
      <button class="pb" data-act="safe" style="background:#141416;color:#F2F2F0!important;font-weight:400">Estoy bien</button></div>`); },

  agua: () => vw("gap:14px", hd("Agua") + `
    <div role="img" aria-label="Vaso de agua del día" style="position:relative;width:120px;height:160px;border:2.5px solid #3F3F46;border-top:0;border-radius:6px 6px 30px 30px;box-sizing:border-box;overflow:hidden;background:#0A0A0B">
      <div data-l="waterfill" style="position:absolute;left:0;right:0;bottom:0;height:0;background:#8CCBF0;transition:height .9s cubic-bezier(.2,.8,.2,1)"><svg width="252" height="12" viewBox="0 0 252 12" aria-hidden="true" style="position:absolute;top:-10px;left:0;animation:slosh 3.6s linear infinite"><path d="M0 7 Q 15 0 30 7 T 60 7 T 90 7 T 120 7 T 150 7 T 180 7 T 210 7 T 240 7 T 270 7 V 12 H 0 Z" fill="#8CCBF0"/></svg></div></div>
    <div style="display:flex;flex-direction:column;align-items:center;gap:2px"><span style="font-size:26px;font-weight:500;font-variant-numeric:tabular-nums"><span data-l="water"></span> ${L2("de 8 vasos", "of 8 glasses")}</span><span data-l="watermeta" style="font-size:15px;font-weight:300;color:#A8A29E"></span></div>
    <div style="margin-top:auto;align-self:stretch;display:flex;gap:10px"><button data-act="waterRm" aria-label="Quitar un vaso" style="width:54px;height:54px;border-radius:27px;background:#141416;color:#F2F2F0;font-size:24px;font-weight:300;text-align:center;flex-shrink:0">−</button>
      <button class="pb" data-act="water" style="flex:1;background:#8CCBF0">Tomé un vaso</button></div>`, "c"),

  sueno: () => { const v = vit(), h = v.sleep_h || 0, b = card().baseline, wake = 6.5, bed = (wake - h + 24) % 24;
    const f = x => `${Math.floor(x) % 12 || 12}:${String(Math.round((x % 1) * 60) % 60).padStart(2, "0")} ${x >= 12 ? L2("p. m.", "p.m.") : L2("a. m.", "a.m.")}`;
    const tip = h < 6 ? L2("Dormiste menos de 6 horas. Hoy intenta acostarte 30 minutos antes.", "You slept less than 6 hours. Try going to bed 30 minutes earlier tonight.")
      : h < (b.sleep_h || 7) - 0.5 ? L2(`Un poco menos que tu habitual (${hmin(b.sleep_h)}). Hoy intenta acostarte 20 minutos antes.`, `A bit less than your usual (${hmin(b.sleep_h)}). Try going to bed 20 minutes earlier tonight.`)
      : L2(`Dormiste dentro de tu rango habitual (${hmin(b.sleep_h)}).`, `You slept within your usual range (${hmin(b.sleep_h)}).`);
    return vw("", hd("Sueño") + `<div class="fu" style="display:flex;flex-direction:column;gap:2px;padding:0 6px;animation-duration:.6s"><span style="font-size:40px;font-weight:500;letter-spacing:-.02em;line-height:1.1">${hmin(h)}</span><span style="font-size:15px;font-weight:300;color:#A8A29E">${L2(`De ${f(bed)} a ${f(wake)}`, `From ${f(bed)} to ${f(wake)}`)}</span></div>
    <div role="img" aria-label="Fases del sueño estimadas: profundo, ligero, REM y despierto" style="height:16px;display:flex;gap:3px;border-radius:8px;overflow:hidden;margin:6px 6px 0">${[[22, "#7B66D6"], [48, "#A595EE"], [22, "#D2C8FA"], [8, "#44403C"]].map(([g, c], i) => `<span style="flex:${g} 1 0;background:${c};animation:growF 1.2s cubic-bezier(.2,.8,.2,1) ${(.2 + i * .15).toFixed(2)}s both"></span>`).join("")}</div>
    <span style="padding:0 6px;font-size:14px;font-weight:300;color:#A8A29E">${L2(`Sueño profundo ${hmin(h * 0.22)} · estimado`, `Deep sleep ${hmin(h * 0.22)} · estimated`)}</span>
    <div class="vcard fu" style="margin-top:auto;padding:16px 18px;font-size:16px;font-weight:300;line-height:1.5;color:#E7E5E4;animation-delay:.6s">${tip}</div>`); },

  buenosdias: () => { const v = vit(), hr = new Date().getHours(), sal = hr < 12 ? L2("Buenos días", "Good morning") : hr < 19 ? L2("Buenas tardes", "Good afternoon") : L2("Buenas noches", "Good evening"), up = routineState().filter(x => !x.done).slice(0, 2), short = (v.sleep_h || 0) < 6;
    return vw("gap:12px;padding:40px 32px 32px", glowV({h: "52%", anim: "dawn 2.4s ease-out both", cols: ["#F2A65A", "#F472B6", "#4F7BFF"], d: [12, 14, 13]}) + `
    <div class="fu" style="display:flex;flex-direction:column;gap:2px;padding:0 6px;animation-duration:.7s"><span style="font-size:24px;font-weight:500">${sal}, ${esc(first())}</span><span style="font-size:15px;font-weight:300;color:#A8A29E">${L2(`Día ${W.d.mission.day} de misión`, `Mission day ${W.d.mission.day}`)} · <span data-l="clock"></span></span></div>
    <button class="vcard fu" data-go="sueno" style="margin-top:6px;padding:16px 18px;display:flex;align-items:center;justify-content:space-between;animation-delay:.25s"><span style="display:flex;flex-direction:column;gap:2px"><span style="font-size:14px;font-weight:300;color:#A8A29E">Dormiste</span><span style="font-size:24px;font-weight:500">${hmin(v.sleep_h)}</span></span><span style="font-size:15px;color:${short ? "#F2C27B" : "#B9A7F5"}">${short ? "Corto" : "Bien"}</span></button>
    <button class="vcard fu" data-go="rutina" style="padding:16px 18px;display:flex;flex-direction:column;gap:2px;animation-delay:.4s"><span style="font-size:14px;font-weight:300;color:#A8A29E">Hoy</span><span style="font-size:17px;font-weight:400">${up.length ? up.map(x => `${esc(AV.t(x.t))} ${x.h}`).join(" · ") : "Rutina completa"}</span></button>
    <button class="pghost fu" data-go="diario" style="margin-top:auto;height:54px;border-radius:27px;border-color:rgba(255,255,255,.16)!important;font-weight:500;animation-delay:.55s">${hr < 12 ? "Charla de la mañana" : "Charla de bienestar"}</button>`); },

  rutina: () => { const r = routineState(), n = nextRoutine(), mins = nowMin(), fl = W.rFlash && W.rFlash.until > Date.now() ? W.rFlash : null;
    const cur = fl ? r.find(x => x.k === fl.k) : n;
    const line = (x, cls) => `<span class="${cls}"><span class="rh">${x.h}</span><span style="flex:1">${esc(x.t)}</span>${x.done ? '<span style="color:#8FD9A8">✓</span>' : x.past && cls === "rhecho" ? `<button data-act="rDone" data-arg="${x.k}" data-label="${esc(x.t)}" style="color:#F2C27B;font-size:14px">Falta</button>` : ""}</span>`;
    const before = r.filter(x => cur ? x.at < cur.at : true), after = cur ? r.filter(x => x.at > cur.at) : [];
    const plus15 = (() => { const d = new Date(Date.now() + 15 * 60e3); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; })();
    let box = "";
    if (cur) {
      const lbl = cur.at <= mins && mins < cur.at + 60 ? "Ahora" : cur.snooze ? "Pospuesto" : cur.at < mins ? "Pendiente" : "Siguiente";
      const btns = fl ? (fl.type === "done" ? `<span class="pd" style="height:44px;border-radius:22px;background:#12261A;color:#8FD9A8;font-size:14px">✓ ${esc(L2(`${cur.t} registrado`, `${AV.t(cur.t)} logged`))}</span>`
          : `<span class="pd" style="height:44px;border-radius:22px;background:#1C1C1E;color:#D6D3D1;font-size:14px">${L2(`Te lo recuerdo a las ${plus15}`, `I'll remind you at ${plus15}`)}</span>`)
        : `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><button data-act="rSnooze" data-arg="${cur.k}" data-label="${esc(cur.t)}" style="height:44px;border-radius:22px;border:1px solid rgba(255,255,255,.14);font-size:14px;text-align:center">En 15 min</button><button data-act="rDone" data-arg="${cur.k}" data-label="${esc(cur.t)}" style="height:44px;border-radius:22px;background:#4F7BFF;color:#FFFFFF;font-size:14px;font-weight:500;text-align:center">Hecho</button></div>`;
      box = `<div class="fu" style="border-radius:22px;background:#141416;border:1px solid #26262A;padding:16px 18px;display:flex;flex-direction:column;gap:12px"><span style="display:flex;flex-direction:column;gap:2px"><span style="font-size:13px;font-weight:400;color:#8FB0FF">${AV.t(lbl)} · ${cur.h}</span><span style="font-size:20px;font-weight:500">${esc(cur.t)}</span><span style="font-size:14px;font-weight:300;color:#A8A29E">${esc(cur.detail)}</span></span>${btns}</div>`;
    } else box = `<div class="fu" style="border-radius:22px;background:#12261A;padding:16px 18px;display:flex;align-items:center;gap:10px;color:#8FD9A8;font-size:16px">${I.check(18)}Terminaste la rutina de hoy</div>`;
    return vw("gap:12px;padding:28px 34px 30px", hd("Rutina") + `<div style="display:flex;flex-direction:column;gap:6px;padding:0 4px">${before.map(x => line(x, "rhecho")).join("")}</div>${box}<div style="display:flex;flex-direction:column;gap:6px;padding:0 4px">${after.map(x => line(x, "rprox")).join("")}</div>`); },

  diario: () => diaryView(),

  momentos: () => { const d = W.d, items = [];
    const dl = (a, k, es, en) => (a.data && a.data[k]) ? AV.t(a.data[k]) : L2(es, en);
    const T = {water: () => L2("Tomaste un vaso de agua", "You drank a glass of water"), meal: a => L2(`Registraste ${dl(a, "name", "una comida", "")}`, `You logged ${dl(a, "name", "", "a meal")}`),
      routine_done: a => L2(`Hiciste: ${dl(a, "label", "una actividad", "")}`, `Done: ${dl(a, "label", "", "an activity")}`),
      breathe: () => L2("Hiciste una pausa para respirar", "You took a breathing break"), doctor: () => L2("Pediste hablar con el médico de vuelo", "You asked to talk to the flight surgeon"),
      shelter: () => L2("Fuiste al refugio blindado", "You went to the shielded shelter"), safe: () => L2("Saliste del refugio", "You left the shelter"),
      reminder: a => L2(`Programaste: ${dl(a, "label", "un recordatorio", "")}`, `You set: ${dl(a, "label", "", "a reminder")}`),
      dictation: a => L2(`Dictaste ${dl(a, "label", "un valor médico", "")}`, `You dictated ${dl(a, "label", "", "a medical value")}`)};
    (d.actions || []).forEach(a => T[a.type] && items.push({ts: a.ts, t: T[a.type](a), c: "#8FD9A8"}));
    (d.voice || []).forEach(v => { const md = AV.t(moodWord(v.indices)).toLowerCase();
      items.push({ts: v.ts, t: v.transcript ? `“${v.transcript.slice(0, 54)}” · ${L2("ánimo", "mood")} ${md}` : L2(`Tu voz sonaba ${md}`, `Your voice sounded ${md}`), c: "#B9A7F5"}); });
    (d.reports || []).forEach(r => items.push({ts: r.ts, t: L2(`Charla: dormiste ${String(r.sueno).toLowerCase()}, te sientes ${String(r.animo).toLowerCase()}`, `Check-in: slept ${AV.t(String(r.sueno)).toLowerCase()}, feeling ${AV.t(String(r.animo)).toLowerCase()}`), c: "#F2C27B"}));
    items.sort((a, b) => b.ts - a.ts); const n = nextRoutine(), shown = items.slice(0, n ? 3 : 4);
    return vw("gap:14px;padding:28px 34px 30px", hd("Hoy", `<span style="font-size:14px;font-weight:300">${L2(`${items.length} ${items.length === 1 ? "momento" : "momentos"}`, `${items.length} ${items.length === 1 ? "moment" : "moments"}`)}</span>`) + `<div class="tline">${shown.map((i, k) => `<div class="tli" style="--c:${i.c};animation-delay:${(.1 + k * .12).toFixed(2)}s"><small>${tsHM(i.ts)}</small><span data-notr>${esc(i.t)}</span></div>`).join("") || `<span class="vs" style="padding:0">Aún no hay momentos. Háblame o registra agua y comidas.</span>`}
      ${n ? `<div class="tli next" style="--c:#8FB0FF;animation-delay:${(.1 + shown.length * .12).toFixed(2)}s"><small style="color:#8FB0FF;font-weight:400">${L2("Próximo", "Next")} · ${n.h}</small><span>${esc(AV.t(n.t))}</span></div>` : ""}</div>`); },

  avisos: () => { const f = findingsCat();
    return vw("gap:10px;padding:28px 30px 30px", hd("Avisos", `<span style="font-size:14px;color:${f.length ? "#F2C27B" : "#8FD9A8"}">${f.length ? L2(`${f.length} ${f.length === 1 ? "nuevo" : "nuevos"}`, `${f.length} new`) : "Todo en orden"}</span>`) + `<div style="display:flex;flex-direction:column;gap:8px;margin-top:4px">${f.slice(0, 4).map((x, i) =>
      `<button class="arow fu" data-go="aviso:${encodeURIComponent(x.title)}" style="animation-delay:${(.05 + i * .07).toFixed(2)}s"><span class="d" style="${x.severity === "watch" ? "border:2px solid #A8A29E" : `background:${SEVC[x.severity]}`}"></span><span class="x"><b>${CATN[x.cat][0]}</b><small>${esc(x.title)}</small></span></button>`).join("")
      || `<div style="display:flex;flex-direction:column;align-items:center;gap:10px;margin-top:50px;text-align:center"><span style="width:56px;height:56px;border-radius:50%;background:#12261A;color:#8FD9A8;display:flex;align-items:center;justify-content:center">${I.check(22)}</span><span style="font-size:18px;font-weight:500">Todo en orden</span><span class="vs">Si algo cambia en tu sueño, voz, comida o signos, te aviso aquí.</span></div>`}</div>`); },

  sync: () => { const d = W.d, s = W.syncing > Date.now(), linkOk = d.last_rx && Date.now() / 1000 - d.last_rx < 20;
    const box = ic => `<span style="width:64px;height:64px;border-radius:20px;background:#141416;color:#D6D3D1;display:flex;align-items:center;justify-content:center">${ic}</span>`;
    return vw("gap:18px", hd("Estación") + `<div style="display:flex;align-items:center;gap:10px;margin-top:16px">${box(I.watchBox)}<span aria-hidden="true" style="width:84px;height:16px;display:flex;align-items:center;justify-content:space-between">${s ? [0, .25, .5].map(t => `<span style="width:7px;height:7px;border-radius:50%;background:#8FB0FF;animation:flow 1.6s ease-in-out ${t}s infinite"></span>`).join("") : `<span style="flex:1;height:2px;border-radius:1px;background:${linkOk ? "#8FD9A8" : "#F2C27B"}"></span>`}</span>${box(I.monitor)}</div>
    ${s ? `<div style="display:flex;flex-direction:column;align-items:center;gap:4px;text-align:center"><span style="font-size:24px;font-weight:500">Enviando…</span><span style="font-size:15px;font-weight:300;color:#A8A29E">Al servidor de la estación</span></div>`
      : linkOk ? `<div class="fu" style="display:flex;flex-direction:column;align-items:center;gap:4px;text-align:center;animation-duration:.4s"><span style="display:flex;align-items:center;gap:10px;font-size:24px;font-weight:500"><span style="width:26px;height:26px;border-radius:50%;background:#8FD9A8;display:flex;align-items:center;justify-content:center;animation:popIn .4s ease-out both">${I.check(14, "#0A0A0B", 3)}</span>Sincronizado</span><span style="font-size:15px;font-weight:300;color:#A8A29E">El médico de vuelo ya ve tus datos</span></div>`
      : `<div style="display:flex;flex-direction:column;align-items:center;gap:4px;text-align:center"><span style="font-size:24px;font-weight:500;color:#F2C27B">Guardado en el reloj</span><span style="font-size:15px;font-weight:300;color:#A8A29E">Se envía cuando vuelva el enlace</span></div>`}
    <span style="font-size:12px;font-weight:300;color:#A8A29E;text-align:center;line-height:1.5">${L2('Último envío hace <span data-l="rxage"></span> · en memoria: <span data-l="buf"></span><br>Tierra: <span data-l="earth"></span>', 'Last sent <span data-l="rxage"></span> ago · in memory: <span data-l="buf"></span><br>Earth: <span data-l="earth"></span>')}</span>
    <button class="pb" data-act="sync" style="margin-top:auto;background:#141416;color:#F2F2F0!important;font-weight:400">Sincronizar otra vez</button>`, "c"); },

  escucha: () => W.mic ? vw("gap:14px;padding:26px 32px 32px", edgeGlow + glowV({h: "78%", bottom: "-14%", anim: "glowLive 2.6s ease-in-out infinite", d: [4.5, 5.5, 5, 6.5], o4: .75}) + `
    <div class="vh"><button data-act="back" aria-label="Volver" style="width:44px;height:44px;display:flex;align-items:center">${I.chev22}</button><span style="display:flex;align-items:center;gap:8px;font-size:14px;font-weight:400;color:#8FD9A8"><span class="dot"></span>Lista para escucharte</span></div>
    <button class="fu" data-act="side" style="margin-top:70px;display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center;animation-duration:.6s"><span style="font-size:30px;font-weight:500">Te escucho</span><span style="font-size:16px;font-weight:300;color:#D6D3D1">Háblame cuando quieras</span><span style="margin-top:6px;font-size:13px;font-weight:300;color:#A8A29E">Solo te escucho cuando me hablas · recuerdo lo que me cuentas</span></button>
    <button class="pghost" data-act="pause15" style="margin-top:auto;align-self:stretch;height:54px;border-radius:27px">Pausar 15 min</button>`, "c")
    : vw("gap:14px;padding:26px 32px 32px", `<div class="vh"><button data-act="back" aria-label="Volver" style="width:44px;height:44px;display:flex;align-items:center">${I.chev22}</button><span style="display:flex;align-items:center;gap:8px;font-size:14px;font-weight:400;color:#A8A29E"><span style="width:7px;height:7px;border-radius:2px;background:#A8A29E"></span>En pausa</span></div>
    <div style="margin-top:40px;width:96px;height:96px;border-radius:50%;background:#141416;display:flex;align-items:center;justify-content:center;color:#A8A29E">${I.micOff}</div>
    <div class="fu" style="display:flex;flex-direction:column;align-items:center;gap:4px;text-align:center"><span style="font-size:24px;font-weight:500">En pausa</span><span style="font-size:16px;font-weight:300;color:#A8A29E">${L2("Vuelvo a escuchar en", "Listening again in")} <span data-l="micleft"></span></span></div>
    <button class="pb" data-act="resume" style="margin-top:auto;background:#4F7BFF;color:#FFFFFF!important">Reanudar ahora</button>`, "c"),

  voz: () => { const vl = voiceLast(), ix = vl && vl.indices;
    if (!vl) return vw("gap:12px", hd("Energía") + `<div style="position:relative;width:240px;height:132px;margin-top:8px">${arcSvg(0, "#3A3A40", false)}<span class="arcl" style="position:absolute;left:0;right:0;bottom:4px;text-align:center;font-size:32px;font-weight:500">—</span></div>
      <span style="font-size:15px;font-weight:300;color:#A8A29E;text-align:center">Aún no te he escuchado hoy</span><span style="font-size:15px;font-weight:400;color:#D6D3D1;text-align:center">Háblame con el botón lateral y te digo cómo suena tu energía.</span>
      <button class="pb" data-act="side" style="margin-top:auto;background:#2DD4BF">Hablar ahora</button>`, "c");
    const prev = (W.d.voice || [])[1], cmp = prev ? (ix.energy > prev.indices.energy + 5 ? L2("algo más alta que la vez anterior", "a bit higher than last time") : ix.energy < prev.indices.energy - 5 ? L2("algo más baja que la vez anterior", "a bit lower than last time") : L2("parecida a la vez anterior", "similar to last time")) : L2("primera medición", "first measurement");
    return vw("gap:12px", hd("Energía") + `<div style="position:relative;width:240px;height:132px;margin-top:8px">${arcSvg(ix.energy, energyColor(ix), true, `Energía estimada por tu voz: ${energyWord(ix).toLowerCase()}`)}<span style="position:absolute;left:0;right:0;bottom:4px;text-align:center;font-size:32px;font-weight:500">${energyWord(ix)}</span></div>
    <span style="font-size:15px;font-weight:300;color:#A8A29E;text-align:center">${L2(`Según tu voz de las ${tsHM(vl.ts)}, ${cmp}`, `Based on your voice at ${tsHM(vl.ts)}, ${cmp}`)}</span>
    <span class="fu" style="font-size:15px;font-weight:400;color:#D6D3D1;text-align:center;animation-delay:.5s">${esc(cap(ix.explanations.slice(0, 2).join(" · ")))}</span>
    <button class="pb fu" data-go="respira" style="margin-top:auto;background:${energyColor(ix)};animation-delay:.65s">Pausa de 1 minuto</button>`, "c"); },

  tension: () => { const vs = (W.d.voice || []).filter(v => v.indices.stress >= 65 && sameDay(v.ts)), vl = voiceLast();
    const sub = vs.length > 1 ? L2(`Lo noté ${vs.length} veces hoy, desde las ${tsHM(vs[vs.length - 1].ts)}`, `I noticed it ${vs.length} times today, since ${tsHM(vs[vs.length - 1].ts)}`)
      : vl ? L2(`Lo noté a las ${tsHM(vl.ts)} · tensión ${vl.indices.stress}/100`, `I noticed it at ${tsHM(vl.ts)} · tension ${vl.indices.stress}/100`) : "";
    return vw("gap:16px;padding:40px 32px 32px", `<div style="position:relative;width:104px;height:104px;display:flex;align-items:center;justify-content:center"><span style="position:absolute;inset:0;border-radius:50%;background:#F2C27B;animation:glowpulse 5s ease-in-out infinite"></span><span style="position:relative;width:72px;height:72px;border-radius:50%;background:#1A150C;border:1.5px solid #F2C27B;box-sizing:border-box;display:flex;align-items:center;justify-content:center;color:#F2C27B">${I.wave}</span></div>
    <div class="fu" style="display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center;animation-duration:.6s;animation-delay:.15s"><span style="font-size:22px;font-weight:500;line-height:1.35">Tu voz suena más tensa que de costumbre</span><span style="font-size:15px;font-weight:300;color:#A8A29E">${sub}</span></div>
    <div class="bottom fu" style="animation-delay:.3s"><button class="pb" data-go="respira" style="background:#F2C27B">Pausa de 1 minuto</button><button class="tlink" data-act="home">Ahora no</button></div>`, "c"); },

  respira: () => { const done = W.breath && W.breath.done;
    return vw("justify-content:space-between;padding:34px", glowV({h: "100%", anim: done ? "glowIdle 7s ease-in-out infinite" : "rise 9s ease-in-out infinite", d: [12, 14, 13, 16]}) + `
    <span style="font-size:15px;font-weight:300;color:#D6D3D1">${done ? "Pausa completa" : `Pausa · <span data-l="breathleft">1:00</span>`}</span>
    <div style="position:relative;width:200px;height:60px;display:flex;align-items:center;justify-content:center">${done ? `<span style="font-size:32px;font-weight:500;animation:popIn .4s ease-out both">Muy bien</span>`
      : `<span style="position:absolute;font-size:32px;font-weight:500;color:#FFFFFF;text-shadow:0 1px 16px rgba(0,0,0,.5);animation:inA 9s ease-in-out infinite">Inhala</span><span style="position:absolute;font-size:32px;font-weight:500;color:#FFFFFF;text-shadow:0 1px 16px rgba(0,0,0,.5);animation:inB 9s ease-in-out infinite">Exhala</span>`}</div>
    <button class="pghost" data-act="home">${done ? "Listo" : "Terminar"}</button>`, "c"); },

  recuerda: () => { const ch = (W.d.chat || []); const qi = [...ch].reverse().findIndex(m => m.role === "astronauta"); const q = qi >= 0 ? ch[ch.length - 1 - qi] : null;
    const a = q ? ch.slice(ch.indexOf(q) + 1).find(m => m.role === "ia") : null, ans = a ? a.text.replace(/^⚠️\s*/, "") : "Lo estoy pensando…", fs = ans.length > 160 ? 17 : ans.length > 90 ? 19 : 22;
    return vw("gap:14px;padding:40px 34px 32px", glowV({h: "52%", bottom: "-14%", anim: "glowTalk 3s ease-in-out infinite", d: [6, 7, 6.5, 8]}) + (q
      ? `<span class="fu" data-notr style="padding:0 4px;font-size:15px;font-weight:300;line-height:1.45;color:#A8A29E;animation-duration:.4s">«${esc(q.text)}»</span>
        <span class="fu scrolltxt" style="padding:0 4px;font-size:${fs}px;font-weight:500;line-height:1.4;max-height:220px;animation-duration:.6s;animation-delay:.3s">${esc(ans)}</span>
        <span class="fu" style="padding:0 4px;font-size:13px;font-weight:300;color:#A8A29E;animation-delay:.6s">${L2(`Te respondo con lo que me has contado · pregunta de las ${tsHM(q.ts)}`, `I answer with what you've told me · question at ${tsHM(q.ts)}`)}</span>`
      : `<span style="padding:0 4px;font-size:22px;font-weight:500;line-height:1.4">Pregúntame lo que quieras</span><span class="vs">Recuerdo lo que me cuentas: síntomas, comidas y lo que te dijo el médico.</span>`)
      + `<button class="pghost" data-act="home" style="margin-top:auto;align-self:center">Gracias</button>`); },

  anotado: () => { const r = W.result; if (!r) return vw("", hd("Te escuché") + `<span class="vs">Lo que me dices aparece aquí.</span>`);
    const ix = r.voice ? r.voice.indices : null, sym = r.voice ? r.voice.symptoms || [] : [], rows = [];
    if (r.cmd) rows.push(["#8FD9A8", "Registré", r.cmd]); else if (r.heard) rows.push(["#8FD9A8", "Nota", r.heard]);
    if (sym.length) rows.push(["#F2C27B", "Síntomas", sym.map(s => s.phrase).join(", ")]);
    if (ix) { rows.push(["#B9A7F5", "Ánimo", moodWord(ix)]); rows.push([energyColor(ix), "Energía", energyWord(ix), "voz"]); }
    const rr = rows.slice(0, 3), reply = r.reply ? r.reply.text.replace(/^⚠️\s*/, "") : "";
    return vw("gap:14px;padding:40px 32px 32px", `<div style="display:flex;align-items:center;gap:14px;padding:0 6px"><span style="width:46px;height:46px;flex-shrink:0;border-radius:50%;background:#8FD9A8;display:flex;align-items:center;justify-content:center;animation:popIn .5s ease-out both"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0A0A0B" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" stroke-dasharray="24" style="animation:check .5s ease-out .3s both"/></svg></span>
      <span style="display:flex;flex-direction:column;gap:2px"><span style="font-size:24px;font-weight:500">${r.voice ? "Anotado" : "Te respondo"}</span><span style="font-size:15px;font-weight:300;color:#A8A29E">${r.voice ? "Lo guardé en tu día" : "Respuesta de la estación"}</span></span></div>
    <div style="display:flex;flex-direction:column;gap:8px">${rr.map(([c, k, val, g], i) => `<${g ? "button" : "div"} class="lrow fu" ${g ? `data-go="${g}"` : ""} style="height:50px;animation-delay:${(.35 + i * .15).toFixed(2)}s"><span class="d" style="background:${c}"></span><span class="k">${k}</span><span ${k === "Nota" ? "data-notr" : ""} style="color:${c};max-width:190px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(val)}</span></${g ? "button" : "div"}>`).join("")}</div>
    ${reply ? `<span class="scrolltxt fu" style="font-size:14px;font-weight:300;line-height:1.45;color:#D6D3D1;padding:0 6px;max-height:${rr.length >= 3 ? 62 : 120}px;animation-delay:.7s">${esc(reply)}</span>` : ""}
    <div class="bottom fu" style="animation-delay:.8s"><button class="pb" data-act="home" style="background:#8FD9A8">Listo</button><button class="tlink" data-go="hoy">Ver mi día</button></div>`); },

  mensaje: () => { const m = W.msg || {};
    return vw("gap:14px;padding:40px 34px 32px", glowV({h: "52%", bottom: "-14%", anim: "glowTalk 3s ease-in-out infinite", cols: ["#9AB8FF", "#8B5CF6", "#2DD4BF"], d: [6, 7, 6.5]}) + `
    <span style="display:flex;align-items:center;gap:8px;padding:0 4px;font-size:14px;font-weight:400;color:#9AB8FF"><span class="dot" style="background:#9AB8FF"></span>${esc(m.title || "Mensaje")}</span>
    <span class="scrolltxt fu" data-notr style="padding:0 4px;font-size:20px;font-weight:500;line-height:1.4;max-height:230px">${esc(m.text || "")}</span>
    <span style="padding:0 4px;font-size:13px;font-weight:300;color:#A8A29E">${esc(m.sub || "")}</span>
    <button class="pghost" data-act="back" style="margin-top:auto;align-self:center">Entendido</button>`); },

  recordatorio: () => { const m = mealsToday().slice(-1)[0];
    return vw("gap:14px;padding:34px 32px", glowV({h: "64%", anim: "glowAsk 4s ease-in-out infinite", d: [7, 9, 8, 10]}) + `
    <span data-l="clock" style="font-size:15px;font-weight:300;color:#A8A29E"></span>
    <div class="fu" style="margin-top:56px;display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center;animation-duration:.6s;animation-delay:.15s"><span style="font-size:30px;font-weight:500">¿Ya almorzaste?</span><span style="font-size:16px;font-weight:300;line-height:1.45;color:#A8A29E">${m ? L2(`Lo último que comiste fue a las ${tsHM(m.ts)}`, `The last thing you ate was at ${tsHM(m.ts)}`) : "Hoy no me has contado que comiste"}</span></div>
    <button class="fu" data-act="side" style="font-size:14px;font-weight:400;color:#D6D3D1;animation-duration:.6s;animation-delay:.3s">Solo dímelo en voz alta</button>
    <button class="pghost" data-act="back" style="margin-top:auto">Más tarde</button>`, "c"); }
};

// avisos individuales: cada categoría con su gráfica de la semana, como en el canvas
function avisoView(key) {
  const x = findingsCat().find(f => f.title === decodeURIComponent(key));
  if (!x) return vw("", hd("Avisos") + `<span class="vs">Este aviso ya se resolvió.</span>`);
  const [cn] = CATN[x.cat], wk = (W.d && W.d.week) || [], v = vit(), c = cnt(), vl = voiceLast();
  let chart = "", note = esc(x.evidence), acts = "";
  if (x.cat === "sueno") {
    chart = `<div role="img" aria-label="Horas de sueño de los últimos 7 días; la línea marca 6 horas" style="position:relative;height:96px;display:flex;align-items:flex-end;gap:10px;padding:0 4px;margin-top:4px">
      <span aria-hidden="true" style="position:absolute;left:4px;right:4px;bottom:66px;border-top:1.5px dashed #3F3F46"></span>${wk.map((d, i) => { const h = d.sleep_h || 0;
        return `<span style="flex:1;height:${Math.max(6, Math.min(96, h * 11)).toFixed(0)}px;border-radius:6px;background:${h < 6 ? "#F2C27B" : "#3A3358"};transform-origin:bottom;animation:upY 1s cubic-bezier(.2,.8,.2,1) ${(.05 + i * .07).toFixed(2)}s both"></span>`; }).join("")}</div>
      ${dayLetters(0, 10)}<span style="padding:0 4px;font-size:14px;font-weight:300;color:#A8A29E">Esta semana · la línea marca 6 horas</span>`;
    note = "";
    acts = W.reminders.dormir ? pdone("Te aviso a las 10:30 p. m.", "#1F1A33", "#D2C8FA", "margin-top:auto") : `<button class="pb" data-act="remind" data-arg="dormir" data-label="Hora de dormir 22:30" style="margin-top:auto;background:#B9A7F5">Avísame a las 10:30 p. m.</button>`;
  } else if (x.cat === "mente") {
    const es = wk.map(d => d.energy);
    chart = `<svg width="100%" height="60" viewBox="0 0 320 60" preserveAspectRatio="none" role="img" aria-label="Energía de tu voz en los últimos 7 días"><polyline points="${lineOf(es, 0, 100, 60)}" fill="none" stroke="#B9A7F5" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="420" vector-effect="non-scaling-stroke" style="animation:drawL 1.8s cubic-bezier(.2,.8,.2,1) .2s both"/></svg>`;
    note = (vl ? esc(cap(vl.indices.explanations.slice(0, 2).join(" · "))) + ". " : "") + L2("No es un diagnóstico, solo una señal para cuidarte.", "It's not a diagnosis, just a sign to look after yourself.");
    acts = `<div class="bottom">${W.doc ? pdone("El médico ya lo sabe", "#1F1A33", "#D2C8FA") : `<button class="pb" data-act="doctor" style="background:#B9A7F5">Avisar al médico de vuelo</button>`}<button class="tlink" data-go="respira">Prefiero respirar un momento</button></div>`;
  } else if (x.cat === "comida" && x.risk === "RENAL") {
    chart = `<div style="display:flex;flex-direction:column;gap:8px;padding:6px 4px 0"><span style="display:flex;justify-content:space-between;font-size:15px"><span style="color:#A8A29E">Agua de hoy</span><span><span data-l="water"></span> ${L2("de 8 vasos", "of 8 glasses")}</span></span><span style="display:block;height:6px;border-radius:3px;background:#1F1F22"><span style="display:block;height:6px;border-radius:3px;background:#8CCBF0;width:${clamp(c.water / 8 * 100, 3)}%;animation:grow 1.2s cubic-bezier(.2,.8,.2,1) both"></span></span><span style="display:flex;justify-content:space-between;font-size:15px"><span style="color:#A8A29E">Hidratación medida</span><span data-l="hyd"></span></span></div>`;
    acts = `<div class="bottom"><button class="pb" data-go="agua" style="background:#8CCBF0">Registrar agua</button></div>`;
  } else if (x.cat === "comida") {
    chart = `<div style="display:flex;flex-direction:column;gap:8px;padding:6px 4px 0"><div role="img" aria-label="Almuerzos de los últimos 7 días" style="display:flex;justify-content:space-between">${wk.map((d, i) =>
      `<span style="width:24px;height:24px;border-radius:50%;box-sizing:border-box;${d.lunch ? "background:#8FD9A8" : "border:2px solid #F2C27B"};animation:popIn .4s ease-out ${(.05 + i * .07).toFixed(2)}s both"></span>`).join("")}</div>${dayLetters(24)}</div>`;
    note = esc(L2("Lo noto porque no me has contado que almorzaste. ", "I notice because you haven't told me you had lunch. ")) + note;
    acts = W.reminders.almuerzo ? pdone("Te pregunto a las 12:30", "#12261A", "#8FD9A8", "margin-top:auto") : `<button class="pb" data-act="remind" data-arg="almuerzo" data-label="Preguntar por el almuerzo 12:30" style="margin-top:auto;background:#8FD9A8">Pregúntame a las 12:30</button>`;
  } else if (x.cat === "radiacion") {
    chart = `<div style="display:flex;align-items:baseline;gap:8px;padding:0 4px"><span data-l="rad" style="font-size:48px;font-weight:500;letter-spacing:-.03em;line-height:1"></span><span style="font-size:17px;font-weight:300;color:#A8A29E">µGy/h</span></div>`;
    acts = `<div class="bottom"><button class="pb" data-go="radiacion" style="background:#E8D36B">Ver radiación</button><button class="tlink" data-act="back">Entendido</button></div>`;
  } else if (x.cat === "reloj") {
    acts = `<div class="bottom"><button class="pb" data-act="syncOpen" style="background:#8CCBF0">Sincronizar ahora</button><button class="tlink" data-act="back">Entendido</button></div>`;
  } else {
    const hs = wk.map(d => d.rest_hr), ok = hs.filter(h => h != null), lo = Math.min(...ok) - 2, hi = Math.max(...ok) + 2, pts = lineOf(hs, lo, hi, 84, 10);
    chart = `<div style="position:relative;height:84px;margin:4px 4px 0"><svg width="100%" height="84" viewBox="0 0 320 84" preserveAspectRatio="none" role="img" aria-label="Pulso en reposo de los últimos 7 días">
      <polygon points="${pts} 320,84 0,84" fill="#F49B8E" opacity=".1" style="animation:fadeA 1.2s ease-out .8s both"/><polyline points="${pts}" fill="none" stroke="#F49B8E" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="420" vector-effect="non-scaling-stroke" style="animation:drawL 1.8s cubic-bezier(.2,.8,.2,1) .2s both"/></svg>
      <span style="position:absolute;left:0;bottom:4px;font-size:13px;font-weight:300;color:#A8A29E">${fmt(Math.min(...ok))}</span><span style="position:absolute;right:0;top:-4px;font-size:13px;font-weight:400;color:#F49B8E">${fmt(Math.max(...ok))}</span></div>`;
    acts = `<div class="bottom"><button class="pb" data-go="corazon" style="background:#F49B8E">Ver mi corazón</button><button class="tlink" data-act="back">Entendido</button></div>`;
  }
  return vw("gap:14px;padding:28px 34px 32px", hd(cn, `<span style="font-size:14px;color:${SEVC[x.severity] || "#A8A29E"}">${SEVN[x.severity] || ""}</span>`)
    + `<span class="vt fu">${esc(x.title)}</span>${chart}${note ? `<span class="vs fu" style="animation-delay:.4s;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden">${note}</span>` : ""}${acts}`);
}

const DIARY = [["sueno", "¿Cómo dormiste anoche?", ["Bien", "Regular", "Mal"]], ["animo", "¿Cómo te sientes ahora?", ["Tranquila/o", "Cansada/o", "Estresada/o"]],
  ["nota", "¿Qué te pesa más hoy?", ["La carga de la misión", "Extraño a mi familia", "Nada en especial"]]];
function diaryView() {
  const st = W.diary, q = DIARY[st.i], morning = new Date().getHours() < 12;
  const g = glowV({h: "48%", bottom: "-14%", anim: "glowDiary 5s ease-in-out infinite", d: [9, 11, 10]});
  const top = `<span style="font-size:14px;font-weight:300;color:#A8A29E">${morning ? L2("Charla de la mañana", "Morning check-in") : AV.t("Charla de bienestar")} · ${q ? L2(`${st.i + 1} de 3`, `${st.i + 1} of 3`) : nowHM()}</span>`;
  if (q) return vw("gap:14px;padding:30px 34px", g + top + `<span class="fu" style="margin-top:14px;min-height:64px;display:flex;align-items:center;text-align:center;font-size:22px;font-weight:500;line-height:1.35;animation-duration:.45s">${q[1]}</span>
    <div style="align-self:stretch;margin-top:auto;display:flex;flex-direction:column;gap:8px">${q[2].map(o => `<button class="op" data-act="diary" data-arg="${esc(o)}">${esc(o)}</button>`).join("")}</div>
    <button data-act="side" style="font-size:13px;font-weight:300;color:#A8A29E">Dímelo en voz alta o toca una opción</button>`, "c");
  return vw("gap:14px;padding:30px 34px", g + top + `<span style="margin-top:10px;width:44px;height:44px;border-radius:50%;background:#8FD9A8;display:flex;align-items:center;justify-content:center;animation:popIn .45s ease-out both">${I.check(20, "#0A0A0B", 2.8)}</span>
    <span style="font-size:20px;font-weight:500;text-align:center">${esc(L2(`Gracias, ${first()}. Lo guardé en tu diario.`, `Thanks, ${first()}. I saved it to your journal.`))}</span>
    <div style="align-self:stretch;display:flex;flex-direction:column;gap:6px">${DIARY.map(([k]) => `<span class="fu" style="display:flex;justify-content:space-between;gap:12px;padding:10px 14px;border-radius:14px;background:#141416;font-size:14px;animation-duration:.4s"><span style="font-weight:300;color:#A8A29E">${{sueno: "Sueño", animo: "Ánimo", nota: "Lo que más pesa"}[k]}</span><span style="font-weight:400;text-align:right">${esc(st.a[k] || "—")}</span></span>`).join("")}</div>
    <div style="margin-top:auto;align-self:stretch;display:grid;grid-template-columns:1fr 1fr;gap:8px"><button class="op" data-act="diaryReset">Repetir</button><button data-act="home" style="height:48px;border-radius:24px;background:#4F7BFF;color:#FFFFFF;font-size:15px;font-weight:500;text-align:center">Listo</button></div>`, "c");
}
function diaryPick(o) { const q = DIARY[W.diary.i]; if (!q) return; W.diary.a[q[0]] = o; W.diary.i++;
  if (W.diary.i >= DIARY.length) AV.post("/autorreportes", {tripulante: W.crew, sueno: W.diary.a.sueno, animo: W.diary.a.animo, nota: W.diary.a.nota}).then(poll);
  renderView(true); }
// respuestas del diario dichas en voz alta
const DV = [[/\bbien\b|\bgood\b|\bwell\b/, "Bien"], [/regular|so.?so|more or less/, "Regular"], [/\bmal\b|\bbad\b|poorly/, "Mal"], [/tranquil|calm|relaxed/, "Tranquila/o"],
  [/cansad|tired/, "Cansada/o"], [/estresad|stress/, "Estresada/o"], [/carga|misi[oó]n|workload|mission/, "La carga de la misión"], [/familia|family/, "Extraño a mi familia"], [/nada|nothing/, "Nada en especial"]];
function diaryVoice(text) { const q = DIARY[W.diary.i], t = (text || "").toLowerCase(); if (!q || !t) return false;
  for (const [re, o] of DV) if (re.test(t) && q[2].includes(o)) { diaryPick(o); return true; } return false; }

function renderView(force) {
  const name = W.stack[W.stack.length - 1], el = $("#view");
  if (!name) { if (force) { el.innerHTML = ""; W.viewHTML = null; } return; }
  if (!W.d || !W.d.card) { const h = vw("justify-content:center;gap:14px", `<span class="spinner"></span><span class="vt">Conectando con la estación…</span><span class="vs" style="text-align:center">${esc(W.connErr || "Recibiendo datos del reloj")}</span><button class="pghost" data-act="home">Volver</button>`, "c");
    if (el.__h !== h) { el.innerHTML = h; el.__h = h; } return; }
  let html;
  try { html = name.startsWith("aviso:") ? avisoView(name.slice(6)) : (V[name] ? V[name]() : vw("", hd("Volver"))); }
  catch (err) { console.error(err); html = vw("gap:10px", hd("Volver") + `<span class="vt">Esta vista no tiene datos todavía</span><span class="vs">${esc(String(err.message || err))}</span>`); }
  if (force || html !== W.viewHTML) { el.innerHTML = html; el.__h = html; W.viewHTML = html; AV.tr(el); if (force) { el.classList.remove("on"); void el.offsetWidth; el.classList.add("on"); } }
  live();
}

// ---------------------------------------------------------------- valores en vivo (sin re-render: no parpadea)
function live() {
  if (!W.d) return; const v = vit(), ri = radInfo(), c = cnt(), d = W.d, dic = c.dictated || {};
  const age = d.last_rx ? Date.now() / 1000 - d.last_rx : null, beat = (60 / Math.max(40, v.hr || 60));
  const hs = (W.shelterHist.length > 1 ? W.shelterHist : (W.radHist || []).slice(-12).map(p => p[1])).filter(x => x != null);
  const L = {clock: nowHM(), hr: fmt(v.hr), spo2: `${fmt(v.spo2)} %`, temp: `${fmt(v.skin_temp, 1)} °C`, bp: dic.bp ? dic.bp.value : `${fmt(v.sbp)}/${fmt(v.dbp)}`,
    glu: dic.glucose ? `${dic.glucose.value} mg/dL` : "—", rad: fmt(ri.rate), raddose: `≈ ${fmt(ri.mission, 1)} mSv`, radpct: `Dosis efectiva estimada: ${fmt(ri.pct, 1)} % del límite de carrera`,
    goes: `${fmt(ri.r.goes_10mev_pfu, 1)} pfu · ${ri.r.noaa_scale || "S0"}`, scale: ri.r.noaa_scale || "",
    radsrc: `${ri.r.source === "LIVE" ? L2(`Dosímetro ${(ri.r.radlab_meta && ri.r.radlab_meta.instrument) || ""} real reproducido`, `Real ${(ri.r.radlab_meta && ri.r.radlab_meta.instrument) || ""} dosimeter replay`) : L2("Dosímetro simulado", "Simulated dosimeter")} · GOES ${fmt(ri.r.goes_10mev_pfu, 1)} pfu`,
    radtrend: hs.length > 2 ? (hs[hs.length - 1] < hs[0] * 0.9 ? L2("y bajando", "and falling") : hs[hs.length - 1] > hs[0] * 1.1 ? L2("y subiendo", "and rising") : L2("estable", "steady")) : "",
    water: c.water, watermeta: c.water >= 8 ? "Meta del día cumplida" : L2(`Te faltan ${8 - c.water === 1 ? "1 vaso" : `${8 - c.water} vasos`}`, `${8 - c.water} to go`), hyd: `${fmt((v.hydration || 0) * 100)} %`,
    stormdose: fmt(W.stormDose, 2), rxage: age === null ? "—" : `${fmt(age)} s`, buf: L2(`${d.buffered || 0} muestras`, `${d.buffered || 0} samples`), earth: d.dtn.contact ? L2("en contacto", "in contact") : L2("sin señal, los datos esperan a bordo", "no signal, data waits on board"),
    micleft: W.micUntil ? `${Math.max(0, Math.ceil((W.micUntil - Date.now()) / 60000))} min` : L2("15 minutos", "15 minutes"),
    breathleft: W.breath && !W.breath.done ? `0:${String(Math.max(0, Math.ceil((W.breath.end - Date.now()) / 1000))).padStart(2, "0")}`.replace("0:60", "1:00") : "0:00"};
  const vl = voiceLast(), ix = vl && vl.indices, m = mealsToday().length;
  const HOY = {rad: [`${fmt(ri.rate)} µGy/h · ${ri.storm ? L2("tormenta", "storm") : ri.rate > 50 ? L2("elevada", "elevated") : L2("normal", "normal")}`, ri.pos], body: [`${fmt(v.hr)} ${L2("lpm", "bpm")}`, card().score || 0],
    mind: [moodWord(ix), mindPct()], food: [L2(`${m} de 3 · ${c.water} vasos`, `${m} of 3 · ${c.water} glasses`), (m / 3) * 60 + (c.water / 8) * 40], energy: [energyWord(ix), ix ? ix.energy : 0]};
  $$("#screen [data-l]").forEach(el => { const k = el.dataset.l;
    if (k.startsWith("hv-")) { const val = AV.t(HOY[k.slice(3)][0]); if (el.textContent !== val) el.textContent = val; return; }
    if (k.startsWith("hb-")) { el.style.width = clamp(HOY[k.slice(3)][1], 3) + "%"; return; }
    if (k === "radmk") { el.style.left = ri.pos + "%"; return; }
    if (k === "radbar") { el.style.width = clamp(ri.pct, 2) + "%"; return; }
    if (k === "waterfill") { el.style.height = Math.round(Math.min(1, c.water / 8) * 92) + "%"; return; }
    if (k === "beat") { el.style.animationDuration = beat.toFixed(2) + "s"; return; }
    if (k === "ecg") { el.style.animationDuration = (beat * 3.5).toFixed(2) + "s"; return; }
    if (k === "shelterline") { if (hs.length > 1) { const lo = Math.min(...hs) * 0.9, hi = Math.max(...hs) * 1.05 + 0.1; el.setAttribute("points", hs.map((y, i) => `${(i / (hs.length - 1) * 320).toFixed(0)},${(84 - (y - lo) / (hi - lo) * 76).toFixed(1)}`).join(" ")); } return; }
    if (k === "radst") { const h = `<span style="width:7px;height:7px;border-radius:50%;background:${ri.st[1]}"></span>${esc(AV.t(ri.st[0]))}`; if (el.__h !== h) { el.innerHTML = h; el.__h = h; el.style.color = ri.st[1]; } return; }
    if (k === "watermeta") el.style.color = c.water >= 8 ? "#8CCBF0" : "#A8A29E";
    if (L[k] !== undefined) { const val = AV.t(String(L[k])); if (el.textContent !== val) el.textContent = val; } });
}

// ---------------------------------------------------------------- pintar páginas, esfera y capas
function ring(label, pct, color, icon) {
  const off = 151 - 151 * clamp(pct ?? 0) / 100;
  return `<span class="ring"><span class="c" style="color:${color}"><svg class="p" width="56" height="56" viewBox="0 0 56 56" aria-hidden="true"><circle cx="28" cy="28" r="24" fill="none" stroke="#26262A" stroke-width="5"/><circle cx="28" cy="28" r="24" fill="none" stroke="${color}" stroke-width="5" stroke-linecap="round" stroke-dasharray="151" stroke-dashoffset="${off.toFixed(0)}"/></svg>${icon}</span><span>${label}</span></span>`;
}
function setHTML(sel, html) { const el = $(sel); if (el && el.__h !== html) { el.innerHTML = html; el.__h = html; AV.tr(el); } }
function paint() {
  $("#oldSrv").style.display = W.oldServer || (W.connErr && !W.d) ? "block" : "none"; $("#oldSrv").textContent = AV.t(W.connErr || "");
  if (!W.d || !W.d.card) { $("#clock").textContent = nowHM(); $("#micTxt").textContent = AV.t(W.connErr ? "Sin conexión con la estación" : "Conectando con la estación…"); return; }
  const d = W.d, c = d.card, v = c.vitals || {}, ri = radInfo(), f = findingsCat(), vl = voiceLast(), ix = vl && vl.indices, cn = cnt(), m = mealsToday().length;
  if (W.micUntil && Date.now() > W.micUntil) { W.mic = true; W.micUntil = 0; }
  $("#clock").textContent = nowHM(); $("#dayLbl").textContent = AV.t(`Día ${d.mission.day} de misión`);
  const linkOk = d.last_rx && Date.now() / 1000 - d.last_rx < 20;
  $("#micDot").style.background = !linkOk ? "#A8A29E" : W.mic ? "#8FD9A8" : "#A8A29E";
  $("#micTxt").textContent = AV.t(!linkOk ? "Sin enlace con la estación" : W.mic ? "Lista para escucharte" : "Micrófono en pausa");
  const cr = $("#chipRad"); cr.textContent = AV.t(ri.storm ? "Tormenta solar" : ri.rate > 50 ? "Radiación alta" : "Radiación normal"); cr.style.cssText = `color:${ri.st[1]};background:${ri.st[2]}`;
  const ca = $("#chipAl"); ca.textContent = AV.t(f.length ? `${f.length} ${f.length === 1 ? "aviso" : "avisos"}` : "Sin avisos"); ca.style.cssText = f.length ? "color:#F2C27B;background:#2A2112" : "color:#8FD9A8;background:#12261A";
  setHTML("#rings", ring("Cuerpo", c.score ?? 0, "#F49B8E", I.heart) + ring("Mente", mindPct(), "#B9A7F5", I.mind) + ring("Comida", Math.min(100, (cn.water / 8) * 50 + m * 17), "#8FD9A8", I.fork));
  const pal = {"Atención": ["#F2C27B", "#F49B8E", "#8B5CF6"], "Crítica": ["#FF8A7A", "#F49B8E", "#FF5A4A"]}[c.status] || ["#4F7BFF", "#8B5CF6", "#2DD4BF"];
  pal.forEach((col, i) => scr.style.setProperty("--c" + (i + 1), col));
  // páginas
  const r = routineState(), n = nextRoutine();
  setHTML("#pgAgenda", r.map(x => n && x.k === n.k ?`<span class="nx"><small>Siguiente · ${x.h}</small><b>${esc(x.t + x.short)}</b></span>`
    : `<span class="it" style="color:${x.done ? "#A8A29E" : x.past ? "#F2C27B" : "#D6D3D1"}"><span class="h">${x.h}</span><span class="x">${esc(x.t + x.short)}</span>${x.done ? '<span style="color:#8FD9A8">✓</span>' : x.past ? "<span>Falta</span>" : ""}</span>`).join(""));
  const sleepShort = (v.sleep_h || 0) < 6, mindWarn = ix && (ix.stress >= 65 || ix.mood <= 30);
  setHTML("#pgDia", [["Cuerpo", `${fmt(v.hr)} lpm`, c.score || 0, "#F49B8E", false], ["Mente", moodWord(ix), mindPct(), "#B9A7F5", mindWarn],
    ["Comida y agua", L2(`${m} de 3 · ${cn.water} vasos`, `${m} of 3 · ${cn.water} glasses`), (m / 3) * 60 + (cn.water / 8) * 40, "#8FD9A8", false], ["Sueño", AV.hm(v.sleep_h), (v.sleep_h || 0) / 8 * 100, "#9B83F5", sleepShort]]
    .map(([l, val, p, col, warn]) => `<span class="bar4"><span class="t"><span>${l}</span><b style="color:${warn ? "#F2C27B" : "#D6D3D1"}">${val}</b></span><span class="b"><i style="width:${clamp(p, 3)}%;background:${col}"></i></span></span>`).join(""));
  $("#pgRad").textContent = fmt(ri.rate); $("#pgRadSt").textContent = AV.t(ri.st[0]); $("#pgRadSt").style.color = ri.st[1]; $("#pgRadMk").style.left = ri.pos + "%";
  $("#pgRadDose").textContent = AV.t(`≈ ${fmt(ri.mission, 1)} mSv en la misión · ${fmt(ri.pct, 1)} % del límite`);
  $("#pgHeart").style.animationDuration = (60 / Math.max(40, v.hr || 60)).toFixed(2) + "s";
  $("#pgBpm").textContent = fmt(v.hr); $("#pgHeartSub").textContent = L2(`Oxígeno ${fmt(v.spo2)} % · ${fmt(v.skin_temp, 1)} °C piel`, `Oxygen ${fmt(v.spo2)} % · ${fmt(v.skin_temp, 1)} °C skin`);
  setHTML("#pgArc", arcSvg(ix ? ix.energy : 0, energyColor(ix), false) + `<span class="al">${energyWord(ix)}</span>`);
  $("#pgEnergySub").textContent = AV.t(ix ? cap(ix.explanations[0] || "") : "Háblame para medirla");
  // accesos rápidos
  const qs = (id, on, col, icon, spin) => { const el = $(id); setHTML(id, icon); el.classList.toggle("on", on); el.classList.toggle("spin", !!spin); el.style.background = on ? col : "#1C1C1F"; };
  const syncing = W.syncing > Date.now();
  qs("#qMic", W.mic, "#8FD9A8", I.mic); $("#qMicT").textContent = AV.t(W.mic ? "Micrófono" : "En pausa");
  qs("#qDnd", W.dnd, "#B9A7F5", I.moon); qs("#qSleep", W.sleep, "#9B83F5", I.bed);
  qs("#qSync", syncing, "#8FB0FF", I.sync, syncing); $("#qSyncT").textContent = AV.t(syncing ? "Enviando…" : "Sincronizar");
  qs("#qTorch", W.torch, "#F2F2F0", I.torch); qs("#qDoc", W.doc, "#F49B8E", I.plus); $("#qDocT").textContent = AV.t(W.doc ? "Avisado" : "Médico");
  $("#qStation").textContent = AV.t(linkOk ? "Estación conectada" : "Sin enlace con la estación"); $("#qBatt").textContent = AV.t(`Batería ${fmt(v.battery)} %`);
  // avisos (↑)
  setHTML("#sheetList", f.slice(0, 4).map(x => `<button class="sitem" data-go="aviso:${encodeURIComponent(x.title)}"><small style="color:${SEVC[x.severity] || "#A8A29E"}">${AV.t(CATN[x.cat][0])} · ${tsHM(x.ts)}</small><span>${esc(x.title)}</span></button>`).join("")
    || `<span class="vs" style="padding:0 6px">Todo en orden. No hay avisos.</span>`);
  AV.tr($(".panelside"));
  live();
}
$("#agrid").innerHTML = APPS.map(([k, l, ic, bg, col]) => `<button class="app" data-go="${k}"><span class="ai" style="background:${bg};color:${col}">${ic}</span>${l}</button>`).join("");

// ---------------------------------------------------------------- voz: brillo reactivo, palabra de activación, comandos
// El brillo del canvas (manchas de color) crece y se aviva con la amplitud de la voz del astronauta o del reloj.
class Glow {
  constructor(el, base) { this.el = el; this.amp = 0; this.target = 0; this.base = base || 0; this.last = "";
    const loop = () => { this.frame(); requestAnimationFrame(loop); }; requestAnimationFrame(loop); }
  push(level) { this.target = Math.max(this.target, Math.max(0, Math.min(1, level))); }
  frame() {
    this.amp += (Math.max(this.base, this.target) - this.amp) * 0.2; this.target *= 0.9;
    const a = this.amp < 0.01 ? 0 : this.amp, t = a ? `scaleY(${(1 + a * 0.55).toFixed(3)}) scaleX(${(1 + a * 0.12).toFixed(3)})` : "";
    if (t !== this.last) { this.last = t; this.el.style.transform = t; this.el.style.filter = a > 0.05 ? `brightness(${(1 + a * 0.6).toFixed(2)}) saturate(${(1 + a * 0.4).toFixed(2)})` : ""; }
  }
}
const auroraListen = new Glow($("#glowListen")), auroraFace = new Glow($("#glowFace"));
const dbLevel = db => Math.max(0, Math.min(1, (db + 62) / 42));
// el reloj "habla": el brillo sigue la voz sintetizada
function say(text, then) {
  const t = String(text || "").replace(/^⚠️\s*/, "");
  if (!$("#tts").checked || W.dnd || !window.speechSynthesis || !t) { then ? setTimeout(then, 300) : setTimeout(wakeStart, 300); return; }
  W.speaking = true; W.speakAt = Date.now(); wakeStop();
  const pulse = setInterval(() => { const l = 0.35 + Math.random() * 0.45; auroraListen.push(l); auroraFace.push(l * 0.8); }, 90);
  let done = false;
  const fin = () => { if (done) return; done = true; clearInterval(pulse); W.speaking = false; then ? then() : setTimeout(wakeStart, 250); };
  AV.say(t, {onend: fin, onboundary: () => { auroraListen.push(1); auroraFace.push(0.9); }});
  setTimeout(fin, 4000 + t.length * 110);          // respaldo general
}

function listenUI(title, sub, btn, act) { $("#lsT").textContent = AV.t(title); $("#lsS").textContent = AV.t(sub || ""); $("#lsBtn").textContent = AV.t(btn || "Listo"); $("#lsBtn").dataset.act = act || "listenDone"; }
async function startListen(auto) {
  if (W.rec) return;
  const wasOn = WAKE.on || WAKE.rec; wakeStop(); if (W.stack.length) W.returnTo = W.stack.slice(); W.layer = "listen"; W.stack = []; renderView(true); applyLayers();
  listenUI("Te escucho", "Háblame cuando quieras");
  W.rec = {pending: true};                                   // reserva: evita dos grabaciones a la vez
  if (wasOn) await new Promise(r => setTimeout(r, 350));    // Chrome solo permite un reconocedor de voz a la vez
  const t0 = Date.now(); let spoke = false, lastLoud = 0;
  W.rec = null;
  W.rec = new AV.Recorder(db => {
    auroraListen.push(dbLevel(db));
    if (!auto) return;                                    // con botón: el usuario decide cuándo termina
    const now = Date.now(), rc = W.rec;
    if (db > -46) { if (!spoke && now - t0 > 250) spoke = true; lastLoud = now; }
    // cierre rápido: en cuanto dejan de entrar letras al dictado se responde (no se corta mientras sigan llegando)
    if (rc && rc.transcript) {
      const quiet = now - (rc.lastTextAt || now);
      if ((rc.lastFinal && quiet > 450) || quiet > 1000 || now - t0 > 15000) finishListen();
      return;
    }
    if (spoke && now - lastLoud > 1300 && now - t0 > 2500) finishListen();   // sin dictado: por silencio del micrófono
    else if (!spoke && now - t0 > 7000) cancelListen("No te escuché. Di “Hey Sanbosi” cuando quieras.");
    else if (now - t0 > 15000) finishListen();
  });
  W.rec.onText = t => $("#lsS").textContent = "“" + t + "”";
  try { await W.rec.start(); $("#ptt").classList.add("rec"); $("#ptt").textContent = AV.t(auto ? "Escuchando… (se envía al terminar)" : "Suelta para enviar"); }
  catch (err) { W.rec = null; listenUI("Sin micrófono", "Permite el micrófono en el navegador. " + String(err).slice(0, 60), "Cerrar", "home"); }
}
async function cancelListen(msg) { const r = W.rec; W.rec = null; if (r && r.stop) await r.stop(); resetPtt(); listenUI("Aquí estoy", msg, "Cerrar", "home"); setTimeout(() => { if (W.layer === "listen" && !W.rec) { W.layer = null; applyLayers(); } wakeStart(); }, 2500); }
function resetPtt() { $("#ptt").classList.remove("rec"); $("#ptt").textContent = AV.t("Mantén presionado para hablarle"); }
// si hablaba desde el diario, la respuesta se toma como opción del diario y se vuelve a él
function backToDiary(text) {
  if (W.returnTo[W.returnTo.length - 1] !== "diario") return false;
  W.stack = W.returnTo.slice(); W.returnTo = []; W.layer = null;
  if (!diaryVoice(text)) banner("Charla de bienestar", L2("No entendí la opción. Tócala o repítela.", "I didn't catch the option. Tap it or say it again."));
  renderView(true); applyLayers(); return true;
}
async function finishListen() {
  if (!W.rec || W.rec.pending) { W.rec = null; W.layer = null; applyLayers(); wakeStart(); return; }
  const r = W.rec; W.rec = null; resetPtt();
  const wav = await r.stop(), vars = r.variants ? r.variants() : [r.transcript || ""];
  let text = (vars[0] || "").trim();
  const hitVar = vars.find(v => matchCommand(v)); if (hitVar && !matchCommand(text)) text = hitVar.trim();
  if (backToDiary(text)) { AV.sendVoice(W.crew, wav, text, !!W.calibrate, 0).then(res => { if (res && res.voice) showVoice(res.voice); poll(); }).catch(() => {}); W.calibrate = false; wakeStart(); return; }
  W.returnTo = [];
  const cmd = matchCommand(text), cal = !!W.calibrate; W.calibrate = false;
  // el audio (análisis de voz) viaja en paralelo; la respuesta no lo espera
  const voiceP = AV.sendVoice(W.crew, wav, text, cal, 0, text && !cmd ? 0 : 1)
    .then(res => { if (res && res.voice) { W.lastVoiceTs = res.voice.ts; showVoice(res.voice); if (W.result) W.result.voice = res.voice; } poll(); return res; })
    .catch(() => null);
  if (cmd) { W.result = {heard: text, cmd: cmd.label, voice: null}; W.resultAt = Date.now(); W.layer = null; applyLayers(); runCommand(cmd, text); return; }
  if (!text) {                                    // no hubo dictado: solo se analiza cómo sonó la voz
    W.layer = null; W.syncing = Date.now() + 60e3; go("sync");
    const res = await voiceP; W.syncing = 0;
    if (!res || res.error) { W.msg = {title: "No te escuché bien", text: (res && res.error) || "No pude hablar con la estación"}; W.stack = ["mensaje"]; renderView(true); applyLayers(); wakeStart(); return; }
    W.result = {...res, heard: "", cmd: null}; W.resultAt = Date.now(); W.stack = ["anotado"]; renderView(true); applyLayers(); say("Lo guardé en tu día."); return;
  }
  listenUI("Pensando…", `“${text}”`, "Cerrar", "home");
  let reply = null;
  try { reply = await AV.post(`/api/chat/${W.crew}`, {text, source: "voz"}); } catch (e) {}
  if (!reply || reply.error) { W.layer = null; W.msg = {title: "No te escuché bien", text: "No pude hablar con la estación"}; W.stack = ["mensaje"]; renderView(true); applyLayers(); wakeStart(); return; }
  W.result = {heard: text, cmd: null, reply, voice: null}; W.resultAt = Date.now(); if (reply.ts) W.since = Math.max(W.since, reply.ts);
  W.layer = null; W.stack = ["anotado"]; renderView(true); applyLayers();
  say(reply.text);
  poll();
}
function showVoice(v) { const ix = v.indices, h = ix.vs_habitual || {};
  $("#vres").innerHTML = `<div style="display:flex;justify-content:space-around;flex-wrap:wrap;gap:6px">${AV.gauge(ix.energy, "Energía", "#2DD4BF")}${AV.gauge(ix.stress, "Tensión", "#F49B8E")}${AV.gauge(ix.mood, "Ánimo", "#B9A7F5")}</div>
  <p class="soft" style="margin:10px 0 0">Tono ${h.tono_pct ?? "—"} % · intensidad ${h.intensidad_db ?? "—"} dB · pausas ${h.pausas_pct ?? "—"} % · velocidad ${h.velocidad_pct ?? "—"} %</p><p class="lbl" style="margin:4px 0 0">${esc(ix.explanations.join("; "))}</p>`; AV.tr($("#vres")); }

// ---- comandos de voz (ES/EN) · se ejecutan en el reloj y se registran en la estación
const EN = () => AV.lang === "en";
const L2 = (es, en) => EN() ? en : es;
function dictation(t) {
  const bp = /(presi[oó]n|arterial|pressure)/.test(t) && t.match(/(\d{2,3})\s*(?:sobre|\/|con|over|-|por)\s*(\d{2,3})/);
  const gl = t.match(/(?:glucosa|gluc[oó]metro|az[uú]car|glucose|sugar)\D{0,24}(\d{2,3})/);
  const data = {}; if (bp) data.bp = `${bp[1]}/${bp[2]}`; if (gl) data.glucose = gl[1];
  return (data.bp || data.glucose) ? data : null;
}
const CMDS = [
  {test: t => !!dictation(t), label: "Anoté tu valor del control médico", run: () => { const d = dictation(W._t);
    act("dictation", {...d, label: [d.bp && `presión ${d.bp}`, d.glucose && `glucosa ${d.glucose} mg/dL`].filter(Boolean).join(" · ")}); go("corazon"); },
   reply: () => L2("Anotado. El médico de vuelo lo verá en tu ficha.", "Logged. The flight surgeon will see it in your record.")},
  {re: /(tom[eé]|beb[ií]|registra|anota|agrega|sum[ae]).{0,20}(agua|vaso)|(drank|drink|had|have|log|add|just).{0,25}(water|glass)|glass of water/, label: "Registré un vaso de agua", run: () => { act("water"); go("agua"); },
   reply: () => { const n = ((W.d.counters || {}).water || 0) + 1; return pickOne(L2([`Listo, llevas ${n} vasos hoy.`, `Anotado. ${n} de 8 vasos.`, `Perfecto, ${8 - n > 0 ? `te faltan ${8 - n}` : "meta cumplida"}.`], [`Done, that's ${n} glasses today.`, `Logged. ${n} of 8 glasses.`, `Great, ${8 - n > 0 ? `${8 - n} to go` : "goal reached"}.`])); }},
  {re: /(almorc|desayun|cen[eé]|com[ií]( |$)|ya com)|(had|ate|eat|eaten|finished|log|just had).{0,12}(lunch|breakfast|dinner|meal|food|snack)|i ate|i just ate/, label: "Registré tu comida", run: () => { const k = /desayun|breakfast/.test(W._t) ? "desayuno" : /cen|dinner/.test(W._t) ? "cena" : "almuerzo"; act("meal", {name: k, label: k}); go("momentos"); },
   reply: () => pickOne(L2(["Anotado en tu día.", "Listo, lo guardé en tus momentos.", "Perfecto, comida registrada."], ["Added to your day.", "Done, saved to your moments.", "Great, meal logged."]))},
  {re: /refugio|shelter/, label: "Estás en el refugio", run: () => ACTIONS.shelter(), reply: () => L2("Te aviso cuando sea seguro salir.", "I'll tell you when it's safe to leave.")},
  {re: /(m[eé]dico|doctor|doctora|surgeon|emergencia|emergency|call (the )?medic)/, label: "Avisé al médico de vuelo", run: () => { W.doc = false; ACTIONS.doctor(); go("sync"); }, reply: () => L2("Le avisé a la médico de vuelo. Te contactará pronto.", "I notified the flight surgeon. She'll contact you soon.")},
  {re: /sincroniz|sync|synchron/, label: "Sincronizando", run: () => ACTIONS.syncOpen(), reply: () => L2("Enviando tus datos a la estación.", "Sending your data to the station.")},
  {re: /(linterna|enciende la luz|flashlight|torch)/, label: "Linterna", run: () => ACTIONS.torch(), reply: () => ""},
  {re: /no molestar|do not disturb/, label: "No molestar", run: () => ACTIONS.dnd(), reply: () => W.dnd ? L2("No molestar activado.", "Do not disturb is on.") : L2("No molestar desactivado.", "Do not disturb is off.")},
  {re: /(respir|calm|relaj|ansios|breath|relax|anxious|panic|nervous|nervios)/, label: "Respiremos", run: () => go("respira"), reply: () => pickOne(L2(["Respira conmigo. Inhala…", "Vamos a calmarnos juntos. Inhala despacio…"], ["Breathe with me. Inhale…", "Let's slow down together. Breathe in…"]))},
  {re: /(radiaci[oó]n|dosis|tormenta|radiation|dose|solar storm|sun storm|cosmic)/, label: "Radiación", run: () => go("radiacion"),
   reply: () => { const ri = radInfo(); return pickOne(L2([`La radiación está en ${fmt(ri.rate)} microgray por hora. ${ri.st[0]}.`, `Ahora mismo ${fmt(ri.rate)} microgray por hora; llevas cerca de ${fmt(ri.mission, 1)} milisievert estimados en la misión.`],
      [`Radiation is ${fmt(ri.rate)} micrograys per hour. ${AV.t(ri.st[0])}.`, `Right now ${fmt(ri.rate)} micrograys per hour; about ${fmt(ri.mission, 1)} millisieverts estimated so far this mission.`])); }},
  {re: /(coraz[oó]n|pulso|ox[ií]geno|signos|presi[oó]n|temperatura|saturaci[oó]n|heart|pulse|oxygen|vitals|vital signs|blood pressure|temperature|saturation|bpm)/, label: "Signos vitales", run: () => go("corazon"),
   reply: () => { const v = vit(); return pickOne(L2([`Tu pulso está en ${fmt(v.hr)}, oxígeno ${fmt(v.spo2)} por ciento y temperatura de piel ${fmt(v.skin_temp, 1)} grados.`, `Ahora tienes ${fmt(v.hr)} latidos por minuto y ${fmt(v.spo2)} por ciento de oxígeno. Presión estimada ${fmt(v.sbp)} sobre ${fmt(v.dbp)}.`],
      [`Your pulse is ${fmt(v.hr)}, oxygen ${fmt(v.spo2)} percent and skin temperature ${fmt(v.skin_temp, 1)} degrees.`, `You're at ${fmt(v.hr)} beats per minute with ${fmt(v.spo2)} percent oxygen. Estimated pressure ${fmt(v.sbp)} over ${fmt(v.dbp)}.`])); }},
  {re: /(sueño|dorm[ií]|sleep|slept|how did i rest)/, label: "Sueño", run: () => go("sueno"), reply: () => { const h = vit().sleep_h || 0; return L2(`Anoche dormiste ${Math.floor(h)} horas y ${Math.round((h % 1) * 60)} minutos.`, `Last night you slept ${Math.floor(h)} hours and ${Math.round((h % 1) * 60)} minutes.`); }},
  {re: /(rutina|agenda|qu[eé] sigue|qu[eé] tengo|pendiente|schedule|routine|what'?s next|what is next|what do i have|to do list|my plan|plan for today)/, label: "Rutina", run: () => go("rutina"), reply: () => { const n = nextRoutine(); return n ? L2(`Lo siguiente es ${n.t} a las ${n.h}.`, `Next up: ${AV.t(n.t)} at ${n.h}.`) : L2("Terminaste tu rutina de hoy.", "You finished today's routine."); }},
  {re: /(diario|charla|journal|diary|check.?in|wellbeing|well being)/, label: "Charla de bienestar", run: () => { W.diary = {i: 0, a: {}}; go("diario"); }, reply: () => AV.t(DIARY[0][1])},
  {re: /(aviso|alerta|alert|warning|notification)/, label: "Avisos", run: () => go("avisos"), reply: () => { const f = findingsCat(); return f.length ? L2(`Tienes ${f.length} avisos. El primero: ${f[0].title}.`, `You have ${f.length} alerts. First: ${f[0].title}.`) : L2("No tienes avisos.", "You have no alerts."); }},
  {re: /(energ[ií]a|c[oó]mo (sueno|me escucho)|mi voz|energy|how do i sound|my voice)/, label: "Energía", run: () => go("voz"), reply: () => { const vl = voiceLast(); return vl ? L2(`Tu energía por la voz es ${energyWord(vl.indices).toLowerCase()}.`, `Your voice energy is ${AV.t(energyWord(vl.indices)).toLowerCase()}.`) : L2("Aún no te he medido.", "I haven't measured you yet."); }},
  {re: /(mi d[ií]a|resumen|c[oó]mo voy|c[oó]mo estoy|c[oó]mo me ves|my day|summary|how am i|how'?m i|how are things|my status|how do i look|am i ok)/, label: "Tu día", run: () => go("hoy"),
   reply: () => { const c = card(), v = vit(), f = findingsCat(); return pickOne(L2([`Tu estado general es ${AV.t(c.status || "Normal").toLowerCase()}. Pulso ${fmt(v.hr)}, dormiste ${AV.hm(v.sleep_h)}.`, f.length ? `Vas bien, pero hay ${f.length} avisos: ${f[0].title}.` : "Vas muy bien hoy, todo en tu rango habitual."],
      [`Overall you're ${AV.t(c.status || "Normal").toLowerCase()}. Pulse ${fmt(v.hr)}, you slept ${AV.hm(v.sleep_h)}.`, f.length ? `You're doing ok, but there are ${f.length} alerts: ${f[0].title}.` : "You're doing great today, everything within your usual range."])); }},
  {re: /(momentos|qu[eé] hice|moments|what did i do|my history)/, label: "Momentos", run: () => go("momentos"), reply: () => ""},
  {re: /^(ve al |ir al |go )?(inicio|esfera|cierra|salir|home|close|exit|go back|volver|regresa)\b/, label: "Inicio", run: () => home(), reply: () => ""},
];
function pickOne(a) { return a[Math.floor(Math.random() * a.length)]; }
const EXPLAIN_Q = /^\s*(qu[eé] (es|son)|por qu[eé]|explica|expl[ií]came|cu[eé]ntame (sobre|de)|h[aá]blame de|what (is|are)|why|explain|tell me about)\b/;
function matchCommand(text) { const tt = (text || "").toLowerCase().replace(/[¿?¡!.,]/g, " ").replace(/\s+/g, " ").trim(); if (!tt) return null; W._t = tt;
  if (EXPLAIN_Q.test(tt)) return null;          // "¿qué es la radiación?" → lo explica el asistente, no es un comando
  for (const c of CMDS) if (c.test ? c.test(tt) : c.re.test(tt)) return c; return null; }
function runCommand(cmd, text) { W._t = (text || "").toLowerCase(); cmd.run(); const r = cmd.reply(); banner(L2("Comando de voz", "Voice command"), `“${text}” → ${AV.t(cmd.label)}`); if (r) say(r); else wakeStart(); }

// ---- palabra de activación tolerante: saludo + algo que SUENE a “Sanbosi” (sambosi, san bossi, sam bossy, zambosi, sanbo see…)
const normT = s => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9ñ ]/g, " ").replace(/\s+/g, " ").trim();
const phon = s => s.replace(/ñ/g, "n").replace(/mb/g, "nb").replace(/mp/g, "np").replace(/v/g, "b").replace(/z/g, "s").replace(/c([ei])/g, "s$1").replace(/th/g, "s").replace(/ss+/g, "s")
  .replace(/ee|ie|ey|y$/g, "i").replace(/y/g, "i").replace(/h/g, "").replace(/oo/g, "o").replace(/ou/g, "o").replace(/w/g, "u");
function lev(a, b) { const m = a.length, n = b.length, d = Array.from({length: m + 1}, (_, i) => [i]); for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[m][n]; }
const GREET = /^(hey|hei|ei|ey|ay|ahi|oye|hola|ola|hi|hai|high|hy|heya|hello|helo|hallo|ok|okey|okay|oka|buenos|buenas|alo|halo|que|qué|yo|hiya|hay|a|eh|ah)$/;
// cómo suele "oír" el dictado en inglés la palabra Sanbosi (y en español con acento): se aceptan tal cual
const WAKE_ALIAS = /\b(somebody|some body|somebodies|somebody's|sunbody|sun body|sombody|sambody|sam body|somebossy|some bossy|sun bossy|son bossy|sam bossy|sam bossi|san bossy|sand bossy|sandbossy|samba see|samba si|sambo see|sambo si|sambosa|sambusa|santa bossy|saint bossy|sambo c|san bo si|some boss|sunbossy|sambossy|sanbossy|sanbossi|samboshi|sanboshi|sambosi|sanbosi)\b/;
function findWake(text) {
  const nt = normT(text), w = nt.split(" ").filter(Boolean);
  // 1) alias conocidos ("hi somebody", "hey sam bossy"…): basta con que aparezcan al inicio o tras un saludo
  const m = nt.match(WAKE_ALIAS);
  if (m) {
    const before = nt.slice(0, m.index).trim().split(" ").filter(Boolean);
    if (before.length === 0 || before.slice(-2).some(x => GREET.test(x))) return {rest: nt.slice(m.index + m[0].length).trim(), raw: text};
  }
  // 2) parecido fonético (sambosi, zan bosi, mambosi…)
  for (let i = 0; i < w.length; i++) {
    const greet = w.slice(Math.max(0, i - 2), i).some(x => GREET.test(x)) || i === 0;
    let best = null;
    for (let len = 1; len <= 4 && i + len <= w.length; len++) {
      const cand = phon(w.slice(i, i + len).join("")); if (cand.length < 5 || cand.length > 12 || !(greet ? /^[scmbtzpf]/ : /^[sc]/).test(cand) || !(greet ? /[bpt][ou]/ : /[bp][ou]/).test(cand)) continue;
      const alt = Math.min(lev(cand, "sanbosi"), lev(cand, "sanbos"), lev(cand, "sanbosis"), lev(cand, "sanbosisi"));
      if ((alt <= 2 || (greet && alt <= 3)) && (!best || alt <= best.alt)) best = {alt, len};
    }
    if (best) return {rest: w.slice(i + best.len).join(" "), raw: text};
  }
  return null;
}
const WAKE = {rec: null, on: false, want: false, busy: false, busyAt: 0, lastEvt: 0, fails: 0, lastFinalAt: 0, hitFrom: 0};
const RING = new AV.AudioRing(12);
function wakeSupported() { return !!(window.SpeechRecognition || window.webkitSpeechRecognition); }
function setBusy(v) { WAKE.busy = v; WAKE.busyAt = v ? Date.now() : 0; }
function wakeStart() {
  if (!WAKE.want || !W.mic || W.rec || W.speaking || WAKE.on || WAKE.busy || !wakeSupported()) { wakeUI(); return; }
  if (!RING.on) RING.start();
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition, r = new SR();
  r.lang = AV.speechLang(); r.continuous = true; r.interimResults = true; r.maxAlternatives = 5;
  r.onstart = r.onaudiostart = r.onsoundstart = () => { WAKE.lastEvt = Date.now(); WAKE.fails = 0; };
  r.onresult = ev => {
    WAKE.lastEvt = Date.now();
    if (WAKE.busy || WAKE.rec !== r) return;
    const res = ev.results[ev.results.length - 1];
    auroraFace.push(0.35);
    // de todas las variantes que entendió el navegador, prefiere la que trae un comando reconocible
    const hits = []; for (let a = 0; a < res.length; a++) { const h = findWake(res[a].transcript); if (h) hits.push(h); }
    const heard = res[0].transcript.trim(); $("#wakeHeard").textContent = heard ? `“${heard}”` : "";
    if (!hits.length) { if (res.isFinal) WAKE.lastFinalAt = Date.now(); return; }
    const hit = hits.find(h => h.rest && matchCommand(h.rest)) || hits[0];
    if (!res.isFinal && hit.rest.split(" ").filter(Boolean).length >= 1 && hit.rest.split(" ").length < 3) return;   // frase en curso
    WAKE.hitFrom = Math.max(WAKE.lastFinalAt, Date.now() - 9000);   // audio de esta frase (desde que terminó la anterior)
    setBusy(true); wakeStop(); onWake(hit.rest.trim());
  };
  r.onend = () => { if (WAKE.rec !== r) return; WAKE.on = false; WAKE.rec = null; if (WAKE.want && !WAKE.busy) setTimeout(wakeStart, 250); wakeUI(); };
  r.onerror = e => {
    if (e.error === "not-allowed" || e.error === "service-not-allowed") { WAKE.want = false; banner("Micrófono", L2("El navegador no permitió la escucha continua.", "The browser blocked continuous listening.")); return; }
    if (e.error === "network" || e.error === "audio-capture") WAKE.fails++;   // onend la vuelve a abrir
  };
  try { r.start(); WAKE.rec = r; WAKE.on = true; WAKE.lastEvt = Date.now(); }
  catch (e) { WAKE.on = false; WAKE.rec = null; setTimeout(wakeStart, 500); }   // el reconocedor anterior aún no se liberaba: reintenta
  wakeUI();
}
function wakeStop() { const r = WAKE.rec; WAKE.on = false; WAKE.rec = null; if (r) { try { r.onend = null; r.abort(); } catch (e) {} } wakeUI(); }
// vigilante: la escucha nunca se queda apagada sin razón (pasa en Chrome tras errores de red, cortes o pestañas en segundo plano)
setInterval(() => {
  const now = Date.now();
  if (WAKE.busy && now - WAKE.busyAt > 25000 && !W.rec && !W.speaking) setBusy(false);
  if (WAKE.on && WAKE.rec && now - WAKE.lastEvt > 40000 && !W.rec && !W.speaking) { const r = WAKE.rec; WAKE.rec = null; WAKE.on = false; try { r.onend = null; r.abort(); } catch (e) {} }
  if (W.speaking && window.speechSynthesis && !speechSynthesis.speaking && !speechSynthesis.pending && now - (W.speakAt || now) > 3000) W.speaking = false;
  if (!WAKE.on && !W.rec && !W.speaking && !WAKE.busy) wakeStart();
}, 1500);
document.addEventListener("visibilitychange", () => { if (!document.hidden) setTimeout(wakeStart, 300); });
function wakeUI() { const el = $("#wakeState"); if (!el) return;
  el.innerHTML = !wakeSupported() ? `<span class="c-warn">${L2("La activación por voz necesita Chrome o Edge.", "Voice wake-up needs Chrome or Edge.")}</span>` : WAKE.want ? (WAKE.on ? `<span class="c-ok">● ${L2("Escuchando “Hola Sanbosi”", "Listening for “Hey Sanbosi”")}</span>` : `<span class="muted">● ${L2("En espera…", "Standing by…")}</span>`) : `<span class="muted">${L2("Desactivada", "Off")}</span>`;
  $("#wakeToggle").checked = WAKE.want; }
function onWake(rest) {
  const n = first();
  if (rest && W.stack[W.stack.length - 1] === "diario" && diaryVoice(rest)) { setBusy(false); wakeStart(); return; }
  W.returnTo = W.stack.slice(); W.stack = []; W.layer = "listen"; renderView(true); applyLayers(); vibrate();
  const cmd = matchCommand(rest);
  // frase dicha de corrido: se analiza también cómo sonó la voz con el audio que guardó el micrófono en segundo plano
  if (rest && RING.on) {
    const from = WAKE.hitFrom || Date.now() - 6000;
    setTimeout(() => { if (RING.seconds(from) < 1) return;
      AV.sendVoice(W.crew, RING.wav(from), rest, false, 0, cmd ? 1 : 0)
        .then(res => { if (res && res.voice) { W.lastVoiceTs = res.voice.ts; W.lastShownVoice = res.voice.ts; showVoice(res.voice); } poll(); }).catch(() => {}); }, 400);
  }
  if (cmd) { listenUI("Hecho", `“${rest}”`, "Cerrar", "home"); setBusy(false); setTimeout(() => { W.layer = null; applyLayers(); runCommand(cmd, rest); }, 500); return; }
  if (rest && rest.split(" ").length >= 3) {
    listenUI("Pensando…", `“${rest}”`, "Cerrar", "home");
    AV.post(`/api/chat/${W.crew}`, {text: rest, source: RING.on ? "voz" : "texto"}).then(async r => { setBusy(false); W.result = {heard: rest, reply: r, voice: null}; W.resultAt = Date.now(); if (r && r.ts) W.since = Math.max(W.since, r.ts);
      await poll(); W.layer = null; W.stack = ["recuerda"]; renderView(true); applyLayers(); say(r.text); })
      .catch(() => { setBusy(false); W.layer = null; applyLayers(); say(L2("No pude hablar con la estación. Inténtalo de nuevo.", "I couldn't reach the station. Please try again.")); });
    return;
  }
  const greet = pickOne(L2([`Hola${n ? " " + n : ""}, ¿qué necesitas?`, `Aquí estoy${n ? ", " + n : ""}. ¿En qué te ayudo?`, `Te escucho${n ? ", " + n : ""}.`], [`Hi${n ? " " + n : ""}, what do you need?`, `I'm here${n ? ", " + n : ""}. How can I help?`, `I'm listening${n ? ", " + n : ""}.`]));
  listenUI(L2(`Hola${n ? ", " + n : ""}`, `Hi${n ? ", " + n : ""}`), L2("¿Qué necesitas?", "What do you need?"), "Cancelar", "home");
  say(greet, () => { setBusy(false); startListen(true); });
}
window.__sambosi = {onWake: x => onWake(x), matchCommand, findWake, state: W, go, home};   // ganchos para pruebas automáticas
$("#wakeToggle").addEventListener("change", e => { WAKE.want = e.target.checked; if (WAKE.want) wakeStart(); else { wakeStop(); RING.stop(); } });
document.addEventListener("pointerdown", () => RING.resume());

const ptt = $("#ptt");
ptt.addEventListener("mousedown", e => { e.preventDefault(); W.pttHold = true; if (!W.mic) { W.mic = true; W.micUntil = 0; } startListen(false); });
ptt.addEventListener("touchstart", e => { e.preventDefault(); W.pttHold = true; startListen(false); }, {passive: false});
window.addEventListener("mouseup", () => { if (W.rec && ptt.classList.contains("rec") && W.pttHold) { W.pttHold = false; finishListen(); } });
window.addEventListener("touchend", () => { if (W.rec && ptt.classList.contains("rec") && W.pttHold) { W.pttHold = false; finishListen(); } });

// ---------------------------------------------------------------- respiración, recordatorios y sincronización
// Respira (canvas): ciclo de 9 s (inhala 4,5 s · exhala 4,5 s) guiado por la animación; aquí solo se cuenta el minuto.
function startBreath() {
  clearInterval(W.breathT); W.breath = {end: Date.now() + 60e3, done: false};
  W.breathT = setInterval(() => {
    if (!W.breath || W.stack[W.stack.length - 1] !== "respira") { clearInterval(W.breathT); W.breath = null; return; }
    live();
    if (Date.now() >= W.breath.end) { clearInterval(W.breathT); W.breath.done = true; act("breathe", {label: "1 minuto"}); renderView(true); }
  }, 500);
}
function checkReminders() {
  const now = Date.now(), free = !W.stack.length && !W.layer && !W.rec;
  for (const k of Object.keys(W.remindAt)) {
    if (now < W.remindAt[k] || !free) continue;
    delete W.remindAt[k]; vibrate();
    if (k === "almuerzo") { if (!mealsToday().some(m => m.name === "almuerzo")) { go("recordatorio"); say(L2("¿Ya almorzaste?", "Did you have lunch?")); } }
    else banner("Hora de dormir", L2("Prepárate para dormir: luz tenue y sin pantallas.", "Get ready for bed: dim lights and no screens."), "sueno");
  }
  // "Te pregunta": a la hora del almuerzo, si no te ha oído decir que almorzaste
  const mins = nowMin(), key = new Date().toDateString();
  if (free && mins >= 12 * 60 + 40 && mins < 16 * 60 && W.asked.almuerzo !== key && W.seenFeed && !mealsToday().some(m => m.name === "almuerzo")) {
    W.asked.almuerzo = key; vibrate(); go("recordatorio");
  }
}
function doSync() { W.syncing = Date.now() + 2200; act("sync"); paint(); renderView(true); setTimeout(() => { paint(); renderView(true); }, 2300); }
function banner(title, text, goView) { if (W.dnd) return; const b = $("#banner"); b.innerHTML = `<small>${esc(AV.t(title))}</small><span>${esc(AV.t(text).slice(0, 110))}</span>`; W.bannerGo = goView || null;
  b.classList.remove("on"); void b.offsetWidth; b.classList.add("on"); clearTimeout(W.bt); W.bt = setTimeout(() => b.classList.remove("on"), 6000); }

// ---------------------------------------------------------------- datos en vivo
async function poll() {
  if (!W.crew) return;
  let d;
  try { const r = await fetch(AV.L(`/api/watch/${W.crew}/view?since=${W.since}`)); if (!r.ok) throw new Error("v" + r.status); d = await r.json(); W.connErr = null; W.oldServer = false; }
  catch (e) {
    try {   // estación con versión anterior: se arma la vista con los endpoints viejos para no quedar vacía
      const [f, st] = await Promise.all([AV.get(`/api/watch/${W.crew}/feed?since=${W.since}`), AV.get("/api/state")]);
      d = {card: f.card, feed: f.feed, findings: (f.card && f.card.top) || [], rad: st.rad, env: st.env, dtn: st.dtn, mission: st.mission || {day: 42},
           voice: [], chat: [], reports: [], actions: [], counters: {water: 0, meals: [], routine: {}}, series: [], last_rx: Date.now() / 1000, buffered: 0, week: []};
      W.oldServer = true; W.connErr = "La estación corre una versión anterior: ciérrala y abre de nuevo “Abrir SANBOSI.command”.";
    } catch (e2) { W.connErr = "No hay conexión con la estación (¿está encendida?)."; paint(); renderView(false); return; }
  }
  const firstLoad = !W.d || !W.d.card; W.d = d; if (!d.card) { renderView(false); return; }
  W.radHist = (W.radHist || []).concat([[Date.now() / 1000, (d.rad || {}).dose_rate_ugy_h]]).slice(-120);
  for (const m of d.feed) {
    W.since = Math.max(W.since, m.ts);
    const lab = {alert: "Aviso", ai: "SANBOSI", houston: "Houston (por DTN)"}[m.kind] || m.kind;
    $("#feed").insertAdjacentHTML("afterbegin", `<div class="item"><div class="t" style="font-size:13px">${AV.t(lab)}<span class="when">${tsHM(m.ts)}</span></div><div class="e" style="color:var(--soft)">${esc(m.text)}</div></div>`);
    if (!W.seenFeed) continue;
    if (m.kind === "houston") { W.msg = {title: "Mensaje de Houston", text: m.text.replace(/^Houston:\s*/, ""), sub: "Llegó por DTN"}; vibrate(); if (!W.dnd) { W.stack = ["mensaje"]; renderView(true); applyLayers(); speak(m.text); } }
    else if (m.kind === "alert") { vibrate(); const f = findingsCat().find(x => m.text.startsWith(x.title)); banner("Aviso temprano", m.text, f ? "aviso:" + encodeURIComponent(f.title) : "avisos"); }
    else if (m.kind === "ai" && !W.result) banner("SANBOSI", m.text.replace(/^⚠️\s*/, ""), "recuerda");
  }
  W.seenFeed = true;
  if (W.result && !W.stack.includes("anotado") && Date.now() - W.resultAt > 8000) W.result = null;
  const ri = radInfo();
  if (ri.storm && !W.stormAck && W.stack[W.stack.length - 1] !== "tormenta") { W.stack = ["tormenta"]; W.layer = null; renderView(true); applyLayers(); vibrate(); speak(L2("Tormenta solar. Ve al refugio blindado ahora.", "Solar storm. Go to the shielded shelter now.")); }
  if (!ri.storm) W.stormAck = false;
  if (W.inShelter) { W.stormDose += ri.rate / 3600 / 1000 * 20; W.shelterHist = W.shelterHist.concat([ri.rate]).slice(-90); }   // mGy, reloj orbital x20
  const vl = voiceLast();
  if (vl && vl.indices.stress >= 65 && vl.ts > W.tensionShown && !W.stack.length && !W.layer) { W.tensionShown = vl.ts; setTimeout(() => go("tension"), 400); }
  if (vl && !firstLoad && vl.ts !== W.lastShownVoice) { W.lastShownVoice = vl.ts; showVoice(vl); } else if (firstLoad && vl) { W.lastShownVoice = vl.ts; W.tensionShown = vl.ts; showVoice(vl); }
  checkReminders();
  paint(); renderView(false);
}

// ---------------------------------------------------------------- arranque
function fit() {   // el reloj se escala para que reloj + panel quepan en una sola pantalla
  const vw = document.documentElement.clientWidth, vh = window.innerHeight, head = ($(".wtop") || {}).offsetHeight || 70;
  const side = vw >= 1180 ? Math.min(740, vw - 380) + 28 : 0;
  let s = Math.min(1, (vw - 40 - side) / 560, side ? (vh - head - 38) / 760 : 1);
  s = Math.max(0.5, s);
  $("#watch").style.transform = `scale(${s})`; $("#wwrap").style.width = 560 * s + "px"; $("#wwrap").style.height = 760 * s + "px"; }
window.addEventListener("resize", fit); fit();
(async () => {
  W.crewList = (await AV.get("/api/crew")).crew;
  $("#crew").innerHTML = W.crewList.map(x => `<option value="${x.id}">${esc(x.name)}</option>`).join("");
  W.crew = new URLSearchParams(location.search).get("crew") || W.crewList[0].id; $("#crew").value = W.crew;
  $("#crew").onchange = e => { W.crew = e.target.value; W.since = 0; W.seenFeed = false; W.d = null; W.doc = false; W.diary = {i: 0, a: {}}; W.reminders = {}; W.remindAt = {}; W.firstSeen = {}; $("#feed").innerHTML = ""; home(); poll(); };
  $$(".lg").forEach(b => { b.classList.toggle("on", b.dataset.lang === AV.lang); b.onclick = () => AV.setLang(b.dataset.lang); });
  $("#cmdHelp").innerHTML = (AV.lang === "en" ? ["“Hey Sanbosi” · “Hi Sanbosi” · “Hello Sanbosi”", "“Hey Sanbosi, how am I?”", "“…, how is my heart?” · “…, what's my oxygen?”", "“…, my blood pressure is 118 over 76” · “…, glucose 96”", "“…, how's the radiation?”", "“…, I drank a glass of water” · “…, I had lunch”", "“…, what's next?” · “…, show my alerts”", "“…, breathe with me” · “…, call the doctor”", "“…, I'm in the shelter” · “…, sync”", "Any other question goes to the onboard assistant."]
    : ["“Hola Sanbosi” · “Hey Sanbosi” · “Oye Sanbosi” · “Buenos días Sanbosi”", "“Hola Sanbosi, ¿cómo estoy?”", "“…, ¿cómo está mi corazón?” · “…, ¿cuánto oxígeno tengo?”", "“…, mi presión es 118 sobre 76” · “…, glucosa 96”", "“…, ¿cómo está la radiación?”", "“…, tomé un vaso de agua” · “…, ya almorcé”", "“…, ¿qué sigue en mi rutina?” · “…, muéstrame mis avisos”", "“…, respira conmigo” · “…, avisa al médico”", "“…, estoy en el refugio” · “…, sincroniza”", "Cualquier otra pregunta va al asistente de a bordo."]).map(x => `<div>${esc(x)}</div>`).join("");
  $("#cmdHelp").setAttribute("data-notr", "");
  WAKE.want = wakeSupported(); wakeUI(); AV.tr(document.body);
  document.addEventListener("pointerdown", function once() { document.removeEventListener("pointerdown", once); if (WAKE.want) wakeStart(); });
  applyLayers(); paint(); await poll(); setInterval(poll, 1000); wakeStart(); setInterval(() => { $("#clock").textContent = nowHM(); live(); }, 1000);
})();
})();
