/* Hydantoin Proposed Mechanisms: the three proposed mechanisms (M1-M3) of the two mechflow projects (Ch_O, Ch_S),
   their species and steps, structures in 3D and the TS guesses. A static page: it reads only this site's own files
   (data/*.js, loaded as scripts so that it also works from file://) and talks to nothing else. */
(function () {
  "use strict";
  var S = { ch: "O", tab: "mech", mech: null, zoom: null, top: 100, ts3d: false };
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };
  var CHN = { O: "urea", S: "thiourea" };
  var TABS = ["mech", "species", "steps", "about"];
  var NODRAW = "No drawing for this step yet: rebuild the website (make_website.py) to draw it.";

  (function prefs() {                    // per-viewer conveniences only
    try { S.ts3d = JSON.parse(localStorage.getItem("hpm.prefs") || "{}").ts3d === true; } catch (e) { /* no storage */ }
  })();
  function savePrefs() {
    try { localStorage.setItem("hpm.prefs", JSON.stringify({ ts3d: S.ts3d })); } catch (e) { /* no storage */ }
  }

  // ------------------------------------------------------------------ data files loaded on demand (works from file://)
  function load(kind, ch, id) {
    return new Promise(function (res, rej) {
      var key = kind + "/" + ch + "/" + id;
      if (__cache[key] !== undefined) { res(__cache[key]); return; }
      (__wait[key] = __wait[key] || []).push(res);
      if (__wait[key].length > 1) return;
      var s = document.createElement("script");
      s.src = "data/" + kind + "/" + ch + "/" + encodeURIComponent(id) + ".js";
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
      "<div class='pane on' data-p='d'><div class='seg tsswitch' role='group' aria-label='TS picture' hidden><button data-ts='2d'>2D</button>" +
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
    function show3d(on) {
      dBox.classList.toggle("show3d", on);
      $$("button", sw).forEach(function (b) { var o = (b.dataset.ts === "3d") === on; b.classList.toggle("on", o); b.setAttribute("aria-pressed", o ? "true" : "false"); });
    }
    sw.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-ts]"); if (!b) return;
      S.ts3d = b.dataset.ts === "3d"; savePrefs(); show3d(S.ts3d);
    });
    if (st.drawn === false) dBox.textContent = NODRAW;
    else load("step", ch, sid + "_" + dir).then(function (svg) {
      dBox.innerHTML = svg;
      var both = !!dBox.querySelector(".ts3d") && !!dBox.querySelector(".ts2d");
      sw.hidden = !both;
      show3d(both && S.ts3d);
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
  function famList() {
    var q = query(), mm = M().mechanisms, F = META.families, major = META.major[S.ch], out = "";
    var ids = Object.keys(mm).sort(nat).filter(function (mid) {
      var m = mm[mid], f = F[m.family] || {};
      return !q || (mid + " " + m.name + " " + (f.text || "") + " " + m.product + " " + m.steps.join(" ")).toLowerCase().indexOf(q) >= 0 ||
        m.steps.some(function (s) { return s.toLowerCase() === q; });
    });
    out += "<div class='group'><h3>Proposed mechanisms (" + esc(CHN[S.ch]) + ")</h3>";
    ids.forEach(function (mid) {
      var m = mm[mid], f = F[m.family] || {};
      out += "<div class='fam" + (S.mech === mid ? " on" : "") + "' data-m='" + esc(mid) + "' tabindex='0' role='button'><span class='id'>" + esc(mid) +
        "</span><span class='prod'>&rarr; " + esc(m.product) + " (" + esc(META.iso[m.product] || "") + ")</span>" +
        (m.product === major ? "<span class='bdg obs' title='the isomer observed as the major product with the " + esc(CHN[S.ch]) + "'>observed major</span>" : "") +
        "<div class='txt'>" + esc(chText(f.title || m.name)) + "</div><div class='txt more'>" + esc(chText(f.text || "")) + "</div></div>";
    });
    if (!ids.length) out += "<div class='hint'>No mechanism matches.</div>";
    out += "</div><div class='famnote'>" + esc(META.note[S.ch]) + "</div>";
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
    load("mech", ch, mid).then(function (svg) {
      if (S.mech !== mid || S.ch !== ch) return;
      $("#mechview").innerHTML = svg; zoom(S.zoom || "fit");
    }, function () {
      if (S.mech !== mid || S.ch !== ch) return;
      $("#mechview").innerHTML = "<div class='hint'>No drawing of this mechanism yet: rebuild the website (make_website.py) to draw it.</div>";
    });
  }
  function zoom(z) {
    var svg = $("#mechview svg"); if (!svg) return;
    var w0 = +svg.getAttribute("width") || svg.viewBox.baseVal.width, h0 = +svg.getAttribute("height") || svg.viewBox.baseVal.height;
    if (!svg.dataset.w) { svg.dataset.w = w0; svg.dataset.h = h0; }
    var W = +svg.dataset.w, H = +svg.dataset.h, cur = svg.getBoundingClientRect().width / W, f;
    var cw = $("#mechview").clientWidth;
    if (z === "fit" && cw < 50) { setTimeout(function () { zoom("fit"); }, 60); return; }
    if (z === "fit") f = (cw - 4) / W;
    else if (z === "+") f = cur * 1.25; else if (z === "-") f = cur / 1.25; else f = +z;
    svg.setAttribute("width", W * f); svg.setAttribute("height", H * f); S.zoom = z === "+" || z === "-" ? f : z;
  }
  $("#famlist").addEventListener("click", function (e) { var f = e.target.closest(".fam[data-m]"); if (f) showMech(f.getAttribute("data-m")); });
  $("#famlist").addEventListener("keydown", function (e) {
    var f = e.target.closest(".fam[data-m]");
    if (f && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); showMech(f.getAttribute("data-m")); }
  });
  $("#mechview").addEventListener("click", function (e) {
    var lk = e.target.closest(".lk"); if (lk) { openStep(lk.dataset.step, lk.dataset.dir); return; }
    var sp = e.target.closest(".sp"); if (sp) openMol(sp.dataset.ids.split(" "));
  });
  $$(".zoombar button[data-z]").forEach(function (b) { b.onclick = function () { zoom(b.dataset.z); }; });

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
      "<h2>Links</h2><p>The address can open a view directly, for example <code>#ch=S&amp;m=M2&amp;step=S7b</code> or <code>#ch=O&amp;mol=I7a</code>.</p>";
  }

  // ------------------------------------------------------------------ top bar
  function setTab(t) {
    if (TABS.indexOf(t) < 0) return;
    S.tab = t;
    $$("#tabs button").forEach(function (b) { b.classList.toggle("on", b.dataset.tab === t); });
    $$(".tab").forEach(function (s) { s.classList.toggle("on", s.id === "tab-" + t); });
    if (t === "mech" && S.zoom === "fit") zoom("fit");
  }
  function setCh(c) {
    if ((c !== "O" && c !== "S") || c === S.ch) return;
    S.ch = c;
    $$("#chsel button").forEach(function (b) { b.classList.toggle("on", b.dataset.ch === c); });
    famList(); tables(); about();
    showMech(S.mech && baseMech(S.mech) ? S.mech : firstMech());
  }
  $("#tabs").addEventListener("click", function (e) { if (e.target.dataset.tab) setTab(e.target.dataset.tab); });
  $("#chsel").addEventListener("click", function (e) { if (e.target.dataset.ch) setCh(e.target.dataset.ch); });
  $("#q").addEventListener("input", function () {
    famList(); tables();
    var up = query().toUpperCase();
    if (up && baseMech(up)) { setTab("mech"); showMech(up); }
  });
  window.addEventListener("resize", function () { if (S.zoom === "fit") zoom("fit"); });

  // ------------------------------------------------------------------ start
  var H = Object.create(null);
  // deep links: #ch=S&m=M2&step=S7b&dir=fwd&mol=I7b,R2&tab=steps&pane=p
  (location.hash || "").replace(/^#/, "").split("&").forEach(function (kv) {
    var q = kv.split("=");
    if (q[0]) { try { H[q[0]] = decodeURIComponent(q[1] || ""); } catch (e) { H[q[0]] = ""; } }
  });
  if (H.ch === "S" || H.ch === "O") { S.ch = H.ch; $$("#chsel button").forEach(function (b) { b.classList.toggle("on", b.dataset.ch === S.ch); }); }
  famList(); tables(); about();
  showMech(baseMech(H.m) ? H.m : firstMech());
  if (H.tab) setTab(H.tab);
  if (H.step) openStep(H.step, H.dir || "fwd");
  if (H.mol) openMol(H.mol.split(","));
  if (/^[a-z]$/.test(H.pane || "")) setTimeout(function () { var b = document.querySelector(".win .tabs button[data-p='" + H.pane + "']"); if (b) b.click(); }, 300);
})();
