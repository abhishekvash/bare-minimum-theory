<script lang="ts">
	/**
	 * Chord Block
	 * A block at rest says four things and no more: name, duration, whether the chord has been
	 * shaped away from the defaults, and where the playhead is. Everything editable lives in the
	 * inspector, which opens when the block is clicked. Hovering reveals the three affordances
	 * that belong to the block itself: preview, drag, delete.
	 */

	import { IconButton } from '$lib/components/ui/icon-button';
	import { revertAudition, selectSlot, uiState } from '$lib/stores/ui.svelte';
	import { getChordName } from '$lib/utils/theory-engine/display';
	import { getChordNotes } from '$lib/utils/theory-engine/chord-operations';
	import type { Chord } from '$lib/utils/theory-engine';
	import { auditionNotes } from '$lib/utils/audition-controller';
	import {
		deleteChordFromSlot,
		formatDuration,
		isCustomizedChord
	} from '$lib/components/ChordInspector.svelte';
	import Trash2 from 'lucide-svelte/icons/trash-2';
	import GripVertical from 'lucide-svelte/icons/grip-vertical';
	import Play from 'lucide-svelte/icons/play';
	import RotateCcw from 'lucide-svelte/icons/rotate-ccw';
	import { cn } from '$lib/utils';

	interface Props {
		chord: Chord;
		index: number;
		isCurrentlyPlaying?: boolean;
		progressPercent?: number;
	}

	let { chord, index, isCurrentlyPlaying = false, progressPercent = 0 }: Props = $props();

	const chordName = $derived(getChordName(chord));
	const durationLabel = $derived(formatDuration(chord.duration));
	const isCustomized = $derived(isCustomizedChord(chord));
	const isSelected = $derived(uiState.selectedSlot === index);
	const auditionRecord = $derived(uiState.audition?.slotIndex === index ? uiState.audition : null);
	const baselineName = $derived(
		auditionRecord
			? getChordName({
					...chord,
					root: auditionRecord.baselineRoot,
					quality: auditionRecord.baselineQuality
				})
			: ''
	);

	let isDragging = $state(false);
	let isPreviewing = $state(false);

	/**
	 * Select the slot. Selection opens the inspector and previews the chord — the preview is
	 * suppressed while the loop is playing, per the audible-priority contract.
	 */
	function handleSelect() {
		const alreadySelected = uiState.selectedSlot === index;
		selectSlot(index);
		if (!alreadySelected) auditionNotes(getChordNotes(chord));
	}

	function handleDeleteChord(event: MouseEvent) {
		event.stopPropagation();
		// Deleting a chord empties its slot, leaving a rest; removing the slot is a separate action
		deleteChordFromSlot(index);
	}

	function handleRevertAudition(event: MouseEvent) {
		event.stopPropagation();
		revertAudition();
	}

	function handlePlayChord(event: MouseEvent) {
		event.stopPropagation();
		if (isPreviewing) return;

		// The sweep animation runs either way: while the loop is playing this is the visual-only
		// feedback that replaces the suppressed preview
		isPreviewing = true;
		auditionNotes(getChordNotes(chord));
		setTimeout(() => {
			isPreviewing = false;
		}, 1000);
	}

	function handleDragStart(event: DragEvent) {
		if (!event.dataTransfer) return;

		// Slot targets read `progression-chord` first and keep move/swap semantics; the chord
		// itself rides along so the palette rail can take a copy without emptying the canvas
		event.dataTransfer.effectAllowed = 'copyMove';
		event.dataTransfer.setData('progression-chord', JSON.stringify({ fromIndex: index }));
		event.dataTransfer.setData('application/json', JSON.stringify(chord));
		isDragging = true;
	}

	function handleDragEnd() {
		isDragging = false;
	}
</script>

