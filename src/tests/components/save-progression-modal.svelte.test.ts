/** Mounted Save dialog: saving waits for the caller, keeps pending tags, and suggestions work by keyboard. */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushSync, mount, tick, unmount } from 'svelte';
import SaveProgressionModal from '#lib/components/SaveProgressionModal.svelte';

let target: HTMLElement;
let component: Record<string, unknown> | null = null;

type OnSave = (name: string, tags: string[]) => boolean | void | Promise<boolean | void>;

async function render(onSave: OnSave, availableTags: string[] = []): Promise<void> {
	target = document.createElement('div');
	document.body.appendChild(target);
	component = mount(SaveProgressionModal, { target, props: { open: true, availableTags, onSave } });
	flushSync();
	await tick();
}

function input(id: string): HTMLInputElement {
	const element = document.getElementById(id) as HTMLInputElement | null;
	if (!element) throw new Error(`#${id} not rendered`);
	return element;
}

function type(id: string, value: string): void {
	const element = input(id);
	element.focus();
	element.value = value;
	element.dispatchEvent(new Event('input', { bubbles: true }));
	flushSync();
}

function key(id: string, keyName: string): void {
	input(id).dispatchEvent(new KeyboardEvent('keydown', { key: keyName, bubbles: true }));
	flushSync();
}

function saveButton(): HTMLButtonElement {
	const button = [...document.querySelectorAll('button')].find(
		(candidate) => candidate.textContent?.trim() === 'Save Progression'
	);
	if (!button) throw new Error('Save button not rendered');
	return button;
}

async function settle(): Promise<void> {
	await Promise.resolve();
	await tick();
	flushSync();
}

