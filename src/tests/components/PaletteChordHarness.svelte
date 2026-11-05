<script lang="ts">
	import PaletteChord from '$lib/components/PaletteChord.svelte';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import type { Chord } from '$lib/utils/theory-engine/types';

	interface Props {
		chord: Chord;
		inDialog: boolean;
		onPlace: (chord: Chord) => void;
	}

	let { chord, inDialog, onPlace }: Props = $props();
</script>

<Tooltip.Provider>
	{#if inDialog}
		<div role="dialog">
			<PaletteChord {chord} index={0} {onPlace} />
		</div>
	{:else}
		<PaletteChord {chord} index={0} {onPlace} />
	{/if}
</Tooltip.Provider>
