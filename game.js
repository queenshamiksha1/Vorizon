/* ==========================================================================
   VORIZON — Retro Town Racer
   A polished 2D top-down arcade racing game through a neon-lit town.
   Single-file vanilla JS game engine (canvas 2D).
   ========================================================================== */

(() => {
  "use strict";

  // ------------------------------------------------------------------------
  // Canvas & context
  // ------------------------------------------------------------------------
  const canvas = document.getElementById("game-canvas");
  const ctx = canvas.getContext("2d");
  const VW = canvas.width; // 960
  const VH = canvas.height; // 600

  // ------------------------------------------------------------------------
  // DOM references
  // ------------------------------------------------------------------------
  const el = {
    title: document.getElementById("screen-title"),
    howto: document.getElementById("screen-howto"),
    countdown: document.getElementById("screen-countdown"),
    countdownNumber: document.getElementById("countdown-number"),
    hud: document.getElementById("hud"),
    pause: document.getElementById("screen-pause"),
    results: document.getElementById("screen-results"),
    touch: document.getElementById("touch-controls"),

    btnStart: document.getElementById("btn-start"),
    btnHowto: document.getElementById("btn-howto"),
    btnHowtoClose: document.getElementById("btn-howto-close"),
    btnSound: document.getElementById("btn-sound"),
    diffRow: document.getElementById("difficulty-row"),

    btnResume: document.getElementById("btn-resume"),
    btnRestart: document.getElementById("btn-restart"),
    btnQuit: document.getElementById("btn-quit"),

    btnAgain: document.getElementById("btn-again"),
    btnTitle: document.getElementById("btn-title"),

    hiscoreValue: document.getElementById("hiscore-value"),

    hudTime: document.getElementById("hud-time"),
    hudScore: document.getElementById("hud-score"),
    hudCheckpoint: document.getElementById("hud-checkpoint"),
    speedNeedle: document.getElementById("speed-needle"),
    speedValue: document.getElementById("speed-value"),
    comboCluster: document.getElementById("combo-cluster"),
    comboText: document.getElementById("combo-text"),

    resultsTitle: document.getElementById("results-title"),
    resultsScore: document.getElementById("results-score"),
    resultsTime: document.getElementById("results-time"),
    resultsCheckpoints: document.getElementById("results-checkpoints"),
    resultsCombo: document.getElementById("results-combo"),
    resultsRank: document.getElementById("results-rank"),

    touchLeft: document.getElementById("touch-left-btn"),
    touchRight: document.getElementById("touch-right-btn"),
    touchBrake: document.getElementById("touch-brake-btn"),
    touchDrift: document.getElementById("touch-drift-btn"),
    touchGas: document.getElementById("touch-gas-btn"),
  };

  // ------------------------------------------------------------------------
  // Difficulty presets
  // ------------------------------------------------------------------------
  const DIFFICULTIES = {
    easy: { label: "CRUISE", time: 75, trafficDensity: 0.55, trafficSpeed: 0.75, name: "CRUISE" },
    normal: { label: "NORMAL", time: 60, trafficDensity: 0.85, trafficSpeed: 1.0, name: "NORMAL" },
    hard: { label: "RUSH HOUR", time: 50, trafficDensity: 1.25, trafficSpeed: 1.25, name: "RUSH HOUR" },
  };

  let currentDifficulty = "normal";
  let soundOn = true;

  // ------------------------------------------------------------------------
  // Simple synthesized SFX (WebAudio, no external assets)
  // ------------------------------------------------------------------------
  const AudioEngine = (() => {
    let actx = null;
    function ensure() {
      if (!actx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        actx = new AC();
      }
      if (actx.state === "suspended") actx.resume();
      return actx;
    }
    function beep({ freq = 440, dur = 0.1, type = "square", vol = 0.06, slideTo = null, delay = 0 }) {
      if (!soundOn) return;
      try {
        const ac = ensure();
        const t0 = ac.currentTime + delay;
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, t0);
        if (slideTo !== null) {
          osc.frequency.linearRampToValueAtTime(slideTo, t0 + dur);
        }
        gain.gain.setValueAtTime(vol, t0);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        osc.connect(gain).connect(ac.destination);
        osc.start(t0);
        osc.stop(t0 + dur + 0.02);
      } catch (e) {
        /* audio not available; fail silently */
      }
    }
    let musicTimer = null;
    let musicStep = 0;
    const musicBass = [110, 110, 146.83, 130.81, 110, 110, 98, 87.31];
    const musicLead = [
      [440, 0], [0, 0], [523.25, 0], [440, 0],
      [392, 0], [0, 0], [349.23, 0], [392, 0],
    ];
    function musicNote(freq, dur, type, vol, delay) {
      if (!freq) return;
      try {
        const ac = ensure();
        const t0 = ac.currentTime + delay;
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, t0);
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.linearRampToValueAtTime(vol, t0 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        osc.connect(gain).connect(ac.destination);
        osc.start(t0);
        osc.stop(t0 + dur + 0.02);
      } catch (e) {
        /* audio not available; fail silently */
      }
    }
    return {
      startMusic() {
        if (musicTimer) return;
        musicStep = 0;
        const stepDur = 0.28;
        musicTimer = setInterval(() => {
          if (!soundOn) return;
          const bassFreq = musicBass[musicStep % musicBass.length];
          musicNote(bassFreq, stepDur * 0.9, "triangle", 0.05, 0);
          const [leadFreq] = musicLead[musicStep % musicLead.length];
          if (leadFreq) musicNote(leadFreq, stepDur * 0.6, "square", 0.03, 0);
          musicStep++;
        }, stepDur * 1000);
      },
      stopMusic() {
        if (musicTimer) {
          clearInterval(musicTimer);
          musicTimer = null;
        }
      },
      engineTick(rpm) {
        beep({ freq: 60 + rpm * 90, dur: 0.05, type: "sawtooth", vol: 0.015 });
      },
      countdownBeep(final) {
        beep({ freq: final ? 880 : 500, dur: final ? 0.3 : 0.12, type: "square", vol: 0.08 });
      },
      checkpoint() {
        beep({ freq: 660, dur: 0.08, type: "square", vol: 0.08 });
        beep({ freq: 990, dur: 0.12, type: "square", vol: 0.08, delay: 0.07 });
      },
      crash() {
        beep({ freq: 140, dur: 0.28, type: "sawtooth", vol: 0.14, slideTo: 40 });
      },
      nearMiss() {
        beep({ freq: 1200, dur: 0.05, type: "sine", vol: 0.05 });
      },
      drift() {
        beep({ freq: 220, dur: 0.06, type: "triangle", vol: 0.02 });
      },
      finish() {
        [523, 659, 784, 1047].forEach((f, i) =>
          beep({ freq: f, dur: 0.18, type: "square", vol: 0.09, delay: i * 0.12 })
        );
      },
      timeUp() {
        [400, 320, 240].forEach((f, i) => beep({ freq: f, dur: 0.25, type: "sawtooth", vol: 0.1, delay: i * 0.18 }));
      },
      uiClick() {
        beep({ freq: 700, dur: 0.05, type: "square", vol: 0.05 });
      },
    };
  })();

  // ------------------------------------------------------------------------
  // Utility
  // ------------------------------------------------------------------------
  const TAU = Math.PI * 2;
  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }
  function lerp(a, b, t) {
    return a + (b - a) * t;
  }
  function dist(ax, ay, bx, by) {
    return Math.hypot(ax - bx, ay - by);
  }
  function angleLerp(a, b, t) {
    let diff = ((b - a + Math.PI) % TAU) - Math.PI;
    if (diff < -Math.PI) diff += TAU;
    return a + diff * t;
  }
  function rand(min, max) {
    return Math.random() * (max - min) + min;
  }
  function randInt(min, max) {
    return Math.floor(rand(min, max + 1));
  }
  function choice(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // ------------------------------------------------------------------------
  // World / Town layout
  // A grid-based city: horizontal & vertical road corridors forming blocks.
  // World is larger than the screen; camera follows the player.
  // ------------------------------------------------------------------------
  const WORLD = {
    width: 4400,
    height: 4400,
    blockSize: 400,
    roadWidth: 160,
  };

  const BUILDING_PALETTES = [
    { base: "#1a1436", roof: "#2c1f57", glow: "#ff5ecb" },
    { base: "#0f2438", roof: "#173a56", glow: "#29ffe0" },
    { base: "#33123c", roof: "#4d1f5c", glow: "#ffd23f" },
    { base: "#0f3a34", roof: "#1a5c4f", glow: "#6bffb0" },
    { base: "#3a1a12", roof: "#5c2a1a", glow: "#ff8a3d" },
    { base: "#141b3a", roof: "#20295c", glow: "#7ea6ff" },
  ];

  // Buildings occupy the interior of each block (inset from road edges)
  const buildings = [];
  const decorations = []; // trees, lamp posts, benches
  const checkpoints = [];

  function buildTown() {
    buildings.length = 0;
    decorations.length = 0;
    checkpoints.length = 0;

    const cols = Math.floor(WORLD.width / WORLD.blockSize);
    const rows = Math.floor(WORLD.height / WORLD.blockSize);

    for (let cy = 0; cy < rows; cy++) {
      for (let cx = 0; cx < cols; cx++) {
        const blockX = cx * WORLD.blockSize;
        const blockY = cy * WORLD.blockSize;
        const inset = WORLD.roadWidth / 2 + 18;
        const bx = blockX + inset;
        const by = blockY + inset;
        const bw = WORLD.blockSize - inset * 2;
        const bh = WORLD.blockSize - inset * 2;

        if (bw < 40 || bh < 40) continue;

        // Occasionally leave a block as a park (no building) for variety
        const isPark = (cx * 7 + cy * 13) % 11 === 0;
        if (isPark) {
          decorations.push({ type: "park", x: bx, y: by, w: bw, h: bh });
          // scatter trees
          const treeCount = 6;
          for (let i = 0; i < treeCount; i++) {
            decorations.push({
              type: "tree",
              x: bx + rand(20, bw - 20),
              y: by + rand(20, bh - 20),
            });
          }
          continue;
        }

        const palette = BUILDING_PALETTES[(cx * 3 + cy * 5) % BUILDING_PALETTES.length];
        // subdivide some blocks into 2x2 smaller buildings for variety
        const subdivide = (cx + cy) % 3 === 0 && bw > 120 && bh > 120;
        if (subdivide) {
          const gap = 14;
          const hw = (bw - gap) / 2;
          const hh = (bh - gap) / 2;
          for (let sx = 0; sx < 2; sx++) {
            for (let sy = 0; sy < 2; sy++) {
              buildings.push({
                x: bx + sx * (hw + gap),
                y: by + sy * (hh + gap),
                w: hw,
                h: hh,
                palette,
                height: rand(0.5, 1.4),
                windows: [],
              });
            }
          }
        } else {
          buildings.push({
            x: bx,
            y: by,
            w: bw,
            h: bh,
            palette,
            height: rand(0.6, 1.8),
            windows: [],
          });
        }
      }
    }

    // Precompute window grid + lit state per building for skyline detail
    for (const b of buildings) {
      const winW = 10;
      const winH = 12;
      const gapX = 8;
      const gapY = 14;
      const cols2 = Math.max(1, Math.floor((b.w - gapX) / (winW + gapX)));
      const rows2 = Math.max(1, Math.floor((b.h - gapY) / (winH + gapY)));
      for (let r = 0; r < rows2; r++) {
        for (let c = 0; c < cols2; c++) {
          b.windows.push({
            x: c * (winW + gapX) + gapX,
            y: r * (winH + gapY) + gapY,
            lit: Math.random() < 0.4,
            flicker: Math.random() < 0.05,
          });
        }
      }
    }

    // Lamp posts along road edges (sparse)
    for (let cy = 0; cy < rows; cy++) {
      for (let cx = 0; cx < cols; cx++) {
        if ((cx + cy) % 2 === 0) {
          decorations.push({
            type: "lamp",
            x: cx * WORLD.blockSize + WORLD.roadWidth / 2 - 10,
            y: cy * WORLD.blockSize + WORLD.roadWidth / 2 - 10,
          });
        }
      }
    }

    // Checkpoints along a loop path through the town (visit road intersections)
    const loopPoints = [];
    const marginCols = 1;
    const usableCols = cols - marginCols * 2;
    const usableRows = rows - marginCols * 2;
    const loopCount = 12;
    for (let i = 0; i < loopCount; i++) {
      const t = (i / loopCount) * TAU;
      const rx = (usableCols / 2) * 0.85;
      const ry = (usableRows / 2) * 0.85;
      const gx = Math.round(cols / 2 + Math.cos(t) * rx);
      const gy = Math.round(rows / 2 + Math.sin(t) * ry);
      loopPoints.push({
        x: clamp(gx, marginCols, cols - marginCols) * WORLD.blockSize,
        y: clamp(gy, marginCols, rows - marginCols) * WORLD.blockSize,
      });
    }
    loopPoints.forEach((p, i) => {
      checkpoints.push({ x: p.x, y: p.y, id: i, radius: 70 });
    });
  }

  // Road test: is a world point on a road corridor?
  function isOnRoad(x, y) {
    const bs = WORLD.blockSize;
    const rw = WORLD.roadWidth;
    const modX = ((x % bs) + bs) % bs;
    const modY = ((y % bs) + bs) % bs;
    return modX < rw || modY < rw;
  }

  // ------------------------------------------------------------------------
  // Player car
  // ------------------------------------------------------------------------
  const player = {
    x: WORLD.roadWidth / 2,
    y: WORLD.roadWidth / 2,
    angle: -Math.PI / 2,
    speed: 0,
    maxSpeed: 6.4,
    accel: 0.13,
    brakeForce: 0.28,
    friction: 0.045,
    turnSpeed: 0.045,
    color: "#ff2e88",
    width: 22,
    height: 38,
    drifting: false,
    driftAngleOffset: 0,
    invulnerable: 0,
  };

  // Traffic cars
  let traffic = [];
  const TRAFFIC_COLORS = ["#3fe0ff", "#ffcf3f", "#6bff9c", "#e07bff", "#ff6b6b", "#ffa53f"];

  function spawnTraffic(count) {
    traffic = [];
    for (let i = 0; i < count; i++) {
      respawnTrafficCar(true);
    }
  }

  function respawnTrafficCar(initial, existingCar) {
    const cols = Math.floor(WORLD.width / WORLD.blockSize);
    const rows = Math.floor(WORLD.height / WORLD.blockSize);
    let x, y, horizontal;
    // pick a random road corridor near the player for relevance, else anywhere
    const nearPlayer = Math.random() < 0.65 && !initial;
    if (nearPlayer) {
      const ang = rand(0, TAU);
      const r = rand(700, 1300);
      x = player.x + Math.cos(ang) * r;
      y = player.y + Math.sin(ang) * r;
    } else {
      x = rand(0, WORLD.width);
      y = rand(0, WORLD.height);
    }
    horizontal = Math.random() < 0.5;
    // snap to nearest road corridor
    const bs = WORLD.blockSize;
    if (horizontal) {
      const rowIndex = Math.round(y / bs);
      y = rowIndex * bs + WORLD.roadWidth * 0.25 + (Math.random() < 0.5 ? 0 : WORLD.roadWidth * 0.5);
    } else {
      const colIndex = Math.round(x / bs);
      x = colIndex * bs + WORLD.roadWidth * 0.25 + (Math.random() < 0.5 ? 0 : WORLD.roadWidth * 0.5);
    }
    x = clamp(x, 20, WORLD.width - 20);
    y = clamp(y, 20, WORLD.height - 20);
    const dir = Math.random() < 0.5 ? 1 : -1;
    const data = {
      x,
      y,
      horizontal,
      dir,
      speed: rand(1.4, 2.6) * DIFFICULTIES[currentDifficulty].trafficSpeed,
      color: choice(TRAFFIC_COLORS),
      width: 20,
      height: 34,
      wobble: rand(0, TAU),
      _nearMissCooldown: 0,
    };
    if (existingCar) {
      // Mutate in place so the traffic array never grows unbounded.
      Object.assign(existingCar, data);
      return existingCar;
    }
    traffic.push(data);
    return data;
  }

  // ------------------------------------------------------------------------
  // Particles (exhaust smoke, drift skid, sparks, confetti)
  // ------------------------------------------------------------------------
  let particles = [];
  function addParticle(p) {
    particles.push(p);
    if (particles.length > 400) particles.shift();
  }
  function spawnExhaust(x, y, angle) {
    addParticle({
      type: "smoke",
      x: x - Math.cos(angle) * 20,
      y: y - Math.sin(angle) * 20,
      vx: -Math.cos(angle) * 0.5 + rand(-0.3, 0.3),
      vy: -Math.sin(angle) * 0.5 + rand(-0.3, 0.3),
      life: 1,
      size: rand(4, 7),
      color: "rgba(200,200,220,0.35)",
    });
  }
  function spawnSkid(x, y) {
    addParticle({
      type: "skid",
      x,
      y,
      life: 1,
      size: rand(3, 5),
      color: "rgba(30,30,40,0.55)",
    });
  }
  function spawnSpark(x, y) {
    for (let i = 0; i < 10; i++) {
      const a = rand(0, TAU);
      addParticle({
        type: "spark",
        x,
        y,
        vx: Math.cos(a) * rand(1, 5),
        vy: Math.sin(a) * rand(1, 5),
        life: 1,
        size: rand(2, 4),
        color: choice(["#ffe14d", "#ff7a3d", "#ff2e88"]),
      });
    }
  }
  function spawnConfetti(x, y) {
    for (let i = 0; i < 30; i++) {
      const a = rand(0, TAU);
      addParticle({
        type: "confetti",
        x,
        y,
        vx: Math.cos(a) * rand(1, 4),
        vy: Math.sin(a) * rand(1, 4) - 1,
        life: 1,
        size: rand(3, 6),
        color: choice(["#ff2e88", "#29ffe0", "#a855ff", "#ffe14d"]),
        rot: rand(0, TAU),
        vrot: rand(-0.2, 0.2),
      });
    }
  }
  function spawnCheckpointBurst(x, y) {
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * TAU;
      addParticle({
        type: "ring",
        x,
        y,
        vx: Math.cos(a) * 3,
        vy: Math.sin(a) * 3,
        life: 1,
        size: 4,
        color: "#29ffe0",
      });
    }
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt * (p.type === "skid" ? 0.25 : p.type === "confetti" ? 0.4 : 1.4);
      if (p.type !== "skid") {
        p.x += (p.vx || 0);
        p.y += (p.vy || 0);
        if (p.type === "confetti") {
          p.vy += 0.05;
          p.rot += p.vrot;
        }
        if (p.type === "spark" || p.type === "ring") {
          p.vx *= 0.92;
          p.vy *= 0.92;
        }
      }
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  function drawParticles() {
    for (const p of particles) {
      ctx.save();
      ctx.globalAlpha = clamp(p.life, 0, 1);
      if (p.type === "smoke") {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1.6 - p.life * 0.6), 0, TAU);
        ctx.fill();
      } else if (p.type === "skid") {
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      } else if (p.type === "spark") {
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 6;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      } else if (p.type === "confetti") {
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      } else if (p.type === "ring") {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size + (1 - p.life) * 30, 0, TAU);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  // ------------------------------------------------------------------------
  // Floating score popups
  // ------------------------------------------------------------------------
  let popups = [];
  function addPopup(x, y, text, color) {
    popups.push({ x, y, text, color, life: 1 });
  }
  function updatePopups(dt) {
    for (let i = popups.length - 1; i >= 0; i--) {
      popups[i].y -= dt * 40;
      popups[i].life -= dt * 1.2;
      if (popups[i].life <= 0) popups.splice(i, 1);
    }
  }
  function drawPopups() {
    for (const p of popups) {
      ctx.save();
      ctx.globalAlpha = clamp(p.life, 0, 1);
      ctx.font = "bold 16px 'Press Start 2P', monospace";
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8;
      ctx.textAlign = "center";
      ctx.fillText(p.text, p.x, p.y);
      ctx.restore();
    }
  }

  // ------------------------------------------------------------------------
  // Input
  // ------------------------------------------------------------------------
  const keys = new Set();
  const touchState = { left: false, right: false, gas: false, brake: false, drift: false };

  window.addEventListener("keydown", (e) => {
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) {
      e.preventDefault();
    }
    keys.add(e.key.toLowerCase());
    if (e.key === "Escape" || e.key.toLowerCase() === "p") {
      togglePause();
    }
  });
  window.addEventListener("keyup", (e) => {
    keys.delete(e.key.toLowerCase());
  });

  function bindTouch(elm, key) {
    if (!elm) return;
    const start = (e) => {
      e.preventDefault();
      touchState[key] = true;
    };
    const end = (e) => {
      e.preventDefault();
      touchState[key] = false;
    };
    elm.addEventListener("touchstart", start, { passive: false });
    elm.addEventListener("touchend", end, { passive: false });
    elm.addEventListener("touchcancel", end, { passive: false });
    elm.addEventListener("mousedown", start);
    elm.addEventListener("mouseup", end);
    elm.addEventListener("mouseleave", end);
  }
  bindTouch(el.touchLeft, "left");
  bindTouch(el.touchRight, "right");
  bindTouch(el.touchGas, "gas");
  bindTouch(el.touchBrake, "brake");
  bindTouch(el.touchDrift, "drift");

  function isTouchDevice() {
    return "ontouchstart" in window || navigator.maxTouchPoints > 0;
  }
  if (isTouchDevice()) {
    el.touch.classList.add("active");
  }

  function inputAccel() {
    return keys.has("arrowup") || keys.has("w") || touchState.gas;
  }
  function inputBrake() {
    return keys.has("arrowdown") || keys.has("s") || touchState.brake;
  }
  function inputLeft() {
    return keys.has("arrowleft") || keys.has("a") || touchState.left;
  }
  function inputRight() {
    return keys.has("arrowright") || keys.has("d") || touchState.right;
  }
  function inputDrift() {
    return keys.has(" ") || touchState.drift;
  }

  // ------------------------------------------------------------------------
  // Camera & screen shake
  // ------------------------------------------------------------------------
  const camera = { x: 0, y: 0, shake: 0 };
  function applyShake(amount) {
    camera.shake = Math.min(camera.shake + amount, 22);
  }

  // ------------------------------------------------------------------------
  // Game state machine
  // ------------------------------------------------------------------------
  const STATE = {
    TITLE: "title",
    COUNTDOWN: "countdown",
    PLAYING: "playing",
    PAUSED: "paused",
    RESULTS: "results",
  };
  let state = STATE.TITLE;

  let raceTime = 0; // seconds remaining
  let score = 0;
  let checkpointsHit = 0;
  let currentCheckpointIndex = 0;
  let comboCount = 0;
  let bestCombo = 0;
  let comboTimer = 0;
  let elapsedRace = 0;
  let ended = false;
  let endReason = "";

  const HISCORE_KEY = "vorizon_best_time_v1";
  function loadHiscore() {
    const v = localStorage.getItem(HISCORE_KEY);
    return v ? parseFloat(v) : null;
  }
  function saveHiscoreIfBest(elapsed) {
    const cur = loadHiscore();
    if (cur === null || elapsed < cur) {
      localStorage.setItem(HISCORE_KEY, String(elapsed));
      return true;
    }
    return false;
  }
  function formatTime(t) {
    if (t === null || Number.isNaN(t)) return "--:--.--";
    const m = Math.floor(t / 60);
    const s = t % 60;
    return `${String(m).padStart(2, "0")}:${s.toFixed(2).padStart(5, "0")}`;
  }
  function refreshHiscoreLabel() {
    const h = loadHiscore();
    el.hiscoreValue.textContent = h === null ? "--:--.--" : formatTime(h);
  }
  refreshHiscoreLabel();

  function showScreen(target) {
    [el.title, el.howto, el.countdown, el.pause, el.results].forEach((s) => s.classList.add("hidden"));
    el.hud.classList.add("hidden");
    if (target) target.classList.remove("hidden");
  }

  function resetRace() {
    buildTown();
    player.x = WORLD.roadWidth / 2 + 20;
    player.y = WORLD.roadWidth / 2 + 20;
    player.angle = -Math.PI / 2;
    player.speed = 0;
    player.invulnerable = 0;
    const diff = DIFFICULTIES[currentDifficulty];
    raceTime = diff.time;
    score = 0;
    checkpointsHit = 0;
    currentCheckpointIndex = 0;
    comboCount = 0;
    bestCombo = 0;
    comboTimer = 0;
    elapsedRace = 0;
    ended = false;
    endReason = "";
    particles = [];
    popups = [];
    const trafficCount = Math.round(18 * diff.trafficDensity);
    spawnTraffic(trafficCount);
    camera.x = player.x;
    camera.y = player.y;
  }

  function startCountdown() {
    resetRace();
    state = STATE.COUNTDOWN;
    showScreen(el.countdown);
    let count = 3;
    el.countdownNumber.textContent = String(count);
    AudioEngine.countdownBeep(false);
    const iv = setInterval(() => {
      count -= 1;
      if (count > 0) {
        el.countdownNumber.textContent = String(count);
        el.countdownNumber.style.animation = "none";
        void el.countdownNumber.offsetWidth;
        el.countdownNumber.style.animation = "countdown-pop 1s ease-out";
        AudioEngine.countdownBeep(false);
      } else {
        el.countdownNumber.textContent = "GO!";
        el.countdownNumber.style.animation = "none";
        void el.countdownNumber.offsetWidth;
        el.countdownNumber.style.animation = "countdown-pop 1s ease-out";
        AudioEngine.countdownBeep(true);
        clearInterval(iv);
        setTimeout(() => {
          state = STATE.PLAYING;
          showScreen(null);
          el.hud.classList.remove("hidden");
          AudioEngine.startMusic();
        }, 650);
      }
    }, 800);
  }

  function togglePause() {
    if (state === STATE.PLAYING) {
      state = STATE.PAUSED;
      showScreen(el.pause);
      AudioEngine.stopMusic();
    } else if (state === STATE.PAUSED) {
      state = STATE.PLAYING;
      showScreen(null);
      el.hud.classList.remove("hidden");
      AudioEngine.startMusic();
    }
  }

  function endRace(reason) {
    if (ended) return;
    ended = true;
    endReason = reason;
    state = STATE.RESULTS;
    AudioEngine.stopMusic();
    const isFinish = reason === "finish";
    if (isFinish) {
      AudioEngine.finish();
      spawnConfetti(player.x, player.y);
    } else {
      AudioEngine.timeUp();
    }
    const isBest = isFinish ? saveHiscoreIfBest(elapsedRace) : false;
    refreshHiscoreLabel();

    el.resultsTitle.textContent = isFinish ? "FINISH!" : "TIME'S UP";
    el.resultsScore.textContent = String(Math.round(score));
    el.resultsTime.textContent = raceTime.toFixed(1);
    el.resultsCheckpoints.textContent = `${checkpointsHit} / ${checkpoints.length}`;
    el.resultsCombo.textContent = `x${bestCombo}`;

    // rank calculation
    let rank = "C";
    const ratio = checkpointsHit / checkpoints.length;
    if (isFinish && isBest) rank = "S";
    else if (ratio >= 1) rank = "A";
    else if (ratio >= 0.7) rank = "B";
    else if (ratio >= 0.4) rank = "C";
    else rank = "D";
    el.resultsRank.textContent = rank + (isBest ? " ★ NEW BEST!" : "");

    setTimeout(() => {
      showScreen(el.results);
    }, isFinish ? 900 : 300);
  }

  // ------------------------------------------------------------------------
  // Collision helpers (oriented rect vs oriented rect, simplified via circle+AABB)
  // ------------------------------------------------------------------------
  function rectsOverlap(ax, ay, aw, ah, aAngle, bx, by, bw, bh) {
    // Approximate the player's rotated rect as a circle for robust arcade-feel collision
    const r1 = Math.max(aw, ah) * 0.38;
    const closestX = clamp(ax, bx - bw / 2, bx + bw / 2);
    const closestY = clamp(ay, by - bh / 2, by + bh / 2);
    const d = dist(ax, ay, closestX, closestY);
    return d < r1;
  }

  function buildingBlocksPoint(x, y, margin) {
    for (const b of buildings) {
      if (
        x > b.x - margin &&
        x < b.x + b.w + margin &&
        y > b.y - margin &&
        y < b.y + b.h + margin
      ) {
        return b;
      }
    }
    return null;
  }

  // ------------------------------------------------------------------------
  // Update loop
  // ------------------------------------------------------------------------
  let lastTs = 0;
  let engineSoundAccum = 0;

  function updatePlayer(dt) {
    const diff = DIFFICULTIES[currentDifficulty];
    const accelInput = inputAccel();
    const brakeInput = inputBrake();
    const left = inputLeft();
    const right = inputRight();
    const drift = inputDrift() && Math.abs(player.speed) > 1.5;

    if (accelInput) {
      player.speed += player.accel;
    } else if (brakeInput) {
      player.speed -= player.brakeForce;
    } else {
      // natural friction
      if (player.speed > 0) player.speed = Math.max(0, player.speed - player.friction);
      else if (player.speed < 0) player.speed = Math.min(0, player.speed + player.friction);
    }
    player.speed = clamp(player.speed, -player.maxSpeed * 0.5, player.maxSpeed);

    const speedFactor = clamp(Math.abs(player.speed) / player.maxSpeed, 0, 1);
    const turnMulti = player.speed < 0 ? -1 : 1;
    const effectiveTurn = player.turnSpeed * (0.4 + speedFactor * 0.6) * turnMulti;

    if (left) player.angle -= effectiveTurn;
    if (right) player.angle += effectiveTurn;

    player.drifting = drift && (left || right);
    if (player.drifting) {
      player.driftAngleOffset = lerp(player.driftAngleOffset, (left ? -1 : right ? 1 : 0) * 0.35, 0.15);
      spawnSkid(
        player.x - Math.cos(player.angle) * 12,
        player.y - Math.sin(player.angle) * 12
      );
      if (Math.random() < 0.3) AudioEngine.drift();
      player.speed *= 0.99;
    } else {
      player.driftAngleOffset = lerp(player.driftAngleOffset, 0, 0.1);
    }

    const moveAngle = player.angle + player.driftAngleOffset * 0.6;
    const nextX = player.x + Math.cos(moveAngle) * player.speed;
    const nextY = player.y + Math.sin(moveAngle) * player.speed;

    // building collision (soft bounce)
    const hitBuilding = buildingBlocksPoint(nextX, nextY, 8);
    if (hitBuilding) {
      player.speed *= -0.35;
      applyShake(6);
      spawnSpark(player.x, player.y);
      if (Math.random() < 0.5) AudioEngine.crash();
    } else {
      player.x = clamp(nextX, 10, WORLD.width - 10);
      player.y = clamp(nextY, 10, WORLD.height - 10);
    }

    if (player.invulnerable > 0) player.invulnerable -= dt;

    // exhaust particles
    if (Math.abs(player.speed) > 0.5 && Math.random() < 0.5) {
      spawnExhaust(player.x, player.y, player.angle);
    }

    // engine sound
    engineSoundAccum += dt;
    if (engineSoundAccum > 0.12) {
      engineSoundAccum = 0;
      if (accelInput) AudioEngine.engineTick(speedFactor);
    }

    // speed dial UI
    const mph = Math.round(Math.abs(player.speed) * 22);
    el.speedValue.textContent = String(mph);
    const needleAngle = -90 + clamp(Math.abs(player.speed) / player.maxSpeed, 0, 1) * 180;
    el.speedNeedle.style.transform = `translateX(-50%) rotate(${needleAngle}deg)`;
  }

  function updateTraffic(dt) {
    const diff = DIFFICULTIES[currentDifficulty];
    for (const car of traffic) {
      const speed = car.speed * car.dir;
      if (car.horizontal) {
        car.x += speed;
      } else {
        car.y += speed;
      }
      car.wobble += dt;

      // wrap / respawn if far from player
      const d = dist(car.x, car.y, player.x, player.y);
      if (d > 1800) {
        respawnTrafficCar(false, car);
        continue;
      }

      // collision with player
      const pdx = player.x - car.x;
      const pdy = player.y - car.y;
      const hitDist = Math.hypot(pdx, pdy);
      const collideRadius = 24;
      if (hitDist < collideRadius && player.invulnerable <= 0 && state === STATE.PLAYING) {
        player.invulnerable = 1.1;
        player.speed *= -0.5;
        applyShake(14);
        spawnSpark(player.x, player.y);
        AudioEngine.crash();
        score = Math.max(0, score - 40);
        comboCount = 0;
        addPopup(player.x, player.y - 30, "-40", "#ff2e88");
      } else if (hitDist < collideRadius * 2.1 && hitDist >= collideRadius) {
        // near miss bonus (only trigger once per approach via cooldown flag)
        if (!car._nearMissCooldown && state === STATE.PLAYING) {
          car._nearMissCooldown = 0.6;
          comboCount += 1;
          bestCombo = Math.max(bestCombo, comboCount);
          const bonus = 10 * comboCount;
          score += bonus;
          comboTimer = 1.8;
          AudioEngine.nearMiss();
          addPopup(player.x, player.y - 30, `+${bonus}`, "#29ffe0");
        }
      }
      if (car._nearMissCooldown) {
        car._nearMissCooldown -= dt;
        if (car._nearMissCooldown <= 0) car._nearMissCooldown = 0;
      }
    }

    if (comboTimer > 0) {
      comboTimer -= dt;
      if (comboTimer <= 0) comboCount = 0;
    }
  }

  function updateCheckpoints() {
    if (checkpoints.length === 0) return;
    const cp = checkpoints[currentCheckpointIndex];
    const d = dist(player.x, player.y, cp.x, cp.y);
    if (d < cp.radius) {
      checkpointsHit += 1;
      score += 100;
      raceTime += 4; // bonus time
      spawnCheckpointBurst(cp.x, cp.y);
      addPopup(player.x, player.y - 40, "+100  +4s", "#ffe14d");
      AudioEngine.checkpoint();
      applyShake(4);
      currentCheckpointIndex = (currentCheckpointIndex + 1) % checkpoints.length;
      if (checkpointsHit >= checkpoints.length * 3) {
        endRace("finish");
      }
    }
  }

  function update(dt) {
    if (state !== STATE.PLAYING) return;

    updatePlayer(dt);
    updateTraffic(dt);
    updateCheckpoints();
    updateParticles(dt);
    updatePopups(dt);

    elapsedRace += dt;
    raceTime -= dt;
    if (raceTime <= 0) {
      raceTime = 0;
      endRace("timeup");
    }

    // camera follow with slight lag for feel
    camera.x = lerp(camera.x, player.x, 0.12);
    camera.y = lerp(camera.y, player.y, 0.12);
    if (camera.shake > 0) camera.shake = Math.max(0, camera.shake - dt * 40);

    // HUD updates
    el.hudTime.textContent = raceTime.toFixed(1);
    el.hudTime.classList.toggle("low-time", raceTime < 10);
    el.hudScore.textContent = String(Math.round(score));
    el.hudCheckpoint.textContent = `${checkpointsHit} / ${checkpoints.length * 3}`;

    if (comboCount > 0) {
      el.comboCluster.classList.add("show");
      el.comboText.textContent = `NEAR MISS x${comboCount}`;
    } else {
      el.comboCluster.classList.remove("show");
    }
  }

  // ------------------------------------------------------------------------
  // Rendering
  // ------------------------------------------------------------------------
  function worldToScreen(x, y) {
    return {
      x: x - camera.x + VW / 2,
      y: y - camera.y + VH / 2,
    };
  }

  function drawBackground() {
    const g = ctx.createRadialGradient(VW / 2, VH * 0.35, 40, VW / 2, VH * 0.55, Math.max(VW, VH) * 0.85);
    g.addColorStop(0, "#1a1040");
    g.addColorStop(0.45, "#100a30");
    g.addColorStop(1, "#050514");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VW, VH);
  }

  function drawRoads() {
    const bs = WORLD.blockSize;
    const rw = WORLD.roadWidth;
    const startCol = Math.floor((camera.x - VW / 2) / bs) - 1;
    const endCol = Math.floor((camera.x + VW / 2) / bs) + 1;
    const startRow = Math.floor((camera.y - VH / 2) / bs) - 1;
    const endRow = Math.floor((camera.y + VH / 2) / bs) + 1;

    ctx.fillStyle = "#1b2038";
    // vertical corridors
    for (let cx = startCol; cx <= endCol; cx++) {
      const wx = cx * bs;
      const s = worldToScreen(wx, 0);
      ctx.fillRect(s.x, 0, rw, VH);
    }
    // horizontal corridors
    for (let cy = startRow; cy <= endRow; cy++) {
      const wy = cy * bs;
      const s = worldToScreen(0, wy);
      ctx.fillRect(0, s.y, VW, rw);
    }

    // lane markings (dashed center lines)
    ctx.strokeStyle = "rgba(255, 225, 77, 0.55)";
    ctx.lineWidth = 3;
    ctx.setLineDash([18, 16]);
    const dashOffset = -(camera.y % 34);
    for (let cx = startCol; cx <= endCol; cx++) {
      const wx = cx * bs + rw / 2;
      const s = worldToScreen(wx, 0);
      ctx.beginPath();
      ctx.lineDashOffset = dashOffset;
      ctx.moveTo(s.x, 0);
      ctx.lineTo(s.x, VH);
      ctx.stroke();
    }
    const dashOffsetX = -(camera.x % 34);
    for (let cy = startRow; cy <= endRow; cy++) {
      const wy = cy * bs + rw / 2;
      const s = worldToScreen(0, wy);
      ctx.beginPath();
      ctx.lineDashOffset = dashOffsetX;
      ctx.moveTo(0, s.y);
      ctx.lineTo(VW, s.y);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // sidewalks / curbs (subtle neon edge along road boundary)
    ctx.strokeStyle = "rgba(41, 255, 224, 0.18)";
    ctx.lineWidth = 2;
    for (let cx = startCol; cx <= endCol; cx++) {
      const wx = cx * bs;
      let s = worldToScreen(wx, 0);
      ctx.beginPath();
      ctx.moveTo(s.x, 0);
      ctx.lineTo(s.x, VH);
      ctx.stroke();
      s = worldToScreen(wx + rw, 0);
      ctx.beginPath();
      ctx.moveTo(s.x, 0);
      ctx.lineTo(s.x, VH);
      ctx.stroke();
    }
  }

  function drawBuildings() {
    const margin = 260;
    for (const b of buildings) {
      if (
        b.x + b.w < camera.x - VW / 2 - margin ||
        b.x > camera.x + VW / 2 + margin ||
        b.y + b.h < camera.y - VH / 2 - margin ||
        b.y > camera.y + VH / 2 + margin
      ) {
        continue;
      }
      const s = worldToScreen(b.x, b.y);

      // drop shadow for pseudo-height
      const shadowOffset = 6 + b.height * 4;
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(s.x + shadowOffset, s.y + shadowOffset, b.w, b.h);

      // base
      ctx.fillStyle = b.palette.base;
      ctx.fillRect(s.x, s.y, b.w, b.h);

      // roof highlight strip
      ctx.fillStyle = b.palette.roof;
      ctx.fillRect(s.x, s.y, b.w, Math.min(10, b.h * 0.15));

      // neon outline
      ctx.strokeStyle = b.palette.glow;
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(s.x + 0.5, s.y + 0.5, b.w - 1, b.h - 1);
      ctx.globalAlpha = 1;

      // windows
      for (const w of b.windows) {
        const flick = w.flicker ? Math.sin(performance.now() / 120 + w.x) > 0.5 : true;
        ctx.fillStyle = w.lit && flick ? b.palette.glow : "rgba(255,255,255,0.05)";
        if (w.lit && flick) {
          ctx.globalAlpha = 0.85;
        }
        ctx.fillRect(s.x + w.x, s.y + w.y, 10, 12);
        ctx.globalAlpha = 1;
      }
    }
  }

  function drawDecorations() {
    for (const d of decorations) {
      if (d.type === "park") {
        const s = worldToScreen(d.x, d.y);
        if (
          d.x + d.w < camera.x - VW / 2 - 200 ||
          d.x > camera.x + VW / 2 + 200 ||
          d.y + d.h < camera.y - VH / 2 - 200 ||
          d.y > camera.y + VH / 2 + 200
        )
          continue;
        ctx.fillStyle = "#12331f";
        ctx.fillRect(s.x, s.y, d.w, d.h);
        ctx.strokeStyle = "rgba(41,255,224,0.15)";
        ctx.strokeRect(s.x, s.y, d.w, d.h);
      } else if (d.type === "tree") {
        const s = worldToScreen(d.x, d.y);
        if (s.x < -30 || s.x > VW + 30 || s.y < -30 || s.y > VH + 30) continue;
        ctx.fillStyle = "#5c3a20";
        ctx.fillRect(s.x - 2, s.y, 4, 10);
        ctx.fillStyle = "#1f5c3a";
        ctx.beginPath();
        ctx.arc(s.x, s.y - 4, 10, 0, TAU);
        ctx.fill();
      } else if (d.type === "lamp") {
        const s = worldToScreen(d.x, d.y);
        if (s.x < -30 || s.x > VW + 30 || s.y < -30 || s.y > VH + 30) continue;
        ctx.fillStyle = "#333";
        ctx.fillRect(s.x, s.y, 3, 22);
        ctx.fillStyle = "#ffe14d";
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.arc(s.x + 1.5, s.y - 2, 5, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 0.15;
        ctx.beginPath();
        ctx.arc(s.x + 1.5, s.y - 2, 20, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  }

  function drawCheckpoints() {
    if (!checkpoints.length || state !== STATE.PLAYING) return;
    const cp = checkpoints[currentCheckpointIndex];
    const s = worldToScreen(cp.x, cp.y);
    const pulse = 1 + Math.sin(performance.now() / 200) * 0.15;
    ctx.save();
    ctx.strokeStyle = "#29ffe0";
    ctx.lineWidth = 4;
    ctx.shadowColor = "#29ffe0";
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.arc(s.x, s.y, cp.radius * pulse, 0, TAU);
    ctx.stroke();
    ctx.restore();

    // directional arrow pointing to checkpoint if off-screen
    const dx = cp.x - player.x;
    const dy = cp.y - player.y;
    const d = Math.hypot(dx, dy);
    if (d > 420) {
      const ang = Math.atan2(dy, dx);
      const arrowDist = 250;
      const ax = VW / 2 + Math.cos(ang) * arrowDist;
      const ay = VH / 2 + Math.sin(ang) * arrowDist;
      ctx.save();
      ctx.translate(ax, ay);
      ctx.rotate(ang);
      ctx.fillStyle = "#29ffe0";
      ctx.shadowColor = "#29ffe0";
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(14, 0);
      ctx.lineTo(-8, -9);
      ctx.lineTo(-8, 9);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  function drawCar(x, y, angle, width, height, color, opts) {
    opts = opts || {};
    const s = worldToScreen(x, y);
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(angle + Math.PI / 2);

    // shadow
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.beginPath();
    ctx.ellipse(2, 4, width / 2 + 2, height / 2 + 2, 0, 0, TAU);
    ctx.fill();

    // body
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = opts.glow ? 16 : 6;
    roundRect(ctx, -width / 2, -height / 2, width, height, 6);
    ctx.fill();

    // windshield
    ctx.fillStyle = "rgba(20,30,50,0.85)";
    ctx.shadowBlur = 0;
    roundRect(ctx, -width / 2 + 3, -height / 2 + 6, width - 6, height * 0.32, 3);
    ctx.fill();

    // tail lights
    ctx.fillStyle = "#ff5050";
    ctx.fillRect(-width / 2 + 2, height / 2 - 4, 4, 3);
    ctx.fillRect(width / 2 - 6, height / 2 - 4, 4, 3);

    // headlights
    ctx.fillStyle = "#fff7c2";
    ctx.fillRect(-width / 2 + 2, -height / 2 + 1, 4, 3);
    ctx.fillRect(width / 2 - 6, -height / 2 + 1, 4, 3);

    ctx.restore();
  }

  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  function drawPlayer() {
    const blinking = player.invulnerable > 0 && Math.floor(performance.now() / 80) % 2 === 0;
    if (blinking) return;
    drawCar(player.x, player.y, player.angle, player.width, player.height, player.color, { glow: true });
  }

  function drawTraffic() {
    for (const car of traffic) {
      const angle = car.horizontal ? (car.dir > 0 ? 0 : Math.PI) : (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
      drawCar(car.x, car.y, angle - Math.PI / 2, car.width, car.height, car.color, {});
    }
  }

  function drawMinimap() {
    if (state !== STATE.PLAYING && state !== STATE.PAUSED) return;
    const mmSize = 180;
    const pad = 16;
    const mx = VW - mmSize - pad;
    const my = pad;
    const scale = mmSize / WORLD.width;

    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = "rgba(6,8,18,0.68)";
    ctx.strokeStyle = "rgba(41,255,224,0.6)";
    ctx.lineWidth = 2;
    roundRect(ctx, mx, my, mmSize, mmSize, 10);
    ctx.fill();
    ctx.stroke();

    ctx.save();
    roundRect(ctx, mx, my, mmSize, mmSize, 10);
    ctx.clip();

    const bs = WORLD.blockSize;
    ctx.strokeStyle = "rgba(126,166,255,0.25)";
    ctx.lineWidth = 1;
    for (let wx = 0; wx <= WORLD.width; wx += bs) {
      const x = mx + wx * scale;
      ctx.beginPath();
      ctx.moveTo(x, my);
      ctx.lineTo(x, my + mmSize);
      ctx.stroke();
    }
    for (let wy = 0; wy <= WORLD.height; wy += bs) {
      const y = my + wy * scale;
      ctx.beginPath();
      ctx.moveTo(mx, y);
      ctx.lineTo(mx + mmSize, y);
      ctx.stroke();
    }

    // checkpoint loop path
    ctx.strokeStyle = "rgba(255,225,77,0.35)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    checkpoints.forEach((cp, i) => {
      const cx = mx + cp.x * scale;
      const cy = my + cp.y * scale;
      if (i === 0) ctx.moveTo(cx, cy);
      else ctx.lineTo(cx, cy);
    });
    ctx.closePath();
    ctx.stroke();

    // checkpoints
    checkpoints.forEach((cp, i) => {
      const cx = mx + cp.x * scale;
      const cy = my + cp.y * scale;
      ctx.fillStyle = i === currentCheckpointIndex ? "#ffe14d" : "rgba(41,255,224,0.6)";
      ctx.beginPath();
      ctx.arc(cx, cy, i === currentCheckpointIndex ? 4 : 2.4, 0, TAU);
      ctx.fill();
    });

    // traffic
    ctx.fillStyle = "rgba(180,190,220,0.7)";
    traffic.forEach((car) => {
      const cx = mx + car.x * scale;
      const cy = my + car.y * scale;
      ctx.beginPath();
      ctx.arc(cx, cy, 1.6, 0, TAU);
      ctx.fill();
    });

    // player
    const px = mx + player.x * scale;
    const py = my + player.y * scale;
    ctx.fillStyle = "#ff2e88";
    ctx.beginPath();
    ctx.arc(px, py, 4, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + Math.cos(player.angle) * 8, py + Math.sin(player.angle) * 8);
    ctx.stroke();

    ctx.restore();
    ctx.restore();
  }

  function render() {
    ctx.save();

    // screen shake
    if (camera.shake > 0) {
      const sx = rand(-camera.shake, camera.shake);
      const sy = rand(-camera.shake, camera.shake);
      ctx.translate(sx, sy);
    }

    drawBackground();
    drawRoads();
    drawDecorations();
    drawBuildings();
    drawCheckpoints();
    drawParticles();
    drawTraffic();
    drawPlayer();
    drawPopups();

    ctx.restore();

    drawMinimap();
  }

  // ------------------------------------------------------------------------
  // Main loop
  // ------------------------------------------------------------------------
  function loop(ts) {
    if (!lastTs) lastTs = ts;
    let dt = (ts - lastTs) / 1000;
    dt = Math.min(dt, 0.05); // clamp for tab-switch hitches
    lastTs = ts;

    update(dt);
    render();

    requestAnimationFrame(loop);
  }

  // ------------------------------------------------------------------------
  // Menu wiring
  // ------------------------------------------------------------------------
  el.diffRow.querySelectorAll(".diff-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      el.diffRow.querySelectorAll(".diff-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentDifficulty = btn.dataset.diff;
      AudioEngine.uiClick();
    });
  });

  el.btnStart.addEventListener("click", () => {
    AudioEngine.uiClick();
    startCountdown();
  });

  el.btnHowto.addEventListener("click", () => {
    AudioEngine.uiClick();
    showScreen(el.howto);
  });
  el.btnHowtoClose.addEventListener("click", () => {
    AudioEngine.uiClick();
    showScreen(el.title);
  });

  el.btnSound.addEventListener("click", () => {
    soundOn = !soundOn;
    el.btnSound.textContent = `SOUND: ${soundOn ? "ON" : "OFF"}`;
    if (soundOn) AudioEngine.uiClick();
  });

  el.btnResume.addEventListener("click", () => {
    AudioEngine.uiClick();
    togglePause();
  });
  el.btnRestart.addEventListener("click", () => {
    AudioEngine.uiClick();
    startCountdown();
  });
  el.btnQuit.addEventListener("click", () => {
    AudioEngine.uiClick();
    AudioEngine.stopMusic();
    state = STATE.TITLE;
    showScreen(el.title);
  });

  el.btnAgain.addEventListener("click", () => {
    AudioEngine.uiClick();
    startCountdown();
  });
  el.btnTitle.addEventListener("click", () => {
    AudioEngine.uiClick();
    state = STATE.TITLE;
    showScreen(el.title);
  });

  // ------------------------------------------------------------------------
  // Boot
  // ------------------------------------------------------------------------
  buildTown();
  showScreen(el.title);
  requestAnimationFrame(loop);
})();
