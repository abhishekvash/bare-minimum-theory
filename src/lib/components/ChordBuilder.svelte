<script lang="ts">
	import { progressionState, selectRoot, selectQuality } from '$lib/stores/progression.svelte';
	import { NOTE_NAMES, QUALITY_ORDER } from '$lib/utils/theory-engine/constants';
	import { getChordNotes } from '$lib/utils/theory-engine/chord-operations';
	import type { Chord, ChordQuality } from '$lib/utils/theory-engine/types';
	import { playChord } from '$lib/utils/audio-playback';
	import { getScaleNotes, isRootInScale, isQualityValidForScaleDegree } from '$lib/utils/scale-helper';
	import { Button } from '$lib/components/ui/button';
	import DraggableChordButton from './DraggableChordButton.svelte';
	import { UI_OPACITY } from '$lib/constants';
	import { cn } from '$lib/utils';

	const scaleNotes = $derived(
		progressionState.scale
			? getScaleNotes(progressionState.scale.key, progressionState.scale.mode)
			: []
	);

	function handleRootSelect(rootMidi: number) {
		selectRoot(rootMidi);
	}

	async function handleQualitySelect(quality: ChordQuality) {
		selectQuality(quality);

		if (progressionState.builderState.selectedRoot !== null) {
			const chord: Chord = {
				root: progressionState.builderState.selectedRoot,
				quality: quality,
				inversion: 0,
				voicing: 'close',
				octave: 0
			};
			const notes = getChordNotes(chord);
			await playChord(notes);
		}
	}

</script>

<div class="space-y-4">
	<div class="space-y-2">
		<div class="flex items-baseline justify-between">
			<h3 class="text-sm font-medium text-muted-foreground">Step 1: Pick a Root Note</h3>
		</div>
		<div class="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-12 gap-2">
			{#each NOTE_NAMES as note, index}
				{@const midiNote = 60 + index}
				{@const inScale = isRootInScale(midiNote, scaleNotes)}
				{@const shouldGrayOut = progressionState.scaleFilterEnabled && !inScale}
				<Button
					variant={progressionState.builderState.selectedRoot === midiNote ? 'default' : 'outline'}
					class={cn('h-11 sm:h-10', shouldGrayOut && UI_OPACITY.OUT_OF_SCALE)}
					onclick={() => handleRootSelect(midiNote)}
				>
					{note}
				</Button>
			{/each}
		</div>
	</div>

	<div class="space-y-2">
		<div class="flex items-baseline justify-between">
			<h3 class="text-sm font-medium text-muted-foreground">Step 2: Choose a Quality</h3>
			<p class="text-xs text-muted-foreground/60">Click to hear it • Drag down to add</p>
		</div>
		<div class="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2 max-h-60 overflow-y-auto">
			{#each QUALITY_ORDER as quality}
				{@const inScale = progressionState.builderState.selectedRoot !== null
					? isQualityValidForScaleDegree(progressionState.builderState.selectedRoot, quality as ChordQuality, scaleNotes)
					: true}
				{@const shouldShow = !progressionState.scaleFilterEnabled || inScale}
				<DraggableChordButton
					quality={quality as ChordQuality}
					root={progressionState.builderState.selectedRoot}
					isSelected={progressionState.builderState.selectedQuality === quality}
					isInScale={shouldShow}
					onclick={() => handleQualitySelect(quality as ChordQuality)}
				/>
			{/each}
		</div>
	</div>
</div>
