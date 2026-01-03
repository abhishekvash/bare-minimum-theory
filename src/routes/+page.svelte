<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import ChordBuilder from '$lib/components/ChordBuilder.svelte';
	import ChordProgression from '$lib/components/ChordProgression.svelte';
	import ChordPalette from '$lib/components/ChordPalette.svelte';
	import HelpModal from '$lib/components/HelpModal.svelte';
	import MIDISetupModal from '$lib/components/MIDISetupModal.svelte';
	import SaveProgressionModal from '$lib/components/SaveProgressionModal.svelte';
	import LoadConfirmationDialog from '$lib/components/LoadConfirmationDialog.svelte';
	import { Button } from '$lib/components/ui/button';
	import { CircleHelp } from 'lucide-svelte';
	import {
		progressionState,
		canSaveProgression,
		addSavedProgression,
		removeSavedProgression,
		updateAvailableTags,
		loadProgressionToCanvas,
		selectRoot,
		selectQuality,
		insertChordAt
	} from '$lib/stores/progression.svelte';
	import {
		createKeyboardState,
		handleKeyboardEvent,
		type KeyboardCallbacks
	} from '$lib/utils/keyboard-shortcuts';
	import type { Chord, ChordQuality } from '$lib/utils/theory-engine/types';
	import { getChordNotes } from '$lib/utils/theory-engine/chord-operations';
	import { playChord, disposeAudio } from '$lib/utils/audio-playback';
	import {
		saveProgression,
		deleteProgressionById,
		getAllTags,
		type SavedProgression
	} from '$lib/utils/progression-persistence';
	import { exportToMIDI } from '$lib/utils/midi-export';
	import { disposeMIDI } from '$lib/utils/midi-output';
	import { stopClockListener, disposeMIDIClock } from '$lib/utils/midi-clock';
	import { toast } from 'svelte-sonner';
	import { initializeApplication } from '$lib/app-init';

	let helpModalOpen = $state(false);
	let midiSetupOpen = $state(false);
	let saveModalOpen = $state(false);
	let loadConfirmOpen = $state(false);
	let progressionToLoad = $state<SavedProgression | null>(null);

	// Keyboard navigation state
	const keyboardState = createKeyboardState();

	// Reference to ChordProgression for play/stop control
	let chordProgressionRef: {
		play: () => void;
		stop: () => void;
		getIsPlaying: () => boolean;
	} | null = null;

	/**
	 * Helper function to create a chord from the current builder state
	 * Returns null if either root or quality is not selected
	 */
	function createChordFromBuilder(): Chord | null {
		const { selectedRoot, selectedQuality } = progressionState.builderState;
		if (selectedRoot !== null && selectedQuality !== null) {
			return {
				root: selectedRoot,
				quality: selectedQuality,
				inversion: 0,
				voicing: 'close',
				octave: 0,
				duration: '1m'
			};
		}
		return null;
	}

	function handleKeydown(event: KeyboardEvent) {
		// Ignore if typing in an input
		const target = event.target as HTMLElement;
		if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
			return;
		}

		const callbacks: KeyboardCallbacks = {
			onPlayStop: () => {
				if (chordProgressionRef?.getIsPlaying()) {
					chordProgressionRef.stop();
				} else {
					chordProgressionRef?.play();
				}
			},
			onStop: () => chordProgressionRef?.stop(),
			onSave: () => openSaveModal(),
			onExport: () => chordProgressionRef && exportToMIDI([...progressionState.progression]),
			onHelp: () => (helpModalOpen = true),
			onSelectRoot: async (midiNote: number) => {
				selectRoot(midiNote);
				// Preview if quality is selected
				if (progressionState.builderState.selectedQuality !== null) {
					const chord: Chord = {
						root: midiNote,
						quality: progressionState.builderState.selectedQuality,
						inversion: 0,
						voicing: 'close',
						octave: 0,
						duration: '1m'
					};
					await playChord(getChordNotes(chord));
				}
			},
			onSelectQuality: async (quality: ChordQuality) => {
				selectQuality(quality);
				// Preview if root is selected
				if (progressionState.builderState.selectedRoot !== null) {
					const chord: Chord = {
						root: progressionState.builderState.selectedRoot,
						quality: quality,
						inversion: 0,
						voicing: 'close',
						octave: 0,
						duration: '1m'
					};
					await playChord(getChordNotes(chord));
				}
			},
			onAddChord: () => {
				const chord = createChordFromBuilder();
				if (chord) {
					// Find first empty slot
					const emptyIndex = progressionState.progression.findIndex((c) => c === null);
					if (emptyIndex !== -1) {
						insertChordAt(emptyIndex, chord);
					}
				}
			},
			onReplaceSlot: (slotIndex: number) => {
				const chord = createChordFromBuilder();
				if (chord) {
					insertChordAt(slotIndex, chord);
				}
			},
			onPreviewSlot: async (slotIndex: number) => {
				const chord = progressionState.progression[slotIndex];
				if (chord) {
					await playChord(getChordNotes(chord));
				}
			},
			isModalOpen: () => helpModalOpen || midiSetupOpen || saveModalOpen || loadConfirmOpen,
			isPlaying: () => chordProgressionRef?.getIsPlaying() ?? false,
			canSave: () => canSaveProgression(),
			hasChordSelected: () =>
				progressionState.builderState.selectedRoot !== null &&
				progressionState.builderState.selectedQuality !== null
		};

		const handled = handleKeyboardEvent(event, keyboardState, callbacks);
		if (handled) {
			event.preventDefault();
		}
	}

	onMount(async () => {
		// Add global keyboard listener
		window.addEventListener('keydown', handleKeydown);

		// Initialize application (DB, Settings, MIDI)
		await initializeApplication();
	});

	function openMIDISetup() {
		midiSetupOpen = true;
	}

	function openSaveModal() {
		saveModalOpen = true;
	}

	async function handleSaveProgression(name: string, tags: string[]) {
		try {
			// Deep clone to strip Svelte 5 reactivity proxies
			const plainProgression = JSON.parse(JSON.stringify(progressionState.progression));
			const saved = await saveProgression(name, tags, plainProgression);
			addSavedProgression(saved);
			updateAvailableTags(await getAllTags());
			saveModalOpen = false;
			toast.success('Progression saved', {
				description: `"${saved.name}" has been saved to your library.`
			});
		} catch (error) {
			console.error('Failed to save progression:', error);
			toast.error('Failed to save progression', {
				description: 'There was an error saving your progression. Please try again.'
			});
		}
	}

	function handleLoadRequest(progression: SavedProgression) {
		progressionToLoad = progression;
		loadConfirmOpen = true;
	}

	function handleConfirmLoad() {
		if (progressionToLoad) {
			loadProgressionToCanvas(progressionToLoad.progression);
		}
		loadConfirmOpen = false;
		progressionToLoad = null;
	}

	async function handleDeleteProgression(id: string) {
		try {
			await deleteProgressionById(id);
			removeSavedProgression(id);
			updateAvailableTags(await getAllTags());
		} catch (error) {
			console.error('Failed to delete progression:', error);
		}
	}

	function handleExportSavedProgression(savedProgression: SavedProgression) {
		// Export the full progression (exportToMIDI handles nulls as rests)
		exportToMIDI(savedProgression.progression);
	}

	// Cleanup audio, MIDI, clock sync resources, and keyboard listener on page unmount
	onDestroy(() => {
		if (typeof window !== 'undefined') {
			window.removeEventListener('keydown', handleKeydown);
		}
		stopClockListener();
		disposeMIDIClock();
		disposeAudio();
		disposeMIDI();
	});