describe('SaveProgressionModal', () => {
	afterEach(() => {
		if (component) unmount(component);
		component = null;
		target?.remove();
	});

	it('keeps the entered name and tags when saving fails', async () => {
		const onSave = vi.fn(async () => false);
		await render(onSave);
		type('progression-name', 'Late night');
		type('tag-input', 'Lofi');
		key('tag-input', 'Enter');

		saveButton().click();
		await settle();

		expect(onSave).toHaveBeenCalledWith('Late night', ['lofi']);
		expect(input('progression-name').value).toBe('Late night');
		expect(document.body.textContent).toContain('lofi');
	});

	it('resets the form only after a save succeeds, and blocks a second submit meanwhile', async () => {
		let resolveSave!: (saved: boolean) => void;
		const onSave = vi.fn(() => new Promise<boolean>((resolve) => (resolveSave = resolve)));
		await render(onSave);
		type('progression-name', 'Late night');

		saveButton().click();
		flushSync();
		expect(input('progression-name').value).toBe('Late night');
		expect(saveButton().disabled).toBe(true);
		saveButton().click();
		// A disabled button ignores click() anyway; Enter in the name field reaches handleSave
		key('progression-name', 'Enter');
		await settle();
		expect(onSave).toHaveBeenCalledOnce();

		resolveSave(true);
		await settle();
		expect(input('progression-name').value).toBe('');
	});

	it('locks the form and dismissal while a save is pending', async () => {
		let resolveSave!: (saved: boolean) => void;
		const onSave = vi.fn(() => new Promise<boolean>((resolve) => (resolveSave = resolve)));
		await render(onSave);
		type('progression-name', 'Late night');

		saveButton().click();
		flushSync();

		const cancel = [...document.querySelectorAll('button')].find(
			(candidate) => candidate.textContent?.trim() === 'Cancel'
		);
		expect(input('progression-name').matches(':disabled')).toBe(true);
		expect(input('tag-input').matches(':disabled')).toBe(true);
		expect(cancel?.disabled).toBe(true);

		// Escape would normally close the dialog; while saving it must not
		document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		await settle();
		expect(document.querySelector('[data-slot="dialog-content"]')).not.toBeNull();

		resolveSave(true);
		await settle();
		expect(input('progression-name').matches(':disabled')).toBe(false);
	});

	it('includes a typed tag that was never added', async () => {
		const onSave = vi.fn(async () => true);
		await render(onSave);
		type('progression-name', 'Late night');
		type('tag-input', 'Jazz');
		key('tag-input', 'Enter');
		type('tag-input', '  Chill ');

		saveButton().click();
		await settle();

		expect(onSave).toHaveBeenCalledWith('Late night', ['jazz', 'chill']);
	});

	it('does not duplicate a pending tag that was already added', async () => {
		const onSave = vi.fn(async () => true);
		await render(onSave);
		type('progression-name', 'Late night');
		type('tag-input', 'jazz');
		key('tag-input', 'Enter');
		type('tag-input', 'JAZZ');

		saveButton().click();
		await settle();

		expect(onSave).toHaveBeenCalledWith('Late night', ['jazz']);
	});

	it('lets the keyboard move through and pick a tag suggestion', async () => {
		await render(vi.fn(), ['jazz', 'jazzy', 'lofi']);
		type('tag-input', 'ja');
		const tagInput = input('tag-input');

		expect(tagInput.getAttribute('role')).toBe('combobox');
		expect(tagInput.getAttribute('aria-expanded')).toBe('true');
		const options = document.querySelectorAll('[role="listbox"] [role="option"]');
		expect(options).toHaveLength(2);

		key('tag-input', 'ArrowDown');
		key('tag-input', 'ArrowDown');
		const active = tagInput.getAttribute('aria-activedescendant');
		expect(active).toBe(options[1].id);
		expect(options[1].getAttribute('aria-selected')).toBe('true');

		key('tag-input', 'Enter');

		expect(tagInput.value).toBe('');
		expect(document.querySelector('[aria-label="Remove jazzy"]')).not.toBeNull();
	});

	it('closes the suggestions on Escape without picking one', async () => {
		await render(vi.fn(), ['jazz']);
		type('tag-input', 'ja');
		key('tag-input', 'ArrowDown');

		key('tag-input', 'Escape');

		expect(document.querySelector('[role="listbox"]')).toBeNull();
		expect(input('tag-input').getAttribute('aria-expanded')).toBe('false');
		expect(input('tag-input').value).toBe('ja');
	});

	it('still picks a suggestion with the mouse', async () => {
		await render(vi.fn(), ['jazz']);
		type('tag-input', 'ja');

		const option = document.querySelector('[role="option"]');
		option?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
		flushSync();

		expect(document.querySelector('[aria-label="Remove jazz"]')).not.toBeNull();
	});

	it('ignores a right or middle mousedown on a suggestion', async () => {
		await render(vi.fn(), ['jazz']);
		type('tag-input', 'ja');

		const option = document.querySelector('[role="option"]');
		for (const button of [1, 2]) {
			option?.dispatchEvent(
				new MouseEvent('mousedown', { bubbles: true, cancelable: true, button })
			);
			flushSync();
		}

		expect(document.querySelector('[aria-label="Remove jazz"]')).toBeNull();
		expect(input('tag-input').value).toBe('ja');
	});

	it('picks a suggestion from a click with no mousedown (screen reader activation)', async () => {
		await render(vi.fn(), ['jazz']);
		type('tag-input', 'ja');

		document.querySelector<HTMLElement>('[role="option"]')?.click();
		flushSync();

		expect(document.querySelector('[aria-label="Remove jazz"]')).not.toBeNull();
		expect(input('tag-input').value).toBe('');
	});

	it('adds a suggestion once when both mousedown and click fire', async () => {
		const onSave = vi.fn(async () => true);
		await render(onSave, ['jazz']);
		type('progression-name', 'Late night');
		type('tag-input', 'ja');

		const option = document.querySelector<HTMLElement>('[role="option"]');
		option?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
		option?.click();
		flushSync();

		expect(document.querySelectorAll('[aria-label="Remove jazz"]')).toHaveLength(1);
		saveButton().click();
		await settle();
		expect(onSave).toHaveBeenCalledWith('Late night', ['jazz']);
	});
});
