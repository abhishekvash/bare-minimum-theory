# Bare Minimum Theory

Browser-based chord progression builder with AI assistance. Users build chord progressions manually, preview audio, and export to MIDI for use in DAWs.

## Tech Stack

- **Framework**: SvelteKit + TypeScript
- **UI**: shadcn-svelte components
- **Audio**: Tone.js (Web Audio API wrapper)
- **Music Theory**: @tonaljs/tonal
- **MIDI**: midi-writer-js

## ⚠️ Important: Package Manager

**This project uses Bun, not npm.**

- Use `bun` instead of `npm`
- Use `bunx` instead of `npx`
- Use `bun run <script>` to run package.json scripts
- Use `bun add` instead of `npm install` for dependencies

Examples:

- ❌ `npm install package` → ✅ `bun add package`
- ❌ `npx command` → ✅ `bunx command`
- ❌ `npm run test` → ✅ `bun run test`

## Core Philosophy

**Freedom First**: All music theory constraints (scales, modes) are opt-in helpers, not enforced rules. Users can make any chord progression they want - "beautiful blunders through blind discovery."

## 🎉 Project Status: Post-MVP Enhancements Complete!

All core features and major enhancements (dynamic progression, durations) have been implemented. The application is fully functional with 360+ passing tests.

## MVP & Core Features

1. ✅ **Three-click chord builder** - Root → Quality → Result
2. ✅ **Optional scale filter** - Highlights/filters chords in selected scale
3. ✅ **Dynamic progression canvas** - Up to 16 slots with drag-and-drop reordering and insertion points
4. ✅ **Chord duration controls** - Set individual duration (1 Bar, 1/2 Bar, 1/4 Bar) per chord
5. ✅ **In-block controls** - Inversion/voicing dropdowns, octave transpose, randomize, delete (resizes canvas)
6. ✅ **Audio preview** - Individual chord preview + variable-timing looping playback
7. ✅ **Visual playback indicator** - Progress bar sweeps across chords during playback (transport-synced)
8. ✅ **MIDI export** - Download as .mid file with correct chord durations
9. ✅ **Chord Palette** - Save and organize chords for later use
10. ✅ **Help Modal** - In-app documentation and tips
11. ✅ **SEO Optimization** - Meta tags, Open Graph, Twitter cards, sitemap, robots.txt
12. ✅ **MIDI Output to DAW** - Preview progressions with your own VSTs/sounds via Web MIDI API
13. ✅ **DAW Sync** - Sync tempo and transport (Start/Stop) with DAW via MIDI Clock
14. ✅ **Piano Keyboard Visualization** - Visual piano showing active notes during playback
15. ✅ **Save/Load Progressions** - Save progressions to IndexedDB with name and tags, load later
16. ✅ **Keyboard Shortcuts** - Full keyboard navigation for chord building and playback
17. ✅ **Mobile Support** - Optimized drag-and-drop for touch devices

## Data Structures

### Harmony Definitions

Chords stored as 0-indexed interval arrays (semitones from root):

```typescript
const QUALITIES = {
	'': [0, 4, 7], // Major triad
	m: [0, 3, 7], // Minor triad
	maj7: [0, 4, 7, 11], // Major 7th
	m7: [0, 3, 7, 10], // Minor 7th
	'7': [0, 4, 7, 10], // Dominant 7th
	dim: [0, 3, 6], // Diminished
	aug: [0, 4, 8], // Augmented
	sus4: [0, 5, 7], // Suspended 4th
	sus2: [0, 2, 7] // Suspended 2nd
	// Add more as needed
} as const;

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
```

### Chord Instance

```typescript
type Chord = {
	root: number; // MIDI note number (60 = C4)
	quality: keyof typeof QUALITIES; // '' | 'm' | 'maj7' | 'm7' | '7' | ...
	inversion: number; // 0, 1, 2, ...
	voicing: keyof typeof VOICING_PRESETS; // 'close' | 'open' | 'drop2' | ...
	duration: string; // '1m' | '2n' | '4n' | '8n'
};
```

### Inversion Logic

Rotate the interval array left, pushing moved notes up an octave:

