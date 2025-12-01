<script lang="ts">
	import * as Select from '$lib/components/ui/select';
	import ChevronDown from 'lucide-svelte/icons/chevron-down';

	interface Props {
		open?: boolean;
		midiChannel: number;
		velocity: number;
		strumEnabled: boolean;
		onChannelChange: (value: string | undefined) => void;
		onVelocityChange: (e: Event) => void;
		onStrumChange: (e: Event) => void;
	}

	let {
		open = $bindable(false),
		midiChannel,
		velocity,
		strumEnabled,
		onChannelChange,
		onVelocityChange,
		onStrumChange
	}: Props = $props();
</script>

<details bind:open class="group">
	<summary class="flex items-center gap-2 cursor-pointer list-none">
		<ChevronDown class="size-4 transition-transform group-open:rotate-180" />
		<span class="font-medium">Advanced Settings</span>
	</summary>
	<div class="mt-4 space-y-4">
		<!-- MIDI Channel -->
		<div class="space-y-2">
			<label for="midi-channel" class="text-sm font-medium">MIDI Channel</label>
			<Select.Root type="single" value={midiChannel.toString()} onValueChange={onChannelChange}>
				<Select.Trigger class="w-32">
					Channel {midiChannel}
				</Select.Trigger>
				<Select.Content>
					{#each Array.from({ length: 16 }, (_, i) => i + 1) as ch (ch)}
						<Select.Item value={ch.toString()} label={`Channel ${ch}`}>Channel {ch}</Select.Item>
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
				oninput={onVelocityChange}
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
				onchange={onStrumChange}
				class="h-4 w-4 rounded border-gray-300"
			/>
		</div>
	</div>
</details>
