<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Separator } from '$lib/components/ui/separator';
	import MIDIPlatformInstructions from '$lib/components/midi/MIDIPlatformInstructions.svelte';
	import MIDIDeviceSelector from '$lib/components/midi/MIDIDeviceSelector.svelte';
	import MIDITestConnection from '$lib/components/midi/MIDITestConnection.svelte';
	import MIDIAdvancedSettings from '$lib/components/midi/MIDIAdvancedSettings.svelte';
	import {
		progressionState,
		setMIDIDevice,
		setMIDIConnectionState,
		updateMIDIOutputs,
		setMIDIHasSeenSetupModal,
		setMIDIChannel,
		setMIDIVelocity,
		setMIDIStrumEnabled
	} from '$lib/stores/progression.svelte';
	import { getMIDIOutputs, selectMIDIOutput, isConnected, playChord } from '$lib/utils/midi-output';
	import { saveMIDISettings } from '$lib/utils/midi-settings-persistence';
	import { getChordNotes } from '$lib/utils/theory-engine/chord-operations';
	import type { Chord } from '$lib/utils/theory-engine';

	let { open = $bindable(false) }: { open?: boolean } = $props();

	let testStatus: 'idle' | 'sending' | 'success' | 'error' = $state('idle');
	let advancedOpen = $state(false);
	let setupOpen = $state(false);

	function handleRefresh() {
		const outputs = getMIDIOutputs();
		updateMIDIOutputs(outputs);
	}

	function handleDeviceChange(deviceId: string | undefined) {
		if (!deviceId) {
			setMIDIDevice(null);
			setMIDIConnectionState(false);
		} else {
			setMIDIDevice(deviceId);
			const success = selectMIDIOutput(deviceId);
			setMIDIConnectionState(success && isConnected());
		}
		persistSettings();
	}

	async function handleTestConnection() {
		if (!progressionState.midiOutput.isConnected) {
			testStatus = 'error';
			return;
		}

		testStatus = 'sending';

		// Play a C major chord
		const testChord: Chord = {
			root: 60, // C4
			quality: '',
			inversion: 0,
			voicing: 'close',
			octave: 0
		};
		const notes = getChordNotes(testChord);
		const { velocity, midiChannel } = progressionState.midiOutput;

		try {
			playChord(notes, 1000, velocity, midiChannel - 1);
			testStatus = 'success';
			setTimeout(() => {
				testStatus = 'idle';
			}, 2000);
		} catch (err) {
			console.error('Failed to send MIDI test chord:', err);
			testStatus = 'error';
			setTimeout(() => {
				testStatus = 'idle';
			}, 2000);
		}
	}

	function handleChannelChange(value: string | undefined) {
		if (value) {
			const channel = parseInt(value, 10);
			setMIDIChannel(channel);
			persistSettings();
		}
	}

	function handleVelocityChange(e: Event) {
		const target = e.target as HTMLInputElement;
		const velocity = parseInt(target.value, 10);
		setMIDIVelocity(velocity);
		persistSettings();
	}

	function handleStrumChange(e: Event) {
		const target = e.target as HTMLInputElement;
		setMIDIStrumEnabled(target.checked);
		persistSettings();
	}

	function persistSettings() {
		const { enabled, selectedDeviceId, midiChannel, velocity, strumEnabled } =
			progressionState.midiOutput;
		saveMIDISettings({
			enabled,
			selectedDeviceId,
			midiChannel,
			velocity,
			strumEnabled,
			hasSeenSetupModal: true
		});
		setMIDIHasSeenSetupModal(true);
	}

	function handleClose() {
		open = false;
		persistSettings();
	}

	// Derived states
	let outputs = $derived(progressionState.midiOutput.outputs);
	let selectedDeviceId = $derived(progressionState.midiOutput.selectedDeviceId);
	let isConnectedState = $derived(progressionState.midiOutput.isConnected);
	let midiChannel = $derived(progressionState.midiOutput.midiChannel);
	let velocity = $derived(progressionState.midiOutput.velocity);
	let strumEnabled = $derived(progressionState.midiOutput.strumEnabled);
</script>

<Dialog.Root bind:open onOpenChange={(isOpen) => !isOpen && handleClose()}>
	<Dialog.Content class="max-w-lg max-h-[85vh] overflow-y-auto">
		<Dialog.Header>
			<Dialog.Title>MIDI Output Setup</Dialog.Title>
			<Dialog.Description>
				Send chords directly to your DAW for preview with your own sounds
			</Dialog.Description>
		</Dialog.Header>

		<div class="space-y-6 text-sm py-4">
			<MIDIPlatformInstructions bind:open={setupOpen} />

			<Separator />

			<MIDIDeviceSelector
				{outputs}
				{selectedDeviceId}
				isConnected={isConnectedState}
				onDeviceChange={handleDeviceChange}
				onRefresh={handleRefresh}
			/>

			{#if selectedDeviceId && isConnectedState}
				<MIDITestConnection
					isConnected={isConnectedState}
					{testStatus}
					onTest={handleTestConnection}
				/>
			{/if}

			<Separator />

			<MIDIAdvancedSettings
				bind:open={advancedOpen}
				{midiChannel}
				{velocity}
				{strumEnabled}
				onChannelChange={handleChannelChange}
				onVelocityChange={handleVelocityChange}
				onStrumChange={handleStrumChange}
			/>
		</div>

		<Dialog.Footer>
			<Button onclick={handleClose}>Done</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
