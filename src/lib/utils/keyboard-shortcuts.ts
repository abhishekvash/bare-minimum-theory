/**
 * Keyboard Shortcuts Handler
 * Centralized keyboard event handling for the chord progression builder
 */

import { NOTE_NAMES, QUALITY_ORDER } from '$lib/utils/theory-engine/constants';
import type { ChordQuality } from '$lib/utils/theory-engine/types';

/** Which grid is currently focused for keyboard navigation */
export type BuilderFocus = 'root' | 'quality';

/** Keyboard navigation state */
export interface KeyboardState {
	/** Which builder grid has focus */
	builderFocus: BuilderFocus;
	/** Index within the root grid (0-11) */
	rootIndex: number;
	/** Index within the quality grid (0 to QUALITY_ORDER.length-1) */
	qualityIndex: number;
	/** Currently focused progression slot (0-3) or null */
	focusedSlot: number | null;
}

/** Callbacks for keyboard actions */
export interface KeyboardCallbacks {
	onPlayStop: () => void;
	onStop: () => void;
	onSave: () => void;
	onExport: () => void;
	onHelp: () => void;
	onSelectRoot: (midiNote: number) => void;
	onSelectQuality: (quality: ChordQuality) => void;
	onAddChord: () => void;
	onReplaceSlot: (slotIndex: number) => void;
	onPreviewSlot: (slotIndex: number) => void;
	isModalOpen: () => boolean;
	isPlaying: () => boolean;
	canSave: () => boolean;
	hasChordSelected: () => boolean;
}

/** Grid dimensions for arrow key navigation */
const ROOT_GRID_COLS = 12; // Desktop: 12 columns for root notes
const QUALITY_GRID_COLS = 6; // Desktop: 6 columns for qualities

/**
 * Create keyboard state with defaults
 */
export function createKeyboardState(): KeyboardState {
	return {
		builderFocus: 'root',
		rootIndex: 0,
		qualityIndex: 0,
		focusedSlot: null
	};
}

/**
 * Move within a grid using arrow keys
 */
function moveInGrid(
	currentIndex: number,
	direction: 'up' | 'down' | 'left' | 'right',
	cols: number,
	totalItems: number
): number {
	const row = Math.floor(currentIndex / cols);
	const col = currentIndex % cols;
	const totalRows = Math.ceil(totalItems / cols);

	let newRow = row;
	let newCol = col;

	switch (direction) {
		case 'up':
			newRow = row > 0 ? row - 1 : totalRows - 1;
			break;
		case 'down':
			newRow = row < totalRows - 1 ? row + 1 : 0;
			break;
		case 'left':
			newCol = col > 0 ? col - 1 : cols - 1;
			break;
		case 'right':
			newCol = col < cols - 1 ? col + 1 : 0;
			break;
		default:
			// No change if direction is invalid
			break;
	}

	const newIndex = newRow * cols + newCol;
	return Math.min(newIndex, totalItems - 1);
}

/**
 * Handle global shortcuts that work even when modals are open
 */
function handleGlobalShortcuts(
	key: string,
	shiftKey: boolean,
	callbacks: KeyboardCallbacks
): boolean {
	// Always allow Escape (stop playback, close modals)
	if (key === 'Escape') {
		callbacks.onStop();
		return true;
	}

	// Always allow ? for help (even in modals)
	if (key === '?' || (key === '/' && shiftKey)) {
		callbacks.onHelp();
		return true;
	}

	return false;
}

/**
 * Handle modifier key shortcuts (Cmd/Ctrl+Key)
 */
function handleModifierShortcuts(
	key: string,
	modKey: boolean,
	callbacks: KeyboardCallbacks
): boolean {
	if (!modKey) return false;

	// Cmd/Ctrl+S - Save
	if (key.toLowerCase() === 's') {
		if (callbacks.canSave()) {
			callbacks.onSave();
		}
		return true;
	}

	// Cmd/Ctrl+E - Export
	if (key.toLowerCase() === 'e') {
		callbacks.onExport();
		return true;
	}

	return false;
}

