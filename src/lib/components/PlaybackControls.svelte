<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import MIDIOutputToggle from './MIDIOutputToggle.svelte';
	import Play from 'lucide-svelte/icons/play';
	import Stop from 'lucide-svelte/icons/square';
	import Download from 'lucide-svelte/icons/download';
	import Piano from 'lucide-svelte/icons/piano';
	import { progressionState } from '$lib/stores/progression.svelte';

	interface Props {
		isPlaying: boolean;
		hasChords: boolean;
		onPlay: () => void;
		onStop: () => void;
		onExport: () => void;
		onOpenMIDISetup?: () => void;
		onTogglePiano?: () => void;
		isPianoVisible?: boolean;
	}

	let {
		isPlaying,
		hasChords,
		onPlay,
		onStop,
		onExport,
		onOpenMIDISetup,
		onTogglePiano,
		isPianoVisible = false
	}: Props = $props();

	// Clock sync derived states
	let clockSync = $derived(progressionState.midiOutput.clockSync);
	let showBpmIndicator = $derived(clockSync.enabled && clockSync.detectedBpm !== null);

	// When sync is enabled and receiving clock, DAW has full transport control
	let isExternalControl = $derived(clockSync.enabled && clockSync.isReceivingClock);
</script>

<div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
	<div>
		<h2 class="text-base font-semibold tracking-tight mb-1">Progression</h2>
		<p class="text-xs text-muted-foreground">
			Drag chords to slots • Tweak each block • Play and export
		</p>
	</div>
	<div class="flex flex-wrap gap-2 items-center">
		{#if showBpmIndicator}
			<div
				class="flex items-center gap-1.5 text-sm text-muted-foreground px-2 py-1 rounded-md bg-muted/50"
			>
				{#if clockSync.isReceivingClock}
					<span class="relative flex size-2">
						<span
							class="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"
						></span>
						<span class="relative inline-flex size-2 rounded-full bg-green-500"></span>
					</span>
				{:else}
					<span class="size-2 rounded-full bg-yellow-500"></span>
				{/if}
				<span class="font-medium">{clockSync.detectedBpm} BPM</span>
			</div>
		{/if}
		<MIDIOutputToggle onOpenSetup={onOpenMIDISetup} />
		<Button
			onclick={onTogglePiano}
			variant={isPianoVisible ? 'default' : 'outline'}
			size="icon"
			title={isPianoVisible ? 'Hide keyboard' : 'Show keyboard'}
		>
			<Piano class="size-4" />
		</Button>
		<Button
			onclick={onPlay}
			disabled={!hasChords || isPlaying || isExternalControl}
			size="icon"
			title={isExternalControl ? 'Controlled by DAW' : 'Play'}
		>
			<Play class="size-4" />
		</Button>
		<Button
			onclick={onStop}
			disabled={!isPlaying || isExternalControl}
			size="icon"
			variant="outline"
			title={isExternalControl ? 'Controlled by DAW' : 'Stop'}
		>
			<Stop class="size-4" />
		</Button>
		<Button variant="outline" onclick={onExport} disabled={!hasChords} class="gap-2">
			<Download class="size-4" />
			<span>Export MIDI</span>
		</Button>
	</div>
</div>
