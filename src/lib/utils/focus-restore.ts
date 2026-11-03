/**
 * Focus Restore
 * Where keyboard focus lands after a panel closes. Closing unmounts the control that had focus,
 * so without a target the browser drops focus to the document. Every close path for the same
 * panel (its own Close button, Escape) uses the same target.
 */

import { tick } from 'svelte';

/**
 * Focus the first selector that matches, after the closing panel has unmounted
 * @param selectors - Candidates in order of preference
 */
function focusFirstAfterUpdate(...selectors: string[]): void {
	void tick().then(() => {
		for (const selector of selectors) {
			const el = document.querySelector<HTMLElement>(selector);
			if (el) {
				el.focus();
				return;
			}
		}
	});
}

/**
 * Return focus to a slot after the inspector closes: its chord's selection control, or the slot
 * itself when it is empty and has no chord to focus
 * @param slot - Slot the inspector was editing
 */
export function focusSlotAfterClose(slot: number): void {
	focusFirstAfterUpdate(
		`[data-chord-index="${slot}"] [data-slot-selection]`,
		`[data-slot-index="${slot}"]`
	);
}

/**
 * Return focus to the rail button of the library section that just closed
 * @param section - Section that was open
 */
export function focusLibrarySectionAfterClose(section: string): void {
	focusFirstAfterUpdate(`[data-library-section="${section}"]`);
}
