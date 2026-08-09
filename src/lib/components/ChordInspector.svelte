<script lang="ts" module>
	/**
	 * Chord Inspector
	 * The single home of per-chord editing. One instance is docked below the canvas card and
	 * follows `uiState.selectedSlot`, so the blocks themselves can stay calm: name, duration,
	 * a customization marker and their hover affordances.
	 *
	 * The module block owns the vocabulary the canvas shares with the inspector (duration
	 * options/labels, the customization test, the delete action) so `ChordBlock` renders the
	 * same words the inspector edits.
	 */

	import { CHORD_DURATIONS, type Chord } from '$lib/utils/theory-engine';
	import { clearChordAt } from '$lib/stores/progression.svelte';
	import { deselectSlot, uiState } from '$lib/stores/ui.svelte';

	/** Durations the stepper walks, smallest to largest in 1/8-bar increments. */
	export const DURATION_OPTIONS = CHORD_DURATIONS;

	/** Bar-relative label for each duration */
	export const DURATION_LABELS: Record<string, string> = {
		'8n': '1/8',
		'4n': '1/4',
		'4n.': '3/8',
		'2n': '1/2',
		'0:2:2': '5/8',
		'2n.': '3/4',
		'0:3:2': '7/8',
		'1m': '1',
		'1:0:2': '1+1/8',
		'1:1:0': '1+1/4',
		'1:1:2': '1+3/8',
		'1:2:0': '1+1/2',
		'1:2:2': '1+5/8',
		'1:3:0': '1+3/4',
		'1:3:2': '1+7/8',
		'2m': '2'
	};

	export const INVERSION_LABELS = ['Root', '1st', '2nd', '3rd', '4th', '5th', '6th'];

	export const VOICING_LABELS: Record<string, string> = {
		close: 'Close',
		open: 'Open',
		drop2: 'Drop 2',
		drop3: 'Drop 3'
	};

	/** Voicing every chord starts on — anything else counts as a customization */
	const DEFAULT_VOICING = 'close';

	/**
	 * Spell a duration out for the block's resting label: whole bars read as words, everything
	 * else stays the bare fraction so the block keeps its calm.
	 * @param duration - Duration in Tone.js notation
	 * @returns Label such as `1 bar`, `2 bars` or `3/4`
	 */
	export function formatDuration(duration: string): string {
		const label = DURATION_LABELS[duration] ?? duration;
		if (label === '1') return '1 bar';
		if (label === '2') return '2 bars';
		return label;
	}

	/**
	 * Whether a chord has been shaped away from the defaults — what the block's marker dot means.
	 * Duration is deliberately excluded: the block already shows it as a label.
	 * @param chord - Chord to test
	 * @returns true when inversion, voicing or octave differ from the defaults
	 */
	export function isCustomizedChord(chord: Chord): boolean {
		return chord.inversion !== 0 || chord.voicing !== DEFAULT_VOICING || chord.octave !== 0;
	}

	/**
	 * Delete the chord in a slot, leaving a rest behind, and close the inspector when that slot
	 * was the one being edited. Shared by the block's hover delete and the inspector's action so
	 * neither can leave the inspector pointed at a chord that no longer exists.
	 * @param index - Slot index
	 */
	export function deleteChordFromSlot(index: number): void {
		clearChordAt(index);
		if (uiState.selectedSlot === index) deselectSlot();
	}
</script>

