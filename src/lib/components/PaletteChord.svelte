<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { getChordName } from '$lib/utils/theory-engine/display';
	import type { Chord } from '$lib/utils/theory-engine/types';
	import Trash2 from 'lucide-svelte/icons/trash-2';
	import Play from 'lucide-svelte/icons/play';
	import GripVertical from 'lucide-svelte/icons/grip-vertical';
	import { cn } from '$lib/utils';

	interface Props {
		chord: Chord;
		index: number;
		onDelete?: (index: number) => void;
		onPlay?: (chord: Chord) => void;
	}

	let { chord, index, onDelete, onPlay }: Props = $props();

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

		// Set data for dragging to progression (or back to palette)
		event.dataTransfer.setData('application/json', JSON.stringify(chord));

		// Set data for reordering within palette
		event.dataTransfer.setData('palette-chord', JSON.stringify({ index }));

		event.dataTransfer.effectAllowed = 'copyMove';

		// Create custom drag preview
		const preview = document.createElement('div');
		preview.textContent = chordName;
		preview.className =
			'fixed top-0 left-0 bg-primary text-primary-foreground px-3 py-1.5 rounded-md font-bold shadow-lg pointer-events-none z-50';
		document.body.appendChild(preview);
		event.dataTransfer.setDragImage(preview, 0, 0);
		setTimeout(() => preview.remove(), 0);
	}
</script>

<div
	class="group relative flex items-center justify-between rounded-md border bg-card hover:bg-accent/50 p-2 pl-3 transition-all cursor-grab active:cursor-grabbing"
	draggable="true"
	ondragstart={handleDragStart}
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
