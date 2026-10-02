/* Couche autonome : fournit au carnet, dans un navigateur ordinaire, les fonctions qu'il attend
   (db, user, assets, downloads, sample). Données : IndexedDB de l'appareil. IA : API Anthropic avec
   la clé personnelle de l'utilisateur, appelée directement depuis le navigateur. */
(function () {
  "use strict";
  var DB_NAME = "ntmf42-carnet", KEY_LS = "ntmf42-api-key";
  var MODELS = { quick: "claude-haiku-4-5-20251001", "default": "claude-sonnet-5-5", complex: "claude-opus-5-5" };
  var API = "https://api.anthropic.com/v1/messages";
  var web = window.__web = { persistent: false };

  /* ---------------------------------------------------------------- stockage */
  var idb = null, mem = new Map(), blobs = new Map(), urls = new Map();
  var clone = function (o) { return o == null ? o : (typeof structuredClone === "function" ? structuredClone(o) : JSON.parse(JSON.stringify(o))); };
  function openIdb() {
    return new Promise(function (res) {
      try {
        var rq = indexedDB.open(DB_NAME, 1);
        rq.onupgradeneeded = function () { var d = rq.result; ["docs", "blobs"].forEach(function (n) { if (!d.objectStoreNames.contains(n)) d.createObjectStore(n); }); };
        rq.onsuccess = function () { res(rq.result); };
        rq.onerror = function () { res(null); };
        rq.onblocked = function () { res(null); };
      } catch (e) { res(null); }
    });
  }
  var reqP = function (rq) { return new Promise(function (ok, ko) { rq.onsuccess = function () { ok(rq.result); }; rq.onerror = function () { ko(rq.error); }; }); };
  function loadAll(store) {
    var os = idb.transaction(store, "readonly").objectStore(store);
    return Promise.all([reqP(os.getAllKeys()), reqP(os.getAll())]).then(function (r) { return r[0].map(function (k, i) { return [k, r[1][i]]; }); });
  }
  function idbOp(store, fn) {
    if (!idb) return Promise.resolve();
    return new Promise(function (ok, ko) {
      var t;
      try { t = idb.transaction(store, "readwrite"); fn(t.objectStore(store)); } catch (e) { ko(mapStoreErr(e)); return; }
      t.oncomplete = function () { ok(); };
      t.onerror = t.onabort = function () { ko(mapStoreErr(t.error)); };
    });
  }
  function mapStoreErr(e) {
    var q = e && (e.name === "QuotaExceededError" || /quota/i.test(e.message || ""));
    return { code: q ? "quota_exceeded" : "storage_error", message: q ? "Le stockage de l'appareil est plein." : "Enregistrement impossible sur cet appareil." };
  }
  web.ready = openIdb().then(function (d) {
    idb = d;
    if (!idb) return;
    return Promise.all([loadAll("docs"), loadAll("blobs")]).then(function (r) {
      r[0].forEach(function (kv) { mem.set(kv[0], kv[1]); });
      r[1].forEach(function (kv) { var v = kv[1]; if (!v || !v.buf) return; var b = new Blob([v.buf], { type: v.type || "" }); blobs.set(kv[0], { blob: b, type: v.type, size: v.size }); });
      web.persistent = true;
    });
  }).catch(function () { idb = null; });

  /* ---------------------------------------------------------------- base de documents */
  var listeners = [], dirty = new Set(), flushT = 0;
  var parentOf = function (p) { return p.slice(0, p.lastIndexOf("/")); };
  function docSnap(path) {
    var v = mem.get(path);
    return { id: path.split("/").pop(), exists: v !== undefined, data: function () { return clone(v); } };
  }
  function colSnap(path) {
    var pre = path + "/", docs = [];
    mem.forEach(function (v, k) { if (k.indexOf(pre) === 0 && k.slice(pre.length).indexOf("/") < 0) docs.push(docSnap(k)); });
    return { docs: docs, size: docs.length, empty: !docs.length, forEach: function (f) { docs.forEach(f); } };
  }
  function emit(l) { try { l.cb(l.kind === "doc" ? docSnap(l.path) : colSnap(l.path)); } catch (e) { console.error(e); } }
  function touched(path) {
    listeners.forEach(function (l) { if ((l.kind === "doc" && l.path === path) || (l.kind === "col" && l.path === parentOf(path))) dirty.add(l); });
    clearTimeout(flushT); flushT = setTimeout(function () { var ls = Array.from(dirty); dirty.clear(); ls.forEach(function (l) { if (l.on) emit(l); }); }, 0);
  }
  function listen(kind, path, cb) {
    var l = { kind: kind, path: path, cb: cb, on: true }; listeners.push(l);
    web.ready.then(function () { setTimeout(function () { if (l.on) emit(l); }, 0); });
    return function () { l.on = false; listeners = listeners.filter(function (x) { return x !== l; }); };
  }
  function write(path, val) {
    return web.ready.then(function () {
      var before = mem.get(path);
      mem.set(path, val); touched(path);
      return idbOp("docs", function (os) { os.put(val, path); }).catch(function (e) { if (before === undefined) mem.delete(path); else mem.set(path, before); touched(path); throw e; });
    });
  }
  function remove(path) {
    return web.ready.then(function () {
      mem.delete(path); touched(path);
      return idbOp("docs", function (os) { os.delete(path); });
    });
  }
  function checkData(d) { if (!d || typeof d !== "object" || Array.isArray(d)) throw { code: "invalid_argument", message: "Document invalide." }; return clone(d); }
  function docRef(path) {
    return {
      id: path.split("/").pop(), path: path,
      collection: function (n) { return colRef(path + "/" + n); },
      get: function () { return web.ready.then(function () { return docSnap(path); }); },
      set: function (d) { try { return write(path, checkData(d)); } catch (e) { return Promise.reject(e); } },
      update: function (patch) {
        return web.ready.then(function () {
          var cur = mem.get(path); if (cur === undefined) throw { code: "not_found", message: "Document introuvable." };
          var next = clone(cur), p = checkData(patch);
          Object.keys(p).forEach(function (k) {
            var parts = k.split("."), o = next;
            for (var i = 0; i < parts.length - 1; i++) { if (!o[parts[i]] || typeof o[parts[i]] !== "object") o[parts[i]] = {}; o = o[parts[i]]; }
            o[parts[parts.length - 1]] = p[k];
          });
          return write(path, next);
        });
      },
      "delete": function () { return remove(path); },
      onSnapshot: function (cb) { return listen("doc", path, cb); }
    };
  }
  function colRef(path) {
    return {
      id: path.split("/").pop(), path: path,
      doc: function (id) { return docRef(path + "/" + id); },
      get: function () { return web.ready.then(function () { return colSnap(path); }); },
      onSnapshot: function (cb) { return listen("col", path, cb); }
    };
  }
  var db = { doc: docRef, collection: colRef };

  /* ---------------------------------------------------------------- utilisateur local */
  var user = {
    id: function () { return Promise.resolve("local"); },
    me: function () { return Promise.resolve({ id: "local", name: "", guest: false }); },
    profiles: function () { return Promise.resolve({}); },
    isOwner: function () { return true; }, canEdit: function () { return true; }, can: function () { return true; }
  };

  /* ---------------------------------------------------------------- fichiers (photos, GPX) */
  var hex = function () { var a = new Uint8Array(16); crypto.getRandomValues(a); return Array.from(a, function (b) { return b.toString(16).padStart(2, "0"); }).join(""); };
  window.__blobUrl = function (id) {
    if (urls.has(id)) return urls.get(id);
    var b = blobs.get(id); if (!b) return "data:,";
    var u = URL.createObjectURL(b.blob); urls.set(id, u); return u;
  };
  var assets = {
    upload: function (blob, opts) {
      var type = blob.type || (opts && opts.type) || "application/octet-stream", id = hex();
      return blob.arrayBuffer().then(function (buf) {
        return idbOp("blobs", function (os) { os.put({ buf: buf, type: type, size: blob.size }, id); });
      }).then(function () {
        blobs.set(id, { blob: new Blob([blob], { type: type }), type: type, size: blob.size });
        return { id: id, url: window.__blobUrl(id), sizeBytes: blob.size, contentType: type };
      });
    },
    "delete": function (id) {
      if (urls.has(id)) { URL.revokeObjectURL(urls.get(id)); urls.delete(id); }
      blobs.delete(id);
      return idbOp("blobs", function (os) { os.delete(id); });
    },
    list: function () {
      var list = [], bytes = 0;
      blobs.forEach(function (b, id) { list.push({ id: id, url: window.__blobUrl(id), sizeBytes: b.size, contentType: b.type }); bytes += b.size || 0; });
      var est = (navigator.storage && navigator.storage.estimate) ? navigator.storage.estimate().catch(function () { return {}; }) : Promise.resolve({});
      return est.then(function (e) { return { assets: list, usage: { files: list.length, bytes: bytes, maxBytes: (e && e.quota) || 500 * 1048576 } }; });
    }
  };

  /* ---------------------------------------------------------------- téléchargements */
  var downloads = {
    save: function (o) {
      var name = String(o.filename || "export.txt");
      var type = /\.json$/i.test(name) ? "application/json" : /\.csv$/i.test(name) ? "text/csv" : "text/plain";
      var blob = o.data instanceof Blob ? o.data : new Blob([o.data == null ? "" : String(o.data)], { type: type + ";charset=utf-8" });
      var touch = /iPhone|iPad|iPod|Android/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
      if (touch && navigator.canShare && typeof File === "function") {
        var file = new File([blob], name, { type: type });
        if (navigator.canShare({ files: [file] })) {
          return navigator.share({ files: [file], title: name }).catch(function (e) {
            if (e && e.name === "AbortError") throw { code: "declined", message: "Annulé." };
            return anchor(blob, name);
          });
        }
      }
      return Promise.resolve(anchor(blob, name));
    }
  };
  function anchor(blob, name) {
    var u = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = u; a.download = name; a.rel = "noopener"; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(u); }, 30000);
  }

  /* ---------------------------------------------------------------- IA : API Anthropic */
  var getKey = function () { try { return localStorage.getItem(KEY_LS) || ""; } catch (e) { return ""; } };
  web.hasKey = function () { return !!getKey(); };
  web.keyHint = function () { var k = getKey(); return k ? k.slice(0, 10) + "…" + k.slice(-4) : ""; };
  web.setKey = function (k) { localStorage.setItem(KEY_LS, k); };
  web.clearKey = function () { try { localStorage.removeItem(KEY_LS); } catch (e) {} };

  function toB64(blob) { return new Promise(function (ok, ko) { var r = new FileReader(); r.onload = function () { ok(String(r.result).split(",")[1]); }; r.onerror = function () { ko(r.error); }; r.readAsDataURL(blob); }); }
  function prepImage(b) {
    var okTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    return createImageBitmap(b).then(function (bmp) {
      var max = 1568, sc = Math.min(1, max / Math.max(bmp.width, bmp.height));
      if (sc === 1 && b.size < 3.5e6 && okTypes.indexOf(b.type) >= 0) return { type: b.type, blob: b };
      var c = document.createElement("canvas"); c.width = Math.round(bmp.width * sc); c.height = Math.round(bmp.height * sc);
      c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
      return new Promise(function (ok) { c.toBlob(function (o) { ok({ type: "image/jpeg", blob: o }); }, "image/jpeg", 0.85); });
    }).catch(function () { throw { code: "image_rejected", message: "Photo illisible." }; })
      .then(function (r) { return toB64(r.blob).then(function (d) { return { type: "image", source: { type: "base64", media_type: r.type, data: d } }; }); });
  }
  function errFor(status, j) {
    var m = (j && j.error && j.error.message) || "";
    if (status === 401 || status === 403) return { code: "not_granted", message: "Clé d'API refusée. Vérifiez-la dans Carnet → Données." };
    if (status === 429) return { code: "rate_limited", message: "Trop d'appels ou crédit insuffisant. Réessayez plus tard." };
    if (status === 413) return { code: "prompt_too_large", message: "Demande trop longue." };
    if (status === 400 && /credit|balance/i.test(m)) return { code: "rate_limited", message: "Crédit API insuffisant. Ajoutez du crédit sur console.anthropic.com." };
    if (status === 400 && /image/i.test(m)) return { code: "image_rejected", message: "Cette photo n'a pas pu être lue." };
    if (status === 529 || status >= 500) return { code: "upstream_error", message: "Le service d'IA est surchargé. Réessayez dans un instant." };
    return { code: "upstream_error", message: m ? "Erreur de l'IA : " + m : "Erreur de l'IA (" + status + ")." };
  }
  function parseJsonLoose(t) {
    var s = String(t || "").trim();
    try { return { ok: true, v: JSON.parse(s) }; } catch (e) {}
    var m = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (m) { try { return { ok: true, v: JSON.parse(m[1].trim()) }; } catch (e) {} }
    var a = s.search(/[\[{]/), b = Math.max(s.lastIndexOf("}"), s.lastIndexOf("]"));
    if (a >= 0 && b > a) { try { return { ok: true, v: JSON.parse(s.slice(a, b + 1)) }; } catch (e) {} }
    return { ok: false };
  }
  function call(input, opts, asJson) {
    opts = opts || {};
    var key = getKey();
    if (!key) return Promise.reject({ code: "not_granted", message: "Aucune clé d'API enregistrée." });
    if (opts.signal && opts.signal.aborted) return Promise.reject({ code: "cancelled", message: "Annulé." });
    var turns = typeof input === "string" ? [{ role: "user", content: input }] : (Array.isArray(input) ? input.map(function (t) { return { role: t.role, content: String(t.content) }; }) : null);
    if (!turns || !turns.length || turns[turns.length - 1].role !== "user") return Promise.reject({ code: "invalid_request", message: "Demande invalide." });
    if (asJson) turns[turns.length - 1].content += "\n\nRéponds uniquement par la valeur JSON demandée, sans texte avant ni après et sans bloc de code.";
    var imgs = opts.images ? (opts.images instanceof Blob ? [opts.images] : Array.from(opts.images)) : [];
    var text = "", sent = 0, lastPush = 0, stop = null, pushT = 0;
    function push(final) {
      if (!opts.onText || text.length === sent || !text.trim()) return;
      var now = Date.now();
      if (!final && now - lastPush < 90) { clearTimeout(pushT); pushT = setTimeout(function () { push(false); }, 90); return; }
      clearTimeout(pushT); lastPush = now;
      var delta = text.slice(sent); sent = text.length;
      try { opts.onText({ text: text, delta: delta }); } catch (e) { console.error(e); }
    }
    return Promise.all(imgs.slice(0, 5).map(prepImage)).then(function (blocks) {
      var last = turns[turns.length - 1];
      if (blocks.length) last.content = blocks.concat([{ type: "text", text: last.content }]);
      return fetch(API, {
        method: "POST", signal: opts.signal,
        headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
        body: JSON.stringify({ model: MODELS[opts.modelTier] || MODELS["default"], max_tokens: 2048, stream: true, messages: turns })
      });
    }).then(function (resp) {
      if (!resp.ok) return resp.json().catch(function () { return null; }).then(function (j) { throw errFor(resp.status, j); });
      var reader = resp.body.getReader(), dec = new TextDecoder(), buf = "";
      function handle(block) {
        var data = block.split("\n").filter(function (l) { return l.indexOf("data:") === 0; }).map(function (l) { return l.slice(5).trim(); }).join("");
        if (!data) return;
        var ev; try { ev = JSON.parse(data); } catch (e) { return; }
        if (ev.type === "content_block_delta" && ev.delta && ev.delta.type === "text_delta") { text += ev.delta.text; push(false); }
        else if (ev.type === "message_delta" && ev.delta && ev.delta.stop_reason) stop = ev.delta.stop_reason;
        else if (ev.type === "error") throw errFor(ev.error && ev.error.type === "overloaded_error" ? 529 : 500, ev);
      }
      function pump() {
        return reader.read().then(function (r) {
          if (r.done) { if (buf.trim()) handle(buf); return; }
          buf += dec.decode(r.value, { stream: true }).replace(/\r\n/g, "\n");
          var i; while ((i = buf.indexOf("\n\n")) >= 0) { var b = buf.slice(0, i); buf = buf.slice(i + 2); handle(b); }
          return pump();
        });
      }
      return pump();
    }).then(function () {
      if (stop === "refusal") throw { code: "refused", message: "L'IA a refusé de répondre à cette demande." };
      if (!text.trim()) throw { code: "empty_completion", message: "L'IA n'a rien répondu. Réessayez." };
      push(true);
      var truncated = stop === "max_tokens";
      if (asJson) {
        var p = parseJsonLoose(text);
        if (!p.ok || truncated) throw { code: "invalid_json", message: "Réponse inexploitable.", text: text };
        return p.v;
      }
      return { text: text, truncated: truncated, modelTierApplied: opts.modelTier || "default" };
    }).catch(function (e) {
      clearTimeout(pushT);
      if (e && e.name === "AbortError") throw { code: "cancelled", message: "Analyse arrêtée.", text: text || undefined };
      if (e && e.code) { if (text && e.text === undefined && e.code !== "refused") e.text = text; throw e; }
      throw { code: "upstream_error", message: "Connexion à l'IA impossible. Vérifiez votre réseau.", text: text || undefined };
    });
  }
  function makeSample() {
    if (!getKey()) return null;
    var f = function (input, opts) { return call(input, opts, false); };
    f.json = function (input, opts) { return call(input, opts, true); };
    f.limits = function () { return Promise.resolve({ maxPromptBytes: 262144, images: { maxCount: 5, maxInputBytes: 20e6, mediaTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"] } }); };
    return f;
  }

  /* ---------------------------------------------------------------- point d'entrée */
  window.claude = {
    use: function (n) {
      return web.ready.then(function () {
        if (n === "db") return db;
        if (n === "user") return user;
        if (n === "assets") return assets;
        if (n === "downloads") return downloads;
        if (n === "sample") return makeSample();
        return null;
      });
    }
  };
})();
