<script lang="ts">
	/**
	 * Test harness: mounts the canvas inside the tooltip provider the real layout supplies, so the
	 * blocks' icon buttons behave the way they do in the app.
	 */
	import ChordProgression from '$lib/components/ChordProgression.svelte';
	import * as Tooltip from '$lib/components/ui/tooltip';

	let canvas: ReturnType<typeof ChordProgression> | undefined = $state();

	/** The page's programmatic stop (used by the MIDI error handler) */
	export function stop(): void {
		canvas?.stop();
	}
</script>

<Tooltip.Provider>
	<ChordProgression bind:this={canvas} />
</Tooltip.Provider>
