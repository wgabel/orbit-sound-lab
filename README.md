# Orbit Sound Lab

Browser-based ambient drone synthesizer inspired by the original ELTA Music SOLAR 42. Independent instrument, not a hardware emulation.

## Development

```bash
npm install
npm run dev
npm run typecheck
npm test
npm run build
```

## Current scope
Two drone layers with five oscillators each, modulation, effects and a stereo performance mix. Use **Start Drones** and each layer’s **On** switch for continuous playback.

Each layer also has a **Hold to Play** key under its level control. Hold it with the mouse, a finger, or Space/Enter while focused. Drag up or down while holding to bend all five oscillators by up to one semitone from their current tuning. Releasing the key fades the layer out at its own **Release** setting. Both keys can be held with separate fingers.

Pressing a key activates **Key Mode** for that layer. Turn **Key Mode** off to return to continuous playback controls. Each layer’s attack, decay, sustain and release are saved with its sound preset.

Use the round wave button beside an oscillator’s frequency, volume or low-pass cutoff to follow the level of another oscillator in the same drone. The source’s volume and amplitude LFO determine the normalized level. A source level of zero leaves the destination at its base setting, and full level applies the configured depth in the selected direction. The blue range shows the limits, and the white marker shows the live value while the drone plays. For a five-second sweep, select a sine amplitude LFO on the source and set its rate to 0.2 Hz and depth to 100%. Routes are stored in presets.

**Variant** varies oscillator and modulation values by up to 5% of each slider’s full range in either direction, within its limits.

## Architecture
Domain models in `src/domain`; orchestration and ports in `src/application`; Web Audio implementations and factory in `src/infrastructure/audio`; dependency assembly in `src/composition`; React UI in `src/presentation`. See `AGENTS.md`.
