/**
 * Scale Helper Utilities
 * Uses @tonaljs/tonal for music theory calculations
 */

import { Scale, Note } from '@tonaljs/tonal';
import type { ChordQuality } from '$lib/utils/theory-engine/types';
import { NOTE_NAMES, QUALITIES } from '$lib/utils/theory-engine/constants';

/**
 * Get all notes in a scale
 * @param key - Root note (e.g., 'C', 'D#')
 * @param mode - Scale mode (e.g., 'major', 'minor', 'dorian')
 * @returns Array of note names in the scale (e.g., ['C', 'D', 'E', 'F', 'G', 'A', 'B'])
 */
export function getScaleNotes(key: string, mode: string): string[] {
	const scaleName = `${key} ${mode}`;
	const scale = Scale.get(scaleName);

	if (!scale.notes || scale.notes.length === 0) {
		return [];
	}

	return scale.notes;
}

/**
 * Check if a root note (MIDI number) is in the scale
 * @param rootMidi - MIDI note number (60 = C4, 61 = C#4, etc.)
 * @param scaleNotes - Array of note names in the scale
 * @returns true if the root note is in the scale
 */
export function isRootInScale(rootMidi: number, scaleNotes: string[]): boolean {
	if (scaleNotes.length === 0) return true;

	const rootName = NOTE_NAMES[rootMidi % 12];

	// Normalize both the root and scale notes to compare enharmonic equivalents
	const normalizedRoot = Note.simplify(rootName);
	const normalizedScaleNotes = scaleNotes.map((note) => Note.simplify(note));

	return normalizedScaleNotes.includes(normalizedRoot);
}

/**
 * Get the scale degree intervals (0-indexed semitones from the key)
 * @param key - Root note of the scale
 * @param mode - Scale mode
 * @returns Array of intervals (e.g., [0, 2, 4, 5, 7, 9, 11] for major)
 */
function getScaleIntervals(key: string, mode: string): number[] {
	const scaleNotes = getScaleNotes(key, mode);
	const keyIndex = NOTE_NAMES.indexOf(Note.simplify(key));

	return scaleNotes.map((note) => {
		const noteIndex = NOTE_NAMES.indexOf(Note.simplify(note));
		// Calculate interval, wrapping around the octave
		return (noteIndex - keyIndex + 12) % 12;
	});
}

/**
 * Check if a chord quality fits a scale degree
 * This checks if all the notes in the chord are in the scale
 * @param rootMidi - MIDI note number of the chord root
 * @param quality - Chord quality (e.g., '', 'm', 'maj7', '7')
 * @param scaleNotes - Array of note names in the scale
 * @returns true if the chord quality fits within the scale
 */
export function isQualityValidForScaleDegree(
	rootMidi: number,
	quality: ChordQuality,
	scaleNotes: string[]
): boolean {
	if (scaleNotes.length === 0) return true;

	// First check if root is in scale
	if (!isRootInScale(rootMidi, scaleNotes)) return false;

	// Get the chord intervals
	const chordIntervals = QUALITIES[quality];
	const rootName = NOTE_NAMES[rootMidi % 12];
	const rootIndex = NOTE_NAMES.indexOf(Note.simplify(rootName));

	// Normalize scale notes
	const normalizedScaleNotes = scaleNotes.map((note) => Note.simplify(note));
	const scaleNoteIndices = normalizedScaleNotes.map((note) => NOTE_NAMES.indexOf(note));

	// Check if all chord notes are in the scale
	for (const interval of chordIntervals) {
		const noteIndex = (rootIndex + interval) % 12;
		if (!scaleNoteIndices.includes(noteIndex)) {
			return false;
		}
	}

	return true;
}

/**
 * Get all valid chord qualities for a given root note within a scale
 * @param rootMidi - MIDI note number of the chord root
 * @param scaleNotes - Array of note names in the scale
 * @returns Array of valid chord qualities
 */
export function getValidQualitiesForRoot(rootMidi: number, scaleNotes: string[]): ChordQuality[] {
	if (scaleNotes.length === 0) {
		return Object.keys(QUALITIES) as ChordQuality[];
	}

	const validQualities: ChordQuality[] = [];
	const qualities = Object.keys(QUALITIES) as ChordQuality[];

	for (const quality of qualities) {
		if (isQualityValidForScaleDegree(rootMidi, quality, scaleNotes)) {
			validQualities.push(quality);
		}
	}

	return validQualities;
}
