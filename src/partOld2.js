function sessionStatLine(s) {
  return `<span class="mono">${fmtKm(s.km)} km</span> · <span class="mono">${s.paceSec ? fmtPace(s.paceSec) + "/km" : "–"}</span>${s.dp != null ? ` · <span class="mono">+${s.dp} m</span>` : ""}${s.avgHr ? ` · <span class="mono">${s.avgHr} bpm</span>` : ""}`;
}
function viewProgress() {
  const ms = S.measures.slice().sort((a, b) => a.date < b.date ? -1 : 1);
  const pts = (key, fmt) => ms.filter(m => m[key] != null).map(m => ({ x: dayDiff(m.date, "2026-01-01"), y: m[key], label: fmt ? fmt(m[key]) : String(m[key]).replace(".", ","), d: dShort(m.date) }));
  const wp = pts("weight"), vp = pts("vo2"), rp = pts("rhr"), tp = pts("tenkSec", mmss);
  const best = ms.filter(m => m.tenkSec != null).reduce((a, m) => Math.min(a, m.tenkSec), 1e9);
  const totalKm = S.sessions.reduce((a, s) => a + (s.km || 0), 0), longest = S.sessions.reduce((a, s) => Math.max(a, s.km || 0), 0);
  const f = S.mform;
  const chartCard = (title, data, opts, note) => `<div class="card"><div class="card-h"><h3>${title}</h3><span class="small mute">${note || ""}</span></div>${data.length ? `<div class="chart-wrap">${lineChart(data, opts)}</div>` : `<p class="empty">Pas encore de mesure.</p>`}</div>`;
  return `<div class="grid">
    <div class="card"><div class="card-h"><h2>Progression</h2><span class="small mute">semaine ${clamp(weekOf(todayStr()), 0, 25)} sur 25</span></div>
      <div class="stats"><div class="stat"><div class="v">${fmtNum(totalKm)}<small>km</small></div><div class="k">Courus au total</div></div><div class="stat"><div class="v">${S.sessions.length}</div><div class="k">Séances importées</div></div>
      <div class="stat"><div class="v">${fmtKm(longest)}<small>km</small></div><div class="k">Plus longue sortie</div></div><div class="stat"><div class="v">${best < 1e9 ? mmss(best) : "–"}</div><div class="k">Record 10 km</div></div></div></div>
    ${levelCard()}${altimeterCard()}${recordsCard()}<div class="card"><div class="card-h"><h3>Kilomètres par semaine</h3></div><div class="chart-wrap">${weeklyChart()}</div></div>
    <div class="grid g2">${chartCard("Poids (kg)", wp, { fmt: v => (Math.round(v * 10) / 10).toString().replace(".", ","), aria: "Poids" })}
    ${chartCard("VO2max de la montre", vp, { aria: "VO2max", fmt: v => Math.round(v * 10) / 10 + "" }, "objectif : +4 à 5 points")}
    ${chartCard("Record 10 km", tp, { fmt: mmss, target: Math.round(K.t10 * 0.969), targetLabel: "cible " + mmss(Math.round(K.t10 * 0.969)), aria: "Chrono sur 10 km" }, "test prévu le 21 février")}
    ${chartCard("FC au repos (bpm)", rp, { aria: "Fréquence cardiaque au repos", fmt: v => Math.round(v) + "" })}</div>
    <div class="card"><div class="card-h"><h3>Ajouter une mesure</h3><span class="small mute">Pesez-vous le lundi matin à jeun</span></div>
      <div class="form-grid"><div class="field"><label for="fDate">Date</label><input type="date" id="fDate" data-bind="mform.date" value="${esc(f.date)}"></div><div class="field"><label for="fW">Poids (kg)</label><input type="text" inputmode="decimal" id="fW" data-bind="mform.weight" value="${esc(f.weight)}" placeholder="${esc(String(K.w0).replace(".", ","))}"></div>
      <div class="field"><label for="fV">VO2max (montre)</label><input type="text" inputmode="decimal" id="fV" data-bind="mform.vo2" value="${esc(f.vo2)}"></div><div class="field"><label for="fR">FC au repos</label><input type="text" inputmode="numeric" id="fR" data-bind="mform.rhr" value="${esc(f.rhr)}"></div>
      <div class="field"><label for="fT">Chrono 10 km (mm:ss)</label><input type="text" id="fT" data-bind="mform.tenk" value="${esc(f.tenk)}" placeholder="${esc(mmss(K.t10))}"></div></div>
      <div class="btns" style="margin-top:14px"><button class="btn primary" data-act="saveMeasure" ${!hasStore() ? "disabled" : ""}>Enregistrer</button></div>
      ${ms.length ? "" : `<p class="small mute" style="margin-top:8px">Renseignez au moins une valeur. Le poids sert à ajuster vos apports, le chrono 10 km à calculer vos prédictions.</p>`}
      ${ms.length ? `<details style="margin-top:12px"><summary class="small">Historique des mesures</summary><div class="rows" style="margin-top:8px">${ms.slice().reverse().map(m => `<div class="row" style="grid-template-columns:70px minmax(0,1fr) auto"><div class="d">${dShort(m.date)}</div><div class="mono small">${[m.weight != null ? String(m.weight).replace(".", ",") + " kg" : "", m.vo2 != null ? "VO2 " + m.vo2 : "", m.rhr != null ? "FC repos " + m.rhr : "", m.tenkSec != null ? "10 km " + mmss(m.tenkSec) : ""].filter(Boolean).join(" · ")}</div>
      <div>${S.confirmDel === m.id ? `<button class="btn danger" data-act="deleteMeasure" data-id="${esc(m.id)}">Confirmer</button>` : `<button class="btn" data-act="askDel" data-id="${esc(m.id)}">Supprimer</button>`}</div></div>`).join("")}</div></details>` : ""}</div>
    <div class="card"><div class="card-h"><h3>Bilan de la semaine par Claude</h3>${S.sample ? `<button class="btn primary" data-act="review" ${S.review.busy ? "disabled" : ""}>${S.review.busy ? "Analyse en cours…" : "Faire le bilan"}</button>` : ""}</div>
      <div class="analysis" id="revText">${S.review.busy && !S.review.text ? `<span class="spin"></span>Claude relit vos 7 derniers jours…` : (S.review.text ? mdLite(S.review.text) : `<p class="empty">Le bilan croise vos séances, vos repas et votre poids sur les 7 derniers jours et propose un ajustement.</p>`)}</div>
      ${S.review.err ? `<p class="small" style="color:var(--bad)" role="alert">${esc(S.review.err)}</p>` : ""}</div></div>`;
}

