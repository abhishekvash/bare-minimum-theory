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

	// Clock sync derived states - access store directly to ensure reactivity
	let clockSyncEnabled = $derived(progressionState.midiOutput.clockSync.enabled);
	let clockSyncReceiving = $derived(progressionState.midiOutput.clockSync.isReceivingClock);
	let clockSyncBpm = $derived(progressionState.midiOutput.clockSync.detectedBpm);

	let showBpmIndicator = $derived(clockSyncEnabled && clockSyncBpm !== null);

	// When sync is enabled and receiving clock, DAW has full transport control
	let isExternalControl = $derived(clockSyncEnabled && clockSyncReceiving);

	// Derived disabled states for buttons - use $derived.by to ensure proper prop tracking
	let playDisabled = $derived.by(() => !hasChords || isPlaying || isExternalControl);
	let stopDisabled = $derived.by(() => !isPlaying || isExternalControl);
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
				{#if clockSyncReceiving}
					<span class="relative flex size-2">
						<span
							class="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"
						></span>
						<span class="relative inline-flex size-2 rounded-full bg-green-500"></span>
					</span>
				{:else}
					<span class="size-2 rounded-full bg-yellow-500"></span>
				{/if}
				<span class="font-medium">{clockSyncBpm} BPM</span>
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
			disabled={playDisabled}
			size="icon"
			title={isExternalControl ? 'Controlled by DAW' : 'Play'}
		>
			<Play class="size-4" />
		</Button>
		<Button
			onclick={onStop}
			disabled={stopDisabled}
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