```typescript
function applyInversion(intervals: number[], inv: number): number[] {
	if (inv === 0) return intervals;

	const inverted = [...intervals];
	for (let i = 0; i < inv; i++) {
		const lowest = inverted.shift()!;
		inverted.push(lowest + 12); // Move to next octave
	}
	return inverted;
}

// Example: [0, 4, 7, 11] with inversion=1 → [4, 7, 11, 12]
```

### Voicing Presets

Transform already-inverted intervals for different spacings:

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

	wide: (notes: number[]) => {
		return notes.map((n, i) => n + i * 12);
	}
} as const;
```

### Complete Pipeline

```typescript
function getChordNotes(chord: Chord): number[] {
	// 1. Get base intervals
	const intervals = QUALITIES[chord.quality];

	// 2. Apply inversion
	const inverted = applyInversion(intervals, chord.inversion);

	// 3. Apply voicing
	const voiced = VOICING_PRESETS[chord.voicing](inverted);

	// 4. Add root offset
	return voiced.map((interval) => chord.root + interval);
}
```

### Display Names

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

## Component Architecture

```
src/
├── routes/
│   ├── +page.svelte                    # Main app layout with Help button
│   ├── +layout.svelte                  # ✅ Root layout with SEO component
│   ├── +layout.js                      # ✅ SEO configuration loader
│   ├── sitemap.xml/
│   │   └── +server.js                  # ✅ Dynamic sitemap generation
│   └── robots.txt/
│       └── +server.js                  # ✅ Dynamic robots.txt generation
├── lib/
│   ├── components/
│   │   ├── ChordBuilder.svelte          # ✅ Two-row builder (Root → Quality)
│   │   ├── DraggableChordButton.svelte  # ✅ Quality button with drag support
│   │   ├── ChordProgression.svelte      # ✅ Main progression container
│   │   ├── PlaybackControls.svelte      # ✅ Play/Stop/Export header controls
│   │   ├── ProgressionSlot.svelte       # ✅ Individual slot with drop zone
│   │   ├── ChordBlock.svelte            # ✅ Individual chord in progression
│   │   ├── ScaleFilter.svelte           # ✅ Optional scale selector UI
│   │   ├── ChordPalette.svelte          # ✅ Sidebar for saving chords
│   │   ├── PaletteChord.svelte          # ✅ Individual chord in palette
│   │   ├── HelpModal.svelte             # ✅ In-app documentation modal
│   │   ├── PianoKeyboard.svelte         # ✅ Visual piano showing active notes
│   │   ├── MIDIOutputToggle.svelte      # ✅ MIDI enable/disable toggle
│   │   ├── MIDISetupModal.svelte        # ✅ MIDI setup wizard (orchestrates sub-components)
│   │   ├── SaveProgressionModal.svelte  # ✅ Save progression dialog (name + tags)
│   │   ├── SavedProgressions.svelte     # ✅ Saved progressions list with search
│   │   ├── SavedProgressionItem.svelte  # ✅ Individual saved progression item
│   │   ├── LoadConfirmationDialog.svelte # ✅ Confirm before replacing current progression
│   │   └── midi/                        # ✅ MIDI setup sub-components
│   │       ├── MIDIPlatformInstructions.svelte  # Platform-specific setup guides
│   │       ├── MIDIDeviceSelector.svelte        # Device list + refresh + status
│   │       ├── MIDITestConnection.svelte        # Test button + feedback
│   │       ├── MIDIAdvancedSettings.svelte      # Channel/velocity/strum settings
│   │       └── MIDIClockSync.svelte             # DAW sync toggle + input selector
│   ├── stores/
│   │   ├── progression.svelte.ts        # ✅ Chord progression & builder state
│   │   ├── midi.svelte.ts               # ✅ MIDI output & clock sync state
│   │   └── settings.svelte.ts           # ✅ UI settings & piano keyboard state
│   ├── app-init.ts                      # ✅ Application initialization orchestrator
│   └── utils/
│       ├── theory-engine/               # ✅ IMPLEMENTED
│       │   ├── index.ts                 # Barrel export
│       │   ├── types.ts                 # Type definitions
│       │   ├── constants.ts             # NOTE_NAMES + QUALITIES + QUALITY_ORDER + MODES
│       │   ├── inversions.ts            # applyInversion function
│       │   ├── voicings.ts              # VOICING_PRESETS
│       │   ├── chord-operations.ts      # getChordNotes pipeline
│       │   └── display.ts               # getChordName + getChordTooltip
│       ├── midi-export.ts               # ✅ MIDI file generation
│       ├── midi-output.ts               # ✅ Web MIDI API wrapper
│       ├── midi-clock.ts                # ✅ MIDI clock input for DAW sync
│       ├── midi-clock-listener.ts       # ✅ Shared clock listener setup/teardown
│       ├── midi-settings-persistence.ts # ✅ MIDI settings localStorage
│       ├── midi-clock-persistence.ts    # ✅ MIDI clock settings localStorage
│       ├── piano-settings-persistence.ts # ✅ Piano keyboard settings localStorage
│       ├── audio-playback.ts            # ✅ Tone.js audio preview with looping + progress tracking
│       ├── scale-helper.ts              # ✅ Scale filtering utilities
│       ├── settings-persistence.ts      # ✅ localStorage utilities for user preferences
│       ├── indexeddb.ts                 # ✅ IndexedDB wrapper for persistent storage
│       ├── progression-persistence.ts   # ✅ Save/load progressions to IndexedDB
│       └── keyboard-shortcuts.ts        # ✅ Centralized keyboard event handler
├── src/tests/                           # ✅ IMPLEMENTED (350+ tests total)
│   ├── theory-engine/
│   │   ├── inversions.test.ts           # 14 tests
│   │   ├── voicings.test.ts             # 20 tests
│   │   ├── chord-operations.test.ts     # 33 tests
│   │   └── display.test.ts              # 35 tests
│   ├── stores/
│   │   ├── progression.svelte.test.ts   # 85 tests
│   │   ├── midi.svelte.test.ts          # 23 tests (MIDI output + clock sync)
│   │   └── settings.svelte.test.ts      # 10 tests (randomize + piano)
│   └── utils/
│       ├── audio-playback.test.ts       # 16 tests
│       ├── midi-output.test.ts          # 22 tests
│       ├── midi-clock.test.ts           # 23 tests (clock + transport)
│       ├── midi-settings-persistence.test.ts # 11 tests
│       ├── midi-clock-persistence.test.ts # 11 tests
│       ├── piano-settings-persistence.test.ts # 9 tests
│       ├── scale-helper.test.ts         # 25 tests
│       └── progression-persistence.test.ts # 18 tests (IndexedDB storage)
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

