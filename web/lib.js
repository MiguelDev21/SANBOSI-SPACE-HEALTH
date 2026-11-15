// Utilidades compartidas: gráficos canvas sin dependencias, grabador WAV, formatos.
const AV = {};
AV.$ = (s, r = document) => r.querySelector(s);
AV.$$ = (s, r = document) => [...r.querySelectorAll(s)];
AV.esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}[c]));
AV.fmt = (v, d = 0) => (v === null || v === undefined || Number.isNaN(v)) ? "—" : Number(v).toFixed(d);
AV.ago = ts => { const s = Math.max(0, Date.now() / 1000 - ts); return s < 60 ? `${s.toFixed(0)} s` : s < 3600 ? `${(s / 60).toFixed(0)} min` : `${(s / 3600).toFixed(1)} h`; };
AV.time = ts => new Date(ts * 1000).toLocaleTimeString("es", {hour12: false});
// ---- idioma (ES por defecto; EN traduce interfaz, respuestas de la estación, voz y dictado)
AV.lang = (() => { try { return localStorage.getItem("sambosi_lang") || "es"; } catch (e) { return "es"; } })();
AV.setLang = l => { try { localStorage.setItem("sambosi_lang", l); } catch (e) {} location.reload(); };
AV.L = u => AV.lang === "en" ? u + (u.includes("?") ? "&" : "?") + "lang=en" : u;
AV.speechLang = () => AV.lang === "en" ? "en-US" : "es-ES";
AV.get = async u => (await fetch(AV.L(u))).json();
AV.post = async (u, b) => (await fetch(AV.L(u), {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(b)})).json();
AV.srcBadge = s => { s = s || "SIM"; const k = s.includes("INYECC") ? "p-inj" : {LIVE: "p-ok", CACHE: "p-obs", SIM: "p-warn", FALLBACK: "p-warn", STATIC: "p-gray", EMBEDDED: "p-tech", EXTERNAL: "p-tech"}[s.split("+")[0]] || "p-gray";
  const label = {LIVE: "En vivo", CACHE: "Caché", SIM: "Simulado", FALLBACK: "Respaldo", STATIC: "Estático", EMBEDDED: "Embebido", EXTERNAL: "Externo"}[s.split("+")[0]] || s;
  return `<span class="pill ${k}"><span class="d"></span>${AV.esc(label)}${s.includes("INYECC") ? " + prueba" : ""}</span>`; };
// Estados acordados con Salud: Normal / Observación / Atención / Crítica (+ Revisar sensor)
AV.ST = {"Normal": ["p-ok", "Bien"], "Observación": ["p-obs", "Observación"], "Atención": ["p-warn", "Atención"], "Crítica": ["p-crit", "Crítica"], "Revisar sensor": ["p-gray", "Revisar sensor"], "SIN DATOS": ["p-gray", "Sin datos"]};
AV.pill = (st, lg) => { const [c, l] = AV.ST[st] || ["p-gray", st]; return `<span class="pill ${c} ${lg ? "lg" : ""}"><span class="d"></span>${AV.esc(l)}</span>`; };
AV.stColor = st => AV.css({"Normal": "--ok", "Observación": "--obs", "Atención": "--warn", "Crítica": "--crit"}[st] || "--muted");
AV.SEV = {info: ["p-gray", "Informativa"], watch: ["p-obs", "Observación"], warning: ["p-warn", "Atención"], critical: ["p-crit", "Crítica"]};
AV.sev = (sv, tech) => { const [c, l] = tech ? ["p-tech", "Técnica"] : (AV.SEV[sv] || ["p-gray", sv]); return `<span class="pill ${c}">${l}</span>`; };
AV.hm = h => h == null ? "—" : `${Math.floor(h)} h ${String(Math.round((h % 1) * 60)).padStart(2, "0")}`;
AV.css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

