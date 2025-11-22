<script lang="ts">
	import ChordBuilder from '$lib/components/ChordBuilder.svelte';
	import ChordProgression from '$lib/components/ChordProgression.svelte';
	import ChordPalette from '$lib/components/ChordPalette.svelte';
</script>

<div class="flex flex-col h-screen bg-background">
	<header class="shrink-0 border-b bg-background z-10">
		<div class="container mx-auto px-4 sm:px-8 py-4 flex items-center max-w-7xl">
			<div>
				<h1 class="text-xl sm:text-2xl font-bold tracking-tight">Bare Minimum Theory</h1>
				<p class="text-xs sm:text-sm text-muted-foreground">Build chord progressions, your way.</p>
			</div>
		</div>
	</header>

	<div class="flex-1 overflow-y-auto">
		<div class="container mx-auto px-4 sm:px-8 py-6 max-w-7xl">
			<div class="flex flex-col lg:flex-row gap-8 lg:gap-12 min-h-full">
				<div class="flex-1 space-y-8">
					<ChordBuilder />
					<ChordProgression />
				</div>

				<div class="w-full lg:w-80 shrink-0 lg:border-l lg:pl-12">
					<ChordPalette />
				</div>
			</div>
		</div>
	</div>
</div>
