<script lang="ts">
	/**
	 * The quality field: every chord quality laid out on the simple→dense gradient, browsable by
	 * click or by pressing and sweeping across it. Nothing is hidden behind tiers or a "more"
	 * control — full visibility is what lets someone stumble onto a sound they were not looking for,
	 * so this is deliberately the one dense area of an otherwise calm screen.
	 *
	 * Gesture arbitration lives in `quality-sweep.ts`; this component only supplies hit testing and
	 * reacts to the callbacks.
	 */
	import {
		createCandidateChord,
		progressionState,
		stageCandidate,
		selectQuality
	} from '#lib/stores/progression.svelte.ts';
	import { uiState } from '#lib/stores/ui.svelte.ts';
	import { QUALITY_GRADIENT } from '#lib/utils/theory-engine/constants.ts';
	import type { Chord, ChordQuality } from '#lib/utils/theory-engine/types.ts';
	import {
		auditionChord,
		cancelAudition,
		resolveTargetSlot
	} from '#lib/utils/audition-controller.ts';
	import { isQualityValidForScaleDegree } from '#lib/utils/scale-helper.ts';
	import { createSweepSession } from '#lib/utils/quality-sweep.ts';
	import DraggableChordButton from './DraggableChordButton.svelte';

	interface Props {
		/** Notes of the active scale; empty when no scale is set */
		scaleNotes: string[];
	}

	let { scaleNotes }: Props = $props();

	let fieldEl = $state<HTMLDivElement | null>(null);

	/** Quality the sweep is currently over — highlighted even when the audition is suppressed */
	let sweptQuality = $state<string | null>(null);

	/** Pointer the current gesture belongs to, so a second finger cannot hijack it */
	let activePointerId: number | null = null;

	/** Set when a sweep committed, so the click the browser fires on release is swallowed */
	let swallowNextClick = false;

	/**
	 * Build the candidate chord for a quality. Performance settings stay at builder defaults; the
	 * ones that belong to an occupied slot are applied when a candidate is staged, not here.
	 * @param quality - Quality being auditioned
	 * @param root - Builder's current root
	 */
	function buildCandidate(quality: ChordQuality, root: number, targetSlot: number): Chord {
		return createCandidateChord(root, quality, targetSlot);
	}

	const sweep = createSweepSession({
		hitTest(x, y) {
			if (!fieldEl) return { inField: false, quality: null };

			const rect = fieldEl.getBoundingClientRect();
			const inField = x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
			if (!inField) return { inField: false, quality: null };

			// The gaps between buttons are still inside the field — they just have nothing to sound
			const button = document.elementFromPoint(x, y)?.closest('[data-quality]');
			return { inField: true, quality: button?.getAttribute('data-quality') ?? null };
		},

		onSweepStart() {
			if (activePointerId !== null) fieldEl?.setPointerCapture(activePointerId);
		},

		onCross(quality) {
			// Highlight regardless of the result: while the loop plays the audition comes back
			// 'suppressed' and the visual is the only feedback the browse gets
			sweptQuality = quality;

			const root = progressionState.builderState.selectedRoot;
			if (root === null || uiState.transportActive) return;

			const targetSlot = resolveTargetSlot();
			auditionChord(buildCandidate(quality as ChordQuality, root, targetSlot), {
				mode: 'sweep',
				targetSlot
			});
		},

		onCommit(quality, { swept }) {
			sweptQuality = null;
			swallowNextClick = true;
			const committedQuality = quality as ChordQuality;

			// A sweep that never left its button sounded nothing, and the click it would have been
			// may not reach the button under pointer capture, so play it as that click here
			if (!swept) {
				handleQualityClick(committedQuality);
				return;
			}
			selectQuality(committedQuality);

			const root = progressionState.builderState.selectedRoot;
			if (uiState.transportActive && uiState.selectedSlot !== null && root !== null) {
				stageCandidate(
					uiState.selectedSlot,
					buildCandidate(committedQuality, root, uiState.selectedSlot)
				);
			}
		},

		onCancel() {
			sweptQuality = null;
			cancelAudition();
		}
	});

	/**
	 * Hand back pointer capture and forget the gesture's pointer
	 */
	function endPointerTracking(): void {
		if (activePointerId !== null && fieldEl?.hasPointerCapture(activePointerId)) {
			fieldEl.releasePointerCapture(activePointerId);
		}
		activePointerId = null;
	}

	/**
	 * Read the quality a DOM node belongs to
	 * @param target - Event target to walk up from
	 */
	function qualityOf(target: EventTarget | null): string | null {
		const button = (target as Element | null)?.closest('[data-quality]');
		return button?.getAttribute('data-quality') ?? null;
	}

	function handlePointerDown(e: PointerEvent) {
		// One gesture at a time. A second finger landing mid-sweep must be ignored outright: taking
		// it would retarget `activePointerId` and re-press the session, so the first pointer's
		// audition would run on unrecalled while the second one decided what got selected.
		// Secondary mouse buttons never sweep either.
		if (activePointerId !== null || !e.isPrimary || e.button !== 0) return;

		// A fresh press invalidates a swallow left over from a release the click never followed
		swallowNextClick = false;

		// There is no candidate to audition without a root
		if (progressionState.builderState.selectedRoot === null) return;

		const quality = qualityOf(e.target);
		if (quality === null) return;

		activePointerId = e.pointerId;
		sweep.press(e.clientX, e.clientY, quality, e.timeStamp);
	}

	function handlePointerMove(e: PointerEvent) {
		if (e.pointerId !== activePointerId) return;
		sweep.move(e.clientX, e.clientY, e.timeStamp);
	}

	function handlePointerUp(e: PointerEvent) {
		if (e.pointerId !== activePointerId) return;

		sweep.release();
		endPointerTracking();
	}

	function handlePointerCancel(e: PointerEvent) {
		if (e.pointerId !== activePointerId) return;

		sweep.cancel();
		endPointerTracking();
	}

	/**
	 * Arbitrate between the sweep and the native drag-to-canvas. Runs in the capture phase so a
	 * suppressed drag never reaches `DraggableChordButton` and never builds a drag preview.
	 */
	function handleDragStartCapture(e: DragEvent) {
		if (sweep.shouldAllowDrag(e.clientX, e.clientY, e.timeStamp)) {
			// The drag owns the gesture from here; releasing capture lets it track the pointer
			endPointerTracking();
			return;
		}

		e.preventDefault();
		e.stopPropagation();
	}

	/**
	 * Swallow the click the browser synthesises when a sweep starts and ends on the same button —
	 * the sweep has already selected and auditioned, and the click path would do it again with a
	 * chained preview on top.
	 */
	function handleClickCapture(e: MouseEvent) {
		if (!swallowNextClick) return;

		swallowNextClick = false;
		e.preventDefault();
		e.stopPropagation();
	}

	/**
	 * Click browsing: select the quality and preview it with its harmonic context
	 * @param quality - Quality that was clicked
	 */
	function handleQualityClick(quality: ChordQuality) {
		selectQuality(quality);

		const root = progressionState.builderState.selectedRoot;
		if (root === null) return;

		const targetSlot = resolveTargetSlot();
		const candidate = buildCandidate(quality, root, targetSlot);
		if (uiState.transportActive && uiState.selectedSlot !== null) {
			stageCandidate(uiState.selectedSlot, candidate);
			return;
		}

		auditionChord(candidate, { mode: 'click', targetSlot });
	}

	function handleWindowBlur() {
		sweep.cancel();
		endPointerTracking();
	}
