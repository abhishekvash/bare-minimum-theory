<script lang="ts" module>
	export interface ChordProgressionAPI {
		play: () => void;
		stop: () => void;
		isPlaying: () => boolean;
	}
</script>

<script lang="ts">
	import { onDestroy, untrack } from 'svelte';
	import PlaybackControls from '$lib/components/PlaybackControls.svelte';
	import ProgressionSlot from '$lib/components/ProgressionSlot.svelte';
	import ChordInspector from '$lib/components/ChordInspector.svelte';
	import PianoKeyboard from '$lib/components/PianoKeyboard.svelte';
	import {
		progressionState,
		canSaveProgression,
		materializeSlotsUpTo,
		placeChordAt,
		moveChord,
		moveChordToNewSlot,
		MAX_PROGRESSION_SLOTS,
		MIN_PROGRESSION_SLOTS,
		hasNonNullChords,
		insertSlot,
		insertSlotWithChord,
		addSlot
	} from '$lib/stores/progression.svelte';
	import {
		acknowledgeQueuedSlotOnArrival,
		deselectSlot,
		getReadyChord,
		uiState
	} from '$lib/stores/ui.svelte';
	import { settingsState, setPianoVisible } from '$lib/stores/settings.svelte';
	import { midiState } from '$lib/stores/midi.svelte';
	import { updatePianoVisibility } from '$lib/utils/piano-settings-persistence';
	import { isRenderableChord, type Chord } from '$lib/utils/theory-engine';
	import {
		getTransportStatus,
		startLoopingPlayback,
		stopLoopingPlayback,
		getPlaybackProgress,
		getCurrentBpm
	} from '$lib/utils/audio-playback';
	import { exportToMIDI } from '$lib/utils/midi-export';
	import { toast } from 'svelte-sonner';
	import { IconButton } from '$lib/components/ui/icon-button';
	import Plus from 'lucide-svelte/icons/plus';
	import { cn } from '$lib/utils';

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

	let activeDropIndex = $state<number | null>(null);
	let activeInsertIndex = $state<number | null>(null);
	// audio-playback owns the transport lifecycle; this is its reactive mirror
	const isPlaying = $derived(uiState.transportActive);
	let isGlobalDragging = $state(false);
	let currentPlayingIndex = $state<number | null>(null);
	let previousPlayingIndex: number | null = null;
	let progressPercent = $state(0);
	let rafId: number | null = null;

	const readyChord = $derived(getReadyChord());

	const displaySlots = $derived.by(() => {
		const actual = progressionState.progression;
		if (actual.length >= MIN_PROGRESSION_SLOTS) return actual;
		const padded = [...actual];
		while (padded.length < MIN_PROGRESSION_SLOTS) {
			padded.push(null);
		}
		return padded;
	});

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
		const progress = getPlaybackProgress();
		if (progress) {
			acknowledgeQueuedSlotOnArrival(progress.chordIndex, previousPlayingIndex);
			previousPlayingIndex = progress.chordIndex;
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
		previousPlayingIndex = null;
		progressPercent = 0;
	}

	/** Parse and completely validate an untrusted external chord payload. */
	function parseChordPayload(payload: string): Chord | null {
		try {
			const data = JSON.parse(payload);
			return isRenderableChord(data) ? data : null;
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
					// A padded placeholder isn't a real slot yet: create it (and any gap) first.
					if (toIndex >= progressionState.progression.length) {
						if (!materializeSlotsUpTo(toIndex)) return;
						addSlot();
					}
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

		placeChordAt(toIndex, chord);
	}

	/**
	 * Whether another slot can still be created
	 */
	const isAtSlotCap = $derived(progressionState.progression.length >= MAX_PROGRESSION_SLOTS);

	function handleInsertDragOver(event: DragEvent, index: number) {
		// At the cap there is nothing to insert into, so the zone stays inert and the slots behind
		// it keep receiving the drag
		if (isAtSlotCap) return;

		event.preventDefault();
		if (event.dataTransfer) {
			event.dataTransfer.dropEffect = event.dataTransfer.types.includes('progression-chord')
				? 'move'
				: 'copy';
		}
		activeInsertIndex = index;
	}

	function handleInsertDragLeave(index: number) {
		if (activeInsertIndex === index) {
			activeInsertIndex = null;
		}
	}

	/**
	 * Drop on an insertion point: the chord lands in a brand-new slot rather than replacing one.
	 * A chord dragged out of the canvas moves — its old slot is left behind as a rest — which the
	 * store does as one mutation so the chord can never be cleared without having landed.
	 */
	function handleInsertDrop(event: DragEvent, index: number) {
		event.preventDefault();
		activeInsertIndex = null;

		const progressionPayload = event.dataTransfer?.getData('progression-chord');
		if (progressionPayload) {
			try {
				const data = JSON.parse(progressionPayload);
				if (typeof data.fromIndex === 'number') {
					moveChordToNewSlot(data.fromIndex, index);
					return;
				}
			} catch (error) {
				console.warn('Failed to parse progression chord data', error);
			}
		}

		const builderPayload = event.dataTransfer?.getData('application/json');
		if (!builderPayload) return;

		const chord = parseChordPayload(builderPayload);
		if (!chord) return;

		// The insertion point may name a padded display slot that has no real slot behind it yet
		if (!materializeSlotsUpTo(index)) return;

		insertSlotWithChord(index, chord);
	}

	/**
	 * Clicking the canvas anywhere but on a block (or one of its controls) closes the inspector
	 */
	function handleCanvasClick(event: MouseEvent) {
		const target = event.target as HTMLElement | null;
		if (target?.closest('[data-slot="chord-block"], button')) return;

		deselectSlot();
	}

	async function handlePlayClick() {
		if (getTransportStatus() !== 'stopped') return;

		try {
			await startLoopingPlayback(() => progressionState.progression, getActiveBpm());
		} catch (error) {
			// audio-playback only rethrows for the start that still owns the transport
			console.error('Failed to start playback:', error);
			toast.error('Failed to play progression', {
				description: 'Please check your audio settings and try again.'
			});
			stopLoopingPlayback();
		}
	}

	function handleStopClick() {
		stopLoopingPlayback();
	}

	// Progress tracking follows the transport. Untracked so the RAF tick's store reads (queued
	// slots) never restart tracking and drop the previous-slot memory.
	$effect(() => {
		if (!isPlaying) return;
		untrack(startProgressTracking);
		return stopProgressTracking;
	});

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

	// DAW Start is an event, not a level. Plain (non-reactive) state so only real transport
	// transitions arm a start: a local Stop or a failed MIDI start must not be undone by the
	// DAW still reporting "playing".
	let wasExternallyPlaying = false;
	let awaitingDawStart = false;

	// React to DAW transport (Start/Stop) when sync is enabled
	$effect(() => {
		const { clockSync } = midiState;
		// Enabled-but-waiting still permits local transport. The DAW mirror owns start/stop only
		// while clock messages are genuinely arriving.
		if (!clockSync.enabled || !clockSync.isReceivingClock) {
			wasExternallyPlaying = false;
			awaitingDawStart = false;
			return;
		}

		const externallyPlaying = clockSync.isExternallyPlaying;
		if (externallyPlaying && !wasExternallyPlaying) awaitingDawStart = true;
		wasExternallyPlaying = externallyPlaying;

		if (externallyPlaying) {
			// Already playing: the Start is satisfied, so a later local Stop stays stopped.
			if (isPlaying || getTransportStatus() !== 'stopped') awaitingDawStart = false;
			// An empty progression keeps the start armed until the first chord lands.
			else if (awaitingDawStart && hasNonNullChords(progressionState.progression)) {
				awaitingDawStart = false;
				handlePlayClick();
			}
		} else {
			awaitingDawStart = false;
			if (isPlaying || getTransportStatus() !== 'stopped') handleStopClick();
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

	$effect(() => {
		const onDragStart = () => (isGlobalDragging = true);
		const onDragEnd = () => {
			isGlobalDragging = false;
			activeInsertIndex = null;
		};

		window.addEventListener('dragstart', onDragStart);
		window.addEventListener('dragend', onDragEnd);

		return () => {
			window.removeEventListener('dragstart', onDragStart);
			window.removeEventListener('dragend', onDragEnd);
		};
	});

	onDestroy(() => {
		handleStopClick();
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

	<div class="relative">
		<div
			class="rounded-lg border bg-card/50 p-2 sm:p-3 overflow-x-auto"
			onclick={handleCanvasClick}
			role="presentation"
		>
			<!-- Minimal blocks need far less height than the old ten-control ones did -->
			<div class="flex items-stretch gap-0 min-h-[150px] sm:min-h-[170px]">
				{#each displaySlots as slot, slotIndex (slotIndex)}
					{#if slotIndex > 0}
						<!--
							Insertion area between slots. At rest it is the hover-revealed "+"; during a drag
							the button gives way to the drop zone it stands for, which inserts a filled slot.
						-->
						<div
							class={cn(
								'relative group/insert w-6 -mx-3 z-20 flex items-center justify-center self-stretch',
								isGlobalDragging && isAtSlotCap && 'pointer-events-none'
							)}
							data-slot="insert-point"
							data-insert-index={slotIndex}
							ondragover={(event) => handleInsertDragOver(event, slotIndex)}
							ondragenter={(event) => handleInsertDragOver(event, slotIndex)}
							ondragleave={() => handleInsertDragLeave(slotIndex)}
							ondrop={(event) => handleInsertDrop(event, slotIndex)}
							role="presentation"
						>
							{#if isGlobalDragging}
								<div
									class={cn(
										'w-1 self-stretch my-2 rounded-full transition-colors',
										activeInsertIndex === slotIndex ? 'bg-primary' : 'bg-transparent'
									)}
									aria-hidden="true"
								></div>
							{:else}
								<IconButton
									variant="secondary"
									size="icon-sm"
									class="size-7 rounded-full opacity-0 group-hover/insert:opacity-100 shadow-md transition-all scale-75 group-hover/insert:scale-100 bg-primary text-primary-foreground hover:bg-primary/90"
									tooltip="Insert slot here"
									onclick={() => insertSlot(slotIndex)}
									disabled={isAtSlotCap}
								>
									<Plus class="size-4" />
								</IconButton>
							{/if}
						</div>
					{/if}
					<ProgressionSlot
						chord={slot}
						index={slotIndex}
						isLast={slotIndex === displaySlots.length - 1}
						isActiveDropTarget={activeDropIndex === slotIndex}
						isCurrentlyPlaying={currentPlayingIndex === slotIndex}
						progressPercent={currentPlayingIndex === slotIndex ? progressPercent : 0}
						{readyChord}
						onDragOver={(event) => handleDragOver(event, slotIndex)}
						onDragEnter={(event) => handleDragOver(event, slotIndex)}
						onDragLeave={() => handleDragLeave(slotIndex)}
						onDrop={(event) => handleDrop(event, slotIndex)}
					/>
				{/each}

				<!-- Add slot button at the end -->
				{#if !isAtSlotCap}
					<div class="flex items-center justify-center px-4 border-l border-border self-stretch">
						<IconButton
							variant="secondary"
							size="icon"
							class="size-10 rounded-full bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition-all"
							tooltip="Add slot"
							onclick={() => addSlot()}
						>
							<Plus class="size-5" />
						</IconButton>
					</div>
				{/if}
			</div>
		</div>
	</div>

	<!-- One inspector for the whole canvas: it claims height below the card, never covers a block -->
	<ChordInspector />
</section>
