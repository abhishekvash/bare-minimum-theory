/** Centralized keyboard contract for transport, surface-stack Escape and builder navigation. */

import { NOTE_NAMES, QUALITY_GRADIENT } from '$lib/utils/theory-engine/constants';
import type { ChordQuality } from '$lib/utils/theory-engine/types';

export interface KeyboardState {
	rootIndex: number;
	qualityIndex: number;
	browseQualityIndex: number | null;
}

export interface KeyboardCallbacks {
	onPlayStop: () => void;
	onStop: () => void;
	onSave: () => void;
	onExport: () => void;
	onHelp: () => void;
	onRevertAudition: () => void;
	onCloseInspector: () => void;
	onCloseLibrary: () => void;
	onCloseOverlay: () => void;
	onSelectSlot: (slotIndex: number) => boolean;
	onSelectRoot: (midiNote: number, audition: boolean) => void;
	onSelectQuality: (quality: ChordQuality, audition: boolean) => void;
	onBrowseQuality: (quality: ChordQuality) => void;
	onStageQuality: (quality: ChordQuality) => void;
	onFocusRoot: (index: number) => void;
	onFocusQuality: (index: number) => void;
	onAddChord: () => void;
	onReplaceSlot: (slotIndex: number) => void;
	hasPendingAudition: () => boolean;
	hasInspector: () => boolean;
	hasLibraryPanel: () => boolean;
	hasOverlay: () => boolean;
	selectedSlot: () => number | null;
	isPlaying: () => boolean;
	canSave: () => boolean;
	hasChordSelected: () => boolean;
	qualityGridColumns: () => number;
}

export function createKeyboardState(): KeyboardState {
	return { rootIndex: 0, qualityIndex: 0, browseQualityIndex: null };
}

/** Reset the transport-only quality browse cursor. */
export function resetKeyboardBrowse(state: KeyboardState): void {
	state.browseQualityIndex = null;
}

function moveInGrid(
	currentIndex: number,
	direction: 'up' | 'down' | 'left' | 'right',
	cols: number,
	totalItems: number
): number {
	const row = Math.floor(currentIndex / cols);
	const col = currentIndex % cols;
	const rows = Math.ceil(totalItems / cols);
	let nextRow = row;
	let nextCol = col;

	if (direction === 'up') nextRow = row > 0 ? row - 1 : rows - 1;
	if (direction === 'down') nextRow = row < rows - 1 ? row + 1 : 0;
	if (direction === 'left') nextCol = col > 0 ? col - 1 : cols - 1;
	if (direction === 'right') nextCol = col < cols - 1 ? col + 1 : 0;

	return Math.min(nextRow * cols + nextCol, totalItems - 1);
}

function closeTopSurface(callbacks: KeyboardCallbacks): boolean {
	if (callbacks.hasPendingAudition()) callbacks.onRevertAudition();
	else if (callbacks.hasInspector()) callbacks.onCloseInspector();
	else if (callbacks.hasLibraryPanel()) callbacks.onCloseLibrary();
	else if (callbacks.hasOverlay()) callbacks.onCloseOverlay();
	else if (callbacks.isPlaying()) callbacks.onStop();
	else return false;
	return true;
}

function handleModifier(key: string, modKey: boolean, callbacks: KeyboardCallbacks): boolean {
	if (!modKey) return false;
	if (key.toLowerCase() === 's') {
		if (callbacks.canSave()) callbacks.onSave();
		return true;
	}
	if (key.toLowerCase() === 'e') {
		callbacks.onExport();
		return true;
	}
	return false;
}

function rootIndexFromTarget(target: EventTarget | null): number | null {
	if (!(target instanceof Element)) return null;
	const value = target.closest<HTMLElement>('[data-root]')?.dataset.root;
	if (value === undefined) return null;
	const midi = Number(value);
	return Number.isInteger(midi) ? midi - 60 : null;
}

function qualityIndexFromTarget(target: EventTarget | null): number | null {
	if (!(target instanceof Element)) return null;
	const quality = target.closest<HTMLElement>('[data-quality]')?.getAttribute('data-quality');
	if (quality === null || quality === undefined) return null;
	const index = QUALITY_GRADIENT.indexOf(quality as ChordQuality);
	return index >= 0 ? index : null;
}

