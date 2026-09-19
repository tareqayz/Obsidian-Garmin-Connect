import {
	DEFAULT_CARD_OPTIONS,
	DEFAULT_LAYOUT_ID,
	WIDE_CARDS,
	blockId,
	layoutIdFor,
	layoutOf,
	shippedLayout,
	templateLayout,
	type Layout,
	type LayoutBlock,
	type LayoutsState,
	type WidgetHeight,
	type WidgetWidth,
} from "./layouts";

/**
 * Every change a layout can undergo, as a pure function of the whole state.
 *
 * Immutable on purpose: the dashboard holds `LayoutsState` in a `$state` rune
 * and hands each new value straight to `PluginData.saveLayouts`, so there is
 * no separate save step to forget and no half-applied edit to recover from.
 * Keeping them here rather than in the component is also what makes them
 * testable without mounting anything.
 */

/**
 * Copy the shipped blocks into storage before the first edit to them.
 *
 * Until this runs, `default` deliberately has nothing behind it so that a
 * release adding a card adds it to everyone's dashboard. The moment someone
 * arranges it themselves that stops being true for them, which is the trade
 * they just made.
 */
export function materialise(state: LayoutsState, id: string): LayoutsState {
	if (state.byId[id]) return state;
	return { ...state, byId: { ...state.byId, [id]: layoutOf(state, id) } };
}

function edit(state: LayoutsState, id: string, fn: (layout: Layout) => Layout): LayoutsState {
	const ready = materialise(state, id);
	const layout = ready.byId[id];
	if (!layout) return state;
	return { ...ready, byId: { ...ready.byId, [id]: fn(layout) } };
}

const withBlocks = (layout: Layout, blocks: LayoutBlock[]): Layout => ({ ...layout, blocks });

/* ------------------------------------------------------------------ */
/*  Blocks                                                             */
/* ------------------------------------------------------------------ */

export function cardBlock(card: string): LayoutBlock {
	const wide = WIDE_CARDS.has(card);
	return {
		type: "card",
		id: blockId("card"),
		card,
		width: wide ? 4 : 2,
		height: wide ? "M" : "S",
		options: { ...DEFAULT_CARD_OPTIONS },
	};
}

export function sectionBlock(title: string): LayoutBlock {
	return { type: "section", id: blockId("section"), title };
}

/** Insert at `index`, or at the end when it is out of range. */
export function addBlock(
	state: LayoutsState,
	id: string,
	block: LayoutBlock,
	index?: number,
): LayoutsState {
	return edit(state, id, (layout) => {
		const blocks = [...layout.blocks];
		const at = index === undefined || index < 0 || index > blocks.length ? blocks.length : index;
		blocks.splice(at, 0, block);
		return withBlocks(layout, blocks);
	});
}

/**
 * Remove a block — and, for a section heading, only the heading.
 *
 * Deleting the widgets underneath it would be a lot of destruction behind one
 * ✕, and they are perfectly meaningful in the section above.
 */
export function removeBlock(state: LayoutsState, id: string, block: string): LayoutsState {
	return edit(state, id, (layout) =>
		withBlocks(layout, layout.blocks.filter((b) => b.id !== block)),
	);
}

/** Move a block to sit at `toIndex` in the list as it looks once removed. */
export function moveBlock(
	state: LayoutsState,
	id: string,
	block: string,
	toIndex: number,
): LayoutsState {
	return edit(state, id, (layout) => {
		const from = layout.blocks.findIndex((b) => b.id === block);
		if (from === -1) return layout;
		const blocks = [...layout.blocks];
		const [moved] = blocks.splice(from, 1);
		if (!moved) return layout;
		const at = Math.max(0, Math.min(blocks.length, toIndex));
		blocks.splice(at, 0, moved);
		return withBlocks(layout, blocks);
	});
}

export function resizeBlock(
	state: LayoutsState,
	id: string,
	block: string,
	size: { width?: WidgetWidth; height?: WidgetHeight },
): LayoutsState {
	return edit(state, id, (layout) =>
		withBlocks(
			layout,
			layout.blocks.map((b) => {
				if (b.id !== block) return b;
				if (b.type === "card") {
					return { ...b, width: size.width ?? b.width, height: size.height ?? b.height };
				}
				if (b.type === "stats" || b.type === "rings") {
					return { ...b, width: size.width ?? b.width };
				}
				return b;
			}),
		),
	);
}

export function setCardOptions(
	state: LayoutsState,
	id: string,
	block: string,
	patch: Partial<Extract<LayoutBlock, { type: "card" }>["options"]>,
): LayoutsState {
	return edit(state, id, (layout) =>
		withBlocks(
			layout,
			layout.blocks.map((b) =>
				b.id === block && b.type === "card" ? { ...b, options: { ...b.options, ...patch } } : b,
			),
		),
	);
}

