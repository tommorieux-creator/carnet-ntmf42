<script>
(function () {
"use strict";
const PLAN = /*PLAN_JSON*/null;

/* ------------------------------------------------------------------ utilitaires */
const DAYS = ["Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi","Dimanche"];
const DAYS3 = ["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"];
const MONTHS = ["janv.","févr.","mars","avr.","mai","juin","juil.","août","sept.","oct.","nov.","déc."];
const pad = n => String(n).padStart(2, "0");
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const $ = (s, r) => (r || document).querySelector(s);
const ymd = d => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
const todayStr = () => ymd(new Date());
const nowHM = () => { const d = new Date(); return pad(d.getHours()) + ":" + pad(d.getMinutes()); };
const parseYmd = s => { const a = s.split("-").map(Number); return Date.UTC(a[0], a[1] - 1, a[2]); };
const addDays = (s, n) => { const t = new Date(parseYmd(s) + n * 864e5); return t.getUTCFullYear() + "-" + pad(t.getUTCMonth() + 1) + "-" + pad(t.getUTCDate()); };
const dayDiff = (a, b) => Math.round((parseYmd(a) - parseYmd(b)) / 864e5);
const dow = s => (new Date(parseYmd(s)).getUTCDay() + 6) % 7;
const dShort = s => { const a = s.split("-").map(Number); return a[2] + " " + MONTHS[a[1] - 1]; };
const dLong = s => DAYS[dow(s)] + " " + dShort(s);
const fmtKm = n => (Math.round(n * 10) / 10).toFixed(1).replace(".", ",");
const fmtPace = s => { if (!s || !isFinite(s)) return "–"; s = Math.round(s); return Math.floor(s / 60) + "'" + pad(s % 60); };
const fmtDur = s => { if (s == null || !isFinite(s)) return "–"; s = Math.round(s); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return h ? h + " h " + pad(m) : m + " min"; };
function chartW() { const m = document.getElementById("main"); const w = (m && m.clientWidth) || 640; return Math.max(300, Math.min(960, Math.round(w - 40))); }
const fmtNum = n => Math.round(n).toLocaleString("fr-FR");
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const num = v => { const n = parseFloat(String(v).replace(",", ".")); return isFinite(n) ? n : null; };
const parseMMSS = v => { const m = String(v || "").trim().match(/^(\d{1,2})[:'hH.](\d{1,2})$/); return m ? (+m[1]) * 60 + (+m[2]) : null; };
const mmss = s => Math.floor(s / 60) + ":" + pad(Math.round(s % 60));
const uid8 = () => Math.random().toString(36).slice(2, 8);

/* ------------------------------------------------------------------ programme et cibles */
const planDay = date => {
  const off = dayDiff(date, PLAN.start);
  if (off < 0 || off >= PLAN.weeks.length * 7) return null;
  const wi = Math.floor(off / 7);
  return { wn: wi + 1, week: PLAN.weeks[wi], day: PLAN.weeks[wi].days[off % 7], di: off % 7 };
};
const weekOf = date => { const off = dayDiff(date, PLAN.start); return off < 0 ? 0 : off >= 175 ? 26 : Math.floor(off / 7) + 1; };
const DEFK = { height: 175, age: 30, w0: 70, t10: 3000 };
const K = { height: DEFK.height, age: DEFK.age, w0: DEFK.w0, t10: DEFK.t10, pal: 1.35, prot: 1.8, fmin: 1.0, fmax: 2.0, cap: 10, base: 4, perkm: 0.15, ckm: 1.0, cdp: 0.007, crf: 3, pace: 7.2, water: 35, waterH: 600 };
function targets(day, W) {
  const km = day ? day.km : 0, dp = day ? day.dp : 0, rf = day ? day.rf : 0;
  const bmr = 10 * W + 6.25 * K.height - 5 * K.age + 5;
  const dep = Math.round(bmr * K.pal + km * W * K.ckm + dp * W * K.cdp + rf * W * K.crf);
  const p = Math.round(W * K.prot);
  const cpk = (day && day.cb != null) ? day.cb : Math.min(K.cap, K.base + K.perkm * km);
  const c = Math.round(W * cpk);
  const f = Math.round(Math.max(K.fmin * W, Math.min(K.fmax * W, (dep - 4 * p - 4 * c) / 9)));
  const hrs = km * K.pace / 60;
  const gph = hrs < 1.25 ? 0 : hrs < 2 ? 30 : hrs < 3 ? 60 : 80;
  return { dep, kcal: 4 * p + 4 * c + 9 * f, p, c, f, intra: Math.round(hrs * gph), water: Math.round((W * K.water + hrs * K.waterH) / 100) / 10 };
}

/* ------------------------------------------------------------------ état */
const S = {
  tab: "today", date: todayStr(), weekSel: null, sel: null, uid: null, ready: false, loaded: 0,
  base: null, assets: null, sample: null, downloads: null, canImages: false,
  sessions: [], meals: [], measures: [], profile: {}, days: [], sub: "progress",
  anMode: "coach", ask: {}, trend: { busy: false, text: "", err: "" }, mealTip: {}, dayRev: {}, menu: { date: "", busy: false, text: "", err: "" }, wk: { date: "", busy: false, text: "", err: "" },
  calc: { flat: "5:55", slope: "8", dist: "42", dplus: "1050", flat2: "5:55", pen: "1.3" }, brief: { date: "", busy: false, text: "", err: "" }, shoeForm: { name: "", start: "0", max: "800" },
  queue: [], importBusy: false, importMsg: "",
  draft: { kind: "Déjeuner", time: nowHM(), note: "", blob: null, previewUrl: "", desc: "", kcal: "", p: "", c: "", f: "", conf: "", comment: "", busy: false, err: "" },
  an: {}, advice: { busy: false, text: "", err: "" }, review: { busy: false, text: "", err: "" },
  mform: { date: todayStr(), weight: "", vo2: "", rhr: "", tenk: "", note: "" },
  confirmDel: null, pending: false, inputs: {}
};
const hasStore = () => !!S.base;
const checks = () => (S.profile && S.profile.checks) || {};
const sessionsOn = d => S.sessions.filter(s => s.date === d);
const isDone = d => !!checks()[d] || sessionsOn(d).length > 0;
function weightOn(date) {
  let w = null;
  S.measures.filter(m => m.weight != null && m.date <= date).sort((a, b) => a.date < b.date ? -1 : 1).forEach(m => { w = m.weight; });
  if (w == null) { const f = S.measures.filter(m => m.weight != null).sort((a, b) => a.date < b.date ? -1 : 1)[0]; w = f ? f.weight : K.w0; }
  return w;
}
function mealsOn(date) { return S.meals.filter(m => m.date === date).sort((a, b) => (a.time || "") < (b.time || "") ? -1 : 1); }
function totalsOn(date) {
  return mealsOn(date).reduce((t, m) => { t.kcal += m.kcal || 0; t.p += m.p || 0; t.c += m.c || 0; t.f += m.f || 0; return t; }, { kcal: 0, p: 0, c: 0, f: 0 });
}
const weekRange = n => { const s = addDays(PLAN.start, (n - 1) * 7); return [s, addDays(s, 6)]; };
function weekKm(n) { const r = weekRange(n); return S.sessions.filter(s => s.date >= r[0] && s.date <= r[1]).reduce((a, s) => a + (s.km || 0), 0); }
const weekPlanKm = n => PLAN.weeks[n - 1].days.reduce((a, d) => a + d.km, 0);
const weekPlanDp = n => PLAN.weeks[n - 1].days.reduce((a, d) => a + d.dp, 0);

/* ------------------------------------------------------------------ capacités */
const use = n => (window.claude && window.claude.use) ? Promise.resolve(window.claude.use(n)).catch(() => null) : Promise.resolve(null);
const blobUrl = id => (window.__blobUrl ? window.__blobUrl(id) : "/_blob/" + id);
const addr = () => { const a = String((S.profile && S.profile.appel) || "").trim(); return a ? "Tu t'adresses à l'athlète en l'appelant « " + a + " »." : "Tu vouvoies l'athlète, sans formule de titre."; };
let toastTimer = 0;
function toast(msg) {
  const t = $("#toast"); t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 4200);
}
const errText = e => {
  const c = e && e.code;
  if (c === "not_granted") return "Clé d'API refusée ou absente. Vérifiez-la dans Carnet → Données.";
  if (c === "rate_limited") return "Trop d'appels en peu de temps. Réessayez dans un instant.";
  if (c === "quota_exceeded" || c === "quota_or_state") return "Le stockage du carnet est plein.";
  if (c === "too_large") return "Le fichier est trop volumineux.";
  if (c === "images_unavailable") return "L'analyse de photos n'est pas disponible dans cette vue.";
  if (c === "image_rejected") return "Cette photo n'a pas pu être lue. Essayez un autre fichier.";
  if (c === "session_expired") return "Votre session a expiré. Rechargez la page.";
  if (c === "cancelled") return "Analyse arrêtée.";
  if (c === "invalid_json") return "La réponse n'était pas exploitable. Relancez l'analyse.";
  return (e && e.message) ? e.message : "Une erreur est survenue. Réessayez.";
};
async function save(label, fn) { try { await fn(); return true; } catch (e) { toast(label + " : " + errText(e)); return false; } }

/* ------------------------------------------------------------------ analyse de fichier GPX / TCX */
const rad = x => x * Math.PI / 180;
function hav(a, b) {
  const R = 6371000, dLa = rad(b.lat - a.lat), dLo = rad(b.lon - a.lon);
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
const firstText = (el, name) => { const n = el.getElementsByTagNameNS("*", name)[0]; return n ? n.textContent.trim() : null; };
async function readTrack(file) {
  const text = await file.text();
  const doc = new DOMParser().parseFromString(text, "application/xml");
  if (doc.getElementsByTagName("parsererror").length) throw new Error("Fichier illisible. Exportez la séance en GPX ou TCX depuis votre montre ou Strava.");
  const pts = [];
  let kind = "";
  const trk = doc.getElementsByTagNameNS("*", "trkpt");
  const tcx = doc.getElementsByTagNameNS("*", "Trackpoint");
  if (trk.length) {
    kind = "gpx";
    for (let i = 0; i < trk.length; i++) {
      const el = trk[i];
      const e = firstText(el, "ele"), t = firstText(el, "time"), hr = firstText(el, "hr") || firstText(el, "heartrate");
      pts.push({ lat: +el.getAttribute("lat"), lon: +el.getAttribute("lon"), e: e != null ? +e : null, t: t ? Date.parse(t) : null, hr: hr ? +hr : null, dm: null });
    }
  } else if (tcx.length) {
    kind = "tcx";
    for (let i = 0; i < tcx.length; i++) {
      const el = tcx[i];
      const hrEl = el.getElementsByTagNameNS("*", "HeartRateBpm")[0];
      const la = firstText(el, "LatitudeDegrees"), lo = firstText(el, "LongitudeDegrees");
      const t = firstText(el, "Time"), dm = firstText(el, "DistanceMeters"), al = firstText(el, "AltitudeMeters");
      pts.push({ lat: la != null ? +la : null, lon: lo != null ? +lo : null, e: al != null ? +al : null, t: t ? Date.parse(t) : null, hr: hrEl ? +firstText(hrEl, "Value") : null, dm: dm != null ? +dm : null });
    }
  } else {
    throw new Error("Aucun point trouvé dans ce fichier. Formats pris en charge : GPX et TCX (exportez en GPX ou TCX si votre montre donne un fichier FIT).");
  }
  if (pts.length < 5) throw new Error("Ce fichier contient trop peu de points.");
  return Object.assign(buildStats(pts), { kind, name: file.name, file });
}
function buildStats(pts) {
  const n = pts.length;
  let d = 0, mt = 0, lastE = null;
  const out = [];
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    if (p.e == null) p.e = lastE; else lastE = p.e;
    if (i > 0) {
      const q = pts[i - 1];
      let dd = 0;
      if (p.dm != null && q.dm != null) dd = Math.max(0, p.dm - q.dm);
      else if (p.lat != null && q.lat != null) dd = hav(q, p);
      const dt = (p.t != null && q.t != null) ? (p.t - q.t) / 1000 : null;
      d += dd;
      if (dt != null && dt > 0 && dt <= 30 && dd / dt > 0.4) mt += dt;
    }
    out.push({ d, mt, e: p.e, hr: p.hr, t: p.t });
  }
  const hasT = out[0].t != null && out[n - 1].t != null;
  const hasE = out.some(o => o.e != null);
  const sm = new Array(n);
  if (hasE) {
    const w = clamp(Math.round(n / 400), 3, 25), h = Math.floor(w / 2);
    for (let i = 0; i < n; i++) {
      let s = 0, c = 0;
      for (let j = Math.max(0, i - h); j <= Math.min(n - 1, i + h); j++) if (out[j].e != null) { s += out[j].e; c++; }
      sm[i] = c ? s / c : null;
    }
  }
  const cg = new Array(n).fill(0);
  let gain = 0, loss = 0;
  if (hasE) {
    let ref = sm.find(v => v != null);
    for (let i = 0; i < n; i++) {
      const e = sm[i]; if (e == null) { cg[i] = gain; continue; }
      if (e - ref > 3) { gain += e - ref; ref = e; } else if (ref - e > 3) { loss += ref - e; ref = e; }
      cg[i] = gain;
    }
  }
  const splits = [];
  let k = 1, prevMt = 0, prevG = 0, prevD = 0, sumHr = 0, cntHr = 0;
  for (let i = 1; i < n; i++) {
    if (out[i].hr != null) { sumHr += out[i].hr; cntHr++; }
    while (out[i].d >= k * 1000 && out[i].d > out[i - 1].d) {
      const f = (k * 1000 - out[i - 1].d) / (out[i].d - out[i - 1].d);
      const mtK = out[i - 1].mt + f * (out[i].mt - out[i - 1].mt);
      const gK = cg[i - 1] + f * (cg[i] - cg[i - 1]);
      splits.push([hasT ? Math.round(mtK - prevMt) : 0, Math.round(gK - prevG), cntHr ? Math.round(sumHr / cntHr) : 0, 1]);
      prevMt = mtK; prevG = gK; prevD = k * 1000; sumHr = 0; cntHr = 0; k++;
    }
  }
  const rest = out[n - 1].d - prevD;
  if (rest >= 200 && hasT) {
    const fr = rest / 1000;
    splits.push([Math.round((out[n - 1].mt - prevMt) / fr), Math.round(cg[n - 1] - prevG), cntHr ? Math.round(sumHr / cntHr) : 0, Math.round(fr * 100) / 100]);
  }
  const step = Math.max(1, Math.floor(n / 140));
  const prof = [];
  if (hasE) for (let i = 0; i < n; i += step) if (sm[i] != null) prof.push([Math.round(out[i].d / 100) / 10, Math.round(sm[i])]);
  const hrs = out.filter(o => o.hr != null).map(o => o.hr);
  const km = out[n - 1].d / 1000;
  const startT = out[0].t;
  return {
    km: Math.round(km * 100) / 100,
    moveSec: hasT ? Math.round(out[n - 1].mt) : null,
    elapsedSec: hasT ? Math.round((out[n - 1].t - out[0].t) / 1000) : null,
    paceSec: hasT && km > 0 ? Math.round(out[n - 1].mt / km) : null,
    dp: hasE ? Math.round(gain) : null, dn: hasE ? Math.round(loss) : null,
    avgHr: hrs.length ? Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length) : null,
    maxHr: hrs.length ? Math.max(...hrs) : null,
    splits, prof,
    dateGuess: startT ? ymd(new Date(startT)) : null
  };
}

/* ------------------------------------------------------------------ graphiques SVG */
function elevChart(prof) {
  if (!prof || prof.length < 2) return "";
  const W = chartW(), H = 170, pl = 40, pr = 8, pt = 10, pb = 22;
  const xs = prof.map(p => p[0]), es = prof.map(p => p[1]);
  const xmax = Math.max.apply(null, xs) || 1;
  let emin = Math.min.apply(null, es), emax = Math.max.apply(null, es);
  if (emax - emin < 20) { const m = (emax + emin) / 2; emin = m - 10; emax = m + 10; }
  const X = x => pl + (x / xmax) * (W - pl - pr), Y = e => pt + (1 - (e - emin) / (emax - emin)) * (H - pt - pb);
  const line = prof.map((p, i) => (i ? "L" : "M") + X(p[0]).toFixed(1) + " " + Y(p[1]).toFixed(1)).join(" ");
  const area = line + " L" + X(xmax).toFixed(1) + " " + (H - pb) + " L" + X(xs[0]).toFixed(1) + " " + (H - pb) + " Z";
  const step = xmax > 30 ? 10 : xmax > 12 ? 5 : xmax > 5 ? 2 : 1;
  let grid = "";
  for (let x = 0; x <= xmax; x += step) grid += `<line class="ax" x1="${X(x)}" x2="${X(x)}" y1="${pt}" y2="${H - pb}"/><text x="${X(x)}" y="${H - 6}" text-anchor="${x + step > xmax ? "end" : "middle"}">${x} km</text>`;
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Profil altimétrique"><defs><linearGradient id="eg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--accent);stop-opacity:.55"/><stop offset="1" style="stop-color:var(--accent);stop-opacity:.03"/></linearGradient></defs>
    ${grid}<line class="ax" x1="${pl}" x2="${W - pr}" y1="${H - pb}" y2="${H - pb}"/>
    <text x="${pl - 5}" y="${Y(emax) + 4}" text-anchor="end">${Math.round(emax)} m</text><text x="${pl - 5}" y="${Y(emin) + 4}" text-anchor="end">${Math.round(emin)} m</text>
    <path class="ar" d="${area}"/><path class="ln" d="${line}"/></svg>`;
}
function splitsChart(splits) {
  const sp = splits.filter(s => s[0] > 0);
  if (sp.length < 2) return "";
  const W = chartW(), H = 190, pl = 8, pr = 8, pt = 18, pb = 22;
  const v = sp.map(s => 3600 / s[0]);
  const vmax = Math.max.apply(null, v);
  const bw = (W - pl - pr) / sp.length;
  let bars = "";
  sp.forEach((s, i) => {
    const h = (v[i] / vmax) * (H - pt - pb), x = pl + i * bw, y = H - pb - h;
    bars += `<rect class="${s[1] >= 25 ? "hl" : "dn"}" x="${(x + bw * 0.12).toFixed(1)}" y="${y.toFixed(1)}" width="${(bw * 0.76).toFixed(1)}" height="${h.toFixed(1)}"/>`;
    if (sp.length <= 14) bars += `<text x="${(x + bw / 2).toFixed(1)}" y="${(y - 4).toFixed(1)}" text-anchor="middle">${fmtPace(s[0])}</text>`;
    if (sp.length <= 20 || (i + 1) % 5 === 0 || i === 0) bars += `<text x="${(x + bw / 2).toFixed(1)}" y="${H - 6}" text-anchor="middle">${i + 1}</text>`;
  });
  if (sp.length >= 4) {
    let bi = 0, wi = 0; sp.forEach((s, i) => { if (s[0] < sp[bi][0]) bi = i; if (s[0] > sp[wi][0]) wi = i; });
    const rr = Math.max(4, Math.min(8, bw * 0.45));
    [bi, wi].forEach((i, k) => {
      const cx = pl + i * bw + bw / 2, cy = H - pb - (v[i] / vmax) * (H - pt - pb) + rr + 8;
      bars += `<g class="xh"><circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${rr.toFixed(1)}"/>${k ? `<path d="M${(cx - rr - 6).toFixed(1)} ${cy.toFixed(1)}h${(rr + 2).toFixed(1)}M${(cx + rr - 2 + 6 - 6 + 2).toFixed(1)} ${cy.toFixed(1)}h${(rr + 4).toFixed(1)}M${cx.toFixed(1)} ${(cy - rr - 6).toFixed(1)}v${(rr + 2).toFixed(1)}M${cx.toFixed(1)} ${(cy + rr - 2 + 2).toFixed(1)}v${(rr + 4).toFixed(1)}"/>` : ""}</g>`;
    });
  }
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Allure par kilomètre"><line class="ax" x1="${pl}" x2="${W - pr}" y1="${H - pb}" y2="${H - pb}"/>${bars}</svg>
    <p class="small mute">Allure par km (min'sec/km). Plus la barre est haute, plus le kilomètre est rapide. Rose : kilomètre avec au moins 25 m de D+. Cercle : meilleur kilomètre. Viseur : kilomètre le plus dur.</p>`;
}
function weeklyChart() {
  const W = chartW(), H = 190, pl = 32, pr = 6, pt = 12, pb = 22;
  const plan = PLAN.weeks.map(w => weekPlanKm(w.n)), done = PLAN.weeks.map(w => weekKm(w.n));
  const ymax = Math.ceil(Math.max(Math.max.apply(null, plan), Math.max.apply(null, done)) / 20) * 20;
  const bw = (W - pl - pr) / plan.length, Y = v => pt + (1 - v / ymax) * (H - pt - pb);
  const cw = weekOf(todayStr());
  let g = "";
  for (let t = 0; t <= ymax; t += 20) g += `<line class="ax" x1="${pl}" x2="${W - pr}" y1="${Y(t)}" y2="${Y(t)}"/><text x="${pl - 4}" y="${Y(t) + 3}" text-anchor="end">${t}</text>`;
  plan.forEach((p, i) => {
    const x = pl + i * bw;
    g += `<rect class="pl" x="${(x + 2).toFixed(1)}" y="${Y(p).toFixed(1)}" width="${(bw - 4).toFixed(1)}" height="${(H - pb - Y(p)).toFixed(1)}"/>`;
    if (done[i] > 0) g += `<rect class="dn" x="${(x + bw * 0.25).toFixed(1)}" y="${Y(done[i]).toFixed(1)}" width="${(bw * 0.5).toFixed(1)}" height="${(H - pb - Y(done[i])).toFixed(1)}"/>`;
    if (i % 4 === 0 || i === plan.length - 1) g += `<text x="${(x + bw / 2).toFixed(1)}" y="${H - 6}" text-anchor="middle">S${i + 1}</text>`;
    if (i + 1 === cw) g += `<rect x="${x.toFixed(1)}" y="${pt}" width="${bw.toFixed(1)}" height="${H - pt - pb}" fill="none" stroke="var(--ink)" stroke-width="1" stroke-dasharray="3 3"/>`;
  });
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Kilomètres par semaine, prévus et réalisés">${g}</svg>
    <p class="small mute">Fond clair : kilomètres prévus par semaine. Vert : kilomètres réalisés d'après vos séances importées. Cadre en pointillés : semaine en cours.</p>`;
}
function lineChart(pts, opts) {
  opts = opts || {};
  if (pts.length === 0) return "";
  const W = chartW(), H = 150, pl = 44, pr = 12, pt = 14, pb = 22;
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
  let x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs); if (x1 === x0) x1 = x0 + 1;
  let y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
  if (opts.target != null) { y0 = Math.min(y0, opts.target); y1 = Math.max(y1, opts.target); }
  const padY = (y1 - y0) * 0.15 || 1; y0 -= padY; y1 += padY;
  const X = x => pl + (x - x0) / (x1 - x0) * (W - pl - pr), Y = y => pt + (1 - (y - y0) / (y1 - y0)) * (H - pt - pb);
  const line = pts.map((p, i) => (i ? "L" : "M") + X(p.x).toFixed(1) + " " + Y(p.y).toFixed(1)).join(" ");
  const fy = opts.fmt || (v => (Math.round(v * 10) / 10).toString().replace(".", ","));
  let g = `<line class="ax" x1="${pl}" x2="${W - pr}" y1="${H - pb}" y2="${H - pb}"/>`;
  g += `<text x="${pl - 5}" y="${Y(y1) + 4}" text-anchor="end">${fy(y1)}</text><text x="${pl - 5}" y="${Y(y0) + 4}" text-anchor="end">${fy(y0)}</text>`;
  if (opts.target != null) g += `<line class="tg" x1="${pl}" x2="${W - pr}" y1="${Y(opts.target)}" y2="${Y(opts.target)}"/><text x="${W - pr}" y="${Y(opts.target) - 4}" text-anchor="end">${esc(opts.targetLabel || "")}</text>`;
  g += `<path class="ln" d="${line}"/>`;
  pts.forEach((p, i) => {
    g += `<circle cx="${X(p.x).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="3.5" fill="var(--accent)"/>`;
    if (i === pts.length - 1 || (i === 0 && pts.length > 1)) g += `<text x="${X(p.x).toFixed(1)}" y="${(Y(p.y) - 8).toFixed(1)}" text-anchor="${i === 0 && pts.length > 1 ? "start" : "end"}">${esc(p.label)}</text>`;
  });
  g += `<text x="${pl}" y="${H - 6}" text-anchor="start">${esc(pts[0].d)}</text>`;
  if (pts.length > 1) g += `<text x="${W - pr}" y="${H - 6}" text-anchor="end">${esc(pts[pts.length - 1].d)}</text>`;
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opts.aria || "Évolution")}">${g}</svg>`;
}

/* ------------------------------------------------------------------ texte de l'analyse */
function mdLite(text) {
  const lines = String(text || "").split(/\n/);
  let html = "", inList = false;
  const inline = s => esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  lines.forEach(l => {
    const t = l.trim();
    if (!t) { if (inList) { html += "</ul>"; inList = false; } return; }
    if (/^[-•]\s+/.test(t)) { if (!inList) { html += "<ul>"; inList = true; } html += "<li>" + inline(t.replace(/^[-•]\s+/, "")) + "</li>"; }
    else { if (inList) { html += "</ul>"; inList = false; } html += "<p>" + inline(t) + "</p>"; }
  });
  if (inList) html += "</ul>";
  return html;
}

