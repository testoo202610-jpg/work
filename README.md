# Dragon Kingdoms: War of the Plains

An original browser-based 2D real-time strategy game built with React, TypeScript, Phaser, Vite, and Zustand. It presents a fictional conflict among three original kingdoms with procedurally generated visuals.

## Original-game disclaimer
This project is not affiliated with or derived from any commercial game. It contains no protected names, characters, maps, storylines, artwork, sounds, music, dialogue, or code.

## Main features
- Arabic RTL menu and in-game HUD.
- Choose Flame, Rivers, or Mountains and Easy, Medium, or Hard difficulty.
- Food, wood, stone, and gold resource nodes.
- Worker gathering, buildings, production, population, combat, enemy attacks, victory and defeat.
- Procedural Phaser map, selection, drag selection, right-click commands, WASD camera movement, zoom, and minimap.
- Versioned LocalStorage save/load and automatic saves every two minutes.

## Technology stack
React, TypeScript strict mode, Vite, Phaser, Zustand, Vitest, ESLint, and Prettier.

## Installation and commands
```bash
npm install
npm run dev
npm run build
npm run preview
npm run test:run
npm run lint
npm run typecheck
npm run check
```

## Controls
- Left click: select.
- Drag left mouse: select multiple workers.
- Right click: move, gather a resource, or attack a target.
- WASD: move camera. Mouse wheel: zoom.
- Use the right panel to train units and place buildings.

## Kingdoms, units, and buildings
Flame has stronger attacks; Rivers gather and move faster; Mountains have stronger structures. Workers gather resources, swordsmen fight in melee, archers attack at range, cavalry is fast and expensive, and commanders are unique high-health leaders.

Headquarters stores resources and trains workers. Barracks trains swordsmen and archers. Stable enables cavalry. Farms add population. Storage provides a drop-off concept. Towers and walls represent defensive structures.

## Save system
Manual save/load buttons and automatic two-minute saves use LocalStorage key `dragon-kingdoms-save`. Save data carries schema version `1` and invalid data is rejected safely.

## Architecture
- `src/game.ts`: pure domain types, balance data, and rules.
- `src/store.ts`: Zustand match state, economy, production, AI attack loop, and saving.
- `src/GameCanvas.tsx`: Phaser rendering and pointer/camera bridge.
- `src/App.tsx`: Arabic menu and HUD.
- `src/game.test.ts`: pure rule tests.

## Screenshots
Screenshots can be added after visual QA in a desktop browser.

## Asset licensing
All visuals are generated with Phaser primitives. See [ASSET_LICENSES.md](ASSET_LICENSES.md). No audio files are bundled yet.

## GitHub deployment
GitHub Actions templates are provided in `.github/workflows`. To publish manually after authenticating:
```bash
gh auth login
gh repo create dragon-kingdoms-rts --private --source=. --remote=origin --push
```
GitHub Pages requires enabling Pages with GitHub Actions in repository settings.

## Known limitations and future improvements
The current playable slice intentionally keeps pathfinding, fog-of-war, projectile pooling, audio, advanced AI economy, and cursor-based construction preview lightweight. The next recommended task is grid preview plus A* obstacle-aware movement.

## Contributions
Use focused branches and include tests for pure gameplay rules. Keep all new assets original, generated, public domain, or properly licensed.
