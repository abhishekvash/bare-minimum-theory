<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import X from 'lucide-svelte/icons/x';

	interface Props {
		open?: boolean;
		availableTags?: string[];
		onSave?: (name: string, tags: string[]) => void;
	}

	let { open = $bindable(false), availableTags = [], onSave }: Props = $props();

	// Form state
	let progressionName = $state('');
	let tags = $state<string[]>([]);
	let tagInput = $state('');
	let errorMessage = $state('');
	let showSuggestions = $state(false);

	// Filter suggestions based on current input
	let filteredSuggestions = $derived(() => {
		if (!tagInput.trim()) return [];
		const search = tagInput.toLowerCase().trim();
		return availableTags.filter((tag) => tag.includes(search) && !tags.includes(tag)).slice(0, 5); // Limit to 5 suggestions
	});

	function addTag(tag: string) {
		const trimmed = tag.trim().toLowerCase();
		if (trimmed && !tags.includes(trimmed)) {
			tags = [...tags, trimmed];
		}
		tagInput = '';
		showSuggestions = false;
	}

	function removeTag(tagToRemove: string) {
		tags = tags.filter((t) => t !== tagToRemove);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			if (tagInput.trim()) {
				addTag(tagInput);
			}
		} else if (e.key === 'Escape') {
			showSuggestions = false;
		}
	}

	function handleSave() {
		// Validate name
		if (!progressionName.trim()) {
			errorMessage = 'Please enter a name for your progression';
			return;
		}

		// Call the onSave callback
		onSave?.(progressionName.trim(), tags);

		// Reset form state
		resetForm();
	}

	function handleCancel() {
		resetForm();
		open = false;
	}

	function resetForm() {
		progressionName = '';
		tags = [];
		tagInput = '';
		errorMessage = '';
		showSuggestions = false;
	}

	// Reset form when modal opens
	$effect(() => {
		if (open) {
			resetForm();
		}
	});
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="max-w-md">
		<Dialog.Header>
			<Dialog.Title>Save Progression</Dialog.Title>
			<Dialog.Description>
				Give your progression a name and optional tags for easy finding later
			</Dialog.Description>
		</Dialog.Header>

		<div class="space-y-4 py-4">
			<!-- Name Input -->
			<div class="space-y-2">
				<label for="progression-name" class="text-sm font-medium">
					Name <span class="text-destructive">*</span>
				</label>
				<input
					id="progression-name"
					type="text"
					bind:value={progressionName}
					placeholder="e.g., Lo-fi Chill Progression"
					class="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
					onkeydown={(e) => e.key === 'Enter' && handleSave()}
				/>
			</div>

			<!-- Tags Input -->
			<div class="space-y-2">
				<label for="tag-input" class="text-sm font-medium">Tags (optional)</label>
				<div class="relative">
					<div class="flex gap-2">
						<input
							id="tag-input"
							type="text"
							bind:value={tagInput}
							placeholder="Add a tag..."
							class="flex-1 px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
							onkeydown={handleKeydown}
							onfocus={() => (showSuggestions = true)}
							onblur={() => setTimeout(() => (showSuggestions = false), 150)}
						/>
						<Button
							type="button"
							size="sm"
							variant="outline"
							onclick={() => addTag(tagInput)}
							disabled={!tagInput.trim()}
						>
							Add
						</Button>
					</div>

					<!-- Autocomplete Dropdown -->
					{#if showSuggestions && filteredSuggestions().length > 0}
						<div
							class="absolute z-10 w-full mt-1 py-1 bg-popover border border-border rounded-md shadow-md"
						>
							{#each filteredSuggestions() as suggestion (suggestion)}
								<button
									type="button"
									class="w-full px-3 py-1.5 text-sm text-left hover:bg-accent hover:text-accent-foreground cursor-pointer"
									onmousedown={() => addTag(suggestion)}
								>
									{suggestion}
								</button>
							{/each}
						</div>
					{/if}
				</div>

				<!-- Tag Pills -->
				{#if tags.length > 0}
					<div class="flex flex-wrap gap-2 mt-3">
						{#each tags as tag (tag)}
							<div
								class="flex items-center gap-1 bg-secondary text-secondary-foreground rounded-full px-3 py-1 text-sm"
							>
								<span>{tag}</span>
								<button
									type="button"
									onclick={() => removeTag(tag)}
									class="ml-0.5 hover:text-destructive cursor-pointer"
									aria-label="Remove {tag}"
								>
									<X class="size-3" />
								</button>
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Error Message -->
			{#if errorMessage}
				<p class="text-sm text-destructive">{errorMessage}</p>
			{/if}
		</div>

		<Dialog.Footer>
			<Button variant="outline" onclick={handleCancel}>Cancel</Button>
			<Button onclick={handleSave}>Save Progression</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
