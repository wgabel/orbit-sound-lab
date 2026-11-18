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

## Mandatory engineering standards

### Design principles
- Follow **KISS**: choose the simplest solution that fully meets the requirement. Avoid clever abstractions and unnecessary frameworks.
- Follow **DRY**: consolidate genuine duplication of behavior or knowledge, but do not force unrelated concepts into a shared abstraction merely because they look similar.
- Follow **SOLID** pragmatically: single responsibility, focused interfaces, dependency inversion at meaningful boundaries, and substitutable implementations.
- Follow **YAGNI**: do not build hypothetical extensibility or unused features. Introduce abstraction when a concrete boundary, test need, or second implementation justifies it.
- Favor **composition over inheritance**, explicit data flow, cohesive modules, low coupling, and high cohesion.
- Avoid god objects, large components, circular dependencies, hidden global mutable state, and cross-layer imports.
- Optimize for readability and maintainability over code golf. Use complete descriptive names for classes, methods, variables, events and parameters; avoid shortened identifiers.
- Keep functions focused and side effects explicit. Prefer immutable domain data and pure functions where practical.

### Architecture and dependency injection
- Use a **composition root** to construct and wire application services, audio engine, repositories and adapters.
- Use **constructor injection or explicit factory injection** for dependencies; TypeScript does not require a DI framework. Prefer manual DI initially, adding a container only if complexity demonstrably warrants one.
- Depend on interfaces/ports at boundaries, especially audio engine, clock/scheduler, preset storage and platform/browser adapters. Do not create one-interface-per-class by default.
- Separate **domain** (tuning, modulation rules, preset types), **application** (use cases and orchestration), **infrastructure** (Web Audio, browser storage, worklets) and **presentation** (React components and hooks).
- React components must not instantiate AudioContext, own DSP graphs, directly access persistence, or contain domain/business rules.
- Put UI state in React only when it is truly presentation state. The audio engine owns its real-time lifecycle; application services coordinate commands and observable state.
- Use explicit lifecycle contracts for start, stop, suspend, resume and dispose. Avoid resource leaks and stale closures.
- Keep the real-time audio path free from blocking operations, unnecessary allocations, React state updates and network dependencies.

### Suggested project layout (adapt only with justification)
- `src/domain/` — types, entities, value objects, pure rules
- `src/application/` — use cases, service contracts and orchestration
- `src/infrastructure/audio/` — Web Audio adapters, graph construction and worklets
- `src/infrastructure/storage/` — versioned preset persistence
- `src/presentation/components/` — focused reusable UI
- `src/presentation/hooks/` — React bindings to application services
- `src/composition/` — dependency assembly and application bootstrap
- `src/shared/` — genuinely shared utilities only
- `tests/` — domain/application tests and audio lifecycle tests

### Quality gates and testing
- Use TypeScript strict mode; avoid `any`, non-null assertions and unchecked type casts unless justified.
- Define and validate input boundaries (especially imported presets and browser storage); handle errors explicitly and show actionable UI feedback.
- Use ESLint and formatting consistently; do not suppress warnings without explanation.
- Unit-test pure domain logic and use cases with injected fakes; test audio graph lifecycle and modulation routing with deterministic test doubles.
- Verify audible features in a real browser where possible; passing unit tests alone does not prove sound output works.
- Test repeated mount/unmount, start/stop, preset load, missing Audio API support, and audio-context suspension.
- Avoid flaky timing-based tests; inject clocks/schedulers and use deterministic fixtures.
- Preserve backwards compatibility for saved presets using schema versions and explicit migrations.
- For every meaningful change, run typecheck, lint, tests and production build when available; report exactly which commands passed, failed or could not run.
- Never commit secrets, generated build artifacts or large binary audio assets without explicit justification.

### Change discipline
- Before coding, inspect relevant modules and trace their responsibilities and dependencies.
- Prefer extending existing services/components over duplicating logic.
- Keep changes narrowly scoped, readable and reviewable; avoid unrelated refactors.
- When a file grows multiple responsibilities, split by behavior and ownership rather than arbitrary line count.
- Update tests and documentation alongside behavior changes.
- Document architectural decisions that are non-obvious, especially audio routing, scheduling, dependency ownership and state synchronization.
- Do not claim an implementation is finished until it is committed and verification status is communicated.

