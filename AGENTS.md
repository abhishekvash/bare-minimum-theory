# Bare Minimum Theory

Browser-based chord progression builder with AI assistance. Build progressions manually, preview audio, export to MIDI for DAWs.

## ⚠️ CRITICAL: Package Manager

**This project uses Bun, NOT npm. Never use npm/npx commands.**

- ✅ Use `bun` instead of `npm`
- ✅ Use `bunx` instead of `npx`
- ✅ Use `bun run <script>` to run package.json scripts
- ✅ Use `bun add <package>` to install dependencies
- ✅ Use `bun add -d <package>` for dev dependencies

**Wrong ❌ vs Right ✅:**

- ❌ `npm install` → ✅ `bun install`
- ❌ `npm install package` → ✅ `bun add package`
- ❌ `npm install -D package` → ✅ `bun add -d package`
- ❌ `npx command` → ✅ `bunx command`
- ❌ `npm run test` → ✅ `bun run test`

## 🎉 Project Status: MVP Feature Complete!

**All core MVP features have been implemented and are ready for testing.**
The application is fully functional with 330+ passing tests.

## Project Overview

**Core Philosophy**: Freedom First - all music theory constraints (scales, modes) are opt-in helpers, not enforced. Users can make any chord progression - "beautiful blunders through blind discovery."

**MVP Features** (All Implemented ✅):

- ✅ Three-click chord builder (Root → Quality → Result)
- ✅ Optional scale filter (highlights/filters chords in selected scale)
- ✅ Progression canvas (drag chords into 4 slots, reorder by dragging)
- ✅ In-block controls (inversion/voicing dropdowns, octave transpose, randomize, delete)
- ✅ Audio preview (individual preview + looping playback at 120 BPM)
- ✅ Visual playback indicator (progress bar sweeps across chords, transport-synced)
- ✅ MIDI export (download as .mid file)
- ✅ Chord Palette (save and organize chords for later use)
- ✅ Help Modal (in-app documentation and tips)
- ✅ SEO Optimization (meta tags, Open Graph, Twitter cards, sitemap, robots.txt)
- ✅ MIDI Output to DAW (preview progressions with your own VSTs/sounds)
- ✅ DAW Sync (sync tempo and transport with DAW via MIDI Clock)
- ✅ Piano Keyboard Visualization (visual piano showing active notes during playback)
- ✅ Save/Load Progressions (save to IndexedDB with name and tags, load later)
- ✅ Keyboard Shortcuts (full keyboard navigation for chord building and playback)

## Setup Commands

- Install: `bun install`
- Dev server: `bun run dev`
- Build: `bun run build`
- Preview: `bun run preview`
- Test: `bun run test` (CI mode - runs once)
- Test watch: `bun run test:watch` (watch mode)
- Test UI: `bun run test:ui`

**Important**: Always use `bun run test` (not `bun test`). Bun has a built-in test runner that doesn't process Svelte files correctly.

## Dependencies

**Key packages already installed:**

- `tone` - Web Audio API wrapper for audio playback
- `@tonaljs/tonal` - Music theory utilities
- `midi-writer-js` - MIDI file generation
- `shadcn-svelte` - UI component library

**To add new packages:**

```bash
bun add <package>        # Production dependency
bun add -d <package>     # Dev dependency
```

## Project Structure

