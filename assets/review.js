/* Hydantoin Proposed Mechanisms: the Step 2 review (the ticks and notes of the step windows), kept in the site's GitHub
   repository, and signing in with GitHub to change it (window.Rv). Ported from the main study's site (annot.js).

   The review is one file, review.json, on its own branch (review) of the site's repository (config.js), so that saving
   never rebuilds the site (GitHub Pages builds main only, and at most about 10 times an hour):
     {"format": "hydantoin-minimal-review", "version": 1, "about": "...",
      "review": {"O|S10": {"scan": true, "by": "geoffreyweal", "t": "2026-11-16T22:51:54.593Z"}, ...}}
   one entry per chalcogen and step: neb / scan (the NEB / SCAN start is fine), tsp (start the NEB from the TS-guess
   path), img (the number of images of the step's NEB, chosen in its NEB start tab), note, by (GitHub login), t (when).
   The newest change of an entry wins. An entry with nothing ticked and no note
   is a step whose ticks were taken off; it is kept, so that the change reaches the other browsers.

   Anyone can read the file (raw.githubusercontent.com). To change it, sign in with GitHub: the site's own GitHub App
   ("Hydantoin Explorer Minimal sign-in"), web flow, with a random state and a PKCE challenge; the one-time code is
   swapped for a user token (about 8 hours) by a small Cloudflare Worker (config.js tokenUrl; ../signin_worker/), because
   that needs the app's client secret. The token is kept in this browser (sessionStorage, or localStorage with
   "remember"), and is sent only to api.github.com. Only people with push access to the repository can save.

   Every change is kept in this browser at once (localStorage hpm.review: the changes the repository does not have yet)
   and saved about 1.5 s after the last one, as one commit (Contents API). Changes made while signed out, or after the
   sign-in ran out, stay in this browser and are saved after the next sign-in; entries the repository already has (or
   has a newer change of) are dropped from this browser. If someone else saved in between (409/422), the file is read
   again and the newer change of each entry wins. Everything read is checked and cleaned first, and is only ever shown
   as text. Opened from the disk (file://), the page keeps the review in this browser only and talks to nothing. */
