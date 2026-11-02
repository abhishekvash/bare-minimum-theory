<script lang="ts">
	/**
	 * MIDI preferences in Settings: output channel, velocity, strum, and DAW clock sync.
	 * Device choice and the connection test stay in the MIDI Setup modal, reached from the MIDI
	 * button, because they are part of getting connected rather than a standing preference.
	 */
	import MIDIOutputPreferences from '$lib/components/midi/MIDIOutputPreferences.svelte';
	import MIDIClockSync from '$lib/components/midi/MIDIClockSync.svelte';
	import {
		midiState,
		setMIDIChannel,
		setMIDIVelocity,
		setMIDIStrumEnabled,
		setClockSyncEnabled,
		setClockInputDevice,
		updateMIDIInputs
	} from '$lib/stores/midi.svelte';
	import { getMIDIAccess, getMIDIInputs } from '$lib/utils/midi-output';
	import { saveMIDISettings } from '$lib/utils/midi-settings-persistence';
	import { saveMIDIClockSettings } from '$lib/utils/midi-clock-persistence';
	import { initMIDIClock, selectMIDIInput } from '$lib/utils/midi-clock';
	import { setupClockListener, teardownClockListener } from '$lib/utils/midi-clock-listener';

	/** Persist output preferences without touching the first-run setup flag */
	function persistOutputSettings(): void {
		const { enabled, selectedDeviceId, midiChannel, velocity, strumEnabled, hasSeenSetupModal } =
			midiState;
		saveMIDISettings({
			enabled,
			selectedDeviceId,
			midiChannel,
			velocity,
			strumEnabled,
			hasSeenSetupModal
		});
	}

	function persistClockSettings(): void {
		const { enabled, selectedInputId } = midiState.clockSync;
		saveMIDIClockSettings({ enabled, selectedInputId });
	}

	function handleChannelChange(value: string | undefined): void {
		if (!value) return;
		setMIDIChannel(parseInt(value, 10));
		persistOutputSettings();
	}

	function handleVelocityChange(event: Event): void {
		setMIDIVelocity(parseInt((event.target as HTMLInputElement).value, 10));
		persistOutputSettings();
	}

	function handleStrumChange(event: Event): void {
		setMIDIStrumEnabled((event.target as HTMLInputElement).checked);
		persistOutputSettings();
	}

	function handleRefreshInputs(): void {
		updateMIDIInputs(getMIDIInputs());
	}

	function startClockListening(inputId: string): void {
		const access = getMIDIAccess();
		if (access) initMIDIClock(access);
		selectMIDIInput(inputId);
		setupClockListener();
	}

	function handleClockToggle(enabled: boolean): void {
		setClockSyncEnabled(enabled);

		if (enabled) {
			const { selectedInputId } = midiState.clockSync;
			if (selectedInputId) {
				startClockListening(selectedInputId);
			} else {
				const access = getMIDIAccess();
				if (access) initMIDIClock(access);
			}
		} else {
			teardownClockListener();
		}

		persistClockSettings();
	}

	function handleClockInputChange(inputId: string | undefined): void {
		const wasListening = midiState.clockSync.enabled;
		if (wasListening) teardownClockListener();

		setClockInputDevice(inputId ?? null);
		if (wasListening && inputId) startClockListening(inputId);

		persistClockSettings();
	}
</script>

{#if midiState.isSupported}
	<div class="space-y-6">
		<MIDIOutputPreferences
			midiChannel={midiState.midiChannel}
			velocity={midiState.velocity}
			strumEnabled={midiState.strumEnabled}
			onChannelChange={handleChannelChange}
			onVelocityChange={handleVelocityChange}
			onStrumChange={handleStrumChange}
		/>

		<MIDIClockSync
			inputs={midiState.inputs}
			selectedInputId={midiState.clockSync.selectedInputId}
			isEnabled={midiState.clockSync.enabled}
			isReceivingClock={midiState.clockSync.isReceivingClock}
			detectedBpm={midiState.clockSync.detectedBpm}
			onToggle={handleClockToggle}
			onInputChange={handleClockInputChange}
			onRefresh={handleRefreshInputs}
		/>
	</div>
{:else}
	<p class="text-sm text-muted-foreground">
		This browser doesn't support Web MIDI. Try Chrome or Edge to send chords to your DAW.
	</p>
{/if}
