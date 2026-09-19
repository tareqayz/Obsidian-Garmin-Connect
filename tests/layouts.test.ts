import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
	CARD_ORDER,
	DEFAULT_LAYOUT_ID,
	WIDE_CARDS,
	activeLayout,
	blockId,
	columnsFor,
	isKnownCard,
	layoutIdFor,
	layoutIds,
	layoutOf,
	plotHeight,
	readLayouts,
	shippedLayout,
	spanFor,
	templateLayout,
	type LayoutBlock,
} from "../src/dashboard/layouts";
import { CARDS, COMPOSITIONS, SECTIONS, TILES } from "../src/dashboard/metrics";

const cardIds = (blocks: LayoutBlock[]) =>
	blocks.filter((b): b is Extract<LayoutBlock, { type: "card" }> => b.type === "card").map((b) => b.card);

describe("the catalogue matches the cards that exist", () => {
	// This is the test that earns its keep. Adding a card to CARDS without
	// listing it here would mean it never appears in anybody's dashboard and
	// nothing else would notice.
	const listed = SECTIONS.flatMap((s) => CARD_ORDER[s.id]);
	const defined = [...Object.keys(CARDS), ...COMPOSITIONS.map((c) => c.id)];

	it("lists every card and composition exactly once", () => {
		assert.deepEqual([...listed].sort(), [...new Set(listed)].sort(), "a card is listed twice");
		assert.deepEqual([...listed].sort(), [...defined].sort());
	});

	it("files each card under the section it declares", () => {
		for (const section of SECTIONS) {
			for (const id of CARD_ORDER[section.id]) {
				const def = CARDS[id] ?? COMPOSITIONS.find((c) => c.id === id);
				assert.ok(def, `${id} is listed but not defined`);
				assert.equal(def.section, section.id, `${id} is filed under the wrong section`);
			}
		}
	});

	it("only widens cards that exist", () => {
		for (const id of WIDE_CARDS) assert.ok(isKnownCard(id), `${id} is wide but undefined`);
	});
});

describe("columnsFor", () => {
	it("reads the pane, not the platform", () => {
		assert.equal(columnsFor(1200), 4);
		assert.equal(columnsFor(900), 4);
		assert.equal(columnsFor(899), 2);
		assert.equal(columnsFor(560), 2);
		// A desktop sidebar and a phone land in the same place, which is the point.
		assert.equal(columnsFor(559), 1);
		assert.equal(columnsFor(390), 1);
	});
});

describe("spanFor", () => {
	it("keeps every span on a four-column pane", () => {
		assert.deepEqual([1, 2, 3, 4].map((w) => spanFor(w as 1 | 2 | 3 | 4, 4)), [1, 2, 3, 4]);
	});

	it("halves rather than clamps at two columns", () => {
		// A ¾ takes the row instead of leaving a quarter-width orphan beside it.
		assert.deepEqual([1, 2, 3, 4].map((w) => spanFor(w as 1 | 2 | 3 | 4, 2)), [1, 1, 2, 2]);
	});

	it("collapses everything at one column", () => {
		assert.deepEqual([1, 2, 3, 4].map((w) => spanFor(w as 1 | 2 | 3 | 4, 1)), [1, 1, 1, 1]);
	});
});

describe("plotHeight", () => {
	it("reproduces the heights the dashboard used before layouts existed", () => {
		assert.equal(plotHeight("S", true), 150);
		assert.equal(plotHeight("S", false), 150);
		assert.equal(plotHeight("M", true), 200);
		assert.equal(plotHeight("M", false), 170);
	});

	it("grows with the token", () => {
		const wide = (["S", "M", "L", "XL"] as const).map((h) => plotHeight(h, true));
		assert.deepEqual(wide, [...wide].sort((a, b) => a - b));
	});
});

describe("shippedLayout", () => {
	const layout = shippedLayout();

	it("leads with the rings and the stat tiles", () => {
		assert.equal(layout.blocks[0]?.type, "rings");
		assert.equal(layout.blocks[1]?.type, "stats");
	});

	it("offers every stat tile", () => {
		const stats = layout.blocks[1];
		assert.equal(stats?.type, "stats");
		if (stats?.type === "stats") assert.deepEqual(stats.metrics, TILES.map((t) => t.key));
	});

	it("opens a section for each one the dashboard has", () => {
		const titles = layout.blocks.filter((b) => b.type === "section").map((b) => b.title);
		assert.deepEqual(titles, SECTIONS.map((s) => s.title));
	});

	it("contains every card, once", () => {
		const ids = cardIds(layout.blocks);
		assert.equal(ids.length, new Set(ids).size);
		assert.equal(ids.length, Object.keys(CARDS).length + COMPOSITIONS.length);
	});

	it("gives a lead card the row and the rest a half", () => {
		for (const block of layout.blocks) {
			if (block.type !== "card") continue;
			assert.equal(block.width, WIDE_CARDS.has(block.card) ? 4 : 2);
		}
	});
});

