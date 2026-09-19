import { CARDS, COMPOSITIONS, SECTIONS, TILES, type SectionId } from "./metrics";

/**
 * Customisable dashboard layouts.
 *
 * A layout is a named, ordered list of blocks. One of them is on screen at a
 * time and the layout bar switches between them.
 *
 * The one decision everything else follows from: a layout is *not* per device.
 * Layouts live in `data.json` beside settings, so a vault carries them to the
 * phone, and a width stored in pixels there would be meaningless. Width is
 * therefore a span of a four-column grid and the pane collapses it — see
 * `columnsFor` and `spanFor`. The same stored layout renders at four, two or
 * one column, which also means dragging a desktop window narrow and wide again
 * is lossless.
 */

/** Width as a span of the four-column grid. */
export type WidgetWidth = 1 | 2 | 3 | 4;

export type WidgetHeight = "S" | "M" | "L" | "XL";

export const WIDTHS: readonly WidgetWidth[] = [1, 2, 3, 4];
export const HEIGHTS: readonly WidgetHeight[] = ["S", "M", "L", "XL"];

export const WIDTH_LABELS: Record<WidgetWidth, string> = {
	1: "¼",
	2: "½",
	3: "¾",
	4: "Full",
};

/**
 * Plot heights in pixels, narrow pane then wide.
 *
 * S and M are what the dashboard already drew before layouts existed — a grid
 * card at 150 and a lead card at 170/200 — so the shipped layout renders
 * identically to the version before it. L and XL are new, and XL matches the
 * height an expanded card uses.
 */
const PLOT_HEIGHT: Record<WidgetHeight, readonly [number, number]> = {
	S: [150, 150],
	M: [170, 200],
	L: [220, 260],
	XL: [280, 340],
};

export function plotHeight(height: WidgetHeight, wide: boolean): number {
	return PLOT_HEIGHT[height][wide ? 1 : 0];
}

/**
 * How many columns a pane this wide has.
 *
 * Measured from the pane, never from the platform: an Obsidian leaf can be
 * 340px wide on a desktop and a tablet in landscape is wider than some laptop
 * sidebars. 560 is the same threshold the dashboard already used to decide
 * whether it was "wide".
 */
export function columnsFor(paneWidth: number): 1 | 2 | 4 {
	if (paneWidth >= 900) return 4;
	if (paneWidth >= 560) return 2;
	return 1;
}

/** A stored span, rendered into the columns this pane actually has. */
export function spanFor(stored: WidgetWidth, columns: 1 | 2 | 4): number {
	if (columns === 4) return stored;
	// Halving rather than clamping: a ¼ and a ½ both become half a two-column
	// row, and a ¾ takes the row rather than leaving a quarter-width orphan
	// beside it.
	if (columns === 2) return Math.ceil(stored / 2);
	return 1;
}

/* ------------------------------------------------------------------ */
/*  Blocks                                                             */
/* ------------------------------------------------------------------ */

export interface CardOptions {
	/** Draw the goal line, on the cards that have one. */
	goalLine: boolean;
	/** Show summary statistics when the card is expanded. */
	summary: boolean;
	/** Days to plot, or "follow" to use the range the filter bar is showing. */
	range: "follow" | number;
	/** Which measure a switchable card shows. The calendar is the only one. */
	metric?: string;
}

export const DEFAULT_CARD_OPTIONS: CardOptions = {
	goalLine: true,
	summary: true,
	range: "follow",
};

export type LayoutBlock =
	| { type: "rings"; id: string; width: WidgetWidth }
	| { type: "stats"; id: string; width: WidgetWidth; metrics: string[] }
	| { type: "section"; id: string; title: string }
	| {
			type: "card";
			id: string;
			card: string;
			width: WidgetWidth;
			height: WidgetHeight;
			options: CardOptions;
	  };

export type BlockType = LayoutBlock["type"];

export interface Layout {
	name: string;
	blocks: LayoutBlock[];
}

export interface LayoutsState {
	version: number;
	/** Id of the layout on screen. */
	active: string;
	/** Every layout id, in the order the bar shows them. */
	order: string[];
	/**
	 * Only the layouts that differ from what the plugin ships.
	 *
	 * `default` is absent until someone edits it, which is what lets a release
	 * that adds a card add it to everybody's dashboard rather than only to
	 * vaults installed after it. "Reset to the shipped layout" is a delete.
	 */
	byId: Record<string, Layout>;
}

export const LAYOUTS_VERSION = 1;
export const DEFAULT_LAYOUT_ID = "default";

export const DEFAULT_LAYOUTS: LayoutsState = {
	version: LAYOUTS_VERSION,
	active: DEFAULT_LAYOUT_ID,
	order: [DEFAULT_LAYOUT_ID],
	byId: {},
};

/* ------------------------------------------------------------------ */
/*  The catalogue                                                      */
/* ------------------------------------------------------------------ */

/**
 * Every card the dashboard can draw, per section, in the order the shipped
 * layout puts them.
 *
 * Written out rather than derived, because the shipped layout has to list
 * every card whether or not this vault has data for it, while the dashboard
 * only builds the ones it can fill. `tests/layouts.test.ts` fails if the two
 * ever disagree, which is what stops a new card being added to `CARDS` and
 * then never appearing for anyone.
 */
