import { describe, it, expect } from 'vitest';
import {
	remapIndexAfterExchange,
	remapIndexAfterInsert,
	remapIndexAfterRemove
} from '$lib/utils/slot-index';

describe('remapIndexAfterExchange', () => {
	it.each([
		[2, 2, 5, 5],
		[5, 2, 5, 2],
		[3, 2, 5, 3],
		[null, 2, 5, null]
	])('index %s after exchanging %s and %s becomes %s', (index, a, b, expected) => {
		expect(remapIndexAfterExchange(index, a, b)).toBe(expected);
	});
});

describe('remapIndexAfterInsert', () => {
	it.each([
		[1, 3, 1],
		[3, 3, 4],
		[5, 3, 6],
		[null, 3, null]
	])('index %s after inserting at %s becomes %s', (index, at, expected) => {
		expect(remapIndexAfterInsert(index, at)).toBe(expected);
	});
});

describe('remapIndexAfterRemove', () => {
	it.each([
		[1, 3, 1],
		[3, 3, null],
		[5, 3, 4],
		[null, 3, null]
	])('index %s after removing %s becomes %s', (index, at, expected) => {
		expect(remapIndexAfterRemove(index, at)).toBe(expected);
	});
});