// ---------------------------------------------------------------- gráfico de líneas
AV.chart = function (canvas, series, opt = {}) {
  const dpr = window.devicePixelRatio || 1, W = canvas.clientWidth, H = opt.height || 140;
  canvas.style.height = H + "px"; canvas.width = W * dpr; canvas.height = H * dpr;
  const g = canvas.getContext("2d"); g.scale(dpr, dpr); g.clearRect(0, 0, W, H);
  const pad = {l: 34, r: 8, t: 14, b: 18};
  const all = series.flatMap(s => s.data.filter(p => p[1] !== null && p[1] !== undefined));
  if (!all.length) { g.fillStyle = AV.css("--dim"); g.font = "12px sans-serif"; g.fillText("esperando datos…", W / 2 - 45, H / 2); return; }
  let x0 = Math.min(...all.map(p => p[0])), x1 = Math.max(...all.map(p => p[0]));
  let y0 = opt.min ?? Math.min(...all.map(p => p[1])), y1 = opt.max ?? Math.max(...all.map(p => p[1]));
  (opt.bands || []).forEach(b => { y0 = Math.min(y0, b.from ?? y0); y1 = Math.max(y1, b.to ?? y1); });
  if (y1 - y0 < 1e-6) { y0 -= 1; y1 += 1; }
  const py = (y1 - y0) * 0.08; y0 -= py; y1 += py; if (x1 === x0) x1 = x0 + 1;
  const X = x => pad.l + (x - x0) / (x1 - x0) * (W - pad.l - pad.r), Y = y => pad.t + (1 - (y - y0) / (y1 - y0)) * (H - pad.t - pad.b);
  g.strokeStyle = AV.css("--line"); g.lineWidth = 1; g.fillStyle = AV.css("--dim"); g.font = "10px Lexend, sans-serif";
  for (let i = 0; i <= 3; i++) { const v = y0 + (y1 - y0) * i / 3, y = Y(v); g.beginPath(); g.moveTo(pad.l, y); g.lineTo(W - pad.r, y); g.stroke(); g.fillText(v.toFixed(opt.dec ?? 0), 2, y + 3); }
  g.fillText(AV.time(x0), pad.l, H - 4); g.fillText(AV.time(x1), W - pad.r - 52, H - 4);
  (opt.bands || []).forEach(b => { g.fillStyle = b.color; g.fillRect(pad.l, Y(b.to), W - pad.l - pad.r, Y(b.from) - Y(b.to)); });
  (opt.thresholds || []).forEach(t => { g.save(); g.setLineDash([4, 4]); g.strokeStyle = t.color; g.beginPath(); g.moveTo(pad.l, Y(t.v)); g.lineTo(W - pad.r, Y(t.v)); g.stroke(); g.restore(); g.fillStyle = t.color; g.fillText(t.label || "", W - pad.r - 60, Y(t.v) - 3); });
  series.forEach(s => {
    const d = s.data.filter(p => p[1] !== null && p[1] !== undefined); if (!d.length) return;
    const grad = g.createLinearGradient(0, pad.t, 0, H - pad.b); grad.addColorStop(0, s.color + "40"); grad.addColorStop(1, s.color + "00");
    g.beginPath(); d.forEach((p, i) => i ? g.lineTo(X(p[0]), Y(p[1])) : g.moveTo(X(p[0]), Y(p[1])));
    g.strokeStyle = s.color; g.lineWidth = 1.8; g.stroke();
    if (s.fill !== false) { g.lineTo(X(d[d.length - 1][0]), H - pad.b); g.lineTo(X(d[0][0]), H - pad.b); g.closePath(); g.fillStyle = grad; g.fill(); }
  });
  let lx = pad.l + 4; series.forEach(s => { g.fillStyle = s.color; g.fillRect(lx, pad.t, 8, 3); g.fillStyle = AV.css("--muted"); g.fillText(s.label, lx + 11, pad.t + 4); lx += g.measureText(s.label).width + 26; });
};

// ---------------------------------------------------------------- medidor circular
AV.gauge = (v, label, color) => {
  const r = 34, c = 2 * Math.PI * r, p = Math.max(0, Math.min(100, v ?? 0)) / 100;
  return `<div class="gauge"><svg viewBox="0 0 86 86"><circle cx="43" cy="43" r="${r}" fill="none" stroke="${AV.css("--track")}" stroke-width="7"/>
  <circle cx="43" cy="43" r="${r}" fill="none" stroke="${color}" stroke-width="7" stroke-linecap="round" stroke-dasharray="${c * p} ${c}" transform="rotate(-90 43 43)"/>
  <text x="43" y="49" text-anchor="middle" fill="${AV.css("--text")}" font-size="20" font-weight="500" font-family="Lexend, sans-serif">${v ?? "—"}</text></svg><div class="l">${label}</div></div>`;
};

