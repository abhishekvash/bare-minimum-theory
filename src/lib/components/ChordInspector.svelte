<script lang="ts" module>
	/**
	 * Chord Inspector
	 * The single home of per-chord editing. One instance is docked below the canvas card and
	 * follows `uiState.selectedSlot` (a placeholder when nothing is selected), so the blocks
	 * themselves can stay calm: name, duration,
	 * a customization marker and their hover affordances.
	 *
	 * The duration labels, the customization test and the delete action it shares with
	 * `ChordBlock` live in `theory-engine/display` and the UI store, so both render the same
	 * words the inspector edits.
	 */

	import { CHORD_DURATIONS } from '$lib/utils/theory-engine';

	/** Durations the stepper walks, smallest to largest in 1/8-bar increments. */
	export const DURATION_OPTIONS = CHORD_DURATIONS;

	export const INVERSION_LABELS = ['Root', '1st', '2nd', '3rd', '4th', '5th', '6th'];

	export const VOICING_LABELS: Record<string, string> = {
		close: 'Close',
		open: 'Open',
		drop2: 'Drop 2',
		drop3: 'Drop 3'
	};
</script>

<script lang="ts">
	import { focusSlotAfterClose } from '$lib/utils/focus-restore';
	import { Button } from '$lib/components/ui/button';
	import { IconButton } from '$lib/components/ui/icon-button';
	import * as Select from '$lib/components/ui/select';
	import {
		progressionState,
		randomizeChord,
		removeSlot,
		canRemoveSlot,
		setDuration,
		setInversion,
		setVoicing,
		transposeOctave
	} from '$lib/stores/progression.svelte';
	import {
		deleteChordFromSlot,
		deselectSlot,
		getReplacementChord,
		openSettings,
		replaceSelectedWithReadyChord,
		uiState
	} from '$lib/stores/ui.svelte';
	import {
		DURATION_LABELS,
		QUALITIES,
		VOICING_PRESETS,
		getChordName,
		getChordNotes
	} from '$lib/utils/theory-engine';
	import { auditionNotes } from '$lib/utils/audition-controller';
	import Minus from 'lucide-svelte/icons/minus';
	import Plus from 'lucide-svelte/icons/plus';
	import Play from 'lucide-svelte/icons/play';
	import Settings from 'lucide-svelte/icons/settings';
	import Shuffle from 'lucide-svelte/icons/shuffle';
	import Trash2 from 'lucide-svelte/icons/trash-2';
	import X from 'lucide-svelte/icons/x';
	import SquareMinus from 'lucide-svelte/icons/square-minus';

	const FIELD_LABEL_CLASS = 'text-xs text-muted-foreground mb-1';

	let isPreviewing = $state(false);

	/** The inspector stays docked; with nothing selected it shows a placeholder instead of controls */
	const targetSlot = $derived(uiState.selectedSlot);
	const hasChords = $derived(progressionState.progression.some((slot) => slot !== null));
	const chord = $derived(
		targetSlot === null ? null : (progressionState.progression[targetSlot] ?? null)
	);
	const chordName = $derived(chord ? getChordName(chord) : '');
	/** Builder chord this slot can swap to (stopped, selected, different harmony), else null */
	const replacement = $derived(getReplacementChord());
	const replacementName = $derived(replacement ? getChordName(replacement) : '');

	const availableInversions = $derived(
		chord ? Array.from({ length: QUALITIES[chord.quality].length }, (_, i) => i) : []
	);
	const voicingOptions = $derived(Object.keys(VOICING_PRESETS) as (keyof typeof VOICING_PRESETS)[]);
	const currentDurationIndex = $derived(
		chord ? DURATION_OPTIONS.indexOf(chord.duration as (typeof DURATION_OPTIONS)[number]) : -1
	);
	const octaveDisplay = $derived(
		!chord
			? '0'
			: chord.octave === 0
				? '0'
				: chord.octave > 0
					? `+${chord.octave}`
					: `${chord.octave}`
	);

	/**
	 * Sound the slot's chord as it stands now.
	 * The controller returns 'suppressed' while the loop owns the transport, which is exactly the
	 * "edits re-preview only while stopped" rule — no extra guard needed here.
	 */
	function previewCurrent() {
		const index = targetSlot;
		if (index === null) return;

		const current = progressionState.progression[index];
		if (current) auditionNotes(getChordNotes(current));
	}

	function handlePreviewClick() {
		if (isPreviewing) return;

		// The sweep animation runs either way: while the loop plays it is the visual-only feedback
		// that stands in for the suppressed preview
		isPreviewing = true;
		previewCurrent();
		setTimeout(() => {
			isPreviewing = false;
		}, 1000);
	}

	function handleInversionChange(value: string) {
		if (targetSlot === null) return;
		setInversion(targetSlot, parseInt(value, 10));
		previewCurrent();
	}

	function handleVoicingChange(value: string) {
		if (targetSlot === null) return;
		setVoicing(targetSlot, value as keyof typeof VOICING_PRESETS);
		previewCurrent();
	}

	function handleDurationDecrease() {
		if (targetSlot === null || currentDurationIndex <= 0) return;
		setDuration(targetSlot, DURATION_OPTIONS[currentDurationIndex - 1]);
		previewCurrent();
	}

	function handleDurationIncrease() {
		if (targetSlot === null || currentDurationIndex >= DURATION_OPTIONS.length - 1) return;
		setDuration(targetSlot, DURATION_OPTIONS[currentDurationIndex + 1]);
		previewCurrent();
	}

	function handleTransposeDown() {
		if (targetSlot === null) return;
		transposeOctave(targetSlot, 'down');
		previewCurrent();
	}

	function handleTransposeUp() {
		if (targetSlot === null) return;
		transposeOctave(targetSlot, 'up');
		previewCurrent();
	}

	function handleRandomize() {
		if (targetSlot === null) return;
		randomizeChord(targetSlot);
		previewCurrent();
	}

	function handleCloseInspector() {
		const slot = uiState.selectedSlot;
		deselectSlot();
		if (slot !== null) focusSlotAfterClose(slot);
	}

	function handleDeleteChord() {
		if (targetSlot === null) return;
		// Deleting empties the slot (a rest); compacting is Remove slot
		deleteChordFromSlot(targetSlot);
	}

	function handleRemoveSlot() {
		if (targetSlot === null) return;
		// The store's removal hook clears the selection, which returns the inspector to its placeholder
		removeSlot(targetSlot);
	}
