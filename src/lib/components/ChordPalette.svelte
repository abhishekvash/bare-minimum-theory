<script module lang="ts">
	import {
		CHORD_DURATIONS,
		isRenderableChord as validateRenderableChord,
		parseDraggedChord,
		type Chord
	} from '#lib/utils/theory-engine/index.ts';

	/** Backward-compatible component exports; the theory layer owns both domains. */
	export const SUPPORTED_CHORD_DURATIONS = CHORD_DURATIONS;
	export const isRenderableChord = validateRenderableChord;

	/** The parts of a `DataTransfer` the library's drop rules actually read */
	export type DragPayloadSource = {
		types: readonly string[];
		effectAllowed?: string;
		getData: (format: string) => string;
	};

	/**
	 * What a drop on the library amounts to.
	 * Every drop is terminal — the caller pins the panel open or lets an auto-opened one
	 * collapse — so a payload the palette refuses can never latch the rail open.
	 */
	export type LibraryDropOutcome =
		{ status: 'ignored' } | { status: 'accepted'; chord: Chord } | { status: 'rejected' };

	/** `effectAllowed` values whose source drag permits a copy */
	const COPY_ALLOWING_EFFECTS = ['copy', 'copyLink', 'copyMove', 'all', 'uninitialized'];

	/**
	 * Whether a drag is a palette-internal reorder.
	 * Reorders belong to the individual PaletteChord drop zones, so every list-level handler
	 * has to leave them alone — this is the precedence check, and it comes first everywhere.
	 * @param source - Drag payload being inspected
	 * @returns true when the drag started on a palette chord
	 */
	export function isPaletteReorderDrag(source: DragPayloadSource | null | undefined): boolean {
		return source?.types.includes('palette-chord') ?? false;
	}

	/**
	 * Decide what a drop on the library does.
	 * A canvas block carries `progression-chord` alongside the JSON payload; the library reads
	 * the JSON and copies it, so the canvas keeps its chord (canvas→palette is a copy, not a move).
	 * Anything that is not a reorder settles here one way or the other: `dragover` can only see
	 * the payload's *types*, never its contents, so a drag that auto-expanded the rail may well
	 * turn out to be carrying junk — and the drop is the last chance to say so.
	 * @param source - Drag payload being inspected
	 * @returns Whether the drop is the list's to handle, a chord to copy, or nothing usable
	 */
	export function resolveLibraryDrop(
		source: DragPayloadSource | null | undefined
	): LibraryDropOutcome {
		if (isPaletteReorderDrag(source)) return { status: 'ignored' };
		if (!source?.types.includes('application/json')) return { status: 'rejected' };

		// Malformed payloads are simply not offering a chord
		const chord = parseDraggedChord(source.getData('application/json'));
		return chord ? { status: 'accepted', chord } : { status: 'rejected' };
	}

	/**
	 * Drop effect to advertise for a drag over the library.
	 * A canvas block may only allow `move`; advertising `copy` there makes the browser reject
	 * the drop outright, so we mirror what the source permits — the handler copies either way.
	 * @param source - Drag payload being inspected
	 * @returns The drop effect to put on the event's dataTransfer
	 */
	export function resolveLibraryDropEffect(source: DragPayloadSource): 'copy' | 'move' {
		if (isPaletteReorderDrag(source)) return 'move';
		return COPY_ALLOWING_EFFECTS.includes(source.effectAllowed ?? 'uninitialized')
			? 'copy'
			: 'move';
	}
</script>

<script lang="ts">
	import {
		progressionState,
		removeFromPalette,
		addToPalette,
		moveInPalette,
		addChord,
		isProgressionFull,
		placeChordAt,
		MAX_PROGRESSION_SLOTS
	} from '#lib/stores/progression.svelte.ts';
	import { uiState } from '#lib/stores/ui.svelte.ts';
	import { toast } from 'svelte-sonner';
	import PaletteChord from './PaletteChord.svelte';
	import { auditionNotes } from '#lib/utils/audition-controller.ts';
	import { getChordNotes } from '#lib/utils/theory-engine/chord-operations.ts';

	interface Props {
		/**
		 * Called when a drag from outside the palette settles, so the rail can pin itself open
		 * or let an auto-opened panel collapse
		 */
		onDropSettled?: (accepted: boolean) => void;
	}

	let { onDropSettled }: Props = $props();

	// Palette drag-drop state
	let draggedIndex = $state<number | null>(null);
	let dropTargetIndex = $state<number | null>(null);

	function handleDelete(index: number) {
		removeFromPalette(index);
	}

	function handlePlay(chord: Chord) {
		auditionNotes(getChordNotes(chord));
	}

	/**
	 * Click / Enter placement: the drag-free path (touch, keyboard, and the small-screen drawer,
	 * whose overlay covers the canvas). Replaces the selected slot's harmony, else fills the
	 * first open slot.
	 */
	function handlePlace(chord: Chord) {
		const placed = { ...chord };
		if (uiState.selectedSlot !== null) {
			placeChordAt(uiState.selectedSlot, placed);
			return;
		}
		if (isProgressionFull() && progressionState.progression.length >= MAX_PROGRESSION_SLOTS) {
			toast.info('Progression is full', {
				description: 'Select a slot to replace it, or remove a slot first.'
			});
			return;
		}
		addChord(placed);
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
			event.dataTransfer.dropEffect = resolveLibraryDropEffect(event.dataTransfer);
		}
	}

	function handleDrop(event: DragEvent) {
		event.preventDefault();

		const outcome = resolveLibraryDrop(event.dataTransfer);
		// Reordering is handled by the individual PaletteChord drop zones
		if (outcome.status === 'ignored') return;

		if (outcome.status === 'accepted') {
			addToPalette(outcome.chord);
		}
		onDropSettled?.(outcome.status === 'accepted');
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
	class="flex h-full min-h-0 flex-col gap-3"
	ondragover={handleDragOver}
	ondrop={handleDrop}
	role="region"
	aria-label="Chord Palette Drop Zone"
>
	<p class="text-xs text-muted-foreground">Save ideas for later.</p>

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
					onPlace={handlePlace}
					onDragStart={handleDragStart}
					onDragEnd={handleDragEnd}
					onDrop={handleDropOnChord}
					onDragEnter={handleDragEnterChord}
					onDragLeave={handleDragLeaveChord}
				/>
			{/each}
		</div>
	{/if}

	<!-- Blank space below the list stays a drop target -->
	<div class="min-h-8 flex-1"></div>
</div>
