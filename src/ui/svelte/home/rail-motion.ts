/**
 * How the rail and the page move when the rail collapses or expands.
 *
 * The page's column takes its new width in one frame, so its charts and its
 * `@container` layouts settle once, before anything moves. What moves is
 * transforms: the rail's edge, and each block of the page sliding from where
 * it was to where it now is.
 */

/** The rail's move. `--rail-move` in AreaRail.svelte is the same, for its CSS transitions. */
export const RAIL_MOTION: KeyframeAnimationOptions = { duration: 200, easing: "cubic-bezier(0.2, 0, 0, 1)" };

/** The reader asked for less motion: everything lands at once. */
export const calm = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** The page before the move: its column's left edge, and each block's. */
export interface PageBefore {
	main: HTMLElement;
	left: number;
	blocks: [HTMLElement, number][];
}

/**
 * The page's blocks: what sits narrower than the column. A child as wide as the
 * column is a wrapper, looked into instead, so a centred body moves half as far
 * as the rail and a bar's Sync button, on the right edge, doesn't move at all.
 */
export function measureBlocks(main: HTMLElement): PageBefore {
	const { left, width: column } = main.getBoundingClientRect();
	const blocks: PageBefore["blocks"] = [];
	const walk = (parent: Element, depth: number) => {
		for (const child of Array.from(parent.children)) {
			if (!child.instanceOf(HTMLElement)) continue;
			const box = child.getBoundingClientRect();
			if (box.width === 0) {
				// No box of its own; its children are laid out in the parent's.
				if (getComputedStyle(child).display === "contents") walk(child, depth);
				continue;
			}
			// A row that clips its content (the tabs, a carousel) moves whole, or what slides inside it is cut off.
			const wrapper = box.width >= column - 1 && depth < 4 && getComputedStyle(child).overflowX === "visible";
			if (wrapper) walk(child, depth + 1);
			else blocks.push([child, box.left]);
		}
	};
	walk(main, 0);
	return { main, left, blocks };
}

/**
 * Each block slides from where it was to where it is: no layout, only a
 * transform. A block that moved further than the column did, or the other way,
 * took a new place in a new layout (a row of controls wrapping, say): it lands
 * there rather than sweeping across the page.
 */
export function slideBlocks({ main, left, blocks }: PageBefore): Animation[] {
	const shift = main.getBoundingClientRect().left - left;
	const moves: Animation[] = [];
	for (const [block, before] of blocks) {
		if (!block.isConnected) continue;
		const moved = block.getBoundingClientRect().left - before;
		if (Math.abs(moved) < 1 || moved * shift < 0 || Math.abs(moved) > Math.abs(shift) + 1) continue;
		const dx = -moved;
		// Added to the block's own transform, which stays.
		moves.push(
			block.animate([{ transform: `translateX(${dx}px)` }, { transform: "translateX(0)" }], {
				...RAIL_MOTION,
				composite: "add",
			}),
		);
	}
	return moves;
}
