# Progress

## Current phase
Reconciled RTS (v2+): restored control groups, rally points, attack move, hold position, deep save validation, and comprehensive RTS tests.

## Completed
- Vite + React + TypeScript strict + Phaser + Zustand + Vitest + ESLint baseline.
- Arabic RTL menu, kingdom/difficulty selection, LocalStorage saves (autosave every 2 min).
- Grid building system: cursor preview, snap-to-grid, green/red validity, blocked overlap/out-of-bounds/nodes, cost deducted only on confirm, cancel via Esc/right-click, worker walks to site, construction progress bar + health ramp.
- Movement: A* over building/node-blocked grid, group destination slots, basic separation steering, no per-frame repath.
- Combat: auto target acquisition, chase/repath, target switching on death, melee + ranged projectiles, watchtower bolts with cooldown, counters (cavalry>archers, archers>workers/swordsmen), commander aura (+15% within 170px), Flame +10% damage, Mountains building HP bonus, health bars.
- Fog of war: unexplored black, explored dimmed, visible clear; vision from units/buildings (towers see farther); enemy units hidden unless visible; enemy buildings leave fading markers (90s); minimap respects fog; explored cells persist in save.
- Minimap: canvas render of nodes/buildings/units + camera viewport + click-to-move camera.
- Enemy AI: profile per difficulty (think interval, gather rates, worker/army targets), worker assignment across food/wood/stone/gold, worker training, farm before pop-cap, barracks→stable, mixed army training, watchtower, scout then group attack, defend base, no fog cheating, no free resources (needs builders/workers).
- Repair (worker + wood cost), construction cancel 75% refund, demolish with Delete double-confirm (25% refund).
- Alerts: insufficient resources, pop cap, construction done, training done, base under attack, save fail/success, demolish confirm, idle worker, enemy sighted.
- Settings panel: camera speed, SFX volume, music volume, mute; persisted in LocalStorage.
- Audio: WebAudio-synthesized cues (see ASSET_LICENSES.md), ambient hum.
- i18n catalog in `src/i18n.ts` for all prompt strings.
- Vite `base: '/work/'` + Pages workflow + publish docs.
- **Control groups (1-5)**: assign selected units (Ctrl+1-5), select group members (1-5 single tap), purge dead/missing units on load.
- **Rally points**: right-click building to set rally destination (R hotkey to toggle mode), trained units move to rally point.
- **Attack move**: units patrol and engage enemies (A hotkey + right-click or context).
- **Hold position**: H hotkey freezes unit position, detects if unit wanders beyond hold radius (200px).
- **Stop command**: S hotkey clears movement, path, and targets (only active when units selected to avoid camera conflict).
- **Deep SaveData validation**: strict schema validation for version, enums (kingdom, difficulty, resource/unit/building types, unit states), finite nonnegative values, coordinates bounds, health caps, resource amounts, duplicate ID checks, explored cell format, control groups integrity.

## In progress
- Balance pass, expanded alert triggers.

## Remaining
- Unit portraits, wall auto-connect, tech upgrades, unit formations.
- Performance: fog + full scene redraw every frame is O(map + units); fine at ~100 units, could move to dirty-rect updates.

## Known issues
- Phaser bundle ~1.4 MB (Vite chunk-size warning).
- Enemy workers walk long distances since node assignment is simple; acceptable for slice.

## Latest validation
`npm run typecheck`, `npm run lint`, `npm run test:run`, `npm run build`, and `git diff --check` — all PASS locally after reconciliation — 2026-08-08.

## Test Summary (39 tests)
- **game.test.ts**: 31 tests
- **ai.test.ts**: 8 tests, including regression coverage that AI does not receive a free resource trickle merely from a worker being in `gathering` state.

## Reconciliation notes
- Restored deep runtime save validation and preserved RTS fields including rally points and control groups.
- Removed the AI gathering trickle from `src/ai.ts`; resource increases remain tied to the store's real gathering/deposit flow.
- Control groups are sanitized immediately during load: only groups 1-5, live player unit IDs, and de-duplicated IDs remain.
- Stop is bound to `S` when units are selected; otherwise `S` remains the camera-down key.
- The previous 40-test report came from a different working tree/state. The current remote history contained 37 tests and lacked the first-round AI/save changes; reconciliation restored the regression test and added load cleanup coverage, resulting in 39 tests.

## Recommended next task
Playtest and balance the reconciled RTS controls and save behavior. Tech tree, formations, wall auto-connect, and performance work remain future scope.
