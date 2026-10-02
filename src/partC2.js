/* ------------------------------------------------------------------ rendu */
const ICONS = {
  today: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  plan: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  sessions: '<path d="M3 13h4l3-7 4 12 3-5h4"/>',
  meals: '<path d="M4 11h16a8 8 0 0 1-16 0zM9 7c0-1.6 1-2 1-3.4M14 7c0-1.6 1-2 1-3.4"/>',
  more: '<path d="M2.5 19.5l7-12 4 6.5 2.5-4 5.5 9.5z"/>'
};
const SUN = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
const MOON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/></svg>';
const TABS = [["today", "Aujourd'hui"], ["plan", "Programme"], ["sessions", "Séances"], ["meals", "Repas"], ["more", "Carnet"]];
const VIEWS = { today: viewToday, plan: viewPlan, sessions: viewSessions, meals: viewMeals, more: viewMore };
const themeIsDark = () => { const a = document.documentElement.getAttribute("data-theme"); return a ? a === "dark" : !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches); };
function render() {
  const a = document.activeElement;
  if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && a.type !== "file" && $("#main").contains(a)) { S.pending = true; return; }
  S.pending = false;
  $("#tabs").innerHTML = TABS.map(t => `<button class="tab" role="tab" data-act="tab" data-tab="${t[0]}" aria-selected="${S.tab === t[0]}"><svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[t[0]]}</svg><span>${t[1]}</span></button>`).join("");
  $("#themeBtn").innerHTML = themeIsDark() ? SUN : MOON;
  $("#lvl").innerHTML = lvlChip();
  $("#main").innerHTML = VIEWS[S.tab]();
  bindDrop();
}
let renderTimer = 0;
const later = () => { clearTimeout(renderTimer); renderTimer = setTimeout(render, 30); };
function setPath(path, v) {
  const p = path.split("."); let o = S; for (let i = 0; i < p.length - 1; i++) o = o[p[i]]; o[p[p.length - 1]] = v;
}
function bindDrop() {
  const z = $("#drop"); if (!z) return;
  ["dragenter", "dragover"].forEach(ev => z.addEventListener(ev, e => { e.preventDefault(); z.classList.add("over"); }));
  ["dragleave", "drop"].forEach(ev => z.addEventListener(ev, e => { e.preventDefault(); z.classList.remove("over"); }));
  z.addEventListener("drop", e => { if (e.dataTransfer && e.dataTransfer.files.length) importFiles(e.dataTransfer.files); });
}

