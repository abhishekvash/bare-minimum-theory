import { describe, it, expect, beforeEach } from 'vitest';
import {
    settingsState,
    setRandomizeOption,
    initRandomizeOptions,
    setPianoVisible,
    setActiveNotes,
    clearActiveNotes,
    initPianoSettings
} from '$lib/stores/settings.svelte';
import { DEFAULT_RANDOMIZE_OPTIONS } from '$lib/utils/settings-persistence';
import { DEFAULT_PIANO_SETTINGS } from '$lib/utils/piano-settings-persistence';

describe('Settings State Management', () => {
    beforeEach(() => {
        initRandomizeOptions({ ...DEFAULT_RANDOMIZE_OPTIONS });
        initPianoSettings({ ...DEFAULT_PIANO_SETTINGS });
        clearActiveNotes();
    });

    // ============================================================================
    // Randomize Options Tests
    // ============================================================================

    describe('setRandomizeOption', () => {
        it('should set inversion option', () => {
            setRandomizeOption('inversion', false);
            expect(settingsState.randomizeOptions.inversion).toBe(false);

            setRandomizeOption('inversion', true);
            expect(settingsState.randomizeOptions.inversion).toBe(true);
        });

        it('should set voicing option', () => {
            setRandomizeOption('voicing', false);
            expect(settingsState.randomizeOptions.voicing).toBe(false);
        });

        it('should set octave option', () => {
            setRandomizeOption('octave', true);
            expect(settingsState.randomizeOptions.octave).toBe(true);
        });

        it('should set quality option', () => {
            setRandomizeOption('quality', true);
            expect(settingsState.randomizeOptions.quality).toBe(true);
        });
    });

    describe('initRandomizeOptions', () => {
        it('should initialize all options', () => {
            initRandomizeOptions({
                inversion: false,
                voicing: false,
                octave: true,
                quality: true
            });

            expect(settingsState.randomizeOptions.inversion).toBe(false);
            expect(settingsState.randomizeOptions.voicing).toBe(false);
            expect(settingsState.randomizeOptions.octave).toBe(true);
            expect(settingsState.randomizeOptions.quality).toBe(true);
        });

        it('should reset to defaults', () => {
            // Set non-default values first
            setRandomizeOption('inversion', false);
            setRandomizeOption('quality', true);

            // Reset to defaults
            initRandomizeOptions({ ...DEFAULT_RANDOMIZE_OPTIONS });

            expect(settingsState.randomizeOptions.inversion).toBe(true);
            expect(settingsState.randomizeOptions.voicing).toBe(true);
            expect(settingsState.randomizeOptions.octave).toBe(false);
            expect(settingsState.randomizeOptions.quality).toBe(false);
        });
    });

    // ============================================================================
    // Piano Keyboard Tests
    // ============================================================================

    describe('Piano Keyboard Settings', () => {
        it('should toggle visibility', () => {
            setPianoVisible(true);
            expect(settingsState.pianoKeyboard.visible).toBe(true);
            setPianoVisible(false);
            expect(settingsState.pianoKeyboard.visible).toBe(false);
        });

        it('should set active notes', () => {
            setActiveNotes([60, 64, 67]);
            expect(settingsState.pianoKeyboard.activeNotes).toEqual([60, 64, 67]);
        });

        it('should clear active notes', () => {
            setActiveNotes([60, 64, 67]);
            clearActiveNotes();
            expect(settingsState.pianoKeyboard.activeNotes).toHaveLength(0);
        });

        it('should initialize settings', () => {
            initPianoSettings({ visible: true });
            expect(settingsState.pianoKeyboard.visible).toBe(true);
        });
    });
});