function viewData() {
  return `<div class="grid">${profileCard()}${aiKeyCard()}<div class="card"><div class="card-h"><h2>Données</h2></div>
    <p class="mute">Vos séances, repas, photos et mesures sont enregistrés sur cet appareil, dans ce navigateur : rien n'est envoyé ailleurs, sauf à l'IA quand vous lancez une analyse. Pensez à exporter une sauvegarde de temps en temps.</p>
    <div class="btns" style="margin-top:14px">${S.downloads ? `<button class="btn" data-act="exportJson">Tout exporter (JSON)</button><button class="btn" data-act="exportSessions">Séances (CSV)</button><button class="btn" data-act="exportMeals">Repas (CSV)</button><button class="btn" data-act="exportMeasures">Mesures (CSV)</button><button class="btn" data-act="exportDays">Forme du jour (CSV)</button>` : `<span class="mute small">L'export n'est pas disponible dans cette vue.</span>`}</div>
      <div class="btns" style="margin-top:12px"><label class="btn" for="restore" style="cursor:pointer">Restaurer une sauvegarde…</label><input class="sr" type="file" id="restore" accept="application/json,.json" data-change="restore"></div>
      <p class="small mute" style="margin-top:6px">La sauvegarde contient les séances (avec leur profil), repas, mesures, forme du jour et réglages. Les photos et les fichiers GPX d'origine ne sont pas inclus.</p></div>
    ${autoCard()}<div class="card"><h3 style="margin-bottom:8px">Formats pris en charge</h3><p class="mute">GPX et TCX, exportés depuis Garmin Connect, Strava, Coros, Suunto, Polar ou Apple Watch. Un fichier FIT doit d'abord être converti en GPX ou TCX.</p></div>
    <div class="card"><h3 style="margin-bottom:8px">Espace utilisé par les photos</h3><div id="usage" class="mono small">${S.usage ? `${S.usage.files} fichier(s) · ${(S.usage.bytes / 1048576).toFixed(1).replace(".", ",")} Mo sur ${Math.round(S.usage.maxBytes / 1048576)} Mo` : (S.assets ? `<button class="btn" data-act="usage">Voir l'espace utilisé</button>` : "Indisponible dans cette vue.")}</div></div></div>`;
}
