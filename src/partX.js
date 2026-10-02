
/* ------------------------------------------------------------------ XP, niveaux, fil d'actu */
const RANKS = ["Joggeur du dimanche", "Chaussures crottées", "Marmotte", "Chamois", "Bouquetin", "Chèvre en pleine forme", "Yéti", "Légende du sentier", "Finisher en puissance"];
const sessionXp = s => Math.round((s.km || 0) * 10 + (s.dp || 0) / 5);
const levelOf = xp => Math.floor(Math.sqrt(xp / 60)) + 1;
const xpAt = lv => 60 * (lv - 1) * (lv - 1);
const rankOf = lv => RANKS[Math.min(RANKS.length - 1, Math.floor((lv - 1) / 2))];
const autoAI = () => !S.profile || S.profile.autoAI !== false;
function levelInfo() {
  const xp = S.sessions.reduce((a, s) => a + sessionXp(s), 0) + 100 * badgeList().filter(b => b.ok).length;
  const lv = levelOf(xp), a = xpAt(lv), b = xpAt(lv + 1);
  return { xp, lv, rank: rankOf(lv), pct: Math.round((xp - a) / (b - a) * 100), toNext: b - xp, cur: xp - a, span: b - a };
}
function lvlChip() {
  const L = levelInfo();
  return `<span>Niv. ${L.lv}<span class="rk"> · ${esc(L.rank)}</span></span><div class="xpb" role="img" aria-label="${L.pct} % vers le niveau suivant"><i style="width:${L.pct}%"></i></div>`;
}
function hudHtml() {
  const L = levelInfo();
  return `<div class="hud"><span class="chip">NIV. ${L.lv}</span><span>${esc(L.rank)}</span><div class="xpb" role="img" aria-label="${L.pct} % vers le niveau suivant"><i style="width:${L.pct}%"></i></div><span class="xpt">${fmtNum(L.cur)} / ${fmtNum(L.span)} XP</span></div>`;
}
function levelCard() {
  const L = levelInfo(), nextRank = rankOf(L.lv + 1) !== L.rank ? rankOf(L.lv + 1) : null;
  const ladder = RANKS.map((r, i) => `<span class="peak${L.lv >= i * 2 + 1 ? " on" : ""}">${i * 2 + 1}+ · ${esc(r)}</span>`).join("");
  return `<div class="card hl"><div class="card-h"><div><div class="label">Niveau ${L.lv}</div><h2>${esc(L.rank)}</h2></div><div class="big">${fmtNum(L.xp)}<small class="mute" style="font-size:18px"> XP</small></div></div>
    <div class="bar" style="margin-bottom:8px"><i style="width:${L.pct}%"></i></div>
    <p class="small mute">Encore ${fmtNum(L.toNext)} XP pour le niveau ${L.lv + 1}${nextRank ? ", rang « " + esc(nextRank) + " »" : ""}. Chaque kilomètre rapporte 10 XP, chaque tranche de 100 m de D+ rapporte 20 XP, chaque trophée 100 XP.</p>
    <div class="peaks">${ladder}</div></div>`;
}
const relDay = d => { const n = dayDiff(todayStr(), d); return n === 0 ? "aujourd'hui" : n === 1 ? "hier" : n > 1 ? "il y a " + n + " j" : "dans " + (-n) + " j"; };
function feedCard() {
  const it = [];
  S.sessions.forEach(s => it.push({ d: s.date, t: "Séance de " + fmtKm(s.km) + " km" + (s.dp ? ", +" + s.dp + " m" : ""), x: "+" + sessionXp(s) + " XP" }));
  S.measures.forEach(m => it.push({ d: m.date, t: "Mesure" + (m.weight != null ? " : " + String(m.weight).replace(".", ",") + " kg" : "") + (m.vo2 != null ? ", VO2max " + String(m.vo2).replace(".", ",") : "") + (m.tenkSec ? ", 10 km en " + mmss(m.tenkSec) : ""), x: "" }));
  const byDay = {}; S.meals.forEach(m => { (byDay[m.date] = byDay[m.date] || []).push(m); });
  Object.keys(byDay).forEach(d => it.push({ d, t: byDay[d].length + " repas, " + fmtNum(byDay[d].reduce((a, m) => a + (m.kcal || 0), 0)) + " kcal", x: "" }));
  S.days.forEach(x => { const r = readiness(x); if (r) it.push({ d: x.id, t: "Forme du jour : " + r.score + " sur 100", x: "" }); });
  it.sort((a, b) => a.d < b.d ? 1 : a.d > b.d ? -1 : 0);
  const top = it.filter(x => dayDiff(todayStr(), x.d) >= 0).slice(0, 6);
  return `<div class="card"><div class="card-h"><h3>Fil d'actu</h3></div>${top.length ? `<div class="feed">${top.map(x => `<div class="fd"><span class="fd-d">${esc(relDay(x.d))}</span><span>${esc(x.t)}</span><span class="fd-x">${esc(x.x)}</span></div>`).join("")}</div>` : `<p class="empty">Rien pour l'instant. Importez une séance, pesez-vous ou photographiez un repas : tout apparaît ici.</p>`}</div>`;
}

