<script lang="ts">
	import {
		progressionState,
		removeFromPalette,
		addToPalette,
		moveInPalette
	} from '$lib/stores/progression.svelte';
	import PaletteChord from './PaletteChord.svelte';
	import { playChord } from '$lib/utils/audio-playback';
	import { getChordNotes } from '$lib/utils/theory-engine/chord-operations';
	import type { Chord } from '$lib/utils/theory-engine/types';
	import Music from 'lucide-svelte/icons/music';

	function handleDelete(index: number) {
		removeFromPalette(index);
	}

	async function handlePlay(chord: Chord) {
		const notes = getChordNotes(chord);
		await playChord(notes);
	}

	function handleDragOver(event: DragEvent) {
		event.preventDefault();
		if (event.dataTransfer) {
			event.dataTransfer.dropEffect = 'copy';
		}
	}

	function handleDrop(event: DragEvent) {
		event.preventDefault();

		// Try to get palette-chord data first (reordering)
		const palettePayload = event.dataTransfer?.getData('palette-chord');
		if (palettePayload) {
			try {
				const data = JSON.parse(palettePayload);
				// TODO: Implement reordering logic based on drop target
				// For now, we just append if dropped on the container, which effectively does nothing if it's already there
				// To implement proper reordering, we need to know which index we dropped ON.
				// Since this is the container drop handler, we'll just ignore reordering here for now
				// or implement it later if we add drop targets between items.
				return;
			} catch (error) {
				console.warn('Failed to parse palette chord data', error);
			}
		}

		// Fall back to application/json (from builder or other sources)
		const jsonPayload = event.dataTransfer?.getData('application/json');
		if (jsonPayload) {
			try {
				const chord = JSON.parse(jsonPayload);
				// Validate it looks like a chord
				if (chord && typeof chord.root === 'number' && typeof chord.quality === 'string') {
					addToPalette(chord);
				}
			} catch (error) {
				console.warn('Failed to parse dropped chord', error);
			}
		}
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
				{#each progressionState.palette as chord, index}
					<PaletteChord {chord} {index} onDelete={handleDelete} onPlay={handlePlay} />
				{/each}
			</div>
		{/if}
	</div>
</div>
