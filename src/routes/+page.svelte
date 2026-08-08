<script lang="ts">
	import { onMount, onDestroy, tick } from 'svelte';
	import ChordBuilder from '$lib/components/ChordBuilder.svelte';
	import ChordProgression from '$lib/components/ChordProgression.svelte';
	import LibraryRail, { requestProgressionLoad } from '$lib/components/LibraryRail.svelte';
	import HelpModal from '$lib/components/HelpModal.svelte';
	import MIDISetupModal from '$lib/components/MIDISetupModal.svelte';
	import SaveProgressionModal from '$lib/components/SaveProgressionModal.svelte';
	import LoadConfirmationDialog from '$lib/components/LoadConfirmationDialog.svelte';
	import { Button } from '$lib/components/ui/button';
	import { CircleHelp, Heart } from 'lucide-svelte';
	import {
		progressionState,
		canSaveProgression,
		addSavedProgression,
		removeSavedProgression,
		updateAvailableTags,
		loadProgressionToCanvas,
		selectRoot,
		selectQuality,
		addChord,
		createCandidateChord,
		insertChordAt
	} from '$lib/stores/progression.svelte';
	import {
		createKeyboardState,
		handleKeyboardEvent,
		type KeyboardCallbacks
	} from '$lib/utils/keyboard-shortcuts';
	import type { Chord, ChordQuality } from '$lib/utils/theory-engine/types';
	import {
		closeActivePopover,
		closeLibraryPanel,
		deselectSlot,
		revertAudition,
		selectSlot,
		setBrowseQuality,
		stageCandidate,
		uiState
	} from '$lib/stores/ui.svelte';
	import { getChordNotes } from '$lib/utils/theory-engine/chord-operations';
	import { disposeAudio } from '$lib/utils/audio-playback';
	import { auditionChord, auditionNotes, resolveTargetSlot } from '$lib/utils/audition-controller';
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
	function createChordFromBuilder(targetSlot?: number): Chord | null {
		const { selectedRoot, selectedQuality } = progressionState.builderState;
		if (selectedRoot === null || selectedQuality === null) return null;
		if (targetSlot !== undefined) {
			return createCandidateChord(selectedRoot, selectedQuality, targetSlot);
		}
		return {
			root: selectedRoot,
			quality: selectedQuality,
			inversion: 0,
			voicing: 'close',
			octave: 0,
			duration: '1m'
		};
	}

	function focusElement(selector: string): void {
		void tick().then(() => document.querySelector<HTMLElement>(selector)?.focus());
	}

	function focusInspector(): void {
		focusElement('[data-slot="chord-inspector"]');
	}

	function closeInspectorAndRestoreFocus(): void {
		const slot = uiState.selectedSlot;
		if (uiState.activePopover === 'inspector-randomize') closeActivePopover();
		deselectSlot();
		if (slot !== null) {
			focusElement(`[data-chord-index="${slot}"] [data-slot-selection]`);
		}
	}

	function closeLibraryAndRestoreFocus(): void {
		const section = uiState.libraryPanel.open;
		closeLibraryPanel();
		if (section) focusElement(`[data-library-section="${section}"]`);
	}

	function closeTopOverlay(): void {
		if (loadConfirmOpen) handleCancelLoad();
		else if (saveModalOpen) saveModalOpen = false;
		else if (midiSetupOpen) midiSetupOpen = false;
		else if (helpModalOpen) helpModalOpen = false;
		else closeActivePopover();
	}

	function selectBuilderRoot(midiNote: number, shouldAudition: boolean): void {
		selectRoot(midiNote);
		const quality = progressionState.builderState.selectedQuality;
		if (!shouldAudition || quality === null) return;
		const targetSlot = resolveTargetSlot();
		auditionChord(createCandidateChord(midiNote, quality, targetSlot), {
			mode: 'click',
			targetSlot
		});
	}

	function selectBuilderQuality(quality: ChordQuality, shouldAudition: boolean): void {
		selectQuality(quality);
		const root = progressionState.builderState.selectedRoot;
		if (!shouldAudition || root === null) return;
		const targetSlot = resolveTargetSlot();
		auditionChord(createCandidateChord(root, quality, targetSlot), {
			mode: 'click',
			targetSlot
		});
	}

	function handleKeydown(event: KeyboardEvent) {
		const target = event.target as HTMLElement;
		const isTyping =
			['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable;
		// Escape still walks the surface stack from a focused dialog/popover field.
		if (isTyping && event.key !== 'Escape') return;

		const callbacks: KeyboardCallbacks = {
			onPlayStop: () => {
				if (chordProgressionRef?.getIsPlaying()) chordProgressionRef.stop();
				else chordProgressionRef?.play();
			},
			onStop: () => chordProgressionRef?.stop(),
			onSave: () => openSaveModal(),
			onExport: () => chordProgressionRef && exportToMIDI([...progressionState.progression]),
			onHelp: () => (helpModalOpen = true),
			onRevertAudition: () => revertAudition(),
			onCloseInspector: closeInspectorAndRestoreFocus,
			onCloseLibrary: closeLibraryAndRestoreFocus,
			onCloseOverlay: closeTopOverlay,
			onSelectSlot: (slotIndex) => {
				selectSlot(slotIndex);
				const chord = progressionState.progression[slotIndex];
				if (chord) auditionNotes(getChordNotes(chord));
				focusInspector();
			},
			onSelectRoot: selectBuilderRoot,
			onSelectQuality: selectBuilderQuality,
			onBrowseQuality: (quality) => setBrowseQuality(quality),
			onStageQuality: (quality) => {
				selectQuality(quality);
				setBrowseQuality(quality);
				const slot = uiState.selectedSlot;
				const root = progressionState.builderState.selectedRoot;
				if (slot !== null && root !== null) {
					stageCandidate(slot, createCandidateChord(root, quality, slot));
				}
			},
			onFocusRoot: (index) => focusElement(`[data-root="${60 + index}"]`),
			onFocusQuality: (index) => {
				void tick().then(() =>
					document.querySelectorAll<HTMLElement>('[data-quality]')[index]?.focus()
				);
			},
			onAddChord: () => {
				const chord = createChordFromBuilder();
				if (chord) addChord(chord);
			},
			onReplaceSlot: (slotIndex) => {
				const chord = createChordFromBuilder(slotIndex);
				if (chord) insertChordAt(slotIndex, chord);
			},
			hasPendingAudition: () => uiState.audition !== null,
			hasInspector: () => uiState.selectedSlot !== null,
			hasLibraryPanel: () => uiState.libraryPanel.open !== null,
			hasOverlay: () =>
				helpModalOpen ||
				midiSetupOpen ||
				saveModalOpen ||
				loadConfirmOpen ||
				uiState.activePopover !== null,
			selectedSlot: () => uiState.selectedSlot,
			isPlaying: () => uiState.transportActive,
			canSave: () => canSaveProgression(),
			hasChordSelected: () =>
				progressionState.builderState.selectedRoot !== null &&
				progressionState.builderState.selectedQuality !== null
		};

		if (handleKeyboardEvent(event, keyboardState, callbacks)) {
			event.preventDefault();
			event.stopPropagation();
		}
	}

	onMount(async () => {
		// Add global keyboard listener
		window.addEventListener('keydown', handleKeydown, true);

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
		// An empty canvas has nothing to lose, so it loads straight away
		requestProgressionLoad(progressionState.progression, progression, {
			onLoad: (target) => loadProgressionToCanvas(target.progression),
			onConfirm: (target) => {
				progressionToLoad = target;
				loadConfirmOpen = true;
			}
		});
	}

	function handleConfirmLoad() {
		if (progressionToLoad) {
			loadProgressionToCanvas(progressionToLoad.progression);
		}
		loadConfirmOpen = false;
		progressionToLoad = null;
	}

	function handleCancelLoad() {
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
			window.removeEventListener('keydown', handleKeydown, true);
		}
		stopClockListener();
		disposeMIDIClock();
		disposeAudio();
		disposeMIDI();
	});
