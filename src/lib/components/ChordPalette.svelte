<script lang="ts">
	import {
		progressionState,
		removeFromPalette,
		addToPalette,
		moveInPalette,
		isValidChord
	} from '$lib/stores/progression.svelte';
	import PaletteChord from './PaletteChord.svelte';
	import { playChord } from '$lib/utils/audio-playback';
	import { getChordNotes } from '$lib/utils/theory-engine/chord-operations';
	import type { Chord } from '$lib/utils/theory-engine/types';

	let draggedIndex = $state<number | null>(null);
	let dropTargetIndex = $state<number | null>(null);

	function handleDelete(index: number) {
		removeFromPalette(index);
	}

	async function handlePlay(chord: Chord) {
		const notes = getChordNotes(chord);
		await playChord(notes);
	}

	function handleDragStart(index: number) {
		draggedIndex = index;
	}

	function handleDragEnd() {
		draggedIndex = null;
		dropTargetIndex = null;
	}

	function handleDragOver(event: DragEvent) {
		event.preventDefault();
		if (event.dataTransfer) {
			// Check if this is a palette reorder or external drag
			const isPaletteReorder = event.dataTransfer.types.includes('palette-chord');
			event.dataTransfer.dropEffect = isPaletteReorder ? 'move' : 'copy';
		}
	}

	function handleDrop(event: DragEvent) {
		event.preventDefault();

		// Check if this is a palette reorder
		if (event.dataTransfer?.types.includes('palette-chord')) {
			// Reordering is handled by individual PaletteChord drop zones
			return;
		}

		// Handle external drops (from builder)
		if (event.dataTransfer?.types.includes('application/json')) {
			const jsonPayload = event.dataTransfer.getData('application/json');
			try {
				const chord = JSON.parse(jsonPayload);
				if (isValidChord(chord)) {
					addToPalette(chord);
				}
			} catch {
				// Silently ignore invalid data
			}
		}
	}

	function handleDropOnChord(targetIndex: number) {
		if (draggedIndex !== null && draggedIndex !== targetIndex) {
			moveInPalette(draggedIndex, targetIndex);
		}
		draggedIndex = null;
		dropTargetIndex = null;
	}

	function handleDragEnterChord(targetIndex: number) {
		if (draggedIndex !== null && draggedIndex !== targetIndex) {
			dropTargetIndex = targetIndex;
		}
	}

	function handleDragLeaveChord() {
		dropTargetIndex = null;
	}
</script>

<div
	class="space-y-4 min-h-full flex flex-col"
	ondragover={handleDragOver}
	ondrop={handleDrop}
	role="region"
	aria-label="Chord Palette Drop Zone"
>
	<div>
		<h2 class="text-base font-semibold tracking-tight mb-1">Palette</h2>
		<p class="text-xs text-muted-foreground">Save ideas for later.</p>
	</div>

	<div class="space-y-2 flex-1">
		{#if progressionState.palette.length === 0}
			<div
				class="rounded-lg border-2 border-dashed border-border/40 bg-muted/20 py-16 px-8 text-center transition-colors hover:border-border/60"
			>
				<p class="text-sm font-medium text-muted-foreground mb-2">Nothing saved yet</p>
				<p class="text-xs text-muted-foreground max-w-[200px] mx-auto">
					Drag chords here to collect ideas
				</p>
			</div>
		{:else}
			<div class="space-y-2">
				{#each progressionState.palette as chord, index (`${chord.root}-${chord.quality}-${index}`)}
					<PaletteChord
						{chord}
						{index}
						isBeingDragged={draggedIndex === index}
						isDropTarget={dropTargetIndex === index}
						onDelete={handleDelete}
						onPlay={handlePlay}
						onDragStart={handleDragStart}
						onDragEnd={handleDragEnd}
						onDrop={handleDropOnChord}
						onDragEnter={handleDragEnterChord}
						onDragLeave={handleDragLeaveChord}
					/>
				{/each}
			</div>
		{/if}
	</div>
</div>
