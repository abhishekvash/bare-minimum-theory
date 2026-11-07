/** Mounted Settings dialog: sections render, toggles apply and persist, entry points open it. */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushSync, mount, tick, unmount } from 'svelte';
import { settle } from '../helpers/settle';
import SettingsDialog from '#lib/components/settings/SettingsDialog.svelte';
import {
	initPianoSettings,
	initPreviewOptions,
	initRandomizeOptions,
	settingsState
} from '#lib/stores/settings.svelte.ts';
import { closeSettings, openSettings, resetUIState, uiState } from '#lib/stores/ui.svelte.ts';
import {
	DEFAULT_PREVIEW_OPTIONS,
	DEFAULT_RANDOMIZE_OPTIONS,
	loadPreviewSettings,
	loadRandomizeSettings
} from '#lib/utils/settings-persistence.ts';
import { loadPianoSettings } from '#lib/utils/piano-settings-persistence.ts';

let target: HTMLElement;
let component: Record<string, unknown> | null = null;

async function renderOpen(section: Parameters<typeof openSettings>[0] = null): Promise<void> {
	target = document.createElement('div');
	document.body.appendChild(target);
	component = mount(SettingsDialog, { target });
	// The app mounts the dialog at page load, long before anything opens it
	flushSync();
	openSettings(section);
	flushSync();
	await settle();
}

function checkbox(id: string): HTMLInputElement {
	const input = document.getElementById(id) as HTMLInputElement | null;
	if (!input) throw new Error(`#${id} not rendered`);
	return input;
}

describe('SettingsDialog', () => {
	beforeEach(() => {
		// jsdom has no layout, so it does not implement scrollIntoView
		Element.prototype.scrollIntoView = vi.fn();
		localStorage.clear();
		resetUIState();
		initPreviewOptions(DEFAULT_PREVIEW_OPTIONS);
		initRandomizeOptions(DEFAULT_RANDOMIZE_OPTIONS);
		initPianoSettings({ visible: false });
	});

	afterEach(() => {
		closeSettings();
		flushSync();
		if (component) unmount(component);
		component = null;
		target?.remove();
	});

	it('renders the Preview, Randomize, MIDI and Display sections', async () => {
		await renderOpen();

		for (const section of ['preview', 'randomize', 'midi', 'display']) {
			expect(document.querySelector(`[data-settings-section="${section}"]`)).not.toBeNull();
		}
	});

	it('starts with chained preview off and persists turning it on', async () => {
		await renderOpen();
		const chained = checkbox('setting-preview-chained');
		expect(chained.checked).toBe(false);

		chained.click();
		flushSync();

		expect(settingsState.previewOptions.chained).toBe(true);
		expect(loadPreviewSettings().chained).toBe(true);
	});

	it('persists randomize scope changes', async () => {
		await renderOpen('randomize');

		checkbox('setting-randomize-octave').click();
		flushSync();

		expect(settingsState.randomizeOptions.octave).toBe(true);
		expect(loadRandomizeSettings().octave).toBe(true);
	});

	it('mirrors and persists piano keyboard visibility', async () => {
		await renderOpen('display');

		checkbox('setting-display-piano').click();
		flushSync();

		expect(settingsState.pianoKeyboard.visible).toBe(true);
		expect(loadPianoSettings().visible).toBe(true);
	});

	it('scrolls a contextual entry point to its section and clears it on close', async () => {
		await renderOpen('midi');
		await tick();
		expect(uiState.settings).toEqual({ open: true, section: 'midi' });
		const scrolled = vi.mocked(Element.prototype.scrollIntoView).mock.contexts;
		expect(scrolled).toContain(document.querySelector('[data-settings-section="midi"]'));

		closeSettings();
		expect(uiState.settings).toEqual({ open: false, section: null });
	});
});
