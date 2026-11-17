# AGENTS.md — Orbit Sound Lab

## Mission
Build **Orbit Sound Lab**, a browser-based experimental ambient/drone sound instrument inspired by ELTA Music's **SOLAR 42**. The goal is long, evolving, richly layered soundscapes, not a conventional keyboard synthesizer, DAW, or a pixel-perfect SOLAR 42 clone. Make exploratory performance approachable while retaining depth.

## Primary reference and version scope
Reference the **original SOLAR 42** for the baseline; do not silently conflate it with later SOLAR 42F or SOLAR 42N revisions. The hardware is an analogue, microtonal, semi-modular ambient drone instrument, developed from SOLAR 50. Its strengths are sustained sound, detuning, layered oscillators, live manipulation, patchable modulation, stereo processing and experimentation.

Manufacturer: https://www.eltamusic.com/solar-42
Original manual: https://www.eltamusic.com/_files/ugd/12d408_d4c9881033524945ae276dc3559589ff.pdf
Later variant comparison: https://www.eltamusic.com/solar-42f

### Original SOLAR 42 reference feature inventory
- Eight voice blocks: **six drone voices** with their own push-button controls, plus **two 1V/oct VCO melodic voices** with waveform variation/morphing and a touch-sensitive keyboard controller.
- Original classic drone voice design uses multiple detunable sawtooth generators (manual describes five per classic voice); avoid assuming every drone voice has identical internal topology.
- Two white-noise generators.
- Two sample-and-hold (S&H) generators.
- Five LFO generators (original model specification).
- Five-step sequencer with control-voltage and gate outputs.
- Joystick for expressive control.
- Contact microphone preamp and envelope follower.
- Stereo mixer with left/right panning.
- Two analogue 12 dB Polivoks-style filters.
- Dual cartridge-based effects/combiner with CV control, supporting separate effects on each channel.
- Stereo wet audio output, dry outputs for melodic voices, external audio input, and patch points for control signals.
- Hardware specification: 12 V DC, 1–2 A; approx. 5.4 kg; 49.5 × 32 × 2.9 cm (5.6 cm including knobs).
- The original has physical CV voltage ranges; these are hardware facts, **not** values to inject directly into Web Audio parameters.

### Variant warning
SOLAR 42F and 42N change oscillator, LFO/pulser, filter, distortion, and effects details. The 42N manufacturer page lists two LFOs plus three square pulse generators, not the original model's five LFOs. Any adopted variant feature must be labelled as an intentional extension.

## Product principles
1. **Drone first:** a voice can sound continuously without a key held or an envelope retrigger; obvious start/stop and mute per layer.
2. **Layered sound:** independent voices with pitch, fine detune, waveform/timbre, level, pan, and filter/effect sends.
3. **Slow movement:** LFOs, envelopes, S&H, drift, sequencer and patchable modulation make sound evolve over minutes.
4. **Playable, not just configurable:** immediate audible feedback, useful defaults, macro controls, and discoverable routing.
5. **Musical microtonality:** support free tuning and optional quantization, not only twelve-tone equal temperament.
6. **Safe output:** conservative gain staging, master limiter, smooth parameter changes, and no unexpected loud start.
7. **Not a clone:** original visual language, naming and UX; do not reproduce ELTA artwork, branding, manuals or proprietary effect code.

## Technical direction
- Browser application: TypeScript + React + Vite.
- Sound engine: Web Audio API, isolated from React rendering. Prefer AudioWorklet for custom oscillators, nonlinear filters or DSP that built-in nodes cannot model well.
- Separate domain models, DSP/audio graph, modulation routing, preset serialization, UI components, and persistence.
- Define typed interfaces for Voice, Oscillator, Envelope, Modulator, Filter, Effect, MixerChannel, PatchConnection and Preset.
- Use explicit descriptive identifiers: no cryptic method names or unnecessary abbreviations.
- Do not place DSP state or AudioContext graph construction in UI components.
- AudioContext must be activated from a user gesture; handle suspend/resume and tab lifecycle.
- Use AudioParam automation or audio-rate modulation for smooth controls; avoid React rerenders at audio rate.
- Dispose nodes, connections, listeners and worklets properly. No accidental duplicate oscillators after rerender.
- Ensure keyboard/touch/pointer interaction and responsive desktop/mobile layouts.
- Keep user presets versioned and migration-capable; persist locally initially.
- No backend is required for the initial version.

## Proposed audio architecture
Sources (6 drone voices + 2 melodic voices + noise/external input where supported)
→ individual gain/pan and optional voice shaping
→ stereo mixer / selectable filter routing
→ two independently configurable effect lanes
→ master gain / safety limiter
→ stereo output.

Modulation sources (LFO, envelope, S&H, sequencer, joystick/XY controller, random drift)
→ explicit modulation matrix with depth and polarity
→ eligible destinations (pitch, timbre, gain, pan, cutoff, resonance, effect parameters).

Treat this as a software-inspired design, not a claim of exact SOLAR 42 internal wiring.

## Delivery roadmap
1. **Foundation:** build tooling, audio unlock, master controls, one sustained drone voice, gain safety, tests.
2. **Layers:** six drone voices and two playable VCO voices, tuning, stereo mixing, per-voice mute.
3. **Movement:** useful envelopes (including sustained/looping behavior), LFOs, S&H and modulation matrix with clearly audible assignments.
4. **Sculpting:** dual filter lanes, saturation and stereo placement.
5. **Space:** independent effect lanes with delay, reverb, chorus/ensemble and modulation.
6. **Performance:** five-step sequencer, XY joystick, touch surface, microtonal controls and preset morphing.
7. **Polish:** preset library, import/export, accessibility, CPU monitoring, browser compatibility and optional offline rendering.

## Agent working rules
- Inspect existing project structure and this document before editing.
- Work in small, reviewable changes and preserve architectural boundaries.
- For each feature, state its audible behavior and signal path, not only UI behavior.
- Do not present unsupported claims about exact SOLAR 42 circuit internals or proprietary effect algorithms.
- Maintain a distinction between manufacturer-verified hardware specification, software design choice and future idea.
- Add unit tests for pure tuning, envelope, modulation and preset logic; add integration/browser tests for graph lifecycle and parameter routing where practical.
- Verify production build and relevant tests before declaring a change complete. Report checks honestly.
- Keep a clear README with setup, controls and known limitations.
- Keep source links in this document up to date when revising hardware claims.