<div
	class={cn(
		'group/block flex-1 px-3 sm:px-4 py-3 flex flex-col items-center justify-center gap-1 transition-all relative overflow-hidden rounded-lg',
		isSelected && 'ring-2 ring-inset ring-primary bg-primary/5',
		!isSelected && 'hover:bg-accent/30',
		isDragging ? 'opacity-40' : 'opacity-100'
	)}
	data-slot="chord-block"
	data-chord-index={index}
	draggable="true"
	ondragstart={handleDragStart}
	ondragend={handleDragEnd}
	role="group"
	aria-label={`${chordName} chord controls`}
>
	{#if isCurrentlyPlaying}
		<div
			class="absolute bottom-0 left-0 h-1 bg-[var(--progress)] shadow-[0_0_8px_var(--glow)]"
			style="width: {progressPercent}%"
			aria-hidden="true"
		></div>
	{/if}
	{#if isPreviewing && !isCurrentlyPlaying}
		<div
			class="absolute bottom-0 left-0 h-1 bg-[var(--progress)] shadow-[0_0_8px_var(--glow)] animate-progress-sweep"
			aria-hidden="true"
		></div>
	{/if}

	<!-- Hover affordances: drag handle on the left, preview and delete on the right -->
	<div
		class="absolute top-1.5 left-1.5 cursor-grab opacity-0 transition-opacity group-hover/block:opacity-100 active:cursor-grabbing"
	>
		<GripVertical class="size-4 text-muted-foreground/50" aria-hidden="true" />
	</div>
	<div
		class="absolute top-1 right-1 z-10 flex items-center gap-0.5 opacity-0 transition-opacity group-hover/block:opacity-100 focus-within:opacity-100"
	>
		<IconButton
			tooltip={`Play ${chordName}`}
			variant="ghost"
			size="icon-sm"
			class="h-6 w-6 text-muted-foreground hover:text-primary hover:bg-primary/10"
			onclick={handlePlayChord}
		>
			<Play class="size-3.5" aria-hidden="true" />
		</IconButton>
		<IconButton
			tooltip={`Delete ${chordName} (leaves a rest)`}
			variant="ghost"
			size="icon-sm"
			class="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
			onclick={handleDeleteChord}
		>
			<Trash2 class="size-3.5" aria-hidden="true" />
		</IconButton>
	</div>

	<button
		type="button"
		class="flex flex-col items-center gap-1 rounded-md px-4 py-2 outline-none transition-colors hover:bg-accent/30 focus-visible:ring-2 focus-visible:ring-primary/60"
		onclick={handleSelect}
		data-slot-selection
		aria-pressed={isSelected}
		aria-label={`Select ${chordName}`}
	>
		<span class="flex items-center gap-1.5">
			<span class="text-lg font-medium sm:text-xl">{chordName}</span>
			{#if isCustomized}
				<span
					class="size-1.5 rounded-full bg-primary/70"
					title="Customized voicing, inversion or octave"
				></span>
			{/if}
		</span>
		<span class="text-xs tabular-nums text-muted-foreground">{durationLabel}</span>

		{#if uiState.queuedSlots.includes(index)}
			<span
				class="mt-1 inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-[0.08em] text-primary/75"
				data-queued-hint
			>
				<span class="size-1 rounded-full bg-primary" aria-hidden="true"></span>
				Queued
			</span>
		{/if}
	</button>

	{#if auditionRecord}
		<button
			type="button"
			class="z-10 mt-2 inline-flex max-w-full items-center gap-1.5 rounded-full border border-primary/25 bg-primary/[0.08] px-2.5 py-1 text-[11px] text-foreground transition-colors hover:border-primary/45 hover:bg-primary/[0.13] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
			onclick={handleRevertAudition}
			data-audition-badge
			aria-label={`Trying ${chordName}. Revert to ${baselineName}`}
		>
			<span class="truncate">trying {chordName}</span>
			<span class="text-muted-foreground" aria-hidden="true">·</span>
			<RotateCcw class="size-3 shrink-0 text-primary" aria-hidden="true" />
			<span class="truncate text-primary">revert to {baselineName}</span>
		</button>
	{/if}
</div>