**Features:**

- Renders "Your Progression" header with instructions
- Play button (disabled when no chords or already playing)
- Stop button (disabled when not playing)
- Export MIDI button (disabled when no chords)
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
- Randomize button + settings gear (configure what to randomize; respects scale filter when enabled)
- Delete button
- Drag handle for reordering within progression

### ChordPalette.svelte

Sidebar component with two collapsible sections: Chord Palette and Saved Progressions. Allows users to collect chord ideas and manage saved progressions.

**Key responsibilities:**

- Manages two collapsible accordion sections (Palette and Saved)
- Drop zone for accepting chords from builder or progression
- Displays PaletteChord components in a scrollable list
- Displays SavedProgressions component for saved progressions
- Handles drag-over/drop event coordination for palette
- Shows empty state with helpful instructions when sections are empty
- Supports reordering chords within palette via drag-and-drop

**Features:**

- **Accordion behavior**: Both Palette and Saved sections are collapsible with chevron icons
- **Count badges**: Shows item count in each section header
- Accepts drops from ChordBuilder (saves new chord ideas)
- Accepts drops from ChordProgression (saves configured chords)
- Visual feedback during drag operations
- Responsive layout (full width on mobile, fixed width sidebar on desktop)
- Scrollable container when many chords are saved
- Footer with credits

### PaletteChord.svelte

Individual chord item in the palette. Rendered inside ChordPalette for each saved chord.

**Features:**

- Displays chord name with quality symbol
- Play button for audio preview
- Progress bar at bottom (CSS animated for preview playback)
- Delete button to remove from palette
- Drag handle for reordering within palette or dragging to progression
- Visual feedback during drag (opacity change, ring highlight)
- Custom drag preview showing chord name
- Draggable to progression slots
- Reorderable within palette