```
src/
├── routes/
│   ├── +page.svelte                    # Main app with Help button, 3-column layout
│   ├── +layout.svelte                  # ✅ Root layout with SEO component
│   ├── +layout.js                      # ✅ SEO configuration loader
│   ├── sitemap.xml/
│   │   └── +server.js                  # ✅ Dynamic sitemap generation
│   └── robots.txt/
│       └── +server.js                  # ✅ Dynamic robots.txt generation
├── lib/
│   ├── components/
│   │   ├── ChordBuilder.svelte          # ✅ 2-row builder
│   │   ├── DraggableChordButton.svelte  # ✅ Quality button with drag
│   │   ├── ChordProgression.svelte      # ✅ Main progression container
│   │   ├── PlaybackControls.svelte      # ✅ Play/Stop/Export header controls
│   │   ├── ProgressionSlot.svelte       # ✅ Individual slot with drop zone
│   │   ├── ChordBlock.svelte            # ✅ Individual chord block
│   │   ├── ScaleFilter.svelte           # ✅ Optional scale selector
│   │   ├── ChordPalette.svelte          # ✅ Sidebar for saving chords
│   │   ├── PaletteChord.svelte          # ✅ Individual chord in palette
│   │   ├── HelpModal.svelte             # ✅ In-app documentation modal
│   │   ├── PianoKeyboard.svelte         # ✅ Visual piano showing active notes
│   │   ├── MIDIOutputToggle.svelte      # ✅ MIDI enable/disable toggle
│   │   ├── MIDISetupModal.svelte        # ✅ MIDI setup wizard (orchestrates sub-components)
│   │   ├── SaveProgressionModal.svelte  # ✅ Save progression dialog (name + tags)
│   │   ├── SavedProgressions.svelte     # ✅ Saved progressions list with search
│   │   ├── SavedProgressionItem.svelte  # ✅ Individual saved progression item
│   │   ├── LoadConfirmationDialog.svelte # ✅ Confirm before replacing canvas
│   │   └── midi/                        # ✅ MIDI setup sub-components
│   │       ├── MIDIPlatformInstructions.svelte  # Platform-specific setup guides
│   │       ├── MIDIDeviceSelector.svelte        # Device list + refresh + status
│   │       ├── MIDITestConnection.svelte        # Test button + feedback
│   │       ├── MIDIAdvancedSettings.svelte      # Channel/velocity/strum settings
│   │       └── MIDIClockSync.svelte             # DAW sync toggle + input selector
│   ├── stores/
│   │   └── progression.svelte.ts        # ✅ Global state (runes) with palette
│   └── utils/
│       ├── theory-engine/
│       │   ├── index.ts                 # Barrel export
│       │   ├── types.ts                 # Type definitions
│       │   ├── constants.ts             # NOTE_NAMES + QUALITIES + QUALITY_ORDER + MODES
│       │   ├── inversions.ts            # Inversion logic
│       │   ├── voicings.ts              # Voicing presets (5 total)
│       │   ├── chord-operations.ts      # getChordNotes pipeline
│       │   └── display.ts               # Display helpers
│       ├── midi-export.ts               # ✅ MIDI generation
│       ├── midi-output.ts               # ✅ Web MIDI API wrapper
│       ├── midi-clock.ts                # ✅ MIDI clock input for DAW sync
│       ├── midi-settings-persistence.ts # ✅ MIDI settings localStorage
│       ├── midi-clock-persistence.ts    # ✅ MIDI clock settings localStorage
│       ├── piano-settings-persistence.ts # ✅ Piano keyboard settings localStorage
│       ├── audio-playback.ts            # ✅ Tone.js audio with looping + progress tracking
│       ├── scale-helper.ts              # ✅ Scale filtering utilities
│       ├── settings-persistence.ts      # ✅ localStorage utilities for user preferences
│       ├── indexeddb.ts                 # ✅ IndexedDB wrapper for persistent storage
│       ├── progression-persistence.ts   # ✅ Save/load progressions to IndexedDB
│       └── keyboard-shortcuts.ts        # ✅ Centralized keyboard event handler
├── src/tests/                           # ✅ 330+ tests total
│   ├── theory-engine/
│   │   ├── inversions.test.ts           # 14 tests
│   │   ├── voicings.test.ts             # 20 tests
│   │   ├── chord-operations.test.ts     # 33 tests
│   │   └── display.test.ts              # 35 tests
│   ├── stores/
│   │   └── progression.svelte.test.ts   # 91 tests (includes randomize options)
│   └── utils/
│       ├── audio-playback.test.ts       # 16 tests (Tone.js mocks)
│       ├── midi-output.test.ts          # 22 tests
│       ├── midi-clock.test.ts           # 23 tests (clock + transport)
│       ├── midi-settings-persistence.test.ts # 11 tests
│       ├── midi-clock-persistence.test.ts # 11 tests
│       ├── piano-settings-persistence.test.ts # 7 tests
│       ├── scale-helper.test.ts         # 25 tests
│       └── progression-persistence.test.ts # 22 tests (IndexedDB)
```

## Component Responsibilities

### ChordProgression.svelte

Main container that orchestrates the progression interface. Manages drag-and-drop state, playback state, and coordinates between PlaybackControls, ProgressionSlot, and ChordBlock components.

**Key responsibilities:**

- Manages `isPlaying` and `activeDropIndex` state
- Tracks `currentPlayingIndex` and `progressPercent` via requestAnimationFrame loop
- Handles drag-over/drop event coordination
- Delegates playback actions to audio-playback utilities
- Delegates MIDI export to midi-export utilities
- Polls `getPlaybackProgress()` for transport-synced visual feedback (60fps)

### PlaybackControls.svelte

Header component that provides playback and export controls for the progression.

**Props:**

- `isPlaying: boolean` - Whether progression is currently playing
- `hasChords: boolean` - Whether progression has any non-null chords
- `onPlay: () => void` - Callback to start playback
- `onStop: () => void` - Callback to stop playback
- `onExport: () => void` - Callback to export MIDI
- `onOpenMIDISetup: () => void` - Callback to open MIDI setup modal

**Features:**