function handleBuilderNavigation(
	event: KeyboardEvent,
	state: KeyboardState,
	callbacks: KeyboardCallbacks
): boolean {
	const rootIndex = rootIndexFromTarget(event.target);
	const qualityIndex = qualityIndexFromTarget(event.target);
	const arrow = event.key.replace('Arrow', '').toLowerCase() as 'up' | 'down' | 'left' | 'right';
	const isArrow = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key);

	if (rootIndex !== null) {
		state.rootIndex = rootIndex;
		if (!isArrow) return false;
		if (event.key === 'ArrowDown') {
			callbacks.onFocusQuality(state.qualityIndex);
			return true;
		}
		if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
			state.rootIndex =
				event.key === 'ArrowLeft'
					? (rootIndex - 1 + NOTE_NAMES.length) % NOTE_NAMES.length
					: (rootIndex + 1) % NOTE_NAMES.length;
			// During playback the focus ring is a browse cursor only. The builder selection stays put.
			if (!callbacks.isPlaying()) callbacks.onSelectRoot(60 + state.rootIndex, true);
			callbacks.onFocusRoot(state.rootIndex);
			return true;
		}
		return false;
	}

	if (qualityIndex === null) return false;
	if (callbacks.isPlaying() && qualityIndex !== state.qualityIndex) {
		state.browseQualityIndex = null;
	}
	state.qualityIndex = callbacks.isPlaying()
		? (state.browseQualityIndex ?? qualityIndex)
		: qualityIndex;

	if (event.key === 'Enter' && callbacks.isPlaying()) {
		const index = state.browseQualityIndex ?? qualityIndex;
		callbacks.onStageQuality(QUALITY_GRADIENT[index] as ChordQuality);
		state.qualityIndex = index;
		return true;
	}
	if (!isArrow) return false;

	const qualityGridColumns = Math.max(1, callbacks.qualityGridColumns());
	if (event.key === 'ArrowUp' && state.qualityIndex < qualityGridColumns) {
		callbacks.onFocusRoot(state.rootIndex);
		return true;
	}

	state.qualityIndex = moveInGrid(
		state.qualityIndex,
		arrow,
		qualityGridColumns,
		QUALITY_GRADIENT.length
	);
	const quality = QUALITY_GRADIENT[state.qualityIndex] as ChordQuality;
	if (callbacks.isPlaying()) {
		state.browseQualityIndex = state.qualityIndex;
		callbacks.onBrowseQuality(quality);
	} else {
		state.browseQualityIndex = null;
		callbacks.onSelectQuality(quality, true);
	}
	callbacks.onFocusQuality(state.qualityIndex);
	return true;
}

function isInteractiveTarget(target: EventTarget | null): boolean {
	if (!(target instanceof Element)) return false;
	return Boolean(
		target.closest(
			'button, a, input, select, textarea, [contenteditable="true"], [role="button"], [role="link"]'
		)
	);
}

export function handleKeyboardEvent(
	event: KeyboardEvent,
	state: KeyboardState,
	callbacks: KeyboardCallbacks
): boolean {
	if (event.defaultPrevented) return false;
	const { key, metaKey, ctrlKey, shiftKey } = event;
	const modKey = metaKey || ctrlKey;

	if (key === 'Escape') return closeTopSurface(callbacks);
	if (key === '?' || (key === '/' && shiftKey)) {
		callbacks.onHelp();
		return true;
	}
	// Space is the instant transport toggle, even when another surface is open.
	if (key === ' ') {
		callbacks.onPlayStop();
		return true;
	}

	if (callbacks.hasOverlay()) return false;
	if (handleModifier(key, modKey, callbacks)) return true;
	// Native Tab is intentionally untouched.
	if (key === 'Tab') return false;
	if (handleBuilderNavigation(event, state, callbacks)) return true;

	if (!modKey && /^[1-9]$/.test(key)) {
		return callbacks.onSelectSlot(Number(key) - 1);
	}

	if (!modKey && key.toLowerCase() === 'r') {
		const slot = callbacks.selectedSlot();
		if (slot !== null && callbacks.hasChordSelected()) callbacks.onReplaceSlot(slot);
		return true;
	}

	if (
		!modKey &&
		key === 'Enter' &&
		!isInteractiveTarget(event.target) &&
		callbacks.hasChordSelected()
	) {
		const slot = callbacks.selectedSlot();
		if (slot === null) callbacks.onAddChord();
		else callbacks.onReplaceSlot(slot);
		return true;
	}

	return false;
}
