<script lang="ts">
	import ChordBuilder from '$lib/components/ChordBuilder.svelte';
	import ChordProgression from '$lib/components/ChordProgression.svelte';
</script>

<div class="min-h-screen bg-background">
	<div class="container mx-auto px-4 py-8 max-w-5xl">
		<div class="mb-12">
			<h1 class="text-4xl font-bold tracking-tight mb-2">Bare Minimum Theory</h1>
			<p class="text-muted-foreground">Build chord progressions intuitively</p>
		</div>

		<ChordBuilder />

		<div class="mt-12">
			<ChordProgression />
		</div>
	</div>
</div>
