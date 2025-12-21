<script lang="ts">
	import {
		progressionState,
		PIANO_RANGE_START,
		PIANO_RANGE_END
	} from '$lib/stores/progression.svelte';

	// Piano key layout constants
	// White keys: C, D, E, F, G, A, B (indices 0, 2, 4, 5, 7, 9, 11 in octave)
	// Black keys: C#, D#, F#, G#, A# (indices 1, 3, 6, 8, 10 in octave)
	const WHITE_KEY_INDICES = [0, 2, 4, 5, 7, 9, 11];
	const BLACK_KEY_INDICES = [1, 3, 6, 8, 10];

	// Generate white keys for 2 octaves (C3 to B4)
	// MIDI: C3=48, C4=60, C5=72, so octave 4 gives MIDI 48-59, octave 5 gives 60-71
	// We have 14 white keys total (7 per octave × 2 octaves)
	const whiteKeys = $derived.by(() => {
		const keys: { midi: number; octave: number; noteIndex: number }[] = [];
		for (let octave = 4; octave <= 5; octave++) {
			for (const noteIndex of WHITE_KEY_INDICES) {
				const midi = octave * 12 + noteIndex;
				if (midi >= PIANO_RANGE_START && midi <= PIANO_RANGE_END) {
					keys.push({ midi, octave, noteIndex });
				}
			}
		}
		return keys;
	});

	// Generate black keys with their positions
	// Position is calculated as percentage from left edge
	const blackKeys = $derived.by(() => {
		const keys: { midi: number; position: number }[] = [];
		const whiteKeyWidth = 100 / 14; // 14 white keys

		for (let octave = 4; octave <= 5; octave++) {
			const octaveOffset = (octave - 4) * 7; // 7 white keys per octave

			for (const noteIndex of BLACK_KEY_INDICES) {
				const midi = octave * 12 + noteIndex;
				if (midi >= PIANO_RANGE_START && midi <= PIANO_RANGE_END) {
					// Calculate position based on which white key this black key follows
					// Black keys sit between white keys at specific positions
					let whiteKeyIndex: number;
					if (noteIndex === 1) whiteKeyIndex = 0; // C# after C
					else if (noteIndex === 3) whiteKeyIndex = 1; // D# after D
					else if (noteIndex === 6) whiteKeyIndex = 3; // F# after F
					else if (noteIndex === 8) whiteKeyIndex = 4; // G# after G
					else whiteKeyIndex = 5; // A# after A (noteIndex === 10)

					const position = (octaveOffset + whiteKeyIndex + 1) * whiteKeyWidth;
					keys.push({ midi, position });
				}
			}
		}
		return keys;
	});

	// Derived state for active notes
	const activeNotes = $derived(new Set(progressionState.pianoKeyboard.activeNotes));
	const hasNotesBelowRange = $derived(progressionState.pianoKeyboard.hasNotesBelowRange);
	const hasNotesAboveRange = $derived(progressionState.pianoKeyboard.hasNotesAboveRange);

	function isNoteActive(midi: number): boolean {
		return activeNotes.has(midi);
	}
</script>

<div class="piano-container">
	<!-- Left range indicator (notes below C3) -->
	{#if hasNotesBelowRange}
		<div class="range-indicator range-indicator-left" aria-label="Notes playing below visible range">
		</div>
	{/if}

	<div class="piano-keyboard">
		<!-- White keys layer -->
		<div class="white-keys">
			{#each whiteKeys as key (key.midi)}
				<div
					class="white-key"
					data-midi={key.midi}
				>
					{#if isNoteActive(key.midi)}
						<span class="active-dot"></span>
					{/if}
				</div>
			{/each}
		</div>

		<!-- Black keys layer (absolutely positioned) -->
		<div class="black-keys">
			{#each blackKeys as key (key.midi)}
				<div
					class="black-key"
					style="left: {key.position}%"
					data-midi={key.midi}
				>
					{#if isNoteActive(key.midi)}
						<span class="active-dot active-dot-black"></span>
					{/if}
				</div>
			{/each}
		</div>
	</div>

	<!-- Right range indicator (notes above B4) -->
	{#if hasNotesAboveRange}
		<div
			class="range-indicator range-indicator-right"
			aria-label="Notes playing above visible range"
		></div>
	{/if}
</div>

<style>
	.piano-container {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 0.75rem;
		background: color-mix(in oklch, var(--card) 50%, transparent);
		border: 1px solid var(--border);
		border-radius: var(--radius);
	}

	.piano-keyboard {
		position: relative;
		display: flex;
		height: 80px;
		width: 100%;
		max-width: 560px;
	}

	.white-keys {
		display: flex;
		height: 100%;
		width: 100%;
		gap: 2px;
	}

	.white-key {
		flex: 1;
		background: var(--background);
		border: 1px solid var(--border);
		border-radius: 0 0 var(--radius-sm) var(--radius-sm);
		display: flex;
		align-items: flex-end;
		justify-content: center;
		padding-bottom: 6px;
	}

	.black-keys {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 55%;
		pointer-events: none;
	}

	.black-key {
		position: absolute;
		width: 5%;
		height: 100%;
		background: var(--foreground);
		border-radius: 0 0 var(--radius-sm) var(--radius-sm);
		transform: translateX(-50%);
		display: flex;
		align-items: flex-end;
		justify-content: center;
		padding-bottom: 4px;
	}

	.active-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--primary);
		box-shadow: 0 0 8px var(--primary);
		animation: dot-pulse 0.3s ease-out;
	}

	.active-dot-black {
		width: 6px;
		height: 6px;
		background: var(--background);
		box-shadow: 0 0 6px var(--background);
	}

	@keyframes dot-pulse {
		0% {
			transform: scale(0);
			opacity: 0;
		}
		50% {
			transform: scale(1.2);
		}
		100% {
			transform: scale(1);
			opacity: 1;
		}
	}

	.range-indicator {
		width: 6px;
		height: 50px;
		background: var(--primary);
		border-radius: var(--radius-sm);
		animation: pulse 0.6s ease-in-out infinite;
		flex-shrink: 0;
	}

	.range-indicator-left {
		margin-right: 0.25rem;
	}

	.range-indicator-right {
		margin-left: 0.25rem;
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 0.4;
		}
		50% {
			opacity: 1;
		}
	}

	/* Responsive adjustments */
	@media (max-width: 640px) {
		.piano-keyboard {
			height: 60px;
		}

		.range-indicator {
			height: 40px;
			width: 5px;
		}
	}
</style>
