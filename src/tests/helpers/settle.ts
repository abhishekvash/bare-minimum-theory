import { flushSync, tick } from 'svelte';

/**
 * Let bits-ui finish mounting or unmounting animated content (dialogs, popovers).
 * Since bits-ui 2.17 its presence layer waits a couple of animation frames to check for
 * exit/enter animations before it adds or removes content, so a single tick is not enough.
 */
export async function settle(frames = 3): Promise<void> {
	for (let frame = 0; frame < frames; frame += 1) {
		await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
		flushSync();
	}
	await tick();
}