### HelpModal.svelte

Modal dialog that provides comprehensive in-app documentation. Triggered by Help button in the header.

**Props:**

- `open: boolean` (bindable) - Controls modal visibility

**Features:**

- Uses shadcn-svelte Dialog component
- Scrollable content with clear section headings
- Dismissible with close button
- Responsive design (max height 80vh with scroll)
- Comprehensive documentation sections:
  - **Getting Started**: 3-step guide (Pick root → Choose quality → Drag to build)
  - **Features**: Inversions, Voicings, Octave Transpose, Randomize, Scale Filter, Chord Palette
  - **Workflow Tips**: Using palette, MIDI export, experimentation, looping
  - **Keyboard Shortcuts**: Placeholder for future features

**Content structure:**

- Clean, scannable layout with section headings (h3)
- Short paragraphs and bullet points
- Emphasis on key terms (bold)
- Helpful explanations without overwhelming detail

### PianoKeyboard.svelte

Visual piano keyboard that displays currently playing notes during playback. Shows active notes with animated dots.

**Features:**

- Dynamic key range based on all chords in progression (auto-adjusts span)
- White and black keys rendered proportionally
- Active notes highlighted with animated dots (CSS pulse animation)
- Collapsible via toggle button in PlaybackControls
- Visibility preference persisted to localStorage
- Responsive sizing (smaller height on mobile)

**State:**

- `progressionState.pianoKeyboard.visible` - Whether piano is shown
- `progressionState.pianoKeyboard.activeNotes` - Currently playing MIDI notes

**Related utilities:**

- `computePianoRange(progression)` - Calculates optimal key range for progression
- `setPianoVisible(visible)` - Toggle visibility
- `setPianoActiveNotes(notes)` - Set currently playing notes
- `clearPianoActiveNotes()` - Clear active notes
- `piano-settings-persistence.ts` - localStorage persistence

### SaveProgressionModal.svelte

Modal dialog for saving the current progression with a name and optional tags.

**Props:**

- `open: boolean` (bindable) - Controls modal visibility
- `availableTags: string[]` - Previously used tags for autocomplete suggestions
- `onSave: (name: string, tags: string[]) => void` - Callback when save is confirmed

**Features:**

- Name input field (required)
- Tags input with pill-style display
- Autocomplete dropdown showing matching previously used tags
- Add tags via Enter key or Add button
- Remove tags by clicking X on pills
- Validation error message if name is empty
- Save/Cancel buttons
- Form resets when modal opens

### SavedProgressions.svelte

List component that displays saved progressions with search functionality.

**Props:**

- `progressions: SavedProgression[]` - Array of saved progressions to display
- `onLoad: (progression) => void` - Callback when loading a progression
- `onDelete: (id: string) => void` - Callback when deleting a progression
- `onExport: (progression) => void` - Callback when exporting to MIDI

**Features:**

- Search input that filters by name or tag
- Empty state with instructions when no progressions saved
- "No results" message when search has no matches
- Renders SavedProgressionItem for each progression

### SavedProgressionItem.svelte

Individual saved progression card with play, load, and management actions.

**Features:**

- Displays progression name and chord count
- Shows tags as small pills
- **Primary action buttons:**
  - ▶ Play - Preview audio (plays each chord in sequence)
  - ↓ Load - Load into canvas (triggers confirmation dialog)
- **Overflow menu (⋮)** with secondary actions:
  - Export as MIDI
  - Delete (with inline confirmation)
- Inline delete confirmation ("Delete this progression?" with Cancel/Delete)

### LoadConfirmationDialog.svelte

Confirmation dialog shown before loading a saved progression into the canvas.

**Props:**

- `open: boolean` (bindable) - Controls dialog visibility
- `progressionName: string` - Name of progression being loaded
- `onConfirm: () => void` - Callback when user confirms
- `onCancel: () => void` - Callback when user cancels

**Features:**

- Warning that current progression will be replaced
- Cancel and Load Progression buttons
- Auto-closes when action is taken

## SEO Implementation

Comprehensive SEO optimization for search engine discoverability and social media sharing.

**Files:**

