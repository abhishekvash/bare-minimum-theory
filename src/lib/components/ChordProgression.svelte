<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import ChordBlock from '$lib/components/ChordBlock.svelte';
	import {
		progressionState,
		insertChordAt,
		MAX_PROGRESSION_SLOTS
	} from '$lib/stores/progression.svelte';
	import type { Chord } from '$lib/utils/theory-engine';
	import { playProgression } from '$lib/utils/audio-playback';
	import { exportToMIDI } from '$lib/utils/midi-export';
	import Play from 'lucide-svelte/icons/play';
	import Download from 'lucide-svelte/icons/download';
	import Info from 'lucide-svelte/icons/info';

	const slotIndices = Array.from({ length: MAX_PROGRESSION_SLOTS }, (_, index) => index);
	let activeDropIndex: number | null = null;

	function parseChordPayload(payload: string): Chord | null {
		try {
			const data = JSON.parse(payload);
			if (
				typeof data.root !== 'number' ||
				typeof data.quality !== 'string' ||
				typeof data.inversion !== 'number' ||
				typeof data.voicing !== 'string'
			) {
				return null;
			}
			return data as Chord;
		} catch (error) {
			console.warn('Failed to parse dropped chord', error);
			return null;
		}
	}

	function handleDragOver(event: DragEvent, index: number) {
		event.preventDefault();
		if (event.dataTransfer) {
			event.dataTransfer.dropEffect = 'copy';
		}
		activeDropIndex = index;
	}

	function handleDragLeave(index: number) {
		if (activeDropIndex === index) {
			activeDropIndex = null;
		}
	}

	function handleDrop(event: DragEvent, index: number) {
		event.preventDefault();
		const payload = event.dataTransfer?.getData('application/json');
		activeDropIndex = null;
		if (!payload) return;

		const chord = parseChordPayload(payload);
		if (!chord) return;

		insertChordAt(index, chord);
	}

	async function handlePlayClick() {
		await playProgression([...progressionState.progression]);
	}

	function handleExportClick() {
		exportToMIDI([...progressionState.progression]);
	}

	function getDropZoneClasses(index: number, hasChord: boolean): string {
		const isActive = activeDropIndex === index;
		const base = 'rounded-2xl border-2 border-dashed p-3 transition min-h-[140px] flex items-stretch';
		if (hasChord) {
			return `${base} border-border bg-card`;
		}
		return `${base} ${isActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/30'}`;
	}
</script>

<section class="space-y-6" aria-label="Chord progression canvas">
	<div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
		<div>
			<h2 class="text-2xl font-semibold tracking-tight">Progression</h2>
			<p class="text-sm text-muted-foreground">Drag chords into any slot, tweak them, then play or export.</p>
		</div>
		<div class="flex flex-wrap gap-2">
			<Button
				onclick={handlePlayClick}
				disabled={progressionState.progression.length === 0}
				class="gap-2"
			>
				<Play class="size-4" />
				<span>Play</span>
			</Button>
			<Button
				variant="outline"
				onclick={handleExportClick}
				disabled={progressionState.progression.length === 0}
				class="gap-2"
			>
				<Download class="size-4" />
				<span>Export MIDI</span>
			</Button>
		</div>
	</div>

	<div class="grid gap-4 md:grid-cols-2">
		{#each slotIndices as slotIndex}
			{@const chord = progressionState.progression[slotIndex]}
			<div
				class={getDropZoneClasses(slotIndex, Boolean(chord))}
				on:dragover={(event) => handleDragOver(event, slotIndex)}
				on:dragenter={(event) => handleDragOver(event, slotIndex)}
				on:dragleave={() => handleDragLeave(slotIndex)}
				on:drop={(event) => handleDrop(event, slotIndex)}
				role="button"
				tabindex="0"
				aria-label={`Chord slot ${slotIndex + 1}`}
			>
				{#if chord}
					<ChordBlock chord={chord} index={slotIndex} />
				{:else}
					<div class="flex w-full flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
						<Info class="size-4" />
						<p>Drop a chord here</p>
						<p class="text-xs">Slot {slotIndex + 1} of {MAX_PROGRESSION_SLOTS}</p>
					</div>
				{/if}
			</div>
		{/each}
	</div>
</section>
