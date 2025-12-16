# Bare Minimum Theory

A browser-based chord progression builder that lets you create, preview, and export chord progressions to MIDI. Build progressions through exploration and experimentation—music theory constraints are optional helpers, not rules.

## Philosophy

**Freedom First**: All music theory constraints (scales, modes) are opt-in helpers, not enforced rules. Create any chord progression you want through "beautiful blunders and blind discovery."

## Features

- **Three-click chord builder** - Select root → quality → add to progression
- **37 chord qualities** - Major, minor, 7ths, 9ths, 11ths, 13ths, sus, add, and altered chords
- **Audio preview** - Hear chords and progressions instantly with looping playback
- **Progression canvas** - Arrange up to 4 chords with drag-and-drop reordering
- **Chord controls** - Inversions, 5 voicing presets, octave transpose, randomize
- **Chord palette** - Save and organize chord ideas for later use
- **Optional scale filter** - Highlights chords in your selected key/mode
- **MIDI export** - Download your progression as a .mid file
- **MIDI output to DAW** - Preview with your own VSTs via virtual MIDI
- **DAW sync** - Sync tempo and transport (Start/Stop) via MIDI Clock

## Tech Stack

- **Framework**: SvelteKit + TypeScript
- **UI**: shadcn-svelte components with Tailwind CSS
- **Audio**: Tone.js (Web Audio API wrapper)
- **Music Theory**: @tonaljs/tonal
- **MIDI**: midi-writer-js

## Getting Started

Install dependencies:

```sh
bun install
```

Start the development server:

```sh
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

# Run tests (CI mode)
bun run test

# Run tests in watch mode
bun run test:watch

# Run tests with UI
bun run test:ui
```

## Building for Production

```sh
# Create production build
bun run build

# Preview production build
bun run preview
```
