/**
 * Page-shell coverage for the final information hierarchy. This intentionally mounts the real
 * page so the rail remains the workspace's second column and its fixed mobile drawer has no
 * transformed or filtered page ancestor.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushSync, mount, tick, unmount } from 'svelte';
import { addChord, clearProgression } from '#lib/stores/progression.svelte.ts';
import { resetUIState, selectSlot } from '#lib/stores/ui.svelte.ts';
import PageHarness from './PageHarness.svelte';

vi.mock('#lib/app-init.ts', () => ({
	initializeApplication: vi.fn().mockResolvedValue(undefined)
}));

// Page tests act as a returning visitor; the tour has its own coverage
vi.mock('#lib/utils/onboarding-tour.ts', () => ({
	shouldAutoStartTour: vi.fn(() => false),
	startTour: vi.fn()
}));

vi.mock('#lib/utils/audio-playback.ts', async (importOriginal) => ({
	...(await importOriginal<typeof import('#lib/utils/audio-playback.ts')>()),
	stopLoopingPlayback: vi.fn(),
	disposeAudio: vi.fn()
}));

let target: HTMLElement;
let component: Record<string, unknown> | null = null;

async function renderPage(): Promise<void> {
	target = document.createElement('div');
	document.body.appendChild(target);
	component = mount(PageHarness, { target });
	flushSync();
	await tick();
}

function region(name: string): HTMLElement {
	const element = target.querySelector<HTMLElement>(`[data-layout-region="${name}"]`);
	if (!element) throw new Error(`${name} layout region was not rendered`);
	return element;
}

const CONTAINING_BLOCK_CLASS =
	/^(?:transform(?:-(?:gpu|cpu|none))?|-?translate(?:-[xy])?-.+|-?scale(?:-[xy])?-.+|-?rotate-.+|perspective(?:-.+)?|filter(?:-.+)?|blur-.+|-?(?:brightness|contrast|drop-shadow|grayscale|hue-rotate|invert|saturate|sepia)(?:-.+)?|-?backdrop-(?:filter|blur|brightness|contrast|drop-shadow|grayscale|hue-rotate|invert|opacity|saturate|sepia)(?:-.+)?|contain(?:-.+)?|will-change-(?:transform|filter|contents)|content-(?:auto|visibility-.+)|\[(?:transform|translate|scale|rotate|perspective|filter|backdrop-filter|contain|will-change|content-visibility):.+\])$/;

/** Remove responsive/state variants without splitting colons inside arbitrary values. */
function baseUtility(className: string): string {
	let bracketDepth = 0;
	let lastVariantSeparator = -1;

	for (let index = 0; index < className.length; index += 1) {
		const character = className[index];
		if (character === '[') bracketDepth += 1;
		if (character === ']') bracketDepth -= 1;
		if (character === ':' && bracketDepth === 0) lastVariantSeparator = index;
	}

	return className.slice(lastVariantSeparator + 1);
}

function containingBlockClasses(element: HTMLElement): string[] {
	return [...element.classList].filter((className) =>
		CONTAINING_BLOCK_CLASS.test(baseUtility(className))
	);
}

/** Properties that make a fixed descendant relative to an ancestor instead of the viewport. */
const CONTAINING_BLOCK_PROPERTIES = [
	'transform',
	'translate',
	'scale',
	'rotate',
	'perspective',
	'filter',
	'backdrop-filter',
	'contain',
	'will-change',
	'content-visibility'
] as const;

function activeContainingBlockProperties(style: CSSStyleDeclaration): string[] {
	return CONTAINING_BLOCK_PROPERTIES.filter((property) => {
		const value = style.getPropertyValue(property).trim();
		// `visible` is content-visibility's initial value, which jsdom 30+ reports in computed styles
		return (
			value !== '' &&
			value !== 'none' &&
			value !== 'auto' &&
			value !== 'normal' &&
			value !== 'visible'
		);
	});
}

describe('page information hierarchy', () => {
	beforeEach(() => {
		clearProgression();
		resetUIState();
	});

	afterEach(() => {
		if (component) unmount(component);
		component = null;
		target?.remove();
		clearProgression();
		resetUIState();
		Reflect.deleteProperty(window, 'matchMedia');
	});

	it('assembles header, builder, playback canvas, rail, and page footer in order', async () => {
		await renderPage();

		const header = region('header');
		const workspace = region('workspace');
		const mainColumn = region('main-column');
		const builder = region('builder');
		const canvas = region('playback-canvas-inspector');
		const footer = region('page-footer');
		const rail = workspace.querySelector<HTMLElement>(':scope > [role="complementary"]');

		expect(header.textContent).toContain('Bare Minimum Theory');
		expect(workspace.children[0]).toBe(mainColumn);
		expect(workspace.children[1]).toBe(rail);
		expect(mainColumn.children[0]).toBe(builder);
		expect(mainColumn.children[1]).toBe(canvas);
		expect(footer.tagName).toBe('FOOTER');
		expect(workspace.compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(
			0
		);
	});

	it('keeps containing-block classes and styles off every rail ancestor', async () => {
		await renderPage();

		// Pin the matcher itself so future regressions cannot hide behind a missed Tailwind family.
		for (const dangerousClass of [
			'transform',
			'transform-gpu',
			'md:translate-x-1',
			'-translate-y-1/2',
			'scale-95',
			'hover:rotate-1',
			'perspective-distant',
			'filter',
			'blur-sm',
			'brightness-110',
			'lg:contrast-125',
			'drop-shadow-md',
			'grayscale',
			'hover:hue-rotate-15',
			'invert',
			'saturate-150',
			'sepia',
			'backdrop-blur-sm',
			'backdrop-brightness-110',
			'focus:backdrop-contrast-125',
			'backdrop-drop-shadow-md',
			'backdrop-grayscale',
			'md:backdrop-hue-rotate-15',
			'backdrop-invert',
			'backdrop-saturate-150',
			'backdrop-sepia',
			'contain-paint',
			'will-change-transform',
			'content-auto',
			'[transform:translateZ(0)]'
		]) {
			expect(CONTAINING_BLOCK_CLASS.test(baseUtility(dangerousClass))).toBe(true);
		}

		const rail = target.querySelector<HTMLElement>('[role="complementary"][aria-label="Library"]');
		expect(rail).not.toBeNull();

		let ancestor: HTMLElement | null = rail;
		while (ancestor && ancestor !== document.body) {
			expect(containingBlockClasses(ancestor)).toEqual([]);
			expect(activeContainingBlockProperties(ancestor.style)).toEqual([]);
			expect(activeContainingBlockProperties(getComputedStyle(ancestor))).toEqual([]);
			ancestor = ancestor.parentElement;
		}
	});

	it('renders every element the onboarding tour points at', async () => {
		const { buildTourSteps } = await vi.importActual<
			typeof import('#lib/utils/onboarding-tour.ts')
		>('#lib/utils/onboarding-tour.ts');
		const steps = buildTourSteps({
			prepareInspector: async () => {},
			seededDemo: () => false
		});
		const selectors = steps
			.filter((step) => typeof step.element === 'string' && !step.skipMissingElement)
			.map((step) => step.element as string);

		addChord({
			root: 60,
			quality: 'maj7',
			inversion: 0,
			voicing: 'close',
			octave: 0,
			duration: '1m'
		});
		await renderPage();
		// The inspector and Randomize steps run with a chord selected; the tour selects one first
		selectSlot(0);
		flushSync();
		await tick();

		expect(selectors.length).toBeGreaterThan(5);
		for (const selector of selectors) {
			expect(target.querySelector(selector), selector).not.toBeNull();
		}
	});
});
