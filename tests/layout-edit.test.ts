import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
	addBlock,
	cardBlock,
	cardsIn,
	createLayout,
	deleteLayout,
	duplicateLayout,
	endOfSection,
	materialise,
	moveBlock,
	removeBlock,
	renameLayout,
	resetLayout,
	resizeBlock,
	sectionBlock,
	setActive,
	setCardOptions,
	setSectionTitle,
	setStatMetrics,
} from "../src/dashboard/layout-edit";
import {
	DEFAULT_LAYOUT_ID,
	layoutOf,
	readLayouts,
	shippedLayout,
	type LayoutsState,
} from "../src/dashboard/layouts";

const fresh = (): LayoutsState => readLayouts(null);

const ids = (state: LayoutsState, id: string) => layoutOf(state, id).blocks.map((b) => b.id);
const cards = (state: LayoutsState, id: string) =>
	layoutOf(state, id)
		.blocks.filter((b) => b.type === "card")
		.map((b) => (b.type === "card" ? b.card : ""));

describe("materialise", () => {
	it("leaves the default alone until it is edited", () => {
		const state = fresh();
		assert.equal(state.byId[DEFAULT_LAYOUT_ID], undefined);
	});

	it("copies the shipped blocks in on the first edit", () => {
		const state = materialise(fresh(), DEFAULT_LAYOUT_ID);
		assert.deepEqual(state.byId[DEFAULT_LAYOUT_ID]?.blocks, shippedLayout().blocks);
	});

	it("does not overwrite a layout that is already stored", () => {
		const once = materialise(fresh(), DEFAULT_LAYOUT_ID);
		const edited = removeBlock(once, DEFAULT_LAYOUT_ID, "rings");
		assert.equal(materialise(edited, DEFAULT_LAYOUT_ID), edited);
	});

	it("does not mutate the state it was given", () => {
		const state = fresh();
		materialise(state, DEFAULT_LAYOUT_ID);
		assert.deepEqual(state.byId, {});
	});
});

describe("addBlock", () => {
	it("appends when no index is given", () => {
		const block = cardBlock("steps");
		const state = addBlock(fresh(), DEFAULT_LAYOUT_ID, block);
		assert.equal(ids(state, DEFAULT_LAYOUT_ID).at(-1), block.id);
	});

	it("inserts at an index", () => {
		const block = cardBlock("steps");
		const state = addBlock(fresh(), DEFAULT_LAYOUT_ID, block, 1);
		assert.equal(ids(state, DEFAULT_LAYOUT_ID)[1], block.id);
	});

	it("appends rather than throwing when the index is past the end", () => {
		const block = cardBlock("steps");
		const state = addBlock(fresh(), DEFAULT_LAYOUT_ID, block, 9999);
		assert.equal(ids(state, DEFAULT_LAYOUT_ID).at(-1), block.id);
	});
});

describe("removeBlock", () => {
	it("removes only the block asked for", () => {
		const before = ids(fresh(), DEFAULT_LAYOUT_ID);
		const state = removeBlock(fresh(), DEFAULT_LAYOUT_ID, "card-steps");
		assert.equal(ids(state, DEFAULT_LAYOUT_ID).length, before.length - 1);
		assert.ok(!cards(state, DEFAULT_LAYOUT_ID).includes("steps"));
	});

	it("keeps the widgets under a section heading it removes", () => {
		// One ✕ should not take eight charts with it.
		const before = cards(fresh(), DEFAULT_LAYOUT_ID);
		const state = removeBlock(fresh(), DEFAULT_LAYOUT_ID, "section-activity");
		assert.deepEqual(cards(state, DEFAULT_LAYOUT_ID), before);
	});
});

describe("moveBlock", () => {
	it("moves a block to the index it would occupy once lifted out", () => {
		const state = moveBlock(fresh(), DEFAULT_LAYOUT_ID, "card-steps", 0);
		assert.equal(ids(state, DEFAULT_LAYOUT_ID)[0], "card-steps");
	});

	it("keeps every other block, in order", () => {
		const before = ids(fresh(), DEFAULT_LAYOUT_ID);
		const state = moveBlock(fresh(), DEFAULT_LAYOUT_ID, "card-steps", 0);
		const after = ids(state, DEFAULT_LAYOUT_ID);
		assert.equal(after.length, before.length);
		assert.deepEqual(
			after.filter((i) => i !== "card-steps"),
			before.filter((i) => i !== "card-steps"),
		);
	});

	it("clamps an index past the end", () => {
		const state = moveBlock(fresh(), DEFAULT_LAYOUT_ID, "rings", 9999);
		assert.equal(ids(state, DEFAULT_LAYOUT_ID).at(-1), "rings");
	});

	it("does nothing for a block that is not there", () => {
		const state = moveBlock(fresh(), DEFAULT_LAYOUT_ID, "nope", 0);
		assert.deepEqual(ids(state, DEFAULT_LAYOUT_ID), ids(materialise(fresh(), DEFAULT_LAYOUT_ID), DEFAULT_LAYOUT_ID));
	});
});

