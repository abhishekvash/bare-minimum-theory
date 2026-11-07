<script lang="ts">
	import SavedProgressionItem from '#lib/components/SavedProgressionItem.svelte';
	import * as Tooltip from '#lib/components/ui/tooltip/index.ts';
	import type { SavedProgression } from '#lib/utils/progression-persistence.ts';

	let { progression }: { progression: SavedProgression } = $props();
</script>

<Tooltip.Provider>
	<SavedProgressionItem {progression} />
</Tooltip.Provider>
