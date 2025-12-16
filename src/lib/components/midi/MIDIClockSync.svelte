<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Select from '$lib/components/ui/select';
	import RefreshCw from 'lucide-svelte/icons/refresh-cw';
	import Clock from 'lucide-svelte/icons/clock';
	import AlertCircle from 'lucide-svelte/icons/alert-circle';
	import Check from 'lucide-svelte/icons/check';

	interface MIDIInput {
		id: string;
		name: string;
	}

	interface Props {
		inputs: MIDIInput[];
		selectedInputId: string | null;
		isEnabled: boolean;
		isReceivingClock: boolean;
		detectedBpm: number | null;
		onToggle: (enabled: boolean) => void;
		onInputChange: (inputId: string | undefined) => void;
		onRefresh: () => void;
	}

	let {
		inputs,
		selectedInputId,
		isEnabled,
		isReceivingClock,
		detectedBpm,
		onToggle,
		onInputChange,
		onRefresh
	}: Props = $props();

	// Status message based on current state
	const statusMessage = $derived.by(() => {
		if (!isEnabled) return null;
		if (!selectedInputId) return 'Select a MIDI input device';
		if (isReceivingClock && detectedBpm) return `Synced: ${detectedBpm} BPM`;
		return 'Waiting for clock...';
	});

	// Status color class
	const statusColorClass = $derived.by(() => {
		if (!isEnabled) return '';
		if (isReceivingClock && detectedBpm) return 'text-green-600';
		return 'text-yellow-600';
	});

	function handleToggle() {
		onToggle(!isEnabled);
	}
</script>

<div class="space-y-4">
	<div class="space-y-1">
		<div class="flex items-center justify-between">
			<h3 class="font-medium">Sync to DAW</h3>
			<Button
				variant={isEnabled ? 'default' : 'outline'}
				size="sm"
				onclick={handleToggle}
				class="gap-1.5 h-7"
			>
				{#if isEnabled}
					<Check class="size-3" />
					Enabled
				{:else}
					Enable
				{/if}
			</Button>
		</div>
		<p class="text-xs text-muted-foreground">
			Sync tempo and transport with your DAW via MIDI Clock
		</p>
	</div>

	{#if isEnabled}
		<div class="space-y-3 pl-1">
			<!-- Input device selector -->
			<div class="flex items-center justify-between">
				<span class="text-sm text-muted-foreground">Clock Source</span>
				<Button variant="ghost" size="sm" onclick={onRefresh} class="gap-1.5 h-7 px-2">
					<RefreshCw class="size-3" />
					<span class="text-xs">Refresh</span>
				</Button>
			</div>

			{#if inputs.length === 0}
				<div class="rounded-md border border-dashed p-3 text-center">
					<AlertCircle class="size-6 mx-auto mb-1.5 text-muted-foreground" />
					<p class="text-sm text-muted-foreground">No MIDI inputs found</p>
					<p class="text-xs text-muted-foreground mt-1">
						Set up a virtual MIDI port, then click Refresh
					</p>
				</div>
			{:else}
				<Select.Root
					type="single"
					value={selectedInputId ?? undefined}
					onValueChange={onInputChange}
				>
					<Select.Trigger class="w-full h-9">
						{#if selectedInputId}
							{inputs.find((i) => i.id === selectedInputId)?.name || 'Select input'}
						{:else}
							Select clock source
						{/if}
					</Select.Trigger>
					<Select.Content>
						{#each inputs as input (input.id)}
							<Select.Item value={input.id} label={input.name}>{input.name}</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
			{/if}

			<!-- Status indicator -->
			{#if selectedInputId && statusMessage}
				<div class="flex items-center gap-2 text-sm {statusColorClass}">
					{#if isReceivingClock && detectedBpm}
						<span class="relative flex size-2">
							<span
								class="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"
							></span>
							<span class="relative inline-flex size-2 rounded-full bg-green-500"></span>
						</span>
					{:else}
						<Clock class="size-4 animate-pulse" />
					{/if}
					<span>{statusMessage}</span>
				</div>
			{/if}

			<!-- DAW setup hint -->
			<details class="text-xs">
				<summary class="cursor-pointer text-muted-foreground hover:text-foreground">
					How to enable MIDI Clock in your DAW
				</summary>
				<div class="mt-2 space-y-1.5 text-muted-foreground pl-2 border-l-2">
					<p><strong>Ableton:</strong> Preferences → MIDI → Sync → Enable for output port</p>
					<p><strong>Logic:</strong> Project Settings → Synchronization → MIDI Clock</p>
					<p><strong>FL Studio:</strong> Options → MIDI Settings → Send master sync</p>
					<p><strong>Cubase:</strong> Transport → Project Synchronization Setup</p>
				</div>
			</details>
		</div>
	{/if}
</div>
