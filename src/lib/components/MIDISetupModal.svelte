<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import * as Select from '$lib/components/ui/select';
	import { Separator } from '$lib/components/ui/separator';
	import RefreshCw from 'lucide-svelte/icons/refresh-cw';
	import CheckCircle from 'lucide-svelte/icons/check-circle';
	import AlertCircle from 'lucide-svelte/icons/alert-circle';
	import ChevronDown from 'lucide-svelte/icons/chevron-down';
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

	// Detect platform
	let platform = $derived.by(() => {
		if (typeof navigator === 'undefined') return 'unknown';
		const ua = navigator.userAgent.toLowerCase();
		if (ua.includes('mac')) return 'macos';
		if (ua.includes('win')) return 'windows';
		if (ua.includes('linux')) return 'linux';
		return 'unknown';
	});

	let platformInstructions = $derived.by(() => {
		switch (platform) {
			case 'macos':
				return {
					title: 'macOS Setup (IAC Driver)',
					steps: [
						'Open "Audio MIDI Setup" (search in Spotlight)',
						'Go to Window → Show MIDI Studio',
						'Double-click "IAC Driver"',
						'Check "Device is online"',
						'Click Apply, then close',
						'In your DAW, select IAC Driver as MIDI input'
					]
				};
			case 'windows':
				return {
					title: 'Windows Setup (loopMIDI)',
					steps: [
						'Download loopMIDI from tobias-erichsen.de/software/loopmidi.html',
						'Install and run loopMIDI',
						'Click the "+" button to create a virtual MIDI port',
						'Name it something like "BMT to DAW"',
						'In your DAW, select the loopMIDI port as MIDI input'
					]
				};
			case 'linux':
				return {
					title: 'Linux Setup',
					steps: [
						'Install a virtual MIDI loopback driver',
						'Create a virtual MIDI port using ALSA or JACK',
						'Connect the virtual port to your DAW'
					]
				};
			default:
				return {
					title: 'Setup Required',
					steps: ['You need a virtual MIDI port to route audio to your DAW']
				};
		}
	});

	async function handleRefresh() {
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
			<!-- Platform-specific setup instructions -->
			<details bind:open={setupOpen} class="group">
				<summary class="flex items-center gap-2 cursor-pointer list-none">
					<ChevronDown class="size-4 transition-transform group-open:rotate-180" />
					<span class="font-medium">{platformInstructions.title}</span>
				</summary>
				<ol class="mt-3 ml-6 space-y-1.5 list-decimal list-outside text-muted-foreground">
					{#each platformInstructions.steps as step, i (i)}
						<li>{step}</li>
					{/each}
				</ol>
			</details>

			<Separator />

			<!-- Device Selection -->
			<div class="space-y-3">
				<div class="flex items-center justify-between">
					<h3 class="font-medium">MIDI Device</h3>
					<Button variant="ghost" size="sm" onclick={handleRefresh} class="gap-1.5">
						<RefreshCw class="size-3.5" />
						Refresh
					</Button>
				</div>

				{#if outputs.length === 0}
					<div class="rounded-md border border-dashed p-4 text-center">
						<AlertCircle class="size-8 mx-auto mb-2 text-muted-foreground" />
						<p class="text-muted-foreground mb-2">No MIDI devices found</p>
						<p class="text-xs text-muted-foreground">
							Follow the setup instructions above, then click Refresh
						</p>
					</div>
				{:else}
					<Select.Root
						type="single"
						value={selectedDeviceId ?? undefined}
						onValueChange={handleDeviceChange}
					>
						<Select.Trigger class="w-full">
							{#if selectedDeviceId}
								{outputs.find((o) => o.id === selectedDeviceId)?.name || 'Select device'}
							{:else}
								Select a MIDI device
							{/if}
						</Select.Trigger>
						<Select.Content>
							{#each outputs as output (output.id)}
								<Select.Item value={output.id} label={output.name}>{output.name}</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>

					{#if selectedDeviceId}
						<div class="flex items-center gap-2 text-sm">
							{#if isConnectedState}
								<CheckCircle class="size-4 text-green-500" />
								<span class="text-green-600">Connected</span>
							{:else}
								<AlertCircle class="size-4 text-yellow-500" />
								<span class="text-yellow-600">Not connected</span>
							{/if}
						</div>
					{/if}
				{/if}
			</div>

			<!-- Test Connection -->
			{#if selectedDeviceId && isConnectedState}
				<div class="space-y-3">
					<h3 class="font-medium">Test Connection</h3>
					<div class="flex items-center gap-3">
						<Button
							variant="outline"
							onclick={handleTestConnection}
							disabled={testStatus === 'sending'}
						>
							{#if testStatus === 'sending'}
								Sending...
							{:else if testStatus === 'success'}
								Sent!
							{:else}
								Send Test Chord
							{/if}
						</Button>
						{#if testStatus === 'success'}
							<span class="text-green-600 text-sm">Check your DAW for a C major chord</span>
						{:else if testStatus === 'error'}
							<span class="text-red-600 text-sm">Failed to send</span>
						{/if}
					</div>
				</div>
			{/if}

			<Separator />

			<!-- Advanced Settings -->
			<details bind:open={advancedOpen} class="group">
				<summary class="flex items-center gap-2 cursor-pointer list-none">
					<ChevronDown class="size-4 transition-transform group-open:rotate-180" />
					<span class="font-medium">Advanced Settings</span>
				</summary>
				<div class="mt-4 space-y-4">
					<!-- MIDI Channel -->
					<div class="space-y-2">
						<label for="midi-channel" class="text-sm font-medium">MIDI Channel</label>
						<Select.Root
							type="single"
							value={midiChannel.toString()}
							onValueChange={handleChannelChange}
						>
							<Select.Trigger class="w-32">
								Channel {midiChannel}
							</Select.Trigger>
							<Select.Content>
								{#each Array.from({ length: 16 }, (_, i) => i + 1) as ch (ch)}
									<Select.Item value={ch.toString()} label={`Channel ${ch}`}
										>Channel {ch}</Select.Item
									>
								{/each}
							</Select.Content>
						</Select.Root>
					</div>

					<!-- Velocity -->
					<div class="space-y-2">
						<label for="velocity" class="text-sm font-medium">
							Velocity: {velocity}
						</label>
						<input
							id="velocity"
							type="range"
							min="0"
							max="127"
							value={velocity}
							oninput={handleVelocityChange}
							class="w-full"
						/>
						<div class="flex justify-between text-xs text-muted-foreground">
							<span>Soft</span>
							<span>Loud</span>
						</div>
					</div>

					<!-- Strum -->
					<div class="flex items-center justify-between">
						<div>
							<label for="strum" class="text-sm font-medium">Strum chords</label>
							<p class="text-xs text-muted-foreground">
								Add slight delay between notes for a strummed effect
							</p>
						</div>
						<input
							id="strum"
							type="checkbox"
							checked={strumEnabled}
							onchange={handleStrumChange}
							class="h-4 w-4 rounded border-gray-300"
						/>
					</div>
				</div>
			</details>
		</div>

		<Dialog.Footer>
			<Button onclick={handleClose}>Done</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
