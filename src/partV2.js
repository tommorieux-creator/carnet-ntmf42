
/* ------------------------------------------------------------------ nouveautés : calculs */
const SUMMITS = [["Puy de Dôme", 1465], ["Mont Ventoux", 1910], ["Mont Blanc", 4806], ["Kilimandjaro", 5895], ["Everest", 8849]];
const PRE = [
  ["pre1", "Me peser à jeun et noter la VO2max de ma montre (Carnet › Progrès)"],
  ["pre2", "Faire un bilan médical avec test d'effort avant de monter en charge"],
  ["pre3", "Renseigner mes chaussures actuelles (Carnet › Matos)"],
  ["pre4", "Acheter des chaussures de trail et les roder sur 50 km au moins"],
  ["pre5", "Importer une sortie récente pour avoir un point de départ"],
  ["pre6", "Bloquer les dimanches matin pour les sorties longues"]
];
const GEAR = [
  ["g1", "Dossard, puce et pièce d'identité"],
  ["g2", "Sac de trail de 5 à 10 L, déjà utilisé en sortie longue"],
  ["g3", "Deux flasques souples de 500 ml"],
  ["g4", "Gels, barres et aliments salés testés à l'entraînement"],
  ["g5", "Coupe-vent léger et couverture de survie"],
  ["g6", "Téléphone chargé et sifflet"],
  ["g7", "Montre chargée, trace GPX de la course chargée"],
  ["g8", "Chaussures de trail rodées sur plus de 50 km"],
  ["g9", "Chaussettes sèches pour l'arrivée"],
  ["g10", "Crème anti-frottements, casquette ou buff"],
  ["g11", "Gobelet personnel si l'organisation l'exige"],
  ["g12", "Règlement relu : matériel obligatoire et barrières horaires"]
];
const SEG = [[0, 14, 0.3436], [14, 28, 0.3345], [28, 42, 0.3236]];
const ZONES = [
  ["Facile / récupération", "6'30 à 7'10", "Vous pouvez parler en phrases entières. La base de 80 % du volume.", "z1"],
  ["Allure course sur le plat", "5'50 à 6'10", "Allure du NTMF hors montées. Doit paraître presque facile.", "z2"],
  ["Seuil", "5'10 à 5'25", "Difficile mais tenable 20 à 30 minutes. Phrases courtes.", "z3"],
  ["Allure 10 km", "4'50 à 5'00", "Allure de votre record visé. Environ 40 minutes maximum.", "z4"],
  ["VO2max", "4'30 à 4'45", "Répétitions de 2 à 5 minutes, respiration très haute.", "z5"]
];
const dayOf = date => S.days.find(d => d.id === date) || {};
const planTotal = key => PLAN.weeks.reduce((a, w) => a + w.days.reduce((b, d) => b + d[key], 0), 0);
const totalKm = () => S.sessions.reduce((a, s) => a + (s.km || 0), 0);
const totalDp = () => S.sessions.reduce((a, s) => a + (s.dp || 0), 0);
const parseHM = v => {
  const s = String(v || "").trim().toLowerCase().replace(/h/, ":").replace(/(min|')/g, "").replace(/\s+/g, "");
  const a = s.split(":").filter(x => x !== "").map(Number);
  if (!a.length || a.some(x => !isFinite(x))) return null;
  if (a.length === 1) return a[0] < 24 ? Math.round(a[0] * 3600) : null;
  if (a.length === 2) return Math.round(a[0] * 3600 + a[1] * 60);
  return Math.round(a[0] * 3600 + a[1] * 60 + a[2]);
};
const toHM = s => Math.floor(s / 3600) + ":" + pad(Math.round(s % 3600 / 60));
function slopeFactor(g) {
  const x = clamp(g, -0.45, 0.45);
  const C = 155.4 * x ** 5 - 30.4 * x ** 4 - 43.3 * x ** 3 + 46.3 * x ** 2 + 19.5 * x + 3.6;
  let f = C / 3.6; if (x < 0) f = Math.max(f, 0.85);
  return f;
}
function readiness(d) {
  if (d.legs == null && d.sleep == null && d.mood == null && d.pain == null) return null;
  const legs = d.legs == null ? 3 : d.legs, sleep = d.sleep == null ? 7 : d.sleep, mood = d.mood == null ? 3 : d.mood, pain = d.pain == null ? 0 : d.pain;
  const score = Math.round((legs - 1) / 4 * 40 + clamp((sleep - 4) / 4, 0, 1) * 35 + (mood - 1) / 4 * 15 + (pain === 0 ? 10 : pain === 1 ? 5 : 0));
  if (pain === 2) return { score, level: "bad", msg: "Douleur gênante : ne courez pas aujourd'hui. Marche, vélo ou repos, et consultez un professionnel si cela dure plus de trois jours." };
  if (score >= 75) return { score, level: "ok", msg: "Feu vert : faites la séance comme prévue." };
  if (score >= 50) return { score, level: "warn", msg: "Prudence : gardez les allures faciles vraiment faciles, et coupez une répétition si les sensations sont mauvaises." };
  return { score, level: "bad", msg: "Journée à alléger : réduisez le volume d'un tiers, tout en facile, et couchez-vous tôt." };
}
function bestEffort(k) {
  let best = null;
  S.sessions.forEach(s => {
    const sp = (s.splits || []).filter(x => x[3] === 1 && x[0] > 0);
    for (let i = 0; i + k <= sp.length; i++) {
      let t = 0; for (let j = 0; j < k; j++) t += sp[i + j][0];
      if (!best || t < best.t) best = { t, s, from: i + 1 };
    }
  });
  return best;
}
function shoeKm(sh) { return (sh.start || 0) + S.sessions.filter(s => s.shoe === sh.id).reduce((a, s) => a + (s.km || 0), 0); }
const shoes = () => (S.profile && S.profile.shoes) || [];
function zoneBreak(s) {
  const out = [0, 0, 0, 0, 0, 0];
  (s.splits || []).forEach(x => {
    if (!(x[0] > 0)) return;
    const d = x[3] || 1; let z;
    if (x[1] >= 25) z = 0; else if (x[0] > 430) z = 1; else if (x[0] > 390) z = 2; else if (x[0] > 335) z = 3; else if (x[0] > 305) z = 4; else z = 5;
    out[z] += d;
  });
  return out;
}
function gapPace(s) {
  const sp = (s.splits || []).filter(x => x[0] > 0); if (!sp.length) return null;
  let t = 0, d = 0;
  sp.forEach(x => { const dist = x[3] || 1; t += x[0] * dist / slopeFactor(Math.max(0, x[1]) / (dist * 1000)); d += dist; });
  return t / d;
}

/* ------------------------------------------------------------------ nouveautés : visuels */
function contourSvg() {
  const peaks = [{ x: 640, y: 60, ax: 1.5, step: 16, n: 14, ph: 0.7 }, { x: 60, y: 290, ax: 1.4, step: 12, n: 9, ph: 2.2 }];
  let out = "";
  peaks.forEach(p => {
    for (let k = 1; k <= p.n; k++) {
      const R = k * p.step; let d = ""; const N = 64;
      for (let i = 0; i <= N; i++) {
        const th = i / N * 2 * Math.PI;
        const wob = 1 + 0.16 * Math.sin(2 * th + p.ph) + 0.09 * Math.sin(3 * th + p.ph * 2.3) + 0.05 * Math.sin(5 * th + p.ph * 0.7) + 0.012 * k * Math.sin(4 * th + p.ph);
        const r = R * wob;
        d += (i ? "L" : "M") + (p.x + Math.cos(th) * r * p.ax).toFixed(1) + " " + (p.y + Math.sin(th) * r).toFixed(1);
      }
      out += `<path d="${d}Z"${k % 4 === 0 ? ' class="ix"' : ""}/>`;
    }
  });
  return `<svg class="contours" viewBox="0 0 800 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${out}</svg>`;
}
function ridgeHtml() {
  const mw = (document.getElementById("main") || {}).clientWidth || 480, W = Math.max(320, Math.min(1000, mw)), H = Math.max(115, Math.min(190, Math.round(W * 0.3))), pl = 10, pr = 38, pt = 34, pb = 0, n = PLAN.weeks.length;
  const km = PLAN.weeks.map(w => weekPlanKm(w.n)), ymax = 90;
  const X = i => pl + i * (W - pl - pr) / (n - 1), Y = v => pt + (1 - v / ymax) * (H - pt - pb);
  const line = km.map((v, i) => (i ? "L" : "M") + X(i).toFixed(1) + " " + Y(v).toFixed(1)).join(" ");
  const area = line + ` L${X(n - 1).toFixed(1)} ${H} L${X(0).toFixed(1)} ${H} Z`;
  const t = todayStr(), cw = weekOf(t);
  const prog = cw < 1 ? 0 : cw > 25 ? n - 1 : Math.min(n - 1, (cw - 1) + ((dayDiff(t, PLAN.start) % 7) / 7));
  const px = X(prog), i0 = Math.min(n - 2, Math.floor(prog)), fr = prog - i0;
  const py = Y(km[i0] + (km[i0 + 1] - km[i0]) * fr);
  const seps = [7.5, 15.5, 21.5].map(i => `<line class="r-sep" x1="${X(i).toFixed(1)}" x2="${X(i).toFixed(1)}" y1="${pt - 12}" y2="${H}"/>`).join("");
  const fx = X(n - 1), fy = Y(km[n - 1]);
  return `<div class="ridge-wrap"><svg class="ridge" viewBox="0 0 ${W} ${H}" role="img" aria-label="Volume hebdomadaire du plan : de ${Math.min.apply(null, km)} à ${Math.max.apply(null, km)} km par semaine, ligne d'arrivée le 25 avril">
    <defs><clipPath id="rc"><rect x="0" y="0" width="${px.toFixed(1)}" height="${H}"/></clipPath></defs>
    <path class="r-base" d="${area}"/>${seps}<path class="r-done" d="${area}" clip-path="url(#rc)"/>
    <line class="r-flag" x1="${fx.toFixed(1)}" x2="${fx.toFixed(1)}" y1="${(fy - 28).toFixed(1)}" y2="${fy.toFixed(1)}"/><path class="r-flag-f" d="M${fx.toFixed(1)} ${(fy - 28).toFixed(1)} l15 6 -15 6z"/><g class="r-xh-g"><circle class="r-xh" cx="${(fx + 4).toFixed(1)}" cy="${(fy - 22).toFixed(1)}" r="14"/><path class="r-xh" d="M${(fx - 22).toFixed(1)} ${(fy - 22).toFixed(1)}h14M${(fx + 16).toFixed(1)} ${(fy - 22).toFixed(1)}h14M${(fx + 4).toFixed(1)} ${(fy - 44).toFixed(1)}v14M${(fx + 4).toFixed(1)} ${(fy - 14).toFixed(1)}v10"/></g>
    <circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="6" fill="#FF2E93" class="pulse"/><circle class="r-dot" cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="5"/></svg></div>
    <div class="ridge-leg" style="padding-left:${(pl / W * 100).toFixed(2)}%;padding-right:${(pr / W * 100).toFixed(2)}%"><span style="flex:7.5">Base</span><span style="flex:8">Développement</span><span style="flex:6">Spécifique</span><span style="flex:2.5">Affût</span></div>`;
}
function heroHtml() {
  const t = todayStr(), toRace = dayDiff(PLAN.race, t), toStart = dayDiff(PLAN.start, t), cw = weekOf(t);
  const label = cw >= 1 && cw <= 25 ? "Semaine " + cw + " sur 25 · " + PLAN.weeks[cw - 1].phase : toStart > 0 ? "Le plan démarre le " + dLong(PLAN.start) : "Après la course";
  let big, sub;
  if (toRace > 0) { big = `<span class="j">J-</span>${toRace}`; sub = `jours avant le NTMF, ${esc(dLong(PLAN.race).toLowerCase())}`; }
  else if (toRace === 0) { big = "Jour J"; sub = "42 km, 1 050 m de D+. Partez lentement."; }
  else { big = "Finisher"; sub = "La course est derrière vous. Reposez-vous."; }
  return `<section class="hero">${contourSvg()}${hudHtml()}<div class="hero-in"><div><div class="label">${esc(label)}</div><div class="count">${big}</div><p class="hero-sub">${sub}</p></div>
    <div class="hero-stats"><div><div class="v">${fmtNum(totalKm())}<small>km</small></div><div class="k">courus</div></div><div><div class="v">${fmtNum(totalDp())}<small>m</small></div><div class="k">de D+</div></div><div><div class="v">${S.sessions.length}</div><div class="k">séances</div></div></div></div>${ridgeHtml()}</section>`;
}
function heatmap() {
  const t = todayStr();
  let h = `<div class="hm"><span></span>${PLAN.weeks.map(w => `<span class="hm-h">${w.n % 4 === 1 || w.n === 25 ? w.n : ""}</span>`).join("")}`;
  for (let di = 0; di < 7; di++) {
    h += `<span class="hm-l">${DAYS3[di][0]}</span>`;
    PLAN.weeks.forEach(w => {
      const date = addDays(w.start, di), d = w.days[di], done = isDone(date);
      const lvl = d.km >= 25 ? 4 : d.km >= 15 ? 3 : d.km >= 8 ? 2 : 1;
      let c = "hm-c ";
      if (date === PLAN.race) c += "race";
      else if (!d.km) c += done ? "done" : "rest";
      else if (done) c += "done";
      else if (date < t) c += "miss";
      else c += "fut";
      if (date === t) c += " now";
      h += `<button class="${c}" style="--l:${lvl}" data-act="week" data-n="${w.n}" title="${esc(DAYS3[di] + " " + dShort(date) + " : " + d.t)}" aria-label="${esc(DAYS3[di] + " " + dShort(date) + " : " + d.t)}"></button>`;
    });
  }
  return h + `</div><div class="hm-leg"><span><i style="background:var(--sky);opacity:.4"></i>à venir</span><span><i style="background:var(--accent)"></i>faite</span><span><i style="box-shadow:inset 0 0 0 1.6px var(--bad)"></i>manquée</span><span><i style="box-shadow:inset 0 0 0 1px var(--line)"></i>repos</span><span>Plus la case est foncée, plus la séance est longue.</span></div>`;
}
const checklistHtml = (items, big) => { const g = (S.profile && S.profile.gear) || {}; return `<div class="checks">${items.map(i => `<button class="chk" data-act="gear" data-k="${i[0]}" aria-pressed="${!!g[i[0]]}"><i>✓</i><span>${esc(i[1])}</span></button>`).join("")}</div>`; };

/* ------------------------------------------------------------------ vues : aujourd'hui */
function targetBars(date) {
  const pd = planDay(date), W = weightOn(date), tg = targets(pd ? pd.day : null, W), tot = totalsOn(date), water = (dayOf(date).water || 0) / 1000;
  const row = (name, v, goal, unit) => {
    const pc = goal ? clamp(v / goal * 100, 0, 100) : 0;
    return `<div class="macro"><span>${name}</span><div class="bar${v > goal * 1.1 ? " over" : ""}"><i style="width:${pc.toFixed(0)}%"></i></div><span class="r">${fmtNum(v)} / ${fmtNum(goal)} ${unit}</span></div>`;
  };
  const wr = `<div class="macro"><span>Eau</span><div class="bar green"><i style="width:${clamp(water / tg.water * 100, 0, 100).toFixed(0)}%"></i></div><span class="r">${String(Math.round(water * 10) / 10).replace(".", ",")} / ${String(tg.water).replace(".", ",")} L</span></div>`;
  return `<div>${row("Énergie", tot.kcal, tg.kcal, "kcal")}${row("Protéines", tot.p, tg.p, "g")}${row("Glucides", tot.c, tg.c, "g")}${row("Lipides", tot.f, tg.f, "g")}${wr}</div>
    <p class="small mute" style="margin-top:12px">Dépense estimée ${fmtNum(tg.dep)} kcal${tg.intra ? " · " + tg.intra + " g de glucides pendant l'effort" : ""} · calculé pour ${String(W).replace(".", ",")} kg.</p>`;
}
function waterButtons(date) {
  return `<div class="btns" style="margin-top:10px"><button class="btn sm" data-act="water" data-date="${date}" data-n="250">+ 250 ml</button><button class="btn sm" data-act="water" data-date="${date}" data-n="500">+ 500 ml</button><button class="btn sm" data-act="water" data-date="${date}" data-n="-250">− 250 ml</button></div>`;
}
function dayCard(t, pd) {
  const ss = sessionsOn(t), done = isDone(t), tg = targets(pd.day, weightOn(t));
  return `<div class="card hl"><div class="card-h"><div><div class="label">${DAYS[pd.di]} ${esc(dShort(t))} · semaine ${pd.wn}</div><h2>${esc(pd.day.t)}</h2></div><span class="tag ${done ? "ok" : ""}">${done ? "Faite" : "À faire"}</span></div>
    <div class="stats"><div class="stat"><div class="v">${pd.day.km}<small>km</small></div><div class="k">Prévu</div></div><div class="stat"><div class="v">${pd.day.dp}<small>m D+</small></div><div class="k">Dénivelé estimé</div></div>
    <div class="stat"><div class="v">${weekKm(pd.wn) ? fmtKm(weekKm(pd.wn)) : "0"}<small>/ ${weekPlanKm(pd.wn)} km</small></div><div class="k">Cette semaine</div></div></div>
    <p class="small mute" style="margin-top:12px">Cibles du jour : ${fmtNum(tg.kcal)} kcal · ${tg.c} g de glucides${tg.intra ? " dont " + tg.intra + " g pendant l'effort" : ""} · eau ${String(tg.water).replace(".", ",")} L.</p>
    ${ss.length ? `<div style="margin-top:12px">${ss.map(s => `<div class="small"><button class="btn sm" data-act="openSession" data-id="${esc(s.id)}">Voir l'analyse</button><div style="margin-top:4px">${sessionStatLine(s)}</div></div>`).join("")}</div>` : ""}
    <div class="btns" style="margin-top:14px"><button class="btn primary" data-act="goImport">Importer la séance</button>
    ${hasStore() ? `<button class="btn" data-act="toggleDone" data-date="${t}">${checks()[t] ? "Décocher" : "Marquer comme faite"}</button>` : ""}</div></div>`;
}
function preCard(toStart) {
  const w1 = PLAN.weeks[0], g = (S.profile && S.profile.gear) || {};
  const n = PRE.filter(i => g[i[0]]).length;
  return `<div class="card hl"><div class="card-h"><div><div class="label">Avant le départ</div><h2>${toStart} jour${toStart > 1 ? "s" : ""} pour vous préparer</h2></div><span class="tag">${n} / ${PRE.length}</span></div>
    ${checklistHtml(PRE)}
    <details style="margin-top:14px"><summary class="small" style="cursor:pointer">Aperçu de la semaine 1 (du ${esc(dShort(PLAN.start))})</summary><div class="rows" style="margin-top:8px">${w1.days.map((d, i) => `<div class="row"><div class="d">${DAYS3[i]}<span>${esc(dShort(addDays(PLAN.start, i)))}</span></div><div>${esc(d.t)}</div><div class="mono small mute">${d.km ? d.km + " km" : ""}</div></div>`).join("")}</div></details></div>`;
}
function checkinCard(date) {
  const d = dayOf(date), r = readiness(d);
  const seg = (k, opts) => `<div class="seg">${opts.map(o => `<button class="pill" data-act="day" data-date="${date}" data-k="${k}" data-v="${o[0]}" aria-pressed="${d[k] === o[0]}">${o[1]}</button>`).join("")}</div>`;
  const week = S.days.filter(x => x.id >= addDays(date, -6) && x.id <= date);
  const avg = k => { const v = week.map(x => x[k]).filter(x => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  const as = avg("sleep"), al = avg("legs");
  return `<div class="card"><div class="card-h"><h3>Forme du jour</h3>${r ? `<span class="tag ${r.level === "ok" ? "ok" : r.level === "warn" ? "warn" : "bad"}">${r.score} / 100</span>` : `<span class="small mute">30 secondes</span>`}</div>
    <div class="grid" style="gap:14px">
    <div class="field"><label>Sommeil (heures)</label>${seg("sleep", [[5, "≤ 5"], [6, "6"], [7, "7"], [8, "8"], [9, "9+"]])}</div>
    <div class="field"><label>Jambes</label>${seg("legs", [[1, "Mortes"], [2, "Lourdes"], [3, "Moyennes"], [4, "Bonnes"], [5, "Ressorts"]])}</div>
    <div class="field"><label>Moral</label>${seg("mood", [[1, "Bas"], [2, "Mitigé"], [3, "Neutre"], [4, "Motivé"], [5, "À bloc"]])}</div>
    <div class="field"><label>Douleur</label>${seg("pain", [[0, "Aucune"], [1, "Légère"], [2, "Gênante"]])}</div></div>
    ${r ? `<div class="callout ${r.level === "ok" ? "" : r.level}" style="margin-top:14px">${esc(r.msg)}</div>` : `<p class="small mute" style="margin-top:12px">Touchez une réponse par ligne : vous obtenez un conseil sur la séance du jour.</p>`}
    ${week.length >= 3 && as != null && al != null ? `<p class="small mute mono" style="margin-top:10px">7 derniers jours : sommeil ${String(Math.round(as * 10) / 10).replace(".", ",")} h · jambes ${String(Math.round(al * 10) / 10).replace(".", ",")} / 5</p>` : ""}
    ${hasStore() ? "" : `<p class="small mute" style="margin-top:8px">L'enregistrement demande d'être connecté à votre compte Claude.</p>`}</div>`;
}
function briefCard(t, pd) {
  if (!S.sample || !pd) return "";
  const b = S.brief.date === t ? S.brief : { busy: false, text: "", err: "" };
  return `<div class="card"><div class="card-h"><h3>Briefing de séance</h3><button class="btn primary sm" data-act="briefing" ${b.busy ? "disabled" : ""}>${b.busy ? "Rédaction…" : (b.text ? "Refaire" : "Briefing du coach")}</button></div>
    <div class="analysis" id="briefText">${b.busy && !b.text ? `<span class="spin"></span>Claude prépare votre séance…` : (b.text ? mdLite(b.text) : `<p class="empty">Échauffement, structure de la séance, allures et quoi manger avant et après, adaptés à votre forme du jour.</p>`)}</div>
    ${b.err ? `<p class="small" style="color:var(--bad);margin-top:8px" role="alert">${esc(b.err)}</p>` : ""}</div>`;
}
function viewToday() {
  const t = todayStr(), pd = planDay(t), toStart = dayDiff(PLAN.start, t);
  let main;
  if (toStart > 0) main = preCard(toStart);
  else if (!pd) main = `<div class="card hl"><h2>Plan terminé</h2><p class="mute" style="margin-top:6px">Retrouvez votre historique dans Séances et Carnet.</p></div>`;
  else main = dayCard(t, pd);
  const nutri = `<div class="card"><div class="card-h"><h3>Alimentation du jour</h3><button class="btn sm" data-act="goMeals">Ajouter un repas</button></div>${targetBars(t)}${waterButtons(t)}</div>`;
  const last = S.sessions.slice().sort((a, b) => a.date < b.date ? 1 : -1)[0];
  const lastCard = last ? `<div class="card"><div class="card-h"><h3>Dernière séance</h3><span class="mute small">${esc(dLong(last.date))}</span></div><p>${sessionStatLine(last)}</p>
    ${last.analysis ? `<div class="analysis small" style="margin-top:8px">${mdLite(last.analysis.text.split("\n").slice(0, 3).join("\n"))}</div>` : ""}
    <div class="btns" style="margin-top:10px"><button class="btn sm" data-act="openSession" data-id="${esc(last.id)}">Ouvrir</button></div></div>`
    : `<div class="card plain"><h3>Aucune séance importée</h3><p class="mute" style="margin-top:6px">Importez un fichier GPX ou TCX de votre montre : Claude analyse l'allure, le dénivelé et la fréquence cardiaque, kilomètre par kilomètre.</p><div class="btns" style="margin-top:12px"><button class="btn" data-act="goImport">Importer une sortie</button></div></div>`;
  const bc = briefCard(t, pd);
  return `<div class="grid">${setupBanner()}${heroHtml()}${main}<div class="grid g2">${checkinCard(t)}<div class="grid" style="align-content:start">${bc || lastCard}</div></div><div class="grid g2">${nutri}${bc ? lastCard : ""}</div>${feedCard()}</div>`;
}

/* ------------------------------------------------------------------ vues : programme */
function viewPlan() {
  const cur = weekOf(todayStr());
  const n = S.weekSel || clamp(cur, 1, 25), w = PLAN.weeks[n - 1], today = todayStr();
  const done = weekKm(n), planKm = weekPlanKm(n);
  const pills = PLAN.weeks.map(x => `<button class="pill${x.n === cur ? " cur" : ""}" data-act="week" data-n="${x.n}" aria-pressed="${x.n === n}">${x.n}</button>`).join("");
  const rows = w.days.map((d, i) => {
    const date = addDays(w.start, i), ss = sessionsOn(date), dn = isDone(date), tg = targets(d, weightOn(date));
    return `<div class="row${date === today ? " today" : ""}"><div class="d">${DAYS3[i]}<span>${dShort(date)}</span></div>
      <div><div>${esc(d.t)}</div><div class="small mute mono">${d.km ? d.km + " km" : "repos"}${d.dp ? " · +" + d.dp + " m" : ""} · ${fmtNum(tg.kcal)} kcal</div>
      ${ss.map(s => `<div class="small"><button class="btn sm" style="margin-top:4px" data-act="openSession" data-id="${esc(s.id)}">Séance importée</button><div style="margin-top:4px">${sessionStatLine(s)}</div></div>`).join("")}</div>
      <div class="btns" style="flex-wrap:nowrap">${hasStore() ? `<button class="row-btn" data-act="toggleDone" data-date="${date}" aria-pressed="${dn}" aria-label="Marquer ${DAYS[i]} comme faite">${dn ? "✓" : ""}</button>` : ""}</div></div>`;
  }).join("");
  const missed = PLAN.weeks.reduce((a, x) => a + x.days.filter((d, i) => d.km && addDays(x.start, i) < today && !isDone(addDays(x.start, i))).length, 0);
  return `<div class="grid">
    <section class="hero" style="padding-bottom:0">${contourSvg()}<div class="hero-in"><div><div class="label">25 semaines · du 2 novembre au 25 avril</div><h2 style="font-size:40px">La crête</h2><p class="hero-sub" style="font-size:15px">Volume hebdomadaire prévu, de ${Math.min.apply(null, PLAN.weeks.map(x => weekPlanKm(x.n)))} à ${Math.max.apply(null, PLAN.weeks.map(x => weekPlanKm(x.n)))} km. Creux = semaines de décharge.</p></div>
      <div class="hero-stats"><div><div class="v">${fmtNum(planTotal("km"))}<small>km</small></div><div class="k">au total</div></div><div><div class="v">${fmtNum(planTotal("dp"))}<small>m</small></div><div class="k">de D+</div></div></div></div>${ridgeHtml()}</section>
    <div class="card"><div class="card-h"><h3>Calendrier</h3><span class="small mute">${missed ? missed + " séance" + (missed > 1 ? "s" : "") + " manquée" + (missed > 1 ? "s" : "") : "touchez une case pour ouvrir la semaine"}</span></div>${heatmap()}</div>
    <div class="card"><div class="card-h"><h3>Semaine</h3></div><div class="weeks" role="group" aria-label="Choisir la semaine">${pills}</div></div>
    <div class="card"><div class="card-h"><div><div class="label">Semaine ${n} · ${esc(w.phase)}</div><h3>${esc(dShort(w.start))} au ${esc(dShort(addDays(w.start, 6)))}</h3></div>
    <div class="mono small">${fmtKm(done)} / ${planKm} km · ${weekPlanDp(n)} m D+ prévus</div></div>
    <div class="bar" style="margin-bottom:10px"><i style="width:${planKm ? clamp(done / planKm * 100, 0, 100).toFixed(0) : 0}%"></i></div>
    <div class="rows">${rows}</div></div></div>`;
}

/* ------------------------------------------------------------------ vues : détail séance */
/* ------------------------------------------------------------------ vues : carnet (sous-onglets) */
const SUBS = [["progress", "Progrès"], ["trophies", "Trophées"], ["race", "Course"], ["gear", "Matos"], ["data", "Données"]];
function viewMore() {
  const bar = `<div class="sub" role="group" aria-label="Rubriques du carnet">${SUBS.map(s => `<button class="pill" data-act="sub" data-sub="${s[0]}" aria-pressed="${S.sub === s[0]}">${s[1]}</button>`).join("")}</div>`;
  const body = { progress: viewProgress, trophies: viewTrophies, race: viewRace, gear: viewGear, data: viewData }[S.sub]();
  return `<div class="grid">${bar}${body}</div>`;
}
function altimeterCard() {
  const td = totalDp(), pt = planTotal("dp"), max = Math.max(pt, td, 9000);
  return `<div class="card"><div class="card-h"><h3>Altimètre cumulé</h3><span class="small mute mono">${fmtNum(td)} m sur ${fmtNum(pt)} m prévus</span></div>
    <p class="mute small">Le plan vous fait gravir ${fmtNum(pt)} m de D+, soit ${String(Math.round(pt / 8849 * 10) / 10).replace(".", ",")} fois l'Everest. Chaque séance importée remplit la jauge.</p>
    <div class="alt" role="img" aria-label="${fmtNum(td)} mètres de dénivelé positif cumulés"><i style="width:${(td / max * 100).toFixed(1)}%"></i>${SUMMITS.map(s => `<b style="left:${(s[1] / max * 100).toFixed(2)}%"></b>`).join("")}</div>
    <div class="peaks">${SUMMITS.map(s => `<span class="peak${td >= s[1] ? " on" : ""}">${td >= s[1] ? "✓ " : ""}${s[0]} · ${fmtNum(s[1])} m</span>`).join("")}</div></div>`;
}
function recordsCard() {
  const efforts = [["Meilleur kilomètre", 1], ["Meilleurs 5 km", 5], ["Meilleurs 10 km", 10]].map(a => ({ n: a[0], k: a[1], b: bestEffort(a[1]) }));
  const longest = S.sessions.slice().sort((a, b) => (b.km || 0) - (a.km || 0))[0];
  const mostDp = S.sessions.slice().sort((a, b) => (b.dp || 0) - (a.dp || 0))[0];
  let bw = null; PLAN.weeks.forEach(w => { const k = weekKm(w.n); if (k > 0 && (!bw || k > bw.k)) bw = { k, n: w.n }; });
  const rows = efforts.map(e => `<tr><td>${e.n}</td><td class="mono">${e.b ? (e.k === 1 ? fmtPace(e.b.t) + "/km" : mmss(e.b.t) + " (" + fmtPace(e.b.t / e.k) + "/km)") : "–"}</td><td class="mute">${e.b ? esc(dShort(e.b.s.date)) : ""}</td></tr>`).join("")
    + `<tr><td>Plus longue sortie</td><td class="mono">${longest ? fmtKm(longest.km) + " km" : "–"}</td><td class="mute">${longest ? esc(dShort(longest.date)) : ""}</td></tr>`
    + `<tr><td>Plus gros dénivelé</td><td class="mono">${mostDp && mostDp.dp ? "+" + mostDp.dp + " m" : "–"}</td><td class="mute">${mostDp && mostDp.dp ? esc(dShort(mostDp.date)) : ""}</td></tr>`
    + `<tr><td>Semaine la plus chargée</td><td class="mono">${bw ? fmtKm(bw.k) + " km" : "–"}</td><td class="mute">${bw ? "semaine " + bw.n : ""}</td></tr>`;
  return `<div class="card"><div class="card-h"><h3>Records personnels</h3><span class="small mute">tous terrains confondus</span></div><div class="tbl-wrap"><table class="t"><tr><th>Record</th><th>Valeur</th><th>Date</th></tr>${rows}</table></div></div>`;
}
function badgeList() {
  const ss = S.sessions, mx = f => ss.reduce((a, s) => Math.max(a, f(s) || 0), 0);
  const longestKm = mx(s => s.km), longestSec = mx(s => s.moveSec), maxDp = mx(s => s.dp), tk = totalKm(), td = totalDp();
  const best10 = S.measures.filter(m => m.tenkSec != null).reduce((a, m) => Math.min(a, m.tenkSec), 1e9);
  const vo2 = S.measures.reduce((a, m) => Math.max(a, m.vo2 || 0), 0);
  let run = 0, bestRun = 0; const cw = weekOf(todayStr());
  for (let n = 1; n <= Math.min(25, cw - 1); n++) { if (weekKm(n) >= 0.9 * weekPlanKm(n)) { run++; bestRun = Math.max(bestRun, run); } else run = 0; }
  const doneDays = PLAN.weeks.reduce((a, w) => a + w.days.filter((d, i) => d.km && isDone(addDays(w.start, i))).length, 0);
  const finisher = ss.some(s => s.date === PLAN.race && s.km >= 40) ? 1 : 0;
  const km = x => (Number.isInteger(x) ? fmtNum(x) : fmtKm(x)) + " km", B = (g, t, d, v, max, fmt) => ({ g, t, d, v, max, ok: v >= max, fmt: fmt || (x => fmtNum(x)) });
  return [
    B("1", "Premier pas", "Importer une première séance", ss.length, 1),
    B("10K", "Dix bornes", "Une sortie de 10 km", longestKm, 10, km),
    B("20K", "Vingt bornes", "Une sortie de 20 km", longestKm, 20, km),
    B("30K", "Trente bornes", "Une sortie de 30 km", longestKm, 30, km),
    B("40K", "Presque un marathon", "Une sortie de 40 km", longestKm, 40, km),
    B("2H", "Deux heures", "Deux heures de course en continu", longestSec, 7200, fmtDur),
    B("3H", "Trois heures", "Trois heures de course", longestSec, 10800, fmtDur),
    B("5H", "Sortie reine", "Cinq heures de course", longestSec, 18000, fmtDur),
    B("+500", "Grimpeur", "500 m de D+ sur une sortie", maxDp, 500, x => "+" + fmtNum(x) + " m"),
    B("+1K", "Jour de course", "1 050 m de D+ sur une sortie", maxDp, 1050, x => "+" + fmtNum(x) + " m"),
    B("100", "Centurion", "100 km cumulés", tk, 100, km),
    B("500", "Demi-millier", "500 km cumulés", tk, 500, km),
    B("1000", "Millième", "1 000 km cumulés", tk, 1000, km),
    B("8849", "Everest", "8 849 m de D+ cumulés", td, 8849, x => fmtNum(x) + " m"),
    B("x4", "Quatre pleines", "4 semaines de suite à 90 % du volume prévu", bestRun, 4),
    B("30", "Régulier", "30 séances faites au programme", doneDays, 30),
    B("PB", "Sous " + mmss(K.t10), "Un 10 km sous votre record de départ", best10 < K.t10 ? 1 : 0, 1),
    B("46", "Objectif 10 km", "Gagner 3 % sur votre record (" + mmss(Math.round(K.t10 * 0.969)) + ")", best10 <= Math.round(K.t10 * 0.969) ? 1 : 0, 1),
    B("57", "VO2max 57", "Un très bon niveau d'endurance", vo2, 57),
    B("60", "VO2max 60", "L'objectif ambitieux", vo2, 60),
    B("42", "Finisher", "Terminer le NTMF 42 km", finisher, 1)
  ];
}
function viewTrophies() {
  const bl = badgeList(), n = bl.filter(b => b.ok).length;
  return `<div class="card"><div class="card-h"><h2>Trophées</h2><span class="tag">${n} / ${bl.length}</span></div><p class="mute small">Ils se débloquent tout seuls d'après vos séances importées, vos mesures et votre assiduité.</p></div>
    <div class="badges">${bl.map(b => `<div class="badge${b.ok ? " on" : ""}"><div class="hex" style="font-size:${b.g.length >= 4 ? 20 : b.g.length === 3 ? 24 : 27}px">${esc(b.g)}</div><div class="t">${esc(b.t)}</div><div class="dd">${esc(b.d)}</div>${!b.ok && b.v > 0 ? `<div class="bar"><i style="width:${clamp(b.v / b.max * 100, 2, 100).toFixed(0)}%"></i></div><div class="dd mono">${esc(b.fmt(b.v))} / ${esc(b.fmt(b.max))}</div>` : ""}</div>`).join("")}</div>`;
}

/* course : plan, pente, prédicteur */
const goalNow = () => (S.profile && S.profile.goalSec) || 16500;
function goalHtml() {
  const raw = S.inputs.goal != null ? S.inputs.goal : toHM(goalNow());
  const g = parseHM(raw);
  if (g == null || g < 7200 || g > 32400) return `<p class="small" style="color:var(--bad)">Format attendu : 4:35 (heures et minutes), entre 2 h et 9 h.</p>`;
  let cum = 0;
  const rows = SEG.map(s => { const t = g * s[2]; cum += t; return `<tr><td>${s[0]}–${s[1]} km</td><td class="mono">${fmtPace(t / 14)}/km</td><td class="mono">${fmtDur(t)}</td><td class="mono">${fmtDur(cum)}</td></tr>`; }).join("");
  const hrs = g / 3600, gph = hrs < 1.25 ? 0 : hrs < 2 ? 30 : hrs < 3 ? 60 : 80, per = gph / 3;
  const marks = []; for (let m = 25; m < g / 60 - 10; m += 20) marks.push(toHM(m * 60));
  return `<div class="tbl-wrap"><table class="t"><tr><th>Tronçon</th><th>Allure</th><th>Durée</th><th>Cumul</th></tr>${rows}</table></div>
    <p class="small mute" style="margin-top:10px">Départ prudent, accélération progressive : le dernier tiers est le plus rapide. Les allures sont des moyennes, bien plus lentes en montée et plus rapides en descente.</p>
    ${gph ? `<h4 style="margin-top:18px;margin-bottom:8px">Ravitaillement : ${gph} g de glucides par heure</h4><p class="small">Une prise d'environ <strong>${Math.round(per)} g</strong> toutes les 20 minutes (un gel, ou une barre, ou de la boisson d'effort), soit <strong>${Math.round(gph * hrs)} g</strong> sur la course. Eau : environ <strong>${String(Math.round(hrs * 5) / 10).replace(".", ",")} L</strong> au total, et 300 à 600 mg de sodium par heure, davantage s'il fait chaud.</p>
    <div class="peaks">${marks.map(m => `<span class="peak mono">${m}</span>`).join("")}</div>` : ""}`;
}
function slopeHtml() {
  const flat = parseMMSS(S.calc.flat), s = num(S.calc.slope);
  if (flat == null) return `<p class="small" style="color:var(--bad)">Allure au format 5:55.</p>`;
  const one = s != null ? (() => { const p = flat * slopeFactor(s / 100); return `<div class="stats" style="margin-bottom:14px"><div class="stat"><div class="v">${fmtPace(p)}<small>/km</small></div><div class="k">À effort égal sur ${String(s).replace(".", ",")} %</div></div><div class="stat"><div class="v">${(3600 / p).toFixed(1).replace(".", ",")}<small>km/h</small></div><div class="k">Vitesse</div></div>${s > 0 ? `<div class="stat"><div class="v">${fmtNum(s * 10 / p * 3600)}<small>m/h</small></div><div class="k">Montée par heure</div></div>` : ""}</div>`; })() : "";
  const sl = [-10, -5, 0, 3, 5, 8, 10, 12, 15, 20];
  const tip = g => g >= 15 ? "Marche active" : g >= 10 ? "Marche rapide" : g >= 6 ? "Trot court" : g > 0 ? "En contrôle" : g < 0 ? "Relâchez" : "Plat";
  return `${one}<div class="tbl-wrap"><table class="t"><tr><th>Pente</th><th>Allure équivalente</th><th>Conseil</th></tr>${sl.map(g => `<tr><td class="mono">${g > 0 ? "+" : ""}${g} %</td><td class="mono">${fmtPace(flat * slopeFactor(g / 100))}/km</td><td class="mute" style="white-space:normal">${tip(g)}</td></tr>`).join("")}</table></div>
    <p class="small mute" style="margin-top:10px">Modèle de coût énergétique de la course en pente (Minetti), appliqué à effort égal. En descente, le gain est plafonné car le terrain technique ralentit.</p>`;
}
function predHtml() {
  const d = num(S.calc.dist), dp = num(S.calc.dplus), flat = parseMMSS(S.calc.flat2), pen = num(S.calc.pen);
  if (d == null || dp == null || flat == null || pen == null) return `<p class="small" style="color:var(--bad)">Renseignez distance, dénivelé, allure (5:55) et pénalité.</p>`;
  const t = d * flat + dp * pen;
  return `<div class="stats"><div class="stat"><div class="v">${fmtDur(t)}</div><div class="k">Temps estimé</div></div><div class="stat"><div class="v">${fmtPace(t / d)}<small>/km</small></div><div class="k">Allure moyenne</div></div><div class="stat"><div class="v">${fmtDur(dp * pen)}</div><div class="k">Coût du dénivelé</div></div></div>
    <p class="small mute" style="margin-top:10px">Temps = distance × allure plat + dénivelé × pénalité. Une pénalité de 1,3 s par mètre de D+ correspond à votre objectif de 4 h 35 sur le NTMF.</p>`;
}
function riegelHtml() {
  const best = S.measures.filter(m => m.tenkSec != null).reduce((a, m) => Math.min(a, m.tenkSec), 1e9), t10 = best < 1e9 ? best : K.t10;
  const rows = [[5, "5 km"], [10, "10 km"], [21.0975, "Semi"], [42.195, "Marathon"]].map(a => { const t = t10 * Math.pow(a[0] / 10, 1.06); return `<tr><td>${a[1]}</td><td class="mono">${t >= 3600 ? fmtDur(t) : mmss(t)}</td><td class="mono mute">${fmtPace(t / a[0])}/km</td></tr>`; }).join("");
  return `<div class="tbl-wrap"><table class="t"><tr><th>Distance</th><th>Prédiction</th><th>Allure</th></tr>${rows}</table></div><p class="small mute" style="margin-top:10px">Formule de Riegel à partir de votre 10 km en ${mmss(t10)}. Elle est optimiste sur marathon si l'endurance est le facteur limitant : votre record réel est de 3 h 58.</p>`;
}
function viewRace() {
  const c = S.calc, goalRaw = S.inputs.goal != null ? S.inputs.goal : toHM(goalNow());
  return `<div class="card hl"><div class="card-h"><div><div class="label">Dimanche 25 avril 2027</div><h2>Plan de course</h2></div></div>
      <div class="form-grid" style="max-width:340px;margin-bottom:14px"><div class="field"><label for="goal">Temps visé (h:mm)</label><input type="text" id="goal" inputmode="numeric" data-bind="inputs.goal" data-live="goalOut" data-persist="goal" value="${esc(goalRaw)}" placeholder="4:35"></div></div>
      <div id="goalOut">${goalHtml()}</div></div>
    <div class="grid g2">
    <div class="card"><div class="card-h"><h3>Allure en pente</h3></div>
      <div class="form-grid" style="margin-bottom:14px"><div class="field"><label for="cFlat">Allure sur le plat</label><input type="text" id="cFlat" inputmode="numeric" data-bind="calc.flat" data-live="slopeOut" value="${esc(c.flat)}"></div><div class="field"><label for="cSlope">Pente (%)</label><input type="text" id="cSlope" inputmode="decimal" data-bind="calc.slope" data-live="slopeOut" value="${esc(c.slope)}"></div></div>
      <div id="slopeOut">${slopeHtml()}</div></div>
    <div class="card"><div class="card-h"><h3>Prédicteur de course</h3></div>
      <div class="form-grid" style="margin-bottom:14px"><div class="field"><label for="cD">Distance (km)</label><input type="text" id="cD" inputmode="decimal" data-bind="calc.dist" data-live="predOut" value="${esc(c.dist)}"></div><div class="field"><label for="cDp">D+ (m)</label><input type="text" id="cDp" inputmode="numeric" data-bind="calc.dplus" data-live="predOut" value="${esc(c.dplus)}"></div>
      <div class="field"><label for="cF2">Allure plat</label><input type="text" id="cF2" inputmode="numeric" data-bind="calc.flat2" data-live="predOut" value="${esc(c.flat2)}"></div><div class="field"><label for="cP">Pénalité (s par m D+)</label><input type="text" id="cP" inputmode="decimal" data-bind="calc.pen" data-live="predOut" value="${esc(c.pen)}"></div></div>
      <div id="predOut">${predHtml()}</div></div></div>
    <div class="card"><div class="card-h"><h3>Zones d'allure</h3><span class="small mute">sur le plat</span></div>
      <div class="rows">${ZONES.map(z => `<div class="row" style="grid-template-columns:14px minmax(0,1fr);align-items:start"><b style="width:12px;height:12px;border-radius:4px;background:var(--${z[3]});margin-top:5px"></b><div><strong>${z[0]}</strong> <span class="mono small">${z[1]}/km</span><div class="small mute">${z[2]}</div></div></div>`).join("")}</div></div>
    <div class="card"><div class="card-h"><h3>Prédictions sur route</h3></div><div id="riegelOut">${riegelHtml()}</div></div>`;
}
function viewGear() {
  const sh = shoes(), g = (S.profile && S.profile.gear) || {}, n = GEAR.filter(i => g[i[0]]).length, f = S.shoeForm;
  const shoeRow = x => {
    const km = shoeKm(x), pc = clamp(km / x.max * 100, 0, 100), st = km >= x.max ? ["bad", "À remplacer"] : km >= x.max * 0.85 ? ["warn", "Bientôt usées"] : ["ok", "En forme"];
    return `<div style="padding:14px 0;border-top:1px solid var(--line)"><div class="card-h" style="margin-bottom:8px"><strong>${esc(x.name)}</strong><span class="tag ${st[0]}">${st[1]}</span></div>
      <div class="bar ${km >= x.max * 0.85 ? "over" : "green"}"><i style="width:${pc.toFixed(0)}%"></i></div>
      <div class="card-h" style="margin:8px 0 0"><span class="mono small">${fmtNum(km)} / ${fmtNum(x.max)} km</span><div class="btns">${S.profile.defaultShoe === x.id ? `<span class="tag ok">Par défaut</span>` : `<button class="btn sm" data-act="shoeDefault" data-id="${esc(x.id)}">Mettre par défaut</button>`}${S.confirmDel === x.id ? `<button class="btn sm danger" data-act="shoeDel" data-id="${esc(x.id)}">Confirmer</button><button class="btn sm" data-act="cancelDel">Annuler</button>` : `<button class="btn sm" data-act="askDel" data-id="${esc(x.id)}">Retirer</button>`}</div></div></div>`;
  };
  return `<div class="card"><div class="card-h"><h2>Chaussures</h2><span class="small mute">le kilométrage se cumule à chaque séance importée</span></div>
      ${sh.length ? sh.map(shoeRow).join("") : `<p class="empty">Aucune paire renseignée. Vos Hoka Clifton 10 dépassent déjà 700 km : c'est le moment de les suivre.</p><div class="btns" style="margin-top:10px"><button class="btn primary" data-act="addHoka" ${hasStore() ? "" : "disabled"}>Ajouter mes Hoka Clifton 10 (700 km)</button></div>`}
      <h4 style="margin:18px 0 10px">Ajouter une paire</h4>
      <div class="form-grid"><div class="field"><label for="shN">Modèle</label><input type="text" id="shN" data-bind="shoeForm.name" value="${esc(f.name)}" placeholder="Ex. : trail neuves"></div><div class="field"><label for="shS">Déjà parcourus (km)</label><input type="text" id="shS" inputmode="numeric" data-bind="shoeForm.start" value="${esc(f.start)}"></div><div class="field"><label for="shM">Durée de vie (km)</label><input type="text" id="shM" inputmode="numeric" data-bind="shoeForm.max" value="${esc(f.max)}"></div></div>
      <div class="btns" style="margin-top:12px"><button class="btn primary" data-act="addShoe" ${hasStore() ? "" : "disabled"}>Ajouter</button></div></div>
    <div class="card"><div class="card-h"><h2>Sac de course</h2><span class="tag ${n === GEAR.length ? "ok" : ""}">${n} / ${GEAR.length}</span></div>${checklistHtml(GEAR)}
      <p class="small mute" style="margin-top:10px">La liste du matériel obligatoire est fixée par l'organisation : relisez son règlement.</p></div>`;
}

function shoeField() {
  const sh = shoes(); if (!sh.length) return "";
  const cur = S.inputs.impShoe != null ? S.inputs.impShoe : (S.profile.defaultShoe || "");
  return `<div class="field"><label for="impShoe">Chaussures</label><select id="impShoe" data-bind="inputs.impShoe"><option value="">Non renseignées</option>${sh.map(x => `<option value="${esc(x.id)}"${x.id === cur ? " selected" : ""}>${esc(x.name)}</option>`).join("")}</select></div>`;
}
const LIVE = { goalOut: goalHtml, slopeOut: slopeHtml, predOut: predHtml };
