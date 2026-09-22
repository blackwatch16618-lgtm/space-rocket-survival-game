# 🚀 Space Survivor

A polished, browser-based arcade game built with **pure HTML5, CSS3, and vanilla JavaScript** — no frameworks, no build step, no external assets. Pilot a rocket through an endless asteroid field and survive as long as you can.

![Space Survivor](https://img.shields.io/badge/vanilla-JS-yellow) ![No dependencies](https://img.shields.io/badge/dependencies-0-brightgreen)

## ▶️ How to Play

Just open `index.html` in any modern browser. That's it — no server or install required.

```
space-game/
├── index.html   # markup + screens
├── style.css    # arcade space styling
├── script.js    # all game logic (canvas)
└── README.md
```

## 🎮 Controls

| Action | Desktop | Mobile |
| ------ | ------- | ------ |
| Move   | Arrow Keys / WASD / Mouse | Drag anywhere on screen |
| Shoot  | `Space` or click | FIRE button |
| Pause  | `P` or the ❚❚ button | ❚❚ button |
| Mute   | ♪ button | ♪ button |

The rocket follows your mouse/finger when you move it, or responds to keyboard input otherwise.

## ✨ Features

- **Smooth rocket flight** with engine thrust animation and screen-boundary clamping.
- **Procedural asteroids** — random sizes, shapes, speeds, rotation, and wobble that grow more chaotic as you level up.
- **Lives + health** — start with 3 lives, brief invulnerability (blink) after a hit.
- **Scoring & levels** — score climbs while you survive; every 500 points advances the level and ramps difficulty (faster & more frequent asteroids, bigger variety, unpredictable movement).
- **Local high score** — saved to `localStorage` and shown on the start and game-over screens.
- **Power-ups**
  - ◈ **Shield** — absorbs one hit.
  - » **Speed Boost** — temporary faster movement.
  - ◷ **Slow-Motion** — slows the whole field briefly.
- **Shooting system** — destroy asteroids for bonus points (large ones take two hits).
- **Juice** — explosion & thrust particles, screen shake on impact, twinkling parallax starfield with distant planets/nebulae.
- **Generated sound** via the Web Audio API — thrust, shooting, collisions, game over, and UI clicks. No audio files needed. Toggle with the ♪ button.
- **Start countdown** — 3 → 2 → 1 → GO!
- **Fully responsive** — works on desktop, laptop, tablet, and mobile with large tap targets and touch controls. Handles window resizing correctly.

## 🕹️ Screens

- **Start:** `SPACE SURVIVOR` · *Survive the asteroid field!* · **START GAME**
- **Game Over:** `GAME OVER` · *Your rocket was destroyed* · final score & high score · **PLAY AGAIN**
- **Pause:** resume or quit to menu.

## 🛠️ Technical Notes

- Rendering is done entirely on an HTML5 `<canvas>` scaled for high-DPI (retina) displays.
- A single `requestAnimationFrame` loop drives the background, updates, and drawing; delta-time is clamped so tab-switching doesn't cause a physics jump.
- Game state (`menu / countdown / playing / paused / gameover`) is fully reset on each new run — no leftover asteroids, bullets, or timers between games.
- Code is organized into small classes: `Sound`, `Starfield`, `Rocket`, `Asteroid`, `Bullet`, `Particle`, `PowerUp`, and `Game`.

## 📄 License

Free to use, modify, and share. Have fun!
