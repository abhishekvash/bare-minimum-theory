<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import X from 'lucide-svelte/icons/x';
	import { cn } from '$lib/utils';

	interface Props {
		open?: boolean;
		availableTags?: string[];
		/**
		 * Persist the progression. Resolve to `false` (or throw) when saving failed, so the form keeps
		 * what the user entered for a retry.
		 */
		onSave?: (name: string, tags: string[]) => boolean | void | Promise<boolean | void>;
	}

	let { open = $bindable(false), availableTags = [], onSave }: Props = $props();

	// Form state
	let progressionName = $state('');
	let tags = $state<string[]>([]);
	let tagInput = $state('');
	let errorMessage = $state('');
	let showSuggestions = $state(false);
	let activeSuggestionIndex = $state(-1);
	let saving = $state(false);

	const SUGGESTION_LIST_ID = 'tag-suggestions';

	// Filter suggestions based on current input
	let filteredSuggestions = $derived(() => {
		if (!tagInput.trim()) return [];
		const search = tagInput.toLowerCase().trim();
		return availableTags.filter((tag) => tag.includes(search) && !tags.includes(tag)).slice(0, 5); // Limit to 5 suggestions
	});

	/** Trim and lowercase a tag, and append it unless it is empty or already present */
	function withTag(current: string[], tag: string): string[] {
		const normalized = tag.trim().toLowerCase();
		return normalized && !current.includes(normalized) ? [...current, normalized] : current;
	}

	function addTag(tag: string) {
		tags = withTag(tags, tag);
		tagInput = '';
		showSuggestions = false;
		activeSuggestionIndex = -1;
	}

	const suggestionsVisible = $derived(showSuggestions && filteredSuggestions().length > 0);

	function suggestionId(index: number): string {
		return `${SUGGESTION_LIST_ID}-${index}`;
	}

	function removeTag(tagToRemove: string) {
		tags = tags.filter((t) => t !== tagToRemove);
	}

	function handleKeydown(e: KeyboardEvent) {
		const suggestions = filteredSuggestions();
		if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
			if (suggestions.length === 0) return;
			e.preventDefault();
			showSuggestions = true;
			const step = e.key === 'ArrowDown' ? 1 : -1;
			const start = activeSuggestionIndex === -1 && step === -1 ? 0 : activeSuggestionIndex;
			activeSuggestionIndex = (start + step + suggestions.length) % suggestions.length;
		} else if (e.key === 'Enter') {
			e.preventDefault();
			const active = suggestionsVisible ? suggestions[activeSuggestionIndex] : undefined;
			if (active) {
				addTag(active);
			} else if (tagInput.trim()) {
				addTag(tagInput);
			}
		} else if (e.key === 'Escape' && suggestionsVisible) {
			// Close the list first; a second Escape closes the dialog
			e.preventDefault();
			e.stopPropagation();
			showSuggestions = false;
			activeSuggestionIndex = -1;
		}
	}

	function handleTagInput() {
		showSuggestions = true;
		activeSuggestionIndex = -1;
	}

	async function handleSave() {
		if (saving) return;

		// Validate name
		if (!progressionName.trim()) {
			errorMessage = 'Please enter a name for your progression';
			return;
		}

		// A tag still sitting in the input counts, the same as if Add had been pressed
		const tagsToSave = withTag(tags, tagInput);

		saving = true;
		let saved: boolean | void;
		try {
			saved = await onSave?.(progressionName.trim(), tagsToSave);
		} catch {
			saved = false;
		} finally {
			saving = false;
		}

		// Keep what the user typed when saving failed, so they can retry
		if (saved !== false) resetForm();
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
		activeSuggestionIndex = -1;
	}

	// Reset form when modal opens
	$effect(() => {
		if (open) {
			resetForm();
		}
	});
</script>

<!-- While a save is in flight the dialog can't be dismissed by the user (the page closes it on success) -->
<Dialog.Root
	bind:open={
		() => open,
		(value) => {
			if (!saving) open = value;
		}
	}
>
	<Dialog.Content class="max-w-md">
		<Dialog.Header>
			<Dialog.Title>Save Progression</Dialog.Title>
			<Dialog.Description>
				Give your progression a name and optional tags for easy finding later
			</Dialog.Description>
		</Dialog.Header>

		<!-- Locked while saving, so the reset after a successful save can't clear a newer edit -->
		<fieldset class="space-y-4 py-4" disabled={saving}>
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
							role="combobox"
							aria-autocomplete="list"
							aria-expanded={suggestionsVisible}
							aria-controls={SUGGESTION_LIST_ID}
							aria-activedescendant={suggestionsVisible && activeSuggestionIndex >= 0
								? suggestionId(activeSuggestionIndex)
								: undefined}
							onkeydown={handleKeydown}
							oninput={handleTagInput}
							onfocus={() => (showSuggestions = true)}
							onblur={() => {
								showSuggestions = false;
								activeSuggestionIndex = -1;
							}}
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
					{#if suggestionsVisible}
						<ul
							id={SUGGESTION_LIST_ID}
							role="listbox"
							aria-label="Tag suggestions"
							class="absolute z-10 w-full mt-1 py-1 bg-popover border border-border rounded-md shadow-md"
						>
							{#each filteredSuggestions() as suggestion, index (suggestion)}
								<!--
									Focus stays on the input (aria-activedescendant); a primary mousedown picks the tag and
									is prevented so the input never blurs. A click with no mousedown before it (a screen
									reader's default action) picks it too; after a mousedown pick the click is a no-op,
									since addTag never adds a tag twice. Keys stay on the input, which owns the listbox.
								-->
								<!-- svelte-ignore a11y_click_events_have_key_events -->
								<li
									id={suggestionId(index)}
									role="option"
									aria-selected={index === activeSuggestionIndex}
									class={cn(
										'w-full px-3 py-1.5 text-sm text-left hover:bg-accent hover:text-accent-foreground cursor-pointer',
										index === activeSuggestionIndex && 'bg-accent text-accent-foreground'
									)}
									onmousedown={(e) => {
										if (e.button !== 0) return;
										e.preventDefault();
										addTag(suggestion);
									}}
									onclick={() => addTag(suggestion)}
								>
									{suggestion}
								</li>
							{/each}
						</ul>
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
		</fieldset>

		<Dialog.Footer>
			<Button variant="outline" onclick={handleCancel} disabled={saving}>Cancel</Button>
			<Button onclick={handleSave} disabled={saving}>Save Progression</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
