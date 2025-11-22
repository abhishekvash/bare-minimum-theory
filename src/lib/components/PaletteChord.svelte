<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { getChordName } from '$lib/utils/theory-engine/display';
	import type { Chord } from '$lib/utils/theory-engine/types';
	import Trash2 from 'lucide-svelte/icons/trash-2';
	import Play from 'lucide-svelte/icons/play';
	import GripVertical from 'lucide-svelte/icons/grip-vertical';

	interface Props {
		chord: Chord;
		index: number;
		isBeingDragged?: boolean;
		isDropTarget?: boolean;
		onDelete?: (index: number) => void;
		onPlay?: (chord: Chord) => void;
		onDragStart?: (index: number) => void;
		onDragEnd?: () => void;
		onDrop?: (index: number) => void;
		onDragEnter?: (index: number) => void;
		onDragLeave?: () => void;
	}

	let {
		chord,
		index,
		isBeingDragged = false,
		isDropTarget = false,
		onDelete,
		onPlay,
		onDragStart,
		onDragEnd,
		onDrop,
		onDragEnter,
		onDragLeave
	}: Props = $props();

	const chordName = $derived(getChordName(chord));

	function handleDelete(e: MouseEvent) {
		e.stopPropagation();
		onDelete?.(index);
	}

	function handlePlay(e: MouseEvent) {
		e.stopPropagation();
		onPlay?.(chord);
	}

	function handleDragStart(event: DragEvent) {
		if (!event.dataTransfer) return;

		// Notify parent
		onDragStart?.(index);

		// Set data for dragging to progression (or back to palette)
		event.dataTransfer.setData('application/json', JSON.stringify(chord));

		// Set data for reordering within palette
		event.dataTransfer.setData('palette-chord', JSON.stringify({ index }));

		event.dataTransfer.effectAllowed = 'copyMove';

		// Create custom drag preview
		const preview = document.createElement('div');
		preview.textContent = chordName;
		preview.className =
			'fixed top-0 left-0 bg-primary text-primary-foreground px-3 py-1.5 rounded-md font-medium shadow-lg pointer-events-none z-50';
		document.body.appendChild(preview);
		event.dataTransfer.setDragImage(preview, 0, 0);
		setTimeout(() => preview.remove(), 0);
	}

	function handleDragEnd() {
		onDragEnd?.();
	}

	function handleDragOver(event: DragEvent) {
		// Only allow drop if this is a palette reorder
		if (event.dataTransfer?.types.includes('palette-chord')) {
			event.preventDefault();
			event.dataTransfer.dropEffect = 'move';
		}
	}

	function handleDragEnter(event: DragEvent) {
		if (event.dataTransfer?.types.includes('palette-chord')) {
			onDragEnter?.(index);
		}
	}

	function handleDragLeave() {
		onDragLeave?.();
	}

	function handleDrop(event: DragEvent) {
		if (event.dataTransfer?.types.includes('palette-chord')) {
			event.preventDefault();
			onDrop?.(index);
		}
	}
</script>

<div
	class="group relative flex items-center justify-between rounded-md border bg-card hover:bg-accent/50 p-2 pl-3 transition-all cursor-grab active:cursor-grabbing {isBeingDragged
		? 'opacity-50'
		: ''} {isDropTarget ? 'ring-2 ring-primary ring-offset-2' : ''}"
	draggable="true"
	ondragstart={handleDragStart}
	ondragend={handleDragEnd}
	ondragover={handleDragOver}
	ondragenter={handleDragEnter}
	ondragleave={handleDragLeave}
	ondrop={handleDrop}
	role="button"
	tabindex="0"
	aria-label="Drag {chordName} to progression"
>
	<div class="flex items-center gap-3">
		<GripVertical
			class="size-3.5 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors"
			aria-hidden="true"
		/>
		<span class="font-medium text-base">{chordName}</span>
	</div>

	<div class="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
		<Button
			variant="ghost"
			size="icon-sm"
			class="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10"
			onclick={handlePlay}
			aria-label={`Play ${chordName}`}
		>
			<Play class="size-3.5" />
		</Button>
		<Button
			variant="ghost"
			size="icon-sm"
			class="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
			onclick={handleDelete}
			aria-label={`Delete ${chordName}`}
		>
			<Trash2 class="size-3.5" />
		</Button>
	</div>
</div>
