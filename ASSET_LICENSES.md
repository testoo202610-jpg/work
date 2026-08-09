# Asset Licenses

All new battlefield sprite artwork is original inline SVG artwork created for this project and stored under `public/assets/rts/`. It is loaded as Phaser SVG textures/images through `src/assets.ts` and `src/textureArt.ts`. The isometric terrain, fallback overlays, shadows, banners, and effects remain authored in `src/visualArt.ts`, `src/isoRender.ts`, and `src/GameCanvas.tsx`. No commercial-game artwork, audio, maps, names, characters, or code are included.

## Original sprite textures

The primary runtime battlefield textures are raster PNG sprite sheets under `public/assets/rts-hd/`. They were generated locally from original project artwork into 4×4 frame atlases, with frame variants for direction/state presentation. The older SVG files under `public/assets/rts/` remain fallback/source artwork only.

| Asset family | Source | License | Modifications |
|---|---|---|---|
| `public/assets/rts/units/*.svg` | Original project artwork authored for Dragon Kingdoms | Project-owned/original | Inline vector shapes and gradients; loaded as Phaser SVG textures |
| `public/assets/rts/buildings/*.svg` | Original project artwork authored for Dragon Kingdoms | Project-owned/original | Inline isometric architectural illustrations |
| `public/assets/rts/resources/*.svg` | Original project artwork authored for Dragon Kingdoms | Project-owned/original | Inline tree, stone, and gold deposit illustrations |

## Audio

All sound cues are synthesized at runtime with the WebAudio API (oscillator sweeps) in `src/audio.ts`. No audio files ship with the project; every cue is original generated code and falls under the project license. Cue list: button click, unit select, move command, building placement, construction, melee attack, ranged attack, destruction, victory, defeat, error.

## Fonts

The interface font `Cairo` is loaded from Google Fonts at runtime (SIL Open Font License 1.1). Replace with a local copy if offline distribution is required.
