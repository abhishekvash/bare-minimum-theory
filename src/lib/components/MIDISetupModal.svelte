<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Separator } from '$lib/components/ui/separator';
	import MIDIPlatformInstructions from '$lib/components/midi/MIDIPlatformInstructions.svelte';
	import MIDIDeviceSelector from '$lib/components/midi/MIDIDeviceSelector.svelte';
	import MIDITestConnection from '$lib/components/midi/MIDITestConnection.svelte';
	import { midiState, setMIDIDevice, setMIDIConnectionState } from '$lib/stores/midi.svelte';
	import { openSettings } from '$lib/stores/ui.svelte';
	import { playChord } from '$lib/utils/midi-output';
	import {
		connectMIDIOutput,
		markMIDISetupSeen,
		refreshMIDIDevices
	} from '$lib/utils/midi-connection';
	import { getChordNotes } from '$lib/utils/theory-engine/chord-operations';
	import type { Chord } from '$lib/utils/theory-engine';

	let { open = $bindable(false) }: { open?: boolean } = $props();

	let testStatus: 'idle' | 'sending' | 'success' | 'error' = $state('idle');
	let setupOpen = $state(false);

	function handleRefresh() {
		// Inputs too, for clock sync
		refreshMIDIDevices({ inputs: true });
	}

	function handleDeviceChange(deviceId: string | undefined) {
		if (!deviceId) {
			setMIDIDevice(null);
			setMIDIConnectionState(false);
		} else {
			setMIDIDevice(deviceId);
			connectMIDIOutput(deviceId);
		}
		markMIDISetupSeen();
	}

	async function handleTestConnection() {
		if (!midiState.isConnected) {
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
			octave: 0,
			duration: '1m'
		};
		const notes = getChordNotes(testChord);
		const { velocity, midiChannel } = midiState;

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

	function handleClose() {
		open = false;
		markMIDISetupSeen();
	}

	function handleOpenMIDISettings() {
		handleClose();
		openSettings('midi');
	}

	// Derived states
	let outputs = $derived(midiState.outputs);
	let selectedDeviceId = $derived(midiState.selectedDeviceId);
	let isConnectedState = $derived(midiState.isConnected);
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

			<p class="text-muted-foreground">
				Channel, velocity, strum and DAW clock sync live in
				<button
					type="button"
					class="font-medium text-foreground underline underline-offset-4 hover:text-primary"
					onclick={handleOpenMIDISettings}
				>
					Settings → MIDI
				</button>.
			</p>
		</div>

		<Dialog.Footer>
			<Button onclick={handleClose}>Done</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
