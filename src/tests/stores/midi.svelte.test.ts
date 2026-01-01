import { describe, it, expect, beforeEach } from 'vitest';
import {
    midiState,
    setMIDIEnabled,
    setMIDIConnectionState,
    setMIDISupported,
    setMIDIPermissionGranted,
    updateMIDIOutputs,
    updateMIDIInputs,
    setMIDIDevice,
    setMIDIChannel,
    setMIDIVelocity,
    setMIDIStrumEnabled,
    setMIDIError,
    initMIDISettings,
    setMIDIHasSeenSetupModal,
    setClockSyncEnabled,
    setClockInputDevice,
    setClockReceivingState,
    setDetectedBpm,
    setExternalPlayingState,
    initMIDIClockSettings
} from '$lib/stores/midi.svelte';
import { DEFAULT_MIDI_SETTINGS } from '$lib/utils/midi-settings-persistence';
import { DEFAULT_MIDI_CLOCK_SETTINGS } from '$lib/utils/midi-clock-persistence';

describe('MIDI Store Management', () => {
    beforeEach(() => {
        initMIDISettings({ ...DEFAULT_MIDI_SETTINGS });
        initMIDIClockSettings({ ...DEFAULT_MIDI_CLOCK_SETTINGS });
        // Reset other state manually since init only resets settings
        setMIDIConnectionState(false);
        setMIDISupported(true);
        setMIDIPermissionGranted(false);
        updateMIDIOutputs([]);
        updateMIDIInputs([]);
        setMIDIError(null);
        setClockReceivingState(false);
        setDetectedBpm(null);
        setExternalPlayingState(false);
    });

    describe('Connection State', () => {
        it('should set enabled state', () => {
            setMIDIEnabled(true);
            expect(midiState.enabled).toBe(true);
            setMIDIEnabled(false);
            expect(midiState.enabled).toBe(false);
        });

        it('should set connection state', () => {
            setMIDIConnectionState(true);
            expect(midiState.isConnected).toBe(true);
            setMIDIConnectionState(false);
            expect(midiState.isConnected).toBe(false);
        });

        it('should set supported state', () => {
            setMIDISupported(false);
            expect(midiState.isSupported).toBe(false);
        });

        it('should set permission granted', () => {
            setMIDIPermissionGranted(true);
            expect(midiState.permissionGranted).toBe(true);
        });
    });

    describe('Output Management', () => {
        it('should update outputs list', () => {
            const outputs = [
                { id: '1', name: 'Output 1' },
                { id: '2', name: 'Output 2' }
            ];
            updateMIDIOutputs(outputs);

            expect(midiState.outputs).toHaveLength(2);
            expect(midiState.outputs[0]).toEqual(outputs[0]);
        });

        it('should set selected device ID', () => {
            setMIDIDevice('test-device-id');
            expect(midiState.selectedDeviceId).toBe('test-device-id');
        });

        it('should set selected device to null', () => {
            setMIDIDevice('test-id');
            setMIDIDevice(null);
            expect(midiState.selectedDeviceId).toBeNull();
        });
    });

    describe('Transmission Settings', () => {
        it('should set MIDI channel', () => {
            setMIDIChannel(5);
            expect(midiState.midiChannel).toBe(5);
        });

        it('should set velocity', () => {
            setMIDIVelocity(120);
            expect(midiState.velocity).toBe(120);
        });

        it('should set strum enabled', () => {
            setMIDIStrumEnabled(true);
            expect(midiState.strumEnabled).toBe(true);
        });
    });

    describe('Setup State', () => {
        it('should set hasSeenSetupModal', () => {
            setMIDIHasSeenSetupModal(true);
            expect(midiState.hasSeenSetupModal).toBe(true);
        });

        it('should set error', () => {
            setMIDIError('permission_denied');
            expect(midiState.error).toBe('permission_denied');
            setMIDIError(null);
            expect(midiState.error).toBeNull();
        });
    });

    describe('Initialization', () => {
        it('should initialize with settings', () => {
            initMIDISettings({
                enabled: true,
                selectedDeviceId: 'saved-id',
                midiChannel: 2,
                velocity: 80,
                hasSeenSetupModal: true,
                strumEnabled: true
            });

            expect(midiState.enabled).toBe(true);
            expect(midiState.selectedDeviceId).toBe('saved-id');
            expect(midiState.midiChannel).toBe(2);
            expect(midiState.velocity).toBe(80);
            expect(midiState.hasSeenSetupModal).toBe(true);
            expect(midiState.strumEnabled).toBe(true);
        });
    });

    // ============================================================================
    // MIDI Clock Sync Tests
    // ============================================================================

    describe('Clock Sync State', () => {
        it('should toggle clock sync enabled', () => {
            setClockSyncEnabled(true);
            expect(midiState.clockSync.enabled).toBe(true);
            setClockSyncEnabled(false);
            expect(midiState.clockSync.enabled).toBe(false);
        });

        it('should set clock input device', () => {
            setClockInputDevice('clock-input-1');
            expect(midiState.clockSync.selectedInputId).toBe('clock-input-1');
        });

        it('should set clock input device to null', () => {
            setClockInputDevice('clock-input-1');
            setClockInputDevice(null);
            expect(midiState.clockSync.selectedInputId).toBeNull();
        });

        it('should set clock receiving state', () => {
            setClockReceivingState(true);
            expect(midiState.clockSync.isReceivingClock).toBe(true);
            setClockReceivingState(false);
            expect(midiState.clockSync.isReceivingClock).toBe(false);
        });

        it('should set detected BPM', () => {
            setDetectedBpm(120);
            expect(midiState.clockSync.detectedBpm).toBe(120);
            setDetectedBpm(140.5);
            expect(midiState.clockSync.detectedBpm).toBe(140.5);
        });

        it('should set detected BPM to null', () => {
            setDetectedBpm(120);
            setDetectedBpm(null);
            expect(midiState.clockSync.detectedBpm).toBeNull();
        });

        it('should set external playing state', () => {
            setExternalPlayingState(true);
            expect(midiState.clockSync.isExternallyPlaying).toBe(true);
            setExternalPlayingState(false);
            expect(midiState.clockSync.isExternallyPlaying).toBe(false);
        });
    });

    describe('Clock Sync Inputs', () => {
        it('should update inputs list', () => {
            const inputs = [
                { id: 'in-1', name: 'DAW Clock' },
                { id: 'in-2', name: 'Hardware Sequencer' }
            ];
            updateMIDIInputs(inputs);

            expect(midiState.inputs).toHaveLength(2);
            expect(midiState.inputs[0]).toEqual(inputs[0]);
            expect(midiState.inputs[1]).toEqual(inputs[1]);
        });
    });

    describe('Clock Sync Initialization', () => {
        it('should initialize clock settings', () => {
            initMIDIClockSettings({
                enabled: true,
                selectedInputId: 'saved-clock-input'
            });

            expect(midiState.clockSync.enabled).toBe(true);
            expect(midiState.clockSync.selectedInputId).toBe('saved-clock-input');
        });

        it('should reset to default clock settings', () => {
            setClockSyncEnabled(true);
            setClockInputDevice('some-device');
            setClockReceivingState(true);
            setDetectedBpm(120);

            initMIDIClockSettings({ ...DEFAULT_MIDI_CLOCK_SETTINGS });

            expect(midiState.clockSync.enabled).toBe(false);
            expect(midiState.clockSync.selectedInputId).toBeNull();
            // Note: init doesn't reset runtime state like isReceivingClock
        });
    });
});

