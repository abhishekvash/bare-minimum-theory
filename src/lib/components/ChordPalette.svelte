<script lang="ts">
	import {
		progressionState,
		removeFromPalette,
		addToPalette,
		moveInPalette,
		isValidChord
	} from '$lib/stores/progression.svelte';
	import * as Collapsible from '$lib/components/ui/collapsible';
	import PaletteChord from './PaletteChord.svelte';
	import SavedProgressions from './SavedProgressions.svelte';
	import { playChord } from '$lib/utils/audio-playback';
	import { getChordNotes } from '$lib/utils/theory-engine/chord-operations';
	import type { Chord } from '$lib/utils/theory-engine/types';
	import type { SavedProgression } from '$lib/utils/progression-persistence';
	import { Heart, ChevronDown } from 'lucide-svelte';

	interface Props {
		onLoadProgression?: (progression: SavedProgression) => void;
		onDeleteProgression?: (id: string) => void;
		onExportProgression?: (progression: SavedProgression) => void;
	}

	let { onLoadProgression, onDeleteProgression, onExportProgression }: Props = $props();

	// Collapsible state
	let paletteOpen = $state(true);
	let savedOpen = $state(true);

	// Palette drag-drop state
	let draggedIndex = $state<number | null>(null);
	let dropTargetIndex = $state<number | null>(null);

	// Derived counts
	let paletteCount = $derived(progressionState.palette.length);
	let savedCount = $derived(progressionState.savedProgressions.items.length);

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

<div class="space-y-4 min-h-full flex flex-col lg:pr-3">
	<!-- Palette Section -->
	<Collapsible.Root bind:open={paletteOpen} class="space-y-2">
		<Collapsible.Trigger
			class="flex w-full items-center justify-between py-1 text-left cursor-pointer hover:opacity-80 transition-opacity"
		>
			<div class="flex items-center gap-2">
				<h2 class="text-base font-semibold tracking-tight">Palette</h2>
				{#if paletteCount > 0}
					<span
						class="inline-flex items-center justify-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium"
					>
						{paletteCount}
					</span>
				{/if}
			</div>
			<ChevronDown
				class="size-4 text-muted-foreground transition-transform duration-200 {paletteOpen
					? 'rotate-180'
					: ''}"
			/>
		</Collapsible.Trigger>

		<Collapsible.Content>
			<p class="text-xs text-muted-foreground mb-3">Save ideas for later.</p>

			<div
				class="space-y-2"
				ondragover={handleDragOver}
				ondrop={handleDrop}
				role="region"
				aria-label="Chord Palette Drop Zone"
			>
				{#if progressionState.palette.length === 0}
					<div
						class="rounded-lg border-2 border-dashed border-border/40 bg-muted/20 py-12 px-6 text-center transition-colors hover:border-border/60"
					>
						<p class="text-sm font-medium text-muted-foreground mb-1">Nothing saved yet</p>
						<p class="text-xs text-muted-foreground">Drag chords here to collect ideas</p>
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
		</Collapsible.Content>
	</Collapsible.Root>

	<!-- Saved Progressions Section -->
	<Collapsible.Root bind:open={savedOpen} class="space-y-2 flex-1 flex flex-col">
		<Collapsible.Trigger
			class="flex w-full items-center justify-between py-1 text-left cursor-pointer hover:opacity-80 transition-opacity"
		>
			<div class="flex items-center gap-2">
				<h2 class="text-base font-semibold tracking-tight">Saved</h2>
				{#if savedCount > 0}
					<span
						class="inline-flex items-center justify-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium"
					>
						{savedCount}
					</span>
				{/if}
			</div>
			<ChevronDown
				class="size-4 text-muted-foreground transition-transform duration-200 {savedOpen
					? 'rotate-180'
					: ''}"
			/>
		</Collapsible.Trigger>

		<Collapsible.Content class="flex-1">
			<SavedProgressions
				progressions={progressionState.savedProgressions.items}
				onLoad={onLoadProgression}
				onDelete={onDeleteProgression}
				onExport={onExportProgression}
			/>
		</Collapsible.Content>
	</Collapsible.Root>

	<!-- Footer -->
	<div
		class="pt-4 mt-auto border-t text-center text-xs text-muted-foreground flex items-center justify-center gap-1"
	>
		Made with <Heart class="size-3 fill-current" /> by
		<a
			href="https://github.com/abhishekvash"
			target="_blank"
			rel="noopener noreferrer"
			class="hover:text-foreground transition-colors underline underline-offset-4">abhishekvash</a
		>
	</div>
</div>
