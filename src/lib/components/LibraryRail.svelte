<script module lang="ts">
	import { hasNonNullChords } from '#lib/utils/theory-engine/index.ts';
	import type { LibrarySection } from '#lib/stores/ui.svelte.ts';
	import type { SavedProgression } from '#lib/utils/progression-persistence.ts';
	import type { Chord } from '#lib/utils/theory-engine/types.ts';

	/** The two ways a load request can go */
	export type LoadRequestHandlers = {
		/** Put the progression on the canvas now */
		onLoad: (progression: SavedProgression) => void;
		/** Ask the user before overwriting what is already there */
		onConfirm: (progression: SavedProgression) => void;
	};

	/**
	 * Whether loading a saved progression should ask first.
	 * Loading onto an empty canvas destroys nothing, so it happens immediately — the dialog
	 * only appears when there is work on the canvas to overwrite.
	 * @param canvas - Current progression slots
	 * @returns true when the canvas holds at least one chord
	 */
	export function needsLoadConfirmation(canvas: (Chord | null)[]): boolean {
		return hasNonNullChords(canvas);
	}

	/**
	 * Route a load request down the confirmed or immediate path
	 * @param canvas - Current progression slots
	 * @param progression - Saved progression the user asked to load
	 * @param handlers - What to do on each path
	 */
	export function requestProgressionLoad(
		canvas: (Chord | null)[],
		progression: SavedProgression,
		handlers: LoadRequestHandlers
	): void {
		if (needsLoadConfirmation(canvas)) {
			handlers.onConfirm(progression);
		} else {
			handlers.onLoad(progression);
		}
	}

	/**
	 * How a chord dragged over the rail should expand it.
	 * A rail that was collapsed opens as `autoOpened`, so a drag that wanders off collapses it
	 * again; a panel the user opened themselves only switches section and stays put.
	 * @param open - Section the rail currently shows, or null while collapsed
	 * @returns The expansion to apply, or null when the palette is already showing
	 */
	export function resolveDragExpansion(
		open: LibrarySection | null
	): { section: LibrarySection; autoOpened: boolean } | null {
		if (open === 'palette') return null;
		return { section: 'palette', autoOpened: open === null };
	}
</script>

<script lang="ts">
	import { addToPalette, progressionState } from '#lib/stores/progression.svelte.ts';
	import {
		uiState,
		closeAutoOpenedLibraryPanel,
		closeLibraryPanel,
		openLibraryPanel,
		pinLibraryPanel,
		toggleLibraryPanel
	} from '#lib/stores/ui.svelte.ts';
	import { focusLibrarySectionAfterClose } from '#lib/utils/focus-restore.ts';
	import ChordPalette, {
		isPaletteReorderDrag,
		resolveLibraryDrop,
		resolveLibraryDropEffect
	} from './ChordPalette.svelte';
	import SavedProgressions from './SavedProgressions.svelte';
	import { IconButton } from '#lib/components/ui/icon-button/index.ts';
	import * as Dialog from '#lib/components/ui/dialog/index.ts';
	import Palette from '@lucide/svelte/icons/palette';
	import Library from '@lucide/svelte/icons/library';
	import X from '@lucide/svelte/icons/x';

	interface Props {
		onLoadProgression?: (progression: SavedProgression) => void;
		onDeleteProgression?: (id: string) => void;
		onExportProgression?: (progression: SavedProgression) => void;
	}

	let { onLoadProgression, onDeleteProgression, onExportProgression }: Props = $props();

	/** Below this the panel becomes a drawer over the page instead of a column beside it */
	const DESKTOP_QUERY = '(min-width: 1024px)';

	// Only read imperatively (focus checks), so a plain element reference
	let containerEl: HTMLElement | null = null;
	let drawerEl = $state<HTMLElement | null>(null);
	// The side panel is the assumption until matchMedia says otherwise: the rail renders
	// collapsed on the server, so the branch only matters once the browser has answered
	let isDesktop = $state(true);

	let openSection = $derived(uiState.libraryPanel.open);

	let sections = $derived([
		{
			id: 'palette' as LibrarySection,
			label: 'Palette',
			icon: Palette,
			count: progressionState.palette.length
		},
		{
			id: 'saved' as LibrarySection,
			label: 'Saved',
			icon: Library,
			count: progressionState.savedProgressions.items.length
		}
	]);

	let activeSection = $derived(sections.find((section) => section.id === openSection) ?? null);

	/** Close from the panel's own button; the button unmounts, so focus returns to the rail */
	function handleClosePanel() {
		const section = uiState.libraryPanel.open;
		closeLibraryPanel();
		if (section) focusLibrarySectionAfterClose(section);
	}

	$effect(() => {
		// Hosts without matchMedia (jsdom, for one) keep the side-panel default
		if (typeof window.matchMedia !== 'function') return;

		const query = window.matchMedia(DESKTOP_QUERY);
		isDesktop = query.matches;

		const update = (event: MediaQueryListEvent) => {
			isDesktop = event.matches;
		};
		query.addEventListener('change', update);
		return () => query.removeEventListener('change', update);
	});

	/**
	 * A chord dragged onto the collapsed rail expands the palette, so the drop target exists
	 * by the time the pointer gets there
	 */
	function handleRailDragOver(event: DragEvent) {
		const source = event.dataTransfer;
		if (!source || isPaletteReorderDrag(source)) return;
		if (!source.types.includes('application/json')) return;

		event.preventDefault();
		source.dropEffect = resolveLibraryDropEffect(source);

		const expansion = resolveDragExpansion(openSection);
		if (expansion) {
			openLibraryPanel(expansion.section, expansion.autoOpened);
		}
	}

	/** Dropping on the rail itself copies to the palette rather than losing the gesture */
	function handleRailDrop(event: DragEvent) {
		const outcome = resolveLibraryDrop(event.dataTransfer);
		if (outcome.status === 'ignored') return;

		event.preventDefault();
		if (outcome.status === 'accepted') {
			addToPalette(outcome.chord);
			// A completed drop is deliberate: show where the chord landed and stay open
			openLibraryPanel('palette');
			return;
		}
		settleRejectedDrop();
	}

	/**
	 * Finish a drop that landed on the palette panel.
	 * The drop is the end of the gesture either way — there is no dragleave to come — so an
	 * auto-opened panel has to be told here whether it earned its place on screen.
	 * @param accepted - Whether the palette took the chord
	 */
	function handleDropSettled(accepted: boolean) {
		if (accepted) {
			pinLibraryPanel();
			return;
		}
		settleRejectedDrop();
	}

	/** Nothing usable landed: a panel the drag opened collapses instead of latching open */
	function settleRejectedDrop() {
		closeAutoOpenedLibraryPanel();
	}

	/** A drag that leaves without dropping collapses the panel only if the drag opened it */
	function handleDragLeave(event: DragEvent) {
		const next = event.relatedTarget as Node | null;
		if (next && (containerEl?.contains(next) || drawerEl?.contains(next))) return;

		closeAutoOpenedLibraryPanel();
	}

	// Function binding: the drawer is open whenever a section is active on a narrow viewport
	function getDrawerOpen(): boolean {
		return !isDesktop && activeSection !== null;
	}

	function setDrawerOpen(open: boolean): void {
		if (!open && !isDesktop) closeLibraryPanel();
	}
