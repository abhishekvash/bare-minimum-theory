<script lang="ts">
	/** Mount the real page inside the tooltip provider supplied by the root layout. */
	import Page from '../../routes/+page.svelte';
	import * as Tooltip from '$lib/components/ui/tooltip';
</script>

<Tooltip.Provider>
	<Page />
</Tooltip.Provider>
