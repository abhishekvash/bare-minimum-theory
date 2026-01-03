<script lang="ts">
	import ChordBlock from '$lib/components/ChordBlock.svelte';
	import { cn } from '$lib/utils';
	import type { Chord } from '$lib/utils/theory-engine';

	interface Props {
		chord: Chord | null;
		index: number;
		isLast: boolean;
		isActiveDropTarget: boolean;
		isCurrentlyPlaying?: boolean;
		progressPercent?: number;
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
		onDragOver,
		onDragEnter,
		onDragLeave,
		onDrop
	}: Props = $props();

	const hasChord = $derived(Boolean(chord));
</script>

<div
	class={cn(
		'flex-1 min-w-[160px] sm:min-w-[200px] min-h-[280px] sm:min-h-[300px] flex flex-col transition-all duration-200',
		hasChord &&
			isActiveDropTarget &&
			'ring-2 ring-primary ring-offset-2 ring-offset-background scale-105',
		!hasChord &&
			isActiveDropTarget &&
			'bg-primary/5 border-2 border-dashed border-primary/40 rounded-lg -ml-[2px] relative z-10'
	)}
	ondragover={onDragOver}
	ondragenter={onDragEnter}
	ondragleave={onDragLeave}
	ondrop={onDrop}
	role="button"
	tabindex="0"
	aria-label={`Chord slot ${index + 1}`}
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
			<div class="flex-1 flex items-center justify-center bg-card">
				<span class="text-muted-foreground/60 text-sm font-medium">{index + 1}</span>
			</div>
		{/if}
	</div>
</div>
