<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import Play from 'lucide-svelte/icons/play';
	import Stop from 'lucide-svelte/icons/square';
	import Download from 'lucide-svelte/icons/download';

	interface Props {
		isPlaying: boolean;
		hasChords: boolean;
		onPlay: () => void;
		onStop: () => void;
		onExport: () => void;
	}

	let { isPlaying, hasChords, onPlay, onStop, onExport }: Props = $props();
</script>

<div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
	<div>
		<h2 class="text-2xl font-semibold tracking-tight">Your Progression</h2>
		<p class="text-sm text-muted-foreground">Drag chords here • Reorder by dragging blocks • Tweak controls • Play or export</p>
	</div>
	<div class="flex flex-wrap gap-2">
		<Button
			onclick={onPlay}
			disabled={!hasChords || isPlaying}
			size="icon"
			title="Play"
		>
			<Play class="size-4" />
		</Button>
		<Button
			onclick={onStop}
			disabled={!isPlaying}
			size="icon"
			variant="outline"
			title="Stop"
		>
			<Stop class="size-4" />
		</Button>
		<Button
			variant="outline"
			onclick={onExport}
			disabled={!hasChords}
			class="gap-2"
		>
			<Download class="size-4" />
			<span>Export MIDI</span>
		</Button>
	</div>
</div>