- Renders "Your Progression" header with instructions
- Play button (disabled when no chords or already playing)
- Stop button (disabled when not playing)
- Export MIDI button (disabled when no chords)
- MIDI output toggle (cable icon, enables/disables MIDI output to DAW)
- Responsive layout (vertical on mobile, horizontal on desktop)

### ProgressionSlot.svelte

Wrapper component for each of the 4 progression slots. Handles drop zone logic and visual feedback.

**Props:**

- `chord: Chord | null` - The chord in this slot (or null if empty)
- `index: number` - Zero-based slot index (0-3)
- `isLast: boolean` - Whether this is the last slot (affects border rendering)
- `isActiveDropTarget: boolean` - Whether this slot is the current drop target
- `onDragOver`, `onDragEnter`, `onDragLeave`, `onDrop` - Drag event handlers

**Features:**

- Shows ChordBlock when slot is occupied
- Shows slot number when empty
- Visual feedback during drag (ring highlight for occupied slots, dashed border for empty)
- Handles both drag-from-builder (copy) and drag-from-progression (move) operations
- Responsive sizing (min-width adjusts for mobile/tablet)

### ChordBlock.svelte

Individual chord display with comprehensive editing controls. Rendered inside ProgressionSlot when a chord is present.

**Features:**

- Displays chord name with quality symbol
- Play button for instant audio preview (with subtle scale animation feedback)
- Progress bar at bottom (transport-synced for progression playback, CSS animated for individual preview)
- Inversion dropdown (dynamically shows available inversions)
- Voicing dropdown (Close, Open, Drop 2, Drop 3, Wide)
- Octave transpose buttons (±2 octaves)
- Randomize button + settings gear (configure what to randomize; defaults to inversion + voicing only; settings persist via localStorage)
- Delete button
- Drag handle for reordering within progression

### ChordPalette.svelte

Sidebar component with two collapsible sections: Chord Palette and Saved Progressions.

**Features:**

- **Accordion behavior**: Both Palette and Saved sections collapsible with chevron icons
- **Count badges**: Shows item count in each section header
- Drop zone for saving chords (accepts from builder or progression)
- Scrollable list of saved chords
- Displays SavedProgressions component for saved progressions
- Empty state with instructions for each section
- Responsive layout (full width mobile, fixed width sidebar desktop)
- Visual drag-and-drop feedback
- Footer with credits

### PaletteChord.svelte

Individual chord item in the palette with play/delete controls.

**Features:**

- Play button for audio preview
- Progress bar at bottom (CSS animated for preview playback)
- Delete button
- Drag handle (reorder in palette or drag to progression)
- Visual feedback during drag

### HelpModal.svelte

Modal dialog with comprehensive in-app documentation.

**Props:**

- `open: boolean` (bindable) - Modal visibility

**Sections:**

- Getting Started (3-step guide)
- Features (Inversions, Voicings, Scale Filter, Palette)
- Workflow Tips (Using palette, MIDI export, experimentation)
- Keyboard Shortcuts (coming soon)

### PianoKeyboard.svelte

Visual piano keyboard that displays currently playing notes during playback.

**Features:**

- Dynamic key range based on progression chords (auto-adjusts span)
- White and black keys rendered proportionally
- Active notes highlighted with animated dots
- Collapsible via toggle button in PlaybackControls
- Visibility preference persisted to localStorage
- Responsive sizing (smaller height on mobile)

**State:**

- `progressionState.pianoKeyboard.visible` - Whether piano is shown
- `progressionState.pianoKeyboard.activeNotes` - Currently playing MIDI notes

### SaveProgressionModal.svelte

Modal for saving progressions with name and optional tags.

**Props:**

- `open: boolean` (bindable) - Modal visibility
- `availableTags: string[]` - Previously used tags for autocomplete
- `onSave: (name, tags) => void` - Save callback

**Features:**

- Name input (required)
- Tags input with pill-style display and autocomplete
- Validation error if name empty
- Form resets when modal opens

### SavedProgressions.svelte

List of saved progressions with search functionality.

**Props:**

- `progressions: SavedProgression[]` - Saved progressions to display
- `onLoad`, `onDelete`, `onExport` - Action callbacks

**Features:**

- Search input filters by name or tag
- Empty state and "no results" messages
- Renders SavedProgressionItem for each

### SavedProgressionItem.svelte

Individual saved progression card.

**Features:**

- Name, chord count, tags display
- Primary buttons: Play (▶), Load (↓)
- Overflow menu (⋮): Export MIDI, Delete
- Inline delete confirmation

### LoadConfirmationDialog.svelte

Confirmation before loading saved progression.

**Props:**

- `open: boolean` (bindable)
- `progressionName: string`
- `onConfirm`, `onCancel` callbacks

## Code Style

