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

Use the round wave button beside an oscillator’s frequency, volume or low-pass cutoff to follow the level of another oscillator in the same drone. Depth is a percentage of the target slider’s full span. For Volume at 50% with Depth at 10%, source levels of 0%, 50% and 100% produce 40%, 50% and 60% respectively. The slider thumb follows this value during playback, and the editable number above it sets the base value. For a five-second sweep, use a sine amplitude LFO at 0.2 Hz and 100% depth on a source whose volume is 100%.

**Variant** varies oscillator and modulation values by up to 5% of each slider’s full range in either direction, within its limits.

The Pitch LFO lets you edit the duration of one cycle in seconds beside Rate. Frequency follows the live pitch, including detune and any oscillator-to-oscillator frequency route. Frequency uses a logarithmic scale so the same depth in cents spans the same distance at low and high frequencies. The editable number still sets the base frequency.

Amplitude LFO also accepts a cycle duration in seconds. When it is active, Volume shows the live level from both the oscillator Volume route and the Amplitude LFO. A base Volume of 80% at full depth sweeps from 0% to 80%.

Cutoff sliders use a logarithmic scale, and oscillator Volume and Amplitude LFO Depth use a quadratic scale for finer low settings. The editable values and preset settings still use Hz and percentages.

Each oscillator groups its LFO controls with the slider they affect. Amplitude LFO sits under Volume, Pitch LFO under Frequency, and Cutoff LFO in the low-pass filter controls.

Use **PRESETS** beside **COPY** on any oscillator to load a built-in sound into that slot. The list is bundled in `src/domain/built-in-oscillator-presets.json`.

Cutoff LFO accepts a cycle duration in seconds and offers finer control at low depths. When the low-pass filter is active, Cutoff shows the live Hz from the LFO and oscillator route together. The displayed sweep range respects the filter’s safe modulation limits.

Select **Smooth Random** as an LFO waveform to glide between randomly chosen targets. Each transition takes one cycle at the set Rate, and Depth bounds the motion. The waveform is available for Pitch, Amplitude, and Cutoff.

## Architecture
Domain models in `src/domain`; orchestration and ports in `src/application`; Web Audio implementations and factory in `src/infrastructure/audio`; dependency assembly in `src/composition`; React UI in `src/presentation`. See `AGENTS.md`.
