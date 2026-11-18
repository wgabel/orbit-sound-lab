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

## Manual Pages deployment

Open [Build and deploy Orbit Sound Lab](https://github.com/wgabel/orbit-sound-lab/actions/workflows/deploy.yml)
in Actions and select **Run workflow**. Leave the workflow's branch dropdown on **main**
and enter the branch you want to test in **branch**. The workflow checks out and
tests that branch, then publishes it to the live GitHub Pages URL on success.
To restore the main build, run the workflow again with **branch** set to **main**.

## Current scope
Two drone layers with five oscillators each, modulation, effects and a stereo performance mix. Use **Start Drones** and each layer’s **On** switch for continuous playback. The playback bar stays visible while scrolling.

Select **Drone A** or **Drone B** to edit its oscillator rack. Each row has its own on/off switch, tuned pitch, live waveform and Volume control. Open **Settings** to edit the oscillator’s pan, waveform, filter and LFOs, or to use its preset and clipboard actions.

The **Performance** section has the XY pad and both layers’ **Hold to Play** keys. Hold it with the mouse, a finger, or Space/Enter while focused. Drag up or down while holding to bend all five oscillators by up to one semitone from their current tuning. Releasing the key fades the layer out at its own **Release** setting. Both keys can be held with separate fingers.

Pressing a key activates **Key Mode** for that layer. Turn **Key Mode** off to return to continuous playback controls. Each layer’s attack, decay, sustain and release are saved with its sound preset.

Use the round wave button beside an oscillator’s frequency, volume or low-pass cutoff to follow the level of another oscillator in the same drone. Depth is a percentage of the target slider’s full span. For Volume at 50% with Depth at 10%, source levels of 0%, 50% and 100% produce 40%, 50% and 60% respectively. The slider thumb edits the base value. A separate dot and Live readout follow the modulated value during playback. For a five-second sweep, use a sine amplitude LFO at 0.2 Hz and 100% depth on a source whose volume is 100%.

**Variant** varies oscillator and modulation values by up to 5% of each slider’s full range in either direction, within its limits.

The Pitch LFO lets you edit the duration of one cycle in seconds beside Rate. Frequency follows the live pitch, including detune and any oscillator-to-oscillator frequency route. Frequency uses a logarithmic scale so the same depth in cents spans the same distance at low and high frequencies. The editable number still sets the base frequency.

Amplitude LFO also accepts a cycle duration in seconds. When it is active, Volume shows the live level from both the oscillator Volume route and the Amplitude LFO. A base Volume of 80% at full depth sweeps from 0% to 80%.

Cutoff sliders use a logarithmic scale, and oscillator Volume and Amplitude LFO Depth use a quadratic scale for finer low settings. The editable values and preset settings still use Hz and percentages.

Each oscillator uses the same section layout for Volume & Pan, Frequency & Waveform, and Low-pass Filter. LFO controls sit with the slider they affect. Amplitude LFO sits under Volume, Pitch LFO under Frequency, and Cutoff LFO in the low-pass filter controls.

Use **PRESETS** beside **COPY** on any oscillator to load a built-in sound into that slot. The list is bundled in `src/domain/built-in-oscillator-presets.json`.

Cutoff LFO accepts a cycle duration in seconds and offers finer control at low depths. When the low-pass filter is active, Cutoff shows the live Hz from the LFO and oscillator route together. The displayed sweep range respects the filter’s safe modulation limits.

Select **Smooth Random** as an LFO waveform to glide between randomly chosen targets. Each transition takes one cycle at the set Rate, and Depth bounds the motion. The waveform is available for Pitch, Amplitude, and Cutoff.

Enable **Sync** on LFOs with the same Rate to align them to the audio clock, even if you turn them on at different times. **Phase** offsets an LFO within the cycle. With the same sine waveform, 180° makes two LFOs move in opposite directions. Synced Smooth Random LFOs at the same Rate and Phase share random targets during playback.

## Architecture
Domain models in `src/domain`; orchestration and ports in `src/application`; Web Audio implementations and factory in `src/infrastructure/audio`; dependency assembly in `src/composition`; React UI in `src/presentation`. See `AGENTS.md`.

## Oscillator Shape

Choose **Sine ↔ Triangle** under **Frequency & Waveform** to reveal **Shape**. At 0% the oscillator is a sine, and at 100% it is a triangle. The blend changes the tone at the same pitch and passes through the oscillator's existing filter, volume and pan.

Expand **Shape LFO** to automate the blend independently of the other LFOs. Depth is in percentage points, so a base Shape of 35% and a depth of 20 pp give a 15–55% sweep. The sweep is bounded by 0% and 100%. The slider thumb edits the base blend. The blue band shows its modulation range, and a separate dot and Live readout follow the actual blend during playback. Presets and oscillator copy/paste retain the Shape and its LFO settings.

## Preset Morph and Scene Timeline

Enable **Preset Morph**, select two presets, and move the slider to hear their full stereo sounds crossfade. Each preset keeps its own tuning, modulation, waveforms, layer switches and echo. Turn Morph off to return to the sound in the editor.

Use **Capture current sound** in **Scene Timeline** to take snapshots of both drones, the effects and the XY position. Reorder the scenes and set each scene's **Hold** and **Blend to next** in seconds. **Play arrangement** fades in the opening, plays the list once, and fades the last scene's sources before letting the effects ring out. Orbit adds a 5-second opening and a 10-second ending that includes 2 seconds for the effects tail. Timeline scenes are kept for the browser session until the page reloads.