- TypeScript strict mode
- Svelte 5 runes for state (`$state`, `$derived`)
- Use shadcn-svelte components
- Functional utilities over classes
- 0-indexed intervals (semitones from root)

## Data Structures

### Harmony Definitions

Chords stored as 0-indexed interval arrays (semitones from root). See `src/lib/utils/theory-engine/constants.ts` for full list of 37 chord qualities including triads, 7th chords, 6th chords, 9th/11th/13th chords, add chords, and altered dominants.

```typescript
// Example qualities (see constants.ts for complete list)
const QUALITIES = {
	'': [0, 4, 7], // Major
	m: [0, 3, 7], // Minor
	maj7: [0, 4, 7, 11], // Major 7th
	'7': [0, 4, 7, 10], // Dominant 7th
	add9: [0, 4, 7, 14], // Major add 9
	'7#9': [0, 4, 7, 10, 15] // Hendrix chord
	// ... 31 more qualities
} as const;

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
```

### Chord Type

```typescript
type Chord = {
	root: number; // MIDI note (60 = C4)
	quality: keyof typeof QUALITIES; // '' | 'm' | 'maj7' | ...
	inversion: number; // 0, 1, 2, ...
	voicing: keyof typeof VOICING_PRESETS; // 'close' | 'open' | 'drop2' | ...
};
```

### Inversion Logic

Rotate interval array left, move notes up an octave:

```typescript
function applyInversion(intervals: number[], inv: number): number[] {
	if (inv === 0) return intervals;
	const inverted = [...intervals];
	for (let i = 0; i < inv; i++) {
		const lowest = inverted.shift()!;
		inverted.push(lowest + 12);
	}
	return inverted;
}
```

### Voicing Presets

```typescript
const VOICING_PRESETS = {
	close: (notes: number[]) => notes,
	open: (notes: number[]) => {
		if (notes.length < 3) return notes;
		return [notes[0], ...notes.slice(1, -1).map((n) => n + 12), notes[notes.length - 1]];
	},
	drop2: (notes: number[]) => {
		if (notes.length < 3) return notes;
		const sorted = [...notes].sort((a, b) => a - b);
		const secondHighest = sorted[sorted.length - 2];
		return notes.map((n) => (n === secondHighest ? n - 12 : n)).sort((a, b) => a - b);
	},
	drop3: (notes: number[]) => {
		if (notes.length < 4) return notes;
		const sorted = [...notes].sort((a, b) => a - b);
		const thirdHighest = sorted[sorted.length - 3];
		return notes.map((n) => (n === thirdHighest ? n - 12 : n)).sort((a, b) => a - b);
	},
	wide: (notes: number[]) => notes.map((n, i) => n + i * 12)
} as const;
```

### Complete Pipeline

```typescript
function getChordNotes(chord: Chord): number[] {
	const intervals = QUALITIES[chord.quality];
	const inverted = applyInversion(intervals, chord.inversion);
	const voiced = VOICING_PRESETS[chord.voicing](inverted);
	return voiced.map((interval) => chord.root + interval);
}
```

### Display Functions

```typescript
function getChordName(chord: Chord): string {
	const rootName = NOTE_NAMES[chord.root % 12];
	return `${rootName}${chord.quality}`;
}

function getChordTooltip(chord: Chord): string {
	if (chord.inversion === 0) return '';
	const intervals = QUALITIES[chord.quality];
	const inverted = applyInversion(intervals, chord.inversion);
	const bassNote = NOTE_NAMES[(chord.root + inverted[0]) % 12];
	const inversionNames = ['', 'First', 'Second', 'Third', 'Fourth'];
	return `${inversionNames[chord.inversion]} inversion (${bassNote} in bass)`;
}
```

## State Management

Use Svelte 5 runes:

```typescript
// lib/stores/progression.svelte.ts
export const progressionState = $state({
	scale: null as { key: string; mode: string } | null,
	scaleFilterEnabled: false,
	randomizeWithinScale: false,
	randomizeOptions: {
		inversion: true, // ON by default
		voicing: true, // ON by default
		octave: false, // OFF by default
		quality: false // OFF by default
	},
	builderState: {
		selectedRoot: null as number | null,
		selectedQuality: null as keyof typeof QUALITIES | null
	},
	progression: [] as Chord[],
	palette: [] as Chord[],
	midiOutput: {
		enabled: false,
		selectedDeviceId: null as string | null,
		isSupported: false,
		permissionGranted: false,
		outputs: [] as Array<{ id: string; name: string }>,
		inputs: [] as Array<{ id: string; name: string }>,
		isConnected: false,
		error: null as string | null,
		hasSeenSetupModal: false,
		midiChannel: 1, // 1-16
		velocity: 100, // 0-127
		clockSync: {
			enabled: false,
			selectedInputId: null as string | null,
			isReceivingClock: false,
			detectedBpm: null as number | null,
			isExternallyPlaying: false
		}
	},
	pianoKeyboard: {
		visible: false, // Collapsed by default
		activeNotes: [] as number[] // Currently playing MIDI notes
	},
	savedProgressions: {
		items: [] as SavedProgression[], // Saved progressions (newest first)
		availableTags: [] as string[] // Unique tags for autocomplete
	}
});
```