</script>

<!--
	Release and cancel are heard on the window: a pending press has no pointer capture, so a release
	outside the field would otherwise never reach it and leave the gesture's pointer tracked forever.
-->
<svelte:window
	onblur={handleWindowBlur}
	onpointerup={handlePointerUp}
	onpointercancel={handlePointerCancel}
/>

<div class="space-y-2">
	<div class="flex items-baseline justify-between gap-3">
		<h3 class="text-sm font-medium text-muted-foreground">Quality</h3>
		<p class="text-xs text-muted-foreground">
			Press &amp; sweep to browse (auditions while stopped) • Hold to drag
		</p>
	</div>

	<!--
		The padding is part of the field on purpose: it gives the sweep a margin of error at the
		edges, so drifting a few pixels off the outer buttons does not read as leaving. The gradient
		ramp is decorative — it reinforces the ordering in reading order without labelling it.
	-->
	<div
		bind:this={fieldEl}
		data-quality-grid
		data-tour="quality"
		role="group"
		aria-label="Chord qualities, simple to dense"
		class="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2 p-2 rounded-lg select-none touch-pan-y bg-gradient-to-br from-transparent via-primary/[0.03] to-primary/[0.08]"
		onpointerdown={handlePointerDown}
		onpointermove={handlePointerMove}
		ondragstartcapture={handleDragStartCapture}
		onclickcapture={handleClickCapture}
	>
		{#each QUALITY_GRADIENT as quality (quality)}
			{@const inScale =
				progressionState.builderState.selectedRoot !== null
					? isQualityValidForScaleDegree(
							progressionState.builderState.selectedRoot,
							quality as ChordQuality,
							scaleNotes
						)
					: true}
			<DraggableChordButton
				quality={quality as ChordQuality}
				root={progressionState.builderState.selectedRoot}
				isSelected={progressionState.builderState.selectedQuality === quality}
				isInScale={!progressionState.scaleFilterEnabled || inScale}
				isSwept={sweptQuality === quality || uiState.browseQuality === quality}
				onclick={() => handleQualityClick(quality as ChordQuality)}
			/>
		{/each}
	</div>

	<div
		class="flex justify-between text-[10px] uppercase tracking-[0.08em] text-muted-foreground/70"
		aria-hidden="true"
	>
		<span>◀ simple</span>
		<span>dense ▶</span>
	</div>
</div>
