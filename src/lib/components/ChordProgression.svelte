<script lang="ts">
	import { onDestroy, untrack } from 'svelte';
	import PlaybackControls from '#lib/components/PlaybackControls.svelte';
	import ProgressionSlot from '#lib/components/ProgressionSlot.svelte';
	import ChordInspector from '#lib/components/ChordInspector.svelte';
	import PianoKeyboard from '#lib/components/PianoKeyboard.svelte';
	import {
		progressionState,
		canSaveProgression,
		placeChordAt,
		moveChord,
		moveChordToNewSlot,
		MAX_PROGRESSION_SLOTS,
		insertSlot,
		insertSlotWithChord,
		addSlot
	} from '#lib/stores/progression.svelte.ts';
	import {
		acknowledgeQueuedSlotOnArrival,
		deselectSlot,
		getReadyChord,
		uiState
	} from '#lib/stores/ui.svelte.ts';
	import { settingsState, setPianoVisible } from '#lib/stores/settings.svelte.ts';
	import {
		initDawTransportSync,
		startProgressionPlayback,
		stopProgressionPlayback
	} from '#lib/stores/transport.svelte.ts';
	import { updatePianoVisibility } from '#lib/utils/piano-settings-persistence.ts';
	import {
		hasNonNullChords,
		parseDraggedChord,
		type Chord
	} from '#lib/utils/theory-engine/index.ts';
	import { getPlaybackProgress } from '#lib/utils/audio-playback.ts';
	import { exportToMIDI } from '#lib/utils/midi-export.ts';
	import { toast } from 'svelte-sonner';
	import { IconButton } from '#lib/components/ui/icon-button/index.ts';
	import Plus from '@lucide/svelte/icons/plus';
	import { cn } from '#lib/utils.ts';

	interface Props {
		onOpenMIDISetup?: () => void;
		onSave?: () => void;
	}

	let { onOpenMIDISetup, onSave }: Props = $props();

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

	// Every displayed slot is real; a short saved progression shows at its own length
	const displaySlots = $derived(progressionState.progression);

	/**
	 * RAF callback for progress tracking
	 * Reads Tone.Transport.seconds for perfect sync with audio
	 */
	function tick() {
		const progress = getPlaybackProgress();
		if (progress) {
			// Progress falling back inside the same slot means the loop wrapped onto it again
			const wrapped =
				progress.chordIndex === previousPlayingIndex && progress.progress < progressPercent;
			acknowledgeQueuedSlotOnArrival(progress.chordIndex, previousPlayingIndex, wrapped);
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
		const chord = parseDraggedChord(payload);
		if (!chord) console.warn('Failed to parse dropped chord');
		return chord;
	}

	/**
	 * Read the source slot of a drag that started on a canvas block.
	 * @returns The dragged block's index, or null when the drag did not come from the canvas
	 */
	function parseProgressionDrag(dataTransfer: DataTransfer | null | undefined): number | null {
		const payload = dataTransfer?.getData('progression-chord');
		if (!payload) return null;
		try {
			const data = JSON.parse(payload);
			return typeof data.fromIndex === 'number' ? data.fromIndex : null;
		} catch (error) {
			console.warn('Failed to parse progression chord data', error);
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
		endGlobalDrag();

		// Try progression-chord data first (drag from within progression)
		const fromIndex = parseProgressionDrag(event.dataTransfer);
		if (fromIndex !== null) {
			moveChord(fromIndex, toIndex);
			return;
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
		endGlobalDrag();

		const fromIndex = parseProgressionDrag(event.dataTransfer);
		if (fromIndex !== null) {
			moveChordToNewSlot(fromIndex, index);
			return;
		}

		const builderPayload = event.dataTransfer?.getData('application/json');
		if (!builderPayload) return;

		const chord = parseChordPayload(builderPayload);
		if (!chord) return;

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

	/**
	 * Toggle piano keyboard visibility and persist preference
	 */
	function handleTogglePiano() {
		const newVisible = !settingsState.pianoKeyboard.visible;
		setPianoVisible(newVisible);
		updatePianoVisibility(newVisible);
	}

	/**
	 * Ends the canvas-wide drag mode. `dragend` fires on the element the drag started from, so it
	 * never reaches the window when a drop removed that element first (a chord moved onto an empty
	 * slot, a re-keyed palette item). A drop always bubbles, so it ends the drag too.
	 */
	function endGlobalDrag() {
		isGlobalDragging = false;
		activeInsertIndex = null;
	}

	// The canvas follows the DAW's Start/Stop for as long as it is mounted
	const stopDawTransportSync = initDawTransportSync();

	onDestroy(() => {
		stopDawTransportSync();
		stopProgressionPlayback();
	});
</script>

<svelte:window
	ondragstart={() => (isGlobalDragging = true)}
	ondragend={endGlobalDrag}
	ondrop={endGlobalDrag}
/>

<section class="space-y-6" aria-label="Chord progression canvas" data-tour="canvas">
	<PlaybackControls
		{isPlaying}
		hasChords={hasNonNullChords(progressionState.progression)}
		canSave={canSaveProgression()}
		onPlay={startProgressionPlayback}
		onStop={stopProgressionPlayback}
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
