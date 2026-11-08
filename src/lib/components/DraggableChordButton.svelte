<script lang="ts">
	import { setDragPreview } from '#lib/utils/drag-preview.ts';
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

		// Drag preview styled like the builder's chord buttons, held by its centre
		if (e.dataTransfer) {
			setDragPreview(e.dataTransfer, getChordName(chord), {
				tag: 'button',
				className:
					'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all bg-primary text-primary-foreground shadow-xs px-6 py-3 text-lg font-bold pointer-events-none',
				centered: true
			});
		}

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
