# Tower Smash 3D

A mobile-first 3D physics destruction game. Build towers block by block (or load a 5,000-block citadel), then wreck them with baseballs, anvils, nukes, black holes, earthquakes and tornadoes.

**Play:** https://alecsras.github.io/tower-smash-3d/ (once GitHub Pages is on; see below). You can also open `dist/index.html` directly in a browser.

Install it on a phone: open the link, then choose **Share → Add to Home Screen** (iPhone) or **⋮ → Install app** (Android). It runs fullscreen and works offline.

## Features
- **Build mode:** tap to stack 11 piece types (wood, stone, glass, TNT, planks, columns, roof wedges, spires, dominoes…).
- **Famous builds:** Jenga, Greek Temple, Stonehenge, Pagoda, Colosseum, Domino Run, plus Mega builds of 500–5,110 blocks (Mega Fortress, Great Pyramid, Metropolis, Domino Spiral, Medieval Village, The Citadel).
- **Custom builder:** pick a shape, size (e.g. `5x5x30`), material and extras, or type a multi-line blueprint:
  ```
  clear
  wall 15x1x7 stone battlements at 0,-10
  round 5x5x12 stone windows 4 roof at 10.5,10.5
  tower 7x7x16 checker floors 4 roof tnt core
  solid 12x12x1 concrete
  tower 8x8x50 glass windows 1 floors 5 up 1 roof
  ```
  Shapes: `solid`, `tower`, `round`, `pyramid`, `wall`, `stairs`, and `slab` (a single solid piece for floors, decks and bridges). Extras: `windows N`, `floors N`, `thick N`, `battlements`, `roof`, `tnt core`, `at x,z`, `up N`. The builder supports up to 12,000 blocks and rejects overlapping structures.
- **Throw mode:** tap where you want to hit and hold longer for more speed (with an aiming arc and target marker). S/M/L/XL sizes.
- **Arsenal:** Baseball, Bowling ball, Cannonball, Brick, Anvil, Boulder, Bomb, Cluster bomb, Rocket, Meteor shower, Black hole, Nuke.
- **Disasters:** Earthquake (a moving kinematic ground slab), Tornado, Meteor storm.
- **Challenge mode:** 10 levels with limited ammo and 1–3 stars, with progress saved in localStorage.
- **Extras:** night mode, slow-mo, combo pop-ups, rebuild, undo, glass that shatters, TNT chain reactions.

## Modes
- **⚔️ Build vs Smash duels:** build a fortress on a block budget (TNT costs 5) and send a link or code. Your friend gets 3 shots, and their best score travels with the link when they send it on.
- **🏆 Campaign:** 50 generated levels, with a boss every 10th level. Pop every 🟢 Blorb hiding in and on the structures. Stars depend on how many shots you have left.
- **Demolition:** 10 challenges where you aim for a % toppled with limited ammo.
- **📅 Daily:** a new seeded city every day, 3 shots, a streak bonus, and a copyable score.
- **🪙 Coins and shop:** earn coins by smashing, popping Blorbs, earning stars and playing the daily. Special weapons unlock with coins, or turn on Sandbox mode to unlock everything.

## Destruction
- **Cracking:** hard hits and explosions split wood, stone, concrete and marble into real physical chunks.
- **Fire:** explosions, Firebombs, meteors and nukes ignite wood. Fire spreads to neighbours, chars blocks, and charred blocks crumble.
- **🎬 Instant replay:** records the last ~7 s and plays it back in slow motion with a cinematic orbiting camera. **Replay + save clip** records it to a video file.
- **Glow:** a High-quality graphics setting (in the shop) adds glow to fire, explosions and night windows.

## ✨ Describe-it builder
In 📐 Custom, type something like "a lighthouse" or "the Eiffel Tower". Inside the Claude artifact viewer, Claude writes a blueprint in the command language below. If the blueprint breaks a physics rule, the error goes back to Claude, which fixes it once. Everywhere else, the builder falls back to a built-in library of landmarks.

## GitHub Pages setup (one time)
1. Make the repo **public**. Free GitHub Pages requires it, or a paid plan for private repos.
2. **Settings → Pages → Source: GitHub Actions.**

After that, every push to `main` builds and deploys automatically (`.github/workflows/pages.yml`). Duel links point at the Pages URL.

## Tech
- **Rendering:** [three.js](https://threejs.org) with instanced meshes, so identical pieces share one draw call and thousands of blocks stay smooth.
- **Physics:** [Rapier](https://rapier.rs) (WASM) with continuous collision detection for fast projectiles.
- **Dormant blocks:** resting pieces sit in a spatial hash *outside* the simulation and join it only when something moving comes near. A standing 5,000-block castle costs almost nothing until you hit it.
- **Sound:** synthesized with Web Audio; there are no audio files.

## Develop
```bash
npm install
npm run build      # -> dist/index.html (single file, ~2.5 MB incl. the physics WASM)
npm run serve      # optional local server
```

| File | What it is |
|---|---|
| `src/main.js` | Game: scene, pieces, presets, custom/AI builder, weapons, disasters, fire and fracture, replay, campaign, duels, shop, UI, input, sound |
| `public/` | PWA manifest, service worker (offline), icons. These are copied into `dist/` |
| `.github/workflows/pages.yml` | Builds and deploys to GitHub Pages on every push |
| `src/phys.js` | Rapier wrapper (`PBody`), cached poses, collision events, dormancy support |
| `src/index.template.html` | Page shell + CSS; the bundle is inlined at `/*BUNDLE*/` |
| `build.mjs` | esbuild → one self-contained `dist/index.html` |
