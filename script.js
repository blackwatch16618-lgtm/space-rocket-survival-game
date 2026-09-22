/* ===========================================================
   Space Survivor — game logic (Vanilla JS + Canvas)
   -----------------------------------------------------------
   Structure:
     - Utils            small math helpers
     - Sound            WebAudio generated sounds (no files)
     - Starfield        parallax background
     - Rocket           the player
     - Asteroid         enemies
     - Bullet           projectiles
     - Particle         explosion / thrust bits
     - PowerUp          collectible boosts
     - Game             orchestrates everything + game loop
   =========================================================== */

(() => {
  "use strict";

  /* ------------------------- Utils ------------------------- */
  const rand = (min, max) => Math.random() * (max - min) + min;
  const randInt = (min, max) => Math.floor(rand(min, max + 1));
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const dist2 = (ax, ay, bx, by) => {
    const dx = ax - bx;
    const dy = ay - by;
    return dx * dx + dy * dy;
  };
  const TAU = Math.PI * 2;

  /* ------------------------- Sound ------------------------- */
  class Sound {
    constructor() {
      this.ctx = null;
      this.muted = false;
    }
    _ensure() {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) this.ctx = new AC();
      }
      if (this.ctx && this.ctx.state === "suspended") this.ctx.resume();
      return this.ctx;
    }
    _tone(freq, dur, type = "sine", vol = 0.2, slideTo = null) {
      if (this.muted) return;
      const ctx = this._ensure();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
      gain.gain.setValueAtTime(vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + dur);
    }
    _noise(dur, vol = 0.3) {
      if (this.muted) return;
      const ctx = this._ensure();
      if (!ctx) return;
      const bufferSize = ctx.sampleRate * dur;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
      }
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 1200;
      src.connect(filter).connect(gain).connect(ctx.destination);
      src.start();
      src.stop(ctx.currentTime + dur);
    }
    shoot() { this._tone(720, 0.12, "square", 0.08, 220); }
    thrust() { this._tone(90, 0.08, "sawtooth", 0.03); }
    hit() { this._noise(0.35, 0.35); this._tone(140, 0.3, "sawtooth", 0.2, 60); }
    powerup() { this._tone(520, 0.1, "sine", 0.15); setTimeout(() => this._tone(780, 0.14, "sine", 0.15), 90); }
    gameover() {
      this._tone(400, 0.25, "sawtooth", 0.2, 120);
      setTimeout(() => this._tone(200, 0.4, "sawtooth", 0.2, 60), 200);
    }
    click() { this._tone(600, 0.06, "square", 0.1); }
    countBeep() { this._tone(500, 0.1, "sine", 0.12); }
    go() { this._tone(880, 0.2, "sine", 0.16); }
  }

  /* ------------------------- Starfield ------------------------- */
  class Starfield {
    constructor(w, h) {
      this.stars = [];
      this.planets = [];
      this.resize(w, h);
    }
    resize(w, h) {
      this.w = w;
      this.h = h;
      const count = Math.floor((w * h) / 4200);
      this.stars = [];
      for (let i = 0; i < count; i++) {
        const layer = randInt(0, 2); // 0 far .. 2 near
        this.stars.push({
          x: rand(0, w),
          y: rand(0, h),
          r: layer === 2 ? rand(1.2, 2.2) : layer === 1 ? rand(0.8, 1.4) : rand(0.4, 0.9),
          speed: (layer + 1) * rand(8, 16),
          twinkle: rand(0, TAU),
          layer,
        });
      }
      // A couple of distant planets / nebula blobs
      this.planets = [];
      const pc = randInt(2, 3);
      const palette = [
        ["#3a2a6d", "#7d5bd6"],
        ["#1f4a5c", "#3fb0c9"],
        ["#5c2f3a", "#d96b7d"],
        ["#4a4520", "#c9b23f"],
      ];
      for (let i = 0; i < pc; i++) {
        const pal = palette[randInt(0, palette.length - 1)];
        this.planets.push({
          x: rand(0, w),
          y: rand(0, h),
          r: rand(40, 110),
          speed: rand(3, 7),
          c1: pal[0],
          c2: pal[1],
          alpha: rand(0.12, 0.28),
        });
      }
    }
    update(dt) {
      for (const s of this.stars) {
        s.y += s.speed * dt;
        s.twinkle += dt * 3;
        if (s.y > this.h + 4) {
          s.y = -4;
          s.x = rand(0, this.w);
        }
      }
      for (const p of this.planets) {
        p.y += p.speed * dt;
        if (p.y - p.r > this.h) {
          p.y = -p.r;
          p.x = rand(0, this.w);
        }
      }
    }
    draw(ctx) {
      // Nebula / planets
      for (const p of this.planets) {
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
        g.addColorStop(0, p.c2);
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      // Stars
      for (const s of this.stars) {
        const tw = 0.6 + 0.4 * Math.sin(s.twinkle);
        ctx.globalAlpha = s.layer === 0 ? 0.5 * tw : tw;
        ctx.fillStyle = s.layer === 2 ? "#dfe9ff" : "#aab6e0";
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  /* ------------------------- Particle ------------------------- */
  class Particle {
    constructor(x, y, opts = {}) {
      this.x = x;
      this.y = y;
      const ang = opts.angle != null ? opts.angle : rand(0, TAU);
      const spd = opts.speed != null ? opts.speed : rand(60, 260);
      this.vx = Math.cos(ang) * spd;
      this.vy = Math.sin(ang) * spd;
      this.life = opts.life != null ? opts.life : rand(0.4, 0.9);
      this.maxLife = this.life;
      this.r = opts.r != null ? opts.r : rand(1.5, 4);
      this.color = opts.color || "#ffcc4d";
      this.drag = opts.drag != null ? opts.drag : 1.5;
    }
    update(dt) {
      this.life -= dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      const d = Math.exp(-this.drag * dt);
      this.vx *= d;
      this.vy *= d;
    }
    draw(ctx) {
      const a = clamp(this.life / this.maxLife, 0, 1);
      ctx.globalAlpha = a;
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r * a + 0.3, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    get dead() { return this.life <= 0; }
  }

  /* ------------------------- Bullet ------------------------- */
  class Bullet {
    constructor(x, y) {
      this.x = x;
      this.y = y;
      this.vy = -720;
      this.r = 3.5;
      this.dead = false;
    }
    update(dt) {
      this.y += this.vy * dt;
      if (this.y < -20) this.dead = true;
    }
    draw(ctx) {
      ctx.save();
      ctx.shadowColor = "#ffcc4d";
      ctx.shadowBlur = 10;
      ctx.fillStyle = "#ffe08a";
      ctx.beginPath();
      ctx.ellipse(this.x, this.y, this.r, this.r * 2.2, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }

  /* ------------------------- Asteroid ------------------------- */
  class Asteroid {
    constructor(w, h, difficulty) {
      this.w = w;
      this.h = h;
      const sizeRoll = Math.random();
      // difficulty adds bigger variety
      if (difficulty >= 3 && sizeRoll > 0.8) this.radius = rand(46, 66);
      else if (sizeRoll > 0.6) this.radius = rand(30, 46);
      else this.radius = rand(16, 30);

      // Spawn mostly from top / right
      const side = Math.random();
      const baseSpeed = rand(70, 120) + difficulty * 26;
      if (side < 0.6) {
        // top
        this.x = rand(0, w);
        this.y = -this.radius - 10;
        this.vx = rand(-40, 40) * (1 + difficulty * 0.15);
        this.vy = baseSpeed;
      } else if (side < 0.85) {
        // right
        this.x = w + this.radius + 10;
        this.y = rand(0, h * 0.6);
        this.vx = -baseSpeed;
        this.vy = rand(20, 90);
      } else {
        // left
        this.x = -this.radius - 10;
        this.y = rand(0, h * 0.6);
        this.vx = baseSpeed;
        this.vy = rand(20, 90);
      }

      // Higher difficulty = a bit of wobble (unpredictable movement)
      this.wobble = difficulty >= 3 ? rand(20, 60) : 0;
      this.wobbleFreq = rand(1, 3);
      this.wobblePhase = rand(0, TAU);
      this.t = 0;

      this.rot = rand(0, TAU);
      this.rotSpeed = rand(-2, 2) * (1 + difficulty * 0.1);

      // Irregular rocky shape
      const points = randInt(7, 11);
      this.shape = [];
      for (let i = 0; i < points; i++) {
        const ang = (i / points) * TAU;
        const rr = this.radius * rand(0.72, 1.12);
        this.shape.push({ ang, r: rr });
      }
      const grays = ["#6b6f82", "#7a7e93", "#565a70", "#82734f", "#6e5f7a"];
      this.color = grays[randInt(0, grays.length - 1)];
      this.dead = false;
      this.hp = this.radius > 44 ? 2 : 1;
    }
    update(dt) {
      this.t += dt;
      this.x += (this.vx + Math.sin(this.t * this.wobbleFreq + this.wobblePhase) * this.wobble) * dt;
      this.y += this.vy * dt;
      this.rot += this.rotSpeed * dt;
      const m = this.radius + 60;
      if (this.y - this.radius > this.h + 20 || this.x < -m || this.x > this.w + m) {
        this.dead = true;
      }
    }
    draw(ctx) {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rot);
      ctx.beginPath();
      for (let i = 0; i < this.shape.length; i++) {
        const p = this.shape[i];
        const px = Math.cos(p.ang) * p.r;
        const py = Math.sin(p.ang) * p.r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = this.color;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(0,0,0,0.35)";
      ctx.stroke();
      // craters
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      const craters = Math.floor(this.radius / 12);
      for (let i = 0; i < craters; i++) {
        const a = (i / craters) * TAU + 0.6;
        const cr = this.radius * 0.28;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * this.radius * 0.35, Math.sin(a) * this.radius * 0.35, cr * rand(0.4, 0.7), 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  /* ------------------------- PowerUp ------------------------- */
  const POWERUP_TYPES = ["shield", "speed", "slowmo"];
  const POWERUP_META = {
    shield: { color: "#5ad1ff", label: "SHIELD", glyph: "◈" },
    speed: { color: "#63f7a6", label: "SPEED", glyph: "»" },
    slowmo: { color: "#c98bff", label: "SLOW-MO", glyph: "◷" },
  };
  class PowerUp {
    constructor(w, h) {
      this.type = POWERUP_TYPES[randInt(0, POWERUP_TYPES.length - 1)];
      this.r = 16;
      this.x = rand(this.r * 2, w - this.r * 2);
      this.y = -this.r;
      this.vy = rand(70, 110);
      this.t = rand(0, TAU);
      this.dead = false;
      this.h = h;
    }
    update(dt) {
      this.t += dt * 3;
      this.y += this.vy * dt;
      if (this.y - this.r > this.h + 20) this.dead = true;
    }
    draw(ctx) {
      const meta = POWERUP_META[this.type];
      const pulse = 1 + Math.sin(this.t) * 0.12;
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.scale(pulse, pulse);
      ctx.shadowColor = meta.color;
      ctx.shadowBlur = 16;
      ctx.fillStyle = "rgba(10,14,38,0.9)";
      ctx.strokeStyle = meta.color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, this.r, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = meta.color;
      ctx.font = "bold 16px " + getComputedStyle(document.body).fontFamily;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(meta.glyph, 0, 1);
      ctx.restore();
    }
  }

  /* ------------------------- Rocket ------------------------- */
  class Rocket {
    constructor(w, h) {
      this.reset(w, h);
    }
    reset(w, h) {
      this.x = w / 2;
      this.y = h * 0.75;
      this.vx = 0;
      this.vy = 0;
      this.r = 16; // collision radius
      this.baseSpeed = 520;
      this.thrustPhase = 0;
      this.invuln = 0; // seconds of invulnerability
      this.shield = 0; // seconds of shield power-up
      this.speedBoost = 0;
      this.thrusting = false;
      this.tilt = 0;
    }
    draw(ctx, blink) {
      if (blink) return;
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.tilt);

      // Thrust flame
      if (this.thrusting || true) {
        this.thrustPhase += 0.4;
        const flick = 0.7 + Math.sin(this.thrustPhase) * 0.3;
        const flameLen = (this.thrusting ? 26 : 14) * flick;
        const grd = ctx.createLinearGradient(0, 16, 0, 16 + flameLen);
        grd.addColorStop(0, "#ffe08a");
        grd.addColorStop(0.5, "#ff9d3f");
        grd.addColorStop(1, "rgba(255,90,40,0)");
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.moveTo(-7, 14);
        ctx.lineTo(7, 14);
        ctx.lineTo(0, 16 + flameLen);
        ctx.closePath();
        ctx.fill();
      }

      // Body
      ctx.fillStyle = "#e9eefc";
      ctx.beginPath();
      ctx.moveTo(0, -22);
      ctx.quadraticCurveTo(11, -6, 10, 12);
      ctx.lineTo(-10, 12);
      ctx.quadraticCurveTo(-11, -6, 0, -22);
      ctx.closePath();
      ctx.fill();

      // Fins
      ctx.fillStyle = "#ff5a6e";
      ctx.beginPath();
      ctx.moveTo(-10, 6);
      ctx.lineTo(-18, 16);
      ctx.lineTo(-10, 14);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(10, 6);
      ctx.lineTo(18, 16);
      ctx.lineTo(10, 14);
      ctx.closePath();
      ctx.fill();

      // Window
      ctx.fillStyle = "#5ad1ff";
      ctx.beginPath();
      ctx.arc(0, -6, 4.5, 0, TAU);
      ctx.fill();

      // Nose accent
      ctx.fillStyle = "#ff5a6e";
      ctx.beginPath();
      ctx.moveTo(0, -22);
      ctx.quadraticCurveTo(5, -12, 3, -6);
      ctx.lineTo(-3, -6);
      ctx.quadraticCurveTo(-5, -12, 0, -22);
      ctx.closePath();
      ctx.fill();

      // Shield bubble
      if (this.shield > 0) {
        const a = this.shield < 2 ? 0.4 + 0.4 * Math.abs(Math.sin(this.thrustPhase * 0.5)) : 0.7;
        ctx.globalAlpha = a;
        ctx.strokeStyle = "#5ad1ff";
        ctx.lineWidth = 3;
        ctx.shadowColor = "#5ad1ff";
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.arc(0, -2, 28, 0, TAU);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    }
  }

  /* ------------------------- Game ------------------------- */
  class Game {
    constructor() {
      this.canvas = document.getElementById("game-canvas");
      this.ctx = this.canvas.getContext("2d");
      this.sound = new Sound();

      // DOM refs
      this.el = {
        hud: document.getElementById("hud"),
        topControls: document.getElementById("top-controls"),
        score: document.getElementById("score"),
        hudHigh: document.getElementById("hud-high-score"),
        level: document.getElementById("level"),
        lives: document.getElementById("lives"),
        powerupBar: document.getElementById("powerup-bar"),
        startScreen: document.getElementById("start-screen"),
        startHigh: document.getElementById("start-high-score"),
        countdown: document.getElementById("countdown"),
        countdownNum: document.getElementById("countdown-number"),
        pauseScreen: document.getElementById("pause-screen"),
        gameoverScreen: document.getElementById("gameover-screen"),
        finalScore: document.getElementById("final-score"),
        finalHigh: document.getElementById("final-high-score"),
        newRecord: document.getElementById("new-record"),
        shootBtn: document.getElementById("shoot-btn"),
        pauseBtn: document.getElementById("pause-btn"),
        muteBtn: document.getElementById("mute-btn"),
      };

      this.state = "menu"; // menu | countdown | playing | paused | gameover
      this.highScore = this._loadHigh();
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);

      this.starfield = null;
      this.keys = {};
      this.pointer = { active: false, x: 0, y: 0 };
      this.lastTime = 0;
      this.rafId = null;
      this.screenShake = 0;

      this._resize();
      this._bindEvents();
      this._updateHighUI();
      this._startBackgroundLoop();
    }

    /* ---------- storage ---------- */
    _loadHigh() {
      const v = parseInt(localStorage.getItem("spaceSurvivorHigh") || "0", 10);
      return isNaN(v) ? 0 : v;
    }
    _saveHigh() {
      localStorage.setItem("spaceSurvivorHigh", String(this.highScore));
    }
    _updateHighUI() {
      this.el.hudHigh.textContent = this.highScore;
      this.el.startHigh.textContent = this.highScore;
    }

    /* ---------- sizing ---------- */
    _resize() {
      const w = window.innerWidth;
      const h = window.innerHeight;
      this.width = w;
      this.height = h;
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.canvas.width = Math.floor(w * this.dpr);
      this.canvas.height = Math.floor(h * this.dpr);
      this.canvas.style.width = w + "px";
      this.canvas.style.height = h + "px";
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      if (!this.starfield) this.starfield = new Starfield(w, h);
      else this.starfield.resize(w, h);
      // keep rocket in bounds
      if (this.rocket) {
        this.rocket.x = clamp(this.rocket.x, this.rocket.r, w - this.rocket.r);
        this.rocket.y = clamp(this.rocket.y, this.rocket.r, h - this.rocket.r);
      }
    }

    /* ---------- events ---------- */
    _bindEvents() {
      window.addEventListener("resize", () => this._resize());

      // Keyboard
      window.addEventListener("keydown", (e) => {
        const k = e.key.toLowerCase();
        if (["arrowup", "arrowdown", "arrowleft", "arrowright", " ", "w", "a", "s", "d", "p"].includes(k)) {
          e.preventDefault();
        }
        this.keys[k] = true;
        if (k === "p" && (this.state === "playing" || this.state === "paused")) this.togglePause();
        if (k === " " && this.state === "playing") this.shoot();
      });
      window.addEventListener("keyup", (e) => {
        this.keys[e.key.toLowerCase()] = false;
      });

      // Mouse
      this.canvas.addEventListener("mousemove", (e) => {
        if (this.state !== "playing") return;
        this.pointer.active = true;
        this.pointer.x = e.clientX;
        this.pointer.y = e.clientY;
      });
      this.canvas.addEventListener("mousedown", (e) => {
        if (this.state === "playing") this.shoot();
      });
      this.canvas.addEventListener("mouseleave", () => {
        this.pointer.active = false;
      });

      // Touch
      const touchMove = (e) => {
        if (this.state !== "playing") return;
        e.preventDefault();
        const t = e.touches[0];
        if (!t) return;
        this.pointer.active = true;
        this.pointer.x = t.clientX;
        this.pointer.y = t.clientY;
      };
      this.canvas.addEventListener("touchstart", touchMove, { passive: false });
      this.canvas.addEventListener("touchmove", touchMove, { passive: false });
      this.canvas.addEventListener("touchend", () => {
        this.pointer.active = false;
      });

      // Buttons
      document.getElementById("start-btn").addEventListener("click", () => {
        this.sound.click();
        this.startCountdown();
      });
      document.getElementById("restart-btn").addEventListener("click", () => {
        this.sound.click();
        this.startCountdown();
      });
      document.getElementById("resume-btn").addEventListener("click", () => {
        this.sound.click();
        this.togglePause();
      });
      document.getElementById("quit-btn").addEventListener("click", () => {
        this.sound.click();
        this.toMenu();
      });
      this.el.pauseBtn.addEventListener("click", () => {
        this.sound.click();
        this.togglePause();
      });
      this.el.muteBtn.addEventListener("click", () => {
        this.sound.muted = !this.sound.muted;
        this.el.muteBtn.classList.toggle("muted", this.sound.muted);
        this.el.muteBtn.textContent = this.sound.muted ? "✕" : "♪";
        if (!this.sound.muted) this.sound.click();
      });

      // Mobile fire button
      const fire = (e) => {
        e.preventDefault();
        if (this.state === "playing") this.shoot();
      };
      this.el.shootBtn.addEventListener("touchstart", fire, { passive: false });
      this.el.shootBtn.addEventListener("mousedown", fire);
    }

    /* ---------- state transitions ---------- */
    _resetRun() {
      this.rocket = new Rocket(this.width, this.height);
      this.asteroids = [];
      this.bullets = [];
      this.particles = [];
      this.powerups = [];
      this.score = 0;
      this.displayScore = 0;
      this.lives = 3;
      this.level = 1;
      this.elapsed = 0;
      this.spawnTimer = 0;
      this.powerupTimer = rand(6, 10);
      this.shootCooldown = 0;
      this.timeScale = 1; // for slow-mo
      this.screenShake = 0;
      this._renderLives();
      this._renderPowerups();
      this.el.score.textContent = "0";
      this.el.level.textContent = "1";
    }

    startCountdown() {
      this.sound._ensure(); // unlock audio on user gesture
      this._resetRun();
      this.state = "countdown";
      this._hideAllOverlays();
      this.el.hud.classList.remove("hidden");
      this.el.topControls.classList.remove("hidden");
      this._maybeShowMobile();
      this.el.countdown.classList.remove("hidden");

      let n = 3;
      const showNum = (label) => {
        this.el.countdownNum.textContent = label;
        this.el.countdownNum.style.animation = "none";
        void this.el.countdownNum.offsetWidth; // reflow to restart animation
        this.el.countdownNum.style.animation = "count-pop 0.7s ease";
      };
      showNum(n);
      this.sound.countBeep();
      this._countInterval = setInterval(() => {
        n--;
        if (n > 0) {
          showNum(n);
          this.sound.countBeep();
        } else if (n === 0) {
          showNum("GO!");
          this.sound.go();
        } else {
          clearInterval(this._countInterval);
          this.el.countdown.classList.add("hidden");
          this.state = "playing";
          this.lastTime = performance.now();
        }
      }, 800);
    }

    togglePause() {
      if (this.state === "playing") {
        this.state = "paused";
        this.el.pauseScreen.classList.remove("hidden");
      } else if (this.state === "paused") {
        this.el.pauseScreen.classList.add("hidden");
        this.state = "playing";
        this.lastTime = performance.now();
      }
    }

    toMenu() {
      if (this._countInterval) clearInterval(this._countInterval);
      this.state = "menu";
      this._hideAllOverlays();
      this.el.hud.classList.add("hidden");
      this.el.topControls.classList.add("hidden");
      this.el.shootBtn.classList.add("hidden");
      this.el.startScreen.classList.remove("hidden");
      this._updateHighUI();
    }

    gameOver() {
      this.state = "gameover";
      this.sound.gameover();
      const finalScore = Math.floor(this.score);
      const isRecord = finalScore > this.highScore;
      if (isRecord) {
        this.highScore = finalScore;
        this._saveHigh();
      }
      this.el.finalScore.textContent = finalScore;
      this.el.finalHigh.textContent = this.highScore;
      this.el.newRecord.classList.toggle("hidden", !isRecord);
      this.el.shootBtn.classList.add("hidden");
      this.el.gameoverScreen.classList.remove("hidden");
      this._updateHighUI();
    }

    _hideAllOverlays() {
      this.el.startScreen.classList.add("hidden");
      this.el.countdown.classList.add("hidden");
      this.el.pauseScreen.classList.add("hidden");
      this.el.gameoverScreen.classList.add("hidden");
    }

    _maybeShowMobile() {
      const isTouch =
        window.matchMedia("(hover: none) and (pointer: coarse)").matches ||
        "ontouchstart" in window ||
        navigator.maxTouchPoints > 0;
      this.el.shootBtn.classList.toggle("hidden", !isTouch);
    }

    /* ---------- gameplay actions ---------- */
    shoot() {
      if (this.shootCooldown > 0) return;
      this.shootCooldown = 0.22;
      this.bullets.push(new Bullet(this.rocket.x, this.rocket.y - 20));
      this.sound.shoot();
    }

    _renderLives() {
      const total = 3;
      let html = "";
      for (let i = 0; i < total; i++) {
        html += `<span class="life ${i < this.lives ? "" : "lost"}">❤️</span>`;
      }
      this.el.lives.innerHTML = html;
    }

    _renderPowerups() {
      const chips = [];
      const add = (type, remaining, total) => {
        const meta = POWERUP_META[type];
        const pct = clamp((remaining / total) * 100, 0, 100);
        chips.push(
          `<div class="powerup-chip" style="border-color:${meta.color}">
             <span style="color:${meta.color}">${meta.glyph}</span>${meta.label}
             <span class="bar"><i style="width:${pct}%;background:${meta.color}"></i></span>
           </div>`
        );
      };
      if (this.rocket) {
        if (this.rocket.shield > 0) add("shield", this.rocket.shield, 6);
        if (this.rocket.speedBoost > 0) add("speed", this.rocket.speedBoost, 6);
        if (this.timeScale < 1) add("slowmo", this._slowmoRemaining || 0, 5);
      }
      this.el.powerupBar.innerHTML = chips.join("");
    }

    applyPowerUp(type) {
      this.sound.powerup();
      if (type === "shield") this.rocket.shield = 6;
      else if (type === "speed") this.rocket.speedBoost = 6;
      else if (type === "slowmo") {
        this.timeScale = 0.45;
        this._slowmoRemaining = 5;
      }
      this._spawnParticles(this.rocket.x, this.rocket.y, 16, POWERUP_META[type].color);
    }

    _spawnParticles(x, y, count, color) {
      for (let i = 0; i < count; i++) {
        this.particles.push(new Particle(x, y, { color }));
      }
    }

    _explosion(x, y, big) {
      const count = big ? 34 : 20;
      const colors = ["#ffcc4d", "#ff9d3f", "#ff5a6e", "#ffe08a"];
      for (let i = 0; i < count; i++) {
        this.particles.push(
          new Particle(x, y, {
            color: colors[randInt(0, colors.length - 1)],
            speed: rand(80, big ? 380 : 260),
            life: rand(0.4, 1),
            r: rand(1.5, big ? 5 : 3.5),
          })
        );
      }
    }

    /* ---------- difficulty ---------- */
    _difficulty() {
      // Level derived from score; scales spawn + speed
      return this.level;
    }

    _updateLevel() {
      const newLevel = Math.floor(this.score / 500) + 1;
      if (newLevel !== this.level) {
        this.level = newLevel;
        this.el.level.textContent = this.level;
      }
    }

    /* ---------- main loop ---------- */
    _startBackgroundLoop() {
      const loop = (now) => {
        this.rafId = requestAnimationFrame(loop);
        let dt = (now - this.lastTime) / 1000;
        this.lastTime = now;
        if (isNaN(dt) || dt > 0.1) dt = 0.016; // clamp big gaps (tab switch)

        // Background always animates
        this.starfield.update(dt * (this.state === "playing" ? this.timeScale : 0.6));

        if (this.state === "playing") {
          this._update(dt * this.timeScale, dt);
        }
        this._draw();
      };
      this.lastTime = performance.now();
      this.rafId = requestAnimationFrame(loop);
    }

    _update(dt, realDt) {
      this.elapsed += dt;
      const rocket = this.rocket;

      // ----- Score -----
      this.score += dt * 100;
      this._updateLevel();
      this.el.score.textContent = Math.floor(this.score);

      // ----- Cooldowns / timers -----
      if (this.shootCooldown > 0) this.shootCooldown -= realDt;
      if (rocket.invuln > 0) rocket.invuln -= realDt;
      if (rocket.shield > 0) rocket.shield -= realDt;
      if (rocket.speedBoost > 0) rocket.speedBoost -= realDt;
      if (this.timeScale < 1) {
        this._slowmoRemaining -= realDt;
        if (this._slowmoRemaining <= 0) this.timeScale = 1;
      }
      this._renderPowerups();

      // ----- Player movement -----
      this._moveRocket(realDt);

      // ----- Spawning -----
      const diff = this._difficulty();
      this.spawnTimer -= dt;
      const spawnInterval = clamp(1.15 - diff * 0.09, 0.28, 1.15);
      if (this.spawnTimer <= 0) {
        this.spawnTimer = spawnInterval * rand(0.7, 1.2);
        this.asteroids.push(new Asteroid(this.width, this.height, diff));
        if (diff >= 4 && Math.random() < 0.4) {
          this.asteroids.push(new Asteroid(this.width, this.height, diff));
        }
      }

      // Power-up spawns
      this.powerupTimer -= dt;
      if (this.powerupTimer <= 0) {
        this.powerupTimer = rand(9, 15);
        this.powerups.push(new PowerUp(this.width, this.height));
      }

      // ----- Update entities -----
      for (const a of this.asteroids) a.update(dt);
      for (const b of this.bullets) b.update(dt);
      for (const p of this.particles) p.update(realDt);
      for (const pu of this.powerups) pu.update(dt);

      // ----- Bullet vs asteroid -----
      for (const b of this.bullets) {
        if (b.dead) continue;
        for (const a of this.asteroids) {
          if (a.dead) continue;
          if (dist2(b.x, b.y, a.x, a.y) < (a.radius + b.r) ** 2) {
            b.dead = true;
            a.hp -= 1;
            this._spawnParticles(b.x, b.y, 5, "#ffe08a");
            if (a.hp <= 0) {
              a.dead = true;
              this._explosion(a.x, a.y, a.radius > 40);
              this.score += 25;
            }
            break;
          }
        }
      }

      // ----- Power-up pickup -----
      for (const pu of this.powerups) {
        if (pu.dead) continue;
        if (dist2(pu.x, pu.y, rocket.x, rocket.y) < (pu.r + rocket.r) ** 2) {
          pu.dead = true;
          this.applyPowerUp(pu.type);
        }
      }

      // ----- Rocket vs asteroid -----
      if (rocket.invuln <= 0) {
        for (const a of this.asteroids) {
          if (a.dead) continue;
          const hitR = a.radius * 0.82 + rocket.r * 0.7;
          if (dist2(a.x, a.y, rocket.x, rocket.y) < hitR * hitR) {
            if (rocket.shield > 0) {
              // Shield absorbs: destroy asteroid, no life lost
              a.dead = true;
              this._explosion(a.x, a.y, a.radius > 40);
              rocket.shield = 0;
              this.screenShake = 8;
              this.sound.hit();
            } else {
              a.dead = true;
              this._explosion(a.x, a.y, true);
              this._hitPlayer();
            }
            break;
          }
        }
      }

      // ----- Cleanup -----
      this.asteroids = this.asteroids.filter((a) => !a.dead);
      this.bullets = this.bullets.filter((b) => !b.dead);
      this.particles = this.particles.filter((p) => !p.dead);
      this.powerups = this.powerups.filter((p) => !p.dead);

      if (this.screenShake > 0) this.screenShake = Math.max(0, this.screenShake - realDt * 30);
    }

    _hitPlayer() {
      this.lives -= 1;
      this._renderLives();
      this.sound.hit();
      this.screenShake = 16;
      this.rocket.invuln = 2; // brief invulnerability
      if (this.lives <= 0) {
        this._explosion(this.rocket.x, this.rocket.y, true);
        this.gameOver();
      }
    }

    _moveRocket(dt) {
      const r = this.rocket;
      const speed = r.baseSpeed * (r.speedBoost > 0 ? 1.6 : 1);
      let moving = false;

      // Pointer (mouse / touch) takes priority when active
      if (this.pointer.active) {
        const dx = this.pointer.x - r.x;
        const dy = this.pointer.y - r.y;
        const d = Math.hypot(dx, dy);
        if (d > 2) {
          const step = Math.min(d, speed * dt);
          r.x += (dx / d) * step;
          r.y += (dy / d) * step;
          r.tilt = clamp(dx / 200, -0.4, 0.4);
          moving = d > 8;
        } else {
          r.tilt *= 0.85;
        }
      } else {
        // Keyboard
        let ix = 0;
        let iy = 0;
        if (this.keys["arrowleft"] || this.keys["a"]) ix -= 1;
        if (this.keys["arrowright"] || this.keys["d"]) ix += 1;
        if (this.keys["arrowup"] || this.keys["w"]) iy -= 1;
        if (this.keys["arrowdown"] || this.keys["s"]) iy += 1;
        if (ix !== 0 || iy !== 0) {
          const len = Math.hypot(ix, iy) || 1;
          r.x += (ix / len) * speed * dt;
          r.y += (iy / len) * speed * dt;
          r.tilt = clamp(ix * 0.35, -0.4, 0.4);
          moving = true;
        } else {
          r.tilt *= 0.85;
        }
      }

      r.thrusting = moving;
      if (moving) {
        // occasional thrust sound + thrust particles
        if (Math.random() < 0.4) {
          this.particles.push(
            new Particle(r.x, r.y + 16, {
              angle: Math.PI / 2 + rand(-0.4, 0.4),
              speed: rand(40, 120),
              life: rand(0.2, 0.4),
              r: rand(1, 2.5),
              color: Math.random() > 0.5 ? "#ff9d3f" : "#ffe08a",
              drag: 3,
            })
          );
        }
        if (Math.random() < 0.08) this.sound.thrust();
      }

      // Keep in bounds
      r.x = clamp(r.x, r.r, this.width - r.r);
      r.y = clamp(r.y, r.r, this.height - r.r);
    }

    /* ---------- draw ---------- */
    _draw() {
      const ctx = this.ctx;
      ctx.clearRect(0, 0, this.width, this.height);

      ctx.save();
      if (this.screenShake > 0) {
        ctx.translate(rand(-this.screenShake, this.screenShake), rand(-this.screenShake, this.screenShake));
      }

      this.starfield.draw(ctx);

      if (this.state === "playing" || this.state === "paused" || this.state === "gameover") {
        for (const pu of this.powerups || []) pu.draw(ctx);
        for (const a of this.asteroids || []) a.draw(ctx);
        for (const b of this.bullets || []) b.draw(ctx);
        for (const p of this.particles || []) p.draw(ctx);

        // Rocket (hidden once fully dead on game over)
        if (this.rocket && !(this.state === "gameover" && this.lives <= 0)) {
          const blink = this.rocket.invuln > 0 && Math.floor(this.rocket.invuln * 12) % 2 === 0;
          this.rocket.draw(ctx, blink);
        }
      }

      ctx.restore();
    }
  }

  // Boot
  window.addEventListener("DOMContentLoaded", () => {
    window.__spaceGame = new Game();
  });
})();
