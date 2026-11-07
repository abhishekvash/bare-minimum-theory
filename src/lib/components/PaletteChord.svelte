<script lang="ts">
	import { IconButton } from '$lib/components/ui/icon-button';
	import { getChordName } from '$lib/utils/theory-engine/display';
	import type { Chord } from '$lib/utils/theory-engine/types';
	import Trash2 from '@lucide/svelte/icons/trash';
	import Play from '@lucide/svelte/icons/play';
	import GripVertical from '@lucide/svelte/icons/grip-vertical';

	interface Props {
		chord: Chord;
		index: number;
		isBeingDragged?: boolean;
		isDropTarget?: boolean;
		onDelete?: (index: number) => void;
		onPlay?: (chord: Chord) => void;
		/** Place the chord on the canvas (click or Enter; also Space inside a dialog) */
		onPlace?: (chord: Chord) => void;
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
		onPlace,
		onDragStart,
		onDragEnd,
		onDrop,
		onDragEnter,
		onDragLeave
	}: Props = $props();

	const chordName = $derived(getChordName(chord));
	let isPlaying = $state(false);

	function handleDelete(e: MouseEvent) {
		e.stopPropagation();
		onDelete?.(index);
	}

	function handlePlay(e: MouseEvent) {
		e.stopPropagation();
		if (isPlaying) return;

		isPlaying = true;
		onPlay?.(chord);
		setTimeout(() => {
			isPlaying = false;
		}, 1000);
	}

	function handleClick() {
		onPlace?.(chord);
	}

	/**
	 * Clicking anywhere on the card places it, not just the name. The name is the real button for
	 * keyboard and screen-reader users; clicks on it or on the action buttons are left to them.
	 */
	function handleCardClick(event: MouseEvent) {
		if ((event.target as Element | null)?.closest('button')) return;
		handleClick();
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.target !== event.currentTarget) return;
		// Space places the card only inside a dialog (the mobile library drawer); everywhere else
		// it stays the global transport toggle
		const inDialog =
			(event.currentTarget as HTMLElement).closest('[role="dialog"], [role="alertdialog"]') !==
			null;
		if (event.key !== 'Enter' && !(event.key === ' ' && inDialog)) return;
		event.preventDefault();
		onPlace?.(chord);
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

	function handleDragLeave(event: DragEvent) {
		// Moving onto one of the card's own children fires dragleave on the card too; the pointer
		// is still over the card, so keep the drop highlight
		const related = event.relatedTarget as Node | null;
		if (related && (event.currentTarget as HTMLElement).contains(related)) return;
		onDragLeave?.();
	}

	function handleDrop(event: DragEvent) {
		if (event.dataTransfer?.types.includes('palette-chord')) {
			event.preventDefault();
			onDrop?.(index);
		}
	}
</script>

<!-- The card-wide click is a larger mouse target only; keyboard and screen-reader placement
     go through the name button inside, so no key handler or button role belongs on this div -->
<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<div
	class="group relative flex items-center justify-between rounded-md border bg-card hover:bg-accent/50 p-2 pl-3 transition-all cursor-pointer active:cursor-grabbing overflow-hidden {isBeingDragged
		? 'opacity-50'
		: ''} {isDropTarget ? 'ring-2 ring-primary ring-offset-2' : ''}"
	draggable="true"
	ondragstart={handleDragStart}
	ondragend={handleDragEnd}
	ondragover={handleDragOver}
	ondragenter={handleDragEnter}
	ondragleave={handleDragLeave}
	ondrop={handleDrop}
	onclick={handleCardClick}
	role="group"
	aria-label="{chordName} palette chord"
>
	<!-- Progress bar for individual preview -->
	{#if isPlaying}
		<div
			class="absolute bottom-0 left-0 h-1 bg-primary/60 animate-progress-sweep"
			aria-hidden="true"
		></div>
	{/if}
	<button
		type="button"
		class="flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
		onclick={handleClick}
		onkeydown={handleKeydown}
		data-palette-place
		aria-label="Place {chordName} in progression (or drag it)"
	>
		<GripVertical
			class="size-3.5 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors"
			aria-hidden="true"
		/>
		<span class="font-medium text-base">{chordName}</span>
	</button>

	<!-- Revealed on hover, on keyboard focus, and always on touch screens (no hover to reveal them) -->
	<div
		class="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity"
	>
		<IconButton
			tooltip={`Play ${chordName}`}
			variant="ghost"
			size="icon-sm"
			class="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10"
			onclick={handlePlay}
		>
			<Play class="size-3.5" />
		</IconButton>
		<IconButton
			tooltip={`Delete ${chordName}`}
			variant="ghost"
			size="icon-sm"
			class="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
			onclick={handleDelete}
		>
			<Trash2 class="size-3.5" />
		</IconButton>
	</div>
</div>
