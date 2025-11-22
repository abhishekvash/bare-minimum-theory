<script lang="ts">
	import {
		progressionState,
		setScale,
		clearScale,
		setScaleFilterEnabled,
		setRandomizeWithinScale
	} from '$lib/stores/progression.svelte';
	import { NOTE_NAMES, MODES } from '$lib/utils/theory-engine/constants';
	import { Button } from '$lib/components/ui/button';
	import * as Select from '$lib/components/ui/select';
	import * as Popover from '$lib/components/ui/popover';
	import { Separator } from '$lib/components/ui/separator';
	import { Music } from 'lucide-svelte';

	let selectedKey = $state<string | null>(null);
	let selectedMode = $state<string | null>(null);
	let isOpen = $state(false);

	const hasScale = $derived(selectedKey !== null && selectedMode !== null);

	/**
	 * Capitalize the first letter of a string
	 * @param str - String to capitalize
	 * @returns Capitalized string
	 */
	function capitalize(str: string): string {
		return str.charAt(0).toUpperCase() + str.slice(1);
	}

	function handleKeyChange(value: string) {
		selectedKey = value;
		if (selectedMode) {
			setScale(value, selectedMode);
		}
	}

	function handleModeChange(value: string) {
		selectedMode = value;
		if (selectedKey) {
			setScale(selectedKey, value);
		}
	}

	function handleClear() {
		selectedKey = null;
		selectedMode = null;
		clearScale();
		setScaleFilterEnabled(false);
		setRandomizeWithinScale(false);
		isOpen = false;
	}

	function handleLockToggle() {
		setScaleFilterEnabled(!progressionState.scaleFilterEnabled);
	}

	function handleRandomizeToggle() {
		setRandomizeWithinScale(!progressionState.randomizeWithinScale);
	}
</script>

<Popover.Root bind:open={isOpen}>
	<Popover.Trigger>
		{#snippet child({ props })}
			<Button {...props} variant="outline" class="gap-2">
				<Music class="size-4" />
				{#if hasScale && selectedKey && selectedMode}
					{selectedKey} {capitalize(selectedMode)}
				{:else}
					Key & Scale
				{/if}
			</Button>
		{/snippet}
	</Popover.Trigger>
	<Popover.Content align="start" class="w-80">
		<div class="space-y-4">
			<div>
				<h3 class="text-sm font-semibold leading-none mb-1">Key & Scale</h3>
				<p class="text-xs text-muted-foreground">Optional helper. All chords remain usable.</p>
			</div>

			<div class="grid grid-cols-2 gap-3">
				<div class="space-y-2">
					<div class="text-sm font-medium text-muted-foreground">Key</div>
					<Select.Root
						type="single"
						value={selectedKey ?? undefined}
						onValueChange={handleKeyChange}
					>
						<Select.Trigger class="w-full">
							{selectedKey || 'Select key'}
						</Select.Trigger>
						<Select.Content>
							<Select.Group>
								{#each NOTE_NAMES as note}
									<Select.Item value={note} label={note}>{note}</Select.Item>
								{/each}
							</Select.Group>
						</Select.Content>
					</Select.Root>
				</div>

				<div class="space-y-2">
					<div class="text-sm font-medium text-muted-foreground">Mode</div>
					<Select.Root
						type="single"
						value={selectedMode ?? undefined}
						onValueChange={handleModeChange}
					>
						<Select.Trigger class="w-full">
							{selectedMode ? capitalize(selectedMode) : 'Select mode'}
						</Select.Trigger>
						<Select.Content>
							<Select.Group>
								{#each MODES as mode}
									{@const capitalizedMode = capitalize(mode)}
									<Select.Item value={mode} label={capitalizedMode}>
										{capitalizedMode}
									</Select.Item>
								{/each}
							</Select.Group>
						</Select.Content>
					</Select.Root>
				</div>
			</div>

			{#if hasScale}
				<Separator />

				<div class="space-y-3">
					<label class="flex items-start gap-3 cursor-pointer">
						<input
							type="checkbox"
							checked={progressionState.scaleFilterEnabled}
							onchange={handleLockToggle}
							class="mt-0.5 h-4 w-4 rounded border-input accent-primary"
						/>
						<div class="flex-1 space-y-1">
							<div class="text-sm font-medium leading-none">Highlight scale chords</div>
							<div class="text-xs text-muted-foreground">Dims out-of-scale options in builder</div>
						</div>
					</label>

					<label class="flex items-start gap-3 cursor-pointer">
						<input
							type="checkbox"
							checked={progressionState.randomizeWithinScale}
							onchange={handleRandomizeToggle}
							class="mt-0.5 h-4 w-4 rounded border-input accent-primary"
						/>
						<div class="flex-1 space-y-1">
							<div class="text-sm font-medium leading-none">Randomize within scale</div>
							<div class="text-xs text-muted-foreground">Keeps randomized chords in scale</div>
						</div>
					</label>
				</div>

				<Button variant="outline" class="w-full" onclick={handleClear}>Clear Scale</Button>
			{/if}
		</div>
	</Popover.Content>
</Popover.Root>
