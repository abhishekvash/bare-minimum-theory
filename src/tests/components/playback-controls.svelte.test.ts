/**
 * Behaviour and hierarchy coverage for the progression transport toolbar.
 * The mounted component proves that Play and Stop share one primary-action slot while
 * save/export and stateful utilities keep their existing behaviour at lower visual weights.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import PlaybackControlsHarness from './PlaybackControlsHarness.svelte';
import { midiState } from '#lib/stores/midi.svelte.ts';

type HarnessProps = {
	isPlaying: boolean;
	hasChords: boolean;
	canSave: boolean;
	onPlay: () => void;
	onStop: () => void;
	onExport: () => void;
	onSave?: () => void;
	onOpenMIDISetup?: () => void;
	onTogglePiano?: () => void;
	isPianoVisible?: boolean;
};

let target: HTMLElement;
let component: Record<string, unknown> | null = null;

function renderControls(overrides: Partial<HarnessProps> = {}): HTMLElement {
	target = document.createElement('div');
	document.body.appendChild(target);
	component = mount(PlaybackControlsHarness, {
		target,
		props: {
			isPlaying: false,
			hasChords: true,
			canSave: true,
			onPlay: vi.fn(),
			onStop: vi.fn(),
			onExport: vi.fn(),
			onSave: vi.fn(),
			onTogglePiano: vi.fn(),
			...overrides
		}
	});
	flushSync();
	return target;
}

function action(name: 'play' | 'stop' | 'save' | 'export'): HTMLButtonElement {
	const button = target.querySelector<HTMLButtonElement>(`button[data-action="${name}"]`);
	if (!button) throw new Error(`${name} action was not rendered`);
	return button;
}

function midiToggle(): HTMLButtonElement {
	const button = target.querySelector<HTMLButtonElement>('button[data-midi-state]');
	if (!button) throw new Error('MIDI toggle was not rendered');
	return button;
}

function expectLowWeightUtility(button: HTMLButtonElement): void {
	expect(button.dataset.visualWeight).toBe('utility');
	expect(button.className).not.toMatch(/(?:^|\s)bg-(?:primary|secondary)(?:\/\S+)?(?:\s|$)/);
}

describe('PlaybackControls', () => {
	beforeEach(() => {
		midiState.isSupported = false;
		midiState.enabled = false;
		midiState.isConnected = false;
		midiState.clockSync.enabled = false;
		midiState.clockSync.isReceivingClock = false;
		midiState.clockSync.detectedBpm = null;
		midiState.clockSync.isExternallyPlaying = false;
	});

	afterEach(() => {
		if (component) unmount(component);
		component = null;
		target?.remove();
	});

	it('renders Play as the one unmistakable primary transport action while stopped', () => {
		const onPlay = vi.fn();
		renderControls({ onPlay });

		const play = action('play');
		expect(play.textContent?.trim()).toBe('Play');
		expect(play.dataset.visualWeight).toBe('primary');
		expect(target.querySelectorAll('[data-visual-weight="primary"]')).toHaveLength(1);
		expect(target.querySelector('[data-action="stop"]')).toBeNull();

		play.click();
		expect(onPlay).toHaveBeenCalledOnce();
	});

	it('swaps Stop into the same primary action slot while playing', () => {
		const onStop = vi.fn();
		renderControls({ isPlaying: true, onStop });

		const stop = action('stop');
		expect(stop.textContent?.trim()).toBe('Stop');
		expect(stop.dataset.visualWeight).toBe('primary');
		expect(target.querySelector('[data-action="play"]')).toBeNull();

		stop.click();
		expect(onStop).toHaveBeenCalledOnce();
	});

	it('keeps Save and Export quiet, independently disabled, and wired to their callbacks', () => {
		const onSave = vi.fn();
		const onExport = vi.fn();
		renderControls({ canSave: false, hasChords: true, onSave, onExport });

		const save = action('save');
		const exportButton = action('export');
		expect(save.dataset.visualWeight).toBe('secondary');
		expect(exportButton.dataset.visualWeight).toBe('secondary');
		expect(save.disabled).toBe(true);
		expect(exportButton.disabled).toBe(false);

		exportButton.click();
		expect(onExport).toHaveBeenCalledOnce();
		expect(onSave).not.toHaveBeenCalled();
	});

	it('groups the icon-only piano control apart as a low-weight utility', () => {
		const onTogglePiano = vi.fn();
		renderControls({ onTogglePiano, isPianoVisible: false });

		const utilities = target.querySelector<HTMLElement>('[aria-label="Playback utilities"]');
		const piano = utilities?.querySelector<HTMLButtonElement>('[aria-label="Show keyboard"]');
		expect(utilities?.dataset.visualWeight).toBe('utility');
		expect(piano?.textContent?.trim()).toBe('');
		expect(piano?.getAttribute('aria-pressed')).toBe('false');
		expectLowWeightUtility(piano!);

		piano?.click();
		expect(onTogglePiano).toHaveBeenCalledOnce();
	});

	it('keeps the active piano low-weight and exposes its pressed state', () => {
		renderControls({ isPianoVisible: true });

		const piano = target.querySelector<HTMLButtonElement>('[data-piano-state="visible"]');
		expect(piano?.getAttribute('aria-label')).toBe('Hide keyboard');
		expect(piano?.getAttribute('aria-pressed')).toBe('true');
		expectLowWeightUtility(piano!);
		expect(piano?.className).toContain('ring-primary/35');
	});

	it('omits the MIDI utility when the browser does not support MIDI', () => {
		renderControls();

		expect(target.querySelector('button[data-midi-state]')).toBeNull();
		expect(target.querySelector('[aria-label="MIDI Settings"]')).toBeNull();
	});

	it('renders supported MIDI off as an unpressed low-weight utility', () => {
		midiState.isSupported = true;
		renderControls();

		const midi = midiToggle();
		expect(midi.dataset.midiState).toBe('off');
		expect(midi.getAttribute('aria-label')).toBe('Enable MIDI output to DAW');
		expect(midi.getAttribute('aria-pressed')).toBe('false');
		expectLowWeightUtility(midi);
		expect(target.querySelector('[data-midi-indicator]')).toBeNull();
		expect(target.querySelector('[aria-label="MIDI Settings"]')).toBeNull();
	});

	it('shows enabled-disconnected MIDI with an amber indicator, not a filled button', () => {
		midiState.isSupported = true;
		midiState.enabled = true;
		midiState.isConnected = false;
		renderControls();

		const midi = midiToggle();
		expect(midi.dataset.midiState).toBe('disconnected');
		expect(midi.getAttribute('aria-label')).toBe('MIDI enabled but not connected');
		expect(midi.getAttribute('aria-pressed')).toBe('true');
		expectLowWeightUtility(midi);
		expect(midi.className).toContain('ring-yellow-500/40');
		expect(target.querySelector('[data-midi-indicator="disconnected"]')).not.toBeNull();
	});

	it('shows connected MIDI with a green indicator, not a primary-filled button', () => {
		midiState.isSupported = true;
		midiState.enabled = true;
		midiState.isConnected = true;
		renderControls();

		const midi = midiToggle();
		expect(midi.dataset.midiState).toBe('connected');
		expect(midi.getAttribute('aria-label')).toBe('MIDI output active - sending to DAW');
		expect(midi.getAttribute('aria-pressed')).toBe('true');
		expectLowWeightUtility(midi);
		expect(midi.className).toContain('ring-green-500/40');
		expect(target.querySelector('[data-midi-indicator="connected"]')).not.toBeNull();
	});

	it('reveals the labelled MIDI settings affordance only while MIDI is enabled', () => {
		const onOpenMIDISetup = vi.fn();
		midiState.isSupported = true;
		midiState.enabled = true;
		renderControls({ onOpenMIDISetup });

		const settings = target.querySelector<HTMLButtonElement>('[aria-label="MIDI Settings"]');
		expect(settings).not.toBeNull();
		expect(settings?.className).not.toMatch(/(?:^|\s)bg-(?:primary|secondary)/);
		settings?.click();
		expect(onOpenMIDISetup).toHaveBeenCalledOnce();
	});

	it('preserves DAW control disabling and the clock status indicator', () => {
		midiState.clockSync.enabled = true;
		midiState.clockSync.isReceivingClock = true;
		midiState.clockSync.detectedBpm = 124;

		renderControls({ isPlaying: true });

		const stop = action('stop');
		expect(stop.disabled).toBe(true);
		expect(stop.getAttribute('aria-label')).toBe('Controlled by DAW');
		expect(
			target.querySelector('[aria-label="MIDI clock receiving at 124 BPM"]')?.textContent?.trim()
		).toBe('124 BPM');
	});
});
