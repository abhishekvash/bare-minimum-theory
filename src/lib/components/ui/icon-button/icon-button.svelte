<script lang="ts">
	import { Button, type ButtonProps, type ButtonSize, type ButtonVariant } from '$lib/components/ui/button';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import type { Snippet } from 'svelte';

	interface Props {
		tooltip: string;
		variant?: ButtonVariant;
		size?: ButtonSize;
		disabled?: boolean;
		onclick?: (e: MouseEvent) => void;
		class?: string;
		side?: 'top' | 'bottom' | 'left' | 'right';
		children: Snippet;
	}

	let {
		tooltip,
		variant = 'default',
		size = 'icon',
		disabled = false,
		onclick,
		class: className,
		side = 'top',
		children
	}: Props = $props();
</script>

<Tooltip.Root>
	<Tooltip.Trigger>
		{#snippet child({ props })}
			<Button
				{...props}
				{variant}
				{size}
				{disabled}
				{onclick}
				class={className}
				aria-label={tooltip}
			>
				{@render children()}
			</Button>
		{/snippet}
	</Tooltip.Trigger>
	<Tooltip.Content {side}>
		{tooltip}
	</Tooltip.Content>
</Tooltip.Root>
