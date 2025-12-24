<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';

	interface Props {
		open?: boolean;
		progressionName?: string;
		onConfirm?: () => void;
		onCancel?: () => void;
	}

	let {
		open = $bindable(false),
		progressionName = '',
		onConfirm,
		onCancel
	}: Props = $props();

	function handleConfirm() {
		onConfirm?.();
		open = false;
	}

	function handleCancel() {
		onCancel?.();
		open = false;
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="max-w-sm">
		<Dialog.Header>
			<Dialog.Title>Replace Current Progression?</Dialog.Title>
			<Dialog.Description>
				Loading "{progressionName}" will replace your current progression. Any unsaved changes will
				be lost.
			</Dialog.Description>
		</Dialog.Header>

		<Dialog.Footer>
			<Button variant="outline" onclick={handleCancel}>Cancel</Button>
			<Button onclick={handleConfirm}>Load Progression</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
