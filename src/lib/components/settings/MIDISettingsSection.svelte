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
	import { saveMIDIClockSettings } from '$lib/utils/midi-clock-persistence';
	import { initMIDIClock } from '$lib/utils/midi-clock';
	import { teardownClockListener } from '$lib/utils/midi-clock-listener';
	import {
		ensureMIDIAccess,
		persistMIDISettings,
		refreshMIDIDevices,
		startClockSync
	} from '$lib/utils/midi-connection';
	import { toast } from 'svelte-sonner';

	function persistClockSettings(): void {
		const { enabled, selectedInputId } = midiState.clockSync;
		saveMIDIClockSettings({ enabled, selectedInputId });
	}

	function handleChannelChange(value: string | undefined): void {
		if (!value) return;
		setMIDIChannel(parseInt(value, 10));
		persistMIDISettings();
	}

	function handleVelocityChange(event: Event): void {
		setMIDIVelocity(parseInt((event.target as HTMLInputElement).value, 10));
		persistMIDISettings();
	}

	function handleStrumChange(event: Event): void {
		setMIDIStrumEnabled((event.target as HTMLInputElement).checked);
		persistMIDISettings();
	}

	function handleRefreshInputs(): void {
		updateMIDIInputs(getMIDIInputs());
	}

	async function handleClockToggle(enabled: boolean): Promise<void> {
		if (enabled) {
			// Clock sync needs MIDI access of its own: output may never have been turned on
			if (!(await ensureMIDIAccess())) {
				toast.error('MIDI access denied', {
					description: 'Allow MIDI access in your browser to sync to your DAW'
				});
				return;
			}
			refreshMIDIDevices({ inputs: true });
		}

		setClockSyncEnabled(enabled);

		if (enabled) {
			const { selectedInputId } = midiState.clockSync;
			if (selectedInputId) {
				startClockSync(selectedInputId);
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
		if (wasListening && inputId) startClockSync(inputId);

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
