<script lang="ts">
	import ChordBlock from '$lib/components/ChordBlock.svelte';
	import { cn } from '$lib/utils';
	import type { Chord } from '$lib/utils/theory-engine';

	interface Props {
		chord: Chord | null;
		index: number;
		isLast: boolean;
		isActiveDropTarget: boolean;
		onDragOver: (event: DragEvent) => void;
		onDragEnter: (event: DragEvent) => void;
		onDragLeave: () => void;
		onDrop: (event: DragEvent) => void;
	}

	let { chord, index, isLast, isActiveDropTarget, onDragOver, onDragEnter, onDragLeave, onDrop }: Props = $props();

	const hasChord = $derived(Boolean(chord));
</script>

<div
	class={cn(
		'flex-1 min-w-[160px] sm:min-w-[200px] transition-all duration-200',
		!hasChord && 'rounded-md',
		hasChord && isActiveDropTarget && 'ring-2 ring-primary ring-offset-2 ring-offset-background scale-105',
		!hasChord && isActiveDropTarget && 'bg-primary/10 border-2 border-dashed border-primary'
	)}
	ondragover={onDragOver}
	ondragenter={onDragEnter}
	ondragleave={onDragLeave}
	ondrop={onDrop}
	role="button"
	tabindex="0"
	aria-label={`Chord slot ${index + 1}`}
>
	{#if chord}
		<ChordBlock {chord} {index} {isLast} />
	{/if}
</div>