<script lang="ts">
	import { tick } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import { IconButton } from '$lib/components/ui/icon-button';
	import * as Select from '$lib/components/ui/select';
	import * as Popover from '$lib/components/ui/popover';
	import {
		progressionState,
		randomizeChord,
		removeSlot,
		setDuration,
		setInversion,
		setRandomizeWithinScale,
		setVoicing,
		transposeOctave
	} from '$lib/stores/progression.svelte';
	import { settingsState, setRandomizeOption } from '$lib/stores/settings.svelte';
	import { setActivePopover } from '$lib/stores/ui.svelte';
	import {
		QUALITIES,
		VOICING_PRESETS,
		getChordName,
		getChordNotes
	} from '$lib/utils/theory-engine';
	import { auditionNotes } from '$lib/utils/audition-controller';
	import { saveRandomizeSettings } from '$lib/utils/settings-persistence';
	import type { RandomizeOptions } from '$lib/utils/settings-persistence';
	import Minus from 'lucide-svelte/icons/minus';
	import Plus from 'lucide-svelte/icons/plus';
	import Play from 'lucide-svelte/icons/play';
	import Settings from 'lucide-svelte/icons/settings';
	import Shuffle from 'lucide-svelte/icons/shuffle';
	import Trash2 from 'lucide-svelte/icons/trash-2';
	import X from 'lucide-svelte/icons/x';
	import SquareMinus from 'lucide-svelte/icons/square-minus';

	const FIELD_LABEL_CLASS = 'text-xs text-muted-foreground mb-1';

	let settingsOpen = $state(false);
	let isPreviewing = $state(false);

	const selectedSlot = $derived(uiState.selectedSlot);
	const chord = $derived(
		selectedSlot === null ? null : (progressionState.progression[selectedSlot] ?? null)
	);
	const chordName = $derived(chord ? getChordName(chord) : '');
	const hasScale = $derived(progressionState.scale !== null);

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
		const index = uiState.selectedSlot;
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
		if (selectedSlot === null) return;
		setInversion(selectedSlot, parseInt(value, 10));
		previewCurrent();
	}

	function handleVoicingChange(value: string) {
		if (selectedSlot === null) return;
		setVoicing(selectedSlot, value as keyof typeof VOICING_PRESETS);
		previewCurrent();
	}

	function handleDurationDecrease() {
		if (selectedSlot === null || currentDurationIndex <= 0) return;
		setDuration(selectedSlot, DURATION_OPTIONS[currentDurationIndex - 1]);
		previewCurrent();
	}

	function handleDurationIncrease() {
		if (selectedSlot === null || currentDurationIndex >= DURATION_OPTIONS.length - 1) return;
		setDuration(selectedSlot, DURATION_OPTIONS[currentDurationIndex + 1]);
		previewCurrent();
	}

	function handleTransposeDown() {
		if (selectedSlot === null) return;
		transposeOctave(selectedSlot, 'down');
		previewCurrent();
	}

	function handleTransposeUp() {
		if (selectedSlot === null) return;
		transposeOctave(selectedSlot, 'up');
		previewCurrent();
	}

	function handleRandomize() {
		if (selectedSlot === null) return;
		randomizeChord(selectedSlot);
		previewCurrent();
	}

	function handleOptionToggle(key: keyof RandomizeOptions) {
		setRandomizeOption(key, !settingsState.randomizeOptions[key]);
		saveRandomizeSettings(settingsState.randomizeOptions);
	}

	function handleWithinScaleToggle() {
		setRandomizeWithinScale(!progressionState.randomizeWithinScale);
	}

	function handleSettingsOpenChange(open: boolean) {
		settingsOpen = open;
		if (open) setActivePopover('inspector-randomize');
		else if (uiState.activePopover === 'inspector-randomize') setActivePopover(null);
	}

	function handleCloseInspector() {
		const slot = selectedSlot;
		if (uiState.activePopover === 'inspector-randomize') setActivePopover(null);
		deselectSlot();
		if (slot === null) return;
		void tick().then(() =>
			document
				.querySelector<HTMLElement>(`[data-chord-index="${slot}"] [data-slot-selection]`)
				?.focus()
		);
	}

	$effect(() => {
		if (uiState.activePopover !== 'inspector-randomize' && settingsOpen) settingsOpen = false;
	});

	function handleDeleteChord() {
		if (selectedSlot === null) return;
		// Deleting empties the slot and closes the inspector; compacting is Remove slot
		deleteChordFromSlot(selectedSlot);
	}

	function handleRemoveSlot() {
		if (selectedSlot === null) return;
		// The store's removal hook clears the selection, which closes the inspector
		removeSlot(selectedSlot);
	}
</script>

{#if selectedSlot !== null}
	<section
		class="animate-in fade-in slide-in-from-top-2 duration-200 rounded-lg border bg-card/50 p-3 sm:p-4 outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
		data-slot="chord-inspector"
		aria-label="Chord inspector"
		tabindex="-1"
	>
		<div class="flex items-start justify-between gap-3 mb-4">
			<div class="min-w-0">
				<div class="text-xs uppercase tracking-wider text-muted-foreground">
					Slot {selectedSlot + 1}
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
					<Popover.Root bind:open={settingsOpen} onOpenChange={handleSettingsOpenChange}>
						<Popover.Trigger>
							{#snippet child({ props })}
								<Button
									{...props}
									variant="outline"
									size="icon-sm"
									class="h-8 w-8 shrink-0"
									aria-label="Randomize settings"
								>
									<Settings class="size-3.5" aria-hidden="true" />
								</Button>
							{/snippet}
						</Popover.Trigger>
						<Popover.Content align="start" class="w-56">
							<div class="space-y-3">
								<h4 class="text-sm font-semibold leading-none">Randomize</h4>
								<div class="space-y-2">
									{#each ['inversion', 'voicing', 'octave', 'quality'] as const as key (key)}
										<label class="flex items-center gap-2 cursor-pointer">
											<input
												type="checkbox"
												checked={settingsState.randomizeOptions[key]}
												onchange={() => handleOptionToggle(key)}
												class="h-4 w-4 rounded border-input accent-primary"
											/>
											<span class="text-sm">{key.charAt(0).toUpperCase() + key.slice(1)}</span>
										</label>
									{/each}
									{#if hasScale}
										<label class="flex items-center gap-2 cursor-pointer border-t pt-2">
											<input
												type="checkbox"
												checked={progressionState.randomizeWithinScale}
												onchange={handleWithinScaleToggle}
												class="h-4 w-4 rounded border-input accent-primary"
											/>
											<span class="text-sm">Within scale</span>
										</label>
									{/if}
								</div>
							</div>
						</Popover.Content>
					</Popover.Root>
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
					disabled={progressionState.progression.length <= 1}
				>
					<SquareMinus class="size-3.5 mr-1.5" aria-hidden="true" />
					Remove slot
				</Button>
			</div>
		</div>
	</section>
{/if}