/* ------------------------------------------------------------------ indicateurs de charge (calcul local) */
function loadStats() {
  const t = todayStr(), sum = (a, b) => S.sessions.filter(s => s.date >= a && s.date <= b).reduce((x, s) => x + (s.km || 0), 0);
  const acute = sum(addDays(t, -6), t), chronic = sum(addDays(t, -34), addDays(t, -7)) / 4;
  const rec = S.sessions.filter(s => s.date >= addDays(t, -13) && s.date <= t);
  let easy = 0, all = 0; rec.forEach(s => { const z = zoneBreak(s); easy += z[1] + z[2]; all += z.reduce((a, b) => a + b, 0); });
  const eff = S.sessions.filter(s => s.avgHr && s.paceSec && s.km >= 5).sort((a, b) => a.date < b.date ? -1 : 1).map(s => ({ d: s.date, v: 3600 / s.paceSec / s.avgHr * 100 }));
  let effDelta = null; if (eff.length >= 3) { const last = eff[eff.length - 1].v, prev = eff.slice(Math.max(0, eff.length - 4), eff.length - 1), pm = prev.reduce((a, b) => a + b.v, 0) / prev.length; effDelta = (last / pm - 1) * 100; }
  return { acute, chronic, ratio: chronic > 0 ? acute / chronic : null, easyPct: all > 0 ? easy / all * 100 : null, effDelta, n14: rec.length };
}
function indicatorsCard() {
  const L = loadStats();
  const tagR = L.ratio == null ? "" : L.ratio > 1.5 ? `<span class="tag bad">Trop vite</span>` : L.ratio > 1.25 ? `<span class="tag warn">À surveiller</span>` : L.ratio < 0.7 ? `<span class="tag warn">En retrait</span>` : `<span class="tag ok">Dans la zone</span>`;
  const tagE = L.easyPct == null ? "" : L.easyPct < 60 ? `<span class="tag warn">Trop dur</span>` : `<span class="tag ok">Bien réparti</span>`;
  if (!L.n14 && L.acute === 0) return `<div class="card plain"><h3>Indicateurs</h3><p class="mute" style="margin-top:6px">Ils apparaissent après vos premières séances : montée en charge, part d'allure facile, efficacité cardiaque.</p></div>`;
  return `<div class="card"><div class="card-h"><h3>Indicateurs</h3><span class="small mute">calculés sur vos séances</span></div><div class="stats">
    <div class="stat"><div class="v">${L.ratio != null ? String(Math.round(L.ratio * 100) / 100).replace(".", ",") : "–"}</div><div class="k">Charge 7 jours / habitude ${tagR}</div></div>
    <div class="stat"><div class="v">${L.easyPct != null ? Math.round(L.easyPct) : "–"}<small>%</small></div><div class="k">Allure facile, 14 jours ${tagE}</div></div>
    <div class="stat"><div class="v">${L.effDelta != null ? (L.effDelta >= 0 ? "+" : "") + String(Math.round(L.effDelta * 10) / 10).replace(".", ",") : "–"}<small>%</small></div><div class="k">Efficacité cardiaque vs 3 dernières</div></div></div>
    <p class="small mute" style="margin-top:12px">Charge : kilomètres des 7 derniers jours divisés par votre moyenne hebdomadaire des 4 semaines précédentes (visez 0,8 à 1,25). Efficacité : vitesse par battement, plus c'est haut mieux c'est.</p></div>`;
}

