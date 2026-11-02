/**
 * Slot Index Remapping
 * Pure rules for keeping a remembered slot index pointing at the same slot after the
 * progression is restructured. Shared by every piece of state that tracks a slot (the
 * audition record, selection, queued and landing feedback) so they can never disagree.
 * A `null` index means "tracking nothing" and passes through unchanged.
 */

/**
 * Follow a slot through an exchange of two slots
 * @param index - Tracked slot index, or null
 * @param indexA - First exchanged slot
 * @param indexB - Second exchanged slot
 * @returns The tracked slot's new index
 */
export function remapIndexAfterExchange<T extends number | null>(
	index: T,
	indexA: number,
	indexB: number
): T {
	if (index === indexA) return indexB as T;
	if (index === indexB) return indexA as T;
	return index;
}

/**
 * Follow a slot through an insertion; everything at or after the insertion point shifts right
 * @param index - Tracked slot index, or null
 * @param at - Index the new slot was inserted at
 * @returns The tracked slot's new index
 */
export function remapIndexAfterInsert<T extends number | null>(index: T, at: number): T {
	if (index !== null && index >= at) return (index + 1) as T;
	return index;
}

/**
 * Follow a slot through a removal; everything after the removed slot shifts left
 * @param index - Tracked slot index, or null
 * @param at - Index of the removed slot
 * @returns The tracked slot's new index, or null when the tracked slot was the one removed
 */
export function remapIndexAfterRemove(index: number | null, at: number): number | null {
	if (index === null || index === at) return null;
	return index > at ? index - 1 : index;
}
