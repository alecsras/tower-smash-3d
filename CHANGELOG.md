# Changelog

## 0.13.0 — 50 new weapons, bigger explosions

- 50 new weapons, 93 in all. Kinetic: Golf Barrage, Javelin, Saw Blade, Ball Bearings, Falling Safe, Boulder Avalanche, Cannon Volley, Steel Girder, Bowling Barrage, Giant Fist. Explosive: Mortar, MIRV, Landmines, Airstrike, Thermobaric, Firecrackers, Bouncing Bomb, Countdown Megabomb, Chain Bomb, Barrel Drop, Sonic Boom, Rocket Barrage. Elemental: Blizzard, Inferno, Hurricane, Quake Shell, Geyser, Sandstorm, Thermite, Thunderstorm, Ice Lance, Magma Flood. Exotic: White Hole, Time Bubble, Teleporter, Disintegrator, Gravity Well, Rod from God, Plasma Cannon, Repulsor Beam, Levitation Field, Quantum Scatter. Silly: Watermelon, Flying Cow, Jelly Cube, Confetti Cannon, Kitchen Sink, Snowball Volley, Beach Ball, Monster Tire.
- Explosions are bigger and more realistic: 30% more reach, a much harder push near the centre, more shattering, and a staged look — flash, an orange fireball with a white-hot core that cools as it swells, a shockwave, a dust ring racing along the ground, dirt clods, embers and a dark smoke plume that rises and lingers. Big blasts get a white screen flash and a delayed rumble. Effects scale with the graphics setting.

## 0.12.1 — Ten big builds

- Ten new mega builds of 2,000–3,000 blocks: Royal Castle, City Skyline, Sun Pyramid, Grand Colosseum, Labyrinth, Cathedral, Mega Dam, Domino Carpet (2,200 dominoes that fall row by row), Stone Forest and Office Grid. All tested to stand on their own with every block awake.

## 0.12.0 — Phase 2, Milestone 3: campaign, unlocks, engineer challenges

- Campaign worlds: the 50 Blorb levels are now five worlds (Timber Town, Stone Valley, Concrete City, Marble Heights, Golden Citadel) that open at 0, 12, 30, 50 and 75 stars. Worlds you've already played stay open.
- Five new demolition challenges on the ~1,000-block builds: Sky Tower Takedown, Wall Breaker, Arena Rumble, Ziggurat Blast and Bridge Down.
- Unlocks: premium materials unlock with total stars (Brick 5, Ice 10, Marble 20, Rubber 30, Steel 45, Crystal 60, Gold 80, Obsidian 100), with a message when one opens.
- Engineer challenges (Levels → Engineer): build at least a set height within a block budget, then an earthquake, boulders, a tornado or meteors test it. Stars for how much is still standing.

## 0.11.0 — Phase 2, Milestone 2: feel and scoring

- Destruction score: every toppled block scores by material and height, and chain reactions build a combo up to ×5. Live in the top bar, on level results, with a best score kept for every build and level.
- Impact feel: dust where heavy blocks hit the ground, a camera kick on big direct hits, and a beat of slow-motion with a rumble when a chain reaction takes off.
- Rubble settles: blocks that come to rest freeze into scenery until something hits them, so big collapses stop costing physics time. After a 5,000-block Citadel collapse, physics work drops about 20× within 20 seconds.
- Graphics tiers: High, Balanced and a new Light tier for older phones (no shadows, fewer effects). Auto picks one for your device and steps down if the game slows.
- Faster start: shaders compile behind the loading screen; shorter fade.
- Privacy: Settings → Share anonymous stats (on by default, nothing is sent yet), plus a clear note in Help → About & privacy.

## 0.10.0 — Phase 2, Milestone 1: performance core

