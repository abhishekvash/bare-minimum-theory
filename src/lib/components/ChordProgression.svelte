<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import ChordBlock from '$lib/components/ChordBlock.svelte';
	import {
		progressionState,
		insertChordAt,
		MAX_PROGRESSION_SLOTS
	} from '$lib/stores/progression.svelte';
	import type { Chord } from '$lib/utils/theory-engine';
	import { startLoopingPlayback, stopLoopingPlayback } from '$lib/utils/audio-playback';
	import { exportToMIDI } from '$lib/utils/midi-export';
	import { toast } from 'svelte-sonner';
	import Play from 'lucide-svelte/icons/play';
	import Stop from 'lucide-svelte/icons/square';
	import Download from 'lucide-svelte/icons/download';
	import Info from 'lucide-svelte/icons/info';

	const slotIndices = Array.from({ length: MAX_PROGRESSION_SLOTS }, (_, index) => index);
	let activeDropIndex: number | null = null;
	let isPlaying = $state(false);

	function parseChordPayload(payload: string): Chord | null {
		try {
			const data = JSON.parse(payload);
			if (
				typeof data.root !== 'number' ||
				typeof data.quality !== 'string' ||
				typeof data.inversion !== 'number' ||
				typeof data.voicing !== 'string'
			) {
				return null;
			}
			return data as Chord;
		} catch (error) {
			console.warn('Failed to parse dropped chord', error);
			return null;
		}
	}

	function handleDragOver(event: DragEvent, index: number) {
		event.preventDefault();
		if (event.dataTransfer) {
			event.dataTransfer.dropEffect = 'copy';
		}
		activeDropIndex = index;
	}

	function handleDragLeave(index: number) {
		if (activeDropIndex === index) {
			activeDropIndex = null;
		}
	}

	function handleDrop(event: DragEvent, index: number) {
		event.preventDefault();
		const payload = event.dataTransfer?.getData('application/json');
		activeDropIndex = null;
		if (!payload) return;

		const chord = parseChordPayload(payload);
		if (!chord) return;

		insertChordAt(index, chord);
	}

	async function handlePlayClick() {
		if (isPlaying) return; // Already playing

		try {
			isPlaying = true;
			// Pass a getter function so playback can read the latest progression state on each loop
			await startLoopingPlayback(() => progressionState.progression);
		} catch (error) {
			console.error('Failed to play progression:', error);
			toast.error('Failed to play progression', {
				description: 'Please check your audio settings and try again.'
			});
			isPlaying = false;
		}
	}

	function handleStopClick() {
		isPlaying = false;
		stopLoopingPlayback();
	}

	function handleExportClick() {
		try {
			exportToMIDI([...progressionState.progression]);
			toast.success('MIDI file exported', {
				description: 'Your chord progression has been downloaded successfully.'
			});
		} catch (error) {
			console.error('Failed to export MIDI:', error);
			toast.error('Failed to export MIDI', {
				description: 'There was an error creating the MIDI file. Please try again.'
			});
		}
	}

	function getSlotClasses(index: number, hasChord: boolean): string {
		const base = 'flex-1 min-w-[200px]';

		if (hasChord) {
			// Filled slot - no extra styling, ChordBlock handles appearance
			return `${base}`;
		}

		// Empty slot with rounded corners
		return `${base} rounded-md`;
	}
</script>

<section class="space-y-6" aria-label="Chord progression canvas">
	<div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
		<div>
			<h2 class="text-2xl font-semibold tracking-tight">Progression</h2>
			<p class="text-sm text-muted-foreground">Drag chords into any slot, tweak them, then play or export.</p>
		</div>
		<div class="flex flex-wrap gap-2">
			<Button
				onclick={handlePlayClick}
				disabled={progressionState.progression.length === 0 || isPlaying}
				size="icon"
				title="Play"
			>
				<Play class="size-4" />
			</Button>
			<Button
				onclick={handleStopClick}
				disabled={!isPlaying}
				size="icon"
				variant="outline"
				title="Stop"
			>
				<Stop class="size-4" />
			</Button>
			<Button
				variant="outline"
				onclick={handleExportClick}
				disabled={progressionState.progression.length === 0}
				class="gap-2"
			>
				<Download class="size-4" />
				<span>Export MIDI</span>
			</Button>
		</div>
	</div>

	<!-- Timeline-style horizontal arrangement -->
	<div class="rounded-lg border bg-card/50 p-2 overflow-x-auto relative">
		<div class="flex gap-0 min-h-[280px]">
			{#each slotIndices as slotIndex}
				{@const chord = progressionState.progression[slotIndex]}
				<div
					class={getSlotClasses(slotIndex, Boolean(chord))}
					ondragover={(event) => handleDragOver(event, slotIndex)}
					ondragenter={(event) => handleDragOver(event, slotIndex)}
					ondragleave={() => handleDragLeave(slotIndex)}
					ondrop={(event) => handleDrop(event, slotIndex)}
					role="button"
					tabindex="0"
					aria-label={`Chord slot ${slotIndex + 1}`}
				>
					{#if chord}
						<ChordBlock chord={chord} index={slotIndex} isLast={slotIndex === MAX_PROGRESSION_SLOTS - 1} />
					{/if}
				</div>
			{/each}
		</div>

		{#if progressionState.progression.length === 0}
			<div class="absolute inset-0 flex items-center justify-center pointer-events-none">
				<div class="flex flex-col items-center gap-2 text-muted-foreground">
					<Info class="size-4 opacity-40" />
					<p class="text-sm font-medium">Drop chords here</p>
				</div>
			</div>
		{/if}
	</div>
</section>