- `src/routes/+layout.js` - SEO configuration data loader
- `src/routes/+layout.svelte` - sk-seo component integration
- `src/routes/sitemap.xml/+server.js` - Dynamic sitemap generation
- `src/routes/robots.txt/+server.js` - Dynamic robots.txt generation
- `static/og-image.png` - Open Graph image (1200x630px)

**Features:**

- Meta tags (title, description, keywords, author)
- Open Graph tags for social media previews
- Twitter card tags
- Schema.org structured data (WebApplication type)
- Canonical URLs
- Dynamic sitemap.xml
- Dynamic robots.txt with sitemap reference
- Favicon set (16x16, 32x32, 192x192, 512x512, apple-touch-icon)

**SEO Configuration:**

```javascript
// src/routes/+layout.js
export const load = async ({ url }) => {
	return {
		title: 'Bare Minimum Theory - Chord Progression Builder',
		description:
			'Build chord progressions without music school. Free browser-based tool for self-taught producers. Preview audio, export MIDI, learn by doing.',
		keywords:
			'chord progression, music theory, midi export, chord builder, self-taught musician, bedroom producer, music production, chord generator',
		siteName: 'Bare Minimum Theory',
		imageURL: `${url.origin}/og-image.png`,
		author: 'Abhishek S',
		type: 'website'
	};
};
```

**Testing Tools:**

- Facebook Sharing Debugger: https://developers.facebook.com/tools/debug/
- Twitter Card Validator: https://cards-dev.twitter.com/validator
- Google Rich Results Test: https://search.google.com/test/rich-results

## State Management

State is split across three dedicated stores for separation of concerns:

### progression.svelte.ts - Chord Progression State

```typescript
export const progressionState = $state({
	scale: null as { key: string; mode: string } | null,
	scaleFilterEnabled: false,
	randomizeWithinScale: false,
	builderState: {
		selectedRoot: null as number | null,
		selectedQuality: null as keyof typeof QUALITIES | null
	},
	progression: [null, null, null, null] as (Chord | null)[],
	palette: [] as Chord[],
	savedProgressions: {
		items: [] as SavedProgression[],
		availableTags: [] as string[]
	}
});
```

### midi.svelte.ts - MIDI Output & Clock Sync State

```typescript
export const midiState = $state({
	enabled: false,
	selectedDeviceId: null as string | null,
	isSupported: false,
	permissionGranted: false,
	outputs: [] as Array<{ id: string; name: string }>,
	inputs: [] as Array<{ id: string; name: string }>,
	isConnected: false,
	error: null as string | null,
	hasSeenSetupModal: false,
	midiChannel: 1,
	velocity: 100,
	strumEnabled: false,
	clockSync: {
		enabled: false,
		selectedInputId: null as string | null,
		isReceivingClock: false,
		detectedBpm: null as number | null,
		isExternallyPlaying: false
	}
});
```

### settings.svelte.ts - UI Settings & Piano State

```typescript
export const settingsState = $state({
	randomizeOptions: {
		inversion: true,
		voicing: true,
		octave: false,
		quality: false
	},
	pianoKeyboard: {
		visible: false,
		activeNotes: [] as number[]
	}
});
```

### app-init.ts - Application Initialization

Orchestrates startup: loads saved progressions from IndexedDB, restores settings from localStorage, and re-establishes MIDI connections if previously enabled.

**Key exported functions by store:**

**progression.svelte.ts:**

- `addChord`, `updateChord`, `removeChord`, `clearProgression`, `moveChord`
- `addToPalette`, `removeFromPalette`, `clearPalette`, `moveInPalette`
- `setScale`, `clearScale`, `setScaleFilterEnabled`, `setRandomizeWithinScale`
- `selectRoot`, `selectQuality`, `clearBuilderState`
- `initSavedProgressions`, `addSavedProgression`, `removeSavedProgression`, `loadProgressionToCanvas`

**midi.svelte.ts:**

- `setMIDIEnabled`, `setMIDIDevice`, `setMIDIConnectionState`, `updateMIDIOutputs`
- `setMIDIChannel`, `setMIDIVelocity`, `setMIDIStrumEnabled`, `initMIDISettings`
- `setClockSyncEnabled`, `setClockInputDevice`, `setClockReceivingState`
- `setDetectedBpm`, `setExternalPlayingState`, `initMIDIClockSettings`

