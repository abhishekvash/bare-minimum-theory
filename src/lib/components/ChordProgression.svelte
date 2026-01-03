<script lang="ts" module>
	export interface ChordProgressionAPI {
		play: () => void;
		stop: () => void;
		isPlaying: () => boolean;
	}
</script>

<script lang="ts">
	import { onDestroy } from 'svelte';
	import PlaybackControls from '$lib/components/PlaybackControls.svelte';
	import ProgressionSlot from '$lib/components/ProgressionSlot.svelte';
	import PianoKeyboard from '$lib/components/PianoKeyboard.svelte';
	import {
		progressionState,
		canSaveProgression,
		insertChordAt,
		moveChord,
		MAX_PROGRESSION_SLOTS,
		hasNonNullChords,
		addSlot,
		insertSlot
	} from '$lib/stores/progression.svelte';
	import { settingsState, setPianoVisible } from '$lib/stores/settings.svelte';
	import { midiState } from '$lib/stores/midi.svelte';
	import { updatePianoVisibility } from '$lib/utils/piano-settings-persistence';
	import type { Chord } from '$lib/utils/theory-engine';
	import {
		startLoopingPlayback,
		stopLoopingPlayback,
		getPlaybackProgress,
		getCurrentBpm
	} from '$lib/utils/audio-playback';
	import { exportToMIDI } from '$lib/utils/midi-export';
	import { toast } from 'svelte-sonner';
	import { Button } from '$lib/components/ui/button';
	import { IconButton } from '$lib/components/ui/icon-button';
	import Plus from 'lucide-svelte/icons/plus';

	interface Props {
		onOpenMIDISetup?: () => void;
		onSave?: () => void;
	}

	let { onOpenMIDISetup, onSave }: Props = $props();

	// Expose API for parent components (keyboard shortcuts)
	export function play() {
		handlePlayClick();
	}

	export function stop() {
		handleStopClick();
	}

	export function getIsPlaying(): boolean {
		return isPlaying;
	}

	let activeDropIndex = $state<number | null>(null);
	let isPlaying = $state(false);
	let currentPlayingIndex = $state<number | null>(null);
	let progressPercent = $state(0);
	let rafId: number | null = null;

	/**
	 * Get the active BPM (from clock sync or default)
	 * Uses clock sync BPM when enabled and detected, otherwise falls back to default
	 */
	function getActiveBpm(): number {
		const { clockSync } = midiState;
		if (clockSync.enabled && clockSync.detectedBpm !== null) {
			return clockSync.detectedBpm;
		}
		return getCurrentBpm();
	}

	/**
	 * RAF callback for progress tracking
	 * Reads Tone.Transport.seconds for perfect sync with audio
	 */
	function tick() {
		const progress = getPlaybackProgress(progressionState.progression, getActiveBpm());
		if (progress) {
			currentPlayingIndex = progress.chordIndex;
			progressPercent = progress.progress;
		}
		if (isPlaying) {
			rafId = requestAnimationFrame(tick);
		}
	}

	/**
	 * Start tracking playback progress using requestAnimationFrame
	 */
	function startProgressTracking() {
		tick();
	}

	/**
	 * Stop tracking playback progress and reset state
	 */
	function stopProgressTracking() {
		if (rafId !== null) {
			cancelAnimationFrame(rafId);
			rafId = null;
		}
		currentPlayingIndex = null;
		progressPercent = 0;
	}

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
			await startLoopingPlayback(() => progressionState.progression, getActiveBpm());
			startProgressTracking();
		} catch (error) {
			console.error('Failed to start playback:', error);
			toast.error('Failed to play progression', {
				description: 'Please check your audio settings and try again.'
			});
			isPlaying = false;
			stopLoopingPlayback();
			stopProgressTracking();
		}
	}

	function handleStopClick() {
		isPlaying = false;
		stopLoopingPlayback();
		stopProgressTracking();
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

	// React to DAW transport (Start/Stop) when sync is enabled
	$effect(() => {
		const { clockSync } = midiState;
		if (!clockSync.enabled) return;

		if (clockSync.isExternallyPlaying) {
			if (!isPlaying && hasNonNullChords(progressionState.progression)) {
				handlePlayClick();
			}
		} else if (isPlaying) {
			handleStopClick();
		}
	});

	/**
	 * Toggle piano keyboard visibility and persist preference
	 */
	function handleTogglePiano() {
		const newVisible = !settingsState.pianoKeyboard.visible;
		setPianoVisible(newVisible);
		updatePianoVisibility(newVisible);
	}

	onDestroy(() => {
		stopProgressTracking();
		stopLoopingPlayback();
	});
</script>

<section class="space-y-6" aria-label="Chord progression canvas">
	<PlaybackControls
		{isPlaying}
		hasChords={hasNonNullChords(progressionState.progression)}
		canSave={canSaveProgression()}
		onPlay={handlePlayClick}
		onStop={handleStopClick}
		onExport={handleExportClick}
		{onSave}
		{onOpenMIDISetup}
		onTogglePiano={handleTogglePiano}
		isPianoVisible={settingsState.pianoKeyboard.visible}
	/>

	<!-- Collapsible Piano Keyboard -->
	{#if settingsState.pianoKeyboard.visible}
		<div class="animate-in fade-in slide-in-from-top-2 duration-200">
			<PianoKeyboard />
		</div>
	{/if}

	<div class="rounded-lg border bg-card/50 p-2 sm:p-3 overflow-x-auto">
		<div class="flex items-center gap-0 min-h-[280px] sm:min-h-[300px] pr-4">
			{#each progressionState.progression as slot, slotIndex (slotIndex)}
				{#if slotIndex > 0}
					<!-- Insertion area between slots -->
					<div class="relative group/insert h-64 w-6 -mx-3 z-20 flex items-center justify-center">
						<IconButton
							variant="secondary"
							size="icon-sm"
							class="size-7 rounded-full opacity-0 group-hover/insert:opacity-100 shadow-md transition-all duration-200 scale-75 group-hover/insert:scale-100 bg-primary text-primary-foreground hover:bg-primary/90"
							tooltip="Insert slot here"
							onclick={() => insertSlot(slotIndex)}
							disabled={progressionState.progression.length >= MAX_PROGRESSION_SLOTS}
						>
							<Plus class="size-4" />
						</IconButton>
					</div>
				{/if}
				<ProgressionSlot
					chord={slot}
					index={slotIndex}
					isLast={slotIndex === progressionState.progression.length - 1}
					isActiveDropTarget={activeDropIndex === slotIndex}
					isCurrentlyPlaying={currentPlayingIndex === slotIndex}
					progressPercent={currentPlayingIndex === slotIndex ? progressPercent : 0}
					onDragOver={(event) => handleDragOver(event, slotIndex)}
					onDragEnter={(event) => handleDragOver(event, slotIndex)}
					onDragLeave={() => handleDragLeave(slotIndex)}
					onDrop={(event) => handleDrop(event, slotIndex)}
				/>
			{/each}

			<!-- Add button at the end -->
			{#if progressionState.progression.length < MAX_PROGRESSION_SLOTS}
				<div class="flex items-center justify-center px-4 border-l border-border h-32 ml-2">
					<Button
						variant="ghost"
						class="flex flex-col gap-2 h-32 w-24 text-muted-foreground hover:text-primary hover:bg-primary/5 border-2 border-dashed border-border hover:border-primary/30 rounded-lg transition-all"
						onclick={() => addSlot()}
					>
						<Plus class="size-6" />
						<span class="text-xs font-medium">Add Slot</span>
					</Button>
				</div>
			{/if}
		</div>
	</div>
</section>
