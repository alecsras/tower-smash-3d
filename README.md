# Tower Smash 3D

A mobile-first 3D physics destruction game. Build towers block by block (or load a 5,000-block citadel), then wreck them with baseballs, anvils, nukes, black holes, earthquakes and tornadoes.

**Play:** open `dist/index.html` in a browser. It's one self-contained file, with no server or install needed.

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
  Shapes: `solid`, `tower`, `round`, `pyramid`, `wall`, `stairs`. Extras: `windows N`, `floors N`, `thick N`, `battlements`, `roof`, `tnt core`, `at x,z`, `up N`. The builder supports up to 12,000 blocks and rejects overlapping structures.
- **Throw mode:** tap where you want to hit and hold longer for more speed (with an aiming arc and target marker). S/M/L/XL sizes.
- **Arsenal:** Baseball, Bowling ball, Cannonball, Brick, Anvil, Boulder, Bomb, Cluster bomb, Rocket, Meteor shower, Black hole, Nuke.
- **Disasters:** Earthquake (a moving kinematic ground slab), Tornado, Meteor storm.
- **Challenge mode:** 10 levels with limited ammo and 1–3 stars, with progress saved in localStorage.
- **Extras:** night mode, slow-mo, combo pop-ups, rebuild, undo, glass that shatters, TNT chain reactions.

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
| `src/main.js` | Game: scene, pieces, presets, custom builder, weapons, disasters, challenges, UI, input, sound |
| `src/phys.js` | Rapier wrapper (`PBody`), cached poses, collision events, dormancy support |
| `src/index.template.html` | Page shell + CSS; the bundle is inlined at `/*BUNDLE*/` |
| `build.mjs` | esbuild → one self-contained `dist/index.html` |