/* ------------------------------------------------------------------ IA : séances */
let ctl = null;
const waitFor = async (fn, ms) => { const t0 = Date.now(); let v = fn(); while (!v && Date.now() - t0 < ms) { await new Promise(r => setTimeout(r, 120)); v = fn(); } return v; };
function sessionFacts(s) {
  const pd = planDay(s.date), W = weightOn(s.date);
  const recent = S.sessions.filter(x => x.id !== s.id && x.date < s.date).sort((a, b) => a.date < b.date ? 1 : -1).slice(0, 5)
    .map(x => `${x.date} : ${fmtKm(x.km)} km à ${fmtPace(x.paceSec)}/km, +${x.dp || 0} m${x.avgHr ? ", FC " + x.avgHr : ""}${x.planned ? " (" + x.planned + ")" : ""}`).join("\n") || "aucune";
  return `Contexte : objectif 42 km avec 1 050 m de D+ le 25 avril 2027 en 4 h 35 (plan B 4 h 50). Record 10 km : ${mmss(S.measures.filter(m => m.tenkSec != null).reduce((a, m) => Math.min(a, m.tenkSec), K.t10))}. Poids ${W} kg. Zones d'allure sur le plat : facile 6'30 à 7'10/km, seuil 5'10 à 5'25/km, VO2max 4'30 à 4'45/km, allure course 5'50 à 6'10/km. En côte, on juge à l'effort, et on marche dès que la pente dépasse environ 10 %. Les séances faciles doivent rester vraiment faciles.
Séance prévue ce jour-là : ${pd ? pd.day.t + " (semaine " + pd.wn + ", phase " + pd.week.phase + ", " + pd.day.km + " km prévus, +" + pd.day.dp + " m)" : "hors programme"}.
Séance réalisée le ${s.date} : ${fmtKm(s.km)} km, ${s.moveSec != null ? "temps en mouvement " + fmtDur(s.moveSec) + ", allure moyenne " + fmtPace(s.paceSec) + "/km" : "pas de données de temps"}, ${s.dp != null ? "dénivelé +" + s.dp + " m / -" + s.dn + " m" : "pas d'altitude"}${s.avgHr ? ", FC moyenne " + s.avgHr + " (max " + s.maxHr + ")" : ", pas de fréquence cardiaque"}.
Détail par kilomètre :
${cutSplits(s) || "non disponible"}

Séances précédentes :
${recent}`;
}
async function analyzeSession(id, mode) {
  mode = mode || S.anMode;
  const s = await waitFor(() => S.sessions.find(x => x.id === id), 2500); if (!s || !S.sample) return;
  const fun = mode === "fun", key = id + (fun ? "|fun" : "");
  const head = fun
    ? `Tu es le commentateur d'un jeu vidéo de trail, ironique mais bienveillant. Tu rejoues la séance comme le ralenti d'une fin de partie (« kill cam »). ${addr()} Réponds en français, 150 mots au maximum, en trois courts paragraphes introduits par un mot en gras : **Le replay** (les moments clés avec les vrais chiffres : kilomètre le plus rapide, kilomètre le plus dur, dérive d'allure ou de FC), **Dégâts** (ce qui a coûté cher, avec humour), **Récompense** (une note sur 10 et une consigne concrète pour la prochaine séance). L'humour ne doit jamais déformer les chiffres. Pas de tableau.`
    : `Tu es entraîneur de trail running. ${addr()} Réponds en français, de façon directe et concrète, 230 mots au maximum, en 4 courts paragraphes introduits par un mot en gras : **Verdict**, **Allures et effort**, **À surveiller**, **Prochaine séance**. Pas d'autre titre, pas de tableau. Compare la séance réalisée à la séance prévue (régularité, dérive d'allure ou de FC, respect des zones). Ne commente pas la FC si elle manque. Ne propose pas de modifier le programme sauf si les chiffres l'imposent.`;
  ctl = new AbortController();
  S.an[key] = { busy: true, text: "", err: "" }; render();
  try {
    const r = await S.sample(head + "\n\n" + sessionFacts(s), { signal: ctl.signal, cache: false, onText: u => { S.an[key].text = u.text; const el = $("#anText"); if (el && S.sel === id && S.anMode === mode) el.innerHTML = mdLite(u.text); } });
    S.an[key] = { busy: false, text: r.text, err: r.truncated ? "Réponse coupée : relancez l'analyse pour la version complète." : "" };
    const patch = {}; patch[fun ? "analysisFun" : "analysis"] = { text: r.text, at: new Date().toISOString() };
    await save("Sauvegarde de l'analyse", () => S.base.collection("sessions").doc(id).update(patch));
  } catch (e) {
    S.an[key] = { busy: false, text: e && e.text ? e.text : "", err: e && e.code === "cancelled" ? "" : errText(e) };
  }
  ctl = null; render();
}
async function askSession(id, q) {
  q = String(q || S.inputs.ask || "").trim();
  const s = S.sessions.find(x => x.id === id); if (!s || !S.sample) return;
  if (!q) { toast("Écrivez une question sur la séance."); return; }
  S.inputs.ask = ""; S.ask[id] = { busy: true, q, text: "", err: "" }; render();
  const prompt = `Tu es entraîneur de trail running. ${addr()} Réponds en français, 130 mots au maximum, en t'appuyant sur les chiffres de la séance. Si la question dépasse ce que les données permettent de savoir, dis-le. Pas de titre.\n\nQuestion de l'athlète : « ${q} »\n\n${sessionFacts(s)}`;
  try {
    const r = await S.sample(prompt, { cache: false, modelTier: "quick", onText: u => { S.ask[id].text = u.text; const el = $("#askText"); if (el) el.innerHTML = mdLite(u.text); } });
    S.ask[id] = { busy: false, q, text: r.text, err: "" };
  } catch (e) { S.ask[id] = { busy: false, q, text: e && e.text || "", err: errText(e) }; }
  render();
}
async function trendAI() {
  if (!S.sample) return;
  const t = todayStr(), L = loadStats();
  const ss = S.sessions.filter(s => s.date >= addDays(t, -20)).sort((a, b) => a.date < b.date ? -1 : 1)
    .map(s => `${s.date} : ${s.planned || "séance"} → ${fmtKm(s.km)} km à ${fmtPace(s.paceSec)}/km, +${s.dp || 0} m${s.avgHr ? ", FC " + s.avgHr : ""}`).join("\n") || "aucune séance";
  const cw = weekOf(t);
  const prompt = `Tu es entraîneur de trail running. ${addr()} Fais un bilan des trois dernières semaines en français, 200 mots au maximum, en trois paragraphes introduits par un mot en gras : **Tendance** (volume, régularité, efficacité), **Risque** (montée en charge trop rapide, trop d'intensité, signes de fatigue), **Cap** (une ou deux actions précises pour les 7 prochains jours).
Objectif : 42 km, 1 050 m D+, 25 avril 2027 en 4 h 35. Semaine du programme : ${cw >= 1 && cw <= 25 ? cw + " (" + PLAN.weeks[cw - 1].phase + ")" : "avant le début du plan"}.
Indicateurs : ${fmtKm(L.acute)} km sur 7 jours ; moyenne hebdomadaire des 4 semaines précédentes ${fmtKm(L.chronic)} km ; rapport ${L.ratio != null ? (Math.round(L.ratio * 100) / 100) : "inconnu"} ; part d'allure facile sur 14 jours ${L.easyPct != null ? Math.round(L.easyPct) + " %" : "inconnue"} ; évolution de l'efficacité cardiaque ${L.effDelta != null ? (Math.round(L.effDelta * 10) / 10) + " %" : "inconnue"}.
Séances des 3 dernières semaines :
${ss}
S'il manque des données, dis-le simplement.`;
  S.trend = { busy: true, text: "", err: "" }; render();
  try {
    const r = await S.sample(prompt, { cache: false, onText: u => { S.trend.text = u.text; const el = $("#trendText"); if (el) el.innerHTML = mdLite(u.text); } });
    S.trend = { busy: false, text: r.text, err: "" };
  } catch (e) { S.trend = { busy: false, text: e && e.text || "", err: errText(e) }; }
  render();
}
function replayInfo(s) {
  const sp = (s.splits || []).map((x, i) => ({ i, x })).filter(o => o.x[0] > 0 && o.x[3] === 1);
  if (sp.length < 4) return null;
  let b = sp[0], w = sp[0]; sp.forEach(o => { if (o.x[0] < b.x[0]) b = o; if (o.x[0] > w.x[0]) w = o; });
  return { b, w };
}
function aiCardSession(s) {
  const mode = S.anMode, fun = mode === "fun", key = s.id + (fun ? "|fun" : "");
  const an = S.an[key] || {}, saved = fun ? s.analysisFun : s.analysis;
  const text = an.text != null && (an.text || an.busy || an.err) ? an.text : (saved ? saved.text : "");
  const ak = S.ask[s.id] || {};
  const asks = ["Pourquoi ai-je ralenti ?", "Mon allure en côte est-elle bonne ?", "Que faire demain ?"];
  return `<div class="card hl"><div class="card-h"><h3>Analyse IA</h3><div class="seg"><button class="pill" data-act="anMode" data-m="coach" aria-pressed="${!fun}">Coach</button><button class="pill" data-act="anMode" data-m="fun" aria-pressed="${fun}">Commentateur</button></div></div>
    ${S.sample ? `<div class="btns" style="margin-bottom:12px"><button class="btn primary sm" data-act="analyzeSession" data-id="${esc(s.id)}" ${an.busy ? "disabled" : ""}>${an.busy ? "Analyse en cours…" : (text ? "Refaire l'analyse" : (fun ? "Lancer le replay" : "Analyser la séance"))}</button>${an.busy ? `<button class="btn sm" data-act="stopAnalysis">Arrêter</button>` : ""}</div>` : ""}
    ${an.busy && !text ? `<p class="mute"><span class="spin"></span>${fun ? "Le commentateur rembobine…" : "Claude lit votre séance…"}</p>` : ""}
    <div class="analysis" id="anText">${text ? mdLite(text) : (an.busy ? "" : `<p class="empty">${S.sample ? (fun ? "Un ralenti façon fin de partie : meilleur kilomètre, passage à vide, note sur 10." : "Le coach compare cette séance au programme, à vos zones d'allure et à vos dernières sorties.") : "Activez les analyses en ajoutant votre clé d'API dans Carnet → Données."}</p>`)}</div>
    ${an.err ? `<p class="small" style="color:var(--bad);margin-top:8px" role="alert">${esc(an.err)}</p>` : ""}
    ${S.sample ? `<h4 style="margin:20px 0 10px">Poser une question</h4>
      <div class="seg" style="margin-bottom:10px">${asks.map(q => `<button class="pill" data-act="askQ" data-id="${esc(s.id)}" data-q="${esc(q)}" ${ak.busy ? "disabled" : ""}>${esc(q)}</button>`).join("")}</div>
      <div class="btns" style="flex-wrap:nowrap"><input type="text" id="askIn" data-bind="inputs.ask" data-enter="askSession" data-id="${esc(s.id)}" value="${esc(S.inputs.ask || "")}" placeholder="Ex. : mes 3 derniers km étaient-ils trop rapides ?" aria-label="Votre question"><button class="btn primary sm" data-act="askSession" data-id="${esc(s.id)}" ${ak.busy ? "disabled" : ""}>Demander</button></div>
      ${ak.q ? `<div class="callout" style="margin-top:12px"><div class="small mute">Vous : ${esc(ak.q)}</div><div class="analysis" id="askText" style="margin-top:6px">${ak.busy && !ak.text ? `<span class="spin"></span>Réflexion…` : mdLite(ak.text)}</div>${ak.err ? `<p class="small" style="color:var(--bad)" role="alert">${esc(ak.err)}</p>` : ""}</div>` : ""}` : ""}</div>`;
}
function viewSessionDetail(s) {
  const pd = planDay(s.date);
  const hr = s.splits && s.splits.some(x => x[2]);
  const conf = S.confirmDel === s.id;
  const sh = shoes().find(x => x.id === s.shoe);
  const vam = s.dp && s.moveSec ? Math.round(s.dp / (s.moveSec / 3600)) : null;
  const gap = gapPace(s);
  const zb = zoneBreak(s), zt = zb.reduce((a, b) => a + b, 0), rp = replayInfo(s);
  const ZN = [["Côte", "var(--z4)"], ["Récup", "var(--z1)"], ["Facile", "var(--z2)"], ["Allure course", "var(--z3)"], ["Seuil", "#FF8A3D"], ["Vite", "var(--z5)"]];
  const kmTxt = o => `km ${o.i + 1} à ${fmtPace(o.x[0])}/km${o.x[1] ? ", +" + o.x[1] + " m" : ""}${o.x[2] ? ", " + o.x[2] + " bpm" : ""}`;
  return `<div class="grid"><div class="card hl"><div class="card-h"><div><div class="label">${esc(dLong(s.date))}${pd ? " · semaine " + pd.wn : ""}${sh ? " · " + esc(sh.name) : ""}</div><h2>${esc(pd ? pd.day.t : s.name)}</h2></div><div class="btns"><span class="tag">+${sessionXp(s)} XP</span><button class="btn sm" data-act="closeSession">Retour</button></div></div>
    <div class="stats"><div class="stat"><div class="v">${fmtKm(s.km)}<small>km</small></div><div class="k">Distance</div></div><div class="stat"><div class="v">${s.moveSec != null ? fmtDur(s.moveSec) : "–"}</div><div class="k">Temps</div></div>
    <div class="stat"><div class="v">${s.paceSec ? fmtPace(s.paceSec) : "–"}<small>/km</small></div><div class="k">Allure</div></div><div class="stat"><div class="v">${s.dp != null ? "+" + s.dp : "–"}<small>m</small></div><div class="k">D+ · D- ${s.dn != null ? s.dn : "–"}</div></div>
    ${gap && s.dp ? `<div class="stat"><div class="v">${fmtPace(gap)}<small>/km</small></div><div class="k">Allure ajustée à la pente</div></div>` : ""}
    ${vam ? `<div class="stat"><div class="v">${fmtNum(vam)}<small>m/h</small></div><div class="k">Vitesse ascensionnelle</div></div>` : ""}
    ${s.avgHr ? `<div class="stat"><div class="v">${s.avgHr}<small>bpm</small></div><div class="k">FC moyenne · max ${s.maxHr}</div></div>` : ""}</div>
    ${pd ? `<p class="small mute" style="margin-top:12px">Prévu ce jour : ${esc(pd.day.t)}${pd.day.km ? " · " + pd.day.km + " km · +" + pd.day.dp + " m" : ""}.</p>` : ""}</div>
    ${s.prof && s.prof.length > 1 ? `<div class="card"><h3 style="margin-bottom:12px">Profil altimétrique</h3><div class="chart-wrap">${elevChart(s.prof)}</div></div>` : ""}
    ${s.splits && s.splits.filter(x => x[0] > 0).length > 1 ? `<div class="card"><h3 style="margin-bottom:12px">Le replay, kilomètre par kilomètre</h3><div class="chart-wrap">${splitsChart(s.splits)}</div>
      ${rp ? `<div class="replay"><div class="b"><b>Meilleur kilomètre</b>${kmTxt(rp.b)}</div><div class="w"><b>Kilomètre le plus dur</b>${kmTxt(rp.w)}</div></div>` : ""}
      ${zt > 0 ? `<h4 style="margin-top:18px;margin-bottom:10px">Répartition du terrain et des allures</h4><div class="zbar" role="img" aria-label="Répartition des kilomètres par zone">${zb.map((v, i) => v > 0 ? `<i style="width:${(v / zt * 100).toFixed(1)}%;background:${ZN[i][1]}"></i>` : "").join("")}</div><div class="zleg">${zb.map((v, i) => v > 0 ? `<span><b style="background:${ZN[i][1]}"></b>${ZN[i][0]} ${fmtKm(v)} km</span>` : "").join("")}</div>` : ""}
      <details style="margin-top:14px"><summary class="small" style="cursor:pointer">Détail kilomètre par kilomètre</summary><div class="tbl-wrap"><table class="t mono" style="margin-top:8px"><tr><th>km</th><th>allure</th><th>D+</th>${hr ? "<th>FC</th>" : ""}</tr>${s.splits.map((x, i) => `<tr><td>${x[3] < 1 ? fmtKm(i + x[3]) : i + 1}</td><td>${fmtPace(x[0])}</td><td>${x[1]} m</td>${hr ? `<td>${x[2] || "–"}</td>` : ""}</tr>`).join("")}</table></div></details></div>` : ""}
    ${aiCardSession(s)}
    <div class="card"><div class="btns">${s.rawAsset && S.downloads ? `<button class="btn" data-act="downloadRaw" data-id="${esc(s.id)}">Télécharger le fichier original</button>` : ""}
      ${conf ? `<button class="btn danger" data-act="deleteSession" data-id="${esc(s.id)}">Confirmer la suppression</button><button class="btn" data-act="cancelDel">Annuler</button>` : `<button class="btn danger" data-act="askDel" data-id="${esc(s.id)}">Supprimer cette séance</button>`}</div></div></div>`;
}
function viewSessions() {
  if (S.sel) { const s = S.sessions.find(x => x.id === S.sel); if (s) return viewSessionDetail(s); S.sel = null; }
  const q = S.queue[0];
  let queue = "";
  if (q) {
    const pd = planDay(S.inputs.impDate || q.dateGuess || todayStr());
    queue = `<div class="card hl"><div class="card-h"><h3>Séance à enregistrer</h3><span class="tag">${esc(q.name)}${S.queue.length > 1 ? " · " + (S.queue.length - 1) + " autre(s) en attente" : ""}</span></div>
      <div class="stats"><div class="stat"><div class="v">${fmtKm(q.km)}<small>km</small></div><div class="k">Distance</div></div><div class="stat"><div class="v">${q.moveSec != null ? fmtDur(q.moveSec) : "–"}</div><div class="k">Temps en mouvement</div></div>
      <div class="stat"><div class="v">${q.paceSec ? fmtPace(q.paceSec) : "–"}<small>/km</small></div><div class="k">Allure moyenne</div></div><div class="stat"><div class="v">${q.dp != null ? "+" + q.dp : "–"}<small>m</small></div><div class="k">Dénivelé positif</div></div>
      <div class="stat"><div class="v">${q.avgHr || "–"}<small>bpm</small></div><div class="k">FC moyenne</div></div></div>
      <div class="form-grid" style="margin-top:14px"><div class="field"><label for="impDate">Date de la séance</label><input type="date" id="impDate" data-bind="inputs.impDate" value="${esc(S.inputs.impDate || q.dateGuess || todayStr())}"></div>
      <div class="field"><label>Séance prévue ce jour-là</label><div class="mute" style="padding:8px 0">${pd ? esc(pd.day.t) + (pd.day.km ? " · " + pd.day.km + " km" : "") : "Hors programme"}</div></div>${shoeField()}</div>
      <div class="btns" style="margin-top:14px"><button class="btn primary" data-act="saveImport" ${S.importBusy || !hasStore() ? "disabled" : ""}>${S.importBusy ? "Enregistrement…" : "Enregistrer la séance"}</button><button class="btn" data-act="skipImport">Ignorer ce fichier</button></div>
      ${hasStore() ? (autoAI() && S.sample ? `<p class="small mute" style="margin-top:8px">Claude analysera la séance dès qu'elle est enregistrée.</p>` : "") : `<p class="small mute" style="margin-top:8px">L'enregistrement est indisponible sur cet appareil.</p>`}</div>`;
  }
  const list = S.sessions.slice().sort((a, b) => a.date < b.date ? 1 : a.date > b.date ? -1 : 0);
  const tr = S.trend;
  const trendCard = S.sample && list.length ? `<div class="card"><div class="card-h"><h3>Bilan IA des 3 dernières semaines</h3><button class="btn primary sm" data-act="trend" ${tr.busy ? "disabled" : ""}>${tr.busy ? "Analyse…" : (tr.text ? "Refaire" : "Lancer le bilan")}</button></div>
      <div class="analysis" id="trendText">${tr.busy && !tr.text ? `<span class="spin"></span>Claude relit vos trois dernières semaines…` : (tr.text ? mdLite(tr.text) : `<p class="empty">Tendance, risque de blessure et cap pour les 7 prochains jours, à partir des indicateurs ci-dessus.</p>`)}</div>
      ${tr.err ? `<p class="small" style="color:var(--bad);margin-top:8px" role="alert">${esc(tr.err)}</p>` : ""}</div>` : "";
  return `<div class="grid">
    <div class="card"><div class="card-h"><h2>Séances</h2><span class="small mute">GPX ou TCX exportés de votre montre ou de Strava</span></div>
      <div class="drop" id="drop"><p>Déposez un ou plusieurs fichiers ici, ou choisissez-les dans votre téléphone ou ordinateur.</p>
      <label class="btn primary" for="fileIn" style="cursor:pointer">Choisir des fichiers</label><input class="sr" type="file" id="fileIn" multiple accept=".gpx,.tcx,.xml,application/gpx+xml,application/xml,text/xml" data-change="import">
      ${S.importMsg ? `<p class="small" style="color:var(--bad)" role="alert">${esc(S.importMsg)}</p>` : ""}</div></div>
    ${queue}${indicatorsCard()}${trendCard}
    <div class="card"><div class="card-h"><h3>Historique</h3><span class="mute small">${list.length} séance${list.length > 1 ? "s" : ""}</span></div>
      ${list.length ? `<div class="rows">${list.map(s => { const pd = planDay(s.date); return `<div class="row" style="grid-template-columns:62px minmax(0,1fr) auto"><div class="d">${DAYS3[dow(s.date)]}<span>${dShort(s.date)}</span></div><div><div>${esc(pd ? pd.day.t : s.name)}</div><div class="small">${sessionStatLine(s)}</div></div><div><button class="btn sm" data-act="openSession" data-id="${esc(s.id)}">Ouvrir</button></div></div>`; }).join("")}</div>`
      : `<p class="empty">Aucune séance enregistrée. Les kilomètres ne se courent pas tout seuls : importez un premier fichier pour voir le profil altimétrique, les allures kilomètre par kilomètre et l'analyse de Claude.</p>`}</div></div>`;
}