describe("templateLayout", () => {
	it("builds only from cards that exist", () => {
		for (const id of ["training", "recovery", "minimal"]) {
			const layout = templateLayout(id);
			assert.ok(layout, `${id} produced nothing`);
			for (const card of cardIds(layout.blocks)) assert.ok(isKnownCard(card), `${card} is unknown`);
		}
	});

	it("says so when asked for one that does not exist", () => {
		assert.equal(templateLayout("nope"), null);
	});
});

describe("readLayouts", () => {
	it("falls back to the shipped layout for anything unreadable", () => {
		for (const raw of [null, undefined, 3, "layouts", []]) {
			const state = readLayouts(raw);
			assert.equal(state.active, DEFAULT_LAYOUT_ID);
			assert.deepEqual(state.order, [DEFAULT_LAYOUT_ID]);
			assert.deepEqual(state.byId, {});
		}
	});

	it("drops a block naming a card this build cannot draw", () => {
		// The degradation path for a layout written by a newer release.
		const state = readLayouts({
			active: "mine",
			order: ["default", "mine"],
			byId: {
				mine: {
					name: "Mine",
					blocks: [
						{ type: "card", id: "a", card: "steps", width: 2, height: "S" },
						{ type: "card", id: "b", card: "telepathy_index", width: 2, height: "S" },
					],
				},
			},
		});
		assert.deepEqual(cardIds(state.byId.mine!.blocks), ["steps"]);
	});

	it("drops a block of a type it does not know", () => {
		const state = readLayouts({
			order: ["default", "mine"],
			byId: { mine: { name: "Mine", blocks: [{ type: "hologram", id: "a" }] } },
		});
		assert.deepEqual(state.byId.mine!.blocks, []);
	});

	it("repairs a width or height that is out of range", () => {
		const state = readLayouts({
			order: ["default", "mine"],
			byId: {
				mine: {
					name: "Mine",
					blocks: [{ type: "card", id: "a", card: "steps", width: 9, height: "XXL" }],
				},
			},
		});
		const block = state.byId.mine!.blocks[0];
		assert.equal(block?.type, "card");
		if (block?.type === "card") {
			assert.equal(block.width, 2);
			assert.equal(block.height, "S");
			assert.equal(block.options.range, "follow");
			assert.equal(block.options.goalLine, true);
		}
	});

	it("keeps card options it recognises", () => {
		const state = readLayouts({
			order: ["default", "mine"],
			byId: {
				mine: {
					name: "Mine",
					blocks: [
						{
							type: "card",
							id: "a",
							card: "calendar",
							width: 4,
							height: "L",
							options: { goalLine: false, summary: false, range: 90, metric: "sleep_hours" },
						},
					],
				},
			},
		});
		const block = state.byId.mine!.blocks[0];
		assert.equal(block?.type, "card");
		if (block?.type === "card") {
			assert.deepEqual(block.options, {
				goalLine: false,
				summary: false,
				range: 90,
				metric: "sleep_hours",
			});
		}
	});

	it("never loses the default, and never lists it twice", () => {
		const state = readLayouts({ order: ["mine", "default", "default"], byId: {} });
		assert.deepEqual(state.order, [DEFAULT_LAYOUT_ID]);
	});

	it("reaches a layout that was missing from the order", () => {
		const state = readLayouts({
			order: ["default"],
			byId: { orphan: { name: "Orphan", blocks: [] } },
		});
		assert.ok(state.order.includes("orphan"));
	});

	it("falls back when active points at a layout that is gone", () => {
		const state = readLayouts({ active: "deleted", order: ["default"], byId: {} });
		assert.equal(state.active, DEFAULT_LAYOUT_ID);
	});
});

describe("layoutOf", () => {
	it("returns the shipped blocks for an unedited default", () => {
		const state = readLayouts(null);
		assert.deepEqual(layoutOf(state, DEFAULT_LAYOUT_ID).blocks, shippedLayout().blocks);
		assert.equal(activeLayout(state).name, "Default");
	});

	it("returns the stored blocks once the default has been edited", () => {
		const state = readLayouts({
			order: ["default"],
			byId: { default: { name: "Default", blocks: [{ type: "rings", id: "r", width: 4 }] } },
		});
		assert.equal(layoutOf(state, DEFAULT_LAYOUT_ID).blocks.length, 1);
	});
});

describe("layoutIds", () => {
	it("hides an id with nothing behind it", () => {
		const state = { version: 1, active: "default", order: ["default", "ghost"], byId: {} };
		assert.deepEqual(layoutIds(state), [DEFAULT_LAYOUT_ID]);
	});
});

describe("layoutIdFor", () => {
	it("slugs a name", () => {
		assert.equal(layoutIdFor("Weekly review", []), "weekly-review");
		assert.equal(layoutIdFor("  Sleep & Recovery!  ", []), "sleep-recovery");
	});

	it("does not collide", () => {
		assert.equal(layoutIdFor("Training", ["training"]), "training-2");
		assert.equal(layoutIdFor("Training", ["training", "training-2"]), "training-3");
	});

	it("still produces something for a name with nothing sluggable in it", () => {
		assert.equal(layoutIdFor("···", []), "layout");
	});
});

describe("blockId", () => {
	it("does not repeat itself", () => {
		const ids = new Set(Array.from({ length: 200 }, () => blockId("card")));
		assert.equal(ids.size, 200);
	});
});
