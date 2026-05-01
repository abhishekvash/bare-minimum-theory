# Bare Minimum Theory: Agent Context

Browser-based chord progression builder with MIDI export and DAW sync.
**Core Philosophy**: Freedom First - music theory constraints (scales, modes) are opt-in helpers, not rules.

## ⚠️ CRITICAL: Package Manager

**This project uses Bun. Never use npm/npx.**

- ✅ `bun install` | `bun add <pkg>` | `bun add -d <pkg>`
- ✅ `bun run <script>` (e.g., `bun run dev`, `bun run test`)
- ✅ `bunx <command>`
- ❌ `npm install`, `npx`, `npm run`

## Quick Start

- **Dev**: `bun run dev`
- **Build**: `bun run build`
- **Test**: `bun run test` (Always use `bun run test`, NOT `bun test`)
- **Lint/Format**: `bun run lint` | `bun run format` | `bun run check`

## Project Structure

```text
src/
├── routes/             # SvelteKit routes (+page.svelte is the main app)
├── lib/
│   ├── components/     # UI components (ChordBuilder, Progression, etc.)
│   ├── stores/         # Svelte 5 runes state (progression, midi, settings)
│   ├── utils/
│   │   ├── theory-engine/ # Core music logic (intervals, voicings, inversions)
│   │   ├── audio-playback.ts # Tone.js integration
│   │   ├── midi-output.ts    # Web MIDI API wrapper
│   │   └── indexeddb.ts      # Persistent storage
└── tests/              # Vitest suite (360+ tests)
```

## Code Style & Patterns

- **Language**: TypeScript (Strict mode)
- **State**: Svelte 5 Runes (`$state`, `$derived`, `$effect`)
- **UI**: shadcn-svelte + Tailwind CSS + Lucide Icons
- **Logic**: Prefer functional utilities in `lib/utils` over class-based logic
- **Naming**:
  - Stores: `name.svelte.ts`
  - Components: PascalCase `ComponentName.svelte`
  - Utilities: camelCase `kebab-case-file.ts`

## Core Data Structures

### The Chord Object

The central unit of data throughout the app:

```typescript
type Chord = {
	root: number; // MIDI note (e.g., 60 = C4)
	quality: string; // Key from QUALITIES (e.g., 'maj7', 'm')
	inversion: number; // 0 (root), 1 (1st), 2 (2nd), etc.
	voicing: 'close' | 'open' | 'drop2' | 'drop3';
	duration: string; // Tone.js notation (e.g., '1m', '4n', '2n.')
	octave: number; // Offset (-2 to +2)
};
```

### Harmony Constants

Located in `src/lib/utils/theory-engine/constants.ts`:

- `QUALITIES`: Maps names to semitone offsets (e.g., `maj7: [0, 4, 7, 11]`)
- `QUALITY_ORDER`: Research-backed popularity ordering for UI
- `NOTE_NAMES`: Standard chromatic names (C, C#, etc.)

## State Management

State is split across three primary stores in `src/lib/stores/`:

### 1. `progressionState` (`progression.svelte.ts`)

The main application state machine.

- `progression`: Array of `(Chord | null)` (max 16 slots)
- `palette`: Collection of saved chord ideas
- `builderState`: Current selections in the Chord Builder UI
- `scale`: Active scale filter `{ key: string, mode: string }`

**Key Functions**:

- `addChord(chord)`: Adds to first empty slot
- `updateChord(index, chord)`: Replaces slot at index
- `randomizeChord(index)`: Mutates chord based on user settings
- `setScale(key, mode)`: Updates the opt-in theory filter

### 2. `midiState` (`midi.svelte.ts`)

Manages Web MIDI connectivity and DAW synchronization.

- `enabled`: Toggles MIDI output (disables internal Tone.js)
- `clockSync`: DAW transport/tempo sync state
- `outputs/inputs`: Discovered MIDI hardware/virtual ports

### 3. `settingsState` (`settings.svelte.ts`)

User preferences and visualization state.

- `randomizeOptions`: Flags for what the "dice" button affects
- `pianoKeyboard`: State for the visual piano (`visible`, `activeNotes`)

## Audio & MIDI Implementation

- **Audio**: Uses `Tone.PolySynth` in `audio-playback.ts`. Requires `await Tone.start()` on user gesture.
- **MIDI Output**: Web MIDI API (Chrome/Edge/Firefox). Uses `midi-output.ts` to send notes to virtual ports.
- **MIDI Export**: `midi-writer-js` generates `.mid` files from the progression array.
- **Persistence**:
  - Settings: `localStorage`
  - Progressions: `IndexedDB` via `progression-persistence.ts`

## Testing Guidelines

- **Unit Tests**: Focus on `theory-engine` and `stores`.
- **Mocks**: Tone.js and Web MIDI are mocked in `tests/utils`.
- **Command**: `bun run test` runs the full suite in Vitest.

---

_For detailed component implementation, refer to the source code. For user-facing documentation, see README.md._
