<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { getChordName } from '$lib/utils/theory-engine/display';
	import type { Chord, ChordQuality } from '$lib/utils/theory-engine/types';

	interface Props {
		quality: ChordQuality;
		root: number | null;
		isSelected: boolean;
		onclick: () => void;
	}

	let { quality, root, isSelected, onclick }: Props = $props();

	function handleDragStart(e: DragEvent) {
		// Only allow drag if root is selected
		if (root === null) {
			e.preventDefault();
			return;
		}

		const chord: Chord = {
			root: root,
			quality: quality,
			inversion: 0,
			voicing: 'close'
		};

		// Create custom drag preview styled as shadcn button
		const chordName = getChordName(chord);
		const dragPreview = document.createElement('button');
		dragPreview.textContent = chordName;
		dragPreview.className = 'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all bg-primary text-primary-foreground shadow-xs px-6 py-3 text-lg font-bold pointer-events-none';
		dragPreview.style.cssText = 'position: absolute; top: -1000px;';
		document.body.appendChild(dragPreview);

		// Set custom drag image
		e.dataTransfer?.setDragImage(dragPreview, dragPreview.offsetWidth / 2, dragPreview.offsetHeight / 2);

		// Clean up the preview element after drag starts
		setTimeout(() => dragPreview.remove(), 0);

		e.dataTransfer?.setData('application/json', JSON.stringify(chord));
	}
</script>

<Button
	variant={isSelected ? 'default' : 'outline'}
	class="min-h-10 {root !== null ? 'cursor-grab active:cursor-grabbing' : ''}"
	draggable={root !== null}
	disabled={root === null}
	{onclick}
	ondragstart={handleDragStart}
>
	{quality === '' ? 'Major' : quality}
</Button>
