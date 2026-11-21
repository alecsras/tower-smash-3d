# Architecture

Tower Smash is one web page. `build.mjs` joins `src/parts/*.js` in name order into a single module (one shared scope), bundles it with esbuild, inlines the CSS from `src/styles/` and the Nunito font, and writes `dist/index.html`.

## Parts, in load order

| Range | Area |
|---|---|
| 0100–0180 | Imports (three.js, Rapier, Lucide icons), boot screen, icon helpers, versioned save |
| 0200–0900 | Definitions, renderer and scene, materials, physics + dormancy, state, collisions, particles and smoke, camera |
| 1000–1060 | Building: placement, tools (line/box/walls/erase/paint/pick), bonds (glue/weld/anchor) |
| 1100–1220 | Presets, custom builder and Blueprint 2.0, prefabs and save slots |
| 1300–1500 | Throwing, specials, disasters, levels, Armory, duels, the 30-weapon arsenal, fire/fracture/replay |
| 1600 | AI Architect |
| 1700–1900 | Main loop, camera modes and coach marks, HUD and tray, input |
| 2000–2100 | Sound, app shell (screens, pause, settings, help, feedback, crash), onboarding, start-up |

## Key ideas

- **Dormant blocks.** Resting blocks live outside the physics world in a spatial hash and join it (asleep) when something moving comes near. Bonds follow their blocks in and out.
- **Screens over a live scene.** Title, Home and the intro are DOM overlays on top of the running 3D scene; `showScreen()` switches them and hides the HUD.
- **One challenge engine.** Campaign, challenges, daily, duels and the Training Yard are all `startChallenge(def)` with a goal, ammo and `onResult`.
- **Saving.** One `ts_save` record with a version number and `migrateSave()`; other `ts_*` keys hold stars, save slots and the free-play autosave. Export/import moves all of them as one code.
- **Testing hooks.** `window.__game` exists only with `?debug` or under automated tests.

## Physics engine layer (0.10)

- `src/engine.js` owns the Rapier world and nothing else. It takes a list of commands (`add`, `rm`, `wake`, `imp`, `joint`, `quake`, `step`, ...) and returns packed poses for awake bodies plus the collisions that started (with impact speed from pre-step velocities).
- `src/engine-entry.js` is bundled on its own (with Rapier) and embedded in the page as text (`#engineSrc`). The same copy starts either as a **Web Worker** (`?worker=1`, or Settings → Background physics) or as a main-thread script.
- `src/phys.js` is the game's side: `PBody` is a proxy with a cached pose; changes are queued as commands. `P.advance(n, STEP, onHit)` runs n fixed steps (main thread: now; worker: sent off, results taken in on a later frame) and returns how many steps' results arrived.
- The loop (`1700-loop.js`) uses a fixed 1/60 s accumulator; drawing blends between the last two steps (`physAlpha`, `P.renderPose`). Game time (`simTime`) advances only by simulated steps, so timers stay in step with the blocks.
- Never call Rapier from game code: add a command to `engine.js` and a method to the `P` object instead.
- **Settling (0.11):** in `engine.js`, a block still for 0.8 s (under 8 cm/s) that touches only the ground, frozen blocks or other still blocks becomes a *fixed* body. It still supports what rests on it but no longer joins the pile into one island, so Rapier can sleep the rest. It turns dynamic again when hit (over 0.6 m/s), pushed (impulse, velocity, wake), when a block under it moves or is removed (`dependents`), when a joint is added, or when a quake starts. Never use `rb.sleep()` on part of a touching group: Rapier 0.14 ignores it and 0.21 corrupts the body.