**Key exported functions:**

- Progression: `addToProgression`, `updateChord`, `removeFromProgression`, `clearProgression`, `moveInProgression`
- Palette: `addToPalette`, `removeFromPalette`, `clearPalette`, `moveInPalette`
- Scale: `setScale`, `clearScale`, `setScaleFilterEnabled`, `setRandomizeWithinScale`
- Randomize Options: `setRandomizeOption`, `initRandomizeOptions` (persisted via localStorage)
- Builder: `setSelectedRoot`, `setSelectedQuality`
- MIDI Output: `setMIDIEnabled`, `setMIDIDevice`, `setMIDIConnectionState`, `updateMIDIOutputs`, `setMIDIPermissionGranted`, `setMIDIError`, `setMIDIHasSeenSetupModal`, `setMIDIChannel`, `setMIDIVelocity`, `setMIDISupported`
- Piano Keyboard: `setPianoVisible`, `setPianoActiveNotes`, `clearPianoActiveNotes`, `initPianoSettings`, `computePianoRange`
- Saved Progressions: `initSavedProgressions`, `addSavedProgression`, `removeSavedProgression`, `updateAvailableTags`, `loadProgressionToCanvas`
- Utility: `isValidChord` (type guard)

## UI/UX Patterns

### Chord Builder (✅ Implemented)

**Simplified 2-row design** (mobile-first, minimal UI):

1. **Row 1**: Select root note (all 12 chromatic notes)
   - 4 cols mobile → 6 cols tablet → 12 cols desktop

2. **Row 2**: Select quality (37 qualities, ordered by popularity)
   - 3 cols mobile → 4 cols tablet → 6 cols desktop
   - Scrollable grid with research-backed ordering

**Behavior**:

- **Click quality** → Instant audio preview (if root selected)
- **Drag quality** → Add to progression (shows full chord name like "Cmaj7" during drag)
- Last selection stays active (enables quick duplication)
- Custom drag preview styled as shadcn button
- Scale filter grays out non-scale options (when implemented)

### Progression Canvas (✅ Implemented)

The progression canvas is composed of three main components working together:

**Component Hierarchy:**

```
ChordProgression (container)
├── PlaybackControls (header with buttons)
└── ProgressionSlot × 4 (drop zones)
    └── ChordBlock (when slot is occupied)
```

**Features:**

- ✅ 4 drop zones for chords (ProgressionSlot components)
- ✅ Horizontal timeline layout with smooth drag-and-drop
- ✅ Reorder chords by dragging blocks
- ✅ Each block has comprehensive controls:
  - **Play button (▶)** - Preview chord with current inversion/voicing/octave settings
  - **Progress bar** - Visual playback indicator at bottom (transport-synced for progression, CSS animated for previews)
  - **Inversion dropdown** - Select from available inversions (Root, 1st, 2nd, etc.)
  - **Voicing dropdown** - Choose preset (Close, Open, Drop 2, Drop 3, Wide)
  - **Octave controls** - Transpose up/down (±2 octaves)
  - **Randomize button + settings gear** - Randomize inversion and voicing by default; click gear icon to configure what gets randomized. Settings persist via localStorage
  - **Delete button** - Remove from progression
  - **Drag handle** - Visual indicator for reordering
- ✅ Play button: loop through progression at 120 BPM (in PlaybackControls)
- ✅ Stop button: halt playback (in PlaybackControls)
- ✅ Export button: download as .mid file (in PlaybackControls)
- ✅ Empty state with helpful instructions

### Scale Filter (✅ Implemented)

- ✅ Popover UI with clean layout
- ✅ Key selector: All 12 chromatic notes
- ✅ Mode selector: 8 modes (Major, Minor, Dorian, Phrygian, Lydian, Mixolydian, Aeolian, Locrian)
- ✅ "Lock to scale" toggle: Grays out non-scale options in chord builder (when enabled)
- ✅ "Respect scale when randomizing" toggle: Constrains randomization to scale notes
- ✅ Clear scale button: Reset all filter settings
- ✅ Visual feedback: Shows selected key/mode in button
- ✅ "Freedom First" philosophy: Grayed options remain usable

### Chord Palette (✅ Implemented)