**settings.svelte.ts:**

- `setRandomizeOption`, `initRandomizeOptions`
- `setPianoVisible`, `setActiveNotes`, `clearActiveNotes`, `initPianoSettings`

## UI/UX Details

### Chord Builder Layout (✅ Implemented)

**Simplified 2-row design:**

```
Root Note
[C] [C#] [D] [D#] [E] [F] [F#] [G] [G#] [A] [A#] [B]
 ↓ (C selected)

Quality                          Click to preview • Drag to add
[Major] [m] [sus4] [sus2] [5] [7] [maj7] [m7] [6] [m6]...
         ↓ (maj7 selected - plays instantly)
```

**Behavior:**

- **Click quality button** → Instantly plays audio preview (if root selected)
- **Drag quality button** → Adds chord to progression (shows full name like "Cmaj7" during drag)
- Last selection stays active (enables quick duplication)
- Quality buttons ordered by popularity (research-backed)
- Mobile-first responsive grid (4→6→12 cols for roots, 3→4→6 for qualities)
- Scale filter grays out non-scale notes/qualities (when implemented)

### Progression Canvas (✅ Implemented)

The progression canvas is composed of three main components working together:

**Component Hierarchy:**

```
ChordProgression (container)
├── PlaybackControls (header with buttons)
└── ProgressionSlot × 4 (drop zones)
    └── ChordBlock (when slot is occupied)
```

**Visual Layout:**

```
┌─ Your Progression ──────────────────────────────────┐
│ [Play] [Stop] [Export MIDI]      <- PlaybackControls│
│                                                      │
│ ┌─────────┐ ┌─────────┐ ┌────────┐ [____]          │
│ │  Cmaj7  │ │   Am    │ │  Fmaj  │    4   │         │
│ │ Inv:Root│ │Inv: 1st │ │Inv:Root│        │         │
│ │Voi:Close│ │Voi:Drop2│ │Voi:Open│        │         │
│ │Oct: +1  │ │Oct:  0  │ │Oct: -1 │        │         │
│ │[Random] │ │[Random] │ │[Random]│        │         │
│ │   [×]   │ │   [×]   │ │   [×]  │        │         │
│ └─────────┘ └─────────┘ └────────┘        │         │
│  ^ChordBlock ^ChordBlock ^ChordBlock  ^Empty slot    │
│  in Slot 1   in Slot 2   in Slot 3    (shows number) │
└──────────────────────────────────────────────────────┘
```

**Block controls (✅ All implemented):**

- **Play button (▶)** - Preview chord with current inversion/voicing/octave settings
- **Progress bar** - Visual playback indicator at bottom (transport-synced for progression, CSS animated for previews)
- **Inversion dropdown** - Select from available inversions (Root, 1st, 2nd, etc.)
- **Voicing dropdown** - Choose preset (Close, Open, Drop 2, Drop 3, Wide)
- **Octave controls** - Transpose up/down (±2 octaves)
- **Randomize button + settings gear** - Randomize inversion and voicing by default; click gear icon to configure what gets randomized (inversion, voicing, octave, quality). Settings persist via localStorage
- **Delete button (×)** - Remove from progression
- **Drag handle** - Reorder chords within progression

### Scale Filter (✅ Implemented)

```
[Key & Scale] (Popover with settings)

Key:  [C      ▼]    Mode: [Major ▼]

☑ Lock to scale
  Grays out non-scale options in chord builder

☑ Respect scale when randomizing
  Constrains chord block randomization to scale notes

[Clear Scale]
```

When enabled:

- Highlights in-scale roots and qualities
- Grays out non-scale options (still usable - "Freedom First" philosophy)
- Randomize button respects scale constraints when toggled

## Core Requirements

### Must Have (MVP)

- **Chord Builder**: Three-row interface where users select root → quality → preview/add
- **Progression Canvas**: 4 slots that accept dragged chords
- **Chord Blocks**: Display chord name, have invert/randomize/delete controls, show tooltip on hover
- **Audio Preview**: Individual chords and full progression playback
- **MIDI Export**: Download working .mid file with correct notes
- **State Management**: Track selected chord, progression, and optional scale filter

