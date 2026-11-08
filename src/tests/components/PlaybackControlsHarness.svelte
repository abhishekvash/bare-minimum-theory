<script lang="ts">
	import PlaybackControls from '#lib/components/PlaybackControls.svelte';
	import * as Tooltip from '#lib/components/ui/tooltip/index.ts';

	interface Props {
		isPlaying: boolean;
		hasChords: boolean;
		canSave: boolean;
		onPlay: () => void;
		onStop: () => void;
		onExport: () => void;
		onSave?: () => void;
		onOpenMIDISetup?: () => void;
		onTogglePiano?: () => void;
		isPianoVisible?: boolean;
	}

	let props: Props = $props();
</script>

<Tooltip.Provider>
	<PlaybackControls {...props} />
</Tooltip.Provider>
