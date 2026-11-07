<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import MIDIOutputToggle from './MIDIOutputToggle.svelte';
	import Play from '@lucide/svelte/icons/play';
	import Stop from '@lucide/svelte/icons/square';
	import Download from '@lucide/svelte/icons/download';
	import Piano from '@lucide/svelte/icons/piano';
	import Save from '@lucide/svelte/icons/save';
	import { midiState } from '$lib/stores/midi.svelte';

	interface Props {
		isPlaying: boolean;
		hasChords: boolean;
		canSave: boolean;
		onPlay: () => void;
		onStop: () => void;
		onExport: () => void;
		onSave?: () => void;
		onOpenMIDISetup?: () => void;
		onTogglePiano?: () => void;
		isPianoVisible?: boolean;
	}

	let {
		isPlaying,
		hasChords,
		canSave,
		onPlay,
		onStop,
		onExport,
		onSave,
		onOpenMIDISetup,
		onTogglePiano,
		isPianoVisible = false
	}: Props = $props();

	// Clock sync derived states: access the store directly to keep updates reactive.
	let clockSyncEnabled = $derived(midiState.clockSync.enabled);
	let clockSyncReceiving = $derived(midiState.clockSync.isReceivingClock);
	let clockSyncBpm = $derived(midiState.clockSync.detectedBpm);

	let showBpmIndicator = $derived(clockSyncEnabled && clockSyncBpm !== null);

	// When sync is enabled and receiving clock, the DAW has full transport control.
	let isExternalControl = $derived(clockSyncEnabled && clockSyncReceiving);

	let primaryActionDisabled = $derived.by(() =>
		isPlaying ? isExternalControl : !hasChords || isExternalControl
	);
	let primaryActionTooltip = $derived(
		isExternalControl ? 'Controlled by DAW' : isPlaying ? 'Stop' : 'Play'
	);
</script>

<div class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
	<div class="min-w-0">
		<h2 class="mb-1 text-base font-semibold tracking-tight">Progression</h2>
		<p class="text-xs text-muted-foreground">Arrange, shape, and play your progression.</p>
	</div>

	<div class="flex flex-wrap items-center gap-x-3 gap-y-2" data-tour="transport">
		<Tooltip.Root>
			<Tooltip.Trigger>
				{#snippet child({ props })}
					<Button
						{...props}
						size="lg"
						onclick={isPlaying ? onStop : onPlay}
						disabled={primaryActionDisabled}
						aria-label={primaryActionTooltip}
						data-action={isPlaying ? 'stop' : 'play'}
						data-visual-weight="primary"
						class="min-w-28 gap-2 px-6 font-semibold shadow-sm"
					>
						{#if isPlaying}
							<Stop class="size-4 fill-current" />
							<span>Stop</span>
						{:else}
							<Play class="size-4 fill-current" />
							<span>Play</span>
						{/if}
					</Button>
				{/snippet}
			</Tooltip.Trigger>
			<Tooltip.Content>{primaryActionTooltip}</Tooltip.Content>
		</Tooltip.Root>

		<div class="flex items-center gap-1" role="group" aria-label="Progression actions">
			<Button
				variant="ghost"
				size="sm"
				onclick={onSave}
				disabled={!canSave}
				class="gap-1.5 text-muted-foreground hover:text-foreground"
				data-action="save"
				data-visual-weight="secondary"
			>
				<Save class="size-3.5" />
				<span>Save</span>
			</Button>
			<Button
				variant="ghost"
				size="sm"
				onclick={onExport}
				disabled={!hasChords}
				class="gap-1.5 text-muted-foreground hover:text-foreground"
				data-action="export"
				data-visual-weight="secondary"
			>
				<Download class="size-3.5" />
				<span>Export MIDI</span>
			</Button>
		</div>

		<div
			class="flex items-center gap-1 border-l border-border/40 pl-3 text-muted-foreground"
			role="group"
			aria-label="Playback utilities"
			data-visual-weight="utility"
		>
			<MIDIOutputToggle onOpenSetup={onOpenMIDISetup} />
			<Tooltip.Root>
				<Tooltip.Trigger>
					{#snippet child({ props })}
						<Button
							{...props}
							variant="ghost"
							size="icon-sm"
							onclick={onTogglePiano}
							class={isPianoVisible
								? 'text-foreground ring-1 ring-primary/35 hover:bg-accent/30'
								: 'text-muted-foreground hover:text-foreground'}
							aria-label={isPianoVisible ? 'Hide keyboard' : 'Show keyboard'}
							aria-pressed={isPianoVisible}
							data-piano-state={isPianoVisible ? 'visible' : 'hidden'}
							data-visual-weight="utility"
						>
							<Piano class="size-4" />
						</Button>
					{/snippet}
				</Tooltip.Trigger>
				<Tooltip.Content>{isPianoVisible ? 'Hide keyboard' : 'Show keyboard'}</Tooltip.Content>
			</Tooltip.Root>

			{#if showBpmIndicator}
				<div
					class="flex h-8 items-center gap-1.5 rounded-md px-2 text-xs tabular-nums"
					aria-label={clockSyncReceiving
						? `MIDI clock receiving at ${clockSyncBpm} BPM`
						: `MIDI clock waiting at ${clockSyncBpm} BPM`}
					data-clock-status={clockSyncReceiving ? 'receiving' : 'waiting'}
				>
					{#if clockSyncReceiving}
						<span class="relative flex size-2" aria-hidden="true">
							<span
								class="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"
							></span>
							<span class="relative inline-flex size-2 rounded-full bg-green-500"></span>
						</span>
					{:else}
						<span class="size-2 rounded-full bg-yellow-500" aria-hidden="true"></span>
					{/if}
					<span class="font-medium">{clockSyncBpm} BPM</span>
				</div>
			{/if}
		</div>
	</div>
</div>