/* ------------------------------------------------------------------ actions */
async function importFiles(fl) {
  S.importMsg = ""; S.importBusy = false;
  const arr = Array.from(fl);
  for (const f of arr) {
    try { S.queue.push(await readTrack(f)); } catch (e) { S.importMsg = f.name + " : " + (e.message || "fichier illisible"); }
  }
  S.inputs.impDate = "";
  render();
}
async function saveImport() {
  const q = S.queue[0]; if (!q || !hasStore()) return;
  const date = S.inputs.impDate || q.dateGuess || todayStr();
  S.importBusy = true; render();
  let rawAsset = null;
  if (S.assets && q.file) {
    try { const r = await S.assets.upload(q.file, { type: "text/plain" }); rawAsset = r.id; } catch (e) { toast("Le fichier original n'a pas été conservé : " + errText(e)); }
  }
  const id = "s-" + date.replace(/-/g, "") + "-" + uid8();
  const pd = planDay(date);
  const doc = { date, name: q.name, kind: q.kind, km: q.km, moveSec: q.moveSec, elapsedSec: q.elapsedSec, paceSec: q.paceSec, dp: q.dp, dn: q.dn, avgHr: q.avgHr, maxHr: q.maxHr, splits: q.splits, prof: q.prof, planned: pd ? pd.day.t : "", at: new Date().toISOString() };
  if (rawAsset) doc.rawAsset = rawAsset;
  const shoe = S.inputs.impShoe != null ? S.inputs.impShoe : (S.profile.defaultShoe || "");
  if (shoe) doc.shoe = shoe;
  const ok = await save("Enregistrement", () => S.base.collection("sessions").doc(id).set(doc));
  S.importBusy = false;
  if (ok) { S.queue.shift(); S.inputs.impDate = ""; S.inputs.impShoe = null; S.sel = id; toast("Séance enregistrée."); if (autoAI() && S.sample) setTimeout(() => analyzeSession(id, "coach"), 80); }
  render();
}
function cutSplits(s) {
  return (s.splits || []).map((x, i) => `km ${x[3] < 1 ? fmtKm(i + x[3]) : i + 1} : ${fmtPace(x[0])}/km, ${x[1] >= 0 ? "+" : ""}${x[1]} m${x[2] ? ", " + x[2] + " bpm" : ""}`).join("\n");
}
async function downloadRaw(id) {
  const s = S.sessions.find(x => x.id === id); if (!s || !s.rawAsset || !S.downloads) return;
  try {
    const r = await fetch(blobUrl(s.rawAsset)); if (!r.ok) throw new Error("Fichier introuvable");
    const t = await r.text();
    const base = (s.name || "seance").replace(/\.[^.]+$/, "");
    await S.downloads.save({ filename: base + "-" + s.date + ".txt", data: t });
  } catch (e) { if (!e || e.code !== "declined") toast("Téléchargement impossible : " + errText(e)); }
}
function pickPhoto(file) {
  if (!file) return;
  S.draft.err = "";
  createImageBitmap(file).then(bmp => {
    const max = 1280, sc = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas"); c.width = Math.round(bmp.width * sc); c.height = Math.round(bmp.height * sc);
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    c.toBlob(b => {
      if (!b) { S.draft.err = "Cette photo n'a pas pu être lue."; render(); return; }
      if (S.draft.previewUrl) { try { URL.revokeObjectURL(S.draft.previewUrl); } catch (e) {} }
      S.draft.blob = b; S.draft.previewUrl = URL.createObjectURL(b);
      S.draft.desc = ""; S.draft.kcal = ""; S.draft.p = ""; S.draft.c = ""; S.draft.f = ""; S.draft.comment = ""; S.draft.conf = "";
      render();
      if (autoAI() && S.sample && S.canImages) analyzeMeal();
    }, "image/jpeg", 0.82);
  }).catch(() => { S.draft.err = "Cette photo n'a pas pu être lue. Essayez un fichier JPEG ou PNG."; render(); });
}
async function saveMeal() {
  const d = S.draft; if (!hasStore()) return;
  if (!d.desc && !d.note && !d.blob && d.kcal === "") { toast("Ajoutez une photo ou une description."); return; }
  let photo = null;
  if (d.blob && S.assets) { try { photo = (await S.assets.upload(d.blob, { type: "image/jpeg" })).id; } catch (e) { toast("La photo n'a pas été conservée : " + errText(e)); } }
  const doc = { date: S.date, time: d.time, kind: d.kind, desc: d.desc || d.note || "", note: d.note, kcal: Math.round(num(d.kcal) || 0), p: Math.round(num(d.p) || 0), c: Math.round(num(d.c) || 0), f: Math.round(num(d.f) || 0), conf: d.conf, comment: d.comment, at: new Date().toISOString() };
  if (photo) doc.photo = photo;
  const id = "m-" + S.date.replace(/-/g, "") + "-" + uid8();
  if (await save("Enregistrement", () => S.base.collection("meals").doc(id).set(doc))) { resetDraft(); toast("Repas enregistré."); }
  render();
}
function resetDraft() {
  if (S.draft.previewUrl) { try { URL.revokeObjectURL(S.draft.previewUrl); } catch (e) {} }
  S.draft = { kind: S.draft.kind, time: nowHM(), note: "", blob: null, previewUrl: "", desc: "", kcal: "", p: "", c: "", f: "", conf: "", comment: "", busy: false, err: "" };
}
async function advice() {
  if (!S.sample) return;
  const date = S.date, pd = planDay(date), W = weightOn(date), tg = targets(pd ? pd.day : null, W), tot = totalsOn(date);
  const list = mealsOn(date).map(m => `${m.time} ${m.kind} : ${m.desc} (${m.kcal} kcal, P ${m.p}, G ${m.c}, L ${m.f})`).join("\n") || "aucun repas enregistré";
  const prompt = `Tu es diététicien du sport. ${addr()} Réponds en français, 130 mots au maximum, en deux paragraphes : **Bilan** (écart avec les cibles, en chiffres) et **Prochain repas** (2 ou 3 idées concrètes avec quantités pour combler l'écart, sans dépasser les cibles).
Athlète : ${W} kg, trail de 42 km le 25 avril. Séance du jour : ${pd ? pd.day.t + " (" + pd.day.km + " km, +" + pd.day.dp + " m)" : "repos"}. Il est ${nowHM()}.
Cibles : ${tg.kcal} kcal, P ${tg.p} g, G ${tg.c} g, L ${tg.f} g${tg.intra ? ", dont " + tg.intra + " g de glucides pendant l'effort" : ""}.
Déjà mangé (${tot.kcal} kcal, P ${tot.p}, G ${tot.c}, L ${tot.f}) :
${list}`;
  S.advice = { busy: true, text: "", err: "" }; render();
  try {
    const r = await S.sample(prompt, { cache: false, modelTier: "quick", onText: u => { S.advice.text = u.text; const el = $("#advText"); if (el) el.innerHTML = mdLite(u.text); } });
    S.advice = { busy: false, text: r.text, err: "" };
  } catch (e) { S.advice = { busy: false, text: e && e.text || "", err: errText(e) }; }
  render();
}
async function review() {
  if (!S.sample) return;
  const t = todayStr(), from = addDays(t, -6), W = weightOn(t);
  const ss = S.sessions.filter(s => s.date >= from && s.date <= t).sort((a, b) => a.date < b.date ? -1 : 1);
  const lines = ss.map(s => `${s.date} : ${s.planned || "séance"} → ${fmtKm(s.km)} km à ${fmtPace(s.paceSec)}/km, +${s.dp || 0} m${s.avgHr ? ", FC " + s.avgHr : ""}`).join("\n") || "aucune séance importée";
  let planned = 0; for (let i = 0; i < 7; i++) { const p = planDay(addDays(from, i)); if (p) planned += p.day.km; }
  let nut = [], days = 0;
  for (let i = 0; i < 7; i++) { const d = addDays(from, i), tot = totalsOn(d); if (tot.kcal) { const p = planDay(d), g = targets(p ? p.day : null, weightOn(d)); days++; nut.push(`${d} : ${tot.kcal}/${g.kcal} kcal, P ${tot.p}/${g.p}, G ${tot.c}/${g.c}`); } }
  const ms = S.measures.slice().sort((a, b) => a.date < b.date ? -1 : 1).slice(-4).map(m => `${m.date} : ${m.weight != null ? m.weight + " kg" : ""}${m.vo2 != null ? " VO2 " + m.vo2 : ""}${m.rhr != null ? " FC repos " + m.rhr : ""}`).join("\n") || "aucune";
  const prompt = `Tu es entraîneur de trail et diététicien du sport. ${addr()} Fais le bilan des 7 derniers jours en français, 200 mots au maximum, en trois paragraphes en gras : **Entraînement**, **Alimentation**, **Ajustement de la semaine qui vient** (une ou deux actions précises).
Objectif : 42 km, 1 050 m D+, 25 avril 2027 en 4 h 35. Poids ${W} kg. Semaine du programme : ${weekOf(t) >= 1 && weekOf(t) <= 25 ? weekOf(t) : "avant le début du plan"}. Kilomètres prévus sur ces 7 jours : ${planned}.
Séances importées :
${lines}
Alimentation (réel/cible) sur ${days} jour(s) renseigné(s) :
${nut.join("\n") || "aucun repas enregistré"}
Dernières mesures :
${ms}
S'il manque des données, dis-le simplement et base-toi sur ce qui existe.`;
  S.review = { busy: true, text: "", err: "" }; render();
  try {
    const r = await S.sample(prompt, { cache: false, onText: u => { S.review.text = u.text; const el = $("#revText"); if (el) el.innerHTML = mdLite(u.text); } });
    S.review = { busy: false, text: r.text, err: "" };
  } catch (e) { S.review = { busy: false, text: e && e.text || "", err: errText(e) }; }
  render();
}
async function saveMeasure() {
  const f = S.mform; if (!hasStore()) return;
  const w = num(f.weight), v = num(f.vo2), r = num(f.rhr), tk = f.tenk ? parseMMSS(f.tenk) : null;
  if (w == null && v == null && r == null && tk == null) { toast("Renseignez au moins une valeur."); return; }
  if (f.tenk && tk == null) { toast("Chrono au format 48:00."); return; }
  const prev = S.measures.find(m => m.id === f.date) || {};
  const doc = { date: f.date };
  if (w != null) doc.weight = w; else if (prev.weight != null) doc.weight = prev.weight;
  if (v != null) doc.vo2 = v; else if (prev.vo2 != null) doc.vo2 = prev.vo2;
  if (r != null) doc.rhr = r; else if (prev.rhr != null) doc.rhr = prev.rhr;
  if (tk != null) doc.tenkSec = tk; else if (prev.tenkSec != null) doc.tenkSec = prev.tenkSec;
  if (await save("Enregistrement", () => S.base.collection("measures").doc(f.date).set(doc))) { toast("Mesure enregistrée."); S.mform.weight = ""; S.mform.vo2 = ""; S.mform.rhr = ""; S.mform.tenk = ""; }
  render();
}
let wchain = Promise.resolve();
const enqueue = fn => { wchain = wchain.then(fn).catch(() => {}); return wchain; };
function patchProfile(patch, quiet) {
  if (!hasStore()) { toast("Enregistrement indisponible sur cet appareil."); return; }
  S.profile = Object.assign({}, S.profile, patch);
  Object.keys(S.profile).forEach(k => { if (S.profile[k] == null) delete S.profile[k]; });
  applyProfile();
  if (!quiet) render();
  enqueue(() => save("Enregistrement", () => S.base.set(S.profile)));
}
function saveDay(date, patch) {
  if (!hasStore()) { toast("Enregistrement indisponible sur cet appareil."); return; }
  const cur = Object.assign({}, dayOf(date), patch); delete cur.id;
  Object.keys(cur).forEach(k => { if (cur[k] == null) delete cur[k]; });
  const i = S.days.findIndex(x => x.id === date), loc = Object.assign({ id: date }, cur);
  if (i >= 0) S.days[i] = loc; else S.days.push(loc);
  render();
  enqueue(() => save("Enregistrement", () => S.base.collection("days").doc(date).set(cur)));
}
function toggleDone(date) {
  const c = Object.assign({}, checks()); if (c[date]) delete c[date]; else c[date] = true;
  patchProfile({ checks: c });
}
async function briefing() {
  const t = todayStr(), pd = planDay(t); if (!S.sample || !pd) return;
  const W = weightOn(t), tg = targets(pd.day, W), d = dayOf(t), r = readiness(d);
  const prompt = `Tu es entraîneur de trail running. ${addr()} Réponds en français, 170 mots au maximum, en trois courts paragraphes introduits par un mot en gras : **Échauffement**, **Séance**, **Après**. Pas d'autre titre, pas de tableau.

Contexte : objectif 42 km avec 1 050 m de D+ le 25 avril 2027 en 4 h 35. Zones d'allure sur le plat : facile 6'30 à 7'10/km, seuil 5'10 à 5'25, VO2max 4'30 à 4'45, 10 km 4'50 à 5'00, allure course 5'50 à 6'10. Poids ${W} kg.
Séance du jour (${DAYS[pd.di]}, semaine ${pd.wn}, phase ${pd.week.phase}) : ${pd.day.t}, ${pd.day.km} km, +${pd.day.dp} m.
Forme du jour : ${r ? "score " + r.score + "/100 (sommeil " + (d.sleep != null ? d.sleep + " h" : "non noté") + ", jambes " + (d.legs != null ? d.legs + "/5" : "non noté") + ", moral " + (d.mood != null ? d.mood + "/5" : "non noté") + ", douleur " + ["aucune", "légère", "gênante"][d.pain == null ? 0 : d.pain] + ")" : "non renseignée"}.
Cibles de nutrition : ${tg.kcal} kcal, ${tg.c} g de glucides${tg.intra ? ", dont " + tg.intra + " g pendant l'effort" : ""}, eau ${tg.water} L.
Donne les allures précises par segment ou répétition, puis quoi manger avant (délai et quantité) et après (dans les 45 minutes). Si la forme du jour est mauvaise, adapte la séance. Si c'est un jour de repos, dis quoi faire de la journée.`;
  S.brief = { date: t, busy: true, text: "", err: "" }; render();
  try {
    const r2 = await S.sample(prompt, { cache: false, onText: u => { S.brief.text = u.text; const el = $("#briefText"); if (el) el.innerHTML = mdLite(u.text); } });
    S.brief = { date: t, busy: false, text: r2.text, err: "" };
  } catch (e) { S.brief = { date: t, busy: false, text: e && e.text || "", err: errText(e) }; }
  render();
}
function csvEscape(v) { const s = v == null ? "" : String(v); return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
const toCsv = (cols, rows) => [cols.join(",")].concat(rows.map(r => cols.map(c => csvEscape(r[c])).join(","))).join("\n");
async function exportFile(name, data) {
  if (!S.downloads) return;
  try { await S.downloads.save({ filename: name, data }); } catch (e) { if (!e || e.code !== "declined") toast("Export impossible : " + errText(e)); }
}
function doExport(kind) {
  const day = todayStr();
  if (kind === "json") return exportFile("carnet-ntmf42-" + day + ".json", JSON.stringify({ exportedAt: new Date().toISOString(), sessions: S.sessions, meals: S.meals, measures: S.measures, days: S.days, profile: S.profile }, null, 1));
  if (kind === "sessions") return exportFile("seances-" + day + ".csv", toCsv(["date", "planned", "name", "km", "moveSec", "paceSec", "dp", "dn", "avgHr", "maxHr"], S.sessions.slice().sort((a, b) => a.date < b.date ? -1 : 1)));
  if (kind === "meals") return exportFile("repas-" + day + ".csv", toCsv(["date", "time", "kind", "desc", "kcal", "p", "c", "f"], S.meals.slice().sort((a, b) => (a.date + (a.time || "")) < (b.date + (b.time || "")) ? -1 : 1)));
  if (kind === "days") return exportFile("forme-" + day + ".csv", toCsv(["date", "sleep", "legs", "mood", "pain", "water"], S.days.map(x => Object.assign({ date: x.id }, x)).sort((a, b) => a.date < b.date ? -1 : 1)));
  if (kind === "measures") return exportFile("mesures-" + day + ".csv", toCsv(["date", "weight", "vo2", "rhr", "tenkSec"], S.measures.slice().sort((a, b) => a.date < b.date ? -1 : 1)));
}

/* ------------------------------------------------------------------ événements */
async function act(a, b) {
  const d = b.dataset;
  switch (a) {
    case "tab": S.tab = d.tab; if (d.tab !== "sessions") S.sel = null; S.confirmDel = null; render(); window.scrollTo(0, 0); break;
    case "anMode": S.anMode = d.m; render(); break;
    case "askQ": askSession(d.id, d.q); break;
    case "askSession": askSession(d.id); break;
    case "trend": trendAI(); break;
    case "mealTip": mealTip(d.id); break;
    case "dayReview": dayReview(); break;
    case "menu": tomorrowMenu(); break;
    case "weekNutri": weekNutri(); break;
    case "autoAI": patchProfile({ autoAI: !autoAI() }); break;
    case "sub": S.sub = d.sub; S.confirmDel = null; render(); window.scrollTo(0, 0); break;
    case "theme": { const nx = themeIsDark() ? "light" : "dark"; document.documentElement.setAttribute("data-theme", nx); try { localStorage.setItem("ntmf-theme", nx); } catch (e) {} render(); break; }
    case "gear": { const g = Object.assign({}, (S.profile && S.profile.gear) || {}); if (g[d.k]) delete g[d.k]; else g[d.k] = true; patchProfile({ gear: g }); break; }
    case "day": { const v = Number(d.v); saveDay(d.date, { [d.k]: dayOf(d.date)[d.k] === v ? null : v }); break; }
    case "water": saveDay(d.date, { water: Math.max(0, (dayOf(d.date).water || 0) + Number(d.n)) }); break;
    case "briefing": briefing(); break;
    case "addShoe": { const name = (S.shoeForm.name || "").trim(); if (!name) { toast("Donnez un nom à la paire."); break; } const id = "sh-" + uid8(); patchProfile({ shoes: shoes().concat([{ id, name, start: num(S.shoeForm.start) || 0, max: num(S.shoeForm.max) || 800 }]), defaultShoe: S.profile.defaultShoe || id }); S.shoeForm = { name: "", start: "0", max: "800" }; render(); break; }
    case "addHoka": { const id = "sh-" + uid8(); patchProfile({ shoes: shoes().concat([{ id, name: "Hoka Clifton 10", start: 700, max: 800 }]), defaultShoe: S.profile.defaultShoe || id }); break; }
    case "shoeDefault": patchProfile({ defaultShoe: d.id }); break;
    case "shoeDel": S.confirmDel = null; patchProfile({ shoes: shoes().filter(x => x.id !== d.id), defaultShoe: S.profile.defaultShoe === d.id ? "" : S.profile.defaultShoe }); break;
    case "exportDays": doExport("days"); break;
    case "week": S.weekSel = +d.n; S.tab = "plan"; render(); break;
    case "goImport": S.tab = "sessions"; render(); break;
    case "goMeals": S.tab = "meals"; S.date = todayStr(); render(); break;
    case "openSession": S.tab = "sessions"; S.sel = d.id; render(); window.scrollTo(0, 0); break;
    case "closeSession": S.sel = null; S.confirmDel = null; render(); break;
    case "toggleDone": toggleDone(d.date); break;
    case "saveImport": saveImport(); break;
    case "skipImport": S.queue.shift(); S.inputs.impDate = ""; render(); break;
    case "analyzeSession": analyzeSession(d.id); break;
    case "stopAnalysis": if (ctl) ctl.abort(); break;
    case "downloadRaw": downloadRaw(d.id); break;
    case "askDel": S.confirmDel = d.id; render(); break;
    case "cancelDel": S.confirmDel = null; render(); break;
    case "deleteSession": {
      const s = S.sessions.find(x => x.id === d.id); S.confirmDel = null;
      if (s && await save("Suppression", () => S.base.collection("sessions").doc(d.id).delete())) { if (s.rawAsset && S.assets) { try { await S.assets.delete(s.rawAsset); } catch (e) {} } S.sel = null; toast("Séance supprimée."); }
      render(); break;
    }
    case "deleteMeal": {
      const m = S.meals.find(x => x.id === d.id); S.confirmDel = null;
      if (m && await save("Suppression", () => S.base.collection("meals").doc(d.id).delete())) { if (m.photo && S.assets) { try { await S.assets.delete(m.photo); } catch (e) {} } toast("Repas supprimé."); }
      render(); break;
    }
    case "deleteMeasure": S.confirmDel = null; await save("Suppression", () => S.base.collection("measures").doc(d.id).delete()); render(); break;
    case "dateShift": S.date = addDays(S.date, +d.n); S.advice = { busy: false, text: "", err: "" }; render(); break;
    case "dateToday": S.date = todayStr(); S.advice = { busy: false, text: "", err: "" }; render(); break;
    case "analyzeMeal": analyzeMeal(); break;
    case "saveMeal": saveMeal(); break;
    case "resetDraft": resetDraft(); render(); break;
    case "advice": advice(); break;
    case "review": review(); break;
    case "saveMeasure": saveMeasure(); break;
    case "exportJson": doExport("json"); break;
    case "exportSessions": doExport("sessions"); break;
    case "exportMeals": doExport("meals"); break;
    case "exportMeasures": doExport("measures"); break;
    case "goProfile": S.tab = "more"; S.sub = "data"; render(); window.scrollTo(0, 0); break;
    case "hideHint": try { localStorage.setItem("ntmf-hint", "1"); } catch (e) {} render(); break;
    case "testKey": testKey(); break;
    case "clearKey": if (window.__web) window.__web.clearKey(); await refreshSample(); toast("Clé retirée de cet appareil."); break;
    case "usage": try { S.usage = (await S.assets.list()).usage; } catch (e) { toast(errText(e)); } render(); break;
  }
}
document.addEventListener("click", e => { const b = e.target.closest("[data-act]"); if (b) act(b.dataset.act, b); });
document.addEventListener("input", e => {
  const t = e.target; if (!t.dataset || !t.dataset.bind) return;
  setPath(t.dataset.bind, t.value);
  if (t.dataset.live && LIVE[t.dataset.live]) { const el = $("#" + t.dataset.live); if (el) el.innerHTML = LIVE[t.dataset.live](); }
});
document.addEventListener("change", e => {
  const t = e.target;
  if (t.dataset && t.dataset.bind) {
    setPath(t.dataset.bind, t.value);
    if (t.dataset.bind === "date") { S.advice = { busy: false, text: "", err: "" }; }
    if (t.dataset.persist === "goal") { const g = parseHM(t.value); S.inputs.goal = null; if (g && g >= 7200 && g <= 32400) { patchProfile({ goalSec: g }, true); t.value = toHM(g); const el = $("#goalOut"); if (el) el.innerHTML = goalHtml(); } else { toast("Temps invalide. Exemple : 4:35"); t.value = toHM(goalNow()); const el = $("#goalOut"); if (el) el.innerHTML = goalHtml(); } }
    if (t.dataset.bind === "date" || t.dataset.bind === "inputs.impDate") later();
  }
  if (t.dataset && t.dataset.change === "import") { importFiles(t.files); t.value = ""; }
  if (t.dataset && t.dataset.change === "photo") { pickPhoto(t.files[0]); t.value = ""; }
  if (t.dataset && t.dataset.change === "restore") { restoreBackup(t.files[0]); t.value = ""; }
  if (t.dataset && t.dataset.persist === "prof") saveProfField(t.dataset.k, t.value);
  if (t.dataset && t.dataset.persist === "apikey") { saveKey(t.value); t.value = ""; }
});
let lastW = 0, rsT = 0;
window.addEventListener("resize", () => { clearTimeout(rsT); rsT = setTimeout(() => { const m = document.getElementById("main"), w = m ? m.clientWidth : 0; if (Math.abs(w - lastW) > 24) { lastW = w; render(); } }, 200); });
document.addEventListener("keydown", e => { const t = e.target; if (e.key === "Enter" && t.dataset && t.dataset.enter) { e.preventDefault(); const pr = { dataset: Object.assign({}, t.dataset) }; t.blur(); act(t.dataset.enter, pr); } });
document.addEventListener("focusout", () => { if (S.pending) setTimeout(() => { if (S.pending) render(); }, 350); });

/* ------------------------------------------------------------------ démarrage */
async function init() {
  try { const th = localStorage.getItem("ntmf-theme"); if (th === "dark" || th === "light") document.documentElement.setAttribute("data-theme", th); } catch (e) {}
  render();
  const [db, user, assets, sample, downloads] = await Promise.all([use("db"), use("user"), use("assets"), use("sample"), use("downloads")]);
  S.assets = assets; S.sample = sample; S.downloads = downloads;
  if (sample && sample.limits) { try { const l = await sample.limits(); S.canImages = !!(l && l.images); } catch (e) { S.canImages = false; } }
  let id = null; try { id = user ? await user.id() : null; } catch (e) { id = null; }
  S.uid = id;
  if (db && id) {
    S.base = db.doc("data/users/" + id + "/profile");
    const err = e => { toast("Lecture des données : " + errText(e)); };
    S.base.onSnapshot(snap => { S.profile = snap.exists ? (snap.data() || {}) : {}; applyProfile(); later(); }, err);
    S.base.collection("sessions").onSnapshot(q => { S.sessions = q.docs.map(d => Object.assign({ id: d.id }, d.data())); later(); }, err);
    S.base.collection("meals").onSnapshot(q => { S.meals = q.docs.map(d => Object.assign({ id: d.id }, d.data())); later(); }, err);
    S.base.collection("days").onSnapshot(q => { S.days = q.docs.map(d => Object.assign({ id: d.id }, d.data())); later(); }, err);
    S.base.collection("measures").onSnapshot(q => { S.measures = q.docs.map(d => Object.assign({ id: d.id }, d.data())); later(); }, err);
  }
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}
  S.ready = true;
  render();
}
init();
})();
</script>
