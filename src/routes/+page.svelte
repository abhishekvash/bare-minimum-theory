<script lang="ts">
	import ChordBuilder from '$lib/components/ChordBuilder.svelte';
	import ChordProgression from '$lib/components/ChordProgression.svelte';
	import ScaleFilter from '$lib/components/ScaleFilter.svelte';
</script>

<div class="min-h-screen bg-background">
	<div class="container mx-auto px-4 py-8 max-w-5xl">
		<div class="mb-8 flex items-start justify-between">
			<div>
				<h1 class="text-4xl font-bold tracking-tight mb-2">Bare Minimum Theory</h1>
				<p class="text-muted-foreground">Pick a root • Choose a quality • Drag to build your progression</p>
			</div>
			<ScaleFilter />
		</div>

		<ChordBuilder />

		<div class="mt-8">
			<ChordProgression />
		</div>
	</div>
</div>
