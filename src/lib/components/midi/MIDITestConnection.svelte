<script lang="ts">
	import { Button } from '$lib/components/ui/button';

	type TestStatus = 'idle' | 'sending' | 'success' | 'error';

	interface Props {
		isConnected: boolean;
		testStatus: TestStatus;
		onTest: () => void;
	}

	let { isConnected, testStatus, onTest }: Props = $props();
</script>

{#if isConnected}
	<div class="space-y-3">
		<h3 class="font-medium">Test Connection</h3>
		<div class="flex items-center gap-3">
			<Button variant="outline" onclick={onTest} disabled={testStatus === 'sending'}>
				{#if testStatus === 'sending'}
					Sending...
				{:else if testStatus === 'success'}
					Sent!
				{:else}
					Send Test Chord
				{/if}
			</Button>
			{#if testStatus === 'success'}
				<span class="text-green-600 text-sm">Check your DAW for a C major chord</span>
			{:else if testStatus === 'error'}
				<span class="text-red-600 text-sm">Failed to send</span>
			{/if}
		</div>
	</div>
{/if}
