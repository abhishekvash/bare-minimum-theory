<script lang="ts">
	/**
	 * Test harness: mounts the canvas inside the tooltip provider the real layout supplies, so the
	 * blocks' icon buttons behave the way they do in the app.
	 */
	import ChordProgression from '$lib/components/ChordProgression.svelte';
	import * as Tooltip from '$lib/components/ui/tooltip';
</script>

<Tooltip.Provider>
	<ChordProgression />
</Tooltip.Provider>
