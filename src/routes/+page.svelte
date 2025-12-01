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
		setMIDISupported,
		updateMIDIOutputs,
		setMIDIConnectionState
	} from '$lib/stores/progression.svelte';
	import { loadRandomizeSettings } from '$lib/utils/settings-persistence';
	import { loadMIDISettings } from '$lib/utils/midi-settings-persistence';
	import {
		isMIDISupported,
		requestMIDIAccess,
		getMIDIOutputs,
		selectMIDIOutput,
		isConnected,
		disposeMIDI
	} from '$lib/utils/midi-output';
	import { disposeAudio } from '$lib/utils/audio-playback';

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

			// If MIDI was enabled, try to restore connection
			if (midiSettings.enabled) {
				const access = await requestMIDIAccess();
				if (access) {
					const outputs = getMIDIOutputs();
					updateMIDIOutputs(outputs);

					// Try to reconnect to saved device
					if (midiSettings.selectedDeviceId) {
						const success = selectMIDIOutput(midiSettings.selectedDeviceId);
						setMIDIConnectionState(success && isConnected());
					}
				}
			}
		}
	});

	function openMIDISetup() {
		midiSetupOpen = true;
	}

	// Cleanup audio and MIDI resources on page unmount
	onDestroy(() => {
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
