<script lang="ts">
	import ChordBlock from '$lib/components/ChordBlock.svelte';
	import { IconButton } from '$lib/components/ui/icon-button';
	import {
		canRemoveSlot as storeCanRemoveSlot,
		placeChordAt,
		progressionState,
		removeSlot
	} from '$lib/stores/progression.svelte';
	import { uiState } from '$lib/stores/ui.svelte';
	import { cn } from '$lib/utils';
	import type { Chord } from '$lib/utils/theory-engine';
	import { getChordName } from '$lib/utils/theory-engine/display';
	import SquareMinus from 'lucide-svelte/icons/square-minus';

	interface Props {
		chord: Chord | null;
		index: number;
		isLast: boolean;
		isActiveDropTarget: boolean;
		isCurrentlyPlaying?: boolean;
		progressPercent?: number;
		readyChord?: Chord | null;
		onDragOver: (event: DragEvent) => void;
		onDragEnter: (event: DragEvent) => void;
		onDragLeave: () => void;
		onDrop: (event: DragEvent) => void;
	}

	let {
		chord,
		index,
		isLast,
		isActiveDropTarget,
		isCurrentlyPlaying = false,
		progressPercent = 0,
		readyChord = null,
		onDragOver,
		onDragEnter,
		onDragLeave,
		onDrop
	}: Props = $props();

	const hasChord = $derived(Boolean(chord));
	const readyChordName = $derived(readyChord ? getChordName(readyChord) : null);
	const isEmptyCanvas = $derived(
		!progressionState.progression.some((progressionChord) => progressionChord !== null)
	);

	/** Whether this empty slot can be removed: the canvas never shrinks below its minimum */
	const canRemoveSlot = $derived(
		index < progressionState.progression.length && storeCanRemoveSlot()
	);

	function handleEmptySlotClick(event: MouseEvent): void {
		if (chord || !readyChord) return;
		event.stopPropagation();
		placeChordAt(index, readyChord);
	}

	function handleRemoveSlot(event: MouseEvent): void {
		event.stopPropagation();
		removeSlot(index);
	}
</script>

<div
	class={cn(
		'flex-1 min-w-[160px] sm:min-w-[200px] min-h-[150px] sm:min-h-[170px] flex flex-col transition-all duration-200',
		hasChord &&
			isActiveDropTarget &&
			'ring-2 ring-primary ring-offset-2 ring-offset-background scale-[1.02] shadow-lg shadow-primary/20',
		!hasChord &&
			isActiveDropTarget &&
			'bg-[var(--slot-active)] border-2 border-dashed border-primary/50 rounded-lg -ml-[2px] relative z-10',
		!hasChord && readyChord && 'hover:bg-primary/[0.04]',
		uiState.landingSlot === index && 'ring-2 ring-primary/60 scale-[1.015] bg-primary/[0.06]'
	)}
	data-slot-wrapper
	data-slot-index={index}
	data-landing={uiState.landingSlot === index ? 'true' : undefined}
	ondragover={onDragOver}
	ondragenter={onDragEnter}
	ondragleave={onDragLeave}
	ondrop={onDrop}
	role="group"
	aria-label={`Chord slot ${index + 1}`}
	tabindex="-1"
>
	<div
		class={cn(
			'flex-1 flex flex-col',
			!isLast && !(isActiveDropTarget && !hasChord) && 'border-r border-border',
			isActiveDropTarget && !hasChord && 'rounded-lg overflow-hidden'
		)}
	>
		{#if chord}
			<ChordBlock {chord} {index} {isCurrentlyPlaying} {progressPercent} />
		{:else}
			<div class="group/empty relative flex-1" data-slot="empty-slot">
				{#if readyChordName}
					<button
						type="button"
						class="flex size-full cursor-pointer flex-col items-center justify-center gap-1.5 px-3 text-center transition-colors"
						onclick={handleEmptySlotClick}
						data-empty-placement
						aria-label={`Place ${readyChordName} in slot ${index + 1}`}
					>
						<span
							class="text-xs font-medium text-primary/80 transition-colors group-hover/empty:text-primary"
						>
							Click to place {readyChordName} here
						</span>
					</button>
				{:else}
					<div class="flex size-full flex-col items-center justify-center gap-1.5 px-3 text-center">
						{#if index === 0 && isEmptyCanvas}
							<span class="max-w-36 text-xs leading-relaxed text-muted-foreground/65">
								Build a chord below, then add it here
							</span>
						{:else}
							<span class="text-muted-foreground/40 text-lg font-light">{index + 1}</span>
						{/if}
					</div>
				{/if}
				{#if canRemoveSlot}
					<div
						class="absolute top-1 right-1 z-10 opacity-0 group-hover/empty:opacity-100 focus-within:opacity-100 transition-opacity"
					>
						<IconButton
							tooltip="Remove slot (shortens the loop)"
							variant="ghost"
							size="icon-sm"
							class="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
							onclick={handleRemoveSlot}
						>
							<SquareMinus class="size-3.5" aria-hidden="true" />
						</IconButton>
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>
