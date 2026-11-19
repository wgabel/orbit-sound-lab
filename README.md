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

## Patch editor

Stop drone playback and choose **Open patch editor**. The example routes a three-voice drone through a low-pass filter and gain stage. One eight-second automation lane controls the filter cutoff and the level of the entire drone. Press **Play patch** to hear it.

Select a node or cable to edit it. Connect ports by selecting an output and then a highlighted input. Drag a module by its title, or start from **Empty patch**. Choose **Factory patch presets** to load a patch from Foundations, Modulated Drones, or Sequences. Open **My patch presets** to save a named snapshot of the entire canvas, including modules, settings, cables, and layout. Use **Load** to restore it, or export and import JSON to move it to another browser.

Select an automation cable to show **Flip** and **On/Off** beside its source port. Flip reverses its modulation range. Off restores the destination’s base value while keeping the cable and its settings. Other cables from the same source keep running. These controls are saved with the patch.

Select a **Drone** node and choose **Copy Drone A** or **Copy Drone B** to take a snapshot of that layer’s oscillator settings, harmony-adjusted tuning, layer mix, and modulation. The copy is independent of later edits in the drone editor. It plays through its patch cables regardless of the source layer’s on/off switch. The node inspector also offers the same grouped **5-oscillator preset** menu and shared **Drone presets** library as the Drone editor. Load a named preset or save the node with **Save preset** or **Save snapshot**. The node uses the preset’s selected drone sound, including harmony and modulation. Shared echo and master level belong to the editor where the sound plays.

To combine two sources, connect them to **Audio A** and **Audio B** on a **Mixer**, then connect its **Audio out** to a filter, gain stage, or other audio input. Set each channel’s level in the inspector or automate it via **Level A** and **Level B**.

In an **Automation** node, **Smooth waves** loads editable curves with rounded transitions between points. The presets loop cleanly and keep your current duration and playback mode.

Choose **Add module → LFO** for repeating modulation. Select a waveform, set the rate or cycle duration, and connect **Value** to a control input. The cable sets the modulation range. **Synchronize with patch** aligns the LFO to the patch transport and enables phase offsets. This node uses AudioWorklet.

Use an **Oscilloscope** node to display the waveform at any patch audio connection. Connect it inline through **Audio in** and **Audio out**, or connect its input in parallel and leave its output free. The display uses a mono preview at 4× vertical scale. Inline audio keeps its original channels and level.

## Current scope
Two drone layers with five oscillators each, modulation, effects and a stereo performance mix. Use **Start Drones** and each layer’s **On** switch for continuous playback. The playback bar stays visible while scrolling.

Select **Drone A** or **Drone B** to edit its oscillator rack. Each row has its own on/off switch, tuned pitch, live waveform and Volume control. Open **Settings** to edit the oscillator’s pan, waveform, filter and LFOs, or to use its preset and clipboard actions.

The **Performance** section has the XY pad and both layers’ **Hold to Play** keys. Hold it with the mouse, a finger, or Space/Enter while focused. Drag up or down while holding to bend all five oscillators by up to one semitone from their current tuning. Releasing the key fades the layer out at its own **Release** setting. Both keys can be held with separate fingers.

Pressing a key activates **Key Mode** for that layer. Turn **Key Mode** off to return to continuous playback controls. Each layer’s attack, decay, sustain and release are saved with its sound preset.

Use **Route** next to Frequency, Volume, or Cutoff to pick a source oscillator in the same drone. **Waveform** applies the source waveform before its own filter and volume. Turn down the source volume to hear only the effect on the target, or switch the source oscillator off to stop its modulation. **Level and Amplitude LFO** follows the slower level signal and is the mode used by routes in older presets. Depth is in Hz for Frequency and Cutoff and percentage points for Volume. The active button shows which oscillator feeds the route.

**Variant** varies oscillator and modulation values by up to 5% of each slider’s full range in either direction, within its limits.

The Pitch LFO lets you edit the duration of one cycle in seconds beside Rate. Frequency follows the live pitch, including detune and any oscillator-to-oscillator frequency route. Frequency uses a logarithmic scale so the same depth in cents spans the same distance at low and high frequencies. The editable number still sets the base frequency.

Amplitude LFO also accepts a cycle duration in seconds. When it is active, Volume shows the live level from both the oscillator Volume route and the Amplitude LFO. A base Volume of 80% at full depth sweeps from 0% to 80%.

