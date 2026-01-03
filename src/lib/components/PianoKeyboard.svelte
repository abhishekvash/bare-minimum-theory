<script lang="ts">
	import { progressionState, computePianoRange } from '$lib/stores/progression.svelte';
	import { settingsState } from '$lib/stores/settings.svelte';

	// Piano key layout constants
	// White keys: C, D, E, F, G, A, B (indices 0, 2, 4, 5, 7, 9, 11 in octave)
	// Black keys: C#, D#, F#, G#, A# (indices 1, 3, 6, 8, 10 in octave)
	const WHITE_KEY_INDICES = [0, 2, 4, 5, 7, 9, 11];
	const BLACK_KEY_INDICES = [1, 3, 6, 8, 10];

	// Compute range from ALL chords in progression (stable view during playback)
	const pianoRange = $derived(computePianoRange(progressionState.progression));

	// Calculate number of octaves and starting octave
	const numOctaves = $derived(Math.ceil((pianoRange.end - pianoRange.start + 1) / 12));
	const startOctave = $derived(Math.floor(pianoRange.start / 12));
	const numWhiteKeys = $derived(numOctaves * 7);

	// Generate white keys dynamically based on range
	const whiteKeys = $derived.by(() => {
		const keys: { midi: number; octave: number; noteIndex: number }[] = [];
		for (let octave = startOctave; octave < startOctave + numOctaves; octave++) {
			for (const noteIndex of WHITE_KEY_INDICES) {
				const midi = octave * 12 + noteIndex;
				if (midi >= pianoRange.start && midi <= pianoRange.end) {
					keys.push({ midi, octave, noteIndex });
				}
			}
		}
		return keys;
	});

	// Generate black keys with dynamic positioning
	const blackKeys = $derived.by(() => {
		const keys: { midi: number; position: number }[] = [];
		const whiteKeyWidth = 100 / numWhiteKeys;

		for (let octave = startOctave; octave < startOctave + numOctaves; octave++) {
			const octaveOffset = (octave - startOctave) * 7; // 7 white keys per octave

			for (const noteIndex of BLACK_KEY_INDICES) {
				const midi = octave * 12 + noteIndex;
				if (midi >= pianoRange.start && midi <= pianoRange.end) {
					// Calculate position based on which white key this black key follows
					// Black keys sit between white keys at specific positions
					let whiteKeyIndex: number;
					if (noteIndex === 1)
						whiteKeyIndex = 0; // C# after C
					else if (noteIndex === 3)
						whiteKeyIndex = 1; // D# after D
					else if (noteIndex === 6)
						whiteKeyIndex = 3; // F# after F
					else if (noteIndex === 8)
						whiteKeyIndex = 4; // G# after G
					else whiteKeyIndex = 5; // A# after A (noteIndex === 10)

					const position = (octaveOffset + whiteKeyIndex + 1) * whiteKeyWidth;
					keys.push({ midi, position });
				}
			}
		}
		return keys;
	});

	// Compute dynamic black key width based on number of white keys
	const blackKeyWidth = $derived((100 / numWhiteKeys) * 0.7);

	// Derived state for active notes
	const activeNotes = $derived(new Set(settingsState.pianoKeyboard.activeNotes));

	function isNoteActive(midi: number): boolean {
		return activeNotes.has(midi);
	}
</script>

<div class="piano-container">
	<div class="piano-keyboard">
		<!-- White keys layer -->
		<div class="white-keys">
			{#each whiteKeys as key (key.midi)}
				<div class="white-key" data-midi={key.midi}>
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
					style="left: {key.position}%; width: {blackKeyWidth}%"
					data-midi={key.midi}
				>
					{#if isNoteActive(key.midi)}
						<span class="active-dot active-dot-black"></span>
					{/if}
				</div>
			{/each}
		</div>
	</div>
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
		max-width: 800px;
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
		/* width is set dynamically via inline style */
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

	/* Responsive adjustments */
	@media (max-width: 640px) {
		.piano-keyboard {
			height: 60px;
		}
	}
</style>
