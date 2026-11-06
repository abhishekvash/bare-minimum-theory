<script lang="ts">
	import { IconButton } from '$lib/components/ui/icon-button';
	import * as Tooltip from '$lib/components/ui/tooltip';

	interface Props {
		onclick: (e: MouseEvent) => void;
	}

	let { onclick }: Props = $props();
</script>

<Tooltip.Provider>
	<IconButton tooltip="Do the thing" {onclick}>x</IconButton>
</Tooltip.Provider>