- Fixed 60 Hz physics: the simulation always advances in exact 1/60 s steps, and drawing blends between steps, so 120 Hz screens and slow-motion stay smooth and slow phones behave the same as fast ones. Game timers (fuses, debris, breakage) follow the physics actually simulated.
- New physics engine layer: Rapier runs behind a small command protocol (engine.js) that works either on the main thread or in a Web Worker. Bonds and earthquakes no longer touch the engine directly.
- Background physics (beta): Settings → Graphics. In a 5,000-block collapse the main thread stays near 50 fps (it was under 5 fps in the same test). Off by default until real-phone numbers confirm it.
- Performance and usage stats: typical and slowest fps, worst frame, peak awake blocks, physics speed and a few key moments are counted on the device and included in feedback reports. Nothing is sent anywhere.
- Tests: worker mode (castle hit, Metropolis standing, earthquake with fused blocks) in Chrome and the iPhone engine; stability at 30 fps; stats in the report.

## 0.9.5 — ~1,000-block builds, material themes, steadier stacks

- Five new mega builds near 1,000 blocks: Sky Tower (972), Great Wall (883), Grand Arena (908), Desert Ziggurat (910) and Stone Viaduct (1,036). Mega builds are now listed smallest to largest.
- Material themes: pick a material in the Build Library (Original, Mixed, Stone, Wood, Glass, Ice, Steel, Gold, Marble, Brick, Concrete, Sand, Rubber, Crystal, Obsidian) and every build loads in it. In Build mode, More → Materials repaints whatever is on the pad, and Rebuild keeps the new material. TNT and dominoes keep their own material.
- Steadier stacks everywhere: preset layers and hand-placed blocks now sit flush (they used to float 4–5 mm apart, so a woken stack free-fell layer by layer and slammed together — the main cause of blocks sinking and bouncing). The physics engine also notices contacts a little further out.
- New tests: no overlapping blocks in any mega build, every new build stands with all blocks awake, material themes and the picker.

## 0.9.4 — Physics back to stable

- Fixed blocks sinking into the floor, bouncing and shooting up in every build. The cause was the "settle-to-sleep" speed-up from 0.9.2, which is removed.
- Back on the physics engine from 0.9.0 (Rapier 0.14). The faster 0.21 engine is shelved until it can be proven stable on iPhone.
- Kept: adaptive fracture detail, calm-rubble dormancy in 1,500+ block scenes, and shadows only redrawn when something moves.
- New stability tests run the real game loop at 60 and 120 fps in Chrome and in Safari's engine (iPhone).

## 0.9.3 — Stability fix

- Fixed builds collapsing on their own: blocks could sink into the floor and pop back up, knocking walls and whole builds down. Calm blocks now only go to sleep together with everything they touch.
- New test checks that builds stand on their own with every block awake.

## 0.9.2 — Performance

- Faster physics engine (Rapier 0.21 SIMD): about 1.8x faster on big collapses.
- Settled blocks go to sleep sooner, and calm rubble leaves the simulation, so a 5,000-block collapse runs with about half the active objects.
- Fracture detail scales with load, so explosions in huge builds no longer spike.
- Shadows are only redrawn when something moves.
- Needs iOS 16.4+ (or a current Chrome, Safari or Firefox); older browsers get a clear message.

## 0.9.0 — tester release (Nov 2026)
- Title screen, Home (Continue, Levels, Free play, Daily, Duels), pause menu, Settings and Help center.
- First-run intro cards, name, and the guided Training Yard; one-time tips for new features.
- Build Library: prefabs, mega builds, my builds and the AI Architect in one place.
- One design system: Nunito font, outline icons, shared sheets, buttons, chips, toasts and dialogs.
- Bottom dock with Build | Smash, tools and the tray; floating buttons reduced from ~25 to under 10.
- Settings: volume, vibration, graphics Auto/High/Light, reduce motion, camera arrows, name, export/import save, reset.
- Tester kit: Send feedback (GitHub, share or copy), crash screen, version and build number, privacy note, welcome page.
- Versioned save with migration; free-play build autosaves; Blorbs get an outline for color-blind players.
- Battery: rendering pauses in the background and drops to every other frame when nothing moves.
- Engineering: CSS split from the page, ESLint, Playwright tests in the repo, CI tests block deploys.

## Earlier
- Structural bonds (glue, weld, anchor), prefabs, Blueprint 2.0, AI builder edits and photo builds, camera modes.
- Builder 2.0 tools, 30 new weapons, new materials, blast effects.
- Duels, 50-level campaign, daily, Armory, fire, fracture, replay, PWA.
