<script lang="ts">
	/**
	 * Builder completion state. It names the ready chord, exposes the one action that makes sense in
	 * the current selection/transport context, and carries the same chord payload as quality buttons.
	 */
	import { Button } from '$lib/components/ui/button';
	import { getReadyBarAction, getReadyChord, performReadyBarAction } from '$lib/stores/ui.svelte';
	import { getChordName } from '$lib/utils/theory-engine/display';
	import type { Chord } from '$lib/utils/theory-engine/types';
	import GripVertical from 'lucide-svelte/icons/grip-vertical';

	const readyChord = $derived(getReadyChord());
	const action = $derived(getReadyBarAction());
	const chordName = $derived(readyChord ? getChordName(readyChord) : '');

	function handleDragStart(event: DragEvent, chord: Chord): void {
		if (!event.dataTransfer) return;
		event.dataTransfer.effectAllowed = 'copy';
		event.dataTransfer.setData('application/json', JSON.stringify(chord));
	}
</script>

{#if readyChord}
	<div
		class="flex flex-col gap-2 rounded-lg border border-primary/20 bg-primary/[0.04] px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
		data-ready-bar
		aria-live="polite"
	>
		<div
			class="group/ready flex min-w-0 cursor-grab items-center gap-2 active:cursor-grabbing"
			draggable="true"
			ondragstart={(event) => handleDragStart(event, readyChord)}
			role="group"
			aria-label={`Drag ${chordName}`}
		>
			<GripVertical
				class="size-4 shrink-0 text-muted-foreground/45 transition-colors group-hover/ready:text-muted-foreground"
				aria-hidden="true"
			/>
			<span class="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
				Ready
			</span>
			<strong class="truncate text-base font-semibold text-foreground">{chordName}</strong>
		</div>

		{#if action}
			<div class="flex items-center gap-2 sm:justify-end">
				{#if action.hint}
					<span class="text-xs text-muted-foreground" role="status">{action.hint}</span>
				{/if}
				<Button
					size="sm"
					class="w-full sm:w-auto"
					disabled={action.disabled}
					title={action.hint ?? undefined}
					onclick={() => performReadyBarAction()}
				>
					{action.label}
				</Button>
			</div>
		{/if}
	</div>
{/if}
