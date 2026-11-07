<script lang="ts">
	import { Button } from '#lib/components/ui/button/index.ts';
	import { getChordName } from '#lib/utils/theory-engine/display.ts';
	import type { Chord, ChordQuality } from '#lib/utils/theory-engine/types.ts';
	import { UI_OPACITY } from '#lib/constants.ts';
	import { cn } from '#lib/utils.ts';

	interface Props {
		quality: ChordQuality;
		root: number | null;
		isSelected: boolean;
		isInScale?: boolean;
		/** True while a sweep is passing over this quality — the only feedback a suppressed browse gets */
		isSwept?: boolean;
		onclick: () => void;
	}

	let { quality, root, isSelected, isInScale = true, isSwept = false, onclick }: Props = $props();

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
			voicing: 'close',
			octave: 0,
			duration: '1m'
		};

		// Create custom drag preview styled as shadcn button
		const chordName = getChordName(chord);
		const dragPreview = document.createElement('button');
		dragPreview.textContent = chordName;
		dragPreview.className =
			'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all bg-primary text-primary-foreground shadow-xs px-6 py-3 text-lg font-bold pointer-events-none';
		dragPreview.style.cssText = 'position: absolute; top: -1000px;';
		document.body.appendChild(dragPreview);

		e.dataTransfer?.setDragImage(
			dragPreview,
			dragPreview.offsetWidth / 2,
			dragPreview.offsetHeight / 2
		);

		// Clean up the preview element after drag starts
		setTimeout(() => dragPreview.remove(), 0);

		e.dataTransfer?.setData('application/json', JSON.stringify(chord));
	}
</script>

<Button
	variant={isSelected ? 'default' : 'outline'}
	class={cn(
		'min-h-10 transition-all',
		root !== null && 'cursor-grab active:cursor-grabbing hover:scale-[1.02]',
		isSelected && 'glow-subtle',
		isSwept && 'ring-2 ring-primary ring-offset-1 ring-offset-background scale-[1.04]',
		!isInScale && UI_OPACITY.OUT_OF_SCALE
	)}
	data-quality={quality}
	draggable={root !== null}
	disabled={root === null}
	{onclick}
	ondragstart={handleDragStart}
>
	{quality === '' ? 'maj' : quality}
</Button>
