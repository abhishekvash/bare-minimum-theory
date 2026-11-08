<script lang="ts">
	/**
	 * Standing preferences, gathered in one place: what browsing plays, what Randomize changes,
	 * MIDI output and clock sync, and display. Every change applies at once (settings autosave persists it).
	 */
	import type { Attachment } from 'svelte/attachments';
	import * as Dialog from '#lib/components/ui/dialog/index.ts';
	import { Separator } from '#lib/components/ui/separator/index.ts';
	import MIDISettingsSection from '#lib/components/settings/MIDISettingsSection.svelte';
	import {
		settingsState,
		setPianoVisible,
		setPreviewOption,
		setRandomizeOption
	} from '#lib/stores/settings.svelte.ts';
	import { closeSettings, uiState, type SettingsSection } from '#lib/stores/ui.svelte.ts';
	import type { PreviewOptions, RandomizeOptions } from '#lib/utils/settings-persistence.ts';

	type Toggle<K extends string> = { key: K; label: string; description: string };

	const PREVIEW_TOGGLES: Toggle<keyof PreviewOptions>[] = [
		{
			key: 'chained',
			label: 'Preview in context',
			description:
				'Clicking a quality plays the nearest earlier chord first, then the new one, so you hear the change.'
		},
		{
			key: 'onSelect',
			label: 'Preview on select',
			description: 'Selecting a chord on the canvas plays it.'
		},
		{
			key: 'onSweep',
			label: 'Preview while sweeping',
			description: 'Pressing and dragging across qualities plays each one you cross.'
		}
	];

	const RANDOMIZE_TOGGLES: Toggle<keyof RandomizeOptions>[] = [
		{ key: 'inversion', label: 'Inversion', description: 'Pick a random inversion.' },
		{ key: 'voicing', label: 'Voicing', description: 'Pick a random voicing.' },
		{ key: 'octave', label: 'Octave', description: 'Shift up or down an octave.' },
		{ key: 'quality', label: 'Quality', description: 'Change the chord quality.' }
	];

	function togglePreview(key: keyof PreviewOptions): void {
		setPreviewOption(key, !settingsState.previewOptions[key]);
	}

	function toggleRandomize(key: keyof RandomizeOptions): void {
		setRandomizeOption(key, !settingsState.randomizeOptions[key]);
	}

	function togglePiano(): void {
		const visible = !settingsState.pianoKeyboard.visible;
		setPianoVisible(visible);
	}

	// Function binding: the store owns the open state; bits-ui only ever asks to close it
	function getOpen(): boolean {
		return uiState.settings.open;
	}

	function setOpen(open: boolean): void {
		if (!open) closeSettings();
	}

	/**
	 * A contextual entry point (the inspector's Randomize gear, the MIDI modal) lands on its
	 * section. An attachment runs once the section is in the DOM and again whenever the requested
	 * section changes, so there is no tick() or querySelector involved.
	 */
	function landOn(section: SettingsSection): Attachment<HTMLElement> {
		return (element) => {
			if (uiState.settings.open && uiState.settings.section === section) {
				element.scrollIntoView({ block: 'start' });
			}
		};
	}
</script>

{#snippet checkboxRow(
	id: string,
	label: string,
	description: string,
	checked: boolean,
	onchange: () => void
)}
	<label for={id} class="flex cursor-pointer items-start gap-3">
		<input
			{id}
			type="checkbox"
			{checked}
			{onchange}
			class="mt-0.5 h-4 w-4 shrink-0 rounded border-input accent-primary"
		/>
		<span class="space-y-0.5">
			<span class="block text-sm font-medium leading-none">{label}</span>
			<span class="block text-xs text-muted-foreground">{description}</span>
		</span>
	</label>
{/snippet}

<Dialog.Root bind:open={getOpen, setOpen}>
	<Dialog.Content class="max-h-[85vh] max-w-lg overflow-y-auto" data-settings-dialog>
		<Dialog.Header>
			<Dialog.Title>Settings</Dialog.Title>
			<Dialog.Description>Saved in this browser and applied right away.</Dialog.Description>
		</Dialog.Header>

		<div class="space-y-6 py-2 text-sm">
			<section data-settings-section="preview" class="space-y-3" {@attach landOn('preview')}>
				<div>
					<h3 class="text-base font-semibold">Preview</h3>
					<p class="text-xs text-muted-foreground">
						What plays while you browse. Previews stay silent while the loop is playing.
					</p>
				</div>
				{#each PREVIEW_TOGGLES as toggle (toggle.key)}
					{@render checkboxRow(
						`setting-preview-${toggle.key}`,
						toggle.label,
						toggle.description,
						settingsState.previewOptions[toggle.key],
						() => togglePreview(toggle.key)
					)}
				{/each}
			</section>

			<Separator />

			<section data-settings-section="randomize" class="space-y-3" {@attach landOn('randomize')}>
				<div>
					<h3 class="text-base font-semibold">Randomize</h3>
					<p class="text-xs text-muted-foreground">
						What the Randomize button in the chord inspector changes. To stay inside a key, use
						"Randomize within scale" under Key &amp; Scale.
					</p>
				</div>
				{#each RANDOMIZE_TOGGLES as toggle (toggle.key)}
					{@render checkboxRow(
						`setting-randomize-${toggle.key}`,
						toggle.label,
						toggle.description,
						settingsState.randomizeOptions[toggle.key],
						() => toggleRandomize(toggle.key)
					)}
				{/each}
			</section>

			<Separator />

			<section data-settings-section="midi" class="space-y-3" {@attach landOn('midi')}>
				<div>
					<h3 class="text-base font-semibold">MIDI</h3>
					<p class="text-xs text-muted-foreground">
						How chords are sent to your DAW. Choose the output device from the MIDI button.
					</p>
				</div>
				<MIDISettingsSection />
			</section>

			<Separator />

			<section data-settings-section="display" class="space-y-3" {@attach landOn('display')}>
				<h3 class="text-base font-semibold">Display</h3>
				{@render checkboxRow(
					'setting-display-piano',
					'Show piano keyboard',
					'Light up the notes being played on a keyboard below the controls.',
					settingsState.pianoKeyboard.visible,
					togglePiano
				)}
			</section>
		</div>
	</Dialog.Content>
</Dialog.Root>