- ✅ Sidebar component for saving chord ideas
- ✅ Accepts drops from ChordBuilder (save new ideas)
- ✅ Accepts drops from ChordProgression (save configured chords)
- ✅ Drag chords from palette to progression
- ✅ Reorder chords within palette
- ✅ Play button for audio preview (with progress bar visual feedback)
- ✅ Delete button to remove chords
- ✅ Empty state with helpful instructions
- ✅ Responsive: Full width on mobile, fixed width sidebar on desktop
- ✅ Scrollable container for many saved chords

### Help Modal (✅ Implemented)

- ✅ Help button in header (CircleHelp icon)
- ✅ Modal dialog with scrollable content
- ✅ Sections: Getting Started, Features, Workflow Tips, Keyboard Shortcuts
- ✅ Clean, scannable layout with headings
- ✅ Dismissible and reopenable
- ✅ Responsive design (max height 80vh with scroll)

### Main App Layout (✅ Implemented)

- ✅ 3-column responsive layout
- ✅ Header with title and Help button
- ✅ Desktop: Builder + Progression | Palette (side-by-side with sidebar)
- ✅ Mobile/Tablet: Stacks vertically
- ✅ Scrollable areas where needed

### Keyboard Shortcuts (✅ Implemented)

Full keyboard navigation for chord building and playback. See `KEYBOARD_SHORTCUTS.md` for complete reference.

**Playback & Export:**

| Key              | Action                       |
| ---------------- | ---------------------------- |
| **Space**        | Play/Stop toggle             |
| **Escape**       | Stop playback / Close modals |
| **Cmd/Ctrl + S** | Save progression             |
| **Cmd/Ctrl + E** | Export MIDI                  |
| **?**            | Open Help modal              |

**Chord Builder Navigation:**

| Key            | Action                                        |
| -------------- | --------------------------------------------- |
| **Tab**        | Switch focus between Root grid ↔ Quality grid |
| **Arrow Keys** | Navigate within the focused grid              |

**Progression Slots:**

| Key            | Action                                                  |
| -------------- | ------------------------------------------------------- |
| **1, 2, 3, 4** | Focus slot + preview chord                              |
| **Enter**      | Add chord to first empty slot (or replace focused slot) |
| **R**          | Replace focused slot with current builder chord         |

**Implementation:**

- Global keydown listener in `+page.svelte`
- Centralized handler in `keyboard-shortcuts.ts`
- Shortcuts disabled when typing in input fields
- Modals block most shortcuts (except Escape and ?)

### SEO Optimization (✅ Implemented)

Comprehensive SEO for search discoverability and social sharing:

**Components:**

- ✅ `sk-seo` package installed
- ✅ `+layout.js` - SEO configuration data loader
- ✅ `+layout.svelte` - SEO component with Open Graph, Twitter cards, Schema.org
- ✅ `/sitemap.xml` - Dynamic sitemap generation
- ✅ `/robots.txt` - Dynamic robots.txt with sitemap reference
- ✅ OG image (1200x630px) at `/static/og-image.png`
- ✅ Full favicon set (16x16, 32x32, 192x192, 512x512, apple-touch-icon)

**Meta Tags:**

- Title: "Bare Minimum Theory - Chord Progression Builder"
- Description optimized for self-taught producers
- Keywords targeting bedroom producers and music theory learners
- Open Graph tags for Facebook/social sharing
- Twitter card tags
- Schema.org WebApplication structured data
- Canonical URLs

**Testing:**

- Facebook Sharing Debugger: https://developers.facebook.com/tools/debug/
- Twitter Card Validator: https://cards-dev.twitter.com/validator
- Google Rich Results Test: https://search.google.com/test/rich-results

## Audio Implementation

Use Tone.js for playback:

```typescript
import * as Tone from 'tone';

const synth = new Tone.PolySynth().toDestination();

function playChord(notes: number[]) {
	const noteNames = notes.map((n) => Tone.Frequency(n, 'midi').toNote());
	synth.triggerAttackRelease(noteNames, '4n');
}
```

**Important**: Call `await Tone.start()` on first user gesture to enable audio context.

### MIDI Output to DAW

Send MIDI directly to your DAW via Web MIDI API. When enabled, playback uses MIDI instead of Tone.js (exclusive mode).

**Browser Support**: Chrome, Edge, Firefox, Opera (~85% coverage). Safari not supported.

**Setup Requirements**:

- Virtual MIDI port (macOS: IAC Driver, Windows: loopMIDI)
- HTTPS (required for Web MIDI API permission)
- User permission grant

**Key functions in `midi-output.ts`**:

