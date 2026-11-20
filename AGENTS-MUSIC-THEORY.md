# Music theory and composition for Orbit

Read [AGENTS.md](AGENTS.md) for the project principles and [AGENTS-NODE-EDITOR.md](AGENTS-NODE-EDITOR.md) for the patch architecture. Use this guide when talking about musical form or designing composition and arrangement features. Musical examples below are illustrative.

## What makes a musical piece?

A musical piece gives sound and silence a shape over time. A song in the narrower sense is a piece that is sung. In everyday speech, people also call instrumental tracks songs.

**Beginning, middle, and end** are useful listening functions. The beginning can establish a sound, a pulse, or an expectation. The middle can sustain it, vary it, or bring something new into focus. The ending can resolve, stop abruptly, fade, or leave a tail. These functions can be implicit. A loop can invite continuous listening, and an ambient piece can develop gradually without named sections, a regular beat, chord changes, or a lead melody.

Think on two axes. **Form** is what happens over time, including what returns and what changes. **Texture** is what you hear together at a given moment, including which voices lead, support, or move independently. A change in either can make a section perceptibly different. [Open Music Theory on form](https://viva.pressbooks.pub/openmusictheory/chapter/intro-to-form-in-popular-music/) · [Open Music Theory on texture](https://viva.pressbooks.pub/openmusictheory/chapter/texture/)

## From an idea to a form

The poetry analogy is useful. A phrase can feel like a line, a section like a stanza, and a refrain like a returning line. Musical boundaries can come from a breath, a pause, an arrival, or a change in register, rhythm, or instrumentation.

| Concept | What to listen for |
| --- | --- |
| Motif | A small recognizable idea, such as three pitches or a distinctive rhythm. It can recur at different pitches or in different voices. |
| Phrase | A coherent musical gesture with a sense of direction or arrival. Two phrases can feel like question and answer. |
| Cadence | A recognizable point of punctuation in tonal music. For instance, G7 moving to C can create an arrival in C major. A fade or a pause can mark an ending by other means. |
| Section | A span with a role in the whole piece. It may contain several phrases, or it may be a slowly changing texture. |
| Theme, hook, and ostinato | A theme is a distinctive musical idea that can be developed. A hook is a memorable feature that catches the ear. An ostinato is a recurring pattern that can continue underneath changing material. |

Put these ideas together through **repetition**, **variation**, and **contrast**. Repetition makes an idea recognizable. Variation changes one or more features while retaining something familiar. Contrast draws attention to new material or a change in behavior. In form diagrams, `A` and `B` indicate contrasting material. `A′` means a recognizable variation of `A`. Letters work at whatever scale the diagram describes.

| Form | What gives it shape |
| --- | --- |
| Verse–chorus | Verses often carry changing words over similar music. The chorus returns with a recurring idea or hook. A pre-chorus can lead into the chorus, and a bridge can provide contrast. An intro and outro are optional. |
| A–B–A′ | Establish material, contrast it with something else, then bring it back changed. Works for an instrumental or ambient piece. |
| Strophic | Reuse substantially the same music for successive stanzas. |
| Theme and variations | Present an idea, then make successive recognizable versions by changing features such as rhythm, harmony, or texture. |
| Process-based form | An audible process creates the shape. In Terry Riley’s *In C*, the players progress through the same ordered patterns and can repeat them different numbers of times. Their changing combinations help form the piece. |

[Open Music Theory on phrases](https://viva.pressbooks.pub/openmusictheory/chapter/phrase-archetypes-unique-forms/) · [Verse–chorus form](https://viva.pressbooks.pub/openmusictheory/chapter/verse-chorus-form/) · [AABA and strophic form](https://viva.pressbooks.pub/openmusictheory/chapter/aaba-and-strophic-form/) · [Library of Congress interview with Terry Riley](https://www.loc.gov/static/programs/national-recording-preservation-board/documents/Interview_Terry-Reilly.pdf)

## What the musical parts do

A part is a musical role, and a track or node is one way to realize it. A bassist can play a melody. A drone can establish a pitch center while a separate moving bass cuts in and out. A melody can be accompanied by a rhythm alone.

| Role or dimension | What it contributes |
| --- | --- |
| Melody | A line of pitches and rhythms heard as a connected idea. Repeated notes, rests, and changes of register all affect its shape. A countermelody is a second melodic line interacting with it. |
| Bass | A low-register foundation, which can repeat one note, outline the harmony, or have an independent contour. The bass note and chord root can differ. C/E is a C major chord with E in the bass. |
| Harmony | How pitches relate when heard together or implied over time. A scale is an ordered pitch collection. A key also implies a tonal center and relationships around it. A chord is a group of pitches treated as a unit. A progression is a succession of chords. An arpeggio plays chord tones successively. |
| Rhythm and groove | Rhythm concerns the timing and length of sounds and rests. The beat is a felt pulse, tempo is its rate, and meter groups beats into a recurring pattern. A groove also depends on accent, syncopation, and how parts interlock. |
| Drone and texture | A drone sustains or reiterates a pitch or sonority. A pad, noise layer, resonant sound, or effect tail can shape the background. Changing the number, independence, or prominence of the parts changes the texture. |
| Dynamics, timbre, and space | Loudness, tone color, articulation, stereo position, and perceived distance shape a piece. In ambient music, these can carry the form while pitch stays fixed. |

In a steady 4/4 pulse at 120 BPM with quarter-note beats, a beat lasts 0.5 seconds and a bar lasts 2 seconds. An eight-bar phrase lasts 16 seconds under those conditions. Seconds work naturally for free-time pieces. **Harmonic rhythm** is the rate of chord changes and can differ from the rate of note attacks. **Voicing** is how the chord’s tones are distributed, including their octaves and spacing. **Inversion** describes which chord tone is lowest. Changing voicing can refresh a repeated chord, and small movements between voices can connect successive chords. [Open Music Theory fundamentals](https://openmusictheory.github.io/contents.html) · [Open Music Theory on meter](https://viva.pressbooks.pub/openmusictheorycopy/chapter/simple-meter-and-time-signatures/)

## How to make a small piece

Pick an anchor, such as a drone pitch, a two-note motif, or a rhythmic pattern. Let the listener hear it clearly. Repeat it once so the change after it can register. Decide which dimension to vary first. A brighter filter, higher register, or denser rhythm can create motion while the same notes continue. Bring back a familiar element and decide how the sound should end. Listen for an audible difference at each transition. If you can hear the shape with two or three parts, treat more layers as a musical choice.

A 90-second Orbit sketch in free time:

| Time | Section | What you hear |
| --- | --- | --- |
| 0:00–0:15 | Opening | A quiet C drone fades in. A darker tone gradually opens. |
| 0:15–0:35 | A | A short G–E♭ gesture repeats over the drone, with silence between repeats. |
| 0:35–1:00 | B | The same drone continues. A higher sustained texture replaces the gesture while a pulsing gain pattern grows more pronounced. |
| 1:00–1:20 | A′ | The gesture returns higher and more quietly. The pulse drops out before the return ends. |
| 1:20–1:30 | Ending | The gesture stops. Fade the drone and leave time for its reverb to decay. |

A useful comparison is to play this once with the drone fixed, then again with the bass moving at the section boundaries. Listen to whether the pitch change improves the arrival or takes attention away from the motif.

## How this applies to Orbit

| Musical intent | Current Orbit building blocks |
| --- | --- |
| Sustain a pitch or chord | Wave, Drone, and Chord Generator provide sustained sound. A chord choice, voicing, or inversion shapes the sonority. |
| Repeat or vary a short pattern | Automation steps or curves can drive a compatible pitch, level, or filter input. An LFO can supply recurring movement. Cable mapping sets what the control values mean at the destination. |
| Bring parts forward and send them back | Mixer, Gain, Low-pass filter, and Shelf EQ shape balance and texture. A gain contour can create pulses and gaps. |
| Arrange individual parts | The patch editor’s Arrangement timeline schedules Wave, Drone, Chord Generator, and Automation clips in seconds. A sustained part can cross section boundaries while other tracks change. The patch preset stores the arrangement alongside the graph and layout. |
| Move between complete sounds | The Drone editor’s Scene Timeline captures sound snapshots with explicit hold and blend times. |

See [patch arrangements](src/domain/patch/arrangement/index.ts), [patch modules](src/domain/patch/model.ts), [patch automation](src/domain/patch/automation.ts), [patch preset format](src/domain/patch/presets/model.ts), and [scene arrangement](src/domain/sound-scene.ts).

Keep these meanings distinct when changing the app:

- **Patch** describes signal flow and sound settings. **Automation** describes how a parameter changes over time. **Arrangement** describes when material enters, leaves, changes, or returns. One patch can support several sections.
- A reusable **pattern** can represent notes, triggers, or parameter values. A **scene** captures a collection of sound settings. A **section** is what a span does musically, such as establishing a texture or bringing back an idea. Use those terms according to the feature’s behavior.
- Let looping material and one-shot movement coexist. Think about whether a transition should continue a pattern’s phase, restart it, blend, cut, or leave a tail. Preserve the timing intent when saving and loading.
- Treat names such as Intro, A, B, or Chorus as optional labels. Support free-time music alongside styles that use a beat grid. When a feature introduces beat-based timing, define the beat unit and how musical time maps to elapsed time.
- Verify composition features by listening to a small piece. Check that the opening starts as intended, repeated material enters on cue, contrast is audible, and the ending leaves the intended silence or tail. Treat these as musical outcomes when deciding what a feature needs.
