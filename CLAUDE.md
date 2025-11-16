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

## 🎉 Project Status: MVP Feature Complete!

All core MVP features have been implemented and are ready for testing. The application is fully functional with 195 passing tests.

## MVP Features

1. ✅ **Three-click chord builder** - Root → Quality → Result
2. ✅ **Optional scale filter** - Highlights/filters chords in selected scale
3. ✅ **Progression canvas** - Drag chords into 4 slots
4. ✅ **In-block controls** - Inversion/voicing dropdowns, octave transpose, randomize, delete
5. ✅ **Audio preview** - Individual chord preview + looping progression playback at 120 BPM
6. ✅ **MIDI export** - Download as .mid file

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
│   └── +page.svelte                    # Main app layout
├── lib/
│   ├── components/
│   │   ├── ChordBuilder.svelte          # ✅ Two-row builder (Root → Quality)
│   │   ├── DraggableChordButton.svelte  # ✅ Quality button with drag support
│   │   ├── ChordProgression.svelte      # ✅ Canvas with 4 slots + controls
│   │   ├── ChordBlock.svelte            # ✅ Individual chord in progression
│   │   └── ScaleFilter.svelte           # ✅ Optional scale selector UI
│   ├── stores/
│   │   └── progression.svelte.ts        # ✅ Global state using runes
│   └── utils/
│       ├── theory-engine/               # ✅ IMPLEMENTED
│       │   ├── index.ts                 # Barrel export
│       │   ├── types.ts                 # Type definitions
│       │   ├── constants.ts             # NOTE_NAMES + QUALITIES + QUALITY_ORDER
│       │   ├── inversions.ts            # applyInversion function
│       │   ├── voicings.ts              # VOICING_PRESETS
│       │   ├── chord-operations.ts      # getChordNotes pipeline
│       │   └── display.ts               # getChordName + getChordTooltip
│       ├── midi-export.ts               # ✅ MIDI file generation
│       ├── audio-playback.ts            # ✅ Tone.js audio preview with looping
│       └── scale-helper.ts              # ✅ Scale filtering utilities
├── tests/                               # ✅ IMPLEMENTED
│   ├── theory-engine/
│   │   ├── inversions.test.ts           # 14 tests
│   │   ├── voicings.test.ts             # 25 tests
│   │   ├── chord-operations.test.ts     # 27 tests
│   │   └── display.test.ts              # 35 tests
│   ├── stores/
│   │   └── progression.svelte.test.ts   # 51 tests
│   └── utils/
│       ├── audio-playback.test.ts       # 13 tests
│       └── scale-helper.test.ts         # 30 tests
```

## State Management

Use Svelte 5 runes for reactive state:

```typescript
// lib/stores/progression.svelte.ts
export const progressionState = $state({
	scale: null as { key: string; mode: string } | null,
	scaleFilterEnabled: false,
	builderState: {
		selectedRoot: null as number | null,
		selectedQuality: null as keyof typeof QUALITIES | null
	},
	progression: [] as Chord[]
});
```

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

```
┌─ Your Progression ──────────────────────────────────┐
│ [Play] [Stop] [Export MIDI]                         │
│                                                      │
│ ┌─────────┐ ┌─────────┐ ┌────────┐ [____]          │
│ │  Cmaj7  │ │   Am    │ │  Fmaj  │        │         │
│ │ Inv:Root│ │Inv: 1st │ │Inv:Root│        │         │
│ │Voi:Close│ │Voi:Drop2│ │Voi:Open│        │         │
│ │Oct: +1  │ │Oct:  0  │ │Oct: -1 │        │         │
│ │[Random] │ │[Random] │ │[Random]│        │         │
│ │   [×]   │ │   [×]   │ │   [×]  │        │         │
│ └─────────┘ └─────────┘ └────────┘        │         │
└──────────────────────────────────────────────────────┘
```

**Block controls (✅ All implemented):**

- **Inversion dropdown** - Select from available inversions (Root, 1st, 2nd, etc.)
- **Voicing dropdown** - Choose preset (Close, Open, Drop 2, Drop 3)
- **Octave controls** - Transpose up/down (±2 octaves)
- **Randomize button** - Randomize quality, inversion, and voicing
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

### ✅ Test Suite (195 tests)

- **Theory Engine**: 101 tests (inversions, voicings, chord-operations, display)
- **State Management**: 51 tests (progression store)
- **Audio Playback**: 13 tests (Tone.js integration with mocks)
- **Scale Helper**: 30 tests (scale filtering utilities)

**Run tests:**

- `bun run test` - Run all tests once (CI mode)
- `bun run test:watch` - Watch mode
- `bun run test:ui` - Interactive UI

**Note**: Always use `bun run test` (not `bun test`), as `bun test` uses Bun's built-in test runner which doesn't process Svelte files correctly.

### Integration Testing Checklist

- [x] Can build any chord (all 12 roots × 37 qualities)
- [x] Audio preview plays correct notes (auto-preview on quality click)
- [x] Drag and drop works with custom preview (shows full chord name)
- [x] Mobile-first responsive design
- [x] Inversion dropdown with dynamic options
- [x] Voicing dropdown with 4 presets
- [x] Octave transpose controls (±2 octaves)
- [x] Randomize button (quality, inversion, voicing)
- [x] Scale filter with key/mode selection
- [x] Lock to scale option (grays out non-scale chords)
- [x] Randomize within scale option
- [x] Reorder chords by dragging blocks
- [x] Play progression with looping
- [x] Stop playback
- [x] MIDI export functionality
- [ ] MIDI file tested in DAW with correct notes
- [ ] Browser compatibility tested (Chrome, Firefox, Safari)

## Future Enhancements (Post-MVP)

- ~~Extended chords (9th, 11th, 13th, alterations)~~ ✅ Already implemented (37 total chords)
- More voicing presets beyond current 5
- Tempo control for playback
- Multiple progression slots (verse, chorus, bridge)
- Save/load progressions
- Share via URL
- AI chord suggestions
- Rhythm patterns