```typescript
// Check support (excludes Safari)
export function isMIDISupported(): boolean;

// Request permission
export async function requestMIDIAccess(): Promise<MIDIAccess | null>;

// Get available devices
export function getMIDIOutputs(): Array<{ id: string; name: string }>;

// Select output device
export function selectMIDIOutput(outputId: string): boolean;

// Play chord via MIDI
export function playChord(
	notes: number[],
	durationMs: number,
	velocity?: number,
	channel?: number
): void;

// Loop progression via MIDI
export function startMIDILoop(
	getProgression: () => (Chord | null)[],
	bpm: number,
	velocity?: number,
	channel?: number
): void;

// Stop all MIDI playback
export function stopMIDILoop(): void;
```

**Audio routing in `audio-playback.ts`**:

```typescript
function shouldUseMIDI(): boolean {
	return progressionState.midiOutput.enabled && progressionState.midiOutput.isConnected;
}

// In playChord():
if (shouldUseMIDI()) {
	playMIDIChordRaw(notes, durationMs, velocity, channel);
	return; // Skip Tone.js
}
// else use Tone.js...
```

## MIDI Export

Use midi-writer-js:

```typescript
import { MidiWriter } from 'midi-writer-js';

function exportToMIDI(progression: Chord[]) {
	const track = new MidiWriter.Track();
	progression.forEach((chord) => {
		const notes = getChordNotes(chord);
		track.addEvent(
			new MidiWriter.NoteEvent({
				pitch: notes,
				duration: '1' // Whole note
			})
		);
	});
	const write = new MidiWriter.Writer(track);
	const blob = new Blob([write.buildFile()], { type: 'audio/midi' });
	const url = URL.createObjectURL(blob);

	const a = document.createElement('a');
	a.href = url;
	a.download = 'chord-progression.mid';
	a.click();
}
```

## Drag and Drop

Use HTML5 drag-and-drop API:

```svelte
<!-- ChordBuilder.svelte -->
<div
  draggable="true"
  ondragstart={(e) => {
    e.dataTransfer.setData('application/json', JSON.stringify(chord));
  }}
>

<!-- ChordProgression.svelte -->
<div
  ondrop={(e) => {
    const chord = JSON.parse(e.dataTransfer.getData('application/json'));
    addToProgression(chord);
  }}
  ondragover={(e) => e.preventDefault()}
>
```

## Testing Checklist

### ✅ Implemented Features

**Chord Builder:**

- [x] Build any chord (12 roots × 37 qualities)
- [x] Audio preview plays correct notes (auto-preview on quality click)
- [x] Drag and drop works with custom preview (shows full chord name)

**Progression Canvas:**

- [x] Drag chords into 4 slots
- [x] Play button on each chord block for instant preview
- [x] Inversion dropdown with dynamic options
- [x] Voicing dropdown with 5 presets (Close, Open, Drop 2, Drop 3, Wide)
- [x] Octave transpose controls (±2 octaves)
- [x] Randomize button with configurable settings (inversion, voicing, octave, quality)
- [x] Reorder chords by dragging blocks
- [x] Play progression with looping
- [x] Stop playback
- [x] MIDI export functionality

**Chord Palette:**

- [x] Palette accepts drops from builder
- [x] Palette accepts drops from progression
- [x] Drag chords from palette to progression
- [x] Reorder chords within palette
- [x] Play button previews audio
- [x] Delete button removes chords

**Scale Filter:**

- [x] Scale filter with key/mode selection
- [x] Lock to scale option (dims out-of-scale chords when enabled)
- [x] Randomize within scale option

**Piano Keyboard:**

- [x] Piano toggle button visible in PlaybackControls
- [x] Piano keyboard shows/hides when toggled
- [x] Active notes display during playback
- [x] Dynamic range adjusts to progression content
- [x] Visibility preference persists across sessions

**Help Modal:**

- [x] Help button visible in header
- [x] Modal opens with all documentation sections
- [x] Dismissible and reopenable

**Saved Progressions:**

- [x] Save button in PlaybackControls (disabled with <2 chords)
- [x] Save modal with name and optional tags
- [x] Tag autocomplete from previously used tags
- [x] Saved progressions appear in sidebar (newest first)
- [x] Filter/search by name or tag
- [x] Play saved progression (preview audio)
- [x] Load saved progression (with confirmation dialog)
- [x] Export saved progression as MIDI
- [x] Delete saved progression (inline confirmation)
- [x] Accordion collapse/expand for Palette and Saved sections
- [x] Count badges in section headers
- [x] Data persists across browser sessions (IndexedDB)

**General:**

- [x] Mobile-first responsive design
- [x] 3-column layout on desktop

### ⬜ Manual Testing Required

- [ ] MIDI file opens correctly in DAW (Ableton, Logic, FL Studio, etc.)
- [ ] Audio playback works in Chrome
- [ ] Audio playback works in Firefox
- [ ] Audio playback works in Safari
- [ ] Mobile experience (iOS/Android)
- [ ] Tablet experience
- [ ] Edge cases (empty slots, extreme octaves, etc.)