/**
 * Handle grid navigation (Tab and Arrow keys)
 */
function handleGridNavigation(
	key: string,
	modKey: boolean,
	state: KeyboardState,
	callbacks: KeyboardCallbacks
): boolean {
	// Tab - Toggle between root and quality grids
	if (key === 'Tab' && !modKey) {
		state.builderFocus = state.builderFocus === 'root' ? 'quality' : 'root';
		// Trigger selection of current item in new grid
		if (state.builderFocus === 'root') {
			const midiNote = 60 + state.rootIndex;
			callbacks.onSelectRoot(midiNote);
		} else {
			const quality = QUALITY_ORDER[state.qualityIndex] as ChordQuality;
			callbacks.onSelectQuality(quality);
		}
		return true;
	}

	// Arrow keys - Navigate within focused grid
	if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) {
		const direction = key.replace('Arrow', '').toLowerCase() as 'up' | 'down' | 'left' | 'right';

		if (state.builderFocus === 'root') {
			state.rootIndex = moveInGrid(state.rootIndex, direction, ROOT_GRID_COLS, NOTE_NAMES.length);
			const midiNote = 60 + state.rootIndex;
			callbacks.onSelectRoot(midiNote);
		} else {
			state.qualityIndex = moveInGrid(
				state.qualityIndex,
				direction,
				QUALITY_GRID_COLS,
				QUALITY_ORDER.length
			);
			const quality = QUALITY_ORDER[state.qualityIndex] as ChordQuality;
			callbacks.onSelectQuality(quality);
		}
		return true;
	}

	return false;
}

/**
 * Handle progression slot actions (1-4, R, Enter)
 */
function handleSlotActions(
	key: string,
	modKey: boolean,
	state: KeyboardState,
	callbacks: KeyboardCallbacks
): boolean {
	// 1-4 - Focus progression slot (and preview)
	if (['1', '2', '3', '4'].includes(key) && !modKey) {
		const slotIndex = parseInt(key) - 1;
		state.focusedSlot = slotIndex;
		callbacks.onPreviewSlot(slotIndex);
		return true;
	}

	// R - Replace focused slot with current builder chord
	if (key.toLowerCase() === 'r' && !modKey) {
		if (state.focusedSlot !== null && callbacks.hasChordSelected()) {
			callbacks.onReplaceSlot(state.focusedSlot);
		}
		return true;
	}

	// Enter - Add chord to progression (or replace focused slot)
	if (key === 'Enter' && !modKey) {
		if (callbacks.hasChordSelected()) {
			if (state.focusedSlot !== null) {
				callbacks.onReplaceSlot(state.focusedSlot);
			} else {
				callbacks.onAddChord();
			}
		}
		return true;
	}

	return false;
}

/**
 * Handle a keyboard event and update state accordingly
 * Returns true if the event was handled (should preventDefault)
 */
export function handleKeyboardEvent(
	event: KeyboardEvent,
	state: KeyboardState,
	callbacks: KeyboardCallbacks
): boolean {
	const { key, metaKey, ctrlKey, shiftKey } = event;
	const modKey = metaKey || ctrlKey;

	// Handle global shortcuts (work even in modals)
	if (handleGlobalShortcuts(key, shiftKey, callbacks)) {
		return true;
	}

	// Block other shortcuts when modal is open
	if (callbacks.isModalOpen()) {
		return false;
	}

	// Space - Play/Stop toggle
	if (key === ' ') {
		callbacks.onPlayStop();
		return true;
	}

	// Handle modifier shortcuts (Cmd/Ctrl+Key)
	if (handleModifierShortcuts(key, modKey, callbacks)) {
		return true;
	}

	// Handle grid navigation
	if (handleGridNavigation(key, modKey, state, callbacks)) {
		return true;
	}

	// Handle slot actions
	if (handleSlotActions(key, modKey, state, callbacks)) {
		return true;
	}

	return false;
}