// ---------------------------------------------------------------- grabador de voz (WAV 16 kHz) + vúmetro + dictado
AV.Recorder = class {
  constructor(onLevel) { this.onLevel = onLevel; this.chunks = []; this.rec = null; this.transcript = ""; this.peakDb = -100; this.alts = []; this.finals = ""; this.active = false; this.lastTextAt = 0; this.lastFinal = false; }
  async start() {
    this.stream = await navigator.mediaDevices.getUserMedia({audio: {echoCancellation: true, noiseSuppression: false, autoGainControl: false}});
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.sr = this.ctx.sampleRate; this.chunks = []; this.peakDb = -100; this.transcript = "";
    const src = this.ctx.createMediaStreamSource(this.stream);
    this.proc = this.ctx.createScriptProcessor(4096, 1, 1);
    this.proc.onaudioprocess = e => {
      const d = e.inputBuffer.getChannelData(0); this.chunks.push(new Float32Array(d));
      let s = 0; for (let i = 0; i < d.length; i++) s += d[i] * d[i];
      const db = 20 * Math.log10(Math.sqrt(s / d.length) + 1e-9); this.peakDb = Math.max(this.peakDb, db);
      this.onLevel && this.onLevel(db);
    };
    src.connect(this.proc); this.proc.connect(this.ctx.destination);
    this.alts = []; this.finals = ""; this.active = true; this.startSR();
  }
  // dictado del navegador: si Chrome lo corta a mitad de la frase (silencio, red), se vuelve a abrir y se acumula el texto
  startSR(tries = 0) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR || !this.active) return;
    let rec;
    try { rec = new SR(); } catch (e) { return; }
    rec.lang = AV.speechLang(); rec.continuous = true; rec.interimResults = true; rec.maxAlternatives = 4;
    rec.onresult = ev => {
      let interim = ""; this.lastTextAt = Date.now(); this.lastFinal = !!ev.results[ev.results.length - 1].isFinal;
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i];
        if (r.isFinal) { this.finals += r[0].transcript + " "; for (let a = 1; a < r.length; a++) this.alts.push(r[a].transcript); }
        else interim += r[0].transcript + " ";
      }
      this.transcript = (this.finals + interim).replace(/\s+/g, " ").trim();
      this.onText && this.onText(this.transcript);
    };
    rec.onerror = () => {};
    rec.onend = () => { if (this.rec === rec && this.active) setTimeout(() => this.startSR(), 150); };
    try { rec.start(); this.rec = rec; }
    catch (e) { this.rec = null; if (tries < 4) setTimeout(() => this.startSR(tries + 1), 300); }   // el reconocedor anterior aún no se liberaba
  }
  // variantes que entendió el navegador (para buscar un comando aunque la primera opción venga mal escrita)
  variants() { return [(this.transcript || "").trim(), ...this.alts.map(a => a.trim())].filter(Boolean); }
  async stop() {
    this.active = false;
    // si el dictado ya cerró la frase no hace falta esperar a que Chrome termine: se corta al instante
    if (this.rec && this.lastFinal && this.finals.trim()) { try { this.rec.onend = null; this.rec.abort(); } catch (e) {} this.rec = null; }
    if (this.rec) { const r = this.rec; try { r.stop(); } catch (e) {} await new Promise(res => { let ok = false; const f = () => { if (!ok) { ok = true; res(); } }; r.onend = f; setTimeout(f, 900); }); this.rec = null; }
    this.proc && this.proc.disconnect(); this.stream && this.stream.getTracks().forEach(t => t.stop());
    await (this.ctx && this.ctx.close());
    return this.wav(16000);
  }
  wav(target) {
    const n = this.chunks.reduce((a, c) => a + c.length, 0), all = new Float32Array(n); let o = 0;
    this.chunks.forEach(c => { all.set(c, o); o += c.length; });
    const ratio = this.sr / target, m = Math.floor(n / ratio), pcm = new Int16Array(m);
    for (let i = 0; i < m; i++) { const a = Math.floor(i * ratio), b = Math.min(n, Math.floor((i + 1) * ratio)); let s = 0; for (let j = a; j < b; j++) s += all[j]; const v = Math.max(-1, Math.min(1, s / Math.max(1, b - a))); pcm[i] = v * 32767; }
    const buf = new ArrayBuffer(44 + pcm.length * 2), dv = new DataView(buf), w = (p, s) => [...s].forEach((ch, i) => dv.setUint8(p + i, ch.charCodeAt(0)));
    w(0, "RIFF"); dv.setUint32(4, 36 + pcm.length * 2, true); w(8, "WAVE"); w(12, "fmt "); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
    dv.setUint32(24, target, true); dv.setUint32(28, target * 2, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true); w(36, "data"); dv.setUint32(40, pcm.length * 2, true);
    new Int16Array(buf, 44).set(pcm); return new Blob([buf], {type: "audio/wav"});
  }
};

