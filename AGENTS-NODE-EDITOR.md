# Orbit node editor and automation

Read [AGENTS.md](AGENTS.md) first. This guide defines the target architecture and migration for the node editor. The interactive canvas was a concept demonstration. Production work starts from Orbit’s existing TypeScript, React, and Web Audio code.

## Product direction

Orbit remains a drone-first instrument. A new patch can start empty, and a playable example should show what the cables do. Users can add independent audio sources, process signals, and animate parameters without being confined to a fixed oscillator count or a fixed chain. A complete legacy drone can also be used as a single source, with its stereo output available for further processing.

Use one automation editor for looping LFO waveforms, drawn curves, and held or gliding steps. Multiple lanes share a transport and can move independently in sync. The stepper’s musical behavior belongs in this system. Retire its dedicated UI only after the equivalent workflows and legacy data are supported.

## Starting point in the repository

| Existing code | Role in the transition |
| --- | --- |
| [Waveform source](src/infrastructure/audio/web-audio-waveform-source.ts) | Reuse the common audible oscillator source and its stable frequency, detune, and shape endpoints. Preserve waveform switching fades and special implementations such as variable pulse and folded sine. Noise has a separate implementation inside the drone mixer. |
| [Drone voice](src/infrastructure/audio/web-audio-drone.ts) and [drone settings](src/domain/drone.ts) | The voice owns the per-oscillator filters, gain, pan, analysis, and oscillator-to-oscillator modulation. The legacy preset model requires exactly five oscillators per drone. Adapt that model at its boundary and keep the new patch model independent of that count. |
| [Audio graph contracts](src/application/audio-graph-contracts.ts), [Web Audio graph](src/infrastructure/audio/web-audio-graph.ts), and [voice composition](src/composition/create-sound-lab-voice.ts) | Reuse named endpoints, connection ownership, and graph validation where their semantics fit. Today this graph connects coarse modules through AudioNode ports. The patch runtime also needs parameter bindings and arbitrary module instances. |
| [LFO settings](src/domain/modulation.ts), [LFO implementation](src/infrastructure/audio/web-audio-low-frequency-oscillator.ts), and [drone controller](src/application/drone-controller.ts) | Today each LFO belongs to one oscillator and destination. Its implementation applies destination-specific depth. Reuse waveform generation, sync, phase, random behavior, and smoothing, and move destination scaling to the cable. |
| [Oscillator modulation](src/domain/oscillator-modulation.ts) and [runtime routes](src/infrastructure/audio/web-audio-oscillator-modulation.ts) | Preserve the meanings of level-derived modulation and waveform-to-frequency modulation. These are distinct sources with different scaling and dependency rules. |
| [Step player](src/application/oscillator-step-player.ts) and [step model](src/domain/oscillator-step-sequence.ts) | Use these as the reference for hold, glide, once, loop, and manual advance behavior during migration. |
| [Scenes](src/domain/sound-scene.ts), [preset library](src/domain/preset-library.ts), and [scene playback](src/infrastructure/audio/web-audio-scene-playback.ts) | Current presets and arrangements describe fixed layers. Bring them into the patch workflow through explicit adapters before changing existing playback or storage. |

## Patch model and ports

