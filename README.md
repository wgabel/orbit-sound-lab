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

The Patch Editor asks the browser for a larger audio buffer to reduce dropouts in layered patches. Live edits can take slightly longer to reach the speakers, depending on the browser and audio device.

Select a node or cable to edit it. Connect ports by selecting an output and then a highlighted input. A dashed highlight marks an input whose existing cable will be replaced. Replacing a numeric control cable retains its mapping and Flip setting. Drag a module by its title, or start from **Empty patch**. Choose **Factory patch presets** to load a patch from Foundations, Modulated Drones, Sequences, Heavy & Wet Drones, or Arrangements. Open **My patch presets** to save a named snapshot of the entire canvas, including modules, settings, cables, and layout. Use **My saved patches** in the toolbar to load any saved patch and **Save snapshot** to save one without typing a name. Export and import JSON to move a patch to another browser.

Hold a node near any canvas edge to scroll in that direction while dragging. The patch preset saves node positions and the view on every side of the canvas.

Select an automation cable to show **Flip** and **On/Off** beside its source port. Flip reverses its modulation range. Off restores the destination’s base value while keeping the cable and its settings. Other cables from the same source keep running. These controls are saved with the patch.

**Clean up overlaps** moves bunched-up nodes to the nearest available spaces while leaving clear nodes in place.

Select a **Drone** node and choose **Copy Drone A** or **Copy Drone B** to take a snapshot of that layer’s oscillator settings, harmony-adjusted tuning, layer mix, and modulation. The copy is independent of later edits in the drone editor. It plays through its patch cables regardless of the source layer’s on/off switch. The node inspector also offers the same grouped **5-oscillator preset** menu and shared **Drone presets** library as the Drone editor. Load a named preset or save the node with **Save preset** or **Save snapshot**. The node uses the preset’s selected drone sound, including harmony and modulation. Shared echo and master level belong to the editor where the sound plays.

To edit a patch’s Drone node, select it and click **Edit drone**. Orbit stops the patch and opens the node’s sound in the Drone editor for editing and solo audition. **Apply edits and return to patch** stops the audition and updates the same node. The patch keeps its cables and the standalone Drone A and B sounds are preserved.

To combine two sources, connect them to **Audio A** and **Audio B** on a **Mixer**, then connect its **Audio out** to a filter, gain stage, or other audio input. Set each channel’s level in the inspector or automate it via **Level A** and **Level B**.

Connect an Automation or LFO **Value** to **Pitch Shift → Pitch** to sweep the pitch of an audio line. Set the cable’s endpoints in semitones. For example, map 0 to +12 for a rise of one octave. Fine tune sits on top of the automated shift.

Use a **Crossfader** to transition between two audio signals. Connect them to **Audio A** and **Audio B**, then route **Audio out** onward. **Blend** moves from A at 0% to B at 100%. Connect an Automation or LFO **Value** output to **Blend** to shape the transition. For a one-way transition, set an Automation curve to rise from 0% to 100% and choose **Play once, hold end**.

Add **Chord Progression** and connect its **Chords** output to a **Chord Generator → Chords** input. The default pattern is Cm, A♭, E♭, B♭. Edit the root and quality of each step, choose the time per chord, and choose whether to loop or hold the last chord. The generator keeps its octave and voicing settings. In an arrangement, schedule clips for both the generator and the progression where you want the chord changes.

Connect an Automation or LFO **Value** to another Automation node’s **Duration** input to speed up or slow down its cycle. Set the cable’s endpoints in seconds. In **Steps** mode, **Step count** plays the first N configured steps within the cycle. The count is rounded to a whole step and capped at the available steps. The stored step values stay editable.

In an **Automation** node, **Smooth waves** loads editable curves with rounded transitions between points. The presets loop cleanly and keep your current duration and playback mode.

Choose **Add module → LFO** for repeating modulation. Select a waveform, set the rate or cycle duration, and connect **Value** to a control input. The cable sets the modulation range. **Synchronize with patch** aligns the LFO to the patch transport and enables phase offsets. This node uses AudioWorklet.

Choose **Add module → Simplex Noise** for smooth, non-looping modulation. Connect **Value** to a control input and use the cable to set its range. **Rate** changes how fast the signal drifts, and **Seed** changes its pattern. The same seed and rate replay the same pattern from the patch clock, including when starting an arrangement from its cursor. The node previews the first eight seconds and shows the live output beside a connected cable.