## Two drone layers

- Each layer owns five oscillators, harmony, modulation and its level. The shared transport only starts enabled layers, and disabling one fades out its own voice; both feed the shared echo, master level and output protection.
- Layer A maps to the original version 1 preset fields. Optional serialized layer mix data stores A's enable state, layer B and the master level. Older presets load with A enabled, B disabled and master at unity.
- Load the saved sound into the layer selected in the UI, preserving its enable state, the other layer and the shared effects. Save the source layer with the preset; older presets use A as their source.
- Morph both layers' continuous sound controls and master level; discrete layer enable states switch at the midpoint.

## Automatic playback fades

- Use a fixed 20 ms gain ramp when starting or toggling an oscillator and when stopping the drone. Keep the voice routed until its sources end so Stop can finish the ramp.
- Preserve legacy preset fade fields for compatibility and for possible use by a future layer or sequencer. They are no longer exposed as oscillator controls or applied to manual playback.

## Per-oscillator stereo panorama

- Place each native stereo panner after its oscillator's filter, amplitude modulation and fade, before the drone mix. Preserve the pre-pan analyser tap so hard panning does not change the scope's level.
- Centered oscillators keep their previous playback level. Smooth live pan changes with AudioParam automation.
- Store pan as -1 (left) to 1 (right). Version 1 presets with no pan load at 0 (center). Morph pan linearly, and preserve the current pan when randomizing an oscillator.

## Live per-oscillator waveform visualization (PR #26)

### Behavior and signal ownership
- Every oscillator panel has an always-visible, compact **LIVE WAVEFORM** oscilloscope, including when the oscillator settings are collapsed.
- Visualize **real audio samples**, never a synthetic drawing inferred from waveform selection or oscillator parameters.
- The analyser tap belongs to each individual oscillator **after its dry/wet filter mix, oscillator gain, amplitude modulation and fade**, but before the shared drone output, delay and master output protection. Clearly distinguish this per-oscillator signal from the final mixed output.
- A passive `AnalyserNode` branch must not interrupt or reroute audible output. Create one analyser per oscillator and disconnect it during voice disposal.
- `WebAudioDrone.getWaveformAnalyser(oscillatorId)` exposes the corresponding analyser; `DroneController` and the composition controller forward this through the application contract. While stopped, return `null` rather than a stale analyser. Keep Web Audio construction and node ownership in infrastructure, not React.

### Rendering performance and lifecycle
- `src/presentation/OscillatorWaveform.tsx` owns its canvas rendering lifecycle; `App.tsx` only supplies oscillator identity, playback/enabled state and a stable analyser accessor.
- Read samples with `AnalyserNode.getFloatTimeDomainData()`, draw with Canvas 2D and limit rendering to roughly **30 FPS**. Do not put sample buffers or animation frames in React state.
- Align frames to a positive-going zero crossing where possible to make the waveform visually stable. This is display-only: never alter the audible samples.
- Respect device pixel ratio and resize the canvas drawing buffer to its actual dimensions. Show a static standby/off state when playback or the oscillator is disabled.
- Cancel `requestAnimationFrame` and disconnect visibility observers on cleanup. Skip drawing when the document is hidden or the canvas is outside the viewport; avoid repeatedly allocating buffers in the animation loop.
- Ensure the analyzer accessor has stable identity (e.g. `useCallback`) so unrelated UI changes do not restart animation effects.

### Validation and known limitations
- Test that the analyser is tapped **after** the oscillator's amplitude/fade path and does not modify the audio graph, and that start/stop/dispose never leaks nodes.
- Test or inspect React mount/unmount, disabled oscillators, rapid playback toggles, browser audio suspension, resize and mobile performance.
- The displayed window uses a finite FFT buffer; low-frequency waves may not show a full cycle, and zero-crossing alignment may not fully stabilize complex or noisy signals. Do not promise a calibrated oscilloscope.
- Audio correctness and rendering quality require browser verification beyond TypeScript and unit tests.
- PR #26 (`feature/live-oscillator-waveforms`) introduced this feature; recheck PR status before modifying it and do not claim CI passed without checking its actual run.