(function () {
  "use strict";
  var API = "https://api.github.com", RAW = "https://raw.githubusercontent.com", AUTHORIZE = "https://github.com/login/oauth/authorize";
  var LOCAL_KEY = "hpm.review", SESSION_KEY = "hpm.github.session", SIGNIN_KEY = "hpm.github.signin", FORMAT = "hydantoin-minimal-review";
  var LOGIN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/, KEY = /^[OS]\|S\d{1,3}[ab]?$/;
  var TIME = /^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d{1,6})?)?Z$/;
  var TOKEN = /^[A-Za-z0-9_]{20,255}$/, CODE = /^[A-Za-z0-9_-]{8,128}$/, CLIENT_ID = /^[A-Za-z0-9._-]{8,64}$/;
  var FLAGS = ["neb", "scan", "tsp"], NOTE_MAX = 300, MAX_ENTRIES = 2000, IMG_MIN = 3, IMG_MAX = 200;
  function img(x) { return typeof x === "number" && x % 1 === 0 && x >= IMG_MIN && x <= IMG_MAX ? x : 0; }
  var DEBOUNCE = 1500, RETRIES = 4, TOKEN_LIFE = 8 * 3600, SIGNIN_WAIT = 15 * 60 * 1000;
  var EXPIRED = "sign-in expired, sign in again";
  var ABOUT = "The Step 2 review of the Hydantoin Proposed Mechanisms website, written by the site when a signed-in " +
    "collaborator ticks a start: per chalcogen and step (\"O|S10\"), neb / scan = the NEB / SCAN start is fine, " +
    "tsp = start the NEB from the TS-guess path, img = the number of images of the step's NEB, note, by = GitHub login, t = when. The newest change of an entry " +
    "wins; an entry with nothing ticked and no note is one whose ticks were taken off.";
  var FILE = location.protocol === "file:";
  /* In a frame (another site showing this page): no sign-in and no stored token, so that a framing page cannot trick
     anyone into clicking buttons. */
  var FRAMED = (function () { try { return window.top !== window.self; } catch (e) { return true; } })();
  function has(o, k) { return !!o && typeof k === "string" && Object.prototype.hasOwnProperty.call(o, k); }
  function own(o) { return o && typeof o === "object" && !Array.isArray(o) ? o : {}; }
  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  function nat(a, b) { return String(a).localeCompare(String(b), "en", { numeric: true }); }

  // ------------------------------------------------------------------ where the file is, and the sign-in settings
  var CFG = (function () {
    var src = window.HPM_CONFIG || {}, c = {};
    ["owner", "repo", "branch", "file", "clientId", "tokenUrl"].forEach(function (k) { c[k] = typeof src[k] === "string" ? src[k].trim() : ""; });
    var host = /^([A-Za-z0-9-]+)\.github\.io$/i.exec(location.hostname || ""), seg = (location.pathname || "/").split("/")[1] || "";
    if (host && seg && !/\.html?$/i.test(seg)) {
      c.owner = host[1];
      try { c.repo = decodeURIComponent(seg); } catch (e) { c.repo = seg; }
    }
    c.branch = c.branch || "review";
    c.file = c.file || "review.json";
    c.ok = LOGIN.test(c.owner) && /^[A-Za-z0-9_.-]{1,100}$/.test(c.repo) && /^[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*$/.test(c.branch) &&
      /^[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*$/.test(c.file);
    c.tokenOrigin = "";
    try {
      var u = new URL(c.tokenUrl);
      if (u.protocol === "https:" && !u.username && !u.password && !u.search && !u.hash) c.tokenOrigin = u.origin;
    } catch (e) { /* not a URL: no sign-in */ }
    c.signInSet = !!(c.clientId || c.tokenUrl);
    c.signInOK = CLIENT_ID.test(c.clientId) && !!c.tokenOrigin;
    return c;
  })();
  var SHARED = CFG.ok && !FILE;       // the review is read from (and saved to) the repository
  function repoPath() { return "/repos/" + CFG.owner + "/" + CFG.repo; }
  function contentsPath() { return repoPath() + "/contents/" + CFG.file.split("/").map(encodeURIComponent).join("/"); }
  function siteUrl() { return location.origin + location.pathname.replace(/index\.html?$/i, ""); }   // = the app's callback URL
  function cspAllows(origin) {     // the page's Content-Security-Policy must let it talk to the sign-in Worker
    var meta = document.querySelector("meta[http-equiv='Content-Security-Policy']");
    if (!meta) return true;
    var m = /(?:^|;)\s*connect-src([^;]*)/i.exec(meta.getAttribute("content") || "");
    if (!m) return /(?:^|;)\s*default-src[^;]*\*/.test(meta.getAttribute("content") || "");
    return m[1].trim().split(/\s+/).some(function (t) {
      if (t === origin) return true;
      var w = /^https:\/\/\*\.([A-Za-z0-9.-]+)$/.exec(t);
      return !!w && origin.slice(-(w[1].length + 1)) === "." + w[1] && origin.indexOf("https://") === 0;
    });
  }
  function signInBlock() {         // why sign-in is not offered ("" when it is)
    if (FILE) return "opened from the disk: the review is kept in this browser only";
    if (!CFG.ok) return "no repository is set in assets/config.js";
    if (!CFG.signInSet) return "sign-in not set up yet";
    if (!CFG.signInOK) return "sign-in is not set up correctly (clientId or tokenUrl in assets/config.js)";
    if (FRAMED) return "open the site in its own tab to sign in";
    if (!(window.crypto && window.crypto.subtle && window.TextEncoder && window.history && history.replaceState)) return "sign-in needs a secure (https) page";
    if (!cspAllows(CFG.tokenOrigin)) return "sign-in not set up yet (rebuild the site after setting tokenUrl)";
    return "";
  }

  // ------------------------------------------------------------------ coming back from GitHub (?code=…&state=…)
  /* Read and remove the code from the address at once (before the page's own script reads the address): it is
     single-use and must not stay in the history. The address gets back the hash it had when "Sign in" was pressed. */
  var RETURN = (function () {
    var q;
    try { q = new URLSearchParams(location.search); } catch (e) { return null; }
    var code = q.get("code"), state = q.get("state"), err = q.get("error");
    if (!state || (!code && !err)) return null;
    var keep = null;
    try { keep = JSON.parse(sessionStorage.getItem(SIGNIN_KEY) || "null"); sessionStorage.removeItem(SIGNIN_KEY); } catch (e) { keep = null; }
    if (!keep || typeof keep !== "object" || Array.isArray(keep)) keep = null;
    ["code", "state", "error", "error_description", "error_uri"].forEach(function (k) { q.delete(k); });
    var hash = keep && typeof keep.hash === "string" && /^(#[^\s<>"]{0,2000})?$/.test(keep.hash) ? keep.hash : location.hash;
    try { history.replaceState(null, "", location.pathname + (q.toString() ? "?" + q.toString() : "") + hash); } catch (e) { /* old browser */ }
    var r = { ok: false, code: code, keep: keep, problem: "" };
    if (!keep || typeof keep.state !== "string" || keep.state !== state) r.problem = "sign-in refused: GitHub's reply does not belong to a sign-in started here (state does not match); please sign in again";
    else if (!(Date.now() - keep.at < SIGNIN_WAIT)) r.problem = "sign-in took too long: please sign in again";
    else if (err) r.problem = err === "access_denied" ? "sign-in cancelled" : "GitHub did not sign you in (" + String(err).replace(/[^a-z_]/gi, "").slice(0, 40) + ")";
    else if (!CODE.test(code || "")) r.problem = "sign-in refused: GitHub's reply has no valid code";
    else if (typeof keep.verifier !== "string" || !/^[A-Za-z0-9._~-]{43,128}$/.test(keep.verifier)) r.problem = "sign-in refused: the sign-in state is incomplete; please sign in again";
    else r.ok = true;
    return r;
  })();

  // ------------------------------------------------------------------ state
  var A = {
    token: "", exp: 0, user: null, canEdit: false, repo: null, branchOK: false,
    remote: {}, sha: null, loaded: false, loading: false, loadedAt: 0, source: "", error: "", broken: false,
    saving: false, timer: null, save: { state: "idle", msg: "" }, listeners: [], authError: "", leaving: false
  };
  function now() { return new Date().toISOString(); }
  function later(at) {             // now, but never before an earlier change of the same entry (clocks differ a little)
    var t = Date.parse(at || "");
    return new Date(Math.max(Date.now(), isNaN(t) ? 0 : t + 1)).toISOString();
  }
  function newer(a, b) { var x = Date.parse(a || ""), y = Date.parse(b || ""); return !isNaN(x) && (isNaN(y) || x > y); }
  function b64url(bytes) {
    var s = "";
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function random(n) { var a = new Uint8Array(n); window.crypto.getRandomValues(a); return a; }
  function emit() {
    A.listeners.forEach(function (f) { try { f(); } catch (e) { if (window.console) console.error(e); } });
  }

  // ------------------------------------------------------------------ checking what is read (the file can be edited by hand)
  function text(x, n) {
    return typeof x === "string" ? x.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u2028\u2029]/g, "").trim().slice(0, n) : "";
  }
  function time(x) { return typeof x === "string" && TIME.test(x) ? x : ""; }
  function cleanEntry(e, by) {     // by: keep the GitHub login (entries read from the repository)
    e = own(e);
    var r = {};
    FLAGS.forEach(function (f) { if (e[f] === true) r[f] = true; });
    var n = text(e.note, NOTE_MAX);
    if (n) r.note = n;
    if (img(e.img)) r.img = e.img;
    if (by && typeof e.by === "string" && LOGIN.test(e.by)) r.by = e.by;
    r.t = time(e.t);
    return r;
  }
  function cleanMap(m, by) {
    var out = {}, n = 0;
    m = own(m);
    Object.keys(m).forEach(function (k) { if (KEY.test(k) && n++ < MAX_ENTRIES) out[k] = cleanEntry(m[k], by); });
    return out;
  }
  function blank(e) { return !e || (!e.neb && !e.scan && !e.tsp && !e.note && !e.img); }
  function parseDoc(t) {
    if (!String(t).trim()) return {};               // an empty file: nothing yet
    var j, err;
    try { j = JSON.parse(t); } catch (e) {
      err = new Error(CFG.file + " on the " + CFG.branch + " branch is not valid JSON, so nothing can be saved until it is fixed");
      err.broken = true;
      throw err;
    }
    j = own(j);
    if (j.format !== undefined && j.format !== FORMAT) {
      err = new Error(CFG.file + " on the " + CFG.branch + " branch is not a Step 2 review file, so nothing can be saved until it is fixed");
      err.broken = true;
      throw err;
    }
    return cleanMap(j.review, true);
  }
  function serialise(map) {
    var rev = {};
    Object.keys(map).sort(nat).forEach(function (k) {
      var e = map[k], o = {};
      ["by", "img", "neb", "note", "scan", "t", "tsp"].forEach(function (f) { if (e[f]) o[f] = e[f]; });
      rev[k] = o;
    });
    return JSON.stringify({ about: ABOUT, format: FORMAT, review: rev, version: 1 }, null, 1) + "\n";
  }

  // ------------------------------------------------------------------ this browser's changes the repository does not have yet
  /* Read from localStorage each time (it is small; parsed again only when another tab or a save changed it), so that
     two tabs of the site never undo each other's changes. When the browser keeps no storage, they live in this page. */
  var MEM = null, cacheRaw, cacheMap = {}, localOK = true;
  function localMap() {
    if (MEM) return MEM;
    var raw;
    try { raw = localStorage.getItem(LOCAL_KEY); } catch (e) { MEM = {}; localOK = false; return MEM; }
    if (raw !== cacheRaw) {
      var m = {};
      try { m = cleanMap(JSON.parse(raw || "{}"), false); } catch (e) { m = {}; }
      cacheRaw = raw; cacheMap = m;
    }
    return cacheMap;
  }
  function writeLocal(m) {
    if (MEM) { MEM = m; return; }
    var raw = JSON.stringify(m);
    try { localStorage.setItem(LOCAL_KEY, raw); cacheRaw = raw; cacheMap = m; localOK = true; } catch (e) { MEM = m; localOK = false; }
  }
  function pick(k) {               // what the page shows for an entry: this browser's change if it is newer than the file's
    var l = localMap(), le = has(l, k) ? l[k] : null, re = has(A.remote, k) ? A.remote[k] : null;
    if (le && (!re || newer(le.t, re.t))) return { e: le, saved: false };
    return re ? { e: re, saved: true } : null;
  }
  function dirty() {               // this browser's changes that the repository does not have
    var l = localMap();
    return Object.keys(l).filter(function (k) { return !has(A.remote, k) || newer(l[k].t, A.remote[k].t); });
  }
  function prune() {               // drop the changes the repository has, or has a newer change of
    if (!A.loaded) return;
    var l = localMap(), out = null;
    Object.keys(l).forEach(function (k) {
      var re = has(A.remote, k) ? A.remote[k] : null;
      if ((re && !newer(l[k].t, re.t)) || (blank(l[k]) && blank(re))) { out = out || clone(l); delete out[k]; }
    });
    if (out) writeLocal(out);
  }
  function keysOf(ch) {            // the steps of a chalcogen with something ticked or a note
    var seen = {}, out = [];
    Object.keys(A.remote).concat(Object.keys(localMap())).forEach(function (k) {
      if (seen[k] || k.split("|")[0] !== ch) return;
      seen[k] = true;
      var p = pick(k);
      if (p && !blank(p.e)) out.push(k.split("|")[1]);
    });
    return out.sort(nat);
  }
  function entry(ch, sid) {        // {neb, scan, tsp, note, by, t, saved}, or {} for a step nobody ticked
    var p = pick(ch + "|" + sid);
    if (!p || blank(p.e)) return {};
    var e = {};
    Object.keys(p.e).forEach(function (f) { e[f] = p.e[f]; });
    e.saved = p.saved;
    return e;
  }
  function keep(m, k, e) {         // put an entry among this browser's changes (or drop it: nothing to take off anywhere)
    if (blank(e) && A.loaded && blank(has(A.remote, k) ? A.remote[k] : null)) delete m[k];
    else m[k] = e;
  }
  function changed() {
    if (A.user && A.canEdit && A.loaded) schedule();
    emit();
  }
  function set(ch, sid, f, v) {
    var k = ch + "|" + sid;
    if (!KEY.test(k) || (FLAGS.indexOf(f) < 0 && f !== "note" && f !== "img")) return false;
    var p = pick(k), e = {}, m = clone(localMap());
    if (p) FLAGS.concat(["note", "img"]).forEach(function (x) { if (p.e[x]) e[x] = p.e[x]; });
    if (f === "note") { var n = text(v, NOTE_MAX); if (n) e.note = n; else delete e.note; }
    else if (f === "img") { if (img(v)) e.img = v; else delete e.img; }      // the NEB's images (0 / null: the project's)
    else if (v) {                    // one Step 2 choice per step: ticking one takes the other two off
      FLAGS.forEach(function (x) { delete e[x]; });
      e[f] = true;
    }
    else delete e[f];
    e.t = later(p ? p.e.t : "");
    keep(m, k, e);
    writeLocal(m);
    changed();
    return true;
  }
  function clear(ch) {             // take off every tick and note of a chalcogen
    var m = clone(localMap()), ids = keysOf(ch);
    ids.forEach(function (sid) { var k = ch + "|" + sid, p = pick(k); keep(m, k, { t: later(p ? p.e.t : "") }); });
    writeLocal(m);
    changed();
    return ids.length;
  }
  function importReview(R) {       // entries of a downloaded file: each one taken if it is newer than what the page has
    var m = clone(localMap()), n = 0;
    Object.keys(own(R)).forEach(function (k) {
      if (!KEY.test(k)) return;
      var e = cleanEntry(R[k], false), p = pick(k);
      if (p ? newer(e.t, p.e.t) : !blank(e)) { keep(m, k, e); n++; }
    });
    writeLocal(m);
    changed();
    return n;
  }
  function all() {                 // every entry with something ticked or a note (what Download saves)
    var out = {}, keys = Object.keys(A.remote).concat(Object.keys(localMap())).sort(nat);
    keys.forEach(function (k) {
      var p = pick(k);
      if (has(out, k) || !p || blank(p.e)) return;
      out[k] = {};
      ["neb", "scan", "tsp", "img", "note", "by", "t"].forEach(function (f) { if (p.e[f]) out[k][f] = p.e[f]; });
    });
    return out;
  }

  // ------------------------------------------------------------------ the token (never leaves this browser except to api.github.com)
  function storages() { var out = []; try { out.push(sessionStorage); } catch (e) { /* blocked */ } try { out.push(localStorage); } catch (e) { /* blocked */ } return out; }
  function readSession() {
    if (FRAMED || FILE) return null;
    var got = null;
    storages().forEach(function (st) {
      try {
        var s = JSON.parse(st.getItem(SESSION_KEY) || "null");
        if (!got && s && typeof s.t === "string" && TOKEN.test(s.t) && typeof s.exp === "number") got = s;
      } catch (e) { /* unreadable: ignored */ }
    });
    return got;
  }
  function writeSession(t, exp, remember) {
    forgetSession();
    try { (remember ? localStorage : sessionStorage).setItem(SESSION_KEY, JSON.stringify({ t: t, exp: exp })); }
    catch (e) { /* storage blocked: signed in for this page only */ }
  }
  function forgetSession() { storages().forEach(function (st) { try { st.removeItem(SESSION_KEY); } catch (e) { /* none */ } }); }
  function expire() {              // GitHub no longer takes the token (it expired or was revoked)
    forgetSession();
    A.token = ""; A.exp = 0; A.user = null; A.canEdit = false; A.repo = null;
    A.authError = EXPIRED;
    emit();
  }

  // ------------------------------------------------------------------ GitHub REST API
  function api(method, path, body) {
    if (!/^\/[A-Za-z0-9_.\/%?=&,-]*$/.test(path)) return Promise.reject(new Error("bad API path"));
    var h = { Accept: "application/vnd.github+json" }, sent = A.token;
    if (sent) h.Authorization = "Bearer " + sent;
    if (body !== undefined) h["Content-Type"] = "application/json";
    return fetch(API + path, { method: method, headers: h, cache: "no-store", credentials: "omit", referrerPolicy: "no-referrer",
                               body: body === undefined ? undefined : JSON.stringify(body) })
      .then(function (r) {
        return r.text().then(function (t) {
          var j = null;
          try { j = t ? JSON.parse(t) : null; } catch (e) { j = null; }
          if (!r.ok) {
            if (r.status === 401 && sent && sent === A.token) expire();
            var msg = j && typeof j.message === "string" ? j.message.slice(0, 200) : "HTTP " + r.status;
            var err = new Error(r.status === 401 && sent ? EXPIRED : msg);
            err.status = r.status;
            throw err;
          }
          return j;
        });
      });
  }
  function b64encode(str) {
    var bytes = new TextEncoder().encode(str), bin = "";
    for (var i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }
  function b64decode(b64) {
    var bin = atob(String(b64).replace(/\s/g, "")), bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  // ------------------------------------------------------------------ reading and writing review.json
  function fetchRemote() {
    if (A.token) {
      return api("GET", contentsPath() + "?ref=" + encodeURIComponent(CFG.branch)).then(function (j) {
        A.branchOK = true;
        if (!j || Array.isArray(j) || typeof j.sha !== "string" || !/^[0-9a-f]{40,64}$/.test(j.sha)) throw new Error(CFG.file + " is not a file");
        var got = j.encoding === "base64" && j.content ? Promise.resolve(b64decode(j.content)) :
          api("GET", repoPath() + "/git/blobs/" + j.sha).then(function (b) { return b64decode(b.content); });
        return got.then(function (t) { return { doc: parseDoc(t), sha: j.sha }; });
      }, function (e) {
        if (e.status === 404) return { doc: {}, sha: null };          // no branch or no file yet: nothing yet
        throw e;
      });
    }
    var url = RAW + "/" + CFG.owner + "/" + CFG.repo + "/" + CFG.branch + "/" + CFG.file;
    return fetch(url, { cache: "no-cache", credentials: "omit", referrerPolicy: "no-referrer" })
      .then(function (r) {
        if (r.status === 404) return null;
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.text();
      })
      .then(function (t) { return { doc: t === null ? {} : parseDoc(t), sha: null }; });
  }
  function load() {
    if (!SHARED) {                   // from the disk, or no repository set: this browser only
      A.loaded = true; A.source = FILE ? "file" : "";
      if (!CFG.ok && !FILE) A.error = "no repository is set in assets/config.js";
      prune(); emit();
      return Promise.resolve();
    }
    A.loading = true;
    emit();
    return fetchRemote().then(function (r) {
      A.remote = r.doc; A.sha = r.sha; A.loaded = true; A.loadedAt = Date.now(); A.broken = false; A.error = "";
      A.source = A.token ? "api" : "raw"; A.loading = false;
      prune();
      emit();
    }, function (e) {
      A.loading = false; A.error = e.message || String(e);
      if (e.broken) A.broken = true;
      if (e.status === 401) return load();                 // the sign-in ran out while reading: read as a visitor
      emit();
    });
  }
  function ensureBranch() {        // the review branch (made from the default branch if someone deleted it)
    if (A.branchOK) return Promise.resolve();
    var br = encodeURIComponent(CFG.branch).replace(/%2F/g, "/");
    return api("GET", repoPath() + "/branches/" + br).then(function () { A.branchOK = true; }, function (e) {
      if (e.status !== 404) throw e;
      var base = (A.repo && typeof A.repo.default_branch === "string" && A.repo.default_branch) || "main";
      return api("GET", repoPath() + "/git/ref/heads/" + encodeURIComponent(base).replace(/%2F/g, "/")).then(function (ref) {
        return api("POST", repoPath() + "/git/refs", { ref: "refs/heads/" + CFG.branch, sha: ref.object.sha });
      }).then(null, function (e2) { if (e2.status !== 422) throw e2; })   // 422: someone made it in the meantime
        .then(function () { A.branchOK = true; });
    });
  }
  function setSave(st, msg) { A.save = { state: st, msg: msg || "" }; emit(); }
  function schedule() {
    clearTimeout(A.timer);
    var n = dirty().length;
    if (n && !A.saving) A.save = { state: "pending", msg: n + " unsaved change" + (n > 1 ? "s" : "") };
    A.timer = setTimeout(save, DEBOUNCE);
  }
  function describe(keys, batch, login) {      // the commit message
    var parts = keys.map(function (k) {
      var e = batch[k], q = k.split("|"), what = [e.neb ? "NEB" : "", e.scan ? "SCAN" : "", e.tsp ? "TS path" : ""].filter(Boolean).join(" + ");
      var extra = (e.img ? " + " + e.img + " images" : "") + (e.note ? " + note" : "");
      return q[0] + " " + q[1] + " " + (what ? what + extra : extra ? extra.slice(3) : "cleared");
    });
    var out = "Step 2 review by @" + login + ": ";
    for (var i = 0; i < parts.length; i++) {
      if (i && (out + parts[i]).length > 160) { out += ", \u2026 (+" + (parts.length - i) + " more)"; break; }
      out += (i ? ", " : "") + parts[i];
    }
    return out;
  }
  function save() {
    clearTimeout(A.timer);
    if (A.saving || !A.user || !A.loaded) return Promise.resolve();
    var keys = dirty();
    if (!keys.length) { prune(); if (A.save.state === "pending") setSave("idle", ""); return Promise.resolve(); }
    if (!A.canEdit) { setSave("error", "@" + A.user.login + " has no push access to " + CFG.owner + "/" + CFG.repo + ": the ticks stay in this browser"); return Promise.resolve(); }
    if (A.broken) { setSave("error", A.error); return Promise.resolve(); }
    var l = localMap(), batch = {}, tries = 0, login = A.user.login;
    keys.forEach(function (k) { batch[k] = clone(l[k]); });
    A.saving = true;
    setSave("saving", "saving\u2026");
    function attempt() {
      var d = clone(A.remote), put = [];
      keys.forEach(function (k) {               // the newer change of each entry wins
        if (has(d, k) && !newer(batch[k].t, d[k].t)) return;
        var e = { by: login };
        FLAGS.concat(["note", "img", "t"]).forEach(function (f) { if (batch[k][f]) e[f] = batch[k][f]; });
        d[k] = e;
        put.push(k);
      });
      if (!put.length) return Promise.resolve(d);            // the repository has them all already
      var body = { message: describe(put, batch, login), content: b64encode(serialise(d)), branch: CFG.branch };
      if (A.sha) body.sha = A.sha;
      return ensureBranch().then(function () { return api("PUT", contentsPath(), body); }).then(function (r) {
        A.sha = r && r.content && typeof r.content.sha === "string" ? r.content.sha : A.sha;
        return d;
      }, function (e) {
        if ((e.status === 409 || e.status === 422) && tries < RETRIES) {      // someone saved in between: read, merge, retry
          tries++;
          return fetchRemote().then(function (r) { A.remote = r.doc; A.sha = r.sha; return attempt(); });
        }
        throw e;
      });
    }
    return attempt().then(function (d) {
      A.remote = d; A.saving = false; A.loadedAt = Date.now();
      prune();
      setSave("saved", "saved");
      if (dirty().length) schedule();
    }, function (e) {
      A.saving = false;
      if (e.broken) { A.broken = true; A.error = e.message; }
      var msg = e.status === 401 ? EXPIRED + " (your ticks are kept in this browser and saved after you sign in)" :
        e.status === 409 || e.status === 422 ? CFG.file + " kept changing on GitHub while saving; press retry (GitHub: " + e.message + ")" :
        e.status === 403 || e.status === 404 ? "GitHub refused the save (" + e.message + "); is the site's GitHub App installed on " + CFG.repo + " with Contents: Read and write?" :
        (e.message || String(e)) + " (your ticks are kept in this browser)";
      setSave("error", msg);
    });
  }

  // ------------------------------------------------------------------ signing in and out
  function verify(t) {
    A.token = t;
    return api("GET", "/user").then(function (u) {
      if (!u || !LOGIN.test(u.login || "")) throw new Error("GitHub did not say who is signed in");
      A.user = { login: u.login, name: text(u.name, 100) };
      return api("GET", repoPath()).then(function (r) {
        A.repo = r || {};
        A.canEdit = !!(r && r.permissions && r.permissions.push);
      }, function (e) {
        if (e.status !== 404) throw e;
        A.repo = {}; A.canEdit = false;
      });
    }).then(null, function (e) {
      if (A.token === t) { A.token = ""; A.user = null; A.canEdit = false; }
      throw e;
    });
  }
  /* "Sign in with GitHub": a random state and a PKCE verifier are kept in this tab, then the browser goes to GitHub */
  function startSignIn(remember) {
    var why = signInBlock();
    if (why) return Promise.reject(new Error(why));
    var kept = { state: b64url(random(24)), verifier: b64url(random(32)), hash: location.hash || "", remember: !!remember, at: Date.now() };
    return window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(kept.verifier)).then(function (h) {
      try { sessionStorage.setItem(SIGNIN_KEY, JSON.stringify(kept)); } catch (e) { throw new Error("this browser does not let the page keep the sign-in state (storage blocked)"); }
      A.leaving = true;
      location.assign(AUTHORIZE + "?client_id=" + encodeURIComponent(CFG.clientId) + "&redirect_uri=" + encodeURIComponent(siteUrl()) +
                      "&state=" + encodeURIComponent(kept.state) + "&code_challenge=" + b64url(new Uint8Array(h)) + "&code_challenge_method=S256");
    });
  }
  /* back from GitHub with a code: the Worker swaps it (with the verifier, and the address GitHub sent us back to) for a
     user token */
  function exchange(code, verifier) {
    return fetch(CFG.tokenUrl, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
                                 body: JSON.stringify({ code: code, code_verifier: verifier, redirect_uri: siteUrl() }), cache: "no-store",
                                 credentials: "omit", referrerPolicy: "no-referrer", mode: "cors" })
      .then(function (r) {
        return r.text().then(function (t) {
          var j = null;
          try { j = JSON.parse(t); } catch (e) { j = null; }
          if (!r.ok || !j || typeof j.access_token !== "string") {
            throw new Error(j && typeof j.error === "string" ? j.error.replace(/[^A-Za-z_]/g, "").slice(0, 60) : "the sign-in service answered HTTP " + r.status);
          }
          if (!TOKEN.test(j.access_token) || (j.token_type !== undefined && !/^bearer$/i.test(String(j.token_type)))) throw new Error("the sign-in service did not return a GitHub token");
          var life = typeof j.expires_in === "number" && j.expires_in > 0 ? Math.min(j.expires_in, TOKEN_LIFE) : TOKEN_LIFE;
          return { token: j.access_token, exp: Date.now() + life * 1000 };
        });
      });
  }
  function finishSignIn(r) {
    return exchange(r.code, r.keep.verifier).then(function (tok) {
      return verify(tok.token).then(function () {
        A.exp = tok.exp;
        writeSession(tok.token, tok.exp, r.keep.remember);
        A.authError = "";
        A.branchOK = false;
      });
    }).then(null, function (e) {
      A.token = ""; A.user = null; A.canEdit = false;
      A.authError = "sign-in failed: " + (e.message || e);
    });
  }
  function signOut() {             // the ticks not saved yet stay in this browser
    clearTimeout(A.timer);
    forgetSession();
    A.token = ""; A.exp = 0; A.user = null; A.canEdit = false; A.repo = null; A.branchOK = false; A.authError = "";
    setSave("idle", "");
    return load();
  }
  function init() {
    var started;
    if (RETURN && RETURN.ok && !signInBlock()) started = finishSignIn(RETURN);
    else {
      if (RETURN) A.authError = RETURN.ok ? signInBlock() : RETURN.problem;
      var s = readSession();
      if (s && s.exp <= Date.now()) { forgetSession(); s = null; A.authError = A.authError || EXPIRED; }
      started = s && SHARED ? verify(s.t).then(function () { A.exp = s.exp; }, function (e) {
        if (e.status !== 401) A.authError = "could not check the sign-in with GitHub (" + (e.message || e) + ")";
      }) : Promise.resolve();
    }
    return started.then(load).then(function () { if (A.user && A.canEdit && dirty().length) schedule(); emit(); });
  }
  setInterval(function () { if (A.token && A.exp && Date.now() > A.exp) expire(); }, 60000);   // the token runs out after ~8 h
  window.addEventListener("storage", function (e) {     // another tab of the site changed the review
    if (e.key !== LOCAL_KEY && e.key !== null) return;
    if (A.user && A.canEdit && A.loaded && dirty().length) schedule();
    emit();
  });
  document.addEventListener("visibilitychange", function () {
    if (!SHARED) return;
    if (document.visibilityState === "hidden") {                 // leaving the tab: save what is waiting now
      if (A.user && A.canEdit && A.loaded && !A.saving && dirty().length) save();
      return;
    }
    if (!A.loaded && !A.loading) { load(); return; }              // the file could not be read earlier: try again
    if (!A.saving && !dirty().length && Date.now() - A.loadedAt > 60000) load();   // pick up the others' changes
  });

  // ------------------------------------------------------------------ what the page asks
  window.Rv = {
    cfg: CFG, init: init, signIn: startSignIn, signOut: signOut, saveNow: save,
    onChange: function (f) { A.listeners.push(f); },
    entry: entry, set: set, clear: clear, keys: keysOf, importReview: importReview, all: all,
    get unsaved() { return dirty().length; }, get storedLocally() { return localOK; },
    get shared() { return SHARED; }, get fileMode() { return FILE; },
    get user() { return A.user; }, get hasPush() { return !!(A.user && A.canEdit); },
    get canEdit() { return !!(A.user && A.canEdit && A.loaded); }, get loaded() { return A.loaded; },
    get loading() { return !!A.loading; }, get error() { return A.error; }, get broken() { return A.broken; },
    get authError() { return A.authError || ""; }, get signInNote() { return signInBlock(); }, get signInReady() { return !signInBlock(); },
    get leaving() { return A.leaving; }, get source() { return A.source; }, get saveState() { return A.save; },
    get saving() { return A.saving; }, get expires() { return A.exp; }, get loadedAt() { return A.loadedAt; }
  };
})();