### Nice to Have (MVP)

- **Scale Filter**: Optional dropdown to select key/mode, with "lock to scale" toggle
- **Visual Feedback**: Grayed out non-scale options when filter enabled

### Implementation Notes

- Use the data structures and music theory functions defined above
- Follow the UX patterns for three-click builder and drag-drop
- Audio must work cross-browser (handle Tone.js context initialization)
- MIDI export should spread chords over 4 bars at whole note duration

## Example Implementation Patterns

### Drag and Drop Pattern

Example using HTML5 drag-and-drop API:

```svelte
<!-- In ChordBuilder.svelte -->
<div
	draggable="true"
	ondragstart={(e) => {
		e.dataTransfer.setData('application/json', JSON.stringify(chord));
	}}
>
	{getChordName(chord)}
</div>

<!-- In ChordProgression.svelte -->
<div
	ondrop={(e) => {
		const chord = JSON.parse(e.dataTransfer.getData('application/json'));
		addToProgression(chord);
	}}
	ondragover={(e) => e.preventDefault()}
>
	<!-- Drop zone -->
</div>
```

### Audio Preview Pattern

Example using Tone.js PolySynth:

```typescript
import * as Tone from 'tone';

const synth = new Tone.PolySynth().toDestination();

function playChord(notes: number[]) {
	const noteNames = notes.map((n) => Tone.Frequency(n, 'midi').toNote());
	synth.triggerAttackRelease(noteNames, '4n');
}
```

**Important**: Call `await Tone.start()` on first user gesture to initialize audio context.

### MIDI Export Pattern

Example using midi-writer-js:

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

	// Trigger download
	const a = document.createElement('a');
	a.href = url;
	a.download = 'chord-progression.mid';
	a.click();
}
```

## Testing

### ✅ Test Suite (330+ tests)

- **Theory Engine**: 102 tests (inversions, voicings, chord-operations, display)
- **State Management**: 91 tests (progression store with palette management and randomize options)
- **Audio Playback**: 16 tests (Tone.js integration with mocks)
- **Scale Helper**: 25 tests (scale filtering utilities)
- **MIDI Output**: 22 tests (Web MIDI API wrapper)
- **MIDI Clock**: 23 tests (clock sync + transport messages)
- **MIDI Settings**: 11 tests (localStorage persistence)
- **MIDI Clock Settings**: 11 tests (clock settings localStorage)
- **Piano Settings**: 7 tests (piano keyboard visibility persistence)
- **Progression Persistence**: 22 tests (IndexedDB save/load/delete/filter)

**Run tests:**

- `bun run test` - Run all tests once (CI mode)
- `bun run test:watch` - Watch mode
- `bun run test:ui` - Interactive UI

**Note**: Always use `bun run test` (not `bun test`), as `bun test` uses Bun's built-in test runner which doesn't process Svelte files correctly.

### Integration Testing Checklist

**Chord Builder:**

- [x] Can build any chord (all 12 roots × 37 qualities)
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
- [x] Palette chords can be dragged to progression
- [x] Palette chords can be reordered
- [x] Palette play button previews audio
- [x] Palette delete button removes chords
- [x] Empty palette shows helpful instructions

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
- [x] Help modal opens and displays all sections
- [x] Modal can be dismissed and reopened

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
- [x] 3-column layout on desktop (Builder + Progression | Palette)
- [ ] MIDI file tested in DAW with correct notes
- [ ] Browser compatibility tested (Chrome, Firefox, Safari)

## Future Enhancements (Post-MVP)

- ~~Extended chords (9th, 11th, 13th, alterations)~~ ✅ Already implemented (37 total chords)
- ~~Tempo control for playback~~ ✅ Implemented via DAW sync (MIDI Clock)
- ~~Piano keyboard visualization~~ ✅ Implemented with active note display
- ~~Save/load progressions~~ ✅ Implemented with IndexedDB, names, and tags
- More voicing presets beyond current 5
- Multiple progression slots (verse, chorus, bridge)
- Share via URL
- AI chord suggestions
- Rhythm patterns