- Use a shared module contract with stable IDs, type-specific settings, and named input and output ports. An oscillator is an audio source, an LFO is a control source, and a filter both processes audio and exposes controllable parameters. Compose these capabilities as needed.
- Use a serializable, versioned patch model with module instances and explicit cables. A cable identifies its source and destination by module and port ID. Save canvas positions and viewport separately from sound settings. Keep browser nodes, scheduled events, selection, and pointer state outside the patch.
- Give ports an explicit direction and signal kind. Audio ports carry samples between modules. Continuous parameter inputs receive control signals. Discrete settings receive scheduled values, and trigger inputs receive events. Expose waveform-to-frequency modulation through an explicit FM-compatible port and keep its audio-rate behavior.
- Define which parameters can be automated in each module’s port definitions. Describe units, base value, bounds, mapping, and combination rules there. Include pitch, cutoff, resonance, gain, pan, supported waveform shape, and effect parameters as their modules are introduced. Discrete ports specify their allowed values and how transitions are applied.
- Support one output feeding multiple inputs. Start with a clear input policy, such as one cable per ordinary parameter or signal input and explicit mixer nodes for summing. Validate direction, compatibility, duplicate endpoints, input capacity, and signal dependencies before changing the runtime. Reject unsupported feedback, including parameter-to-audio dependency loops. Preserve internal effect feedback such as the loop already owned by Delay.
- Provide an output module that feeds the shared master and output protection. Keep user-patchable connections upstream of that protection.

## Unified automation

The generator produces a normalized value from 0 to 1. Its shape, rate or duration, playback mode, and applicable sync and phase settings belong to the generator. Each cable maps that value to the destination’s units. A single source can therefore control cutoff in Hz, pitch in cents, and gain as a normalized level with separate ranges.

| Shape | Semantics |
| --- | --- |
| Waveform | Sine, square, triangle, sawtooth, or smooth random. Retain the existing meanings of rate, sync, and phase where applicable. |
| Drawn curve | Time/value points with explicit interpolation and holds. Support long, slow changes over a defined duration. |
| Steps | A sequence of held values with optional glides and step durations. Preserve manual advance for migrated stepper sequences that use it. |

Chord Progression sends discrete chord steps over the Chords port. The generator applies the chosen root and quality with its own octave, spread, and valid inversion. Keep chord changes on the audio clock. Use complementary fades when switching voicings and return to the generator’s fallback chord where no progression clip is active.

- Support once, loop, and trigger/retrigger behavior with an explicit time origin. Define the value at clip end, on stop, and on retrigger. The shared audio clock drives independent automation lanes and the UI playhead.
- Put endpoints, inversion, and response curve on the cable. Define how the cable combines with the base value. Absolute ranges suit new patches, while additive modulation around a base preserves legacy LFOs. Preserve per-target safeguards and units. A discrete destination maps to valid values and applies scheduled changes, using a crossfade where the audio adapter supports it.
- Implement continuous modulation and timed parameter changes through AudioParam scheduling, audio-rate connections, or a worklet where needed. Use a scheduler with an audio-clock time base. React renders a view of playback. Animation frames can draw a playhead, waveform, or meter.
- Treat steps as automation data. A gain stage placed after any source makes it possible to chop the entire signal. Placed before delay or reverb, it leaves tails ringing. Placed after the effect, it chops the tails as well. Keep this behavior a consequence of routing.

## Example patch and canvas behavior

~~~mermaid
flowchart LR
    Drone -->|Audio| Filter["Low-pass filter"]
    Filter -->|Audio| Gain
    Gain -->|Audio| Output
    Automation -->|Cutoff| Filter
    Automation -->|Level| Gain
~~~

Use an eight-second looping stepped lane with one-second holds and normalized values of 0, 0.75, 0.25, 1, 0.1, 0.58, 0.23, and 0.87. Map it to **180–2,400 Hz** on the filter and **8–70%** on the post-filter gain. Both destinations follow the same timing. Let the user switch that lane between steps, a square waveform, and a drawn curve. A Wave module can replace the Drone through the same audio ports.

- Use movable cards with visible, labelled ports and distinct styling for audio and automation. Support click or tap on an output, highlight compatible inputs, then click or tap an input to commit a Bézier cable. Escape cancels a pending connection.
- Let users select a cable, inspect or edit its mapping, and disconnect it. Make ports and cable controls keyboard-accessible, and distinguish signal types by shape or pattern as well as color. Keep the cable attached as nodes move.
- Keep selections and layout edits separate from sound changes. Show the automation shape and playhead, current destination values, and output level. Use actual runtime data for audio meters or scopes.

