/* ------------------------------------------------------------------ version web : profil, clé d'API, sauvegarde */
const WEB = () => window.__web || { persistent: false, hasKey: () => false, keyHint: () => "", setKey() {}, clearKey() {} };
function applyProfile() {
  const p = S.profile || {};
  const n = (v, lo, hi, d) => { const x = Number(String(v == null ? "" : v).replace(",", ".")); return v != null && v !== "" && x >= lo && x <= hi ? x : d; };
  K.height = n(p.height, 120, 230, DEFK.height); K.age = n(p.age, 12, 95, DEFK.age);
  K.w0 = n(p.w0, 30, 200, DEFK.w0); K.t10 = n(p.t10, 1500, 7200, DEFK.t10);
}
function profileCard() {
  const p = S.profile || {};
  const f = (k, label, val, ph, mode) => `<div class="field"><label for="p_${k}">${label}</label><input type="text" inputmode="${mode}" id="p_${k}" data-persist="prof" data-k="${k}" value="${esc(val)}" placeholder="${esc(ph)}" autocomplete="off"></div>`;
  return `<div class="card hl"><div class="card-h"><h3>Mon profil</h3><span class="small mute">${p.setup ? "enregistré sur cet appareil" : "à renseigner"}</span></div>
    <p class="mute small" style="margin-bottom:12px">Ces valeurs règlent vos apports, vos prédictions de temps et la façon dont l'IA s'adresse à vous. Le programme et ses allures sont calibrés pour un coureur autour de 48 min au 10 km qui vise 4 h 35 sur le 42 km : adaptez les allures si votre niveau est différent.</p>
    <div class="form-grid">${f("appel", "Comment l'IA vous appelle", p.appel || "", "Prénom ou surnom", "text")}${f("height", "Taille (cm)", p.height || "", String(DEFK.height), "numeric")}${f("age", "Âge", p.age || "", String(DEFK.age), "numeric")}${f("w0", "Poids de départ (kg)", p.w0 != null ? String(p.w0).replace(".", ",") : "", String(DEFK.w0), "decimal")}${f("t10", "Record 10 km (mm:ss)", p.t10 ? mmss(p.t10) : "", mmss(DEFK.t10), "text")}</div></div>`;
}
function saveProfField(k, raw) {
  const v = String(raw || "").trim(), patch = { setup: true };
  if (k === "appel") patch.appel = v.slice(0, 40) || null;
  else if (k === "t10") {
    if (!v) patch.t10 = null;
    else { const s = parseMMSS(v); if (s == null || s < 1500 || s > 7200) { toast("Chrono au format 48:00."); later(); return; } patch.t10 = s; }
  } else {
    const x = Number(v.replace(",", "."));
    if (!v) patch[k] = null; else if (isFinite(x) && x > 0) patch[k] = x; else { toast("Valeur invalide."); later(); return; }
  }
  patchProfile(patch, true); later();
}
function aiKeyCard() {
  const w = WEB(), has = w.hasKey();
  return `<div class="card"><div class="card-h"><h3>Analyses par l'IA</h3><span class="small ${has ? "acc" : "mute"}">${has ? "activées" : "désactivées"}</span></div>
    <p class="mute small">Les analyses de séances, de repas et de photos utilisent Claude avec <b>votre propre clé d'API</b> Anthropic. Sans clé, tout le reste du carnet fonctionne. La clé reste dans ce navigateur, n'entre jamais dans vos sauvegardes et ne part que vers api.anthropic.com. Chaque analyse coûte quelques centimes au plus, facturés sur votre compte API (distinct d'un abonnement Claude).</p>
    <p class="small" style="margin-top:8px">Créer une clé : <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener">console.anthropic.com</a>, rubrique API keys, après avoir ajouté un peu de crédit.</p>
    <div class="form-grid" style="margin-top:12px"><div class="field"><label for="apikey">${has ? "Remplacer la clé" : "Coller votre clé"}</label><input type="password" id="apikey" autocomplete="off" autocapitalize="off" spellcheck="false" data-persist="apikey" placeholder="${has ? esc(w.keyHint()) : "sk-ant-…"}"></div></div>
    ${has ? `<div class="btns" style="margin-top:12px"><button class="btn sm" data-act="testKey">Tester la clé</button><button class="btn sm danger" data-act="clearKey">Retirer la clé</button></div>` : ""}</div>`;
}
async function refreshSample() {
  S.sample = await use("sample"); S.canImages = false;
  if (S.sample && S.sample.limits) { try { const l = await S.sample.limits(); S.canImages = !!(l && l.images); } catch (e) { S.canImages = false; } }
  render();
}
async function saveKey(raw) {
  const k = String(raw || "").trim(); if (!k) return;
  if (!/^sk-ant-[A-Za-z0-9_\-]{20,}$/.test(k)) { toast("Cette clé ne ressemble pas à une clé Anthropic (elle commence par sk-ant-)."); return; }
  try { WEB().setKey(k); } catch (e) { toast("Impossible d'enregistrer la clé sur cet appareil."); return; }
  await refreshSample(); toast("Clé enregistrée. Touchez « Tester la clé » pour vérifier.");
}
async function testKey() {
  if (!S.sample) { toast("Aucune clé enregistrée."); return; }
  toast("Test en cours…");
  try { await S.sample("Réponds uniquement par le mot OK.", { modelTier: "quick", cache: false }); toast("La clé fonctionne. Les analyses sont activées."); }
  catch (e) { toast(errText(e)); }
}
async function restoreBackup(file) {
  if (!file || !hasStore()) return;
  try {
    const j = JSON.parse(await file.text());
    if (!j || typeof j !== "object" || !(Array.isArray(j.sessions) || Array.isArray(j.meals) || Array.isArray(j.measures))) throw new Error("ce fichier n'est pas une sauvegarde du carnet");
    let n = 0;
    const put = async (col, arr, key) => { for (const x of (Array.isArray(arr) ? arr : [])) { if (!x || typeof x !== "object") continue; const id = String(x.id || x[key] || ""); if (!id || id.includes("/")) continue; const d = Object.assign({}, x); delete d.id; await S.base.collection(col).doc(id).set(d); n++; } };
    await put("sessions", j.sessions); await put("meals", j.meals); await put("measures", j.measures, "date"); await put("days", j.days, "date");
    if (j.profile && typeof j.profile === "object" && !Array.isArray(j.profile)) { S.profile = Object.assign({}, S.profile, j.profile); applyProfile(); await S.base.set(S.profile); }
    toast(n + " élément" + (n > 1 ? "s" : "") + " restauré" + (n > 1 ? "s" : "") + ".");
  } catch (e) { toast("Restauration impossible : " + errText(e)); }
  render();
}
function setupBanner() {
  if (!S.ready) return "";
  const out = [];
  if (hasStore() && !(S.profile && S.profile.setup)) out.push(`<div class="card hl"><div class="card-h"><h3>Bienvenue dans le carnet</h3></div><p class="mute small">Commencez par votre profil (taille, âge, poids, record 10 km) pour que les apports et les prédictions soient justes. Vos données restent sur cet appareil.</p><div class="btns" style="margin-top:12px"><button class="btn primary" data-act="goProfile">Régler mon profil</button></div></div>`);
  let hint = false; try { hint = !localStorage.getItem("ntmf-hint"); } catch (e) {}
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone = navigator.standalone === true || (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches);
  if (ios && !standalone && hint) out.push(`<div class="card plain"><h3>Installez le carnet</h3><p class="mute small" style="margin-top:6px">Dans Safari, touchez Partager puis « Sur l'écran d'accueil ». Le carnet s'ouvre alors en plein écran, comme une application, et Safari conserve vos données durablement.</p><div class="btns" style="margin-top:10px"><button class="btn sm" data-act="hideHint">C'est fait</button></div></div>`);
  if (!WEB().persistent) out.push(`<div class="card plain"><h3>Données non conservées</h3><p class="mute small" style="margin-top:6px">Ce navigateur refuse l'enregistrement durable (navigation privée ?). Ouvrez le carnet dans une fenêtre normale, sinon tout disparaîtra à la fermeture.</p></div>`);
  return out.join("");
}

