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
One continuous drone voice with five independent sawtooth oscillators, frequency, detune, mute and master level. Press START DRONE to unlock Web Audio; use low speaker volume. No effects or modulation implemented yet.

## Architecture
Domain models in `src/domain`; orchestration and ports in `src/application`; Web Audio implementations and factory in `src/infrastructure/audio`; dependency assembly in `src/composition`; React UI in `src/presentation`. See `AGENTS.md`.