Cutoff sliders use a logarithmic scale, and oscillator Volume and Amplitude LFO Depth use a quadratic scale for finer low settings. The editable values and preset settings still use Hz and percentages.

Each oscillator uses the same section layout for Volume & Pan, Frequency & Waveform, and Low-pass Filter. LFO controls sit with the slider they affect. Amplitude LFO sits under Volume, Pitch LFO under Frequency, and Cutoff LFO in the low-pass filter controls.

Use **5-oscillator preset** above the rack to load a factory bank into the selected drone. The picker groups banks under **Drone Foundations**, **Cross-Modulation**, **Routing Example**, **Stepped Drones**, **Grungy**, and **Wet**. Each bank sets all five oscillator voices and their modulation. It replaces the layer's oscillator routes and selects Free harmony mode so the voiced pitches play as designed. Layer enable, gain, envelope and mix stay as set.

| Cross-modulation bank | Waveform route | What to listen for |
| --- | --- | --- |
| Velvet Current | OSC 2 → OSC 3 Frequency | A soft overtone shimmer over a steady bass |
| Glass Bell | OSC 2 → OSC 3 Frequency | A brighter, bell-like tone from a deeper FM route and a different frequency ratio |
| Cascade Drift | OSC 2 → OSC 3 Frequency → OSC 4 Frequency | Two stages of FM, with a slow shape change on OSC 3 that also colours OSC 4 |
| Copper Pulse | OSC 2 → OSC 3 Volume | A buzzing edge from audio-rate amplitude modulation |
| Breathing Reed | OSC 2 → OSC 3 Cutoff | The sawtooth filter moves at audio rate, with a slow LFO adding a second layer of motion |

OSC 2 runs at zero audible volume in these banks. Its waveform feeds the route before the volume control. Open a target oscillator's **Route** button to compare the sound with the route on and off.

| Routing Example | What to listen for | Routes to compare |
| --- | --- | --- |
| Ion Choir | Two bright FM voices spread across the stereo field | OSC 2 → OSC 3 and OSC 4 Frequency |
| Relay Bells | Metallic voices fed by a three-stage FM chain | OSC 2 → 3 → 4 → 5 Frequency |
| Split Pulse | Different audio-rate amplitude textures on the left and right | OSC 2 → OSC 4 Volume and OSC 3 → OSC 5 Volume |
| Reed Reactor | Rough-edged filter movement on two voices with a separate FM tone | OSC 2 → OSC 3 and OSC 4 Cutoff, plus OSC 5 Frequency |
| Prism Gate | FM and amplitude modulation on one voice, with its waveform routed to a second voice’s filter | OSC 2 → OSC 4 Frequency, OSC 3 → OSC 4 Volume, OSC 4 → OSC 5 Cutoff |

| Stepped Drones | What to listen for |
| --- | --- |
| Lockstep Bloom | Volume and cutoff rise and fall together on two voices over a steady bass. |
| Stereo Relay | The left and right pairs take turns with matching rates and opposite phases. |
| Four Windows | Four staggered gates rotate overlapping pairs of notes, with a change each second. |
| Three Over Two | Three pulses on the right against two on the left, with a quieter accent over the eight-second pattern. |
| Register Switch | One voice steps between roughly A3 and E4 as its filter and waveform change. Two side voices trade accents. |

These banks run from the audio clock as soon as the drone plays. Open the oscillator's LFO controls to compare the synced rates and phase offsets.

| Group | Preset | Sound |
| --- | --- | --- |
| Grungy | Rust Mouth | Low distorted-sounding FM and an irregular filter sweep. |
| Grungy | Broken Conveyor | Dry square and saw voices pulse at different rates over a bass. |
| Grungy | Shortwave Dust | Detuned voices drift over a thin layer of white noise. |
| Wet | Tidal Glass | Soft, independently swelling harmonics through 58% reverb. |
| Wet | Sunken Choir | A detuned stereo pair and minor voicing through 73% reverb. |
| Wet | Rain Vault | Alternating high voices leave overlapping tails through 86% reverb. |

**Grungy** and **Wet** also set the chosen drone’s noise and reverb. The layer low-pass, shelf EQ, and shared echo keep their current settings.

Use **PRESETS** beside **COPY** on any oscillator to load a built-in sound into that slot. The list is bundled in `src/domain/built-in-oscillator-presets.json`.

Cutoff LFO accepts a cycle duration in seconds and offers finer control at low depths. When the low-pass filter is active, Cutoff shows the live Hz from the LFO and oscillator route together. The displayed sweep range respects the filter’s safe modulation limits.

