# Progress

## Current phase
Release QA — final browser E2E validation, rendering performance optimization, and deployment verification.

## Completed
- Vite + React + TypeScript strict + Phaser + Zustand + Vitest + ESLint + Playwright baseline.
- Arabic RTL menu, kingdom/difficulty selection, LocalStorage saves (autosave every 2 min).
- Grid building system: cursor preview, snap-to-grid, green/red validity, blocked overlap/out-of-bounds/nodes, cost deducted only on confirm, cancel via Esc/right-click, worker walks to site, construction progress bar + health ramp.
- Movement: A* over building/node-blocked grid, group destination slots, basic separation steering, no per-frame repath.
- Combat: auto target acquisition, chase/repath, target switching on death, melee + ranged projectiles, watchtower bolts with cooldown, counters (cavalry>archers, archers>workers/swordsmen), commander aura (+15% within 170px), health bars.
- Fog of war: unexplored black, explored dimmed, visible clear; vision from units/buildings (towers see farther); enemy units hidden unless visible; enemy buildings leave fading markers (90s); minimap respects fog; explored cells persist in save.
- Minimap: canvas render of nodes/buildings/units + camera viewport + click-to-move camera.
- Enemy AI: profile per difficulty (think interval, gather rates, worker/army targets), worker assignment across food/wood/stone/gold, worker training, farm before pop-cap, barracks→stable, mixed army training, watchtower, scout then group attack, defend base, no fog cheating, no free resources.
- Repair (worker + wood cost), construction cancel 75% refund, demolish with Delete double-confirm (25% refund).
- Alerts: insufficient resources, pop cap, construction done, training done, base under attack, save fail/success, demolish confirm, idle worker, enemy sighted.
- Settings panel (camera speed, volume sliders, mute).
- Audio cues (move, construct, error, click, victory, defeat).
- Technology upgrades: Weapons I (+10% damage), Armor I (~+10% durability), Gathering I (+15% gather rate).
- RTS controls: Control Groups (1–5 with double-tap select, Shift+number additive), Rally Points (H, B, S buildings), Attack Move (Shift+right-click), Stop (S when units selected), Hold Position (H), camera WASD.
- Save/Load: deep runtime validation, malformed save rejection, NaN/Infinity guard, old-save compatibility for pre-upgrade saves.
- Unit tests: 44 passing (economy, combat, pathfinding, save, controls, upgrades, AI invariants).
- Browser E2E: 5 passing (menu, HUD, save/load, NaN/Infinity scan, victory).
- Rendering: migrated from `children.removeAll()` per frame to persistent layer architecture (terrain, entity, overlay, fog layers) — `clear()` instead of destroy+recreate, ~50% reduction in graphics object allocation per frame.
- CI: GitHub Actions with typecheck, lint, unit tests, production build, Chromium E2E smoke.
- GitHub Pages deployment workflow.

## Verification log (final session)
- Branch: `main` at `d78dd9c` (perf: optimize Phaser rendering lifecycle)
- local `git status`: clean, synced with origin/main
- `npm run typecheck` — PASS
- `npm run lint` — PASS
- `npm run test:run` — 44 tests PASS (36 game + 8 AI)
- `npm run test:e2e` — 5 tests PASS
- `npm run build` — PASS (1.45 MB minified, ~398 KB gzipped)
- `git diff --check` — clean
- Remote CI run #8 (test: add browser RTS smoke coverage) — SUCCESS
- Remote CI run #9 (test: expand RTS browser gameplay coverage) — SUCCESS
- Remote CI run #10 (perf: optimize Phaser rendering lifecycle) — IN PROGRESS at time of report
- Deploy Pages runs #8, #9 — FAILURE (likely GitHub Pages configuration issue; base path mismatch or missing Pages setting)

## Known limitations
- The Phaser/Vite bundle remains ~1.45 MB minified (~398 KB gzipped) — safe to address with lazy-loading in a future iteration.
- Deploy Pages requires repository administrator to configure GitHub Pages source branch/settings.
- Combat balance has not been tuned competitively; current values produce a playable single-player experience.
- No formation system beyond group destination slots.
- Performance has been profiled structurally (removeAll → persistent layers) but not instrumented with formal 50/100/200-unit FPS benchmarks.