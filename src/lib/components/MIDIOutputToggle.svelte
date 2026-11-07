<script lang="ts">
	import { Button } from '#lib/components/ui/button/index.ts';
	import { IconButton } from '#lib/components/ui/icon-button/index.ts';
	import * as Tooltip from '#lib/components/ui/tooltip/index.ts';
	import Cable from '@lucide/svelte/icons/cable';
	import Settings from '@lucide/svelte/icons/settings';
	import { midiState, setMIDIEnabled, setMIDIConnectionState } from '#lib/stores/midi.svelte.ts';
	import { isMIDILoopPlaying, onStateChange } from '#lib/utils/midi-output.ts';
	import { stopProgressionPlayback } from '#lib/stores/transport.svelte.ts';
	import { ensureMIDIAccess, reconcileSelectedOutput } from '#lib/utils/midi-connection.ts';
	import { onMount } from 'svelte';

	interface Props {
		onOpenSetup?: () => void;
	}

	let { onOpenSetup }: Props = $props();

	// Follow MIDI device changes while mounted; the returned unsubscribe is the cleanup
	onMount(() => onStateChange(reconcileSelectedOutput));

	async function handleToggle() {
		const newEnabled = !midiState.enabled;

		if (newEnabled) {
			if (!(await ensureMIDIAccess())) return;

			// Refresh the device list and reconnect the saved device if it is present
			reconcileSelectedOutput();

			// If no device selected or saved, and we haven't seen setup, open setup modal
			if (!midiState.selectedDeviceId || !midiState.hasSeenSetupModal) {
				setMIDIEnabled(true);
				onOpenSetup?.();
				return;
			}
		} else {
			// Disabling MIDI. A loop playing through MIDI would keep sending to the port, so it stops
			// too; a loop playing through the internal synth is left alone.
			if (isMIDILoopPlaying()) stopProgressionPlayback();
			setMIDIConnectionState(false);
		}

		setMIDIEnabled(newEnabled);
	}

	// Derived states
	let isEnabled = $derived(midiState.enabled);
	let isConnectedState = $derived(midiState.isConnected);
	let isSupported = $derived(midiState.isSupported);

	let tooltipText = $derived.by(() => {
		if (!isSupported) return 'MIDI not supported in this browser';
		if (!isEnabled) return 'Enable MIDI output to DAW';
		if (!isConnectedState) return 'MIDI enabled but not connected';
		return 'MIDI output active - sending to DAW';
	});

	let midiVisualState = $derived.by(() => {
		if (!isEnabled) return 'off' as const;
		return isConnectedState ? ('connected' as const) : ('disconnected' as const);
	});

	let stateClass = $derived.by(() => {
		if (!isEnabled) return 'text-muted-foreground hover:text-foreground';
		if (isConnectedState) {
			return 'text-foreground ring-1 ring-green-500/40 hover:bg-accent/30';
		}
		return 'text-foreground ring-1 ring-yellow-500/40 hover:bg-accent/30';
	});
</script>

{#if isSupported}
	<div class="flex items-center gap-1">
		<Tooltip.Root>
			<Tooltip.Trigger>
				{#snippet child({ props })}
					<Button
						{...props}
						onclick={handleToggle}
						variant="ghost"
						size="icon"
						class="relative {stateClass}"
						aria-label={tooltipText}
						aria-pressed={isEnabled}
						data-midi-state={midiVisualState}
						data-visual-weight="utility"
					>
						<Cable class="size-4" />
						{#if isEnabled && isConnectedState}
							<span
								class="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-green-500 ring-2 ring-background"
								data-midi-indicator="connected"
								aria-hidden="true"
							></span>
						{:else if isEnabled && !isConnectedState}
							<span
								class="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-yellow-500 ring-2 ring-background"
								data-midi-indicator="disconnected"
								aria-hidden="true"
							></span>
						{/if}
					</Button>
				{/snippet}
			</Tooltip.Trigger>
			<Tooltip.Content>
				{tooltipText}
			</Tooltip.Content>
		</Tooltip.Root>
		{#if isEnabled}
			<IconButton
				tooltip="MIDI Settings"
				onclick={() => onOpenSetup?.()}
				variant="ghost"
				size="icon"
				class="size-7"
			>
				<Settings class="size-3.5" />
			</IconButton>
		{/if}
	</div>
{/if}
