# Bare Minimum Theory

Bare Minimum Theory is a browser-based chord progression builder for producers who want to move fast, trust their ears, and export ideas into a DAW. Build chords manually, preview them instantly, shape the voicing and rhythm, save the good stuff, and export or stream MIDI when you are ready to keep producing.

## Philosophy

**Freedom First**: music theory constraints are optional helpers, not rules. Scales and modes can highlight useful choices, but every chord stays available so you can find happy accidents through exploration.

## Features

- **Three-click chord builder** - Pick a root, choose one of 37 chord qualities, then preview or drag the chord into the canvas.
- **Dynamic progression canvas** - Start with four slots and grow up to 16 slots with add and insert controls.
- **Drag-and-drop arranging** - Add chords from the builder, move chords between slots, insert space between ideas, and reorder blocks directly.
- **Per-chord shaping** - Adjust inversion, voicing, octave, duration, and randomization on each chord block.
- **Precise durations** - Choose 16 timing values from 1/8 bar to 2 bars in 1/8-bar increments; playback and MIDI export respect the timing.
- **Looping audio preview** - Hear individual chords or the full progression with transport-synced visual progress.
- **Optional scale helper** - Select a key and mode, highlight in-scale chords, and optionally keep randomization inside the scale.
- **Chord palette** - Save chord ideas while exploring, preview them, reorder them, and drag them back into the progression later.
- **Saved progressions** - Save complete progressions to IndexedDB with names and tags, search them, preview them, reload them, or export them.
- **Piano visualization** - Toggle a responsive keyboard that highlights the notes currently playing.
- **Keyboard shortcuts** - Control playback, save, export, open help, navigate the builder, and target progression slots from the keyboard.
- **MIDI export** - Download your progression as a `.mid` file for any DAW.
- **MIDI output to DAW** - Send playback to a virtual MIDI port and use your own instruments.
- **DAW sync** - Follow MIDI Clock tempo and start/stop transport from your DAW.

## Tech Stack

- **Framework**: SvelteKit + Svelte 5 + TypeScript
- **UI**: shadcn-svelte, Tailwind CSS, lucide icons
- **Audio**: Tone.js
- **Music theory**: @tonaljs/tonal plus local theory-engine utilities
- **MIDI**: midi-writer-js and the Web MIDI API
- **Storage**: IndexedDB for saved progressions and localStorage for preferences
- **Tests**: Vitest, jsdom, fake-indexeddb

## Getting Started

This project uses **Bun**, not npm.

```sh
bun install
bun run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Development

```sh
# Run development server
bun run dev

# Run development server and open in browser
bun run dev -- --open

# Type-check the project
bun run check

# Format code
bun run format

# Lint code
bun run lint

# Run tests once
bun run test

# Run tests in watch mode
bun run test:watch

# Run tests with UI
bun run test:ui
```

Important: use `bun run test`, not `bun test`. The project test setup relies on Vitest and Svelte-aware transforms.

## Building for Production

```sh
bun run build
bun run preview
```

## Project Structure

```text
src/
|-- routes/
|   |-- +page.svelte                  # Main app shell and modal orchestration
|   |-- +layout.svelte                # SEO wrapper
|   |-- sitemap.xml/+server.js        # Sitemap generation
|   `-- robots.txt/+server.js         # Robots.txt generation
|-- lib/
|   |-- components/                   # Builder, progression canvas, palette, modals, MIDI UI
|   |-- components/midi/              # MIDI setup sub-components
|   |-- stores/                       # Progression, MIDI, and UI settings state
|   |-- utils/theory-engine/          # Chord definitions, inversions, voicings, display helpers
|   |-- utils/audio-playback.ts       # Tone.js playback, looping, progress tracking
|   |-- utils/midi-export.ts          # MIDI file export
|   |-- utils/midi-output.ts          # Web MIDI output
|   |-- utils/midi-clock.ts           # MIDI Clock input and DAW sync
|   `-- utils/progression-persistence.ts
`-- tests/                            # Unit tests for stores and utilities
```

## Core Concepts

Chords are stored as root MIDI notes plus interval-based qualities. The theory engine applies inversion, voicing, octave transpose, and duration settings before playback or export.

```ts
type Chord = {
	root: number;
	quality: string;
	inversion: number;
	voicing: 'close' | 'open' | 'drop2' | 'drop3' | 'wide';
	octave: number;
	duration: string;
};
```

The default progression starts with four empty slots and can grow to 16. Empty slots remain useful for arranging space, and deleting the last occupied slot collapses the canvas while keeping at least one empty target.

## MIDI Notes

MIDI output uses the browser Web MIDI API. Use a browser with Web MIDI support, such as Chrome, Edge, or Opera. Safari does not support Web MIDI.

For DAW playback, create a virtual MIDI port first:

- **macOS**: enable IAC Driver in Audio MIDI Setup.
- **Windows**: create a virtual port with loopMIDI.
- **DAW**: select the virtual port as MIDI input, arm the track, and choose an instrument.

MIDI Clock sync is configured from the MIDI setup modal. When clock sync is receiving tempo and transport messages, the DAW controls play/stop and the app follows the detected BPM.
