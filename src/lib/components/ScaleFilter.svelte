<script lang="ts">
	import { progressionState, setScale, clearScale, setScaleFilterEnabled, setRandomizeWithinScale } from '$lib/stores/progression.svelte';
	import { NOTE_NAMES } from '$lib/utils/theory-engine/constants';
	import { Button } from '$lib/components/ui/button';
	import * as Select from '$lib/components/ui/select';
	import * as Popover from '$lib/components/ui/popover';
	import { Separator } from '$lib/components/ui/separator';
	import { Music } from 'lucide-svelte';

	// Scale modes in order of popularity
	const MODES = [
		'major',
		'minor',
		'dorian',
		'phrygian',
		'lydian',
		'mixolydian',
		'aeolian',
		'locrian'
	] as const;

	// Local state for selectors
	let selectedKey = $state<string | null>(null);
	let selectedMode = $state<string | null>(null);
	let isOpen = $state(false);

	// Derived state for whether a scale is selected
	const hasScale = $derived(selectedKey !== null && selectedMode !== null);

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
	<Popover.Trigger class="inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background shadow-xs hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2">
		<Music class="size-4" />
		{#if hasScale}
			{selectedKey} {selectedMode?.charAt(0).toUpperCase() + selectedMode?.slice(1)}
		{:else}
			Key & Scale
		{/if}
	</Popover.Trigger>
	<Popover.Content align="start" class="w-80">
		<div class="space-y-4">
			<div class="space-y-2">
				<h3 class="font-medium leading-none">Key & Scale</h3>
				<p class="text-xs text-muted-foreground">Highlights in-scale chords. Grayed options are still usable.</p>
			</div>

			<div class="grid grid-cols-2 gap-3">
		<!-- Key Selector -->
		<div class="space-y-2">
			<label class="text-sm font-medium text-muted-foreground">Key</label>
			<Select.Root type="single" value={selectedKey ?? undefined} onValueChange={handleKeyChange}>
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

		<!-- Mode Selector -->
		<div class="space-y-2">
			<label class="text-sm font-medium text-muted-foreground">Mode</label>
			<Select.Root type="single" value={selectedMode ?? undefined} onValueChange={handleModeChange}>
				<Select.Trigger class="w-full">
					{selectedMode ? selectedMode.charAt(0).toUpperCase() + selectedMode.slice(1) : 'Select mode'}
				</Select.Trigger>
				<Select.Content>
					<Select.Group>
						{#each MODES as mode}
							{@const capitalizedMode = mode.charAt(0).toUpperCase() + mode.slice(1)}
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

			<!-- Toggle Options -->
			<div class="space-y-3">
			<!-- Lock to Scale Toggle -->
			<label class="flex items-start gap-3 cursor-pointer">
				<input
					type="checkbox"
					checked={progressionState.scaleFilterEnabled}
					onchange={handleLockToggle}
					class="mt-0.5 h-4 w-4 rounded border-input accent-primary"
				/>
				<div class="flex-1 space-y-1">
					<div class="text-sm font-medium leading-none">Lock to scale</div>
					<div class="text-xs text-muted-foreground">
						Grays out non-scale options in chord builder
					</div>
				</div>
			</label>

			<!-- Randomize Within Scale Toggle -->
			<label class="flex items-start gap-3 cursor-pointer">
				<input
					type="checkbox"
					checked={progressionState.randomizeWithinScale}
					onchange={handleRandomizeToggle}
					class="mt-0.5 h-4 w-4 rounded border-input accent-primary"
				/>
				<div class="flex-1 space-y-1">
					<div class="text-sm font-medium leading-none">Respect scale when randomizing</div>
					<div class="text-xs text-muted-foreground">
						Constrains chord block randomization to scale notes
					</div>
				</div>
				</label>
			</div>

			<Button variant="outline" class="w-full" onclick={handleClear}>
				Clear Scale
			</Button>
		{/if}
	</div>
	</Popover.Content>
</Popover.Root>

