<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { IconButton } from '$lib/components/ui/icon-button';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import Cable from 'lucide-svelte/icons/cable';
	import Settings from 'lucide-svelte/icons/settings';
	import {
		midiState,
		setMIDIEnabled,
		setMIDIConnectionState,
		updateMIDIOutputs,
		setMIDIDevice,
		setMIDIPermissionGranted,
		setMIDIError
	} from '$lib/stores/midi.svelte';
	import {
		requestMIDIAccess,
		getMIDIOutputs,
		selectMIDIOutput,
		isConnected,
		onStateChange
	} from '$lib/utils/midi-output';
	import { saveMIDISettings } from '$lib/utils/midi-settings-persistence';
	import { onMount, onDestroy } from 'svelte';

	interface Props {
		onOpenSetup?: () => void;
	}

	let { onOpenSetup }: Props = $props();

	let unsubscribeStateChange: (() => void) | null = null;

	onMount(() => {
		// Listen for MIDI device changes
		unsubscribeStateChange = onStateChange(() => {
			refreshDevices();
		});
	});

	onDestroy(() => {
		unsubscribeStateChange?.();
	});

	async function refreshDevices() {
		const outputs = getMIDIOutputs();
		updateMIDIOutputs(outputs);

		// Check if selected device is still available
		if (midiState.selectedDeviceId) {
			const stillExists = outputs.some(
				(o) => o.id === midiState.selectedDeviceId
			);
			if (!stillExists) {
				setMIDIDevice(null);
				setMIDIConnectionState(false);
			} else {
				setMIDIConnectionState(isConnected());
			}
		}
	}

	async function handleToggle() {
		const newEnabled = !midiState.enabled;

		if (newEnabled) {
			// Enabling MIDI - need to request access if not granted
			if (!midiState.permissionGranted) {
				const access = await requestMIDIAccess();
				if (!access) {
					setMIDIError('permission_denied');
					return;
				}
				setMIDIPermissionGranted(true);
				setMIDIError(null);
			}

			// Refresh device list
			await refreshDevices();

			// If we have a saved device, try to select it
			if (midiState.selectedDeviceId) {
				const success = selectMIDIOutput(midiState.selectedDeviceId);
				setMIDIConnectionState(success && isConnected());
			}

			// If no device selected or saved, and we haven't seen setup, open setup modal
			if (
				!midiState.selectedDeviceId ||
				!midiState.hasSeenSetupModal
			) {
				setMIDIEnabled(true);
				persistSettings();
				onOpenSetup?.();
				return;
			}
		} else {
			// Disabling MIDI
			setMIDIConnectionState(false);
		}

		setMIDIEnabled(newEnabled);
		persistSettings();
	}

	function persistSettings() {
		const { enabled, selectedDeviceId, hasSeenSetupModal, midiChannel, velocity, strumEnabled } =
			midiState;
		saveMIDISettings({
			enabled,
			selectedDeviceId,
			hasSeenSetupModal,
			midiChannel,
			velocity,
			strumEnabled
		});
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

	let buttonVariant = $derived.by(() => {
		if (!isEnabled) return 'outline' as const;
		if (isConnectedState) return 'default' as const;
		return 'secondary' as const;
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
						variant={buttonVariant}
						size="icon"
						class="relative"
						aria-label={tooltipText}
					>
						<Cable class="size-4" />
						{#if isEnabled && isConnectedState}
							<span
								class="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-green-500 ring-2 ring-background"
							></span>
						{:else if isEnabled && !isConnectedState}
							<span
								class="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-yellow-500 ring-2 ring-background"
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