</script>

<div class="relative flex h-screen flex-col overflow-hidden bg-background">
	<!-- Decorative atmosphere stays outside the layout tree so the fixed mobile rail remains viewport-bound. -->
	<div
		class="pointer-events-none absolute -top-32 left-1/4 h-[500px] w-[500px] rounded-full bg-primary/4 blur-[100px]"
	></div>
	<div
		class="pointer-events-none absolute right-1/3 bottom-0 h-[400px] w-[400px] rounded-full bg-accent/3 blur-[120px]"
	></div>
	<div
		class="pointer-events-none absolute top-1/3 right-[15%] h-[200px] w-[200px] rounded-full bg-[oklch(0.55_0.1_190/0.025)] blur-[80px]"
	></div>
	<div
		class="pointer-events-none absolute bottom-1/3 left-[10%] h-[150px] w-[150px] rounded-full bg-[oklch(0.5_0.08_190/0.02)] blur-[60px]"
	></div>
	<div
		class="pointer-events-none absolute top-2/3 right-[40%] h-[120px] w-[120px] rounded-full bg-[oklch(0.6_0.06_190/0.02)] blur-[50px]"
	></div>

	<header
		class="relative z-10 shrink-0 border-b border-border/20 bg-transparent"
		data-layout-region="header"
	>
		<div class="container mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-8">
			<div>
				<h1 class="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
					Bare Minimum Theory
				</h1>
				<p class="text-xs text-muted-foreground sm:text-sm">Build chord progressions, your way.</p>
			</div>
			<Button
				variant="outline"
				onclick={() => (helpModalOpen = true)}
				class="glass gap-2 border-border/50"
			>
				<CircleHelp class="size-4" />
				Help
			</Button>
		</div>
	</header>

	<div class="min-h-0 flex-1 overflow-y-auto" data-layout-region="page-scroll">
		<div class="container mx-auto flex min-h-full max-w-7xl flex-col px-4 py-5 sm:px-8 sm:py-6">
			<main class="flex flex-1 flex-row gap-4 lg:gap-6" data-layout-region="workspace">
				<div class="min-w-0 flex-1 space-y-6 lg:space-y-8" data-layout-region="main-column">
					<div data-layout-region="builder">
						<ChordBuilder />
					</div>
					<div data-layout-region="playback-canvas-inspector">
						<ChordProgression
							bind:this={chordProgressionRef}
							onOpenMIDISetup={openMIDISetup}
							onSave={openSaveModal}
						/>
					</div>
				</div>

				<LibraryRail
					onLoadProgression={handleLoadRequest}
					onDeleteProgression={handleDeleteProgression}
					onExportProgression={handleExportSavedProgression}
				/>
			</main>

			<footer
				class="mt-8 flex items-center justify-center gap-1 border-t border-border/20 pt-5 text-center text-xs text-muted-foreground"
				data-layout-region="page-footer"
			>
				Made with <Heart class="size-3 fill-current" /> by
				<a
					href="https://github.com/abhishekvash"
					target="_blank"
					rel="noopener noreferrer"
					class="underline underline-offset-4 transition-colors hover:text-foreground"
					>abhishekvash</a
				>
			</footer>
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
	onCancel={handleCancelLoad}
/>
