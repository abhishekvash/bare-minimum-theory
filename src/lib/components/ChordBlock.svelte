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
	}

	let { chord, index }: Props = $props();

	const VOICING_LABELS: Record<string, string> = {
		close: 'Close',
		open: 'Open',
		drop2: 'Drop 2',
		drop3: 'Drop 3',
		wide: 'Wide'
	};

	$: chordName = getChordName(chord);
	$: tooltip = getChordTooltip(chord);
	$: voicingLabel = VOICING_LABELS[chord.voicing] ?? chord.voicing;

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
	class="rounded-xl border bg-card px-4 py-3 shadow-sm transition hover:border-primary/60"
	title={tooltip || chordName}
	data-slot="chord-block"
>
	<div class="flex items-center justify-between gap-4">
		<div class="min-w-0">
			<p class="text-lg font-semibold leading-tight">{chordName}</p>
			<div class="text-xs text-muted-foreground">
				{#if tooltip}
					<span>{tooltip}</span>
				{:else}
					<span>Root position</span>
				{/if}
				<span class="mx-2">•</span>
				<span>{voicingLabel} voicing</span>
			</div>
		</div>
		<div class="flex items-center gap-2">
			<Button
				variant="ghost"
				size="icon-sm"
				aria-label={`Cycle inversion for ${chordName}`}
				onclick={handleCycleInversion}
			>
				<RefreshCw class="size-4" aria-hidden="true" />
			</Button>
			<Button
				variant="ghost"
				size="icon-sm"
				aria-label={`Randomize voicing for ${chordName}`}
				onclick={handleRandomizeVoicing}
			>
				<Dice5 class="size-4" aria-hidden="true" />
			</Button>
			<Button
				variant="ghost"
				size="icon-sm"
				class="text-destructive hover:text-destructive"
				aria-label={`Remove ${chordName} from progression`}
				onclick={handleDeleteChord}
			>
				<Trash2 class="size-4" aria-hidden="true" />
			</Button>
		</div>
	</div>

</div>
