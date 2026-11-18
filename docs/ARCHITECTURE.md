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
