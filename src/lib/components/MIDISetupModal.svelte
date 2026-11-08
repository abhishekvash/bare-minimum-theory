<script lang="ts">
	import * as Dialog from '#lib/components/ui/dialog/index.ts';
	import { Button } from '#lib/components/ui/button/index.ts';
	import { Separator } from '#lib/components/ui/separator/index.ts';
	import MIDIPlatformInstructions from '#lib/components/midi/MIDIPlatformInstructions.svelte';
	import MIDIDeviceSelector from '#lib/components/midi/MIDIDeviceSelector.svelte';
	import MIDITestConnection from '#lib/components/midi/MIDITestConnection.svelte';
	import { midiState } from '#lib/stores/midi.svelte.ts';
	import { openSettings } from '#lib/stores/ui.svelte.ts';
	import { playChord } from '#lib/utils/midi-output.ts';
	import {
		markMIDISetupSeen,
		refreshMIDIDevices,
		switchMIDIOutput
	} from '#lib/utils/midi-connection.ts';
	import { getChordNotes } from '#lib/utils/theory-engine/chord-operations.ts';
	import type { Chord } from '#lib/utils/theory-engine/index.ts';
	import { onDestroy } from 'svelte';

	let { open = $bindable(false) }: { open?: boolean } = $props();

	let testStatus: 'idle' | 'sending' | 'success' | 'error' = $state('idle');
	let testResetTimer: ReturnType<typeof setTimeout> | null = null;

	/** Drop any pending test feedback reset and return the test to idle */
	function resetTestStatus() {
		if (testResetTimer !== null) clearTimeout(testResetTimer);
		testResetTimer = null;
		testStatus = 'idle';
	}

	/** Show a test result, cleared after two seconds unless a newer test replaces it */
	function showTestResult(status: 'success' | 'error') {
		resetTestStatus();
		testStatus = status;
		testResetTimer = setTimeout(() => {
			testResetTimer = null;
			testStatus = 'idle';
		}, 2000);
	}

	onDestroy(resetTestStatus);

	function handleRefresh() {
		// Inputs too, for clock sync
		refreshMIDIDevices({ inputs: true });
	}

	function handleDeviceChange(deviceId: string | undefined) {
		resetTestStatus();
		switchMIDIOutput(deviceId ?? null);
		markMIDISetupSeen();
	}

	async function handleTestConnection() {
		resetTestStatus();

		if (!midiState.isConnected) {
			showTestResult('error');
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

		// Send failures are caught inside midi-output and surface through its onMIDIError toast,
		// which also drops the connection and so hides this test
		playChord(notes, 1000, velocity, midiChannel - 1);
		showTestResult('success');
	}

	function handleClose() {
		open = false;
		resetTestStatus();
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
			<MIDIPlatformInstructions />

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
