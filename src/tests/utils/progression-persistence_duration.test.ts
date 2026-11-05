import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
	saveProgression,
	getProgressions,
	initProgressionDB
} from '$lib/utils/progression-persistence';
import { deleteDB, addRecord, PROGRESSIONS_STORE } from '$lib/utils/indexeddb';
import 'fake-indexeddb/auto'; // Mock IndexedDB

describe('Progression Persistence - Duration Support', () => {
	beforeEach(async () => {
		await initProgressionDB();
	});

	afterEach(async () => {
		await deleteDB();
	});

	it('should save chords with varying durations', async () => {
		// Create a progression with mixed durations
		const progression = [
			{ root: 60, quality: 'maj7', inversion: 0, voicing: 'close', octave: 0, duration: '1m' },
			{ root: 62, quality: 'm', inversion: 0, voicing: 'close', octave: 0, duration: '2n' },
			{ root: 65, quality: '7', inversion: 0, voicing: 'close', octave: 0, duration: '4n' },
			null
		];

		// @ts-expect-error - Assuming implementation will handle correct types
		await saveProgression('Duration Test', ['test'], progression);

		const saved = await getProgressions();
		expect(saved).toHaveLength(1);
		const loadedProgression = saved[0].progression;

		// Verify durations are preserved
		// @ts-expect-error - Testing internal implementation details where duration might be missing in older records
		expect(loadedProgression[0].duration).toBe('1m');
		// @ts-expect-error - Testing internal implementation details where duration might be missing in older records
		expect(loadedProgression[1].duration).toBe('2n');
		// @ts-expect-error - Testing internal implementation details where duration might be missing in older records
		expect(loadedProgression[2].duration).toBe('4n');
	});

	it('should default duration to 1m when loading legacy records', async () => {
		// Manually insert a legacy record (missing duration)
		const legacyRecord = {
			id: crypto.randomUUID(),
			name: 'Legacy Test',
			tags: ['legacy'],
			progression: [
				{ root: 60, quality: 'maj7', inversion: 0, voicing: 'close', octave: 0 } // No duration
			],
			createdAt: Date.now()
		};

		// Bypass saveProgression to insert raw legacy data
		await addRecord(PROGRESSIONS_STORE, legacyRecord);

		const saved = await getProgressions();
		expect(saved).toHaveLength(1);
		const loadedProgression = saved[0].progression;

		// Verify default duration is applied
		const chord = loadedProgression[0];
		expect(chord).not.toBeNull();
		// @ts-expect-error - Testing legacy data migration
		expect(chord.duration).toBe('1m');
	});

	it('should reset an inversion the saved quality cannot voice', async () => {
		await addRecord(PROGRESSIONS_STORE, {
			id: crypto.randomUUID(),
			name: 'Bad inversion',
			tags: [],
			progression: [
				{ root: 60, quality: '', inversion: 5, voicing: 'close', octave: 0, duration: '1m' },
				{ root: 62, quality: 'm7', inversion: 3, voicing: 'close', octave: 0, duration: '1m' }
			],
			createdAt: Date.now()
		});

		const [saved] = await getProgressions();

		expect(saved.progression[0]?.inversion).toBe(0);
		expect(saved.progression[1]?.inversion).toBe(3);
	});
});
