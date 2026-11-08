import { describe, it, expect } from 'vitest';
import { QUALITIES, QUALITY_GRADIENT, QUALITY_ORDER } from '#lib/utils/theory-engine/constants.ts';

describe('QUALITY_GRADIENT', () => {
	const definedQualities = Object.keys(QUALITIES);

	it('lists every defined quality exactly once', () => {
		const seen = new Set(QUALITY_GRADIENT);

		expect(seen.size).toBe(QUALITY_GRADIENT.length);
		expect(QUALITY_GRADIENT.length).toBe(definedQualities.length);
		expect([...seen].sort()).toEqual([...definedQualities].sort());
	});

	it('covers the same set as QUALITY_ORDER', () => {
		expect([...QUALITY_GRADIENT].sort()).toEqual([...QUALITY_ORDER].sort());
	});

	it('orders the bands simple to dense', () => {
		const positionOf = (quality: string) => QUALITY_GRADIENT.indexOf(quality as never);

		// A representative from each band; bands never interleave
		expect(positionOf('')).toBeLessThan(positionOf('sus2'));
		expect(positionOf('sus2')).toBeLessThan(positionOf('7'));
		expect(positionOf('7')).toBeLessThan(positionOf('9'));
		expect(positionOf('maj13')).toBeLessThan(positionOf('7b9'));
	});

	it('opens on the bare triads', () => {
		expect(QUALITY_GRADIENT.slice(0, 5)).toEqual(['', 'm', '5', 'dim', 'aug']);
	});

	it('leaves QUALITY_ORDER as the popularity ordering', () => {
		// The two orderings are deliberately different: the keyboard's quality grid still walks
		// QUALITY_ORDER while only the field is laid out on the gradient. (Randomize belongs to
		// neither — it samples Object.keys(QUALITIES) directly.)
		expect([...QUALITY_GRADIENT]).not.toEqual([...QUALITY_ORDER]);
		expect(QUALITY_ORDER[0]).toBe('');
		expect(QUALITY_ORDER[2]).toBe('sus4');
	});
});