## Migration sequence

1. **Establish the baseline.** Use existing tests and routing presets to record representative behavior. Include a folded-sine patch, synchronized square modulation on cutoff and amplitude, oscillator level and waveform modulation, and a scene with audible effect tails. Use these for regression checks throughout the migration.
2. **Add the patch model and first playable canvas.** Implement Wave, Automation, Low-pass Filter, Gain, and Output. Add the composite Drone adapter for the whole-drone example. Reuse existing waveform, filtering, and output-protection behavior. Prove audio routing and automation fan-out with an empty patch and with the example patch.
3. **Convert legacy modulation and step playback.** Translate each enabled LFO to a lane plus a destination mapping. Preserve pitch units, amplitude baseline, cutoff-depth limits, shape ranges, sync, and phase. Convert step targets into lanes on a shared timeline, preserving hold, glide, manual advance, and playback modes. Keep separate lanes when their values or timing differ. Preserve the two oscillator modulation source modes and their existing scaling.
4. **Bring legacy presets and scenes into the patch workflow.** Add a versioned preset format and an explicit migration path from legacy data. First use composite drones to preserve existing layer behaviors. Expose internals as smaller modules incrementally where parity is demonstrable. Preserve layer routing, harmony, stereo pan, envelopes, shelves, noise, reverb, shared delay, and master settings. Check morph crossfades and arrangement tails against the current playback semantics.
5. **Switch the primary editor after parity checks.** Keep legacy playback and imported data available during the transition. Replace the old stepper entry point once the automation editor covers its workflows. Remove redundant code after the new path handles existing presets and scenes and the migration tests pass.

Preserve legacy fields and defaults during import, including values the old editor no longer shows. Validate imported patches and retain the original preset if conversion fails. Keep legacy and patch versions explicit, with stable generated IDs for deterministic migrations. A failed load should leave the active sound usable.

## Engineering standards

- Follow the repository’s TypeScript strictness and layer boundaries. Use pure domain validation and mapping, application commands for patch edits and transport, Web Audio adapters for DSP and scheduling, React for presentation, and the composition root for dependencies.
- Favor small, cohesive modules, composition, descriptive identifiers, and clear contracts. Reuse existing behavior with focused adapters. Apply KISS, DRY, SOLID, and YAGNI pragmatically. Add abstractions when they serve actual module types or a real boundary. Keep unrelated refactors out of migration work.
- Have one authoritative patch state and an explicit runtime lifecycle. Give each module and cable a clear owner. Validate an edit before applying it, and roll back failed runtime changes without leaving a stale cable, partial update, or duplicate source. Cancel obsolete schedules and guard against stale asynchronous start, stop, or patch-load work.
- Preserve existing gain staging, cutoff bounds, parameter smoothing, and click-prevention behavior. Ramp gain for playback and live rewiring. Avoid temporary feedback paths during edge replacement, and keep effect tails where the route calls for them. Dispose removed nodes, cables, analysers, and worklets. Handle repeat start/stop, audio unlock, suspend/resume, and teardown.
- Keep the audio path independent of React renders. Avoid allocations and blocking work in audio callbacks. Keep high-frequency playhead and meter updates off the application-wide state path. Use explicit dependency injection for clocks, runtime adapters, and storage where tests or alternate implementations need it.
- Cover port compatibility, cycles, cable mapping, transport timing, step/curve interpolation, and preset migration with deterministic tests. Cover failed edits, connection cleanup, repeated playback, live cable replacement, and scheduled work cancellation at the integration boundary. Check the existing routing examples in a real browser, including audible behavior, output level, and tails. Verify keyboard and touch patching as well as desktop pointer interaction.
- Before calling an implementation complete, run the relevant tests, `npm run typecheck`, and `npm run build`. Run lint when available. Record what was verified in a real browser and any remaining gaps. Maintain the migration notes alongside behavior changes.