## Common Issues

**Audio doesn't play on first click**

- Add user gesture to start Tone.js: `await Tone.start()`

**MIDI notes out of range**

- Clamp root values to valid MIDI range (21-108)

**Drag and drop not working**

- Ensure `ondragover` calls `e.preventDefault()`

**Scale filter breaks on modal interchange**

- Scale filter is opt-in, doesn't prevent "wrong" chords

## Implementation Status

### ✅ Completed - MVP Feature Complete!

**Core Engine:**

- Music theory engine (37 chord qualities, inversions, 5 voicings)
- State management with Svelte 5 runes (with palette and saved progressions support)
- Research-backed chord ordering (QUALITY_ORDER)
- Type definitions and barrel exports
- Comprehensive test suite (330+ tests)

**UI Components:**

- Chord builder UI (clean, mobile-first 2-row design)
- DraggableChordButton component (drag support with custom preview)
- ChordProgression canvas (4 slots, drag-to-reorder, visual feedback)
- ChordBlock component (inversion/voicing/octave controls, randomize, delete)
- ScaleFilter UI (key/mode selection, lock options)
- ChordPalette component (accordion sidebar with Palette and Saved sections)
- PaletteChord component (play/delete controls, draggable)
- SaveProgressionModal component (save with name and tags)
- SavedProgressions component (list with search/filter)
- SavedProgressionItem component (play/load/export/delete actions)
- LoadConfirmationDialog component (confirm before replacing canvas)
- HelpModal component (in-app documentation)
- PianoKeyboard component (visual piano with active notes display)
- Main app layout (+page.svelte with Help button, 3-column responsive layout)

**Audio & Export:**

- Audio playback integration (Tone.js with instant preview)
- Looping playback for full progression
- MIDI export functionality (downloadable .mid files)

**Scale Filtering:**

- Scale helper utilities (diatonic chord detection)
- Visual highlighting of in-scale vs out-of-scale options
- Optional constraints for randomization

**SEO & Discoverability:**

- SEO package integration (sk-seo)
- Meta tags (title, description, keywords, author)
- Open Graph tags for social media
- Twitter card tags
- Schema.org structured data (WebApplication)
- Dynamic sitemap.xml generation
- Dynamic robots.txt with sitemap reference
- OG image (1200x630px) and favicon set

**Persistence & Storage:**

- IndexedDB wrapper utilities (CRUD operations)
- Save/load progressions with name and tags
- Tag autocomplete from previously used tags
- Search/filter by name or tag
- Confirmation dialog before loading
- Inline delete confirmation

### 🎯 Ready for Testing

- Manual testing in browser
- MIDI file validation in DAW
- Cross-browser compatibility (Chrome, Firefox, Safari)
- Mobile/tablet responsive testing

## MVP Completion Criteria

### ✅ Core Features (Complete)

- ✅ Music theory utilities (ENG-51)
- ✅ State management with runes (ENG-52)
- ✅ Chord builder component (ENG-53)
- ✅ Chord palette component (ENG-59)
- ✅ Help modal component (ENG-60)
- ✅ SEO optimization (ENG-61)
- ✅ Piano keyboard visualization (ENG-70)
- ✅ Save/load progressions with IndexedDB (ENG-73)
- ✅ 330+ tests (102 theory + 91 store + 16 audio + 25 scale + 22 MIDI output + 23 MIDI clock + 29 persistence + 7 piano + 22 progression-persistence)
- ✅ Build any chord manually (12 roots × 37 qualities)
- ✅ Preview individual chords with audio (auto-preview on click)
- ✅ Drag chords with custom preview (shows full chord name)
- ✅ Progression canvas (4 drop zones)
- ✅ Chord blocks with controls (inversion/voicing/octave/randomize/delete)
- ✅ Chord palette (save, organize, drag to progression)
- ✅ Help modal (in-app documentation)
- ✅ Play full progression (with looping)
- ✅ Stop playback
- ✅ Export working MIDI file
- ✅ Scale filter works (optional feature with lock toggles)
- ✅ Reorder chords by dragging blocks
- ✅ Randomize respects scale when toggled
- ✅ Save progressions with name and tags
- ✅ Load saved progressions (with confirmation)
- ✅ Search/filter saved progressions
- ✅ Delete saved progressions (inline confirmation)

### 🧪 Testing Phase (In Progress)

- ⬜ Manual browser testing
- ⬜ MIDI file validation in DAW (e.g., Ableton, Logic, FL Studio)
- ⬜ Cross-browser testing (Chrome, Firefox, Safari)
- ⬜ Mobile responsive testing
- ⬜ Tablet responsive testing
- ⬜ Audio playback on different devices
- ⬜ Edge case testing (empty progressions, extreme octaves, etc.)
