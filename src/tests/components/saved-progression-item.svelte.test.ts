import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import SavedProgressionItemHarness from './SavedProgressionItemHarness.svelte';
import type { SavedProgression } from '$lib/utils/progression-persistence';

const { mockCancelSequence, mockStartSequence } = vi.hoisted(() => {
	const mockCancelSequence = vi.fn();
	return {
		mockCancelSequence,
		mockStartSequence: vi.fn(() => ({ cancel: mockCancelSequence }))
	};
});

vi.mock('$lib/utils/audition-controller', () => ({
	isTransportActive: () => false,
	startAuditionSequence: mockStartSequence
}));

const SAVED: SavedProgression = {
	id: 'saved-preview',
	name: 'Preview me',
	tags: [],
	progression: [
		{ root: 60, quality: '', inversion: 0, voicing: 'close', octave: 0, duration: '1m' },
		null
	],
	createdAt: 0
};

let target: HTMLElement;
let component: Record<string, unknown> | null = null;

afterEach(() => {
	if (component) unmount(component);
	component = null;
	target?.remove();
	vi.clearAllMocks();
});

describe('SavedProgressionItem preview ownership', () => {
	it('cancels its scoped sequence handle on component teardown', () => {
		target = document.createElement('div');
		document.body.appendChild(target);
		component = mount(SavedProgressionItemHarness, { target, props: { progression: SAVED } });
		flushSync();

		const preview = target.querySelector<HTMLButtonElement>(
			'button[aria-label="Preview progression"]'
		);
		expect(preview).not.toBeNull();
		preview?.click();
		flushSync();
		expect(mockStartSequence).toHaveBeenCalledOnce();

		unmount(component);
		component = null;
		expect(mockCancelSequence).toHaveBeenCalledOnce();
	});
});