Add a **Reverb** node and connect an audio source or Mixer to **Audio in**. Route **Audio out** to the next effect or Output. Connect an Automation or LFO **Value** to **Wet Mix** to move between the dry signal and the reverberant tail. In an arrangement, give the effect tail enough time to ring out after the last source clip.

Use an **Oscilloscope** node to display the waveform at any patch audio connection. Connect it inline through **Audio in** and **Audio out**, or connect its input in parallel and leave its output free. The display uses a mono preview at 4× vertical scale. Inline audio keeps its original channels and level.

The **Heavy & Wet Drones** factory group contains four ready-to-play patches. **Flooded Foundry** fades between a cross-modulated bass drone and a reverberant choir. **Drowned Conveyor** steps filter cutoff and the level of a mechanical drone together. **Silt Pressure** layers random low-pass movement over slower swells. **Blackwater Siren** adds an automated pitch-shifted branch to a folded-sine and noise drone.

### Shape an Automation step with an envelope

Select an **Automation** node, choose **Steps**, and enable **Step envelope (ADSR)**. Each step value sets its peak. Attack, Decay, and Release are percentages of that step’s duration. Sustain sets the held percentage of the peak. A zero step stays at zero. **Play once, release** returns the output to zero after the final step.

To make a drone swell on each step, route **Drone audio → Gain → Output** and connect **Automation Value → Gain Level**. Set the cable’s minimum to 0%. Use a second Automation node if you want stepped pitch or cutoff alongside the shaped volume. An envelope takes over from Glide until you switch it off. The preview, saved presets, and custom Automation clips use the same envelope settings.

### Compose a piece

Open **Arrangement** in the patch editor. Choose a Wave, Drone, Chord Generator, Automation, or Chord Progression node and select **Add clip**. Select a clip to edit its start, length, level or modulation strength, and fades. Tracks can be named from any clip. During arrangement playback, source nodes and Automation cables are active where their clips run. LFOs and effects continue to run in the patch.

Add section labels to mark the form. **Duplicate section at end** copies the clips fully inside that section. A clip spanning several sections stays in place. An Automation clip can restart its curve, follow the arrangement clock, or use its own editable curve. **Play from start** or **Play from cursor** uses a ruler in seconds. The effect-tail setting leaves time for effects downstream of the source before playback stops.

Try **Factory patch presets → Arrangements → Drone in Five Sections** for a ready-to-play 90-second example. **Save snapshot** and **My patch presets** save the arrangement with the patch and support JSON import and export.

## Current scope
Two drone layers with five oscillators each, modulation, effects and a stereo performance mix. Use **Start Drones** and each layer’s **On** switch for continuous playback. The playback bar stays visible while scrolling.

Open **Sound** for the oscillator rack, per-drone effects, modulators and presets. Select **Drone A** or **Drone B** to choose which sound to edit. Each oscillator row has its own on/off switch, tuned pitch, live waveform and Volume control. Open **Settings** to edit its pan, waveform, filter and LFOs, or to use its preset and clipboard actions.

Open **Studio** for master level and delay, harmony, the drone mix, Preset Morph, Scene Timeline, the audio diagnostic and the **Performance** controls. Performance has the XY pad and both layers’ **Hold to Play** keys. Hold a key with the mouse, a finger, or Space/Enter while focused. Drag up or down while holding to bend all five oscillators by up to one semitone. Releasing the key fades the layer out at its own **Release** setting.

Pressing a key activates **Key Mode** for that layer. Turn **Key Mode** off to return to continuous playback controls. Each layer’s attack, decay, sustain, release and Key Level are saved with its sound preset. **Key Level** affects the key and its release tail. Continuous playback and patch nodes use the saved drone mix level. In a patch drone’s editor, **Patch Drone Level** adjusts that mix level separately.

Use **Route** next to Frequency, Volume, or Cutoff to pick a source oscillator in the same drone. **Waveform** applies the source waveform before its own filter and volume. Turn down the source volume to hear only the effect on the target, or switch the source oscillator off to stop its modulation. **Level and Amplitude LFO** follows the slower level signal and is the mode used by routes in older presets. Depth is in Hz for Frequency and Cutoff and percentage points for Volume. The active button shows which oscillator feeds the route.

