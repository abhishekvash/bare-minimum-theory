<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import ChordBuilder from '$lib/components/ChordBuilder.svelte';
	import ChordProgression from '$lib/components/ChordProgression.svelte';
	import ChordPalette from '$lib/components/ChordPalette.svelte';
	import HelpModal from '$lib/components/HelpModal.svelte';
	import MIDISetupModal from '$lib/components/MIDISetupModal.svelte';
	import { Button } from '$lib/components/ui/button';
	import { CircleHelp } from 'lucide-svelte';
	import {
		initRandomizeOptions,
		initMIDISettings,
		initMIDIClockSettings,
		setMIDISupported,
		updateMIDIOutputs,
		updateMIDIInputs,
		setMIDIConnectionState,
		setClockReceivingState,
		setDetectedBpm,
		setExternalPlayingState
	} from '$lib/stores/progression.svelte';
	import { loadRandomizeSettings } from '$lib/utils/settings-persistence';
	import { loadMIDISettings } from '$lib/utils/midi-settings-persistence';
	import { loadMIDIClockSettings } from '$lib/utils/midi-clock-persistence';
	import {
		isMIDISupported,
		requestMIDIAccess,
		getMIDIOutputs,
		getMIDIInputs,
		selectMIDIOutput,
		isConnected,
		disposeMIDI
	} from '$lib/utils/midi-output';
	import { disposeAudio, updatePlaybackTempo } from '$lib/utils/audio-playback';
	import {
		initMIDIClock,
		selectMIDIInput,
		startClockListener,
		stopClockListener,
		disposeMIDIClock
	} from '$lib/utils/midi-clock';

	let helpModalOpen = $state(false);
	let midiSetupOpen = $state(false);

	onMount(async () => {
		// Load randomize settings from localStorage
		const savedSettings = loadRandomizeSettings();
		initRandomizeOptions(savedSettings);

		// Initialize MIDI support detection and settings
		const midiSupported = isMIDISupported();
		setMIDISupported(midiSupported);

		if (midiSupported) {
			// Load saved MIDI settings
			const midiSettings = loadMIDISettings();
			initMIDISettings(midiSettings);

			// Load clock sync settings
			const clockSettings = loadMIDIClockSettings();
			initMIDIClockSettings(clockSettings);

			// If MIDI was enabled, try to restore connection
			if (midiSettings.enabled) {
				const access = await requestMIDIAccess();
				if (access) {
					const outputs = getMIDIOutputs();
					updateMIDIOutputs(outputs);

					// Also get inputs for clock sync
					const inputs = getMIDIInputs();
					updateMIDIInputs(inputs);

					// Try to reconnect to saved output device
					if (midiSettings.selectedDeviceId) {
						const success = selectMIDIOutput(midiSettings.selectedDeviceId);
						setMIDIConnectionState(success && isConnected());
					}

					// If clock sync was enabled, try to restore it
					if (clockSettings.enabled && clockSettings.selectedInputId) {
						initMIDIClock(access);
						const inputSelected = selectMIDIInput(clockSettings.selectedInputId);
						if (inputSelected) {
							startClockListener(
								(bpm) => {
									setDetectedBpm(bpm);
									updatePlaybackTempo(bpm);
								},
								(isReceiving) => {
									setClockReceivingState(isReceiving);
									if (!isReceiving) setExternalPlayingState(false);
								},
								(command) => setExternalPlayingState(command === 'start')
							);
						}
					}
				}
			}
		}
	});

	function openMIDISetup() {
		midiSetupOpen = true;
	}

	// Cleanup audio, MIDI, and clock sync resources on page unmount
	onDestroy(() => {
		stopClockListener();
		disposeMIDIClock();
		disposeAudio();
		disposeMIDI();
	});
</script>

<div class="flex flex-col h-screen bg-background">
	<header class="shrink-0 border-b bg-background z-10">
		<div class="container mx-auto px-4 sm:px-8 py-4 flex items-center justify-between max-w-7xl">
			<div>
				<h1 class="text-xl sm:text-2xl font-bold tracking-tight">Bare Minimum Theory</h1>
				<p class="text-xs sm:text-sm text-muted-foreground">Build chord progressions, your way.</p>
			</div>
			<Button variant="outline" onclick={() => (helpModalOpen = true)} class="gap-2">
				<CircleHelp class="size-4" />
				Help
			</Button>
		</div>
	</header>

	<div class="flex-1 overflow-y-auto min-h-0">
		<div class="container mx-auto px-4 sm:px-8 py-6 max-w-7xl">
			<div class="flex flex-col lg:flex-row gap-8 lg:gap-12">
				<div class="flex-1 space-y-8">
					<ChordBuilder />
					<ChordProgression onOpenMIDISetup={openMIDISetup} />
				</div>

				<div class="w-full lg:w-80 shrink-0 lg:border-l lg:pl-12">
					<ChordPalette />
				</div>
			</div>
		</div>
	</div>
</div>

<HelpModal bind:open={helpModalOpen} />
<MIDISetupModal bind:open={midiSetupOpen} />
