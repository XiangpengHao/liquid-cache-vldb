/* LiquidCache VLDB deck runtime */
(function () {
  const slides = Array.from(document.querySelectorAll(".slide"));
  const frame = document.getElementById("frame");
  const progress = document.getElementById("progress");
  let cur = 0;

  const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const CAN_ANIMATE = "animate" in Element.prototype && !REDUCED;
  const EASE = "cubic-bezier(0.16, 1, 0.3, 1)";

  /* ---------- scaling ---------- */
  function fit() {
    if (!window.innerWidth || !window.innerHeight) return;
    const s = Math.min(window.innerWidth / 1280, window.innerHeight / 720);
    frame.style.transform = `scale(${s})`;
  }
  window.addEventListener("resize", fit);
  fit();

  /* ---------- staged reveals ----------
     A slide may disclose itself in steps: elements carrying data-step="N"
     appear on the Nth advance, so the audience never faces a wall of text.
     Hidden steps keep their layout box, so nothing reflows as they arrive. */
  let step = 0;
  const maxStep = (sl) =>
    Array.from(sl.querySelectorAll("[data-step]"))
      .reduce((m, el) => Math.max(m, +el.dataset.step || 0), 0);

  function paintSteps(sl, reveal) {
    sl.querySelectorAll("[data-step]").forEach((el) => {
      const n = +el.dataset.step || 0;
      const on = n <= step;
      const was = el.classList.contains("shown");
      el.classList.toggle("shown", on);
      if (on && !was && reveal && CAN_ANIMATE) {
        const kids = el.querySelectorAll("li, .chip, .fmt-txt, .fmt-logo");
        fx(el, RISE_F, RISE_T, { d: 480 });
        if (kids.length) fx(kids, FADE_F, FADE_T, { t: 160, st: 55, d: 340 });
      }
    });
  }

  /* ---------- navigation ---------- */
  function show(i, atEnd) {
    const prev = cur;
    cur = Math.max(0, Math.min(slides.length - 1, i));
    const sl = slides[cur];
    step = atEnd ? maxStep(sl) : 0;
    slides.forEach((s2, j) => s2.classList.toggle("current", j === cur));
    paintSteps(sl, false);
    progress.style.transform = `scaleX(${(cur + 1) / slides.length})`;
    if (location.hash !== `#${cur + 1}`) history.replaceState(null, "", `#${cur + 1}`);
    syncLoops();
    if (prev !== cur || !booted) runBuild(cur);
  }
  function fromHash() {
    const n = parseInt(location.hash.slice(1), 10);
    show(Number.isFinite(n) ? n - 1 : 0);
  }
  window.addEventListener("hashchange", fromHash);

  function advance() {
    const sl = slides[cur];
    if (step < maxStep(sl)) { step++; paintSteps(sl, true); }
    else show(cur + 1);
  }
  function retreat() {
    const sl = slides[cur];
    if (step > 0) { step--; paintSteps(sl, false); }
    else if (cur > 0) show(cur - 1, true); // returning: show the finished slide
  }

  window.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown":
      case "PageDown":
      case " ":
        e.preventDefault(); advance(); break;
      case "ArrowLeft":
      case "ArrowUp":
      case "PageUp":
      case "Backspace":
        e.preventDefault(); retreat(); break;
      case "Home": e.preventDefault(); show(0); break;
      case "End": e.preventDefault(); show(slides.length - 1, true); break;
    }
  });

  let touchX = null;
  window.addEventListener("touchstart", (e) => { touchX = e.touches[0].clientX; }, { passive: true });
  window.addEventListener("touchend", (e) => {
    if (touchX === null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 50) (dx < 0 ? advance() : retreat());
    touchX = null;
  }, { passive: true });

  /* ---------- slide 14: lake / cache grids ---------- */
  const NS = "http://www.w3.org/2000/svg";
  function cell(x, y, w, h, fill, stroke, cls) {
    const r = document.createElementNS(NS, "rect");
    r.setAttribute("x", x); r.setAttribute("y", y);
    r.setAttribute("width", w); r.setAttribute("height", h);
    r.setAttribute("rx", 4);
    r.setAttribute("fill", fill);
    if (stroke) r.setAttribute("stroke", stroke);
    if (cls) r.setAttribute("class", cls);
    return r;
  }

  const lake = document.getElementById("lake");
  if (lake) {
    // 12 x 5 grid; a fixed "hot" subset (deterministic, hand-picked for looks)
    const hot = new Set([3, 4, 16, 17, 27, 41]);
    const COLS = 12, SIZE = 38, GAP = 8;
    for (let i = 0; i < COLS * 5; i++) {
      const x = (i % COLS) * (SIZE + GAP);
      const y = Math.floor(i / COLS) * (SIZE + GAP);
      const isHot = hot.has(i);
      // hot cells stay Parquet-blue in the lake; the orange stroke marks
      // them as selected for transcoding (they turn orange in the cache)
      lake.appendChild(cell(x, y, SIZE, SIZE,
        isHot ? "#e9eff6" : "#f1efe8",
        isHot ? "#c05621" : "#dedbd1",
        isHot ? "pop lake-hot" : "lake-cold"));
    }
    // cache grid: only the hot cells, packed and centered in the cache box
    const cg = document.getElementById("cachegrid");
    const n = hot.size;
    for (let i = 0; i < n; i++) {
      const x = (i % 3) * (SIZE + GAP) + 83;
      const y = Math.floor(i / 3) * (SIZE + GAP) + 50;
      cg.appendChild(cell(x, y, SIZE, SIZE, "#f5d8bd", "#c05621", "pop cache-chip"));
    }
  }

  /* ---------- slide 15: cold-run bars ---------- */
  const cold = document.getElementById("coldbars");
  if (cold) {
    // seconds; measured on ClickBench (paper Fig: cold-latency)
    const data = [
      { name: "S3, far", p: 22.5, l: 23.8 },
      { name: "S3", p: 15.2, l: 15.0 },
      { name: "MinIO", p: 9.8, l: 9.2 },
      { name: "SSD", p: 5.5, l: 5.8 },
      { name: "memory", p: 1.2, l: 1.7 },
    ];
    const BASE = 356, SCALE = 10.56; // y = BASE - s * SCALE  (25 s -> y=92)
    const GX = 144, GW = 196, BW = 58, BG = 12;
    const colors = { p: "#3d6b99", l: "#c05621" };
    data.forEach((d, gi) => {
      const x0 = GX + gi * GW;
      ["p", "l"].forEach((k, bi) => {
        const h = d[k] * SCALE;
        const r = document.createElementNS(NS, "rect");
        r.setAttribute("x", x0 + bi * (BW + BG));
        r.setAttribute("y", BASE - h);
        r.setAttribute("width", BW);
        r.setAttribute("height", h);
        r.setAttribute("rx", 4);
        r.setAttribute("fill", colors[k]);
        r.setAttribute("class", "c-bar grow-y");
        cold.appendChild(r);
      });
      const t = document.createElementNS(NS, "text");
      t.setAttribute("x", x0 + (BW * 2 + BG) / 2);
      t.setAttribute("y", BASE + 36);
      t.setAttribute("text-anchor", "middle");
      t.setAttribute("class", "t-mono c-lab");
      t.textContent = d.name;
      cold.appendChild(t);
    });
  }

  /* =====================================================================
     Motion system. Two kinds:
     - loops: meaning-carrying repeats (slide 2 cycle, dash-flow on network
       edges, transcode pulse); run only while their slide is on screen.
     - builds: one-shot entrances that stage each slide's argument; they
       replay on slide entry. With prefers-reduced-motion, neither runs and
       every slide simply shows its finished state.
     ===================================================================== */

  const loops = []; // { idx, anim }
  function addLoop(idx, anim) { anim.pause(); loops.push({ idx, anim }); }
  function syncLoops() {
    loops.forEach((l) => (l.idx === cur ? l.anim.play() : l.anim.pause()));
  }

  /* ---------- slide 2: takeaway loop ----------
     One 14 s cycle tells the thesis: cool-format copies leave the archive
     (originals stay — archival), morph warm at the cache boundary, dock
     into slots (cached), serve pulses stream to compute (serve every
     query), then the cached chips fade (ephemeral) and the cycle restarts. */
  const animRoot = document.getElementById("takeaway-anim");
  if (animRoot && !CAN_ANIMATE) animRoot.classList.add("motion-off");
  if (animRoot && CAN_ANIMATE) {
    const MASTER = 14000;
    const OPTS = { duration: MASTER, iterations: Infinity };
    const DX = 391; // store slot -> matching cache slot

    animRoot.querySelectorAll(".fly").forEach((g, i) => {
      const m = /translate\((\d+)px,\s*(\d+)px\)/.exec(g.style.transform);
      const x = +m[1], y = +m[2];
      const at = (dx, dy) => `translate(${x + dx}px, ${y + dy}px)`;
      const o = 0.03 + i * 0.115; // staggered departures
      addLoop(1, g.animate([
        { offset: 0,         opacity: 0, transform: at(0, 0) },
        { offset: o,         opacity: 0, transform: at(0, 0) },
        { offset: o + 0.008, opacity: 1, transform: at(0, 0), easing: "cubic-bezier(0.45, 0, 0.55, 1)" },
        { offset: o + 0.09,  opacity: 1, transform: at(DX, 2) },
        { offset: o + 0.104, opacity: 1, transform: at(DX, 0) },
        { offset: 0.9,       opacity: 1, transform: at(DX, 0) },
        { offset: 0.945,     opacity: 0, transform: at(DX, 0) },
        { offset: 1,         opacity: 0, transform: at(0, 0) },
      ], OPTS));
      // cool -> warm morph while crossing the gap between the boxes
      const cool = g.querySelector(".fly-cool");
      const warm = g.querySelector(".fly-warm");
      addLoop(1, cool.animate([
        { offset: 0,         opacity: 1 },
        { offset: o + 0.06,  opacity: 1 },
        { offset: o + 0.082, opacity: 0 },
        { offset: 1,         opacity: 0 },
      ], OPTS));
      addLoop(1, warm.animate([
        { offset: 0,         opacity: 0 },
        { offset: o + 0.06,  opacity: 0 },
        { offset: o + 0.082, opacity: 1 },
        { offset: 1,         opacity: 1 },
      ], OPTS));
    });

    animRoot.querySelectorAll(".pulse").forEach((c, j) => {
      const s = 0.5 + j * 0.08; // pulses begin once the cache is filling
      addLoop(1, c.animate([
        { offset: 0,         opacity: 0,   transform: "translate(0px, 0px)" },
        { offset: s,         opacity: 0,   transform: "translate(0px, 0px)" },
        { offset: s + 0.008, opacity: 0.9, transform: "translate(4px, 0px)", easing: "ease-in-out" },
        { offset: s + 0.066, opacity: 0.9, transform: "translate(62px, 0px)" },
        { offset: s + 0.075, opacity: 0,   transform: "translate(70px, 0px)" },
        { offset: 1,         opacity: 0,   transform: "translate(70px, 0px)" },
      ], OPTS));
    });
  }

  /* ---------- loops: fetch traffic flows along dashed network edges ---------- */
  if (CAN_ANIMATE) {
    [2, 3, 8, 11].forEach((idx) => {
      const line = slides[idx] && slides[idx].querySelector("svg line[stroke-dasharray]");
      if (line) {
        addLoop(idx, line.animate(
          [{ strokeDashoffset: 0 }, { strokeDashoffset: -22 }],
          { duration: 1400, iterations: Infinity, easing: "linear" }
        ));
      }
    });
    // slide 4: the transcode arrow inside the cache breathes
    const tp = document.querySelector(".tpulse");
    if (tp) {
      addLoop(3, tp.animate(
        [{ opacity: 1 }, { opacity: 0.45 }, { opacity: 1 }],
        { duration: 2600, iterations: Infinity, easing: "ease-in-out" }
      ));
    }
  }

  /* ---------- builds and step reveals share one helper ---------- */
  function fx(els, from, to, opt) {
    els = els instanceof Element ? [els] : Array.from(els || []);
    els.forEach((el, k) => el.animate([from, to], {
      duration: opt.d || 520,
      delay: (opt.t || 0) + k * (opt.st || 0),
      easing: opt.e || EASE,
      fill: "backwards",
    }));
  }
  const RISE_F = { opacity: 0, transform: "translateY(16px)" };
  const RISE_T = { opacity: 1, transform: "translateY(0px)" };
  const FADE_F = { opacity: 0 };
  const FADE_T = { opacity: 1 };
  const POP_F = { opacity: 0, transform: "scale(0.6)" };
  const POP_T = { opacity: 1, transform: "scale(1)" };

  function head(sl, t) {
    fx(sl.querySelectorAll(".kicker, h1"), RISE_F, RISE_T, { t: t || 0, st: 60, d: 420 });
  }

  const builds = {
    0(sl) { // title
      fx(sl.querySelector(".brand"), FADE_F, FADE_T, { t: 0, d: 480 });
      fx(sl.querySelector(".mid"), RISE_F, RISE_T, { t: 120, d: 560 });
      fx(sl.querySelector(".foot"), RISE_F, RISE_T, { t: 300, d: 520 });
    },
    1(sl) { // takeaway: the loop carries the story; the frame settles in
      fx(sl.querySelector(".hero"), RISE_F, RISE_T, { d: 560 });
      fx(sl.querySelector("svg"), FADE_F, FADE_T, { t: 180, d: 480 });
      fx(sl.querySelectorAll(".pair .item"), RISE_F, RISE_T, { t: 320, st: 120, d: 480 });
    },
    2(sl) { head(sl); fx(sl.querySelector("svg"), RISE_F, RISE_T, { t: 140, d: 560 }); },
    3(sl) { head(sl); fx(sl.querySelector("svg"), RISE_F, RISE_T, { t: 140, d: 560 }); },
    4(sl) { // roadmap
      fx(sl.querySelector(".anchor"), FADE_F, FADE_T, { d: 420 });
      fx(sl.querySelectorAll(".part"), RISE_F, RISE_T, { t: 120, st: 160, d: 520 });
    },
    5(sl) { head(sl); }, // panels and the format wall arrive as steps
    6(sl) { // ladder builds generation by generation
      head(sl);
      const steps = sl.querySelectorAll(".step");
      const hops = sl.querySelectorAll(".hop");
      const hoplabs = sl.querySelectorAll(".hoplab");
      fx(sl.querySelectorAll("svg line, svg text.t-mono-f"), FADE_F, FADE_T, { t: 80, d: 420 });
      fx(steps[0], RISE_F, RISE_T, { t: 120, d: 480 });
      fx(hops[0], FADE_F, FADE_T, { t: 420, d: 320 });
      fx(hoplabs[0], FADE_F, FADE_T, { t: 480, d: 360 });
      fx(steps[1], RISE_F, RISE_T, { t: 620, d: 480 });
      fx(hops[1], FADE_F, FADE_T, { t: 920, d: 320 });
      fx(hoplabs[1], FADE_F, FADE_T, { t: 980, d: 360 });
      fx(steps[2], RISE_F, RISE_T, { t: 1120, d: 480 });
      fx(sl.querySelector(".ev"), RISE_F, RISE_T, { t: 1420, d: 480 });
    },
    7(sl) { // two dead ends, then the verdict
      head(sl);
      const opts = sl.querySelectorAll(".opt");
      fx(opts[0], { opacity: 0, transform: "translateX(-24px)" }, { opacity: 1, transform: "translateX(0px)" }, { t: 120, d: 520 });
      fx(opts[1], { opacity: 0, transform: "translateX(24px)" }, { opacity: 1, transform: "translateX(0px)" }, { t: 260, d: 520 });
      fx(sl.querySelectorAll(".opt li"), FADE_F, FADE_T, { t: 480, st: 60, d: 360 });
      fx(sl.querySelector(".verdict"), RISE_F, RISE_T, { t: 820, d: 520 });
    },
    8(sl) { // the approach: many formats in, one Liquid out
      head(sl);
      fx(sl.querySelector("svg"), RISE_F, RISE_T, { t: 120, d: 560 });
      fx(sl.querySelectorAll(".sfmt"), POP_F, POP_T, { t: 360, st: 90, d: 380 });
      fx(sl.querySelectorAll(".fmt"), POP_F, POP_T, { t: 800, d: 520 });
    },
    9(sl) { // payoff closes part 1
      head(sl);
      fx(sl.querySelectorAll(".stat"), RISE_F, RISE_T, { t: 140, st: 140, d: 540 });
      fx(sl.querySelector(".methods"), FADE_F, FADE_T, { t: 660, d: 420 });
    },
    10(sl) { // roadmap 2
      fx(sl.querySelector(".anchor"), FADE_F, FADE_T, { d: 420 });
      fx(sl.querySelectorAll(".part"), RISE_F, RISE_T, { t: 120, st: 160, d: 520 });
    },
    11(sl) { // mandatory: topology first, claim lands after
      head(sl);
      fx(sl.querySelector("svg"), FADE_F, FADE_T, { t: 100, d: 480 });
      fx(sl.querySelector(".claim"), RISE_F, RISE_T, { t: 560, d: 620 });
    },
    12(sl) { // idle CPUs: watch the bars fill busy, busy, . . . idle
      head(sl);
      fx(sl.querySelector("svg"), FADE_F, FADE_T, { t: 80, d: 420 });
      fx(sl.querySelectorAll(".u-fill"), { transform: "scaleX(0)" }, { transform: "scaleX(1)" }, { t: 260, st: 200, d: 680 });
      fx(sl.querySelectorAll(".u-idle"), FADE_F, FADE_T, { t: 1080, d: 460 });
      fx(sl.querySelector(".body > svg > text.t-lab, svg > text.t-lab"), FADE_F, FADE_T, { t: 1300, d: 420 });
    },
    13(sl) { // lazy: queries touch cells, touched cells reach the cache
      head(sl);
      fx(sl.querySelector("svg"), FADE_F, FADE_T, { t: 60, d: 380 });
      fx(sl.querySelectorAll("#lake rect"), FADE_F, FADE_T, { t: 160, st: 4, d: 260, e: "ease-out" });
      sl.querySelectorAll(".lake-hot").forEach((c, k) => {
        c.animate(
          [{ transform: "scale(1)" }, { transform: "scale(1.18)" }, { transform: "scale(1)" }],
          { duration: 340, delay: 700 + k * 140, easing: "ease-in-out" }
        );
      });
      fx(sl.querySelectorAll(".cache-chip"), POP_F, POP_T, { t: 880, st: 140, d: 400 });
    },
    14(sl) { // evidence chart: bars grow in reading order
      head(sl);
      fx(sl.querySelector("svg"), FADE_F, FADE_T, { t: 60, d: 420 });
      fx(sl.querySelectorAll(".c-bar"), { transform: "scaleY(0)" }, { transform: "scaleY(1)" }, { t: 240, st: 55, d: 520 });
      fx(sl.querySelectorAll(".c-lab"), FADE_F, FADE_T, { t: 320, st: 165, d: 380 });
      fx(sl.querySelector(".tline"), FADE_F, FADE_T, { t: 1280, d: 420 });
    },
    15(sl) { // conclusion echoes the takeaway
      fx(sl.querySelector(".hero"), RISE_F, RISE_T, { d: 560 });
      fx(sl.querySelectorAll(".pair .item"), RISE_F, RISE_T, { t: 220, st: 120, d: 480 });
      fx(sl.querySelector(".links"), RISE_F, RISE_T, { t: 480, d: 520 });
    },
  };

  function runBuild(i) {
    if (!CAN_ANIMATE) return;
    const b = builds[i];
    if (b) b(slides[i]);
  }

  let booted = false;
  fromHash();
  booted = true;
})();