**Variant** varies oscillator and modulation values by up to 5% of each slider’s full range in either direction, within its limits.

The Pitch LFO lets you edit the duration of one cycle in seconds beside Rate. Frequency follows the live pitch, including detune and any oscillator-to-oscillator frequency route. Frequency uses a logarithmic scale so the same depth in cents spans the same distance at low and high frequencies. The editable number still sets the base frequency.

Amplitude LFO also accepts a cycle duration in seconds. When it is active, Volume shows the live level from both the oscillator Volume route and the Amplitude LFO. A base Volume of 80% at full depth sweeps from 0% to 80%.

Cutoff sliders use a logarithmic scale, and oscillator Volume and Amplitude LFO Depth use a quadratic scale for finer low settings. The editable values and preset settings still use Hz and percentages.

Each oscillator uses the same section layout for Volume & Pan, Frequency & Waveform, and Low-pass Filter. LFO controls sit with the slider they affect. Amplitude LFO sits under Volume, Pitch LFO under Frequency, and Cutoff LFO in the low-pass filter controls.

Orbit automatically matches oscillator waveforms to a sine at the same base pitch using a frequency-weighted loudness estimate. The Drone Editor and Patch Editor Wave nodes apply one smooth gain per waveform before filters and effects, so the waveform keeps its shape. The estimate follows the oscillator's pitch and shape settings. Audio-rate pitch and shape modulation can still change the apparent loudness, and the result varies with playback equipment.

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

Open **Settings → PRESETS** on an oscillator to load a sound from **Fundamentals**, **Warm & Airy**, **Pulse & Grit**, **Shaped Sines**, or **Custom**. Choose **Save as preset** to name and store the current oscillator, including its Shape, filter, and four LFO settings. Custom presets stay in this browser and can be loaded into any oscillator in either drone layer, including when editing a patch Drone node. Loading keeps the destination oscillator’s on/off switch and its existing routes to other oscillators.

Cutoff LFO accepts a cycle duration in seconds and offers finer control at low depths. When the low-pass filter is active, Cutoff shows the live Hz from the LFO and oscillator route together. The displayed sweep range respects the filter’s safe modulation limits.

Select **Smooth Random** as an LFO waveform to glide between randomly chosen targets. Each transition takes one cycle at the set Rate, and Depth bounds the motion. The waveform is available for Pitch, Amplitude, Cutoff, and Shape.

The LFO menus in both editors also include **Sine ↔ Triangle**, **Variable Pulse (25%)**, **Folded Sine**, and **Peaked Sine**. The sine-based shapes use their midpoint setting for modulation. Variable Pulse stays high for the first quarter of each cycle. Adjust the Depth in the Drone editor or the cable range in the Patch Editor to set how far the target moves.

Enable **Sync** on LFOs with the same Rate to align them to the audio clock, even if you turn them on at different times. **Phase** offsets an LFO within the cycle. With the same sine waveform, 180° makes two LFOs move in opposite directions. Synced Smooth Random LFOs at the same Rate and Phase share random targets during playback.

## Architecture
Domain models in `src/domain`; orchestration and ports in `src/application`; Web Audio implementations and factory in `src/infrastructure/audio`; dependency assembly in `src/composition`; React UI in `src/presentation`. See `AGENTS.md`.

## Oscillator Shape

Choose **Sine ↔ Triangle** under **Frequency & Waveform** to reveal **Shape**. At 0% the oscillator is a sine, and at 100% it is a triangle. The blend changes the tone at the same pitch and passes through the oscillator's existing filter, volume and pan.

Expand **Shape LFO** to automate the blend independently of the other LFOs. Depth is in percentage points, so a base Shape of 35% and a depth of 20 pp give a 15–55% sweep. The sweep is bounded by 0% and 100%. The live readout shows the actual blend during playback. Presets and oscillator copy/paste retain the Shape and its LFO settings.

Choose **Variable Pulse** to shape the width of the pulse from 5% to 95%. At 50% it has the familiar square-wave tone. Use **Shape LFO** for pulse-width modulation. Try a slow sine for a gradual sweep, or a square LFO for two alternating widths. Two pulsed voices with the same synced rate and a 180° phase difference move in opposite directions. Presets keep the waveform, pulse width and Shape LFO.