</script>

<div class="flex flex-col h-screen bg-background">
	<header class="shrink-0 border-b bg-background z-10">
		<div class="container mx-auto px-4 sm:px-8 py-4 flex items-center justify-between max-w-7xl">
			<div>
				<h1 class="text-xl sm:text-2xl font-bold tracking-tight">Bare Minimum Theory</h1>
				<p class="text-xs sm:text-sm text-muted-foreground">Build chord progressions, your way.</p>
			</div>
			<Button variant="outline" onclick={() => (helpModalOpen = true)} class="gap-2">
				<CircleHelp class="size-4" />
				Help
			</Button>
		</div>
	</header>

	<div class="flex-1 overflow-y-auto min-h-0">
		<div class="container mx-auto px-4 sm:px-8 py-6 max-w-7xl">
			<div class="flex flex-col lg:flex-row gap-8 lg:gap-12">
				<div class="flex-1 space-y-8 min-w-0">
					<ChordBuilder />
					<ChordProgression
						bind:this={chordProgressionRef}
						onOpenMIDISetup={openMIDISetup}
						onSave={openSaveModal}
					/>
				</div>

				<div
					class="w-full lg:w-80 shrink-0 lg:border-l lg:pl-12 lg:-mr-3 lg:sticky lg:top-5 lg:self-start lg:h-[calc(100vh-8.5rem)] lg:overflow-y-auto"
				>
					<ChordPalette
						onLoadProgression={handleLoadRequest}
						onDeleteProgression={handleDeleteProgression}
						onExportProgression={handleExportSavedProgression}
					/>
				</div>
			</div>
		</div>
	</div>
</div>

<HelpModal bind:open={helpModalOpen} />
<MIDISetupModal bind:open={midiSetupOpen} />
<SaveProgressionModal
	bind:open={saveModalOpen}
	availableTags={progressionState.savedProgressions.availableTags}
	onSave={handleSaveProgression}
/>
<LoadConfirmationDialog
	bind:open={loadConfirmOpen}
	progressionName={progressionToLoad?.name ?? ''}
	onConfirm={handleConfirmLoad}
/>
