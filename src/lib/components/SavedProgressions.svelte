<script lang="ts">
	import { flip } from 'svelte/animate';
	import { prefersReducedMotion } from 'svelte/motion';
	import type { SavedProgression } from '#lib/utils/progression-persistence.ts';
	import { filterProgressions } from '#lib/utils/progression-persistence.ts';
	import SavedProgressionItem from './SavedProgressionItem.svelte';
	import Search from '@lucide/svelte/icons/search';

	interface Props {
		progressions: SavedProgression[];
		onLoad?: (progression: SavedProgression) => void;
		onDelete?: (id: string) => void;
		onExport?: (progression: SavedProgression) => void;
	}

	let { progressions = [], onLoad, onDelete, onExport }: Props = $props();

	let searchQuery = $state('');

	// Filter progressions based on search query
	let filteredProgressions = $derived(filterProgressions(progressions, searchQuery));
</script>

<div class="space-y-3">
	<p class="text-xs text-muted-foreground">Your saved chord progressions.</p>

	<!-- Search Input -->
	{#if progressions.length > 0}
		<div class="relative">
			<Search class="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
			<input
				type="text"
				bind:value={searchQuery}
				placeholder="Search by name or tag..."
				aria-label="Search saved progressions"
				class="w-full pl-8 pr-3 py-1.5 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
			/>
		</div>
	{/if}

	<!-- Progression List -->
	{#if progressions.length === 0}
		<div
			class="rounded-lg border-2 border-dashed border-border/40 bg-muted/20 py-12 px-6 text-center transition-colors"
		>
			<p class="text-sm font-medium text-muted-foreground mb-1">No saved progressions</p>
			<p class="text-xs text-muted-foreground">Build a progression and click Save to store it</p>
		</div>
	{:else if filteredProgressions.length === 0}
		<div class="py-8 text-center">
			<p class="text-sm text-muted-foreground">No progressions match "{searchQuery}"</p>
		</div>
	{:else}
		<div class="space-y-2">
			{#each filteredProgressions as progression (progression.id)}
				<!-- Deleting or filtering glides the remaining entries into place -->
				<div animate:flip={{ duration: prefersReducedMotion.current ? 0 : 200 }}>
					<SavedProgressionItem {progression} {onLoad} {onDelete} {onExport} />
				</div>
			{/each}
		</div>
	{/if}
</div>
