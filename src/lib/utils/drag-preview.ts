/**
 * Drag Preview
 * A custom drag image: the browser snapshots an element at dragstart, so the element only has to
 * exist for that moment. It is rendered off-screen and removed on the next task.
 */

interface DragPreviewOptions {
	/** Element to render (a button preview matches the builder's chord buttons) */
	tag?: 'div' | 'button';
	/** Classes that style the preview */
	className: string;
	/** Hold the preview by its centre instead of its top-left corner */
	centered?: boolean;
}

/**
 * Use a styled label as the drag image for the drag that is starting
 * @param dataTransfer - The dragstart event's data transfer
 * @param label - Text to show (the chord name)
 * @param options - Element, styling and grab point
 */
export function setDragPreview(
	dataTransfer: DataTransfer,
	label: string,
	{ tag = 'div', className, centered = false }: DragPreviewOptions
): void {
	const preview = document.createElement(tag);
	preview.textContent = label;
	preview.className = className;
	// Off-screen but laid out, so it has a size to snapshot
	preview.style.cssText = 'position: fixed; top: -1000px; left: 0;';
	document.body.appendChild(preview);

	dataTransfer.setDragImage(
		preview,
		centered ? preview.offsetWidth / 2 : 0,
		centered ? preview.offsetHeight / 2 : 0
	);
	setTimeout(() => preview.remove(), 0);
}
