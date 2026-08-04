# Progress

## Current phase
Expanded playable RTS (v2). Deployed repository: https://github.com/testoo202610-jpg/work

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
- Alerts: insufficient resources, pop cap, construction done, training done, base under attack, save fail/success, demolish confirm.
- Settings panel: camera speed, SFX volume, music volume, mute; persisted in LocalStorage.
- Audio: WebAudio-synthesized cues (see ASSET_LICENSES.md), ambient hum.
- i18n catalog in `src/i18n.ts` for all prompt strings.
- Vite `base: '/work/'` + Pages workflow + publish docs.

## In progress
- Balance pass, richer alerts (idle worker, enemy sighted).

## Remaining
- Control groups, unit portraits, rally points, wall auto-connect, tech upgrades.
- Performance: fog + full scene redraw every frame is O(map + units); fine at ~100 units, could move to dirty-rect updates.

## Known issues
- Phaser bundle ~1.4 MB (Vite chunk-size warning).
- Enemy workers walk long distances since node assignment is simple; acceptable for slice.

## Latest validation
`npm run check`: TypeScript strict, ESLint, 25 Vitest tests (game rules + AI), production build — 2026-08-04.

## Recommended next task
Idle-worker alert + enemy-sighted ping on minimap; then balance/playtest on GitHub Pages.
