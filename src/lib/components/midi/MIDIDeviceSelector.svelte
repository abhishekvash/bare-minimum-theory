<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Select from '$lib/components/ui/select';
	import RefreshCw from 'lucide-svelte/icons/refresh-cw';
	import CheckCircle from 'lucide-svelte/icons/check-circle';
	import AlertCircle from 'lucide-svelte/icons/alert-circle';

	interface MIDIOutput {
		id: string;
		name: string;
	}

	interface Props {
		outputs: MIDIOutput[];
		selectedDeviceId: string | null;
		isConnected: boolean;
		onDeviceChange: (deviceId: string | undefined) => void;
		onRefresh: () => void;
	}

	let { outputs, selectedDeviceId, isConnected, onDeviceChange, onRefresh }: Props = $props();
</script>

<div class="space-y-3">
	<div class="flex items-center justify-between">
		<h3 class="font-medium">MIDI Device</h3>
		<Button variant="ghost" size="sm" onclick={onRefresh} class="gap-1.5">
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
		<Select.Root type="single" value={selectedDeviceId ?? undefined} onValueChange={onDeviceChange}>
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
				{#if isConnected}
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
