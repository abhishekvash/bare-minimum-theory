<script lang="ts">
	import ChordBuilder from '$lib/components/ChordBuilder.svelte';
	import ChordProgression from '$lib/components/ChordProgression.svelte';
	import ScaleFilter from '$lib/components/ScaleFilter.svelte';
</script>

<div class="min-h-screen bg-background">
	<div class="container mx-auto px-3 sm:px-4 py-4 sm:py-8 max-w-5xl">
		<div class="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
			<div class="flex-1">
				<h1 class="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight mb-2">Bare Minimum Theory</h1>
				<p class="text-sm sm:text-base text-muted-foreground">Pick a root • Choose a quality • Drag to build your progression</p>
			</div>
			<ScaleFilter />
		</div>

		<ChordBuilder />

		<div class="mt-6 sm:mt-8">
			<ChordProgression />
		</div>
	</div>
</div>
