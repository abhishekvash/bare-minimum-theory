<script lang="ts">
	import PaletteChord from '#lib/components/PaletteChord.svelte';
	import * as Tooltip from '#lib/components/ui/tooltip/index.ts';
	import type { Chord } from '#lib/utils/theory-engine/types.ts';

	interface Props {
		chord: Chord;
		inDialog: boolean;
		onPlace: (chord: Chord) => void;
		onDragLeave?: () => void;
	}

	let { chord, inDialog, onPlace, onDragLeave }: Props = $props();
</script>

<Tooltip.Provider>
	{#if inDialog}
		<div role="dialog">
			<PaletteChord {chord} index={0} {onPlace} {onDragLeave} />
		</div>
	{:else}
		<PaletteChord {chord} index={0} {onPlace} {onDragLeave} />
	{/if}
</Tooltip.Provider>
