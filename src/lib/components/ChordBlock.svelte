<script lang="ts">
	/**
	 * Chord Block
	 * A block at rest says four things and no more: name, duration, whether the chord has been
	 * shaped away from the defaults, and where the playhead is. Everything editable lives in the
	 * inspector, which opens when the block is clicked. Hovering reveals the three affordances
	 * that belong to the block itself: preview, drag, delete.
	 */

	import { IconButton } from '$lib/components/ui/icon-button';
	import { commitAudition, progressionState, revertAudition } from '$lib/stores/progression.svelte';
	import { deleteChordFromSlot, selectSlot, uiState } from '$lib/stores/ui.svelte';
	import {
		formatDuration,
		getChordName,
		isCustomizedChord
	} from '$lib/utils/theory-engine/display';
	import { getChordNotes } from '$lib/utils/theory-engine/chord-operations';
	import type { Chord } from '$lib/utils/theory-engine';
	import { auditionNotes, auditionSelection } from '$lib/utils/audition-controller';
	import Trash2 from '@lucide/svelte/icons/trash';
	import GripVertical from '@lucide/svelte/icons/grip-vertical';
	import Play from '@lucide/svelte/icons/play';
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import Check from '@lucide/svelte/icons/check';
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
	const auditionRecord = $derived(
		progressionState.audition?.slotIndex === index ? progressionState.audition : null
	);
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
		if (!alreadySelected) auditionSelection(chord);
	}

	/**
	 * Clicking anywhere on the block selects it, not just the centred name. The name stays a real
	 * button for keyboard and screen-reader users; clicks on it or on the hover controls are left
	 * to their own handlers. (A stretched button overlay would block drags in Firefox.)
	 */
	function handleBlockClick(event: MouseEvent) {
		if ((event.target as Element | null)?.closest('button')) return;
		handleSelect();
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

	function handleKeepAudition(event: MouseEvent) {
		event.stopPropagation();
		commitAudition();
	}

	const AUDITION_ACTION_CLASS =
		'inline-flex min-w-0 items-center gap-1 rounded-full px-2 py-0.5 text-primary transition-colors hover:bg-primary/[0.13] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60';

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

<!-- The block-wide click is a larger mouse target only; keyboard and screen-reader selection
     go through the name button inside, so no key handler or role belongs on this div -->
<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<div
	class={cn(
		'group/block flex-1 cursor-pointer px-3 sm:px-4 py-3 flex flex-col items-center justify-center gap-1 transition-all relative overflow-hidden rounded-lg',
		isSelected && 'ring-2 ring-inset ring-primary bg-primary/5',
		!isSelected && 'hover:bg-accent/30',
		isDragging ? 'opacity-40' : 'opacity-100'
	)}
	data-slot="chord-block"
	data-chord-index={index}
	onclick={handleBlockClick}
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
		class="absolute top-1.5 left-1.5 cursor-grab opacity-0 transition-opacity group-hover/block:opacity-100 group-focus-within/block:opacity-100 [@media(hover:none)]:opacity-100 active:cursor-grabbing"
	>
		<GripVertical class="size-4 text-muted-foreground/50" aria-hidden="true" />
	</div>
	<div
		class="absolute top-1 right-1 z-10 flex items-center gap-0.5 opacity-0 transition-opacity group-hover/block:opacity-100 group-focus-within/block:opacity-100 [@media(hover:none)]:opacity-100"
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
		class="flex flex-col items-center gap-1 rounded-md px-4 py-2 outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
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
		<!-- The pending candidate's decision lives on the block: keep it, or go back to the baseline -->
		<div
			class="z-10 mt-2 inline-flex max-w-full items-center gap-1 rounded-full border border-primary/25 bg-primary/[0.08] py-0.5 pl-2.5 pr-0.5 text-[11px] text-foreground"
			role="group"
			aria-label={`Trying ${chordName}`}
			data-audition-badge
		>
			<span class="truncate">trying {chordName}</span>
			<button
				type="button"
				class={AUDITION_ACTION_CLASS}
				onclick={handleKeepAudition}
				data-audition-keep
				aria-label={`Keep ${chordName}`}
			>
				<Check class="size-3 shrink-0" aria-hidden="true" />
				<span>keep</span>
			</button>
			<button
				type="button"
				class={AUDITION_ACTION_CLASS}
				onclick={handleRevertAudition}
				data-audition-revert
				aria-label={`Revert to ${baselineName}`}
			>
				<RotateCcw class="size-3 shrink-0" aria-hidden="true" />
				<span class="truncate">revert to {baselineName}</span>
			</button>
		</div>
	{/if}
</div>
