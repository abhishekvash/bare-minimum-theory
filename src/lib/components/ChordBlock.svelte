<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Select from '$lib/components/ui/select';
	import { transposeOctave, removeChord, setInversion, setVoicing, randomizeChord } from '$lib/stores/progression.svelte';
	import { getChordName } from '$lib/utils/theory-engine/display';
	import { QUALITIES, VOICING_PRESETS } from '$lib/utils/theory-engine';
	import type { Chord } from '$lib/utils/theory-engine';
	import Trash2 from 'lucide-svelte/icons/trash-2';
	import Minus from 'lucide-svelte/icons/minus';
	import Plus from 'lucide-svelte/icons/plus';
	import Shuffle from 'lucide-svelte/icons/shuffle';

	interface Props {
		chord: Chord;
		index: number;
		isLast?: boolean;
	}

	let { chord, index, isLast = false }: Props = $props();

	const VOICING_LABELS: Record<string, string> = {
		close: 'Close',
		open: 'Open',
		drop2: 'Drop 2',
		drop3: 'Drop 3'
	};

	const INVERSION_LABELS = ['Root', '1st', '2nd', '3rd', '4th', '5th', '6th'];

	const chordName = $derived(getChordName(chord));

	// Calculate available inversions based on chord quality
	const numNotes = $derived(QUALITIES[chord.quality].length);
	const availableInversions = $derived(Array.from({ length: numNotes }, (_, i) => i));

	// Get all voicing options
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

	function handleRandomize() {
		randomizeChord(index);
	}
</script>

<div
	class={`h-full bg-card px-4 py-3 flex flex-col ${!isLast ? 'border-r border-border' : ''}`}
	data-slot="chord-block"
>
	<!-- Header: Chord name + Delete button -->
	<div class="flex items-start justify-between mb-3">
		<p class="text-lg font-bold leading-tight">{chordName}</p>
		<Button
			variant="ghost"
			size="icon-sm"
			class="h-6 w-6 -mt-1 -mr-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
			aria-label={`Remove ${chordName} from progression`}
			onclick={handleDeleteChord}
		>
			<Trash2 class="size-3.5" aria-hidden="true" />
		</Button>
	</div>

	<!-- Controls section -->
	<div class="space-y-2.5 flex-1">
		<!-- Inversion dropdown -->
		<div>
			<div class="text-[10px] text-muted-foreground mb-1">Inversion</div>
			<Select.Root type="single" value={chord.inversion.toString()} onValueChange={handleInversionChange}>
				<Select.Trigger class="h-8 text-xs w-full">
					{INVERSION_LABELS[chord.inversion]}
				</Select.Trigger>
				<Select.Content>
					{#each availableInversions as inv}
						<Select.Item value={inv.toString()}>
							{INVERSION_LABELS[inv]}
						</Select.Item>
					{/each}
				</Select.Content>
			</Select.Root>
		</div>

		<!-- Voicing dropdown -->
		<div>
			<div class="text-[10px] text-muted-foreground mb-1">Voicing</div>
			<Select.Root type="single" value={chord.voicing} onValueChange={handleVoicingChange}>
				<Select.Trigger class="h-8 text-xs w-full">
					{VOICING_LABELS[chord.voicing]}
				</Select.Trigger>
				<Select.Content>
					{#each voicingOptions as voicing}
						<Select.Item value={voicing}>
							{VOICING_LABELS[voicing]}
						</Select.Item>
					{/each}
				</Select.Content>
			</Select.Root>
		</div>

		<!-- Octave transpose controls -->
		<div>
			<div class="text-[10px] text-muted-foreground mb-1">Octave</div>
			<div class="flex items-center gap-1">
				<Button
					variant="outline"
					size="icon-sm"
					class="h-7 w-7"
					aria-label={`Transpose ${chordName} down one octave`}
					onclick={handleTransposeDown}
					disabled={chord.octave <= -2}
				>
					<Minus class="size-3.5" aria-hidden="true" />
				</Button>
				<div class="text-xs text-center min-w-[2ch] tabular-nums flex-1">
					{chord.octave === 0 ? '0' : chord.octave > 0 ? `+${chord.octave}` : chord.octave}
				</div>
				<Button
					variant="outline"
					size="icon-sm"
					class="h-7 w-7"
					aria-label={`Transpose ${chordName} up one octave`}
					onclick={handleTransposeUp}
					disabled={chord.octave >= 2}
				>
					<Plus class="size-3.5" aria-hidden="true" />
				</Button>
			</div>
		</div>

		<!-- Randomize button -->
		<div class="pt-1">
			<Button
				variant="outline"
				size="sm"
				class="w-full h-8 text-xs"
				aria-label={`Randomize ${chordName} quality, inversion, and voicing`}
				onclick={handleRandomize}
			>
				<Shuffle class="size-3.5 mr-1.5" aria-hidden="true" />
				Randomize
			</Button>
		</div>
	</div>
</div>