</script>

{#snippet panel(section: { id: LibrarySection; label: string; count: number })}
	<div class="flex min-h-0 flex-1 flex-col">
		<div
			class="flex shrink-0 items-center justify-between gap-2 border-b border-border/30 px-4 py-3"
		>
			<div class="flex items-center gap-2">
				<h2 class="text-base font-semibold tracking-tight">{section.label}</h2>
				{#if section.count > 0}
					<span
						class="inline-flex items-center justify-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium"
					>
						{section.count}
					</span>
				{/if}
			</div>
			<IconButton
				tooltip="Close library"
				variant="ghost"
				size="icon-sm"
				side="left"
				onclick={handleClosePanel}
			>
				<X class="size-4" />
			</IconButton>
		</div>

		<div class="min-h-0 flex-1 overflow-y-auto p-4">
			{#if section.id === 'palette'}
				<ChordPalette onDropSettled={handleDropSettled} />
			{:else}
				<SavedProgressions
					progressions={progressionState.savedProgressions.items}
					onLoad={onLoadProgression}
					onDelete={onDeleteProgression}
					onExport={onExportProgression}
				/>
			{/if}
		</div>
	</div>
{/snippet}

<div
	bind:this={containerEl}
	class="sticky top-0 flex shrink-0 items-start gap-2 self-start"
	ondragleave={handleDragLeave}
	role="complementary"
	aria-label="Library"
>
	{#if isDesktop && activeSection}
		<aside
			class="glass-subtle flex h-[calc(100vh-8.5rem)] w-72 flex-col rounded-lg border border-sidebar-border/30 bg-sidebar/50 xl:w-80"
		>
			{@render panel(activeSection)}
		</aside>
	{/if}

	<div
		class="glass-subtle flex w-12 shrink-0 flex-col items-center gap-1 rounded-lg border border-sidebar-border/30 bg-sidebar/50 p-1.5"
		ondragover={handleRailDragOver}
		ondrop={handleRailDrop}
		role="region"
		aria-label="Library sections"
		data-tour="library"
	>
		{#each sections as section (section.id)}
			{@const Icon = section.icon}
			<button
				type="button"
				class="flex w-full cursor-pointer flex-col items-center gap-0.5 rounded-md py-2 transition-colors {openSection ===
				section.id
					? 'bg-accent text-accent-foreground'
					: 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'}"
				aria-expanded={openSection === section.id}
				aria-label="{section.label} ({section.count})"
				data-library-section={section.id}
				title={section.label}
				onclick={() => toggleLibraryPanel(section.id)}
			>
				<Icon class="size-4" />
				<span class="text-[10px] font-medium tabular-nums">{section.count}</span>
			</button>
		{/each}
	</div>

	<Dialog.Root bind:open={getDrawerOpen, setDrawerOpen}>
		{#if !isDesktop && activeSection}
			<Dialog.Content
				bind:ref={drawerEl}
				ondragleave={handleDragLeave}
				overlayProps={{ onclick: closeLibraryPanel, 'aria-label': 'Dismiss library' }}
				showCloseButton={false}
				class="start-auto right-0 top-0 h-full w-[85vw] max-w-sm translate-x-0 translate-y-0 gap-0 rounded-none border-y-0 border-r-0 border-l border-sidebar-border/30 bg-sidebar p-0 shadow-xl sm:max-w-sm"
			>
				<Dialog.Title class="sr-only">{activeSection.label} library</Dialog.Title>
				{@render panel(activeSection)}
			</Dialog.Content>
		{/if}
	</Dialog.Root>
</div>
