/**
 * Progression Persistence Utility
 * Handles IndexedDB storage for saved chord progressions
 */

import type { Chord } from './theory-engine/types';
import {
	openDB,
	addRecord,
	getAllRecords,
	deleteRecord,
	PROGRESSIONS_STORE
} from './indexeddb';

/**
 * A saved chord progression with metadata
 */
export type SavedProgression = {
	/** Unique identifier (crypto.randomUUID()) */
	id: string;
	/** User-provided name for the progression */
	name: string;
	/** Optional tags for organization */
	tags: string[];
	/** The chord progression (4-slot array with nulls preserved) */
	progression: (Chord | null)[];
	/** Creation timestamp */
	createdAt: number;
};

/**
 * Initialize the progression database
 * Should be called once on app mount
 */
export async function initProgressionDB(): Promise<void> {
	if (typeof window === 'undefined') return;
	await openDB();
}

/**
 * Save a new progression to IndexedDB
 */
export async function saveProgression(
	name: string,
	tags: string[],
	progression: (Chord | null)[]
): Promise<SavedProgression> {
	const saved: SavedProgression = {
		id: crypto.randomUUID(),
		name: name.trim(),
		tags: tags.map((t) => t.trim().toLowerCase()).filter((t) => t.length > 0),
		progression: [...progression], // Copy the array
		createdAt: Date.now()
	};

	await addRecord(PROGRESSIONS_STORE, saved);
	return saved;
}

/**
 * Get all saved progressions, sorted newest first
 */
export async function getProgressions(): Promise<SavedProgression[]> {
	const progressions = await getAllRecords<SavedProgression>(PROGRESSIONS_STORE);
	return progressions.sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Delete a saved progression by ID
 */
export async function deleteProgressionById(id: string): Promise<void> {
	await deleteRecord(PROGRESSIONS_STORE, id);
}

/**
 * Get all unique tags from saved progressions
 * Returns tags in alphabetical order
 */
export async function getAllTags(): Promise<string[]> {
	const progressions = await getAllRecords<SavedProgression>(PROGRESSIONS_STORE);
	const tagSet = new Set<string>();

	for (const p of progressions) {
		for (const tag of p.tags) {
			tagSet.add(tag);
		}
	}

	return Array.from(tagSet).sort();
}

/**
 * Count non-null chords in a progression
 * Used to validate if a progression can be saved (needs 2+ chords)
 */
export function countChords(progression: (Chord | null)[]): number {
	return progression.filter((c) => c !== null).length;
}

/**
 * Filter progressions by search query
 * Matches against name and tags (case-insensitive)
 */
export function filterProgressions(
	progressions: SavedProgression[],
	query: string
): SavedProgression[] {
	if (!query.trim()) return progressions;

	const searchTerm = query.toLowerCase().trim();

	return progressions.filter((p) => {
		// Check name
		if (p.name.toLowerCase().includes(searchTerm)) return true;

		// Check tags
		return p.tags.some((tag) => tag.includes(searchTerm));
	});
}