</script>

{#if targetSlot !== null}
	<section
		class="animate-in fade-in slide-in-from-top-2 duration-200 rounded-lg border bg-card/50 p-3 sm:p-4 outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
		data-slot="chord-inspector"
		data-tour="inspector"
		aria-label="Chord inspector"
		tabindex="-1"
	>
		<div class="flex items-start justify-between gap-3 mb-4">
			<div class="min-w-0">
				<div class="text-xs uppercase tracking-wider text-muted-foreground">
					Slot {targetSlot + 1}
				</div>
				<div class="relative inline-flex items-center gap-2">
					<span class="text-xl font-semibold">{chord ? chordName : 'Empty'}</span>
					{#if isPreviewing}
						<div
							class="absolute -bottom-1 left-0 h-0.5 bg-[var(--progress)] animate-progress-sweep"
							aria-hidden="true"
						></div>
					{/if}
				</div>
			</div>
			<div class="flex items-center gap-0.5 shrink-0">
				{#if replacement}
					<Button
						size="sm"
						class="mr-1 h-8 text-xs"
						data-inspector-replace
						onclick={() => replaceSelectedWithReadyChord()}
					>
						{chord ? `Replace with ${replacementName}` : `Place ${replacementName}`}
					</Button>
				{/if}
				{#if chord}
					<IconButton
						tooltip={`Play ${chordName}`}
						variant="ghost"
						size="icon-sm"
						class="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10"
						onclick={handlePreviewClick}
					>
						<Play class="size-4" aria-hidden="true" />
					</IconButton>
				{/if}
				<IconButton
					tooltip="Close inspector"
					variant="ghost"
					size="icon-sm"
					class="h-8 w-8 text-muted-foreground"
					onclick={handleCloseInspector}
				>
					<X class="size-4" aria-hidden="true" />
				</IconButton>
			</div>
		</div>

		{#if chord}
			<div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
				<div>
					<div class={FIELD_LABEL_CLASS}>Inversion</div>
					<Select.Root
						type="single"
						value={chord.inversion.toString()}
						onValueChange={handleInversionChange}
					>
						<Select.Trigger class="h-9 text-xs w-full">
							{INVERSION_LABELS[chord.inversion]}
						</Select.Trigger>
						<Select.Content>
							{#each availableInversions as inv (inv)}
								<Select.Item value={inv.toString()}>{INVERSION_LABELS[inv]}</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
				</div>

				<div>
					<div class={FIELD_LABEL_CLASS}>Voicing</div>
					<Select.Root type="single" value={chord.voicing} onValueChange={handleVoicingChange}>
						<Select.Trigger class="h-9 text-xs w-full">
							{VOICING_LABELS[chord.voicing]}
						</Select.Trigger>
						<Select.Content>
							{#each voicingOptions as voicing (voicing)}
								<Select.Item value={voicing}>{VOICING_LABELS[voicing]}</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
				</div>

				<div>
					<div class={FIELD_LABEL_CLASS}>Duration</div>
					<div class="flex items-center gap-1">
						<IconButton
							tooltip="Decrease duration"
							variant="outline"
							size="icon-sm"
							class="h-9 w-9"
							onclick={handleDurationDecrease}
							disabled={currentDurationIndex <= 0}
						>
							<Minus class="size-3.5" aria-hidden="true" />
						</IconButton>
						<div class="text-xs text-center min-w-[3ch] tabular-nums flex-1">
							{DURATION_LABELS[chord.duration] ?? chord.duration}
						</div>
						<IconButton
							tooltip="Increase duration"
							variant="outline"
							size="icon-sm"
							class="h-9 w-9"
							onclick={handleDurationIncrease}
							disabled={currentDurationIndex >= DURATION_OPTIONS.length - 1}
						>
							<Plus class="size-3.5" aria-hidden="true" />
						</IconButton>
					</div>
				</div>

				<div>
					<div class={FIELD_LABEL_CLASS}>Octave</div>
					<div class="flex items-center gap-1">
						<IconButton
							tooltip={`Transpose ${chordName} down one octave`}
							variant="outline"
							size="icon-sm"
							class="h-9 w-9"
							onclick={handleTransposeDown}
							disabled={chord.octave <= -2}
						>
							<Minus class="size-3.5" aria-hidden="true" />
						</IconButton>
						<div class="text-xs text-center min-w-[2ch] tabular-nums flex-1">
							{octaveDisplay}
						</div>
						<IconButton
							tooltip={`Transpose ${chordName} up one octave`}
							variant="outline"
							size="icon-sm"
							class="h-9 w-9"
							onclick={handleTransposeUp}
							disabled={chord.octave >= 2}
						>
							<Plus class="size-3.5" aria-hidden="true" />
						</IconButton>
					</div>
				</div>
			</div>
		{:else}
			<p class="text-sm text-muted-foreground">
				This slot is a rest. Drop a chord on it, or remove the slot to shorten the loop.
			</p>
		{/if}

		<div class="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-border/50">
			{#if chord}
				<div class="flex items-center gap-1">
					<Button
						variant="outline"
						size="sm"
						class="h-8 text-xs"
						aria-label={`Randomize ${chordName}`}
						onclick={handleRandomize}
					>
						<Shuffle class="size-3.5 mr-1.5" aria-hidden="true" />
						Randomize
					</Button>
					<Button
						variant="outline"
						size="icon-sm"
						class="h-8 w-8 shrink-0"
						aria-label="Randomize settings"
						title="Choose what Randomize changes"
						onclick={() => openSettings('randomize')}
					>
						<Settings class="size-3.5" aria-hidden="true" />
					</Button>
				</div>
			{/if}

			<div class="flex items-center gap-1 ml-auto">
				{#if chord}
					<Button
						variant="ghost"
						size="sm"
						class="h-8 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
						onclick={handleDeleteChord}
					>
						<Trash2 class="size-3.5 mr-1.5" aria-hidden="true" />
						Delete chord
					</Button>
				{/if}
				<Button
					variant="ghost"
					size="sm"
					class="h-8 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
					onclick={handleRemoveSlot}
					disabled={!canRemoveSlot()}
				>
					<SquareMinus class="size-3.5 mr-1.5" aria-hidden="true" />
					Remove slot
				</Button>
			</div>
		</div>
	</section>
{:else}
	<section
		class="rounded-lg border border-dashed border-border/60 bg-card/20 p-3 sm:p-4"
		data-slot="chord-inspector-placeholder"
		aria-label="Chord inspector"
	>
		<div class="text-xs uppercase tracking-wider text-muted-foreground">No chord selected</div>
		<p class="mt-1 text-sm text-muted-foreground">
			{hasChords
				? 'Select a chord in the progression to shape its inversion, voicing, duration and octave.'
				: 'Add a chord to the progression, then select it to shape its inversion, voicing, duration and octave.'}
		</p>
	</section>
{/if}
