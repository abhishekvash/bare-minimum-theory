<script lang="ts">
	/**
	 * Test harness: mounts the rail inside the tooltip provider the real layout supplies,
	 * so icon buttons behave the way they do in the app.
	 */
	import LibraryRail from '$lib/components/LibraryRail.svelte';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import type { SavedProgression } from '$lib/utils/progression-persistence';

	interface Props {
		onLoadProgression?: (progression: SavedProgression) => void;
	}

	let { onLoadProgression }: Props = $props();
</script>

<Tooltip.Provider>
	<LibraryRail {onLoadProgression} />
</Tooltip.Provider>