describe("resizeBlock", () => {
	it("sets width and height on a card", () => {
		const state = resizeBlock(fresh(), DEFAULT_LAYOUT_ID, "card-steps", { width: 1, height: "XL" });
		const block = layoutOf(state, DEFAULT_LAYOUT_ID).blocks.find((b) => b.id === "card-steps");
		assert.equal(block?.type, "card");
		if (block?.type === "card") {
			assert.equal(block.width, 1);
			assert.equal(block.height, "XL");
		}
	});

	it("sets only width on the stat row, which has no plot to make taller", () => {
		const state = resizeBlock(fresh(), DEFAULT_LAYOUT_ID, "stats", { width: 2, height: "XL" });
		const block = layoutOf(state, DEFAULT_LAYOUT_ID).blocks.find((b) => b.id === "stats");
		assert.equal(block?.type, "stats");
		if (block?.type === "stats") assert.equal(block.width, 2);
	});

	it("leaves a section heading alone", () => {
		const state = resizeBlock(fresh(), DEFAULT_LAYOUT_ID, "section-sleep", { width: 1 });
		const block = layoutOf(state, DEFAULT_LAYOUT_ID).blocks.find((b) => b.id === "section-sleep");
		assert.equal(block?.type, "section");
	});
});

describe("card options", () => {
	it("merges rather than replaces", () => {
		const state = setCardOptions(fresh(), DEFAULT_LAYOUT_ID, "card-steps", { goalLine: false });
		const block = layoutOf(state, DEFAULT_LAYOUT_ID).blocks.find((b) => b.id === "card-steps");
		if (block?.type === "card") {
			assert.equal(block.options.goalLine, false);
			assert.equal(block.options.summary, true);
			assert.equal(block.options.range, "follow");
		}
	});

	it("takes a range override", () => {
		const state = setCardOptions(fresh(), DEFAULT_LAYOUT_ID, "card-steps", { range: 90 });
		const block = layoutOf(state, DEFAULT_LAYOUT_ID).blocks.find((b) => b.id === "card-steps");
		if (block?.type === "card") assert.equal(block.options.range, 90);
	});
});

describe("setStatMetrics and setSectionTitle", () => {
	it("replaces the metric list", () => {
		const state = setStatMetrics(fresh(), DEFAULT_LAYOUT_ID, "stats", ["steps"]);
		const block = layoutOf(state, DEFAULT_LAYOUT_ID).blocks.find((b) => b.id === "stats");
		if (block?.type === "stats") assert.deepEqual(block.metrics, ["steps"]);
	});

	it("renames a section", () => {
		const state = setSectionTitle(fresh(), DEFAULT_LAYOUT_ID, "section-body", "Composition");
		const block = layoutOf(state, DEFAULT_LAYOUT_ID).blocks.find((b) => b.id === "section-body");
		if (block?.type === "section") assert.equal(block.title, "Composition");
	});
});

describe("endOfSection", () => {
	const layout = shippedLayout();

	it("lands after the last widget of that section, not at the foot of the pane", () => {
		const at = endOfSection(layout, "section-activity");
		assert.equal(layout.blocks[at]?.type, "section");
		assert.equal(layout.blocks[at - 1]?.type, "card");
	});

	it("falls back to the end", () => {
		assert.equal(endOfSection(layout, null), layout.blocks.length);
		assert.equal(endOfSection(layout, "nope"), layout.blocks.length);
	});
});

describe("cardsIn", () => {
	it("reports what the picker should mark as added", () => {
		const present = cardsIn(shippedLayout());
		assert.ok(present.has("steps"));
		assert.ok(!present.has("telepathy_index"));
	});
});

