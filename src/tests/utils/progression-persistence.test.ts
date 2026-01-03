import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import {
	initProgressionDB,
	saveProgression,
	getProgressions,
	deleteProgressionById,
	getAllTags,
	countChords,
	filterProgressions,
	type SavedProgression
} from '$lib/utils/progression-persistence';
import { deleteDB, closeDB } from '$lib/utils/indexeddb';
import type { Chord } from '$lib/utils/theory-engine/types';

// Sample chord for testing
const sampleChord: Chord = {
	root: 60, // C4
	quality: '',
	inversion: 0,
	voicing: 'close',
	octave: 0,
	duration: '1m'
};

const sampleChord2: Chord = {
	root: 65, // F4
	quality: 'm',
	inversion: 1,
	voicing: 'open',
	octave: 0,
	duration: '1m'
};

describe('progression-persistence', () => {
	beforeEach(async () => {
		// Clean up before each test
		closeDB();
		await deleteDB();
		await initProgressionDB();
	});

	afterEach(async () => {
		closeDB();
		await deleteDB();
	});

	describe('saveProgression', () => {
		it('saves a progression with name and tags', async () => {
			const progression = [sampleChord, sampleChord2, null, null];
			const saved = await saveProgression('My Progression', ['jazz', 'lofi'], progression);

			expect(saved.id).toBeTruthy();
			expect(saved.name).toBe('My Progression');
			expect(saved.tags).toEqual(['jazz', 'lofi']);
			expect(saved.progression).toEqual(progression);
			expect(saved.createdAt).toBeGreaterThan(0);
		});

		it('trims and lowercases tags', async () => {
			const progression = [sampleChord, null, null, null];
			const saved = await saveProgression('Test', ['  Jazz  ', 'LOFI', '  '], progression);

			expect(saved.tags).toEqual(['jazz', 'lofi']);
		});

		it('trims progression name', async () => {
			const progression = [sampleChord, null, null, null];
			const saved = await saveProgression('  Test Name  ', [], progression);

			expect(saved.name).toBe('Test Name');
		});

		it('creates unique IDs for each save', async () => {
			const progression = [sampleChord, null, null, null];
			const saved1 = await saveProgression('Test 1', [], progression);
			const saved2 = await saveProgression('Test 2', [], progression);

			expect(saved1.id).not.toBe(saved2.id);
		});
	});

	describe('getProgressions', () => {
		it('returns empty array when no progressions saved', async () => {
			const progressions = await getProgressions();
			expect(progressions).toEqual([]);
		});

		it('returns progressions sorted newest first', async () => {
			const progression = [sampleChord, null, null, null];

			await saveProgression('First', [], progression);
			// Small delay to ensure different timestamps
			await new Promise((resolve) => setTimeout(resolve, 10));
			await saveProgression('Second', [], progression);
			await new Promise((resolve) => setTimeout(resolve, 10));
			await saveProgression('Third', [], progression);

			const progressions = await getProgressions();

			expect(progressions).toHaveLength(3);
			expect(progressions[0].name).toBe('Third');
			expect(progressions[1].name).toBe('Second');
			expect(progressions[2].name).toBe('First');
		});
	});

	describe('deleteProgressionById', () => {
		it('deletes a progression by ID', async () => {
			const progression = [sampleChord, null, null, null];
			const saved = await saveProgression('To Delete', [], progression);

			await deleteProgressionById(saved.id);

			const progressions = await getProgressions();
			expect(progressions).toHaveLength(0);
		});

		it('only deletes the specified progression', async () => {
			const progression = [sampleChord, null, null, null];
			const saved1 = await saveProgression('Keep', [], progression);
			const saved2 = await saveProgression('Delete', [], progression);

			await deleteProgressionById(saved2.id);

			const progressions = await getProgressions();
			expect(progressions).toHaveLength(1);
			expect(progressions[0].id).toBe(saved1.id);
		});
	});

	describe('getAllTags', () => {
		it('returns empty array when no progressions exist', async () => {
			const tags = await getAllTags();
			expect(tags).toEqual([]);
		});

		it('returns unique tags sorted alphabetically', async () => {
			const progression = [sampleChord, null, null, null];
			await saveProgression('Test 1', ['jazz', 'chill'], progression);
			await saveProgression('Test 2', ['rock', 'jazz'], progression);
			await saveProgression('Test 3', ['ambient'], progression);

			const tags = await getAllTags();
			expect(tags).toEqual(['ambient', 'chill', 'jazz', 'rock']);
		});

		it('does not duplicate tags', async () => {
			const progression = [sampleChord, null, null, null];
			await saveProgression('Test 1', ['jazz'], progression);
			await saveProgression('Test 2', ['jazz'], progression);

			const tags = await getAllTags();
			expect(tags).toEqual(['jazz']);
		});
	});

	describe('countChords', () => {
		it('returns 0 for empty progression', () => {
			expect(countChords([null, null, null, null])).toBe(0);
		});

		it('counts non-null chords correctly', () => {
			expect(countChords([sampleChord, null, sampleChord2, null])).toBe(2);
			expect(countChords([sampleChord, sampleChord, sampleChord, sampleChord])).toBe(4);
			expect(countChords([sampleChord, null, null, null])).toBe(1);
		});
	});

	describe('filterProgressions', () => {
		const progressions: SavedProgression[] = [
			{
				id: '1',
				name: 'Jazz Ballad',
				tags: ['jazz', 'slow'],
				progression: [sampleChord, null, null, null],
				createdAt: Date.now()
			},
			{
				id: '2',
				name: 'Rock Anthem',
				tags: ['rock', 'energetic'],
				progression: [sampleChord, null, null, null],
				createdAt: Date.now()
			},
			{
				id: '3',
				name: 'Chill Lofi',
				tags: ['lofi', 'chill'],
				progression: [sampleChord, null, null, null],
				createdAt: Date.now()
			}
		];

		it('returns all progressions for empty query', () => {
			expect(filterProgressions(progressions, '')).toEqual(progressions);
			expect(filterProgressions(progressions, '   ')).toEqual(progressions);
		});

		it('filters by name (case-insensitive)', () => {
			const result = filterProgressions(progressions, 'jazz');
			expect(result).toHaveLength(1);
			expect(result[0].name).toBe('Jazz Ballad');
		});

		it('filters by tag', () => {
			const result = filterProgressions(progressions, 'chill');
			expect(result).toHaveLength(1);
			expect(result[0].name).toBe('Chill Lofi');
		});

		it('matches partial name', () => {
			const result = filterProgressions(progressions, 'ball');
			expect(result).toHaveLength(1);
			expect(result[0].name).toBe('Jazz Ballad');
		});

		it('returns multiple matches', () => {
			// Both "Jazz Ballad" and "Chill Lofi" have tags containing substrings
			const result = filterProgressions(progressions, 'lo');
			expect(result).toHaveLength(2); // "slow" tag and "Chill Lofi" name/lofi tag
		});
	});
});