/* ------------------------------------------------------------------ IA : repas */
async function analyzeMeal() {
  const d = S.draft; if (!S.sample || d.busy) return;
  const text = (d.note || d.desc || "").trim();
  if (!(d.blob && S.canImages) && !text) { d.err = "Ajoutez une photo ou décrivez le repas."; render(); return; }
  const date = S.date, pd = planDay(date), W = weightOn(date), tg = targets(pd ? pd.day : null, W), tot = totalsOn(date);
  const prompt = `Tu es diététicien du sport. ${d.blob && S.canImages ? "Analyse la photo de ce repas" : "Estime ce repas d'après sa description"} (${d.kind}, ${d.time}) pour un coureur de trail de ${W} kg en préparation d'un 42 km.
${text ? (d.blob && S.canImages ? "Précision de l'athlète : " : "Description : ") + text + "\n" : ""}Séance du jour : ${pd ? pd.day.t + ", " + pd.day.km + " km" : "repos"}. Cibles du jour : ${tg.kcal} kcal, ${tg.p} g de protéines, ${tg.c} g de glucides, ${tg.f} g de lipides. Déjà mangé aujourd'hui : ${tot.kcal} kcal, ${tot.p} g de protéines, ${tot.c} g de glucides, ${tot.f} g de lipides.
Estime avec des portions réalistes. Réponds uniquement par un objet JSON de cette forme : {"description": "plats et portions estimées, en une phrase", "kcal": 650, "proteines_g": 35, "glucides_g": 80, "lipides_g": 20, "fiabilite": "faible|moyenne|haute", "avis": "deux phrases au plus : ce que ce repas apporte par rapport aux cibles restantes et un ajustement concret"}. Les valeurs numériques sont des nombres entiers. Si ce n'est pas un repas, mets kcal à 0 et explique-le dans avis.`;
  d.busy = true; d.err = ""; render();
  try {
    const opts = { cache: false }; if (d.blob && S.canImages) opts.images = d.blob;
    const r = await S.sample.json(prompt, opts);
    d.desc = String(r.description || ""); d.kcal = Math.round(+r.kcal || 0); d.p = Math.round(+r.proteines_g || 0); d.c = Math.round(+r.glucides_g || 0); d.f = Math.round(+r.lipides_g || 0);
    d.conf = String(r.fiabilite || ""); d.comment = String(r.avis || "");
  } catch (e) { d.err = errText(e); }
  d.busy = false; render();
}
async function mealTip(id) {
  const m = S.meals.find(x => x.id === id); if (!m || !S.sample) return;
  const date = m.date, pd = planDay(date), W = weightOn(date), tg = targets(pd ? pd.day : null, W), tot = totalsOn(date);
  S.mealTip[id] = { busy: true, text: "", err: "" }; render();
  const prompt = `Tu es diététicien du sport. ${addr()} Français, 90 mots au maximum, sans titre : propose en 2 ou 3 puces une version améliorée de ce repas (quantités précises) pour mieux coller aux cibles, sans changer l'esprit du plat.
Repas (${m.kind}, ${m.time}) : ${m.desc} — ${m.kcal} kcal, P ${m.p} g, G ${m.c} g, L ${m.f} g.
Séance du jour : ${pd ? pd.day.t + ", " + pd.day.km + " km" : "repos"}. Cibles du jour : ${tg.kcal} kcal, P ${tg.p} g, G ${tg.c} g, L ${tg.f} g. Total mangé ce jour-là : ${tot.kcal} kcal, P ${tot.p} g, G ${tot.c} g, L ${tot.f} g. Poids ${W} kg, objectif : masse maigre, sans gras en excès.`;
  try {
    const r = await S.sample(prompt, { cache: false, modelTier: "quick", onText: u => { S.mealTip[id].text = u.text; const el = document.getElementById("tip-" + id); if (el) el.innerHTML = mdLite(u.text); } });
    S.mealTip[id] = { busy: false, text: r.text, err: "" };
  } catch (e) { S.mealTip[id] = { busy: false, text: e && e.text || "", err: errText(e) }; }
  render();
}
async function dayReview() {
  if (!S.sample) return;
  const date = S.date, pd = planDay(date), W = weightOn(date), tg = targets(pd ? pd.day : null, W), tot = totalsOn(date), water = (dayOf(date).water || 0) / 1000;
  const list = mealsOn(date).map(m => `${m.time} ${m.kind} : ${m.desc} (${m.kcal} kcal, P ${m.p}, G ${m.c}, L ${m.f})`).join("\n");
  if (!list) { toast("Enregistrez au moins un repas pour ce jour."); return; }
  const prompt = `Tu es diététicien du sport. ${addr()} Fais le bilan nutritionnel de la journée du ${date} d'un coureur de trail de ${W} kg (objectif : masse maigre, 42 km le 25 avril).
Séance du jour : ${pd ? pd.day.t + " (" + pd.day.km + " km, +" + pd.day.dp + " m)" : "repos"}. Cibles : ${tg.kcal} kcal, P ${tg.p} g, G ${tg.c} g, L ${tg.f} g${tg.intra ? ", dont " + tg.intra + " g de glucides pendant l'effort" : ""}, eau ${tg.water} L.
Mangé (${tot.kcal} kcal, P ${tot.p} g, G ${tot.c} g, L ${tot.f} g) et bu ${String(Math.round(water * 10) / 10)} L d'eau :
${list}
Évalue : couverture énergétique, répartition des protéines dans la journée, glucides autour de l'effort, hydratation, qualité des aliments. Réponds uniquement par un objet JSON : {"note": 7, "resume": "deux phrases", "points_forts": ["..."], "a_ameliorer": ["..."], "conseil_demain": "une phrase"}. "note" est un entier de 0 à 10 ; chaque liste contient 3 éléments au maximum, courts. Ne juge pas une journée incomplète comme mauvaise si l'heure actuelle l'explique : il est ${nowHM()} et la date du bilan est ${date}.`;
  S.dayRev[date] = { busy: true, data: null, err: "" }; render();
  try {
    const r = await S.sample.json(prompt, { cache: false });
    S.dayRev[date] = { busy: false, data: { note: clamp(Math.round(+r.note || 0), 0, 10), resume: String(r.resume || ""), forts: (r.points_forts || []).map(String).slice(0, 3), ameliorer: (r.a_ameliorer || []).map(String).slice(0, 3), conseil: String(r.conseil_demain || "") }, err: "" };
  } catch (e) { S.dayRev[date] = { busy: false, data: null, err: errText(e) }; }
  render();
}
async function tomorrowMenu() {
  if (!S.sample) return;
  const tm = addDays(S.date, 1), pd = planDay(tm), W = weightOn(tm), tg = targets(pd ? pd.day : null, W);
  S.menu = { date: tm, busy: true, text: "", err: "" }; render();
  const prompt = `Tu es diététicien du sport. ${addr()} Compose le menu du ${dLong(tm)} en français, 200 mots au maximum, en puces courtes avec quantités précises, classées par moment : **Petit-déjeuner**, **Déjeuner**, **Collation**, **Dîner**${tg.intra ? ", **Pendant l'effort**" : ""}. Termine par une ligne « Total estimé » avec kcal, protéines, glucides, lipides.
Athlète : ${W} kg, objectif masse maigre, trail de 42 km le 25 avril. Séance de ce jour-là : ${pd ? pd.day.t + " (" + pd.day.km + " km, +" + pd.day.dp + " m)" : "repos ou hors programme"}. Cibles : ${tg.kcal} kcal, P ${tg.p} g, G ${tg.c} g, L ${tg.f} g${tg.intra ? ", dont " + tg.intra + " g de glucides pendant l'effort" : ""}, eau ${tg.water} L. Aliments simples, faciles à trouver en France, sans complément spécial.`;
  try {
    const r = await S.sample(prompt, { cache: false, onText: u => { S.menu.text = u.text; const el = $("#menuText"); if (el) el.innerHTML = mdLite(u.text); } });
    S.menu = { date: tm, busy: false, text: r.text, err: "" };
  } catch (e) { S.menu = { date: tm, busy: false, text: e && e.text || "", err: errText(e) }; }
  render();
}
function weekStats() {
  const rows = [];
  for (let i = 6; i >= 0; i--) {
    const d = addDays(S.date, -i), tot = totalsOn(d), pd = planDay(d), W = weightOn(d), tg = targets(pd ? pd.day : null, W);
    rows.push({ d, tot, tg, W, logged: mealsOn(d).length > 0 });
  }
  return rows;
}
async function weekNutri() {
  if (!S.sample) return;
  const rows = weekStats().filter(r => r.logged);
  if (rows.length < 2) { toast("Enregistrez les repas d'au moins deux jours."); return; }
  const ms = S.measures.slice().sort((a, b) => a.date < b.date ? -1 : 1).slice(-4).filter(m => m.weight != null).map(m => `${m.date} : ${m.weight} kg`).join(", ") || "aucune";
  const prompt = `Tu es diététicien du sport. ${addr()} Analyse sa semaine alimentaire en français, 190 mots au maximum, en trois paragraphes introduits par un mot en gras : **Constat** (écarts moyens avec les cibles, en chiffres), **Composition** (protéines par kg, glucides selon les séances, effet probable sur le poids et la masse maigre), **Ajustements** (deux actions précises).
Objectif : masse maigre, pas de gras, 42 km le 25 avril. Pesées récentes : ${ms}.
Jours renseignés (réel/cible) :
${rows.map(r => `${r.d} (${(planDay(r.d) || { day: { t: "hors programme" } }).day.t}) : ${r.tot.kcal}/${r.tg.kcal} kcal, P ${r.tot.p}/${r.tg.p} g (${(r.tot.p / r.W).toFixed(1)} g/kg), G ${r.tot.c}/${r.tg.c} g, L ${r.tot.f}/${r.tg.f} g`).join("\n")}`;
  S.wk = { date: S.date, busy: true, text: "", err: "" }; render();
  try {
    const r = await S.sample(prompt, { cache: false, onText: u => { S.wk.text = u.text; const el = $("#wkText"); if (el) el.innerHTML = mdLite(u.text); } });
    S.wk = { date: S.date, busy: false, text: r.text, err: "" };
  } catch (e) { S.wk = { date: S.date, busy: false, text: e && e.text || "", err: errText(e) }; }
  render();
}
function viewMeals() {
  const date = S.date, pd = planDay(date), d = S.draft;
  const meals = mealsOn(date);
  const kinds = ["Petit-déjeuner", "Déjeuner", "Collation", "Dîner", "Pendant l'effort"];
  const photoBlock = d.previewUrl ? `<div><img class="preview-img" src="${esc(d.previewUrl)}" alt="Photo du repas"></div>` : "";
  const rv = S.dayRev[date] || {}, rd = rv.data;
  const wkRows = weekStats(), wk = S.wk.date === date ? S.wk : { busy: false, text: "", err: "" };
  const mn = S.menu.date === addDays(date, 1) ? S.menu : { busy: false, text: "", err: "" };
  return `<div class="grid">
    <div class="card"><div class="card-h"><h2>Repas</h2><div class="btns"><button class="btn sm" data-act="dateShift" data-n="-1" aria-label="Jour précédent">←</button><input type="date" id="mealDate" data-bind="date" value="${esc(date)}" style="width:auto"><button class="btn sm" data-act="dateShift" data-n="1" aria-label="Jour suivant">→</button><button class="btn sm" data-act="dateToday">Aujourd'hui</button></div></div>
      <p class="small mute" style="margin-bottom:12px">${esc(dLong(date))}${pd ? " · " + esc(pd.day.t) : " · hors programme"}</p>${targetBars(date)}${waterButtons(date)}</div>
    <div class="card hl"><div class="card-h"><h3>Ajouter un repas</h3>${S.sample && autoAI() ? `<span class="small mute">analyse automatique de la photo</span>` : (!S.sample ? `<span class="small mute">IA : ajoutez une clé dans Carnet → Données</span>` : "")}</div>
      <div class="form-grid"><div class="field"><label for="mKind">Moment</label><select id="mKind" data-bind="draft.kind">${kinds.map(k => `<option${k === d.kind ? " selected" : ""}>${esc(k)}</option>`).join("")}</select></div>
      <div class="field"><label for="mTime">Heure</label><input type="time" id="mTime" data-bind="draft.time" value="${esc(d.time)}"></div></div>
      <div class="drop" style="margin-top:12px"><label class="btn${d.previewUrl ? "" : " primary"}" for="photoIn" style="cursor:pointer">${d.previewUrl ? "Changer la photo" : "Photographier mon assiette"}</label><input class="sr" type="file" id="photoIn" accept="image/*" data-change="photo">${photoBlock}
      ${S.canImages ? "" : `<p class="small mute">L'analyse automatique des photos n'est pas disponible dans cette vue : décrivez le repas ou saisissez les valeurs à la main.</p>`}</div>
      <div class="field" style="margin-top:12px"><label for="mNote">Précision (facultatif)</label><textarea id="mNote" data-bind="draft.note" placeholder="Ex. : 150 g de riz cuit, sauce tomate maison, 1 yaourt nature">${esc(d.note)}</textarea></div>
      <div class="btns" style="margin-top:12px">${S.sample ? `<button class="btn primary sm" data-act="analyzeMeal" ${d.busy ? "disabled" : ""}>${d.busy ? "Analyse en cours…" : (d.blob && S.canImages ? "Analyser la photo" : "Estimer d'après le texte")}</button>` : ""}</div>
      ${d.err ? `<p class="small" style="color:var(--bad);margin-top:8px" role="alert">${esc(d.err)}</p>` : ""}
      ${d.busy ? `<p class="mute" style="margin-top:8px"><span class="spin"></span>Claude regarde l'assiette…</p>` : ""}
      <div style="margin-top:14px"><div class="field"><label for="mDesc">Description</label><input type="text" id="mDesc" data-bind="draft.desc" value="${esc(d.desc)}" placeholder="Ce que contient le repas"></div>
      <div class="form-grid" style="margin-top:12px"><div class="field"><label for="mK">Énergie (kcal)</label><input type="number" inputmode="numeric" id="mK" data-bind="draft.kcal" value="${esc(d.kcal)}"></div><div class="field"><label for="mP">Protéines (g)</label><input type="number" inputmode="numeric" id="mP" data-bind="draft.p" value="${esc(d.p)}"></div>
      <div class="field"><label for="mC">Glucides (g)</label><input type="number" inputmode="numeric" id="mC" data-bind="draft.c" value="${esc(d.c)}"></div><div class="field"><label for="mF">Lipides (g)</label><input type="number" inputmode="numeric" id="mF" data-bind="draft.f" value="${esc(d.f)}"></div></div></div>
      ${d.comment ? `<div class="callout" style="margin-top:12px"><strong>Avis de Claude${d.conf ? " · fiabilité " + esc(d.conf) : ""}</strong><div style="margin-top:4px">${esc(d.comment)}</div></div>` : ""}
      <div class="btns" style="margin-top:14px"><button class="btn primary" data-act="saveMeal" ${!hasStore() ? "disabled" : ""}>Enregistrer le repas</button><button class="btn" data-act="resetDraft">Vider le formulaire</button></div>
      ${hasStore() ? "" : `<p class="small mute" style="margin-top:8px">L'enregistrement est indisponible sur cet appareil.</p>`}</div>
    <div class="card"><div class="card-h"><h3>Repas du jour</h3><span class="small mute">${meals.length} repas</span></div>
      ${meals.length ? meals.map(m => { const tp = S.mealTip[m.id] || {}; return `<div class="meal">${m.photo ? `<img class="photo" loading="lazy" src="${esc(blobUrl(m.photo))}" alt="Photo : ${esc(m.kind)}">` : `<div class="photo"></div>`}
        <div style="min-width:0"><div class="card-h" style="margin:0"><strong>${esc(m.kind || "Repas")}</strong><span class="mono small mute">${esc(m.time || "")}</span></div>
        <div>${esc(m.desc || m.note || "")}</div>
        <div class="nums"><span>${fmtNum(m.kcal || 0)} kcal</span><span>P ${fmtNum(m.p || 0)} g</span><span>G ${fmtNum(m.c || 0)} g</span><span>L ${fmtNum(m.f || 0)} g</span></div>
        ${m.comment ? `<p class="small" style="margin-top:6px">${esc(m.comment)}</p>` : ""}
        ${tp.busy || tp.text || tp.err ? `<div class="callout" style="margin-top:8px"><div class="analysis small" id="tip-${esc(m.id)}">${tp.busy && !tp.text ? `<span class="spin"></span>Claude réfléchit…` : mdLite(tp.text)}</div>${tp.err ? `<p class="small" style="color:var(--bad)" role="alert">${esc(tp.err)}</p>` : ""}</div>` : ""}
        <div class="btns" style="margin-top:8px">${S.sample ? `<button class="btn sm" data-act="mealTip" data-id="${esc(m.id)}" ${tp.busy ? "disabled" : ""}>Comment l'améliorer ?</button>` : ""}${S.confirmDel === m.id ? `<button class="btn sm danger" data-act="deleteMeal" data-id="${esc(m.id)}">Confirmer</button><button class="btn sm" data-act="cancelDel">Annuler</button>` : `<button class="btn sm" data-act="askDel" data-id="${esc(m.id)}">Supprimer</button>`}</div></div></div>`; }).join("")
      : `<p class="empty">Aucun repas enregistré ce jour-là. Photographiez votre assiette : Claude estime les calories et les macros, puis vous comparez avec vos cibles.</p>`}</div>
    ${S.sample ? `<div class="card"><div class="card-h"><h3>Bilan de la journée</h3><button class="btn primary sm" data-act="dayReview" ${rv.busy ? "disabled" : ""}>${rv.busy ? "Analyse…" : (rd ? "Refaire" : "Noter ma journée")}</button></div>
      ${rv.busy ? `<p class="mute"><span class="spin"></span>Claude fait les comptes…</p>` : ""}
      ${rd ? `<div class="two"><div class="ring" style="--p:${rd.note * 10}"><div><span>${rd.note}<small>sur 10</small></span></div></div><div style="flex:1 1 220px;min-width:0"><p>${esc(rd.resume)}</p>
        ${rd.forts.length ? `<h4 style="margin-top:12px">Bien joué</h4><ul class="lst">${rd.forts.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
        ${rd.ameliorer.length ? `<h4 style="margin-top:12px">À corriger</h4><ul class="lst">${rd.ameliorer.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
        ${rd.conseil ? `<div class="callout" style="margin-top:12px">${esc(rd.conseil)}</div>` : ""}</div></div>` : (rv.busy ? "" : `<p class="empty">Une note sur 10 avec les points forts et les corrections : énergie, protéines, glucides autour de l'effort, hydratation.</p>`)}
      ${rv.err ? `<p class="small" style="color:var(--bad);margin-top:8px" role="alert">${esc(rv.err)}</p>` : ""}
      <div class="btns" style="margin-top:14px"><button class="btn sm" data-act="advice" ${S.advice.busy ? "disabled" : ""}>${S.advice.busy ? "Réflexion…" : "Que manger ensuite ?"}</button></div>
      ${S.advice.text || S.advice.busy || S.advice.err ? `<div class="analysis" id="advText" style="margin-top:12px">${S.advice.busy && !S.advice.text ? `<span class="spin"></span>Claude regarde votre journée…` : mdLite(S.advice.text)}</div>${S.advice.err ? `<p class="small" style="color:var(--bad)" role="alert">${esc(S.advice.err)}</p>` : ""}` : ""}</div>
    <div class="card"><div class="card-h"><h3>Menu de demain</h3><button class="btn primary sm" data-act="menu" ${mn.busy ? "disabled" : ""}>${mn.busy ? "Rédaction…" : (mn.text ? "Refaire" : "Composer le menu")}</button></div>
      <div class="analysis" id="menuText">${mn.busy && !mn.text ? `<span class="spin"></span>Claude compose votre journée…` : (mn.text ? mdLite(mn.text) : `<p class="empty">Un menu complet avec quantités, calé sur la séance de ${esc(dLong(addDays(date, 1)).toLowerCase())} et vos cibles.</p>`)}</div>
      ${mn.err ? `<p class="small" style="color:var(--bad);margin-top:8px" role="alert">${esc(mn.err)}</p>` : ""}</div>` : ""}
    <div class="card"><div class="card-h"><h3>Semaine alimentaire</h3>${S.sample ? `<button class="btn primary sm" data-act="weekNutri" ${wk.busy ? "disabled" : ""}>${wk.busy ? "Analyse…" : (wk.text ? "Refaire" : "Analyser la semaine")}</button>` : ""}</div>
      <div class="tbl-wrap"><table class="t"><tr><th>Jour</th><th>kcal</th><th>% cible</th><th>Prot. g/kg</th></tr>${wkRows.map(r => `<tr><td>${DAYS3[dow(r.d)]} ${dShort(r.d)}</td><td class="mono">${r.logged ? fmtNum(r.tot.kcal) : "–"}</td><td class="mono">${r.logged ? Math.round(r.tot.kcal / r.tg.kcal * 100) + " %" : "–"}</td><td class="mono">${r.logged ? (r.tot.p / r.W).toFixed(1).replace(".", ",") : "–"}</td></tr>`).join("")}</table></div>
      <div class="analysis" id="wkText" style="margin-top:12px">${wk.busy && !wk.text ? `<span class="spin"></span>Claude relit votre semaine…` : (wk.text ? mdLite(wk.text) : "")}</div>
      ${wk.err ? `<p class="small" style="color:var(--bad);margin-top:8px" role="alert">${esc(wk.err)}</p>` : ""}</div></div>`;
}
function autoCard() {
  const on = autoAI();
  return `<div class="card"><div class="card-h"><h3>Analyses automatiques</h3><button class="pill" data-act="autoAI" aria-pressed="${on}">${on ? "Activées" : "Désactivées"}</button></div>
    <p class="mute small">Quand c'est activé, Claude analyse chaque séance dès son enregistrement et chaque photo de repas dès qu'elle est choisie. Elles utilisent votre clé d'API (quelques centimes par analyse). Désactivez pour ne lancer les analyses qu'à la demande.</p></div>`;
}
