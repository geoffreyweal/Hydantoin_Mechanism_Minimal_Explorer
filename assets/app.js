/* Hydantoin Proposed Mechanisms: the proposed mechanisms of the two mechflow projects (Ch_O, Ch_S), each family in an
   A version (-> P1a) and a B version (-> P1b), their species and steps, structures in 3D and the TS guesses. A static page: it reads only this site's own files
   (data/*.js, loaded as scripts so that it also works from file://) and talks to nothing else. */
(function () {
  "use strict";
  var S = { ch: "O", tab: "mech", mech: null, zoom: null, top: 100, mts3d: false, ts3d: false, energy: false, elevel: "sp", ezoom: null, nenergy: false, senergy: false };   // TS pictures: mechanism view, step windows
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };
  var CHN = { O: "urea", S: "thiourea" };
  var TABS = ["mech", "net", "species", "steps", "about"];
  var NODRAW = "No drawing for this step yet: rebuild the website (make_website.py) to draw it.";

  (function prefs() {                    // per-viewer conveniences only
    try {
      var p = JSON.parse(localStorage.getItem("hpm.prefs") || "{}");
      S.mts3d = p.mts3d === true; S.ts3d = p.ts3d === true; S.energy = p.energy === true; if (p.elevel === "sp" || p.elevel === "dft") S.elevel = p.elevel;
      S.nenergy = p.nenergy === true; S.senergy = p.senergy === true;
    } catch (e) { /* no storage */ }
  })();
  function savePrefs() {
    try { localStorage.setItem("hpm.prefs", JSON.stringify({ mts3d: S.mts3d, ts3d: S.ts3d, energy: S.energy, elevel: S.elevel, nenergy: S.nenergy, senergy: S.senergy })); } catch (e) { /* no storage */ }
  }

  /* the build tag of this page (app.js?v=...), added to the data files loaded later so that a new build is never mixed
     with files the browser kept from an old one */
  var VER = (function () {
    var cs = document.currentScript, m = cs && /[?&]v=([0-9A-Za-z]+)/.exec(cs.src);
    return m ? m[1] : "";
  })();
  // ------------------------------------------------------------------ data files loaded on demand (works from file://)
  function load(kind, ch, id) {
    return new Promise(function (res, rej) {
      var key = kind + "/" + ch + "/" + id;
      if (__cache[key] !== undefined) { res(__cache[key]); return; }
      (__wait[key] = __wait[key] || []).push(res);
      if (__wait[key].length > 1) return;
      var s = document.createElement("script");
      s.src = "data/" + kind + "/" + ch + "/" + encodeURIComponent(id) + ".js" + (VER ? "?v=" + VER : "");
      s.onerror = function () { delete __wait[key]; rej(new Error("no data for " + key)); };
      document.head.appendChild(s);
    });
  }
  function M() { return META.ch[S.ch]; }
  /* IDs can come from the address (#m=...), so they are looked up only as own properties */
  function has(o, k) { return !!o && typeof k === "string" && Object.prototype.hasOwnProperty.call(o, k); }
  function baseMech(id, ch) { var m = META.ch[ch || S.ch].mechanisms; return has(m, id) ? m[id] : null; }
  function baseStep(id, ch) { var m = META.ch[ch || S.ch].steps; return has(m, id) ? m[id] : null; }
  function baseSpecies(id, ch) { var m = META.ch[ch || S.ch].species; return has(m, id) ? m[id] : null; }
  function xyzOf(id, ch) { var x = XYZ[ch || S.ch]; return has(x, id) ? x[id] : null; }
  function esc(t) {
    return String(t).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; });
  }
  function nat(a, b) { return String(a).localeCompare(String(b), "en", { numeric: true }); }
  function chText(t) {
    var O = S.ch === "O";
    return String(t).replace(/iso\(thio\)urea/g, O ? "isourea" : "isothiourea").replace(/\(thio\)urea/g, O ? "urea" : "thiourea")
      .replace(/\(thio\)hydantoin/g, O ? "hydantoin" : "thiohydantoin").replace(/O\/S/g, O ? "O" : "S")
      .replace(/imino-azolidin/g, O ? "imino-oxazolidin" : "imino-thiazolidin");
  }

  // ------------------------------------------------------------------ the TS pictures: 2D sketch or 3D guess
  /* Two separate choices, each remembered: the mechanism view (the switch above the drawing, S.mts3d) and the step
     windows (the switch in a step's window, S.ts3d: it changes that window, and new windows open the same way). */
  function pressed(buttons, which) {
    buttons.forEach(function (b) { var on = (b.dataset.tsm || b.dataset.ts) === which; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on ? "true" : "false"); });
  }
  function applyMechTS() {
    $("#mechview").classList.toggle("ts-2d", !S.mts3d);
    pressed($$(".tsmode button"), S.mts3d ? "3d" : "2d");
  }
  function setMechTS(three) { S.mts3d = !!three; savePrefs(); applyMechTS(); }
  function stepTS(box, sw) {                 // one step window's diagram: its TS as the 2D sketch or the 3D guess
    box.classList.toggle("show3d", S.ts3d && !!box.querySelector(".ts3d"));
    pressed($$("button", sw), S.ts3d ? "3d" : "2d");
  }

  // ------------------------------------------------------------------ xyz helpers
  function frames(txt) {
    var L = txt.split(/\r?\n/), out = [], k = 0;
    while (k < L.length && L[k].trim()) {
      var n = parseInt(L[k], 10), at = [];
      for (var i = 0; i < n; i++) {
        var p = L[k + 2 + i].trim().split(/\s+/);
        at.push({ el: p[0], x: +p[1], y: +p[2], z: +p[3] });
      }
      out.push({ comment: L[k + 1], atoms: at });
      k += n + 2;
    }
    return out;
  }
  function keyAtoms(comment) {
    var out = {}, m = /key atoms:(.*)$/.exec(comment || "");
    if (!m) return out;
    m[1].split(",").forEach(function (part) { var q = part.trim().split(/\s+/); if (q.length === 2) out[+q[0]] = q[1]; });
    return out;
  }
  function toXYZ(f, dx) {
    return f.atoms.length + "\n" + (f.comment || "") + "\n" + f.atoms.map(function (a) {
      return a.el + " " + (a.x + (dx || 0)).toFixed(5) + " " + a.y.toFixed(5) + " " + a.z.toFixed(5);
    }).join("\n") + "\n";
  }

  // ------------------------------------------------------------------ floating windows
  function makeWin(title, sub, w) {
    var d = document.createElement("div");
    d.className = "win";
    var n = $$(".win").length;
    d.style.left = Math.max(8, Math.min(80 + 32 * n, window.innerWidth - 420)) + "px";
    d.style.top = Math.max(8, Math.min(70 + 26 * n, window.innerHeight - 300)) + "px";
    d.style.width = Math.min(w || 820, window.innerWidth - 40) + "px";
    d.style.maxHeight = (window.innerHeight - 40) + "px";
    d.style.zIndex = ++S.top;
    d.innerHTML = "<div class='bar'><b>" + esc(title) + "</b><span class='t'>" + esc(sub || "") + "</span><button title='Close'>&times;</button></div><div class='body'></div>";
    $("#windows").appendChild(d);
    $(".bar button", d).onclick = function () { d.remove(); };
    d.addEventListener("mousedown", function () { d.style.zIndex = ++S.top; });
    var bar = $(".bar", d), sx, sy, ox, oy;
    bar.addEventListener("pointerdown", function (e) {
      if (e.target.tagName === "BUTTON") return;
      sx = e.clientX; sy = e.clientY; ox = d.offsetLeft; oy = d.offsetTop; bar.setPointerCapture(e.pointerId);
      bar.onpointermove = function (ev) { d.style.left = (ox + ev.clientX - sx) + "px"; d.style.top = Math.max(0, oy + ev.clientY - sy) + "px"; };
      bar.onpointerup = function () { bar.onpointermove = null; };
    });
    return $(".body", d);
  }
  document.addEventListener("keydown", function (e) {      // Escape closes the window on top
    if (e.key !== "Escape") return;
    var wins = $$(".win");
    if (!wins.length) return;
    wins.sort(function (a, b) { return (+b.style.zIndex || 0) - (+a.style.zIndex || 0); })[0].remove();
  });
  function viewer3d(el) {
    if (!window.$3Dmol) { el.textContent = "The 3D viewer (assets/3Dmol-min.js) is missing from this copy of the site."; throw new Error("3Dmol.js is not loaded"); }
    return window.$3Dmol.createViewer(el, { backgroundColor: "white" });
  }
  function styleAll(v, mode) {
    if (mode === "line") v.setStyle({}, { line: { colorscheme: "Jmol" } });
    else if (mode === "spacefill") v.setStyle({}, { sphere: { colorscheme: "Jmol" } });
    else v.setStyle({}, { stick: { radius: 0.13, colorscheme: "Jmol" }, sphere: { scale: 0.24, colorscheme: "Jmol" } });
  }

  // ------------------------------------------------------------------ species in 3D
  function openMol(ids) {
    ids = ids.filter(function (s) { return xyzOf(s) && baseSpecies(s); });
    if (!ids.length) return;
    var title = ids.join(" + ");
    var names = ids.map(function (s) { return chText(baseSpecies(s).name); }).join(" + ");
    var body = makeWin(title, names + "  (" + CHN[S.ch] + ")", 640);
    body.innerHTML = "<div class='v3d'></div><div class='tools'><button data-a='labels'>Key atoms</button>" +
      "<button data-a='ball'>Ball &amp; stick</button><button data-a='line'>Lines</button><button data-a='spacefill'>Space-filling</button>" +
      "<span class='note'>drag to turn, scroll to zoom</span></div><div class='info'></div>";
    var v = viewer3d($(".v3d", body)), dx = 0, labels = [], show = false;
    ids.forEach(function (sid) {
      var f = frames(xyzOf(sid))[0], xs = f.atoms.map(function (a) { return a.x; });
      var shift = dx - Math.min.apply(null, xs);
      v.addModel(toXYZ(f, shift), "xyz");
      var ka = keyAtoms(f.comment);
      Object.keys(ka).forEach(function (i) { var a = f.atoms[+i]; labels.push([ka[i], a.x + shift, a.y, a.z]); });
      dx += (Math.max.apply(null, xs) - Math.min.apply(null, xs)) + 3.5;
    });
    styleAll(v, "ball"); v.zoomTo(); v.render();
    $(".tools", body).addEventListener("click", function (e) {
      var a = e.target.dataset.a; if (!a) return;
      if (a === "labels") {
        show = !show; v.removeAllLabels();
        if (show) labels.forEach(function (l) { v.addLabel(l[0], { position: { x: l[1], y: l[2], z: l[3] }, fontSize: 11, fontColor: "black", backgroundColor: "white", backgroundOpacity: 0.75, inFront: true }); });
      } else styleAll(v, a);
      v.render();
    });
    $(".info", body).innerHTML = ids.map(function (sid) {
      var sp = baseSpecies(sid), used = sp.used_by.length;
      return "<div><b>" + esc(sid) + "</b> " + esc(chText(sp.name)) + " &middot; " + esc(sp.formula) + " &middot; " +
        (used ? "in " + used.toString() + (used === 1 ? " mechanism" : " mechanisms") + " (" + sp.used_by.map(esc).join(", ") + ")" :
          sp.start_of.length ? "SCAN start of " + sp.start_of.map(esc).join(", ") : "in no mechanism") +
        " &middot; <a href='xyz/species/Ch_" + S.ch + "/" + encodeURIComponent(sid) + ".xyz' download>xyz</a></div>";
    }).join("") + "<div class='note'>Starting structures (force field), not DFT. Open an xyz file in ASE with <code>ase gui " + esc(ids[0]) + ".xyz</code>.</div>";
  }

  // ------------------------------------------------------------------ a step: diagram, 3D path (IDPP / ASE NEB), info
  function openStep(sid, dir) {
    var ch = S.ch, st = baseStep(sid, ch);
    if (!st) return;
    var rev = dir === "rev" && !!st.rev;          // the step as a mechanism uses it backwards: drawn and played that way
    dir = rev ? "rev" : "fwd";
    var body = makeWin(sid + (rev ? " (backwards)" : ""), (rev ? "reverse of: " : "") + chText(st.name) + "  (" + CHN[ch] + ")", 900);
    body.innerHTML = "<div class='tabs'><button data-p='d' class='on'>Diagram</button><button data-p='p'>3D: TS guess and path</button>" +
      (st.dft.length ? "<button data-p='q'>3D: DFT</button>" : "") + "<button data-p='i'>Details</button></div>" +
      "<div class='pane on' data-p='d'><div class='seg evswitch' role='group' aria-label='Step or energy diagram' hidden><button data-ev='0'>Step</button>" +
      "<button data-ev='1'>Energy</button></div> <div class='seg tsswitch' role='group' aria-label='TS picture' hidden><button data-ts='2d'>2D</button>" +
      "<button data-ts='3d'>3D</button></div><div class='svgbox'>loading&hellip;</div></div>" +
      "<div class='pane' data-p='p'><div class='v3d'></div><div class='tools'><button data-a='play'>&#9654; Play</button>" +
      "<input type='range' min='0' max='1' value='0' aria-label='image'><span class='fr'></span><button data-a='ts'>TS guess</button>" +
      "<button data-a='labels'>Key atoms</button><a download>path .xyz (ase gui)</a></div>" +
      "<div class='info note'>IDPP path (ASE NEB) between the two sides of the step" + (rev ? ", played backwards" : "") +
      "; TS guess: the image whose scanned distance is nearest a typical TS value. Not a DFT result: <code>ase gui " + esc(sid) + "_path.xyz</code></div></div>" +
      (st.dft.length ? "<div class='pane' data-p='q'><div class='v3d'></div><div class='tools'><input type='range' min='0' value='0'><span class='fr'></span></div></div>" : "") +
      "<div class='pane' data-p='i'><div class='info'></div></div>";
    var tabs = $(".tabs", body);
    tabs.addEventListener("click", function (e) {
      var p = e.target.dataset.p; if (!p) return;
      $$(".tabs button", body).forEach(function (b) { b.classList.toggle("on", b.dataset.p === p); });
      $$(".pane", body).forEach(function (b) { b.classList.toggle("on", b.dataset.p === p); });
      if (p === "p") showPath(); if (p === "q") showDFT();
    });
    // the TS above the arrow: the 2D sketch (.ts2d) or the 3D TS guess (.ts3d), when the drawing has both
    var dBox = $(".pane[data-p=d] .svgbox", body), sw = $(".pane[data-p=d] .tsswitch", body);
    sw.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-ts]"); if (!b) return;
      S.ts3d = b.dataset.ts === "3d"; savePrefs(); stepTS(dBox, sw);     // this window (and new ones); not the mechanism view
    });
    /* Step | Energy: the step's drawing, or its two sides and TS on bars at their energies (its own choice, remembered) */
    var ev = $(".pane[data-p=d] .evswitch", body), stepSvg = null;
    function drawStep() {
      if (stepSvg === null) return;
      var se = levels(ch).length ? stepEnergy(ch, sid, dir) : null;
      ev.hidden = !se;
      $$("button", ev).forEach(function (b) { var on = (b.dataset.ev === "1") === (S.senergy && !!se); b.classList.toggle("on", on); b.setAttribute("aria-pressed", on ? "true" : "false"); });
      if (S.senergy && se) {
        var v = stepEnergyView(stepSvg, sid, dir, ch);
        if (v.msg) dBox.innerHTML = v.msg; else { dBox.innerHTML = ""; dBox.appendChild(v.svg); }
      } else dBox.innerHTML = stepSvg;
      sw.hidden = !(dBox.querySelector(".ts3d") && dBox.querySelector(".ts2d"));
      stepTS(dBox, sw);
    }
    body.closest(".win").redrawEnergy = drawStep;
    ev.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-ev]"); if (!b) return;
      S.senergy = b.dataset.ev === "1"; savePrefs(); drawStep();
    });
    if (st.drawn === false) dBox.textContent = NODRAW;
    else load("step", ch, sid + "_" + dir).then(function (svg) {
      stepSvg = svg; drawStep();
    }).catch(function () { dBox.textContent = "No drawing for this step."; });
    var mechs = st.used_by.filter(function (m) { return baseMech(m, ch); });
    var reaction = rev ? st.reaction.split(" -> ").reverse().join(" -> ") : st.reaction;
    $(".pane[data-p=i] .info", body).innerHTML = "<p><b>Reaction" + (rev ? " (backwards)" : "") + ":</b> " + esc(reaction) +
      (rev ? " <span class='note'>(reverse of " + esc(st.reaction) + ")</span>" : "") + "</p>" +
      "<p><b>SCAN in mechflow:</b> atoms " + st.scan.atoms.join(", ") + " (from <a data-mol='" + esc(st.start) + "'>" + esc(st.start) + "</a>), " +
      (st.scan.mode === "stretch" ? "stretched" : "brought together") + " from " + st.scan.d0 + " to " + st.scan.to + " &Aring;.</p><p><b>Used by:</b> " +
      (mechs.length ? mechs.map(function (m) { return "<a data-m='" + esc(m) + "'>" + esc(m) + "</a>"; }).join(", ") : "no mechanism") + "</p>" +
      "<p class='note'>DFT results appear here after the calculations, once the website is rebuilt.</p>";
    $(".pane[data-p=i] .info", body).addEventListener("click", function (e) {
      if (e.target.dataset.m) { setTab("mech"); showMech(e.target.dataset.m); }
      if (e.target.dataset.mol) openMol([e.target.dataset.mol]);
    });

    var pv = null;
    function showPath() {
      if (pv) return;
      if (st.path === false) { pv = true; $(".pane[data-p=p]", body).innerHTML = "<div class='info'>No TS guess or path for this step yet (make_paths.py, then rebuild the website).</div>"; return; }
      load("path", ch, sid).then(function (P) {
        var pane = $(".pane[data-p=p]", body), fr = frames(P.xyz), n = fr.length, v = viewer3d($(".v3d", pane));
        pv = v;
        v.addModelsAsFrames(P.xyz, "xyz"); styleAll(v, "ball"); v.zoomTo();
        /* position k on the slider shows frame at(k): backwards, from the step's right side to its left side */
        var at = function (k) { return rev ? n - 1 - k : k; }, tsFrame = typeof P.ts === "number" ? P.ts : 0;
        var slider = $("input[type=range]", pane), lab = $(".fr", pane), k = at(tsFrame), timer = null, labels = false;
        var ka = keyAtoms((xyzOf(st.start, ch) || "").split(/\r?\n/)[1]), d = Array.isArray(P.d) ? P.d : [];
        slider.max = n - 1;
        $("a[download]", pane).href = "xyz/ts_guesses/Ch_" + ch + "/" + encodeURIComponent(sid) + "_path.xyz";
        function draw() {
          var j = at(k), f = fr[j];
          Promise.resolve(v.setFrame(j)).then(function () {
            v.removeAllShapes(); v.removeAllLabels();
            (P.changed || []).forEach(function (pr) {
              var a = f.atoms[pr[0]], b = f.atoms[pr[1]];
              if (a && b) v.addCylinder({ start: { x: a.x, y: a.y, z: a.z }, end: { x: b.x, y: b.y, z: b.z }, radius: 0.08, color: st.colour, dashed: true, fromCap: 1, toCap: 1 });
            });
            if (labels) Object.keys(ka).forEach(function (i) { var a = f.atoms[+i]; if (a) v.addLabel(ka[i], { position: { x: a.x, y: a.y, z: a.z }, fontSize: 11, fontColor: "black", backgroundColor: "white", backgroundOpacity: 0.75, inFront: true }); });
            v.render();
          });
          slider.value = k;
          lab.textContent = "image " + k + "/" + (n - 1) + (j === tsFrame ? "  (TS guess)" : "") + (typeof d[j] === "number" ? "  d = " + d[j].toFixed(2) + " Å" : "");
        }
        draw();
        slider.oninput = function () { k = +slider.value; draw(); };
        $(".tools", pane).addEventListener("click", function (e) {
          var a = e.target.dataset.a;
          if (a === "ts") { k = at(tsFrame); draw(); }
          if (a === "labels") { labels = !labels; draw(); }
          if (a === "play") {
            if (timer) { clearInterval(timer); timer = null; e.target.innerHTML = "&#9654; Play"; return; }
            e.target.innerHTML = "&#10073;&#10073; Pause";
            timer = setInterval(function () { if (!document.body.contains(pane)) { clearInterval(timer); return; } k = (k + 1) % n; draw(); }, Math.max(60, Math.round(4000 / n)));
          }
        });
      }).catch(function () { $(".pane[data-p=p]", body).innerHTML = "<div class='info'>No path for this step.</div>"; });
    }
    function showDFT() {
      load("dft", ch, sid).then(function (D) {
        var pane = $(".pane[data-p=q]", body), v = viewer3d($(".v3d", pane)), txt = D.irc || D.ts;
        v.addModelsAsFrames(txt, "xyz"); styleAll(v, "ball"); v.zoomTo(); v.render();
        var fr = frames(txt), slider = $("input[type=range]", pane);
        slider.max = fr.length - 1;
        slider.oninput = function () { Promise.resolve(v.setFrame(+slider.value)).then(function () { v.render(); }); $(".fr", pane).textContent = (D.irc ? "IRC image " : "TS ") + slider.value; };
      }).catch(function () { $(".pane[data-p=q]", body).textContent = "No DFT structure for this step."; });
    }
  }

  // ------------------------------------------------------------------ mechanisms tab
  function query() { return ($("#q").value || "").trim().toLowerCase(); }
  function famList() {                // one entry per family, with a button for its A (-> P1a) and its B (-> P1b) version
    var q = query(), mm = M().mechanisms, F = META.families, major = META.major[S.ch], out = "", byFam = {};
    Object.keys(mm).sort(nat).forEach(function (mid) { var f = mm[mid].family || mid; (byFam[f] = byFam[f] || []).push(mid); });
    var fams = Object.keys(byFam).sort(nat).filter(function (f) {
      var info = F[f] || {}, words = f + " " + (info.title || "") + " " + (info.text || "") + " " +
        byFam[f].map(function (mid) { return mid + " " + mm[mid].name + " " + mm[mid].product + " " + mm[mid].steps.join(" "); }).join(" ");
      return !q || chText(words).toLowerCase().indexOf(q) >= 0;
    });
    out += "<div class='group'><h3>Proposed mechanisms (" + esc(CHN[S.ch]) + ")</h3>";
    fams.forEach(function (f) {
      var info = F[f] || {}, ms = byFam[f], on = ms.indexOf(S.mech) >= 0;
      out += "<div class='fam" + (on ? " on" : "") + "' data-first='" + esc(ms[0]) + "'><span class='id'>" + esc(f) + "</span><span class='txt'>" +
        esc(chText(info.title || mm[ms[0]].name)) + "</span><div class='txt more'>" + esc(chText(info.text || "")) + "</div><div class='ab'>" +
        ms.map(function (mid) {
          var m = mm[mid], v = mid.slice(f.length) || mid, ver = (info.versions || {})[v] || "";
          return "<button data-m='" + esc(mid) + "' class='" + (S.mech === mid ? "on" : "") + "' title='" + esc(mid + ": " + chText(m.name)) + "'>" +
            "<b>" + esc(v) + "</b> &rarr; " + esc(m.product) + " <span class='iso'>(" + esc(META.iso[m.product] || "") + ")</span>" +
            (m.product === major ? "<span class='bdg obs' title='the isomer observed as the major product with the " + esc(CHN[S.ch]) + "'>observed major</span>" : "") +
            (ver ? "<span class='ver'>" + esc(chText(ver)) + "</span>" : "") + "</button>";
        }).join("") + "</div></div>";
    });
    if (!fams.length) out += "<div class='hint'>No mechanism matches.</div>";
    out += "</div><div class='famnote'>" + esc(META.note[S.ch]) + " A = Cy on the same side as Ph (P1a, 1-Cy-3-Me); B = Cy on the other side (P1b, 1-Me-3-Cy).</div>";
    $("#famlist").innerHTML = out;
  }
  function firstMech() { return Object.keys(M().mechanisms).sort(nat)[0] || null; }
  function showMech(mid) {
    var mm = baseMech(mid), ch = S.ch;
    S.mech = mm ? mid : null; famList();
    $("#mechtitle").textContent = mm ? mid + ": " + chText(mm.name) + "  (" + CHN[ch] + ")" : "";
    if (!mm) { $("#mechview").innerHTML = "<div class='hint'>Pick a mechanism on the left.</div>"; return; }
    if (mm.drawn === false) { $("#mechview").innerHTML = "<div class='hint'>No drawing of this mechanism yet: rebuild the website (make_website.py) to draw it.</div>"; return; }
    $("#mechview").innerHTML = "<div class='hint'>loading&hellip;</div>";
    applyView();
    load("mech", ch, mid).then(function (svg) {
      if (S.mech !== mid || S.ch !== ch) return;
      if (S.energy) {
        var ev = energyView(svg, mid, ch);
        if (ev.msg) { $("#mechview").innerHTML = ev.msg; return; }
        $("#mechview").innerHTML = ""; $("#mechview").appendChild(ev.svg);
      } else $("#mechview").innerHTML = svg;
      zoom(zoomNow() || "fit"); applyMechTS();
    }, function () {
      if (S.mech !== mid || S.ch !== ch) return;
      $("#mechview").innerHTML = "<div class='hint'>No drawing of this mechanism yet: rebuild the website (make_website.py) to draw it.</div>";
    });
  }
  /* The drawing and the energy diagram keep their own zoom (S.zoom, S.ezoom). Fit fits a drawing to the width, and an
     energy diagram - one long row of states and TSs - to the height, so its structures stay readable: scroll along it. */
  function zoomNow() { return S.energy ? S.ezoom : S.zoom; }
  function zoom(z) {
    var svg = $("#mechview svg"); if (!svg) return;
    var w0 = +svg.getAttribute("width") || svg.viewBox.baseVal.width, h0 = +svg.getAttribute("height") || svg.viewBox.baseVal.height;
    if (!svg.dataset.w) { svg.dataset.w = w0; svg.dataset.h = h0; }
    var W = +svg.dataset.w, H = +svg.dataset.h, cur = svg.getBoundingClientRect().width / W, f, energy = svg.classList.contains("energy");
    var cw = $("#mechview").clientWidth, chh = $("#mechview").clientHeight;
    if (z === "fit" && (cw < 50 || (energy && chh < 50))) { setTimeout(function () { zoom("fit"); }, 60); return; }
    if (z === "fit") f = energy ? Math.min((chh - 22) / H, (cw - 4) / W * 40) : (cw - 4) / W;
    else if (z === "+") f = cur * 1.25; else if (z === "-") f = cur / 1.25; else f = +z;
    svg.setAttribute("width", W * f); svg.setAttribute("height", H * f);
    var keep = z === "+" || z === "-" ? f : z;
    if (energy) S.ezoom = keep; else S.zoom = keep;
  }

  // ------------------------------------------------------------------ energies (the View: Energy switches)
  /* ENERGY[ch] (data/energy.js, written by make_website.py from mechflow collect's results* folders): per level (sp: the
     single points such as DLPNO-CCSD(T) on the DFT structures, dft: the DFT free energies) the Gibbs free energies of
     every mechanism's states and TSs in path order (rows: [kind, state, G]). Three views use them: a mechanism as an
     energy diagram, a step (in its window) as one, and the Network tab's energy landscape. The diagrams take the
     drawings' own pieces - structures with their curly arrows, TS pictures - and put them on bars at their energies. */
  var SVGNS = "http://www.w3.org/2000/svg", FONT = "Helvetica, Arial, sans-serif";
  function levels(ch) { var E = window.ENERGY && window.ENERGY[ch]; return E ? Object.keys(E).filter(function (k) { return E[k] && E[k].mech; }) : []; }
  function curLevel(ch) { var L = levels(ch); return L.indexOf(S.elevel) >= 0 ? S.elevel : (L[0] || null); }
  function energySet(ch) { var k = curLevel(ch); return k ? window.ENERGY[ch][k] : null; }
  function energyOf(ch, mid) { var E = energySet(ch); return E && E.mech && has(E.mech, mid) ? E.mech[mid] : null; }
  function splitRows(P) {
    return { mins: P.rows.filter(function (r) { return r[0] !== "ts"; }), tss: P.rows.filter(function (r) { return r[0] === "ts"; }) };
  }
  function fitsSteps(P, steps) {      // the profile has the mechanism's steps (and one more state than steps), in order
    var R = splitRows(P);
    return R.tss.length === steps.length && R.mins.length === steps.length + 1 &&
           steps.every(function (s, k) { return R.tss[k][1] === "TS" + s.slice(1); });
  }
  function levelBoxes() {
    var L = levels(S.ch), cur = curLevel(S.ch);
    $$(".levelmode").forEach(function (box) {
      box.innerHTML = L.map(function (k) {
        var E = window.ENERGY[S.ch][k];
        return "<button data-level='" + esc(k) + "' class='" + (k === cur ? "on" : "") + "' aria-pressed='" + (k === cur) + "' title='" + esc(E.level || k) + "'>" + esc(E.label || k) + "</button>";
      }).join("");
    });
    $(".mlevelmode").hidden = $(".mlevellabel").hidden = !(S.energy && L.length);
    $(".nlevelmode").hidden = $(".nlevellabel").hidden = !(S.nenergy && L.length);
  }
  function applyView() {
    $$(".viewmode button").forEach(function (b) { var on = (b.dataset.view === "energy") === S.energy; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on ? "true" : "false"); });
    $$(".nviewmode button").forEach(function (b) { var on = (b.dataset.nview === "energy") === S.nenergy; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on ? "true" : "false"); });
    levelBoxes();
    $(".zoombar button[data-z=fit]").title = S.energy ? "Fit to the height (scroll along the diagram)" : "Fit to width";
  }
  function setView(energy) { S.energy = !!energy; savePrefs(); applyView(); if (S.mech) showMech(S.mech); }
  function setNetView(energy) { S.nenergy = !!energy; savePrefs(); applyView(); net.ch = null; showNet(); if (S.tab === "net") netFit(); }
  function setLevel(k) {
    S.elevel = k; savePrefs(); applyView();
    if (S.mech && S.energy) showMech(S.mech);
    if (S.nenergy) { net.ch = null; showNet(); if (S.tab === "net") netFit(); }
    $$(".win").forEach(function (w) { if (w.redrawEnergy) w.redrawEnergy(); });
  }
  function el(tag, attrs, text) {
    var e = document.createElementNS(SVGNS, tag);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    if (text != null) e.textContent = text;
    return e;
  }
  function txt(x, y, s, size, weight, fill, anchor) {
    return el("text", { x: x.toFixed(1), y: y.toFixed(1), "font-family": FONT, "font-size": size, "font-weight": weight || "normal",
                        fill: fill || "#111", "text-anchor": anchor || "middle" }, s);
  }
  function fmtG(g) { return g == null ? "?" : (Math.round(g * 10) / 10).toFixed(1); }
  function sgnG(g) { return g == null ? "?" : (g >= 0 ? "+" : "−") + Math.abs(Math.round(g * 10) / 10).toFixed(1); }
  function niceStep(range) {
    var raw = range / 6, p = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10)), f = raw / p;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
  }
  function withDrawing(svgText, fn) {  // the drawing laid out off screen, so that its pieces can be measured (and taken)
    var holder = document.createElement("div");
    holder.style.cssText = "position:absolute;left:-100000px;top:0;visibility:hidden";
    document.body.appendChild(holder);
    try {
      var live = document.importNode(new DOMParser().parseFromString(svgText, "image/svg+xml").documentElement, true);
      holder.appendChild(live);
      return fn(live);
    } finally { holder.remove(); }
  }
  function box(g) { var b = g.getBBox(); return { x: b.x, y: b.y, w: b.width, h: b.height }; }
  function tsPictures(parent) {        // the 2D and 3D TS pictures, measured (the hidden one shown for a moment)
    return Array.prototype.slice.call(parent.querySelectorAll(".tsimg, .ts-pic")).map(function (im) {
      var hid = im.getAttribute("display"); im.removeAttribute("display");
      var b = box(im);
      if (hid) im.setAttribute("display", hid);
      im.removeAttribute("transform");
      return { el: im, x: b.x, y: b.y, w: b.w, h: b.h };
    });
  }
  function fillMissing(cols) {         // a state or TS with no energy yet sits between its neighbours, dashed
    cols.forEach(function (c, n) {
      if (c.g != null) { c.gy = c.g; return; }
      var a = null, b = null, q;
      for (q = n - 1; q >= 0 && a === null; q--) if (cols[q].g != null) a = cols[q].g;
      for (q = n + 1; q < cols.length && b === null; q++) if (cols[q].g != null) b = cols[q].g;
      c.gy = a !== null && b !== null ? (a + b) / 2 : (a !== null ? a : b); c.missing = true;
    });
  }
  function axis(out, AX, yOf, gmin, gmax, unit, xEnd) {
    var step = niceStep(gmax - gmin), ax = el("g", { "class": "axis" });
    ax.appendChild(el("line", { x1: AX, x2: AX, y1: (yOf(gmax) - 14).toFixed(1), y2: (yOf(gmin) + 14).toFixed(1), stroke: "#444", "stroke-width": 1.5 }));
    for (var v = Math.ceil(gmin / step) * step; v <= gmax + 1e-9; v += step) {
      var yy = yOf(v);
      ax.appendChild(el("line", { x1: AX - 6, x2: AX, y1: yy.toFixed(1), y2: yy.toFixed(1), stroke: "#444", "stroke-width": 1.5 }));
      ax.appendChild(txt(AX - 10, yy + 5, String(Math.round(v * 10) / 10), 14, "normal", "#333", "end"));
      if (Math.abs(v) < 1e-9) ax.appendChild(el("line", { x1: AX, x2: xEnd, y1: yy.toFixed(1), y2: yy.toFixed(1), stroke: "#d0d0d0", "stroke-width": 1, "stroke-dasharray": "3 5" }));
    }
    var ymid = (yOf(gmax) + yOf(gmin)) / 2, lab = txt(AX - 66, ymid, "ΔG / " + unit, 16, "bold", "#333", "middle");
    lab.setAttribute("transform", "rotate(-90 " + (AX - 66) + " " + ymid.toFixed(1) + ")");
    ax.appendChild(lab);
    out.appendChild(ax);
  }
  /* A row of states and TSs: cols = [{kind: "min", g, el, box, label, note} | {kind: "ts", g, imgs, label, colour, step,
     dir, lim, cls}, ...]; each picture sits on its bar, bars at their energies, dashed lines between them. */
  function energyRow(head, cols, unit, span) {
    var KS = 0.8, KT = 0.8, PAD = 10, GAP = 44, AX = 104, TOP = 40 + 22 * head.length;
    cols.forEach(function (c) {
      if (c.kind === "min") { c.w = Math.max(c.box.w * KS, 96) + 2 * PAD; c.up = c.box.h * KS + 12; c.down = c.note ? 62 : 46; }
      else {
        var iw = 60, ih = 20;
        c.imgs.forEach(function (m) { iw = Math.max(iw, m.w); ih = Math.max(ih, m.h); });
        c.w = Math.max(iw * KT, 92) + 2 * PAD; c.up = ih * KT + 12; c.down = c.lim ? 78 : 62;
      }
    });
    fillMissing(cols);
    var gs = cols.map(function (c) { return c.gy; }), gmax = Math.max.apply(null, gs), gmin = Math.min.apply(null, gs);
    if (gmax - gmin < 20) { var m0 = (gmax + gmin) / 2; gmax = m0 + 10; gmin = m0 - 10; }
    var ppu = Math.min((span || 560) / (gmax - gmin), 12), shift = TOP;
    cols.forEach(function (c) { c.y0 = (gmax - c.gy) * ppu; shift = Math.max(shift, TOP + c.up - c.y0); });
    var yOf = function (g) { return (gmax - g) * ppu + shift; };
    var x = AX + 30;
    cols.forEach(function (c) { c.y = yOf(c.gy); c.x = x; x += c.w + GAP; });
    var W = Math.round(x - GAP + 40), H = 0;
    cols.forEach(function (c) { H = Math.max(H, c.y + c.down); });
    H = Math.round(Math.max(H, yOf(gmin) + 30) + 24);
    var out = el("svg", { xmlns: SVGNS, width: W, height: H, viewBox: "0 0 " + W + " " + H, "class": "energy" });
    out.appendChild(el("rect", { width: "100%", height: "100%", fill: "white" }));
    head.forEach(function (h, k) { out.appendChild(txt(40, 40 + (k ? 4 + 21 * k : 0), h[0], h[1], h[2] || "normal", h[3] || "#222", "start")); });
    axis(out, AX, yOf, gmin, gmax, unit, W - 20);
    for (var j = 0; j + 1 < cols.length; j++) {
      var a = cols[j], b = cols[j + 1];
      out.appendChild(el("line", { x1: (a.x + a.w - PAD).toFixed(1), y1: a.y.toFixed(1), x2: (b.x + PAD).toFixed(1), y2: b.y.toFixed(1),
                                   stroke: "#9a9a9a", "stroke-width": 1.6, "stroke-dasharray": "6 4", "class": "conn" }));
    }
    var lastMin = null;
    cols.forEach(function (c) {
      var cx = c.x + c.w / 2, colr = c.kind === "ts" ? c.colour : "#111";
      var bar = el("line", { x1: (c.x + PAD).toFixed(1), x2: (c.x + c.w - PAD).toFixed(1), y1: c.y.toFixed(1), y2: c.y.toFixed(1),
                             stroke: c.missing ? "#aaaaaa" : colr, "stroke-width": 3.5, "stroke-linecap": "round",
                             "class": "lvl " + c.kind, "data-g": c.g == null ? "" : String(c.g) });
      if (c.missing) bar.setAttribute("stroke-dasharray", "7 5");
      if (c.kind === "min") {
        c.el.setAttribute("transform", "translate(" + (cx - (c.box.x + c.box.w / 2) * KS).toFixed(1) + "," + (c.y - 8 - (c.box.y + c.box.h) * KS).toFixed(1) + ") scale(" + KS + ")");
        out.appendChild(c.el); out.appendChild(bar);
        out.appendChild(txt(cx, c.y + 22, c.label, 16, "bold"));
        out.appendChild(txt(cx, c.y + 40, c.missing ? "not yet" : fmtG(c.g), 14, "normal", c.missing ? "#999" : "#333"));
        if (c.note) out.appendChild(txt(cx, c.y + 56, c.note, 12.5, "normal", "#666"));
        if (!c.missing) lastMin = c.g;
        return;
      }
      var wrap = el("g", c.step ? { "class": c.cls || "lk", "data-step": c.step, "data-dir": c.dir } : { "class": "tsbar" });
      wrap.appendChild(el("rect", { "class": "hit", x: c.x.toFixed(1), y: (c.y - c.up).toFixed(1), width: c.w.toFixed(1), height: (c.up + c.down - 8).toFixed(1), fill: "transparent" }));
      c.imgs.forEach(function (m) {
        var pos = el("g", { transform: "translate(" + (cx - (m.x + m.w / 2) * KT).toFixed(1) + "," + (c.y - 8 - (m.y + m.h) * KT).toFixed(1) + ") scale(" + KT + ")" });
        pos.appendChild(m.el); wrap.appendChild(pos);
      });
      wrap.appendChild(bar);
      wrap.appendChild(txt(cx, c.y + 22, c.label, 16, "bold", c.colour));
      wrap.appendChild(txt(cx, c.y + 40, c.missing ? "not yet" : fmtG(c.g), 14, "normal", c.missing ? "#999" : "#333"));
      if (!c.missing && lastMin !== null) wrap.appendChild(txt(cx, c.y + 56, "ΔG‡ " + fmtG(c.g - lastMin), 12.5, "normal", "#666"));
      if (c.lim) wrap.appendChild(txt(cx, c.y + 72, "rate-limiting", 12.5, "bold", "#b42318"));
      out.appendChild(wrap);
    });
    return out;
  }
  var HOW = " The energies come from <code>mechflow collect</code>: copy each project's <code>results*</code> folders back from " +
            "the cluster and run <code>make_website.py --energies-only</code> (see About).";
  function energyView(svgText, mid, ch) {     // a mechanism as an energy diagram (View: Energy above the drawings)
    var E = energySet(ch), P = energyOf(ch, mid), back = " <b>View: Mechanism</b> shows the drawing.";
    if (!E) return { msg: "<div class='hint'>No energies for the " + esc(CHN[ch]) + " yet." + HOW + back + "</div>" };
    if (!P) return { msg: "<div class='hint'>No " + esc(E.label) + " energies for " + esc(mid) + " (" + esc(CHN[ch]) + ") yet." + HOW + back + "</div>" };
    var R = splitRows(P);
    if (R.mins.every(function (r) { return r[2] == null; }) && R.tss.every(function (r) { return r[2] == null; }))
      return { msg: "<div class='hint'>None of the states of " + esc(mid) + " (" + esc(CHN[ch]) + ") has an energy yet." + HOW + back + "</div>" };
    return withDrawing(svgText, function (live) {
      var kids = Array.prototype.slice.call(live.children);
      var sps = kids.filter(function (g) { return g.matches("g.sp"); }), lks = kids.filter(function (g) { return g.matches("g.lk"); });
      var steps = lks.map(function (g) { return g.getAttribute("data-step"); });
      if (sps.length !== R.mins.length || !fitsSteps(P, steps))
        return { msg: "<div class='hint'>The energies of " + esc(mid) + " (" + esc(CHN[ch]) + ") do not match its drawing: they " +
                      "are from another version of the project. Run <code>mechflow collect</code> again and rebuild the energies.</div>" };
      var cols = [];
      sps.forEach(function (g, k) {
        cols.push({ kind: "min", g: R.mins[k][2], el: g, box: box(g), label: (g.getAttribute("data-ids") || "").split(" ").join(" + ") });
        if (k < lks.length) {
          var lk = lks[k], stroke = lk.querySelector("g[stroke]");
          cols.push({ kind: "ts", g: R.tss[k][2], imgs: tsPictures(lk), label: R.tss[k][1], colour: stroke ? stroke.getAttribute("stroke") : "#707070",
                      step: lk.getAttribute("data-step"), dir: lk.getAttribute("data-dir"), lim: !!P.limiting && P.limiting === R.tss[k][1] });
        }
      });
      var head = [["Gibbs free energy diagram of " + mid + " (" + CHN[ch] + "), " + E.label, 26, "bold", "#111"],
                  [E.reference || ("Gibbs free energies in " + E.units + " relative to the reactants."), 15],
                  [(E.level ? "Energies: " + E.level + ". " : "") + "From mechflow collect (" + E.source + ", " + E.date + ")." +
                   (P.validated === false ? " Not every step is validated yet (mechflow status)." : ""), 13, "normal", "#666"]];
      return { svg: energyRow(head, cols, E.units || "kJ/mol") };
    });
  }
  /* A step's energies, from a mechanism that has it: the mechanism shown if it does, else one with all three energies,
     else one that uses it the same way round (one that uses it backwards gives them swapped). The energies of the
     whole states are the same in every mechanism, as they are balanced against the same reference. */
  function stepEnergy(ch, sid, dir) {
    var E = energySet(ch), mm = META.ch[ch].mechanisms, best = null;
    if (!E) return null;
    Object.keys(mm).sort(nat).forEach(function (mid) {
      var m = mm[mid], P = E.mech[mid], k = m.steps.indexOf(sid);
      if (!P || k < 0 || !fitsSteps(P, m.steps)) return;
      var R = splitRows(P), same = (m.dirs ? m.dirs[k] : "fwd") === dir, a = R.mins[k][2], b = R.mins[k + 1][2];
      var cand = { same: same, mech: mid, ts: R.tss[k][2], label: R.tss[k][1], left: same ? a : b, right: same ? b : a };
      cand.score = (mid === S.mech ? 8 : 0) + (a != null && b != null && cand.ts != null ? 4 : 0) + (same ? 2 : 0);
      if (!best || cand.score > best.score) best = cand;
    });
    return best;
  }
  function stepEnergyView(svgText, sid, dir, ch) {
    var E = energySet(ch), se = stepEnergy(ch, sid, dir), st = baseStep(sid, ch);
    if (!E) return { msg: "<div class='hint'>No energies for the " + esc(CHN[ch]) + " yet." + HOW + "</div>" };
    if (!se) return { msg: "<div class='hint'>No " + esc(E.label) + " energies for " + esc(sid) + " yet." + HOW + "</div>" };
    return withDrawing(svgText, function (live) {
      var sides = Array.prototype.slice.call(live.querySelectorAll("g.sd"));
      if (sides.length !== 2) return { msg: "<div class='hint'>This step's drawing is from an older build of the site: rebuild it (make_website.py).</div>" };
      var colour = (st && st.colour) || "#707070", lab = function (g) { return (g.getAttribute("data-ids") || "").split(" ").join(" + "); };
      var dr = se.left != null && se.right != null ? se.right - se.left : null;
      var cols = [{ kind: "min", g: se.left, el: sides[0], box: box(sides[0]), label: lab(sides[0]) },
                  { kind: "ts", g: se.ts, imgs: tsPictures(live), label: se.label, colour: colour },
                  { kind: "min", g: se.right, el: sides[1], box: box(sides[1]), label: lab(sides[1]),
                    note: dr == null ? "" : "ΔG " + sgnG(dr) + (se.ts != null ? ", back ΔG‡ " + fmtG(se.ts - se.right) : "") }];
      var head = [[sid + (dir === "rev" ? " (backwards)" : "") + ", " + E.label, 22, "bold", colour],
                  ["ΔG‡ " + (se.ts != null && se.left != null ? fmtG(se.ts - se.left) : "?") + ", ΔG " + sgnG(dr) + " " + (E.units || "kJ/mol") +
                   " (energies of the whole states in " + se.mech + (se.same ? "" : ", where it runs the other way") + ")", 14]];
      var svg = energyRow(head, cols, E.units || "kJ/mol", 300);
      svg.classList.add("step");
      return { svg: svg };
    });
  }
  /* The Network tab's energies: every state (box) and step (TS) from the routes - each route is a mechanism, so its
     profile gives its boxes and TSs in order - and each route's highest TS. */
  function netEnergies(ch) {
    var N = (window.NETWORK || {})[ch], E = energySet(ch);
    if (!N || !E) return null;
    var nodeG = {}, edgeG = {}, top = {}, clash = [];
    N.routes.forEach(function (r) {
      var P = r.mech ? E.mech[r.mech] : null;
      if (!P || !fitsSteps(P, r.steps)) return;
      var R = splitRows(P);
      r.nodes.forEach(function (n, k) { var g = R.mins[k][2]; if (g == null) return; if (has(nodeG, n)) { if (Math.abs(nodeG[n] - g) > 0.05) clash.push(n); } else nodeG[n] = g; });
      r.edges.forEach(function (e, k) { var g = R.tss[k][2], key = "e" + e; if (g == null) return; if (has(edgeG, key)) { if (Math.abs(edgeG[key] - g) > 0.05) clash.push(key); } else edgeG[key] = g; });
    });
    N.routes.forEach(function (r) {
      var gs = r.edges.map(function (e) { return has(edgeG, "e" + e) ? edgeG["e" + e] : null; });
      if (!gs.length) return;
      var k = 0; gs.forEach(function (g, j) { if (g != null && (gs[k] == null || g > gs[k])) k = j; });
      top[r.id] = { g: gs[k], ts: "TS" + r.steps[k].slice(1), complete: gs.every(function (g) { return g != null; }) };
    });
    var best = {};
    N.routes.forEach(function (r) { var t = top[r.id]; if (t && t.complete && (!best[r.product] || t.g < top[best[r.product]].g)) best[r.product] = r.id; });
    return { E: E, nodeG: nodeG, edgeG: edgeG, top: top, best: best, clash: clash };
  }
  /* The energy landscape: two panels on one energy scale, the routes to P1a above and those to P1b below. In each, every
     state on its routes is a bar at its energy (with its structures), every step's TS a bar in the step's colour between
     the two states it joins, the routes running left to right (a state sits as far right as the longest route to it).
     A state on routes to both products is in both panels. The bars keep the network's ids and classes (sp|..., st|...|...,
     k-n..., k-e...), so a click, a route picked on the left, a search and pan / zoom work as in the network. */
  function landscape(ch) {
    var N = (window.NETWORK || {})[ch], NE = netEnergies(ch);
    if (!N || !N.nodes) return { msg: "<div class='hint'>This build of the site has no energy landscape: rebuild it (make_website.py).</div>" };
    if (!NE) return { msg: "<div class='hint'>No energies for the " + esc(CHN[ch]) + " yet." + HOW + " <b>View: Network</b> shows the network.</div>" };
    if (!Object.keys(NE.nodeG).length) return { msg: "<div class='hint'>None of the states of the " + esc(CHN[ch]) + " network has an energy yet." + HOW + "</div>" };
    var E = NE.E, nodes = {}, nb = {}, gy = {};
    N.nodes.forEach(function (nd) { nodes[nd.n] = nd; });
    N.edges.forEach(function (e) { (nb[e.from] = nb[e.from] || []).push(e.to); (nb[e.to] = nb[e.to] || []).push(e.from); });
    N.nodes.forEach(function (nd) {              // a state with no energy yet: the mean of its neighbours (dashed)
      if (has(NE.nodeG, nd.n)) { gy[nd.n] = NE.nodeG[nd.n]; return; }
      var ks = (nb[nd.n] || []).filter(function (m) { return has(NE.nodeG, m); }).map(function (m) { return NE.nodeG[m]; });
      gy[nd.n] = ks.length ? ks.reduce(function (s, v) { return s + v; }, 0) / ks.length : 0;
    });
    var all = Object.keys(gy).map(function (n) { return gy[n]; }).concat(Object.keys(NE.edgeG).map(function (e) { return NE.edgeG[e]; }));
    var gmax = Math.max.apply(null, all), gmin = Math.min.apply(null, all);
    if (gmax - gmin < 20) { var m0 = (gmax + gmin) / 2; gmax = m0 + 10; gmin = m0 - 10; }
    var SW = 140, SG = 14, CG = 110, AX = 110, PIC = 88, TW = 34;
    // ---- each panel's columns: how far along its routes each state is
    var panels = ["P1a", "P1b"].map(function (prod) {
      var rs = N.routes.filter(function (r) { return r.product === prod; }), depth = {}, it, k, inP = {}, eP = {};
      rs.forEach(function (r) { r.nodes.forEach(function (n, j) { depth[n] = Math.max(depth[n] || 0, j); inP[n] = 1; }); r.edges.forEach(function (e) { eP[e] = 1; }); });
      for (it = 0; it < 60; it++) {
        var moved = false;
        rs.forEach(function (r) { for (k = 0; k + 1 < r.nodes.length; k++) if (depth[r.nodes[k + 1]] <= depth[r.nodes[k]]) { depth[r.nodes[k + 1]] = depth[r.nodes[k]] + 1; moved = true; } });
        if (!moved) break;
      }
      var cols = {}, pos = {}, x = AX + 50;
      Object.keys(inP).forEach(function (n) { (cols[depth[n]] = cols[depth[n]] || []).push(n); });
      Object.keys(cols).map(Number).sort(function (a, b) { return a - b; }).forEach(function (d) {
        cols[d].sort(function (a, b) { return nat(nodes[a].label, nodes[b].label); }).forEach(function (n) { pos[n] = x; x += SW + SG; });
        x += CG - SG;
      });
      return { prod: prod, depth: depth, pos: pos, edges: Object.keys(eP).map(Number), w: x - CG + 60 };
    });
    var W = Math.round(Math.max(panels[0].w, panels[1].w)), ppu = Math.min(Math.max(0.3 * W / (gmax - gmin), 3), 30);
    var HEAD = 130, PH = PIC + 40 + (gmax - gmin) * ppu + 64, y0 = HEAD;
    panels.forEach(function (P) { P.top = y0; y0 += PH + 40; });
    var H = Math.round(y0 + 10);
    var out = el("svg", { xmlns: SVGNS, viewBox: "0 0 " + W + " " + H, "class": "energy land" });
    out.appendChild(el("rect", { x: 0, y: 0, width: W, height: H, fill: "white" }));
    out.appendChild(txt(40, 52, "Energy landscape of the " + CHN[ch] + " network, " + E.label, 40, "bold", "#111", "start"));
    out.appendChild(txt(40, 88, E.reference || ("Gibbs free energies in " + E.units + " relative to the reactants."), 22, "normal", "#222", "start"));
    out.appendChild(txt(40, 116, (E.level ? "Energies: " + E.level + ". " : "") + "From mechflow collect (" + E.source + ", " + E.date + ").", 18, "normal", "#666", "start"));
    panels.forEach(function (P) {
      var yOf = function (g) { return P.top + PIC + 40 + (gmax - g) * ppu; };
      var major = META.major[ch] === P.prod;
      out.appendChild(txt(AX + 50, P.top + 30, "Routes to " + P.prod + " (" + (META.iso[P.prod] || "") + ")" + (major ? ", the observed major product" : ""),
                          30, "bold", major ? "#2e7d32" : "#333", "start"));
      axis(out, AX, yOf, gmin, gmax, E.units || "kJ/mol", W - 20);
      // the steps: state -> TS -> state, spread out where several share a gap
      var gaps = {}, front = el("g", { "class": "steps", "data-p": P.prod });
      P.edges.forEach(function (i) {
        var e = N.edges[i], a = P.depth[e.from] <= P.depth[e.to] ? e.from : e.to, b = a === e.from ? e.to : e.from;
        var key = P.depth[a] + "-" + P.depth[b]; (gaps[key] = gaps[key] || []).push({ e: e, i: i, a: a, b: b });
      });
      Object.keys(gaps).forEach(function (key) {
        var list = gaps[key], eg = function (q) { return has(NE.edgeG, "e" + q.i) ? NE.edgeG["e" + q.i] : 0; };
        list.sort(function (p, q) { return eg(p) - eg(q); });
        list.forEach(function (it2, j) {
          var e = it2.e, i = it2.i, xa = P.pos[it2.a] + SW - 10, xb = P.pos[it2.b] + 10, ya = yOf(gy[it2.a]), yb = yOf(gy[it2.b]);
          var g = has(NE.edgeG, "e" + i) ? NE.edgeG["e" + i] : null, yt = g != null ? yOf(g) : Math.min(ya, yb) - 30;
          var tx = (xa + xb) / 2 + (j - (list.length - 1) / 2) * Math.min(44, Math.max(0, (xb - xa - TW) / Math.max(list.length, 1)));
          var col = g == null ? "#aaaaaa" : e.colour, wdt = e.kind === "once" ? 3.4 : 2;
          var grp = el("g", { "class": "edge k-e" + i, id: "st|" + e.step + "|" + e.dir });
          var pts = xa.toFixed(1) + "," + ya.toFixed(1) + " " + (tx - TW / 2).toFixed(1) + "," + yt.toFixed(1) + " " + (tx + TW / 2).toFixed(1) + "," + yt.toFixed(1) + " " + xb.toFixed(1) + "," + yb.toFixed(1);
          grp.appendChild(el("polyline", { points: pts, fill: "none", stroke: col, "stroke-width": wdt, "stroke-linejoin": "round", opacity: 0.85, "stroke-dasharray": g == null ? "6 5" : "none" }));
          grp.appendChild(el("polyline", { points: pts, fill: "none", stroke: "transparent", "stroke-width": 16, "class": "hit", "pointer-events": "stroke" }));
          grp.appendChild(el("line", { x1: (tx - TW / 2).toFixed(1), x2: (tx + TW / 2).toFixed(1), y1: yt.toFixed(1), y2: yt.toFixed(1), stroke: col, "stroke-width": 6,
                                       "stroke-linecap": "round", "class": "lvl ts", "data-g": g == null ? "" : String(g), "data-step": e.step, "data-p": P.prod }));
          grp.appendChild(txt(tx, yt - 10, "TS" + e.step.slice(1), 14, "bold", col));
          grp.appendChild(txt(tx, yt + 20, g == null ? "?" : fmtG(g), 13, "normal", "#333"));
          grp.appendChild(el("title", {}, "TS" + e.step.slice(1) + " (" + e.step + "): " + (g == null ? "no energy yet" : fmtG(g) + " " + (E.units || "kJ/mol"))));
          front.appendChild(grp);
        });
      });
      out.appendChild(front);
      // the states: a bar at the energy, the structures above it, the name and energy below
      Object.keys(P.pos).forEach(function (n) {
        var nd = nodes[n], x0 = P.pos[n], y = yOf(gy[n]), miss = !has(NE.nodeG, n), grp = el("g", { "class": "node k-" + n, id: "sp|" + nd.sp.join(" ") });
        var cx = x0 + SW / 2, s = nd.w && nd.h ? Math.min((SW - 16) / nd.w, PIC / nd.h, 1) : 0;
        grp.appendChild(el("rect", { "class": "hit", x: x0.toFixed(1), y: (y - PIC - 10).toFixed(1), width: SW, height: PIC + 52, fill: "transparent" }));
        if (nd.img && s) grp.appendChild(el("image", { href: nd.img + (VER ? "?v=" + VER : ""), x: (cx - nd.w * s / 2).toFixed(1), y: (y - 8 - nd.h * s).toFixed(1),
                                                      width: (nd.w * s).toFixed(1), height: (nd.h * s).toFixed(1), opacity: 0.95 }));
        var colr = nd.kind === "product" ? "#2e7d32" : nd.kind === "start" ? "#e67e22" : "#111";
        grp.appendChild(el("line", { x1: (x0 + 10).toFixed(1), x2: (x0 + SW - 10).toFixed(1), y1: y.toFixed(1), y2: y.toFixed(1), stroke: miss ? "#aaaaaa" : colr,
                                     "stroke-width": 5, "stroke-linecap": "round", "stroke-dasharray": miss ? "8 6" : "none", "class": "lvl min",
                                     "data-g": miss ? "" : String(NE.nodeG[n]), "data-n": n, "data-p": P.prod }));
        grp.appendChild(txt(cx, y + 22, nd.label, 14, "bold", nd.stepwise ? "#1f5fbf" : "#111"));
        grp.appendChild(txt(cx, y + 40, miss ? "not yet" : fmtG(NE.nodeG[n]), 13, "normal", miss ? "#999" : "#333"));
        out.appendChild(grp);
      });
    });
    return { svg: out, nstates: N.nodes.length, nsteps: N.edges.length };
  }
  $("#famlist").addEventListener("click", function (e) {
    var b = e.target.closest("button[data-m]"); if (b) { showMech(b.getAttribute("data-m")); return; }
    var f = e.target.closest(".fam[data-first]"); if (f) showMech(f.getAttribute("data-first"));
  });
  $("#mechview").addEventListener("click", function (e) {
    var lk = e.target.closest(".lk"); if (lk) { openStep(lk.dataset.step, lk.dataset.dir); return; }
    var sp = e.target.closest(".sp"); if (sp) openMol(sp.dataset.ids.split(" "));
  });
  $$(".zoombar button[data-z]").forEach(function (b) { b.onclick = function () { zoom(b.dataset.z); }; });
  $$(".tsmode button").forEach(function (b) { b.onclick = function () { setMechTS(b.dataset.tsm === "3d"); }; });
  $$(".viewmode button").forEach(function (b) { b.onclick = function () { setView(b.dataset.view === "energy"); }; });
  $$(".levelmode").forEach(function (box) { box.addEventListener("click", function (e) { var b = e.target.closest("button[data-level]"); if (b) setLevel(b.dataset.level); }); });
  $$(".nviewmode button").forEach(function (b) { b.onclick = function () { setNetView(b.dataset.nview === "energy"); }; });

  // ------------------------------------------------------------------ network tab (as on the main study's site: pan / zoom, drag boxes)
  /* NETWORK[ch] (data/network_<ch>.js, written by make_website.py): the network of every mechanism as Graphviz drew it
     (svg: a box "sp|I5a" per state, an arrow "st|S7b|fwd" per step; classes k-n<i> and k-e<i>) and every route from the
     reactants to P1a or P1b through it (routes: the named mechanisms and the other combinations of the steps done at
     once or one step at a time). */
  var net = { vb: null, el: null, full: null, wired: false, geo: null, layout: null, moved: {}, ch: null, route: null, needFit: false };
  function wireNet() {
    if (net.wired) return;
    net.wired = true;
    var box = $("#netview"), drag = null;
    /* A press on a box drags the box (once the mouse has moved a few pixels); anywhere else it pans. Without a move it
       is a click: a box opens its species, an arrow its step. */
    box.addEventListener("pointerdown", function (e) {
      if (!net.el || e.button !== 0) return;
      var g = e.target.closest ? e.target.closest("g.node, g.edge") : null, nm = g && g.classList.contains("node") ? nodeName(g) : null;
      drag = { x: e.clientX, y: e.clientY, vb: net.vb.slice(), moved: false, target: g, node: nm && net.geo && net.geo.nodes[nm] ? nm : null };
      if (drag.node) drag.from = (moves() || {})[nm] || [0, 0];
      try { box.setPointerCapture(e.pointerId); } catch (x) { /* the drag still works inside the network */ }
    });
    box.addEventListener("pointermove", function (e) {
      if (!drag) return;
      var r = box.getBoundingClientRect(), s = net.vb[2] / r.width;
      var dx = (e.clientX - drag.x) * s, dy = (e.clientY - drag.y) * s;
      if (Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) > 4) drag.moved = true;
      if (!drag.node) { net.vb[0] = drag.vb[0] - dx; net.vb[1] = drag.vb[1] - dy; setVB(); return; }
      if (!drag.moved) return;                         // a box only moves once it is clearly a drag, not a click
      if (!drag.raised) { drag.raised = true; box.classList.add("dragbox"); toFront(drag.node); }
      placeNode(drag.node, [drag.from[0] + dx, drag.from[1] + dy]);
    });
    function release(e) {
      var d = drag; drag = null;
      box.classList.remove("dragbox");
      if (d && d.node && d.moved) { rerouteAll(); showNetButtons(); return; }
      if (!e || e.button !== 0 || !d || d.moved) return;
      var g = d.target; if (!g) return;
      var id = g.id || "";
      if (id.indexOf("sp|") === 0) openMol(id.slice(3).split(" "));
      if (id.indexOf("st|") === 0) { var q = id.split("|"); openStep(q[1], q[2]); }
    }
    box.addEventListener("pointerup", release);
    box.addEventListener("pointercancel", function () { release(null); });
    box.addEventListener("wheel", function (e) {
      if (!net.el) return;
      e.preventDefault();
      var r = box.getBoundingClientRect(), f = e.deltaY > 0 ? 1.15 : 1 / 1.15;
      var mx = net.vb[0] + (e.clientX - r.left) / r.width * net.vb[2], my = net.vb[1] + (e.clientY - r.top) / r.height * net.vb[3];
      net.vb[2] *= f; net.vb[3] *= f; net.vb[0] = mx - (e.clientX - r.left) / r.width * net.vb[2]; net.vb[1] = my - (e.clientY - r.top) / r.height * net.vb[3];
      setVB();
    }, { passive: false });
  }
  function NW() { return (window.NETWORK || {})[S.ch] || null; }
  function showNet() {               // the network of the chalcogen shown (drawn once per chalcogen change)
    wireNet();
    var N = NW();
    if (!N) { $("#netview").innerHTML = "<div class='hint'>No network yet: rebuild the website (make_website.py).</div>"; return; }
    var want = S.nenergy ? "land|" + S.ch + "|" + curLevel(S.ch) : S.ch;
    if (net.ch !== want && S.nenergy) {
      net.ch = want;
      var L = landscape(S.ch);
      $("#netview").textContent = "";
      net.geo = null; net.layout = "land|" + S.ch;
      if (L.msg) { $("#netview").innerHTML = L.msg; net.el = null; }
      else {
        var lsvg = L.svg;
        $("#netview").appendChild(lsvg);
        lsvg.style.width = "100%"; lsvg.style.height = "100%";
        net.el = lsvg;
        var lb = lsvg.viewBox.baseVal;
        net.full = { x: lb.x, y: lb.y, width: lb.width, height: lb.height };
        net.needFit = true;
      }
      if (net.route && !routeOf(net.route)) net.route = null;
    } else if (net.ch !== want) {
      net.ch = S.ch;
      var tmp = document.createElement("div");
      tmp.innerHTML = N.svg;
      var svg = tmp.querySelector("svg");
      $("#netview").textContent = "";
      $("#netview").appendChild(svg);
      svg.removeAttribute("width"); svg.removeAttribute("height"); svg.style.width = "100%"; svg.style.height = "100%";
      net.el = svg;
      net.layout = S.ch;
      net.geo = buildGeo(svg);
      applyMoves();                  // boxes moved by hand earlier in this network (this page only, until reload)
      var b = svg.viewBox.baseVal;
      net.full = { x: b.x, y: b.y, width: b.width, height: b.height };
      net.needFit = true;
      if (net.route && !routeOf(net.route)) net.route = null;
    }
    routeList(); netLegend(); highlight();
    if (net.needFit && S.tab === "net") netFit();
    $(".netsub").textContent = S.nenergy && net.el ? "Drag to pan, scroll to zoom. Bars: states at their energies (with their structures) and the TSs of the steps between them, " +
      "in the step's colour; the routes run left to right. Click a state for its structures in 3D, a TS for its step. Pick a route on the left to see it." : NETSUB;
  }
  var NETSUB = ($(".netsub") || {}).textContent || "";
  function routeOf(id) { var N = NW(); return N ? N.routes.filter(function (r) { return r.id === id; })[0] || null : null; }
  function routeList() {             // every route to P1a and to P1b: the named mechanisms first, then the other combinations
    var N = NW(), q = query(), major = META.major[S.ch], out = "", NE = S.nenergy ? netEnergies(S.ch) : null;
    ["P1a", "P1b"].forEach(function (prod) {
      var rs = N.routes.filter(function (r) { return r.product === prod; });
      out += "<div class='group'><h3>Routes to " + esc(prod) + " (" + esc(META.iso[prod] || "") + ")" +
        (prod === major ? " <span class='bdg obs'>observed major</span>" : "") + "</h3>";
      rs.forEach(function (r) {
        var words = r.id + " " + (r.mech || "") + " " + r.text + " " + r.steps.join(" ");
        if (q && chText(words).toLowerCase().indexOf(q) < 0) return;
        out += "<button class='route" + (r.mech ? " named" : "") + (net.route === r.id ? " on" : "") + "' data-r='" + esc(r.id) + "'>" +
          "<b>" + esc(r.id) + "</b>" + (r.mech ? "" : " <span class='iso'>(no mechanism)</span>") +
          (NE && NE.top[r.id] ? " <span class='etop" + (NE.best[r.product] === r.id ? " best" : "") + "' title='the highest TS on this route" +
            (NE.top[r.id].complete ? "" : " (not every TS has an energy yet)") + "'>" + esc(NE.top[r.id].ts) + " " + fmtG(NE.top[r.id].g) +
            (NE.top[r.id].complete ? "" : "?") + (NE.best[r.product] === r.id ? " &#9733; lowest" : "") + "</span>" : "") +
          "<span class='ver'>" + esc(chText(r.text)) + "</span></button>";
      });
      out += "</div>";
    });
    out += "<div class='famnote'>Three changes can each happen at once or one step at a time: the " + esc(CHN[S.ch]) + " &rarr; iso" +
      esc(CHN[S.ch]) + " (S17, or S23 + S24), the 1,3-shift (S7, or S8 + S9) and the enol &rarr; product (S16, or S21 + S22). " +
      "Any combination can happen, and each combination is a mechanism of its own (M2 and M4&ndash;M10 through the iso" + esc(CHN[S.ch]) +
      ", M1 and M3 through the N-adduct)" + (NW().routes.some(function (r) { return !r.mech; }) ? "; R&hellip;: a combination that no mechanism names" : "") +
      ". Click a route to pick it out in the network; click it again to show everything.</div>";
    $("#routelist").innerHTML = out;
  }
  function highlight() {             // the route picked: its boxes and arrows as they are, everything else faded
    if (!net.el) return;
    var r = net.route ? routeOf(net.route) : null, on = {};
    if (r) { r.nodes.forEach(function (n) { on["k-" + n] = 1; }); r.edges.forEach(function (i) { on["k-e" + i] = 1; }); }
    $$("g.node, g.edge", net.el).forEach(function (g) {
      var k = ((g.getAttribute("class") || "").match(/(?:^|\s)(k-[a-z]?\d+)(?:\s|$)/) || [])[1];
      g.classList.toggle("dim", !!r && !on[k]);
    });
    $("#netinfo").textContent = r ? r.id + (r.mech ? "" : " (a combination that no mechanism names)") + ": " + chText(r.text) + " → " + r.product : "";
    $("#netclear").hidden = !r;
  }
  function pickRoute(id) {
    net.route = id && net.route !== id && routeOf(id) ? id : null;
    routeList(); highlight();
  }
  function netLegend() {
    var N = NW();
    if (S.nenergy) {
      var NE = netEnergies(S.ch);
      $("#netlegend").innerHTML = "<b>Energy landscape (" + esc(CHN[S.ch]) + ")</b>" +
        (NE ? "<div>" + esc(NE.E.label) + ": " + Object.keys(NE.nodeG).length + " of " + N.nstates + " states and " + Object.keys(NE.edgeG).length + " of " +
              (N.edges ? N.edges.length : N.nsteps) + " TSs have energies</div>" : "<div>no energies yet</div>") +
        "<div><i style='height:5px;background:#111'></i>a state (orange: the reactants, green: a product)</div>" +
        "<div><i style='height:6px;background:#1f5fbf'></i>a TS, in its step's colour; grey: proton transfers and relays</div>" +
        "<div><i style='height:4px;background:#444'></i>thick: a step done at once (S7, S16, S17)</div>" +
        "<div><i style='height:3px;background:repeating-linear-gradient(90deg,#aaa 0 6px,transparent 6px 10px)'></i>no energy yet</div>" +
        "<div>On the left: each route's highest TS; &#9733; the lowest to each product</div>";
      return;
    }
    $("#netlegend").innerHTML = "<b>The network (" + esc(CHN[S.ch]) + ")</b>" +
      "<div>" + N.nstates + " states, " + N.nsteps + " steps; " + N.routes.filter(function (r) { return r.product === "P1a"; }).length + " routes to P1a and " +
      N.routes.filter(function (r) { return r.product === "P1b"; }).length + " to P1b</div>" +
      "<div><i style='height:6px;background:#444'></i>thick: done at once (S7, S16, S17)</div>" +
      "<div><i class='box' style='background:" + esc(N.stepwise_fill) + "'></i>box only on a one-step-at-a-time route (S8 + S9, S21 + S22, S23 + S24)</div>" +
      "<div><i style='background:" + esc(N.pt_colour) + "'></i>proton transfer or relay through the catalyst (HA / A⁻)</div>" +
      "<div><i style='background:#1f5fbf'></i>other steps: the colour of the step on the mechanism pages</div>" +
      "<div>two heads: an equilibrium (proton transfer, water in or out)</div>";
  }
  function setVB() { net.el.setAttribute("viewBox", net.vb.join(" ")); }
  function netFit() {
    if (!net.el) return;
    var box = $("#netview").getBoundingClientRect(), f = net.full, ar = box.width / Math.max(box.height, 1);
    if (box.width < 2 || box.height < 2) { net.needFit = true; return; }   // the tab is hidden: fit when it is shown
    net.needFit = false;
    var w = f.width, hh = f.height;
    if (w / hh > ar) hh = w / ar; else w = hh * ar;
    net.vb = [f.x - (w - f.width) / 2, f.y - (hh - f.height) / 2, w, hh]; setVB();
  }
  function netZoom(z) {
    if (!net.el) return;
    if (z === "fit") { netFit(); return; }
    var f = z === "+" ? 1 / 1.25 : 1.25, cx = net.vb[0] + net.vb[2] / 2, cy = net.vb[1] + net.vb[3] / 2;
    net.vb[2] *= f; net.vb[3] *= f; net.vb[0] = cx - net.vb[2] / 2; net.vb[1] = cy - net.vb[3] / 2; setVB();
  }
  function netFind(q) {              // the boxes whose species match a search (I7b, P1a ...), outlined, the first one in view
    if (!net.el) return;
    $$("g.hl", net.el).forEach(function (g) { g.classList.remove("hl"); });
    if (!q) return;
    var hit = $$("g.node", net.el).filter(function (g) { return (" " + g.id.slice(3) + " ").toLowerCase().indexOf(" " + q + " ") >= 0; });
    hit.forEach(function (g) { g.classList.add("hl"); });
    if (hit.length && S.tab === "net") {
      var b = rootBox(hit[0]), w = Math.max(b.width * 8, 1400), box = $("#netview").getBoundingClientRect();
      net.vb = [b.x + b.width / 2 - w / 2, b.y + b.height / 2 - w * box.height / box.width / 2, w, w * box.height / box.width]; setVB();
    }
  }
  function rootBox(el) {          // the box of an element in the coordinates of the viewBox (Graphviz shifts its graph with a transform)
    var b = el.getBBox(), m = net.el.createSVGMatrix();
    for (var p = el; p && p !== net.el; p = p.parentNode) {
      var t = p.transform && p.transform.baseVal.consolidate();
      if (t) m = t.matrix.multiply(m);
    }
    var a = net.el.createSVGPoint(), c = net.el.createSVGPoint();
    a.x = b.x; a.y = b.y; c.x = b.x + b.width; c.y = b.y + b.height;
    a = a.matrixTransform(m); c = c.matrixTransform(m);
    return { x: Math.min(a.x, c.x), y: Math.min(a.y, c.y), width: Math.abs(c.x - a.x), height: Math.abs(c.y - a.y) };
  }
  $("#routelist").addEventListener("click", function (e) { var b = e.target.closest("button[data-r]"); if (b) pickRoute(b.getAttribute("data-r")); });
  $$(".zoombar button[data-nz]").forEach(function (b) { b.onclick = function () { netZoom(b.dataset.nz); }; });
  $("#netclear").addEventListener("click", function () { pickRoute(null); });
  $("#resetpos").addEventListener("click", function () { resetMoves(); });

  // ------------------------------------------------------------------ boxes moved by hand (this page only)
  /* net.geo: the network as Graphviz drew it: each box (its rectangle) and each arrow (its curve, heads and label),
     with the arrows of each box. net.moved[ch] = {layout, at: {box name: [dx, dy]}}: the boxes moved by hand in that
     layout of that network. A moved box gets a translate(); its arrows are drawn again as curves between the sides of
     the two boxes that face each other, with their heads and labels; an arrow whose boxes are back in place is drawn
     as Graphviz drew it. Nothing is laid out again, so hiding, greying, filtering and the menus are not affected. */
  var SVGNS = "http://www.w3.org/2000/svg";
  function nums(t) { return (String(t || "").match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi) || []).map(Number); }
  function pts(t) { var a = nums(t), out = []; for (var i = 0; i + 1 < a.length; i += 2) out.push([a[i], a[i + 1]]); return out; }
  function d2(p, q) { return (p[0] - q[0]) * (p[0] - q[0]) + (p[1] - q[1]) * (p[1] - q[1]); }
  function unit(v) { var l = Math.sqrt(v[0] * v[0] + v[1] * v[1]) || 1; return [v[0] / l, v[1] / l]; }
  function fmt(p) { return p[0].toFixed(2) + "," + p[1].toFixed(2); }
  function nodeName(g) { var m = /(?:^|\s)k-([nu]\d+)(?:\s|$)/.exec(g.getAttribute("class") || ""); return m ? m[1] : null; }
  function buildGeo(svg) {
    var geo = { nodes: {}, edges: [], byNode: {} };
    $$("g.node", svg).forEach(function (g) {
      var nm = nodeName(g), poly = g.querySelector("polygon"), q = poly ? pts(poly.getAttribute("points")) : [];   // the box's outline
      if (!nm || !q.length) return;
      var xs = q.map(function (p) { return p[0]; }), ys = q.map(function (p) { return p[1]; });
      geo.nodes[nm] = { g: g, x0: Math.min.apply(null, xs), y0: Math.min.apply(null, ys), x1: Math.max.apply(null, xs), y1: Math.max.apply(null, ys) };
    });
    $$("g.edge", svg).forEach(function (g) {
      var t = g.querySelector("title"), m = t && /^(\w+)->(\w+)$/.exec(t.textContent.trim()), path = g.querySelector("path");
      if (!m || !path || !geo.nodes[m[1]] || !geo.nodes[m[2]]) return;
      var c = pts(path.getAttribute("d"));
      if (c.length < 4 || (c.length - 1) % 3) return;               // Graphviz's splines: M p C p p p …
      var hit = document.createElementNS(SVGNS, "path");             // a wider invisible line, easier to click
      hit.setAttribute("class", "hit");
      hit.setAttribute("d", path.getAttribute("d"));
      path.parentNode.insertBefore(hit, path);
      var E = { tail: m[1], head: m[2], path: path, hit: hit, d0: path.getAttribute("d"), d: path.getAttribute("d"), heads: [], label: null };
      var p0 = c[0], p1 = c[c.length - 1];
      $$("polygon", g).forEach(function (pg) {                      // arrow heads: at the end they are nearest to
        var q = pts(pg.getAttribute("points"));
        if (!q.length) return;
        var mid = q.reduce(function (a, p) { return [a[0] + p[0] / q.length, a[1] + p[1] / q.length]; }, [0, 0]);
        var end = d2(mid, p1) <= d2(mid, p0), base = end ? p1 : p0, tip = q[0];
        q.forEach(function (p) { if (d2(p, base) > d2(tip, base)) tip = p; });
        E.heads.push({ el: pg, pts0: pg.getAttribute("points"), q: q, end: end ? "head" : "tail", base: base, tip: tip, len: Math.sqrt(d2(tip, base)) });
      });
      var tx = g.querySelector("text");
      if (tx) E.label = { el: tx, x: tx.getAttribute("x"), y: tx.getAttribute("y"), anchor: tx.getAttribute("text-anchor") };
      var k = geo.edges.push(E) - 1;
      (geo.byNode[E.tail] = geo.byNode[E.tail] || []).push(k);
      if (E.head !== E.tail) (geo.byNode[E.head] = geo.byNode[E.head] || []).push(k);
    });
    return geo;
  }
  function moves() {                 // the boxes moved by hand in the network shown, or null
    var m = net.moved[S.ch];
    return m && m.layout === net.layout ? m.at : null;
  }
  function nodeRect(nm) {
    var n = net.geo.nodes[nm], d = (moves() || {})[nm] || [0, 0];
    return { x0: n.x0 + d[0], y0: n.y0 + d[1], x1: n.x1 + d[0], y1: n.y1 + d[1] };
  }
  function exitPoint(R, from, to) {  // where the line from `from` (inside the box) towards `to` leaves the box
    var dx = to[0] - from[0], dy = to[1] - from[1], hw = (R.x1 - R.x0) / 2, hh = (R.y1 - R.y0) / 2;
    var f = Math.min(dx ? hw / Math.abs(dx) : Infinity, dy ? hh / Math.abs(dy) : Infinity, 1);
    return [from[0] + dx * f, from[1] + dy * f];
  }
  function drawEdge(E) {
    var M = moves() || {};
    if (!M[E.tail] && !M[E.head]) { restoreEdge(E); return; }      // both boxes in place: as Graphviz drew it
    var A = nodeRect(E.tail), B = nodeRect(E.head), ca = [(A.x0 + A.x1) / 2, (A.y0 + A.y1) / 2], cb = [(B.x0 + B.x1) / 2, (B.y0 + B.y1) / 2];
    var pa = exitPoint(A, ca, cb), pb = exitPoint(B, cb, ca), u = unit([pb[0] - pa[0], pb[1] - pa[1]]), n = [-u[1], u[0]];
    var ts = unit([u[0] + 0.25 * n[0], u[1] + 0.25 * n[1]]), te = unit([u[0] - 0.25 * n[0], u[1] - 0.25 * n[1]]);   // a gentle bow
    var lt = 0, lh = 0;
    E.heads.forEach(function (a) { if (a.end === "head") lh = a.len; else lt = a.len; });
    var s = [pa[0] + ts[0] * lt, pa[1] + ts[1] * lt], e = [pb[0] - te[0] * lh, pb[1] - te[1] * lh], l = Math.sqrt(d2(s, e)) / 3;
    var c1 = [s[0] + ts[0] * l, s[1] + ts[1] * l], c2 = [e[0] - te[0] * l, e[1] - te[1] * l];
    var d = "M" + fmt(s) + "C" + fmt(c1) + " " + fmt(c2) + " " + fmt(e);
    E.path.setAttribute("d", d); E.hit.setAttribute("d", d); E.d = d;
    placeHeads(E, pa, [-ts[0], -ts[1]], pb, te);
    if (E.label) {                    // the label beside the middle of the curve, on its outer side and clear of it
      var mid = [(s[0] + 3 * c1[0] + 3 * c2[0] + e[0]) / 8, (s[1] + 3 * c1[1] + 3 * c2[1] + e[1]) / 8];
      var fs = parseFloat(E.label.el.getAttribute("font-size")) || 20, w = 0.62 * fs * E.label.el.textContent.length;
      var off = Math.abs(n[0]) * w / 2 + Math.abs(n[1]) * fs / 2 + 6;
      E.label.el.setAttribute("x", (mid[0] + off * n[0]).toFixed(2));
      E.label.el.setAttribute("y", (mid[1] + off * n[1] + 0.35 * fs).toFixed(2));
      E.label.el.setAttribute("text-anchor", "middle");
    }
  }
  function placeHeads(E, pa, da, pb, db) {   // each head turned to its direction (da at the tail, db at the head), tip on the box
    E.heads.forEach(function (a) {
      var tip = a.end === "head" ? pb : pa, dir = a.end === "head" ? db : da, ax = unit([a.tip[0] - a.base[0], a.tip[1] - a.base[1]]);
      var th = Math.atan2(dir[1], dir[0]) - Math.atan2(ax[1], ax[0]), cs = Math.cos(th), sn = Math.sin(th);
      a.el.setAttribute("points", a.q.map(function (p) {
        var x = p[0] - a.tip[0], y = p[1] - a.tip[1];
        return fmt([tip[0] + cs * x - sn * y, tip[1] + sn * x + cs * y]);
      }).join(" "));
    });
  }
  function restoreEdge(E) {          // as Graphviz drew it
    E.path.setAttribute("d", E.d0); E.hit.setAttribute("d", E.d0); E.d = E.d0;
    E.heads.forEach(function (a) { a.el.setAttribute("points", a.pts0); });
    if (E.label) {
      E.label.el.setAttribute("x", E.label.x); E.label.el.setAttribute("y", E.label.y);
      if (E.label.anchor) E.label.el.setAttribute("text-anchor", E.label.anchor); else E.label.el.removeAttribute("text-anchor");
    }
  }

  // ------------------------------------------------------------------ arrows routed round the boxes (after a move)
  /* Once a box has been moved (at the end of the drag), its arrows and every arrow that now runs through a moved box
     are routed again on a grid (A*): boxes are all but walls, running along another arrow costs more than crossing
     it, and the route is then straightened and given rounded corners, its heads and label put back on it. While a
     box is being dragged its arrows are simple curves, so the drag stays smooth. */
  var RT = { margin: 10, box: 400, onEdge: 8, nearEdge: 3, maxCells: 160000, pad: 280, corner: 40 };
  function bez(c, t) {               // a point of a quadratic or cubic Bezier curve
    var u = 1 - t;
    if (c.length === 3) return [u * u * c[0][0] + 2 * u * t * c[1][0] + t * t * c[2][0], u * u * c[0][1] + 2 * u * t * c[1][1] + t * t * c[2][1]];
    return [u * u * u * c[0][0] + 3 * u * u * t * c[1][0] + 3 * u * t * t * c[2][0] + t * t * t * c[3][0],
            u * u * u * c[0][1] + 3 * u * u * t * c[1][1] + 3 * u * t * t * c[2][1] + t * t * t * c[3][1]];
  }
  function samplePath(d) {           // points about every 4 units along a path of M, L, Q and C commands
    var out = [], cur = null, re = /([MLQC])([^MLQC]*)/g, m;
    function lineTo(q) {
      var n = Math.max(1, Math.ceil(Math.sqrt(d2(cur, q)) / 4));
      for (var k = 1; k <= n; k++) out.push([cur[0] + (q[0] - cur[0]) * k / n, cur[1] + (q[1] - cur[1]) * k / n]);
      cur = q;
    }
    while ((m = re.exec(d || ""))) {
      var p = pts(m[2]);
      if (m[1] === "M") { if (p.length) { cur = p[0]; out.push(cur); } continue; }
      if (!cur) continue;
      if (m[1] === "L") { p.forEach(lineTo); continue; }
      var step = m[1] === "Q" ? 2 : 3;
      for (var i = 0; i + step - 1 < p.length; i += step) {
        var c = [cur].concat(p.slice(i, i + step)), len = 0;
        for (var j = 1; j < c.length; j++) len += Math.sqrt(d2(c[j - 1], c[j]));
        var n = Math.max(4, Math.ceil(len / 4));
        for (var k = 1; k <= n; k++) out.push(bez(c, k / n));
        cur = c[c.length - 1];
      }
    }
    return out;
  }
  function Heap() { this.a = []; }    // binary min-heap of [key, value]
  Heap.prototype.push = function (k, v) {
    var a = this.a, i = a.length;
    a.push([k, v]);
    while (i > 0) { var j = (i - 1) >> 1; if (a[j][0] <= a[i][0]) break; var t = a[i]; a[i] = a[j]; a[j] = t; i = j; }
  };
  Heap.prototype.pop = function () {
    var a = this.a, top = a[0], last = a.pop();
    if (a.length) {
      a[0] = last;
      for (var i = 0; ;) {
        var l = 2 * i + 1, r = l + 1, s = i;
        if (l < a.length && a[l][0] < a[s][0]) s = l;
        if (r < a.length && a[r][0] < a[s][0]) s = r;
        if (s === i) break;
        var t = a[i]; a[i] = a[s]; a[s] = t; i = s;
      }
    }
    return top;
  };
  function inflate(R, m) { return { x0: R.x0 - m, y0: R.y0 - m, x1: R.x1 + m, y1: R.y1 + m }; }
  function onBoundary(R, p) {        // the point of the outline of R nearest to p (p outside R)
    var x = Math.min(Math.max(p[0], R.x0), R.x1), y = Math.min(Math.max(p[1], R.y0), R.y1);
    if (x > R.x0 && x < R.x1 && y > R.y0 && y < R.y1) {
      var dl = x - R.x0, dr = R.x1 - x, dt = y - R.y0, db = R.y1 - y, mn = Math.min(dl, dr, dt, db);
      if (mn === dl) x = R.x0; else if (mn === dr) x = R.x1; else if (mn === dt) y = R.y0; else y = R.y1;
    }
    return [x, y];
  }
  function routeOne(E, boxes, others, self) {
    var A = nodeRect(E.tail), B = nodeRect(E.head), mg = RT.margin;
    var x0 = Math.min(A.x0, B.x0) - RT.pad, y0 = Math.min(A.y0, B.y0) - RT.pad;
    var x1 = Math.max(A.x1, B.x1) + RT.pad, y1 = Math.max(A.y1, B.y1) + RT.pad;
    var cell = Math.max(6, Math.sqrt((x1 - x0) * (y1 - y0) / RT.maxCells));
    var W = Math.ceil((x1 - x0) / cell) + 1, H = Math.ceil((y1 - y0) / cell) + 1, N = W * H;
    var cost = new Float32Array(N).fill(1), isT = new Uint8Array(N);
    function cxy(k) { var i = k % W; return [x0 + (i + 0.5) * cell, y0 + ((k - i) / W + 0.5) * cell]; }
    function each(R, fn) {
      var a = Math.max(0, Math.floor((R.x0 - x0) / cell)), b = Math.min(W - 1, Math.floor((R.x1 - x0) / cell));
      var c = Math.max(0, Math.floor((R.y0 - y0) / cell)), d = Math.min(H - 1, Math.floor((R.y1 - y0) / cell));
      for (var j = c; j <= d; j++) for (var i = a; i <= b; i++) fn(j * W + i);
    }
    boxes.forEach(function (bx) {      // the other boxes (with a margin), and the inside of the arrow's own two boxes
      var own = bx.nm === E.tail || bx.nm === E.head, R = own ? bx.r : inflate(bx.r, mg);
      if (R.x1 < x0 || R.x0 > x1 || R.y1 < y0 || R.y0 > y1) return;
      each(R, function (k) { cost[k] += RT.box; });
    });
    var stampOn = new Int32Array(N), stampNear = new Int32Array(N);
    others.forEach(function (S, e) {   // the other arrows: once per arrow and cell
      if (!S || e === self) return;
      S.forEach(function (p) {
        if (p[0] < x0 || p[0] >= x1 || p[1] < y0 || p[1] >= y1) return;
        var i = Math.floor((p[0] - x0) / cell), j = Math.floor((p[1] - y0) / cell);
        for (var dj = -1; dj <= 1; dj++) for (var di = -1; di <= 1; di++) {
          var ii = i + di, jj = j + dj;
          if (ii < 0 || jj < 0 || ii >= W || jj >= H) continue;
          var k = jj * W + ii;
          if (!di && !dj) { if (stampOn[k] !== e + 1) { stampOn[k] = e + 1; cost[k] += RT.onEdge; } }
          else if (stampNear[k] !== e + 1) { stampNear[k] = e + 1; cost[k] += RT.nearEdge; }
        }
      });
    });
    var At = inflate(A, mg), Bt = inflate(B, mg), src = [];
    each(inflate(A, mg + 1.5 * cell), function (k) {
      var p = cxy(k);
      if (!(p[0] > At.x0 && p[0] < At.x1 && p[1] > At.y0 && p[1] < At.y1)) src.push(k);
    });
    each(inflate(B, mg + 1.5 * cell), function (k) {
      var p = cxy(k);
      if (!(p[0] > Bt.x0 && p[0] < Bt.x1 && p[1] > Bt.y0 && p[1] < Bt.y1)) isT[k] = 1;
    });
    function h(k) {
      var p = cxy(k), dx = Math.max(Bt.x0 - p[0], 0, p[0] - Bt.x1), dy = Math.max(Bt.y0 - p[1], 0, p[1] - Bt.y1);
      return Math.sqrt(dx * dx + dy * dy) / cell;
    }
    var g = new Float32Array(N).fill(Infinity), prev = new Int32Array(N).fill(-1), heap = new Heap(), end = -1, pops = 0;
    src.forEach(function (k) { if (cost[k] < 1 + RT.box) { g[k] = 0; heap.push(h(k), k); } });
    var D = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];
    while (heap.a.length) {
      var top = heap.pop(), k = top[1];
      if (top[0] > g[k] + h(k) + 1e-6) continue;
      if (isT[k]) { end = k; break; }
      if (++pops > 4 * N) break;
      var i = k % W, j = (k - i) / W;
      for (var q = 0; q < 8; q++) {
        var ii = i + D[q][0], jj = j + D[q][1];
        if (ii < 0 || jj < 0 || ii >= W || jj >= H) continue;
        var kk = jj * W + ii, ng = g[k] + D[q][2] * cost[kk];
        if (ng < g[kk]) { g[kk] = ng; prev[kk] = k; heap.push(ng + h(kk), kk); }
      }
    }
    if (end < 0) return null;
    var cells = [];
    for (var c2 = end; c2 >= 0; c2 = prev[c2]) cells.push(c2);
    cells.reverse();
    var P = cells.map(cxy);
    function lineCost(p, q) {          // grid cost of the straight line p-q, in the units of g
      var L = Math.sqrt(d2(p, q)), n = Math.max(1, Math.ceil(L / (cell / 2))), s = 0;
      for (var t = 0; t <= n; t++) {
        var x = p[0] + (q[0] - p[0]) * t / n, y = p[1] + (q[1] - p[1]) * t / n;
        var ii = Math.min(W - 1, Math.max(0, Math.floor((x - x0) / cell))), jj = Math.min(H - 1, Math.max(0, Math.floor((y - y0) / cell)));
        s += cost[jj * W + ii];
      }
      return s / (n + 1) * L / cell;
    }
    function ok(a, b) { return lineCost(P[a], P[b]) <= (g[cells[b]] - g[cells[a]]) * 1.05 + 0.5; }
    var keep = [0], a = 0, last = P.length - 1;
    while (a < last) {                 // straighten: the furthest point that a straight line reaches at no extra cost
      var stepB = Math.max(1, Math.floor((last - a) / 12)), b = a + 1;
      for (var cand = last; cand > a + 1; cand -= stepB) if (ok(a, cand)) { b = cand; break; }
      while (b + 1 <= last && ok(a, b + 1)) b++;
      keep.push(b);
      a = b;
    }
    var Q = keep.map(function (k) { return P[k]; });
    var pa = onBoundary(A, Q[0]), pb = onBoundary(B, Q[Q.length - 1]);
    Q = [pa].concat(Q.length > 2 ? Q.slice(1, -1) : []).concat([pb]);
    var lt = 0, lh = 0;
    E.heads.forEach(function (hd) { if (hd.end === "head") lh = hd.len; else lt = hd.len; });
    var da = unit([Q[1][0] - Q[0][0], Q[1][1] - Q[0][1]]), n2 = Q.length;
    var db = unit([Q[n2 - 1][0] - Q[n2 - 2][0], Q[n2 - 1][1] - Q[n2 - 2][1]]);
    var S2 = Q.map(function (p) { return p.slice(); });
    S2[0] = [pa[0] + da[0] * lt, pa[1] + da[1] * lt];
    S2[n2 - 1] = [pb[0] - db[0] * lh, pb[1] - db[1] * lh];
    var d = "M" + fmt(S2[0]);
    for (var v = 1; v < n2 - 1; v++) {    // rounded corners
      var p0 = S2[v - 1], p1 = S2[v], p2 = S2[v + 1], la = Math.sqrt(d2(p0, p1)) || 1, lc = Math.sqrt(d2(p1, p2)) || 1;
      var r = Math.min(RT.corner, la * 0.45, lc * 0.45);
      var u0 = [p1[0] + (p0[0] - p1[0]) * r / la, p1[1] + (p0[1] - p1[1]) * r / la];
      var u1 = [p1[0] + (p2[0] - p1[0]) * r / lc, p1[1] + (p2[1] - p1[1]) * r / lc];
      d += "L" + fmt(u0) + "Q" + fmt(p1) + " " + fmt(u1);
    }
    d += "L" + fmt(S2[n2 - 1]);
    return { d: d, pa: pa, da: [-da[0], -da[1]], pb: pb, db: db, Q: S2 };
  }
  function labelAt(E, Q, boxes) {   // the label beside the middle of the route, on the side with fewer boxes
    if (!E.label) return;
    var segs = [], tot = 0;
    for (var i = 1; i < Q.length; i++) { var l = Math.sqrt(d2(Q[i - 1], Q[i])); segs.push(l); tot += l; }
    var half = tot / 2, k = 0;
    while (k < segs.length - 1 && half > segs[k]) { half -= segs[k]; k++; }
    var f = segs[k] ? half / segs[k] : 0, mid = [Q[k][0] + (Q[k + 1][0] - Q[k][0]) * f, Q[k][1] + (Q[k + 1][1] - Q[k][1]) * f];
    var u = unit([Q[k + 1][0] - Q[k][0], Q[k + 1][1] - Q[k][1]]), n = [-u[1], u[0]];
    var fs = parseFloat(E.label.el.getAttribute("font-size")) || 20, w = 0.62 * fs * E.label.el.textContent.length;
    var off = Math.abs(n[0]) * w / 2 + Math.abs(n[1]) * fs / 2 + 6, best = null;
    [1, -1].forEach(function (sgn) {
      var c = [mid[0] + sgn * off * n[0], mid[1] + sgn * off * n[1]], R = { x0: c[0] - w / 2, x1: c[0] + w / 2, y0: c[1] - fs / 2, y1: c[1] + fs / 2 }, hits = 0;
      boxes.forEach(function (bx) { if (!(bx.r.x1 < R.x0 || bx.r.x0 > R.x1 || bx.r.y1 < R.y0 || bx.r.y0 > R.y1)) hits++; });
      if (!best || hits < best.hits) best = { hits: hits, c: c };
    });
    E.label.el.setAttribute("x", best.c[0].toFixed(2));
    E.label.el.setAttribute("y", (best.c[1] + 0.35 * fs).toFixed(2));
    E.label.el.setAttribute("text-anchor", "middle");
  }
  function crosses(S, R) { for (var i = 0; i < S.length; i++) if (S[i][0] > R.x0 && S[i][0] < R.x1 && S[i][1] > R.y0 && S[i][1] < R.y1) return true; return false; }
  function rerouteAll() {            // after a move: every arrow of a moved box, and every arrow through a moved box
    if (!net.geo) return;
    var M = moves() || {}, names = Object.keys(M), geo = net.geo;
    if (!names.length) { geo.edges.forEach(restoreEdge); return; }
    var aff = {}, order = [];
    names.forEach(function (nm) { (geo.byNode[nm] || []).forEach(function (k) { if (!aff[k]) { aff[k] = 1; order.push(k); } }); });
    var rects = names.map(function (nm) { return inflate(nodeRect(nm), RT.margin); });
    geo.edges.forEach(function (E, k) {
      if (aff[k]) return;
      E.s0 = E.s0 || samplePath(E.d0);
      if (rects.some(function (R) { return crosses(E.s0, R); })) { aff[k] = 1; order.push(k); }
    });
    var boxes = Object.keys(geo.nodes).map(function (nm) { return { nm: nm, r: nodeRect(nm) }; });
    var others = geo.edges.map(function (E, k) { if (aff[k]) return null; restoreEdge(E); return E.s0 || (E.s0 = samplePath(E.d0)); });
    order.forEach(function (k) {
      var E = geo.edges[k], res = null;
      try { res = routeOne(E, boxes, others, k); } catch (err) { res = null; }
      if (!res) { drawEdge(E); others[k] = samplePath(E.d); return; }
      E.path.setAttribute("d", res.d); E.hit.setAttribute("d", res.d); E.d = res.d;
      placeHeads(E, res.pa, res.da, res.pb, res.db);
      labelAt(E, res.Q, boxes);
      others[k] = samplePath(res.d);
    });
  }
  function placeNode(nm, d) {        // move a box to d = [dx, dy] from where Graphviz put it, and draw its arrows again
    var n = net.geo && net.geo.nodes[nm];
    if (!n) return;
    var m = net.moved[S.ch];
    if (!m || m.layout !== net.layout) m = net.moved[S.ch] = { layout: net.layout, at: {} };
    if (d && (d[0] || d[1])) { m.at[nm] = d; n.g.setAttribute("transform", "translate(" + d[0].toFixed(2) + " " + d[1].toFixed(2) + ")"); }
    else { delete m.at[nm]; n.g.removeAttribute("transform"); }
    (net.geo.byNode[nm] || []).forEach(function (k) { drawEdge(net.geo.edges[k]); });
  }
  function toFront(nm) {             // a moved box is drawn over the others (SVG draws in document order)
    var g = net.geo && net.geo.nodes[nm] && net.geo.nodes[nm].g;
    if (g && g.parentNode && g.parentNode.lastChild !== g) g.parentNode.appendChild(g);
  }
  function applyMoves() {            // after a new picture of the network: the moves of that layout, if any
    var m = net.moved[S.ch];
    if (m && m.layout !== net.layout) { net.moved[S.ch] = null; m = null; }      // laid out anew: the old moves do not fit
    if (m) { Object.keys(m.at).forEach(function (nm) { placeNode(nm, m.at[nm]); toFront(nm); }); rerouteAll(); }
    showNetButtons();
  }
  function resetMoves() {            // every moved box back where Graphviz put it
    var M = moves(), names = M ? Object.keys(M) : [];
    names.forEach(function (nm) { placeNode(nm, null); });
    net.moved[S.ch] = null;
    if (net.geo) net.geo.edges.forEach(restoreEdge);
    showNetButtons();
  }
  function showNetButtons() {        // "reset positions", only when a box has been moved
    var M = moves();
    $("#resetpos").hidden = !(M && Object.keys(M).length);
  }

  // ------------------------------------------------------------------ tables
  function tables() {
    var q = query(), sp = M().species, rows = "";
    Object.keys(sp).forEach(function (s) {
      var t = (s + " " + sp[s].name + " " + sp[s].formula).toLowerCase();
      if (q && t.indexOf(q) < 0) return;
      rows += "<tr data-s='" + esc(s) + "'><td class='id'>" + esc(s) + "</td><td>" + esc(chText(sp[s].name)) + "</td><td>" + esc(sp[s].formula) + "</td><td>" +
        esc(sp[s].used_by.join(", ") || (sp[s].start_of.length ? "SCAN start of " + sp[s].start_of.join(", ") : "")) + "</td></tr>";
    });
    $("#sptable").innerHTML = "<thead><tr><th>ID</th><th>name</th><th>formula</th><th>mechanisms</th></tr></thead><tbody>" + rows + "</tbody>";
    var st = M().steps; rows = "";
    Object.keys(st).forEach(function (s) {
      var t = (s + " " + st[s].name + " " + st[s].reaction).toLowerCase();
      if (q && t.indexOf(q) < 0) return;
      rows += "<tr data-t='" + esc(s) + "'><td class='id' style='color:" + esc(st[s].colour) + "'>" + esc(s) + "</td><td>" + esc(chText(st[s].name)) + "</td><td>" + esc(st[s].reaction) +
        "</td><td>" + esc(st[s].used_by.filter(function (m) { return baseMech(m); }).join(", ")) + "</td></tr>";
    });
    $("#sttable").innerHTML = "<thead><tr><th>ID</th><th>what happens</th><th>reaction</th><th>mechanisms</th></tr></thead><tbody>" + rows + "</tbody>";
  }
  $("#sptable").addEventListener("click", function (e) { var r = e.target.closest("tr[data-s]"); if (r) openMol([r.getAttribute("data-s")]); });
  $("#sttable").addEventListener("click", function (e) { var r = e.target.closest("tr[data-t]"); if (r) openStep(r.getAttribute("data-t"), "fwd"); });

  // ------------------------------------------------------------------ about (META.about: paragraphs written by make_website.py)
  function about() {
    var nm = Object.keys(M().mechanisms).length, ns = Object.keys(M().species).length, nt = Object.keys(M().steps).length;
    $("#about").innerHTML = "<h2>What this is</h2><p>" + esc(META.about.what) + " For the " + esc(CHN[S.ch]) + ": " + nm + " mechanisms, " + ns +
      " species (including the start structures of the proton-transfer scans) and " + nt + " steps. Species and step IDs are the same as in the " +
      "mechflow projects <code>Ch_O</code> and <code>Ch_S</code>, which are used for the DFT calculations.</p>" +
      META.about.sections.map(function (s) { return "<h2>" + esc(s[0]) + "</h2>" + s.slice(1).map(function (p) { return "<p>" + esc(p) + "</p>"; }).join(""); }).join("") +
      "<h2>Links</h2><p>The address can open a view directly, for example <code>#ch=S&amp;m=M2B&amp;step=S7b</code>, <code>#ch=O&amp;mol=I7a</code> " +
      "or <code>#m=M1A&amp;ts=3d</code>; <code>#m=M1A&amp;view=energy&amp;level=dft</code> opens its energy diagram with the DFT energies (<code>level=sp</code>: the single points); " +
      "<code>#tab=net&amp;nview=energy</code> opens the energy landscape.</p>";
  }

  // ------------------------------------------------------------------ top bar
  function setTab(t) {
    if (TABS.indexOf(t) < 0) return;
    S.tab = t;
    $$("#tabs button").forEach(function (b) { b.classList.toggle("on", b.dataset.tab === t); });
    $$(".tab").forEach(function (s) { s.classList.toggle("on", s.id === "tab-" + t); });
    if (t === "mech" && zoomNow() === "fit") zoom("fit");
    if (t === "net") { showNet(); if (net.needFit) netFit(); }
  }
  function setCh(c) {
    if ((c !== "O" && c !== "S") || c === S.ch) return;
    S.ch = c;
    $$("#chsel button").forEach(function (b) { b.classList.toggle("on", b.dataset.ch === c); });
    famList(); tables(); about();
    showMech(S.mech && baseMech(S.mech) ? S.mech : firstMech());
    showNet();
  }
  $("#tabs").addEventListener("click", function (e) { if (e.target.dataset.tab) setTab(e.target.dataset.tab); });
  $("#chsel").addEventListener("click", function (e) { if (e.target.dataset.ch) setCh(e.target.dataset.ch); });
  $("#q").addEventListener("input", function () {
    famList(); tables(); if (net.ch) routeList();
    var up = query().toUpperCase();
    if (S.tab === "net") { netFind(query()); if (up && routeOf(up)) pickRoute(up); return; }
    if (up && baseMech(up)) { setTab("mech"); showMech(up); }
  });
  window.addEventListener("resize", function () { if (zoomNow() === "fit") zoom("fit"); if (S.tab === "net" && net.el && !moves()) netFit(); });

  // ------------------------------------------------------------------ start
  var H = Object.create(null);
  // deep links: #ch=S&m=M2B&step=S7b&dir=fwd&mol=I7b,R2&tab=steps&pane=p&ts=3d&tab=net&route=M6A&view=energy&level=dft
  (location.hash || "").replace(/^#/, "").split("&").forEach(function (kv) {
    var q = kv.split("=");
    if (q[0]) { try { H[q[0]] = decodeURIComponent(q[1] || ""); } catch (e) { H[q[0]] = ""; } }
  });
  if (H.ch === "S" || H.ch === "O") { S.ch = H.ch; $$("#chsel button").forEach(function (b) { b.classList.toggle("on", b.dataset.ch === S.ch); }); }
  if (H.ts === "2d" || H.ts === "3d") S.mts3d = H.ts === "3d";       // #ts=: the mechanism view
  if (H.view === "energy" || H.view === "mech") S.energy = H.view === "energy";   // #view=: drawing or energy diagram
  if (H.level === "sp" || H.level === "dft") S.elevel = H.level;                  // #level=: the energies' level
  if (H.nview === "energy" || H.nview === "net") S.nenergy = H.nview === "energy"; // #nview=: network or energy landscape
  famList(); tables(); about(); applyMechTS(); applyView();
  showMech(baseMech(H.m) ? H.m : firstMech());
  showNet();
  if (H.route && routeOf(H.route)) pickRoute(H.route);
  if (H.tab) setTab(H.tab);
  if (H.step) openStep(H.step, H.dir || "fwd");
  if (H.mol) openMol(H.mol.split(","));
  if (/^[a-z]$/.test(H.pane || "")) setTimeout(function () { var b = document.querySelector(".win .tabs button[data-p='" + H.pane + "']"); if (b) b.click(); }, 300);
})();
