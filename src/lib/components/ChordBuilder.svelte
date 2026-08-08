<script lang="ts">
	import {
		createCandidateChord,
		progressionState,
		selectRoot
	} from '$lib/stores/progression.svelte';
	import { stageCandidate, uiState } from '$lib/stores/ui.svelte';
	import { NOTE_NAMES } from '$lib/utils/theory-engine/constants';
	import type { Chord } from '$lib/utils/theory-engine/types';
	import { auditionChord, resolveTargetSlot } from '$lib/utils/audition-controller';
	import { getScaleNotes, isRootInScale } from '$lib/utils/scale-helper';
	import { Button } from '$lib/components/ui/button';
	import QualityField from './QualityField.svelte';
	import ReadyBar from './ReadyBar.svelte';
	import ScaleFilter from './ScaleFilter.svelte';
	import { UI_OPACITY } from '$lib/constants';
	import { cn } from '$lib/utils';

	const scaleNotes = $derived(
		progressionState.scale
			? getScaleNotes(progressionState.scale.key, progressionState.scale.mode)
			: []
	);

	// Browsing the builder is the chained-preview path: the controller leads with the chord that
	// precedes the target slot, and stays silent while the loop owns the sound.
	function handleRootSelect(rootMidi: number) {
		selectRoot(rootMidi);

		// Play preview if a quality is already selected
		const quality = progressionState.builderState.selectedQuality;
		if (quality === null) return;

		const targetSlot = resolveTargetSlot();
		const chord: Chord = createCandidateChord(rootMidi, quality, targetSlot);
		if (uiState.transportActive) {
			if (uiState.selectedSlot !== null) stageCandidate(uiState.selectedSlot, chord);
			return;
		}

		auditionChord(chord, { mode: 'click', targetSlot });
	}
</script>

<div class="space-y-4">
	<div class="flex items-center justify-between mb-1">
		<h2 class="text-base font-semibold tracking-tight">Chord Builder</h2>
		<ScaleFilter />
	</div>

	<div class="space-y-2">
		<div class="flex items-baseline justify-between">
			<h3 class="text-sm font-medium text-muted-foreground">Root</h3>
		</div>
		<div class="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-12 gap-2">
			{#each NOTE_NAMES as note, index (note)}
				{@const midiNote = 60 + index}
				{@const inScale = isRootInScale(midiNote, scaleNotes)}
				{@const shouldGrayOut = progressionState.scaleFilterEnabled && !inScale}
				<Button
					variant={progressionState.builderState.selectedRoot === midiNote ? 'default' : 'outline'}
					class={cn(
						'h-11 sm:h-10 transition-all hover:scale-[1.02]',
						progressionState.builderState.selectedRoot === midiNote && 'glow-subtle',
						shouldGrayOut && UI_OPACITY.OUT_OF_SCALE
					)}
					data-root={midiNote}
					onclick={() => handleRootSelect(midiNote)}
				>
					{note}
				</Button>
			{/each}
		</div>
	</div>

	<QualityField {scaleNotes} />
	<ReadyBar />
</div>