Select **Smooth Random** as an LFO waveform to glide between randomly chosen targets. Each transition takes one cycle at the set Rate, and Depth bounds the motion. The waveform is available for Pitch, Amplitude, and Cutoff.

Enable **Sync** on LFOs with the same Rate to align them to the audio clock, even if you turn them on at different times. **Phase** offsets an LFO within the cycle. With the same sine waveform, 180° makes two LFOs move in opposite directions. Synced Smooth Random LFOs at the same Rate and Phase share random targets during playback.

## Architecture
Domain models in `src/domain`; orchestration and ports in `src/application`; Web Audio implementations and factory in `src/infrastructure/audio`; dependency assembly in `src/composition`; React UI in `src/presentation`. See `AGENTS.md`.

## Oscillator Shape

Choose **Sine ↔ Triangle** under **Frequency & Waveform** to reveal **Shape**. At 0% the oscillator is a sine, and at 100% it is a triangle. The blend changes the tone at the same pitch and passes through the oscillator's existing filter, volume and pan.

Expand **Shape LFO** to automate the blend independently of the other LFOs. Depth is in percentage points, so a base Shape of 35% and a depth of 20 pp give a 15–55% sweep. The sweep is bounded by 0% and 100%. The live readout shows the actual blend during playback. Presets and oscillator copy/paste retain the Shape and its LFO settings.

Choose **Variable Pulse** to shape the width of the pulse from 5% to 95%. At 50% it has the familiar square-wave tone. Use **Shape LFO** for pulse-width modulation. Try a slow sine for a gradual sweep, or a square LFO for two alternating widths. Two pulsed voices with the same synced rate and a 180° phase difference move in opposite directions. Presets keep the waveform, pulse width and Shape LFO.

Choose **Folded Sine** and raise **Fold Amount** to bend the sine peaks back inward, adding harmonics at the same oscillator pitch. At 0% the signal is a clean sine. Use **Shape LFO** to sweep from a mellow tone into brighter or metallic textures, or use a square LFO to alternate settings.

## Drone shelf EQ

Each **Drone Mix** has a **Low shelf** and **High shelf**. Frequency sets the center of the shelf’s transition, and Gain sets how much to boost or cut in dB. Try +3 dB at 150 Hz on the low shelf for more body, or −4 dB at 2,400 Hz on the high shelf to soften the top end. Both are flat at 0 dB. The response graph shows the combined gain from both shelves across frequency, with a blue marker for the low shelf and amber for the high shelf. The shelves shape the whole drone before its reverb, and saved presets retain the settings.

## Step Sequencer

Under **Performance**, select the drone you want to shape. Choose a pad, set a value in the oscillator rack, and **Capture** that control into the pad. Repeat to add or update controls on the same pad. Steps can drive oscillator **Volume**, enabled filter **Cutoff**, and the **FM Depth** of an enabled Waveform-to-Frequency route. **Glide** sets the time to reach those values and **Hold** sets how long they stay before the next step. Empty pads are skipped.

Start the selected drone in continuous mode. Use **Apply step** to set up your opening sound, then choose **Play once** or **Loop**. **Manual** waits after each glide until you press **Next step**. You can also use **Next step** to advance early during automatic playback. **Stop steps** leaves the current sound playing. To compose an ending that fades to silence, capture zero volume for the remaining audible oscillators on the last pad.

Each layer has its own sequence with up to eight pads. Steps stay until the page reloads. Starting a Morph or Scene Timeline preview, stopping the drone, or switching the selected drone ends step playback. Keep the tab active for the smoothest glides.

## Preset Morph and Scene Timeline

Enable **Preset Morph**, select two presets, and move the slider to hear their full stereo sounds crossfade. Each preset keeps its own tuning, modulation, waveforms, layer switches and echo. Set **Travel time** and choose **Play A → B** to start at A and settle at B. Enable **Loop back and forth** to repeat the transition, using the selected travel time in each direction. Choose **Hold blend** to keep the current mix playing or drag the slider to take over manually. Turn Morph off to return to the sound in the editor.

Use **Capture current sound** in **Scene Timeline** to take snapshots of both drones, the effects and the XY position. Reorder the scenes and set each scene's **Hold** and **Blend to next** in seconds. **Play arrangement** fades in the opening, plays the list once, and fades the last scene's sources before letting the effects ring out. Orbit adds a 5-second opening and a 10-second ending that includes 2 seconds for the effects tail. Timeline scenes are kept for the browser session until the page reloads.
