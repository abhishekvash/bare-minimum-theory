<script lang="ts">
	import ChordBuilder from '#lib/components/ChordBuilder.svelte';
	import ChordProgression from '#lib/components/ChordProgression.svelte';
	import * as Tooltip from '#lib/components/ui/tooltip/index.ts';
</script>

<Tooltip.Provider>
	<ChordBuilder />
	<ChordProgression />
</Tooltip.Provider>
