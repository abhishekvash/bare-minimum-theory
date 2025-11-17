<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import ChordBlock from '$lib/components/ChordBlock.svelte';
	import PlaybackControls from '$lib/components/PlaybackControls.svelte';
	import ProgressionSlot from '$lib/components/ProgressionSlot.svelte';
	import {
		progressionState,
		insertChordAt,
		moveChord,
		MAX_PROGRESSION_SLOTS,
		hasNonNullChords
	} from '$lib/stores/progression.svelte';
	import type { Chord } from '$lib/utils/theory-engine';
	import { startLoopingPlayback, stopLoopingPlayback } from '$lib/utils/audio-playback';
	import { exportToMIDI } from '$lib/utils/midi-export';
	import { toast } from 'svelte-sonner';
	import Info from 'lucide-svelte/icons/info';

	const slotIndices = Array.from({ length: MAX_PROGRESSION_SLOTS }, (_, index) => index);
	let activeDropIndex = $state<number | null>(null);
	let isPlaying = $state(false);

	/**
	 * Type guard to check if parsed data is a valid Chord object
	 */
	function isValidChord(data: unknown): data is Chord {
		return (
			typeof data === 'object' &&
			data !== null &&
			'root' in data &&
			'quality' in data &&
			'inversion' in data &&
			'voicing' in data &&
			'octave' in data &&
			typeof data.root === 'number' &&
			typeof data.quality === 'string' &&
			typeof data.inversion === 'number' &&
			typeof data.voicing === 'string' &&
			typeof data.octave === 'number'
		);
	}

	function parseChordPayload(payload: string): Chord | null {
		try {
			const data = JSON.parse(payload);
			return isValidChord(data) ? data : null;
		} catch (error) {
			console.warn('Failed to parse dropped chord', error);
			return null;
		}
	}

	function handleDragOver(event: DragEvent, index: number) {
		event.preventDefault();
		if (event.dataTransfer) {
			// Check if we're dragging from within the progression (move) or from builder (copy)
			const types = event.dataTransfer.types;
			if (types.includes('progression-chord')) {
				event.dataTransfer.dropEffect = 'move';
			} else {
				event.dataTransfer.dropEffect = 'copy';
			}
		}
		activeDropIndex = index;
	}

	function handleDragLeave(index: number) {
		if (activeDropIndex === index) {
			activeDropIndex = null;
		}
	}

	function handleDrop(event: DragEvent, toIndex: number) {
		event.preventDefault();
		activeDropIndex = null;

		// Try to get progression-chord data first (drag from within progression)
		const progressionPayload = event.dataTransfer?.getData('progression-chord');
		if (progressionPayload) {
			try {
				const data = JSON.parse(progressionPayload);
				if (typeof data.fromIndex === 'number') {
					moveChord(data.fromIndex, toIndex);
					return;
				}
			} catch (error) {
				console.warn('Failed to parse progression chord data', error);
			}
		}

		// Fall back to builder-chord data (drag from builder)
		const builderPayload = event.dataTransfer?.getData('application/json');
		if (!builderPayload) return;

		const chord = parseChordPayload(builderPayload);
		if (!chord) return;

		insertChordAt(toIndex, chord);
	}

	async function handlePlayClick() {
		if (isPlaying) return;

		try {
			isPlaying = true;
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
</script>

<section class="space-y-6" aria-label="Chord progression canvas">
	<PlaybackControls
		{isPlaying}
		hasChords={hasNonNullChords(progressionState.progression)}
		onPlay={handlePlayClick}
		onStop={handleStopClick}
		onExport={handleExportClick}
	/>

	<div class="rounded-lg border bg-card/50 p-2 sm:p-3 overflow-x-auto relative">
		<div class="flex gap-0 min-h-[280px] sm:min-h-[300px]">
			{#each slotIndices as slotIndex}
				<ProgressionSlot
					chord={progressionState.progression[slotIndex]}
					index={slotIndex}
					isLast={slotIndex === MAX_PROGRESSION_SLOTS - 1}
					isActiveDropTarget={activeDropIndex === slotIndex}
					onDragOver={(event) => handleDragOver(event, slotIndex)}
					onDragEnter={(event) => handleDragOver(event, slotIndex)}
					onDragLeave={() => handleDragLeave(slotIndex)}
					onDrop={(event) => handleDrop(event, slotIndex)}
				/>
			{/each}
		</div>

		{#if !hasNonNullChords(progressionState.progression)}
			<div class="absolute inset-0 flex items-center justify-center pointer-events-none">
				<div class="flex flex-col items-center gap-2 text-muted-foreground">
					<Info class="size-5 opacity-40" />
					<p class="text-sm font-medium">Drag chord qualities here to start</p>
				</div>
			</div>
		{/if}
	</div>
</section>
