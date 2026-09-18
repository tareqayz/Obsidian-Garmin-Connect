import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { heatGrid, levelOf, thresholdsFor, weekdayOf } from "../src/dashboard/heatmap";
import type { DayRow } from "../src/dashboard/series";

const row = (date: string, steps: number): DayRow => ({ date, values: { steps } });

describe("weekdayOf", () => {
	it("counts from Monday", () => {
		// 2026-09-14 is a Monday.
		assert.equal(weekdayOf("2026-09-14"), 0);
		assert.equal(weekdayOf("2026-09-17"), 3);
		assert.equal(weekdayOf("2026-09-20"), 6);
	});
});

describe("thresholdsFor", () => {
	it("cuts at the quartiles, not at even slices of the range", () => {
		// One 30,000-step day would otherwise push every ordinary day into the
		// palest step and the whole year would read as empty.
		const values = [1, 2, 3, 4, 30000];
		const cuts = thresholdsFor(values);
		assert.deepEqual(cuts, [2, 3, 4]);
		assert.equal(levelOf(1, cuts), 1);
		assert.equal(levelOf(4, cuts), 3);
		assert.equal(levelOf(30000, cuts), 4);
	});

	it("says nothing when there is nothing to say", () => {
		assert.deepEqual(thresholdsFor([]), []);
		// Without cut points every present value sits mid-ramp rather than at an end.
		assert.equal(levelOf(5, []), 3);
	});
});

describe("heatGrid", () => {
	const rows = [row("2026-09-14", 8000), row("2026-09-16", 12000), row("2026-09-20", 3000)];

	it("pads to whole weeks so the weekday rows line up", () => {
		// The 16th is a Wednesday, so the first column needs two leading fillers.
		const grid = heatGrid(rows, "steps", "2026-09-16", "2026-09-20");
		assert.equal(grid.weeks.length, 1);
		assert.equal(grid.weeks[0]!.length, 7);
		assert.deepEqual(
			grid.weeks[0]!.map((c) => Boolean(c.filler)),
			[true, true, false, false, false, false, false],
		);
		assert.equal(grid.days, 5);
	});

	it("marks a day with no data apart from one with a low value", () => {
		const grid = heatGrid(rows, "steps", "2026-09-14", "2026-09-20");
		const cells = new Map(grid.weeks.flat().map((c) => [c.date, c]));
		assert.equal(cells.get("2026-09-15")!.level, 0);
		assert.equal(cells.get("2026-09-15")!.value, undefined);
		assert.equal(cells.get("2026-09-20")!.level, 1);
		assert.equal(cells.get("2026-09-20")!.value, 3000);
	});

	it("labels a month at the column its first day lands in", () => {
		const grid = heatGrid(rows, "steps", "2026-08-30", "2026-10-04");
		assert.deepEqual(
			grid.months.map((m) => m.label),
			["Aug", "Sep", "Oct"],
		);
		assert.ok(grid.months[1]!.column > grid.months[0]!.column);
	});

	it("covers a full year without losing a day", () => {
		const grid = heatGrid(rows, "steps", "2025-09-18", "2026-09-17");
		assert.equal(grid.days, 365);
		assert.equal(grid.weeks.length * 7 >= 365, true);
		assert.equal(grid.weeks.every((w) => w.length === 7), true);
	});

	it("returns an empty grid for a backwards or missing window", () => {
		assert.deepEqual(heatGrid(rows, "steps", "2026-09-20", "2026-09-14").weeks, []);
		assert.deepEqual(heatGrid(rows, "steps", "", "").weeks, []);
	});

	it("reports the extent of what it plotted", () => {
		const grid = heatGrid(rows, "steps", "2026-09-14", "2026-09-20");
		assert.equal(grid.min, 3000);
		assert.equal(grid.max, 12000);
	});
});
