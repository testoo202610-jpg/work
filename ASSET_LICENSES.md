# Asset Licenses

All game visuals are original procedural/vector-style artwork generated at runtime with Phaser Graphics. The isometric terrain, buildings, resources, human units, horse/rider cavalry silhouettes, shadows, banners, and effects are authored in `src/visualArt.ts`, `src/isoRender.ts`, and `src/GameCanvas.tsx`. No commercial-game artwork, audio, maps, names, characters, or code are included.

## Audio

All sound cues are synthesized at runtime with the WebAudio API (oscillator sweeps) in `src/audio.ts`. No audio files ship with the project; every cue is original generated code and falls under the project license. Cue list: button click, unit select, move command, building placement, construction, melee attack, ranged attack, destruction, victory, defeat, error.

## Fonts

The interface font `Cairo` is loaded from Google Fonts at runtime (SIL Open Font License 1.1). Replace with a local copy if offline distribution is required.