export function setStatMetrics(
	state: LayoutsState,
	id: string,
	block: string,
	metrics: string[],
): LayoutsState {
	return edit(state, id, (layout) =>
		withBlocks(
			layout,
			layout.blocks.map((b) => (b.id === block && b.type === "stats" ? { ...b, metrics } : b)),
		),
	);
}

export function setSectionTitle(
	state: LayoutsState,
	id: string,
	block: string,
	title: string,
): LayoutsState {
	return edit(state, id, (layout) =>
		withBlocks(
			layout,
			layout.blocks.map((b) => (b.id === block && b.type === "section" ? { ...b, title } : b)),
		),
	);
}

/** Which cards this layout already holds, so the picker can say "Added". */
export function cardsIn(layout: Layout): Set<string> {
	const out = new Set<string>();
	for (const block of layout.blocks) if (block.type === "card") out.add(block.card);
	return out;
}

/**
 * Where a widget added "to this section" should land: after the last block of
 * the section the person was looking at, not at the very bottom of the pane.
 */
export function endOfSection(layout: Layout, sectionBlockId: string | null): number {
	if (sectionBlockId === null) return layout.blocks.length;
	const start = layout.blocks.findIndex((b) => b.id === sectionBlockId);
	if (start === -1) return layout.blocks.length;
	for (let i = start + 1; i < layout.blocks.length; i++) {
		if (layout.blocks[i]!.type === "section") return i;
	}
	return layout.blocks.length;
}

/* ------------------------------------------------------------------ */
/*  Layouts                                                            */
/* ------------------------------------------------------------------ */

export function setActive(state: LayoutsState, id: string): LayoutsState {
	if (id !== DEFAULT_LAYOUT_ID && !state.byId[id]) return state;
	return { ...state, active: id };
}

export function renameLayout(state: LayoutsState, id: string, name: string): LayoutsState {
	const trimmed = name.trim();
	if (!trimmed) return state;
	return edit(state, id, (layout) => ({ ...layout, name: trimmed }));
}

export function duplicateLayout(state: LayoutsState, id: string): LayoutsState {
	const source = layoutOf(state, id);
	const nextId = layoutIdFor(`${source.name} copy`, [DEFAULT_LAYOUT_ID, ...Object.keys(state.byId)]);
	const copy: Layout = {
		name: `${source.name} copy`,
		// Fresh block ids: two layouts sharing one would make a drag in either
		// of them ambiguous.
		blocks: source.blocks.map((b) => ({ ...b, id: blockId(b.type) })),
	};
	const at = state.order.indexOf(id);
	const order = [...state.order];
	order.splice(at === -1 ? order.length : at + 1, 0, nextId);
	return { ...state, order, byId: { ...state.byId, [nextId]: copy }, active: nextId };
}

/**
 * Delete a layout, or — for the default, which cannot be deleted — put the
 * shipped blocks back by dropping the stored copy.
 */
export function deleteLayout(state: LayoutsState, id: string): LayoutsState {
	if (id === DEFAULT_LAYOUT_ID) return resetLayout(state, id);
	const byId = { ...state.byId };
	delete byId[id];
	const order = state.order.filter((o) => o !== id);
	const active = state.active === id ? (order[0] ?? DEFAULT_LAYOUT_ID) : state.active;
	return { ...state, order, byId, active };
}

/** Back to what the plugin ships. Only the default has something to go back to. */
export function resetLayout(state: LayoutsState, id: string): LayoutsState {
	if (id !== DEFAULT_LAYOUT_ID) return state;
	const byId = { ...state.byId };
	delete byId[DEFAULT_LAYOUT_ID];
	return { ...state, byId };
}

export type LayoutSeed = "shipped" | "current" | "empty" | { template: string };

export function createLayout(state: LayoutsState, name: string, seed: LayoutSeed): LayoutsState {
	const trimmed = name.trim() || "Untitled";
	const id = layoutIdFor(trimmed, [DEFAULT_LAYOUT_ID, ...Object.keys(state.byId)]);

	let blocks: LayoutBlock[] = [];
	if (seed === "shipped") blocks = shippedLayout().blocks;
	else if (seed === "current") blocks = layoutOf(state, state.active).blocks;
	else if (typeof seed === "object") blocks = templateLayout(seed.template)?.blocks ?? [];

	const layout: Layout = { name: trimmed, blocks: blocks.map((b) => ({ ...b, id: blockId(b.type) })) };
	return {
		...state,
		order: [...state.order, id],
		byId: { ...state.byId, [id]: layout },
		active: id,
	};
}