export const CARD_ORDER: Record<SectionId, readonly string[]> = {
	activity: ["steps", "calendar", "distance", "calories", "intensity", "floors", "day_breakdown", "workouts"],
	sleep: [
		"sleep",
		"sleep_score",
		"sleep_respiration",
		"sleep_spo2",
		"sleep_battery",
		"sleep_restless",
		"sleep_mix",
	],
	recovery: [
		"hrv",
		"resting_hr",
		"readiness",
		"battery",
		"stress",
		"recovery_time",
		"respiration",
		"spo2",
		"stress_bands",
	],
	fitness: [
		"training_load",
		"load_ratio",
		"vo2max",
		"fitness_age",
		"endurance",
		"race_5k",
		"race_10k",
		"race_half",
		"race_marathon",
	],
	body: ["weight", "body_fat", "bmi"],
};

/**
 * The cards that lead their section at full width.
 *
 * These are the ones worth a whole row: the measure the section is named
 * after, or a plot that is unreadable at half width.
 */
export const WIDE_CARDS: ReadonlySet<string> = new Set([
	"steps",
	"calendar",
	"sleep",
	"hrv",
	"training_load",
	"workouts",
]);

/** Title and subtitle for any card id, whether it is a chart or a composition. */
export function cardTitle(id: string): { title: string; subtitle: string; section: SectionId } | null {
	const card = CARDS[id];
	if (card) return { title: card.title, subtitle: card.subtitle, section: card.section };
	const composition = COMPOSITIONS.find((c) => c.id === id);
	if (composition) {
		return { title: composition.title, subtitle: composition.subtitle, section: composition.section };
	}
	return null;
}

export function isKnownCard(id: string): boolean {
	return cardTitle(id) !== null;
}

/* ------------------------------------------------------------------ */
/*  The shipped layout                                                 */
/* ------------------------------------------------------------------ */

/**
 * The dashboard as it was before layouts existed: rings, every stat tile, then
 * each section with its cards, the lead card full width and the rest in halves.
 */
export function shippedLayout(): Layout {
	const blocks: LayoutBlock[] = [
		{ type: "rings", id: "rings", width: 4 },
		{ type: "stats", id: "stats", width: 4, metrics: TILES.map((t) => t.key) },
	];
	for (const section of SECTIONS) {
		blocks.push({ type: "section", id: `section-${section.id}`, title: section.title });
		for (const card of CARD_ORDER[section.id]) {
			const wide = WIDE_CARDS.has(card);
			blocks.push({
				type: "card",
				id: `card-${card}`,
				card,
				width: wide ? 4 : 2,
				height: wide ? "M" : "S",
				options: { ...DEFAULT_CARD_OPTIONS },
			});
		}
	}
	return { name: "Default", blocks };
}

/** A starting point for someone who wants a dashboard rather than a wall. */
export const TEMPLATES: Array<{ id: string; name: string; cards: string[]; metrics: string[] }> = [
	{
		id: "training",
		name: "Training focus",
		cards: ["training_load", "load_ratio", "workouts", "vo2max", "intensity", "calendar"],
		metrics: ["steps", "training_readiness", "vo2max", "endurance_score"],
	},
	{
		id: "recovery",
		name: "Sleep & recovery",
		cards: ["sleep", "sleep_score", "hrv", "battery", "stress", "resting_hr"],
		metrics: ["sleep_hours", "sleep_score", "hrv_avg", "body_battery_high", "resting_hr"],
	},
	{
		id: "minimal",
		name: "Minimal",
		cards: ["steps", "sleep", "resting_hr"],
		metrics: ["steps", "sleep_hours", "resting_hr"],
	},
];

export function templateLayout(id: string): Layout | null {
	const template = TEMPLATES.find((t) => t.id === id);
	if (!template) return null;
	const blocks: LayoutBlock[] = [
		{ type: "stats", id: "stats", width: 4, metrics: template.metrics },
	];
	for (const card of template.cards) {
		const wide = WIDE_CARDS.has(card);
		blocks.push({
			type: "card",
			id: `card-${card}`,
			card,
			width: wide ? 4 : 2,
			height: wide ? "M" : "S",
			options: { ...DEFAULT_CARD_OPTIONS },
		});
	}
	return { name: template.name, blocks };
}

/* ------------------------------------------------------------------ */
/*  Reading and writing                                                */
/* ------------------------------------------------------------------ */

/** Resolve a layout id to the blocks to render. */
export function layoutOf(state: LayoutsState, id: string): Layout {
	const stored = state.byId[id];
	if (stored) return stored;
	if (id === DEFAULT_LAYOUT_ID) return shippedLayout();
	// An id in `order` with nothing behind it should not be reachable, but an
	// empty layout is a better answer than a crash.
	return { name: "Untitled", blocks: [] };
}

export function activeLayout(state: LayoutsState): Layout {
	return layoutOf(state, state.active);
}