// ---------------------------------------------------------------- voz hablada (TTS) clara en español e inglés
// El navegador trae muchas voces; algunas de inglés en macOS (Fred, Albert, Eddy, Flo…) suenan robóticas.
// Se elige la voz más natural disponible y el texto se adapta para leerse bien (unidades, siglas) y se parte por frases
// (las voces de Google se cortan solas pasados ~15 s si el texto es largo).
AV._voices = [];
(function loadVoices() {
  if (!window.speechSynthesis) return;
  const f = () => { AV._voices = speechSynthesis.getVoices() || []; AV._voice = {}; };
  f(); try { speechSynthesis.addEventListener("voiceschanged", f); } catch (e) { speechSynthesis.onvoiceschanged = f; }
})();
const ROBOTIC = /\b(albert|bad news|bahh|bells|boing|bubbles|cellos|deranged|fred|good news|hysterical|junior|organ|superstar|trinoids|whisper|wobble|zarvox|ralph|kathy|jester|grandma|grandpa|eddy|flo|reed|rocko|sandy|shelley)\b/i;
AV.pickVoice = (lang = AV.speechLang()) => {
  AV._voice = AV._voice || {};
  if (AV._voice[lang] !== undefined) return AV._voice[lang];
  const base = lang.slice(0, 2), norm = v => (v.lang || "").replace("_", "-").toLowerCase();
  const all = AV._voices.filter(v => norm(v).startsWith(base));
  const pool = all.filter(v => !ROBOTIC.test(v.name));
  if (!pool.length) return null;          // sin voces cargadas todavía: el navegador usa la suya por defecto
  const pref = base === "en"
    ? [/natural/i, /neural/i, /premium/i, /enhanced|mejorad/i, /google us english/i, /samantha/i, /\bava\b/i, /allison/i, /susan/i, /\bzoe\b/i, /jenny|aria|michelle|guy/i, /zira/i, /google uk english female/i, /serena|kate|daniel|karen|moira|tessa/i]
    : [/natural/i, /neural/i, /premium/i, /enhanced|mejorad/i, /google espa(ñ|n)ol de estados unidos/i, /google espa(ñ|n)ol/i, /paulina|m(o|ó)nica|marisol|sabina|dalia|elvira|helena|angelica|jorge|juan|diego/i];
  let pick = null;
  for (const re of pref) { const m = pool.filter(v => re.test(v.name)); if (m.length) { pick = m.find(v => norm(v) === lang.toLowerCase()) || m[0]; break; } }
  pick = pick || pool.find(v => norm(v) === lang.toLowerCase()) || pool[0];
  if (AV._voices.length) AV._voice[lang] = pick;
  return pick;
};
// texto → lo que debe sonar (unidades y siglas pronunciables)
AV.speechText = t => {
  t = String(t || "").replace(/[⚠️✅❌•▮◉]/gu, "").replace(/[“”"]/g, "").replace(/\s+/g, " ").trim();
  const en = AV.lang === "en";
  const R = en ? [[/µGy\/h/g, " micrograys per hour"], [/mGy/g, " milligrays"], [/mSv/g, " millisieverts"], [/°C/g, " degrees"], [/mmHg/g, " millimeters of mercury"],
                  [/mg\/dL/g, " milligrams per deciliter"], [/mmol\/L/g, " millimoles per liter"], [/×10³\/µL/g, " thousand per microliter"], [/g\/dL/g, " grams per deciliter"],
                  [/(\d)\s*%/g, "$1 percent"], [/\bSpO2\b/g, "oxygen saturation"], [/\bCO2\b/g, "C O 2"], [/\bO2\b/g, "oxygen"], [/\bHRV\b/g, "H R V"], [/\bbpm\b/g, "beats per minute"],
                  [/\bDTN\b/g, "D T N"], [/\bEVA\b/g, "E V A"], [/\bNASA\b/g, "NASA"], [/\bSANBOSI\b|\bSanbosi\b/g, "Sanbossi"], [/(\d+)\/(\d+)/g, "$1 over $2"], [/\bR\+1\b/g, "the day after landing"]]
               : [[/µGy\/h/g, " microgray por hora"], [/mGy/g, " miligray"], [/mSv/g, " milisievert"], [/°C/g, " grados"], [/mmHg/g, " milímetros de mercurio"],
                  [/mg\/dL/g, " miligramos por decilitro"], [/mmol\/L/g, " milimoles por litro"], [/×10³\/µL/g, " mil por microlitro"], [/g\/dL/g, " gramos por decilitro"],
                  [/(\d)\s*%/g, "$1 por ciento"], [/\bSpO2\b/g, "saturación de oxígeno"], [/\bCO2\b/g, "ce o dos"], [/\bVFC\b/g, "variabilidad cardíaca"], [/\blpm\b/g, "latidos por minuto"],
                  [/\bDTN\b/g, "de te ene"], [/(\d+)\/(\d+)/g, "$1 sobre $2"]];
  for (const [a, b] of R) t = t.replace(a, b);
  return t.replace(/(\d)\.(\d)/g, en ? "$1 point $2" : "$1 coma $2").replace(/\s+/g, " ").trim();
};
// habla por frases; opts: {onstart, onend, onboundary}. Devuelve una función para cancelar.
AV.say = (text, opts = {}) => {
  const end = () => opts.onend && opts.onend();
  if (!window.speechSynthesis) { setTimeout(end, 200); return () => {}; }
  const lang = AV.speechLang(), en = lang.startsWith("en"), voice = en ? AV.pickVoice(lang) : null;   // en español se deja la voz del navegador (ya suena bien)
  const parts = AV.speechText(text).match(/[^.!?;]+[.!?;]*/g) || [];
  const chunks = []; for (const p of parts.map(x => x.trim()).filter(Boolean)) { if (chunks.length && (chunks[chunks.length - 1] + " " + p).length < 160) chunks[chunks.length - 1] += " " + p; else chunks.push(p); }
  if (!chunks.length) { setTimeout(end, 100); return () => {}; }
  let i = 0, stopped = false;
  speechSynthesis.cancel();
  const next = () => {
    if (stopped) return;
    if (i >= chunks.length) { end(); return; }
    const u = new SpeechSynthesisUtterance(chunks[i++]);
    u.lang = voice ? voice.lang : lang; if (voice) { try { u.voice = voice; } catch (e) {} }
    u.rate = en ? 0.98 : 1.05; u.pitch = 1;
    if (i === 1 && opts.onstart) u.onstart = opts.onstart;
    u.onboundary = opts.onboundary || null;
    let moved = false; const go = () => { if (moved) return; moved = true; clearTimeout(guard); next(); };
    u.onend = go; u.onerror = go;
    const guard = setTimeout(go, 2500 + u.text.length * 90);    // respaldo si el navegador no avisa el final
    speechSynthesis.speak(u);
    if (speechSynthesis.paused) speechSynthesis.resume();
  };
  setTimeout(next, 60);      // Chrome a veces pierde la primera frase si se habla justo después de cancel()
  return () => { stopped = true; speechSynthesis.cancel(); };
};
AV.speak = (text, on = true) => { if (on) AV.say(text); };

// micrófono en segundo plano mientras se escucha "Hey Sanbosi": guarda los últimos segundos de audio para poder
// analizar la voz también cuando el astronauta dice todo seguido ("Hey Sanbosi, ¿cómo está mi corazón?")
AV.AudioRing = class {
  constructor(sec = 12) { this.sec = sec; this.bufs = []; this.on = false; this.starting = false; }
  async start() {
    if (this.on || this.starting || !navigator.mediaDevices) return;
    this.starting = true;
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({audio: {echoCancellation: true, noiseSuppression: false, autoGainControl: false}});
      this.ctx = new (window.AudioContext || window.webkitAudioContext)(); this.sr = this.ctx.sampleRate;
      const src = this.ctx.createMediaStreamSource(this.stream), max = Math.ceil(this.sec * this.sr / 4096);
      this.proc = this.ctx.createScriptProcessor(4096, 1, 1);
      this.proc.onaudioprocess = e => { this.bufs.push({t: Date.now(), d: new Float32Array(e.inputBuffer.getChannelData(0))}); if (this.bufs.length > max) this.bufs.shift(); };
      src.connect(this.proc); this.proc.connect(this.ctx.destination); this.on = true;
    } catch (e) { this.on = false; }
    this.starting = false;
  }
  resume() { try { if (this.ctx && this.ctx.state === "suspended") this.ctx.resume(); } catch (e) {} }
  stop() { if (!this.on) return; this.on = false; try { this.proc.disconnect(); this.stream.getTracks().forEach(t => t.stop()); this.ctx.close(); } catch (e) {} this.bufs = []; }
  seconds(fromMs) { return this.bufs.filter(b => b.t >= fromMs).length * 4096 / (this.sr || 48000); }
  wav(fromMs) { return AV.Recorder.prototype.wav.call({chunks: this.bufs.filter(b => b.t >= fromMs).map(b => b.d), sr: this.sr}, 16000); }
};

AV.sendVoice = async (crewId, blob, transcript, calibrate, ask = 1, log = 1) => {
  const r = await fetch(AV.L(`/api/voice/${crewId}?transcript=${encodeURIComponent(transcript || "")}&calibrate=${calibrate ? 1 : 0}&ask=${ask}&log=${log}`), {method: "POST", body: blob, headers: {"Content-Type": "audio/wav"}});
  return r.json();
};

AV.SCEN = {
  nominal: "Nominal", eva: "EVA (caminata espacial)", eva_co2: "EVA + falla CO2 traje", dcs: "EVA + descompresión",
  cabin_co2: "CO2 de cabina alto", hypoxia: "Hipoxia", arrhythmia: "Arritmia", fever: "Fiebre / infección",
  fatigue: "Fatiga / sin dormir", orthostatic: "Intolerancia ortostática", dehydration: "Deshidratación",
  solar_storm: "Tormenta solar", stress: "Estrés agudo", unresponsive: "Sin movimiento", sensor_loose: "Reloj flojo (sensor)"
};
AV.ACT = {sleep: "Durmiendo", rest: "Reposo", work: "Trabajando", exercise: "Ejercicio", eva: "Caminata espacial"};
AV.icon = {
  heart: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/></svg>',
  mind: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8.5 14.5a4 4 0 0 0 7 0"/><path d="M9 9.5h.01M15 9.5h.01"/></svg>',
  drop: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/></svg>',
  mic: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>',
  crew: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6.5 6.5 0 0 1 3.5 5.5"/></svg>',
  person: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
  wave: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M3 12h2M7 8v8M11 5v14M15 9v6M19 7v10M21 12h0"/></svg>',
  bell: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21h4"/></svg>',
  station: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="6" height="6" rx="1"/><path d="M3 6v12M6 6v12M18 6v12M21 6v12M6 12h3M15 12h3"/></svg>',
  earth: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>',
  watch: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="4"/><path d="M9 6l1-3h4l1 3M9 18l1 3h4l1-3M12 9.5V12l1.5 1.5"/></svg>'
};