Choose **Peaked Sine** for narrow, symmetric peaks. **Shape** blends a clean sine at 0% into a ninth-power sine at 100%. The note keeps its pitch and gains odd harmonics. Use **Shape LFO** in the Drone editor, or connect an **LFO** or **Automation** output to the **Shape** input on a **Wave** node. Try a slow sweep from 0% to 60%.

Choose **Cycle Envelope** in the oscillator or Wave node waveform menu to shape each sine cycle. Set Attack, Decay and Release as percentages of one cycle. The remaining time is spent at the Sustain level. The preview shows the original sine, the gain envelope and the resulting wave before filtering. At 0% Amount you hear the sine. At 100% you hear the full cycle shape. In the Drone editor, use **Shape LFO** to modulate Amount. In the Patch Editor, connect an LFO or Automation to **Amount**. The envelope follows the oscillator pitch and repeats with every cycle.

Choose **Folded Sine** and raise **Fold Amount** to bend the sine peaks back inward, adding harmonics at the same oscillator pitch. At 0% the signal is a clean sine. Use **Shape LFO** to sweep from a mellow tone into brighter or metallic textures, or use a square LFO to alternate settings.

## Drone effects

In **Sound → Effects**, click an effect’s name to edit its settings and use its switch to enable or bypass it. Audio runs through the list from top to bottom. Use **↑** and **↓** to move an effect one place. Each drone stores its own settings and effect order in presets and carries them into the Patch Editor when used in a Drone node. **Studio → Master delay** processes the combined output of both drones.

- **EQ** uses a low shelf and a high shelf with a combined response graph.
- **Overdrive** soft-clips the signal. Drive sets the amount, Tone rolls off highs, and Wet Mix blends the result back in.
- **Compressor** controls peaks with Threshold, Ratio, Attack and Release.
- **Chorus** varies two short stereo delays to widen the sound. **Flanger** uses a shorter modulated delay with feedback for a sweeping tone.
- **Delay** repeats the drone at the selected Time and Feedback. **Reverb** adds a tail with adjustable Decay, Pre-delay and Damping. Its editable spaces are shared with the Reverb node.

Older presets retain their shelf, reverb and shared delay settings and use the default effect order. The added per-drone stages start bypassed.

## Step Sequencer

Under **Sound → Modulators**, select the drone you want to shape. Choose a pad, set a value in the oscillator rack, and **Capture** that control into the pad. Repeat to add or update controls on the same pad. Steps can drive oscillator **Volume**, enabled filter **Cutoff**, and the **FM Depth** of an enabled Waveform-to-Frequency route. **Glide** sets the time to reach those values and **Hold** sets how long they stay before the next step. Empty pads are skipped.

Start the selected drone in continuous mode. Use **Apply step** to set up your opening sound, then choose **Play once** or **Loop**. **Manual** waits after each glide until you press **Next step**. You can also use **Next step** to advance early during automatic playback. **Stop steps** leaves the current sound playing. To compose an ending that fades to silence, capture zero volume for the remaining audible oscillators on the last pad.

Each layer has its own sequence with up to eight pads. Steps stay until the page reloads. Starting a Morph or Scene Timeline preview, stopping the drone, or switching the selected drone ends step playback. Keep the tab active for the smoothest glides.

## Preset Morph and Scene Timeline

In **Studio**, enable **Preset Morph**, select two presets, and move the slider to hear their full stereo sounds crossfade. Each preset keeps its own tuning, modulation, waveforms, layer switches and effects. Set **Travel time** and choose **Play A → B** to start at A and settle at B. Enable **Loop back and forth** to repeat the transition, using the selected travel time in each direction. Choose **Hold blend** to keep the current mix playing or drag the slider to take over manually. Turn Morph off to return to the sound in the editor.

Use **Capture current sound** in **Scene Timeline** to take snapshots of both drones, the effects and the XY position. Reorder the scenes and set each scene's **Hold** and **Blend to next** in seconds. **Play arrangement** fades in the opening, plays the list once, and fades the last scene's sources before letting the effects ring out. Orbit adds a 5-second opening and a 10-second ending that includes 2 seconds for the effects tail. Timeline scenes are kept for the browser session until the page reloads.