/** Ids in bar order, always starting with the default. */
export function layoutIds(state: LayoutsState): string[] {
	const ids = state.order.filter((id) => id === DEFAULT_LAYOUT_ID || id in state.byId);
	return ids.includes(DEFAULT_LAYOUT_ID) ? ids : [DEFAULT_LAYOUT_ID, ...ids];
}

export function layoutName(state: LayoutsState, id: string): string {
	return state.byId[id]?.name ?? (id === DEFAULT_LAYOUT_ID ? "Default" : "Untitled");
}

/** A short, unique id for a new block. */
export function blockId(prefix: string): string {
	return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

/** A layout id from a name, made unique against the ids already in use. */
export function layoutIdFor(name: string, taken: readonly string[]): string {
	const base =
		name
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-|-$/g, "")
			.slice(0, 32) || "layout";
	if (!taken.includes(base)) return base;
	for (let n = 2; n < 1000; n++) {
		const candidate = `${base}-${n}`;
		if (!taken.includes(candidate)) return candidate;
	}
	return `${base}-${Math.random().toString(36).slice(2, 6)}`;
}

/* ------------------------------------------------------------------ */
/*  Validation                                                         */
/* ------------------------------------------------------------------ */

/*
   Read by allowlist, the same way `PluginData` reads settings. A block naming
   a card this build does not have is dropped rather than rendered, so a layout
   written by a newer release — or hand-edited — degrades to the parts this
   build understands instead of throwing inside a $derived and blanking the
   pane.
*/

const isWidth = (v: unknown): v is WidgetWidth => v === 1 || v === 2 || v === 3 || v === 4;
const isHeight = (v: unknown): v is WidgetHeight =>
	v === "S" || v === "M" || v === "L" || v === "XL";

function readOptions(raw: unknown): CardOptions {
	const source = (raw ?? {}) as Record<string, unknown>;
	const range = source.range;
	return {
		goalLine: typeof source.goalLine === "boolean" ? source.goalLine : DEFAULT_CARD_OPTIONS.goalLine,
		summary: typeof source.summary === "boolean" ? source.summary : DEFAULT_CARD_OPTIONS.summary,
		range:
			typeof range === "number" && Number.isFinite(range) && range > 0
				? Math.round(range)
				: "follow",
		...(typeof source.metric === "string" ? { metric: source.metric } : {}),
	};
}

function readBlock(raw: unknown, index: number): LayoutBlock | null {
	if (!raw || typeof raw !== "object") return null;
	const source = raw as Record<string, unknown>;
	const id = typeof source.id === "string" && source.id ? source.id : `block-${index}`;
	const width = isWidth(source.width) ? source.width : 4;

	switch (source.type) {
		case "rings":
			return { type: "rings", id, width };
		case "stats": {
			const metrics = Array.isArray(source.metrics)
				? source.metrics.filter((m): m is string => typeof m === "string")
				: TILES.map((t) => t.key);
			return { type: "stats", id, width, metrics };
		}
		case "section":
			return {
				type: "section",
				id,
				title: typeof source.title === "string" ? source.title : "Section",
			};
		case "card": {
			const card = source.card;
			// The one case that really matters: a card id this build cannot draw.
			if (typeof card !== "string" || !isKnownCard(card)) return null;
			return {
				type: "card",
				id,
				card,
				width: isWidth(source.width) ? source.width : 2,
				height: isHeight(source.height) ? source.height : "S",
				options: readOptions(source.options),
			};
		}
		default:
			return null;
	}
}

function readLayout(raw: unknown): Layout | null {
	if (!raw || typeof raw !== "object") return null;
	const source = raw as Record<string, unknown>;
	if (!Array.isArray(source.blocks)) return null;
	const blocks = source.blocks
		.map((b, i) => readBlock(b, i))
		.filter((b): b is LayoutBlock => b !== null);
	return {
		name: typeof source.name === "string" && source.name.trim() ? source.name : "Untitled",
		blocks,
	};
}

export function readLayouts(raw: unknown): LayoutsState {
	if (!raw || typeof raw !== "object") return { ...DEFAULT_LAYOUTS };
	const source = raw as Record<string, unknown>;

	const byId: Record<string, Layout> = {};
	const stored = (source.byId ?? {}) as Record<string, unknown>;
	if (stored && typeof stored === "object") {
		for (const [id, value] of Object.entries(stored)) {
			const layout = readLayout(value);
			if (layout) byId[id] = layout;
		}
	}

	const order: string[] = [DEFAULT_LAYOUT_ID];
	if (Array.isArray(source.order)) {
		for (const id of source.order) {
			if (typeof id !== "string" || order.includes(id)) continue;
			if (id === DEFAULT_LAYOUT_ID || id in byId) order.push(id);
		}
	}
	// A layout that survived validation but was missing from `order` would be
	// unreachable, which is worse than an unexpected ordering.
	for (const id of Object.keys(byId)) if (!order.includes(id)) order.push(id);

	const active = typeof source.active === "string" && order.includes(source.active)
		? source.active
		: DEFAULT_LAYOUT_ID;

	return { version: LAYOUTS_VERSION, active, order, byId };
}