describe("createLayout", () => {
	it("starts empty", () => {
		const state = createLayout(fresh(), "Weekly review", "empty");
		assert.equal(state.active, "weekly-review");
		assert.deepEqual(layoutOf(state, "weekly-review").blocks, []);
		assert.ok(state.order.includes("weekly-review"));
	});

	it("copies the shipped layout", () => {
		const state = createLayout(fresh(), "Mine", "shipped");
		assert.equal(cards(state, "mine").length, cards(fresh(), DEFAULT_LAYOUT_ID).length);
	});

	it("copies whatever is on screen", () => {
		const trimmed = removeBlock(fresh(), DEFAULT_LAYOUT_ID, "card-steps");
		const state = createLayout(trimmed, "Mine", "current");
		assert.ok(!cards(state, "mine").includes("steps"));
	});

	it("builds from a template", () => {
		const state = createLayout(fresh(), "Training", { template: "training" });
		assert.ok(cards(state, "training").includes("training_load"));
	});

	it("gives fresh block ids, so a drag is never ambiguous", () => {
		const state = createLayout(fresh(), "Mine", "shipped");
		const copied = new Set(ids(state, "mine"));
		for (const id of ids(state, DEFAULT_LAYOUT_ID)) assert.ok(!copied.has(id));
	});

	it("does not collide with an id already in use", () => {
		const once = createLayout(fresh(), "Mine", "empty");
		const twice = createLayout(once, "Mine", "empty");
		assert.ok(twice.order.includes("mine-2"));
	});
});

describe("duplicateLayout", () => {
	it("lands next to the layout it copied, and becomes active", () => {
		const state = duplicateLayout(fresh(), DEFAULT_LAYOUT_ID);
		assert.equal(state.order[1], "default-copy");
		assert.equal(state.active, "default-copy");
		assert.equal(layoutOf(state, "default-copy").name, "Default copy");
	});
});

describe("deleteLayout", () => {
	it("removes a layout and moves off it", () => {
		const made = createLayout(fresh(), "Mine", "empty");
		const state = deleteLayout(made, "mine");
		assert.ok(!state.order.includes("mine"));
		assert.equal(state.byId.mine, undefined);
		assert.equal(state.active, DEFAULT_LAYOUT_ID);
	});

	it("stays put when deleting a layout that is not on screen", () => {
		const made = createLayout(createLayout(fresh(), "A", "empty"), "B", "empty");
		const state = deleteLayout(made, "a");
		assert.equal(state.active, "b");
	});

	it("resets the default rather than deleting it", () => {
		const edited = removeBlock(fresh(), DEFAULT_LAYOUT_ID, "card-steps");
		const state = deleteLayout(edited, DEFAULT_LAYOUT_ID);
		assert.ok(state.order.includes(DEFAULT_LAYOUT_ID));
		assert.deepEqual(layoutOf(state, DEFAULT_LAYOUT_ID).blocks, shippedLayout().blocks);
	});
});

describe("resetLayout", () => {
	it("drops the stored copy so the shipped blocks come back", () => {
		const edited = removeBlock(fresh(), DEFAULT_LAYOUT_ID, "card-steps");
		assert.ok(!cards(edited, DEFAULT_LAYOUT_ID).includes("steps"));
		const state = resetLayout(edited, DEFAULT_LAYOUT_ID);
		assert.equal(state.byId[DEFAULT_LAYOUT_ID], undefined);
		assert.ok(cards(state, DEFAULT_LAYOUT_ID).includes("steps"));
	});

	it("has nothing to do for a layout somebody made", () => {
		const made = createLayout(fresh(), "Mine", "empty");
		assert.equal(resetLayout(made, "mine"), made);
	});
});

describe("setActive", () => {
	it("refuses an id with nothing behind it", () => {
		const state = fresh();
		assert.equal(setActive(state, "ghost"), state);
	});

	it("always allows the default", () => {
		assert.equal(setActive(fresh(), DEFAULT_LAYOUT_ID).active, DEFAULT_LAYOUT_ID);
	});
});

describe("renameLayout", () => {
	it("trims", () => {
		const state = renameLayout(createLayout(fresh(), "Mine", "empty"), "mine", "  Trained  ");
		assert.equal(layoutOf(state, "mine").name, "Trained");
	});

	it("refuses to blank a name", () => {
		const made = createLayout(fresh(), "Mine", "empty");
		assert.equal(renameLayout(made, "mine", "   "), made);
	});
});

describe("sectionBlock", () => {
	it("is addable like any other widget", () => {
		const block = sectionBlock("Mornings");
		const state = addBlock(fresh(), DEFAULT_LAYOUT_ID, block, 0);
		assert.equal(layoutOf(state, DEFAULT_LAYOUT_ID).blocks[0]?.id, block.id);
	});
});
