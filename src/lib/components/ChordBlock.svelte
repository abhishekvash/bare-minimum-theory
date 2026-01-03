<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { IconButton } from '$lib/components/ui/icon-button';
	import * as Select from '$lib/components/ui/select';
	import * as Popover from '$lib/components/ui/popover';
	import {
		transposeOctave,
		removeChord,
		setInversion,
		setVoicing,
		setDuration,
		randomizeChord
	} from '$lib/stores/progression.svelte';
	import { settingsState, setRandomizeOption } from '$lib/stores/settings.svelte';
	import { getChordName } from '$lib/utils/theory-engine/display';
	import { QUALITIES, VOICING_PRESETS } from '$lib/utils/theory-engine';
	import { getChordNotes } from '$lib/utils/theory-engine/chord-operations';
	import type { Chord } from '$lib/utils/theory-engine';
	import { playChord } from '$lib/utils/audio-playback';
	import { saveRandomizeSettings } from '$lib/utils/settings-persistence';
	import type { RandomizeOptions } from '$lib/utils/settings-persistence';
	import Trash2 from 'lucide-svelte/icons/trash-2';
	import Minus from 'lucide-svelte/icons/minus';
	import Plus from 'lucide-svelte/icons/plus';
	import Shuffle from 'lucide-svelte/icons/shuffle';
	import GripVertical from 'lucide-svelte/icons/grip-vertical';
	import Play from 'lucide-svelte/icons/play';
	import Settings from 'lucide-svelte/icons/settings';
	import { cn } from '$lib/utils';

	interface Props {
		chord: Chord;
		index: number;
		isCurrentlyPlaying?: boolean;
		progressPercent?: number;
	}

	let { chord, index, isCurrentlyPlaying = false, progressPercent = 0 }: Props = $props();

	const VOICING_LABELS: Record<string, string> = {
		close: 'Close',
		open: 'Open',
		drop2: 'Drop 2',
		drop3: 'Drop 3'
	};

	// Ordered from smallest to largest duration (1/8th increments)
	// Using Tone.js notation: standard notes or BARS:QUARTERS:SIXTEENTHS format
	const DURATION_OPTIONS = [
		'8n', // 1/8 bar
		'4n', // 2/8 = 1/4 bar
		'4n.', // 3/8 bar (dotted quarter)
		'2n', // 4/8 = 1/2 bar
		'0:2:2', // 5/8 bar (2 quarters + 2 sixteenths)
		'2n.', // 6/8 = 3/4 bar (dotted half)
		'0:3:2', // 7/8 bar (3 quarters + 2 sixteenths)
		'1m', // 8/8 = 1 bar
		'1:0:2', // 9/8 bar (1 bar + 2 sixteenths)
		'1:1:0', // 10/8 = 1¼ bar
		'1:1:2', // 11/8 bar (1¼ bar + 2 sixteenths)
		'1:2:0', // 12/8 = 1½ bar
		'1:2:2', // 13/8 bar (1½ bar + 2 sixteenths)
		'1:3:0', // 14/8 = 1¾ bar
		'1:3:2', // 15/8 bar (1¾ bar + 2 sixteenths)
		'2m' // 16/8 = 2 bars
	] as const;
	const DURATION_LABELS: Record<string, string> = {
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

	const INVERSION_LABELS = ['Root', '1st', '2nd', '3rd', '4th', '5th', '6th'];

	const LABEL_CLASS = 'text-xs text-muted-foreground mb-1';

	const chordName = $derived(getChordName(chord));
	let isDragging = $state(false);
	let isPlaying = $state(false);
	let settingsOpen = $state(false);

	const numNotes = $derived(QUALITIES[chord.quality].length);
	const availableInversions = $derived(Array.from({ length: numNotes }, (_, i) => i));

	const octaveDisplay = $derived(
		chord.octave === 0 ? '0' : chord.octave > 0 ? `+${chord.octave}` : chord.octave
	);

	const voicingOptions = $derived(Object.keys(VOICING_PRESETS) as (keyof typeof VOICING_PRESETS)[]);

	function handleDeleteChord() {
		removeChord(index);
	}

	function handleTransposeDown() {
		transposeOctave(index, 'down');
	}

	function handleTransposeUp() {
		transposeOctave(index, 'up');
	}

	function handleInversionChange(value: string) {
		const inversionNum = parseInt(value, 10);
		setInversion(index, inversionNum);
	}

	function handleVoicingChange(value: string) {
		setVoicing(index, value as keyof typeof VOICING_PRESETS);
	}

	const currentDurationIndex = $derived(
		DURATION_OPTIONS.indexOf(chord.duration as (typeof DURATION_OPTIONS)[number])
	);

	function handleDurationDecrease() {
		if (currentDurationIndex > 0) {
			setDuration(index, DURATION_OPTIONS[currentDurationIndex - 1]);
		}
	}

	function handleDurationIncrease() {
		if (currentDurationIndex < DURATION_OPTIONS.length - 1) {
			setDuration(index, DURATION_OPTIONS[currentDurationIndex + 1]);
		}
	}

	function handleRandomize() {
		randomizeChord(index);
	}

	function handleOptionToggle(key: keyof RandomizeOptions) {
		const newValue = !settingsState.randomizeOptions[key];
		setRandomizeOption(key, newValue);
		saveRandomizeSettings(settingsState.randomizeOptions);
	}

	async function handlePlayChord(e: MouseEvent) {
		e.stopPropagation();
		if (isPlaying) return;

		isPlaying = true;
		const midiNotes = getChordNotes(chord);
		await playChord(midiNotes);
		setTimeout(() => {
			isPlaying = false;
		}, 1000);
	}

	function handleDragStart(event: DragEvent) {
		if (!event.dataTransfer) return;
		event.dataTransfer.effectAllowed = 'move';
		event.dataTransfer.setData('progression-chord', JSON.stringify({ fromIndex: index }));
		isDragging = true;
	}

	function handleDragEnd() {
		isDragging = false;
	}
</script>

<div
	class={cn(
		'flex-1 bg-card px-3 sm:px-4 py-2.5 sm:py-3 flex flex-col cursor-grab active:cursor-grabbing transition-all duration-150 relative overflow-hidden',
		isDragging ? 'opacity-40' : 'opacity-100',
		isPlaying && 'scale-[1.01]'
	)}
	data-slot="chord-block"
	draggable="true"
	ondragstart={handleDragStart}
	ondragend={handleDragEnd}
	role="button"
	tabindex="0"
	aria-label="Drag to reorder chord"
>
	<!-- Progress bar for progression playback (transport-driven) -->
	{#if isCurrentlyPlaying}
		<div
			class="absolute bottom-0 left-0 h-1 bg-primary/60"
			style="width: {progressPercent}%"
			aria-hidden="true"
		></div>
	{/if}
	<!-- Progress bar for individual preview (CSS animation) -->
	{#if isPlaying && !isCurrentlyPlaying}
		<div
			class="absolute bottom-0 left-0 h-1 bg-primary/60 animate-progress-sweep"
			aria-hidden="true"
		></div>
	{/if}
	<div class="flex items-start justify-between mb-3">
		<div class="flex items-center gap-1.5">
			<GripVertical class="size-4 text-muted-foreground/40" aria-hidden="true" />
			<p class="text-base font-medium">{chordName}</p>
		</div>
		<div class="flex items-center gap-0.5 -mt-1 -mr-1">
			<IconButton
				tooltip={`Play ${chordName}`}
				variant="ghost"
				size="icon-sm"
				class="h-6 w-6 text-muted-foreground hover:text-primary hover:bg-primary/10"
				onclick={handlePlayChord}
			>
				<Play class="size-3.5" aria-hidden="true" />
			</IconButton>
			<IconButton
				tooltip={`Remove ${chordName}`}
				variant="ghost"
				size="icon-sm"
				class="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
				onclick={handleDeleteChord}
			>
				<Trash2 class="size-3.5" aria-hidden="true" />
			</IconButton>
		</div>
	</div>

	<div class="space-y-2.5 flex-1">
		<div>
			<div class={LABEL_CLASS}>Inversion</div>
			<Select.Root
				type="single"
				value={chord.inversion.toString()}
				onValueChange={handleInversionChange}
			>
				<Select.Trigger class="h-8 text-xs w-full">
					{INVERSION_LABELS[chord.inversion]}
				</Select.Trigger>
				<Select.Content>
					{#each availableInversions as inv (inv)}
						<Select.Item value={inv.toString()}>
							{INVERSION_LABELS[inv]}
						</Select.Item>
					{/each}
				</Select.Content>
			</Select.Root>
		</div>

		<div>
			<div class={LABEL_CLASS}>Voicing</div>
			<Select.Root type="single" value={chord.voicing} onValueChange={handleVoicingChange}>
				<Select.Trigger class="h-8 text-xs w-full">
					{VOICING_LABELS[chord.voicing]}
				</Select.Trigger>
				<Select.Content>
					{#each voicingOptions as voicing (voicing)}
						<Select.Item value={voicing}>
							{VOICING_LABELS[voicing]}
						</Select.Item>
					{/each}
				</Select.Content>
			</Select.Root>
		</div>

		<div>
			<div class={LABEL_CLASS}>Duration</div>
			<div class="flex items-center gap-1">
				<IconButton
					tooltip="Decrease duration"
					variant="outline"
					size="icon-sm"
					class="h-7 w-7"
					onclick={handleDurationDecrease}
					disabled={currentDurationIndex <= 0}
				>
					<Minus class="size-3.5" aria-hidden="true" />
				</IconButton>
				<div class="text-xs text-center min-w-[3ch] tabular-nums flex-1">
					{DURATION_LABELS[chord.duration] || chord.duration}
				</div>
				<IconButton
					tooltip="Increase duration"
					variant="outline"
					size="icon-sm"
					class="h-7 w-7"
					onclick={handleDurationIncrease}
					disabled={currentDurationIndex >= DURATION_OPTIONS.length - 1}
				>
					<Plus class="size-3.5" aria-hidden="true" />
				</IconButton>
			</div>
		</div>

		<div>
			<div class={LABEL_CLASS}>Octave</div>
			<div class="flex items-center gap-1">
				<IconButton
					tooltip={`Transpose ${chordName} down one octave`}
					variant="outline"
					size="icon-sm"
					class="h-7 w-7"
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
					class="h-7 w-7"
					onclick={handleTransposeUp}
					disabled={chord.octave >= 2}
				>
					<Plus class="size-3.5" aria-hidden="true" />
				</IconButton>
			</div>
		</div>

		<div class="pt-1 flex gap-1">
			<Button
				variant="outline"
				size="sm"
				class="flex-1 h-8 text-xs"
				aria-label={`Randomize ${chordName}`}
				onclick={handleRandomize}
			>
				<Shuffle class="size-3.5 mr-1.5" aria-hidden="true" />
				Randomize
			</Button>
			<Popover.Root bind:open={settingsOpen}>
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
				<Popover.Content align="end" class="w-48">
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
						</div>
					</div>
				</Popover.Content>
			</Popover.Root>
		</div>
	</div>
</div>
