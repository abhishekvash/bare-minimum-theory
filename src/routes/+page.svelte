<script lang="ts">
	import { onMount, tick } from 'svelte';
	import ChordBuilder from '#lib/components/ChordBuilder.svelte';
	import ChordProgression from '#lib/components/ChordProgression.svelte';
	import LibraryRail, { requestProgressionLoad } from '#lib/components/LibraryRail.svelte';
	import HelpModal from '#lib/components/HelpModal.svelte';
	import SettingsDialog from '#lib/components/settings/SettingsDialog.svelte';
	import MIDISetupModal from '#lib/components/MIDISetupModal.svelte';
	import SaveProgressionModal from '#lib/components/SaveProgressionModal.svelte';
	import LoadConfirmationDialog from '#lib/components/LoadConfirmationDialog.svelte';
	import { Button } from '#lib/components/ui/button/index.ts';
	import CircleHelp from '@lucide/svelte/icons/circle-question-mark';
	import Heart from '@lucide/svelte/icons/heart';
	import Settings from '@lucide/svelte/icons/settings';
	import {
		addChord,
		addSavedProgression,
		canSaveProgression,
		createCandidateChord,
		insertChordAt,
		loadProgressionToCanvas,
		progressionState,
		removeSavedProgression,
		revertAudition,
		savedLibrary,
		selectQuality,
		selectRoot,
		stageCandidate
	} from '#lib/stores/progression.svelte.ts';
	import {
		createKeyboardState,
		handleKeyboardEvent,
		resetKeyboardBrowse,
		type KeyboardCallbacks
	} from '#lib/utils/keyboard-shortcuts.ts';
	import type { ChordQuality } from '#lib/utils/theory-engine/types.ts';
	import {
		closeActivePopover,
		closeLibraryPanel,
		closeSettings,
		openSettings,
		deselectSlot,
		getReadyChord,
		selectSlot,
		setBrowseQuality,
		uiState
	} from '#lib/stores/ui.svelte.ts';
	import {
		disposeAudio,
		getTransportStatus,
		preloadAudioEngine
	} from '#lib/utils/audio-playback.ts';
	import {
		startProgressionPlayback,
		stopProgressionPlayback
	} from '#lib/stores/transport.svelte.ts';
	import {
		auditionChord,
		auditionSelection,
		resolveTargetSlot,
		setAuditionErrorHandler
	} from '#lib/utils/audition-controller.ts';
	import {
		saveProgression,
		deleteProgressionById,
		type SavedProgression
	} from '#lib/utils/progression-persistence.ts';
	import { exportToMIDI } from '#lib/utils/midi-export.ts';
	import { focusLibrarySectionAfterClose, focusSlotAfterClose } from '#lib/utils/focus-restore.ts';
	import { disposeMIDI, onMIDIError } from '#lib/utils/midi-output.ts';
	import { setMIDIConnectionState, setMIDIError } from '#lib/stores/midi.svelte.ts';
	import { stopClockListener, disposeMIDIClock } from '#lib/utils/midi-clock.ts';
	import { toast } from 'svelte-sonner';
	import { initializeApplication } from '#lib/app-init.ts';
	import { stopSettingsAutosave } from '#lib/stores/settings-autosave.svelte.ts';
	import { shouldAutoStartTour, startTour } from '#lib/utils/onboarding-tour.ts';

	let helpModalOpen = $state(false);
	let midiSetupOpen = $state(false);
	let saveModalOpen = $state(false);
	let loadConfirmOpen = $state(false);
	let progressionToLoad = $state<SavedProgression | null>(null);

	// Keyboard navigation state
	const keyboardState = createKeyboardState();
	let previousBuilderQuality = progressionState.builderState.selectedQuality;

	$effect(() => {
		const quality = progressionState.builderState.selectedQuality;
		if (!uiState.transportActive || quality !== previousBuilderQuality) {
			resetKeyboardBrowse(keyboardState);
		}
		previousBuilderQuality = quality;
	});

	function focusElement(selector: string): void {
		void tick().then(() => document.querySelector<HTMLElement>(selector)?.focus());
	}

	function focusInspector(): void {
		focusElement('[data-slot="chord-inspector"]');
	}

	function closeInspectorAndRestoreFocus(): void {
		const slot = uiState.selectedSlot;
		deselectSlot();
		if (slot !== null) focusSlotAfterClose(slot);
	}

	function closeLibraryAndRestoreFocus(): void {
		const section = uiState.libraryPanel.open;
		closeLibraryPanel();
		if (section) focusLibrarySectionAfterClose(section);
	}

	function closeTopOverlay(): void {
		if (uiState.settings.open) closeSettings();
		else if (loadConfirmOpen) handleCancelLoad();
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
		resetKeyboardBrowse(keyboardState);
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
		// The onboarding tour owns the keyboard (Escape, arrows) while it runs
		if (uiState.tourActive) return;
		const target = event.target as HTMLElement;
		const isTyping =
			['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable;
		// Escape still walks the surface stack from a focused dialog/popover field.
		if (isTyping && event.key !== 'Escape') return;

		const callbacks: KeyboardCallbacks = {
			onPlayStop: () => {
				if (getTransportStatus() !== 'stopped') {
					resetKeyboardBrowse(keyboardState);
					stopProgressionPlayback();
				} else startProgressionPlayback();
			},
			onStop: () => {
				resetKeyboardBrowse(keyboardState);
				stopProgressionPlayback();
			},
			onSave: () => openSaveModal(),
			onExport: () => exportToMIDI([...progressionState.progression]),
			onHelp: () => (helpModalOpen = true),
			onRevertAudition: () => revertAudition(),
			onCloseInspector: closeInspectorAndRestoreFocus,
			onCloseLibrary: closeLibraryAndRestoreFocus,
			onCloseOverlay: closeTopOverlay,
			onSelectSlot: (slotIndex) => {
				if (!selectSlot(slotIndex)) return false;
				const chord = progressionState.progression[slotIndex];
				if (chord) auditionSelection(chord);
				focusInspector();
				return true;
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
				const chord = getReadyChord();
				if (chord) addChord(chord);
			},
			onReplaceSlot: (slotIndex) => {
				const chord = getReadyChord();
				if (chord) insertChordAt(slotIndex, chord);
			},
			hasPendingAudition: () => progressionState.audition !== null,
			hasInspector: () => uiState.selectedSlot !== null,
			hasLibraryPanel: () => uiState.libraryPanel.open !== null,
			hasOverlay: () =>
				helpModalOpen ||
				midiSetupOpen ||
				uiState.settings.open ||
				saveModalOpen ||
				loadConfirmOpen ||
				uiState.activePopover !== null,
			selectedSlot: () => uiState.selectedSlot,
			isPlaying: () => uiState.transportActive,
			canSave: () => canSaveProgression(),
			hasChordSelected: () =>
				progressionState.builderState.selectedRoot !== null &&
				progressionState.builderState.selectedQuality !== null,
			qualityGridColumns: () => {
				const grid = document.querySelector<HTMLElement>('[data-quality-grid]');
				if (!grid) return 6;
				const template = getComputedStyle(grid).gridTemplateColumns.trim();
				// `none` (not laid out as a grid yet) is a keyword, not a one-column track list
				if (!template || template === 'none') return 6;
				return template.split(' ').filter(Boolean).length || 6;
			}
		};

		if (handleKeyboardEvent(event, keyboardState, callbacks)) {
			event.preventDefault();
			event.stopPropagation();
		}
	}

	// onMount, not onDestroy: onDestroy also runs during server rendering, and this teardown is
	// browser-only. The async start-up is kicked off without blocking the cleanup registration.
	onMount(() => {
		setAuditionErrorHandler((error) => {
			console.error('Failed to initialize audition audio:', error);
			toast.error('Failed to preview chord', {
				description: 'Please check your audio settings and try again.'
			});
		});
		const unsubscribeMIDIError = onMIDIError(({ kind, error }) => {
			console.error('MIDI playback failed:', error);
			setMIDIError(kind === 'connection' ? 'disconnected' : 'output_failed');
			setMIDIConnectionState(false);
			stopProgressionPlayback();
			toast.error(kind === 'connection' ? 'MIDI output disconnected' : 'MIDI playback stopped', {
				description:
					kind === 'playback'
						? 'The progression could not be rendered for MIDI playback.'
						: 'Reconnect the device or use internal audio, then try again.'
			});
		});

		// Warm up the audio engine straight away, independent of start-up (which can wait on a MIDI
		// permission prompt), so the first Play starts inside the click that asked for it. A failure
		// is not fatal: initAudio() loads it on first use, unlocking audio inside that gesture.
		preloadAudioEngine().catch((error) => console.warn('Audio engine preload failed:', error));

		void startApplication();

		// Release audio, MIDI and clock sync resources when the page goes away
		return () => {
			stopSettingsAutosave();
			setAuditionErrorHandler(null);
			unsubscribeMIDIError();
			stopClockListener();
			disposeMIDIClock();
			disposeAudio();
			disposeMIDI();
		};
	});

	/** Initialize the DB, settings and MIDI, then offer first-time visitors the tour */
	async function startApplication(): Promise<void> {
		await initializeApplication();

		// First-time visitors with no work yet get the tour once the layout has settled
		if (shouldAutoStartTour()) {
			await tick();
			void startTour();
		}
	}

	function openMIDISetup() {
		midiSetupOpen = true;
	}

	function openSaveModal() {
		saveModalOpen = true;
	}

	async function handleSaveProgression(name: string, tags: string[]): Promise<boolean> {
		try {
			// A plain copy for IndexedDB's structured clone (state proxies can't be cloned)
			const plainProgression = $state.snapshot(progressionState.progression);
			const saved = await saveProgression(name, tags, plainProgression);
			addSavedProgression(saved);
			saveModalOpen = false;
			toast.success('Progression saved', {
				description: `"${saved.name}" has been saved to your library.`
			});
			return true;
		} catch (error) {
			console.error('Failed to save progression:', error);
			toast.error('Failed to save progression', {
				description: 'There was an error saving your progression. Please try again.'
			});
			return false;
		}
	}

	function loadSavedProgression(progression: SavedProgression): void {
		resetKeyboardBrowse(keyboardState);
		stopProgressionPlayback();
		loadProgressionToCanvas(progression.progression);
	}

	function handleLoadRequest(progression: SavedProgression) {
		// An empty canvas has nothing to lose, so it loads straight away
		requestProgressionLoad(progressionState.progression, progression, {
			onLoad: loadSavedProgression,
			onConfirm: (target) => {
				progressionToLoad = target;
				loadConfirmOpen = true;
			}
		});
	}

	function handleConfirmLoad() {
		if (progressionToLoad) loadSavedProgression(progressionToLoad);
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
		} catch (error) {
			console.error('Failed to delete progression:', error);
		}
	}

	function handleExportSavedProgression(savedProgression: SavedProgression) {
		// Export the full progression (exportToMIDI handles nulls as rests)
		exportToMIDI(savedProgression.progression);
	}
</script>

<!-- Nested controls receive keyboard events first; the page handles only unconsumed keys -->
<svelte:window onkeydown={handleKeydown} />

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
			<div class="flex items-center gap-2">
				<Button
					variant="outline"
					onclick={() => openSettings()}
					class="glass gap-2 border-border/50"
				>
					<Settings class="size-4" />
					Settings
				</Button>
				<Button
					variant="outline"
					onclick={() => (helpModalOpen = true)}
					class="glass gap-2 border-border/50"
				>
					<CircleHelp class="size-4" />
					Help
				</Button>
			</div>
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
						<ChordProgression onOpenMIDISetup={openMIDISetup} onSave={openSaveModal} />
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
<SettingsDialog />
<SaveProgressionModal
	bind:open={saveModalOpen}
	availableTags={savedLibrary.availableTags}
	onSave={handleSaveProgression}
/>
<LoadConfirmationDialog
	bind:open={loadConfirmOpen}
	progressionName={progressionToLoad?.name ?? ''}
	onConfirm={handleConfirmLoad}
	onCancel={handleCancelLoad}
/>
