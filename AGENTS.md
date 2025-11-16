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
The application is fully functional with 195 passing tests.

## Project Overview

**Core Philosophy**: Freedom First - all music theory constraints (scales, modes) are opt-in helpers, not enforced. Users can make any chord progression - "beautiful blunders through blind discovery."

**MVP Features** (All Implemented ✅):

- ✅ Three-click chord builder (Root → Quality → Result)
- ✅ Optional scale filter (highlights/filters chords in selected scale)
- ✅ Progression canvas (drag chords into 4 slots, reorder by dragging)
- ✅ In-block controls (inversion/voicing dropdowns, octave transpose, randomize, delete)
- ✅ Audio preview (individual preview + looping playback at 120 BPM)
- ✅ MIDI export (download as .mid file)

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
│   └── +page.svelte                    # Main app
├── lib/
│   ├── components/
│   │   ├── ChordBuilder.svelte          # ✅ 2-row builder
│   │   ├── DraggableChordButton.svelte  # ✅ Quality button with drag
│   │   ├── ChordProgression.svelte      # ✅ Canvas with slots
│   │   ├── ChordBlock.svelte            # ✅ Individual chord block
│   │   └── ScaleFilter.svelte           # ✅ Optional scale selector
│   ├── stores/
│   │   └── progression.svelte.ts        # ✅ Global state (runes)
│   └── utils/
│       ├── theory-engine/
│       │   ├── index.ts                 # Barrel export
│       │   ├── types.ts                 # Type definitions
│       │   ├── constants.ts             # NOTE_NAMES + QUALITIES + QUALITY_ORDER
│       │   ├── inversions.ts            # Inversion logic
│       │   ├── voicings.ts              # Voicing presets
│       │   ├── chord-operations.ts      # getChordNotes pipeline
│       │   └── display.ts               # Display helpers
│       ├── midi-export.ts               # ✅ MIDI generation
│       ├── audio-playback.ts            # ✅ Tone.js audio with looping
│       └── scale-helper.ts              # ✅ Scale filtering utilities
├── tests/
│   ├── theory-engine/
│   │   ├── inversions.test.ts           # 14 tests
│   │   ├── voicings.test.ts             # 25 tests
│   │   ├── chord-operations.test.ts     # 27 tests
│   │   └── display.test.ts              # 35 tests
│   ├── stores/
│   │   └── progression.svelte.test.ts   # 51 tests
│   └── utils/
│       ├── audio-playback.test.ts       # 13 tests (Tone.js mocks)
│       └── scale-helper.test.ts         # 30 tests
```

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
	builderState: {
		selectedRoot: null as number | null,
		selectedQuality: null as keyof typeof QUALITIES | null
	},
	progression: [] as Chord[]
});
```

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

- ✅ 4 drop zones for chords
- ✅ Horizontal timeline layout with smooth drag-and-drop
- ✅ Reorder chords by dragging blocks
- ✅ Each block has comprehensive controls:
  - **Inversion dropdown** - Select from available inversions (Root, 1st, 2nd, etc.)
  - **Voicing dropdown** - Choose preset (Close, Open, Drop 2, Drop 3)
  - **Octave controls** - Transpose up/down (±2 octaves)
  - **Randomize button** - Randomize quality, inversion, and voicing
  - **Delete button** - Remove from progression
  - **Drag handle** - Visual indicator for reordering
- ✅ Play button: loop through progression at 120 BPM
- ✅ Stop button: halt playback
- ✅ Export button: download as .mid file
- ✅ Empty state with helpful instructions

### Scale Filter (✅ Implemented)

- ✅ Popover UI with clean layout
- ✅ Key selector: All 12 chromatic notes
- ✅ Mode selector: 8 modes (Major, Minor, Dorian, Phrygian, Lydian, Mixolydian, Aeolian, Locrian)
- ✅ "Lock to scale" toggle: Grays out non-scale options in chord builder
- ✅ "Respect scale when randomizing" toggle: Constrains randomization to scale notes
- ✅ Clear scale button: Reset all filter settings
- ✅ Visual feedback: Shows selected key/mode in button
- ✅ "Freedom First" philosophy: Grayed options remain usable

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

- [x] Build any chord (12 roots × 37 qualities)
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

- Music theory engine (37 chord qualities, inversions, voicings)
- State management with Svelte 5 runes
- Research-backed chord ordering (QUALITY_ORDER)
- Type definitions and barrel exports
- Comprehensive test suite (195 tests)

**UI Components:**

- Chord builder UI (clean, mobile-first 2-row design)
- DraggableChordButton component (drag support with custom preview)
- ChordProgression canvas (4 slots, drag-to-reorder, visual feedback)
- ChordBlock component (inversion/voicing/octave controls, randomize, delete)
- ScaleFilter UI (key/mode selection, lock options)
- Main app layout (+page.svelte)

**Audio & Export:**

- Audio playback integration (Tone.js with instant preview)
- Looping playback for full progression
- MIDI export functionality (downloadable .mid files)

**Scale Filtering:**

- Scale helper utilities (diatonic chord detection)
- Visual highlighting of in-scale vs out-of-scale options
- Optional constraints for randomization

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
- ✅ 195 tests (101 theory + 51 store + 13 audio + 30 scale)
- ✅ Build any chord manually (12 roots × 37 qualities)
- ✅ Preview individual chords with audio (auto-preview on click)
- ✅ Drag chords with custom preview (shows full chord name)
- ✅ Progression canvas (4 drop zones)
- ✅ Chord blocks with controls (inversion/voicing/octave/randomize/delete)
- ✅ Play full progression (with looping)
- ✅ Stop playback
- ✅ Export working MIDI file
- ✅ Scale filter works (optional feature with lock toggles)
- ✅ Reorder chords by dragging blocks
- ✅ Randomize respects scale when toggled

### 🧪 Testing Phase (In Progress)

- ⬜ Manual browser testing
- ⬜ MIDI file validation in DAW (e.g., Ableton, Logic, FL Studio)
- ⬜ Cross-browser testing (Chrome, Firefox, Safari)
- ⬜ Mobile responsive testing
- ⬜ Tablet responsive testing
- ⬜ Audio playback on different devices
- ⬜ Edge case testing (empty progressions, extreme octaves, etc.)
