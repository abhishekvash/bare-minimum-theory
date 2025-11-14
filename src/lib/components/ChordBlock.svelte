<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { cycleInversion, randomizeVoicing, removeChord } from '$lib/stores/progression.svelte';
	import { getChordName, getChordTooltip } from '$lib/utils/theory-engine/display';
	import type { Chord } from '$lib/utils/theory-engine';
	import RefreshCw from 'lucide-svelte/icons/refresh-cw';
	import Dice5 from 'lucide-svelte/icons/dice-5';
	import Trash2 from 'lucide-svelte/icons/trash-2';

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
		drop3: 'Drop 3',
		wide: 'Wide'
	};

	const chordName = $derived(getChordName(chord));
	const tooltip = $derived(getChordTooltip(chord));
	const voicingLabel = $derived(VOICING_LABELS[chord.voicing] ?? chord.voicing);

	function handleCycleInversion() {
		cycleInversion(index);
	}

	function handleRandomizeVoicing() {
		randomizeVoicing(index);
	}

	function handleDeleteChord() {
		removeChord(index);
	}
</script>

<div
	class={`h-full bg-card px-4 py-3 flex flex-col justify-between ${!isLast ? 'border-r border-border' : ''}`}
	title={tooltip || chordName}
	data-slot="chord-block"
>
	<div class="flex flex-col gap-2">
		<p class="text-lg font-bold leading-tight">{chordName}</p>
		<div class="text-[10px] text-muted-foreground leading-tight">
			{#if tooltip}
				<div>{tooltip}</div>
			{:else}
				<div>Root position</div>
			{/if}
			<div class="mt-0.5">{voicingLabel} voicing</div>
		</div>
	</div>

	<div class="flex items-center gap-1 mt-3">
		<Button
			variant="ghost"
			size="icon-sm"
			class="h-7 w-7"
			aria-label={`Cycle inversion for ${chordName}`}
			onclick={handleCycleInversion}
		>
			<RefreshCw class="size-3.5" aria-hidden="true" />
		</Button>
		<Button
			variant="ghost"
			size="icon-sm"
			class="h-7 w-7"
			aria-label={`Randomize voicing for ${chordName}`}
			onclick={handleRandomizeVoicing}
		>
			<Dice5 class="size-3.5" aria-hidden="true" />
		</Button>
		<Button
			variant="ghost"
			size="icon-sm"
			class="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
			aria-label={`Remove ${chordName} from progression`}
			onclick={handleDeleteChord}
		>
			<Trash2 class="size-3.5" aria-hidden="true" />
		</Button>
	</div>
</div>
