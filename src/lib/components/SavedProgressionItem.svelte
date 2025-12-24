<script lang="ts">
	import type { SavedProgression } from '$lib/utils/progression-persistence';
	import { Button } from '$lib/components/ui/button';
	import * as Popover from '$lib/components/ui/popover';
	import { playChord } from '$lib/utils/audio-playback';
	import { getChordNotes } from '$lib/utils/theory-engine/chord-operations';
	import { clearActiveNotes } from '$lib/stores/progression.svelte';
	import Play from 'lucide-svelte/icons/play';
	import Download from 'lucide-svelte/icons/download';
	import MoreVertical from 'lucide-svelte/icons/more-vertical';
	import Trash2 from 'lucide-svelte/icons/trash-2';
	import ArrowLeftFromLine from 'lucide-svelte/icons/arrow-left-from-line';

	interface Props {
		progression: SavedProgression;
		onLoad?: (progression: SavedProgression) => void;
		onDelete?: (id: string) => void;
		onExport?: (progression: SavedProgression) => void;
	}

	let { progression, onLoad, onDelete, onExport }: Props = $props();

	let isPlaying = $state(false);
	let showDeleteConfirm = $state(false);
	let menuOpen = $state(false);

	// Count non-null chords for display
	let chordCount = $derived(progression.progression.filter((c) => c !== null).length);

	async function handlePlay() {
		if (isPlaying) return;

		isPlaying = true;
		const slotDuration = 600; // ms per slot

		// Play each slot in sequence, including rests
		for (const chord of progression.progression) {
			if (chord) {
				const notes = getChordNotes(chord);
				playChord(notes);
			} else {
				// For null slots, clear piano to represent a rest
				clearActiveNotes();
			}
			// Wait for fixed duration for each slot
			await new Promise((resolve) => setTimeout(resolve, slotDuration));
		}

		clearActiveNotes();
		isPlaying = false;
	}

	function handleLoad() {
		onLoad?.(progression);
	}

	function handleExport() {
		menuOpen = false;
		onExport?.(progression);
	}

	function handleDeleteClick() {
		showDeleteConfirm = true;
		menuOpen = false;
	}

	function handleConfirmDelete() {
		onDelete?.(progression.id);
		showDeleteConfirm = false;
	}

	function handleCancelDelete() {
		showDeleteConfirm = false;
	}
</script>

<div class="rounded-lg border bg-card p-3 space-y-2">
	<!-- Header: Name and chord count -->
	<div class="flex items-start justify-between gap-2">
		<div class="flex-1 min-w-0">
			<h3 class="font-medium text-sm truncate">{progression.name}</h3>
			<p class="text-xs text-muted-foreground">{chordCount} chord{chordCount !== 1 ? 's' : ''}</p>
		</div>
	</div>

	<!-- Tags -->
	{#if progression.tags.length > 0}
		<div class="flex flex-wrap gap-1">
			{#each progression.tags as tag (tag)}
				<span class="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-xs">
					{tag}
				</span>
			{/each}
		</div>
	{/if}

	<!-- Actions -->
	{#if showDeleteConfirm}
		<!-- Inline delete confirmation -->
		<div class="flex items-center justify-between gap-2 pt-1 border-t">
			<span class="text-xs text-muted-foreground">Delete this progression?</span>
			<div class="flex gap-1">
				<Button size="sm" variant="ghost" onclick={handleCancelDelete} class="h-7 px-2 text-xs">
					Cancel
				</Button>
				<Button
					size="sm"
					variant="destructive"
					onclick={handleConfirmDelete}
					class="h-7 px-2 text-xs"
				>
					Delete
				</Button>
			</div>
		</div>
	{:else}
		<!-- Normal action buttons -->
		<div class="flex items-center gap-1 pt-1 border-t">
			<!-- Play button -->
			<Button
				size="sm"
				variant="ghost"
				onclick={handlePlay}
				disabled={isPlaying}
				class="h-7 px-2"
				title="Preview progression"
			>
				<Play class="size-3.5" />
			</Button>

			<!-- Load button -->
			<Button size="sm" variant="ghost" onclick={handleLoad} class="h-7 px-2" title="Load to canvas">
				<ArrowLeftFromLine class="size-3.5" />
			</Button>

			<!-- Spacer -->
			<div class="flex-1"></div>

			<!-- Overflow menu -->
			<Popover.Root bind:open={menuOpen}>
				<Popover.Trigger>
					<Button size="sm" variant="ghost" class="h-7 px-2" title="More actions">
						<MoreVertical class="size-3.5" />
					</Button>
				</Popover.Trigger>
				<Popover.Content class="w-40 p-1" align="end">
					<button
						class="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent cursor-pointer"
						onclick={handleExport}
					>
						<Download class="size-4" />
						<span>Export MIDI</span>
					</button>
					<button
						class="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-destructive hover:bg-accent cursor-pointer"
						onclick={handleDeleteClick}
					>
						<Trash2 class="size-4" />
						<span>Delete</span>
					</button>
				</Popover.Content>
			</Popover.Root>
		</div>
	{/if}
</div>
