import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
	availableKeys,
	axisFormat,
	compact,
	detail,
	hoursAndMinutes,
	inRange,
	latestValue,
	niceTicks,
	percent,
	relativeDelta,
	seriesOf,
	shiftDate,
	shortDate,
	statsFor,
	type DayRow,
} from "../src/dashboard/series";

const row = (date: string, values: Record<string, number>): DayRow => ({ date, values });

describe("inRange", () => {
	const rows = [
		row("2026-09-08", { steps: 1 }),
		row("2026-09-12", { steps: 2 }),
		row("2026-09-10", { steps: 3 }),
	];

	it("counts today as one of the days", () => {
		assert.deepEqual(
			inRange(rows, 3, "2026-09-12").map((r) => r.date),
			["2026-09-10", "2026-09-12"],
		);
	});

	it("returns oldest first regardless of input order", () => {
		const dates = inRange(rows, 30, "2026-09-12").map((r) => r.date);
		assert.deepEqual(dates, ["2026-09-08", "2026-09-10", "2026-09-12"]);
	});

	it("excludes days after today", () => {
		const future = [...rows, row("2026-09-20", { steps: 9 })];
		assert.ok(!inRange(future, 30, "2026-09-12").some((r) => r.date === "2026-09-20"));
	});
});

describe("seriesOf", () => {
	it("keeps only finite numbers, so a missing day is a gap and not a zero", () => {
		const rows = [
			row("2026-09-10", { steps: 100 }),
			row("2026-09-11", {}),
			row("2026-09-12", { steps: 300 }),
		];
		assert.deepEqual(seriesOf(rows, "steps"), [
			{ date: "2026-09-10", value: 100 },
			{ date: "2026-09-12", value: 300 },
		]);
	});
});

describe("statsFor", () => {
	const points = [
		{ date: "2026-09-10", value: 10 },
		{ date: "2026-09-11", value: 30 },
		{ date: "2026-09-12", value: 20 },
	];

	it("reports latest, mean and extremes", () => {
		const stats = statsFor(points);
		assert.equal(stats.latest?.value, 20);
		assert.equal(stats.mean, 20);
		assert.equal(stats.min?.value, 10);
		assert.equal(stats.max?.date, "2026-09-11");
	});

	it("survives an empty series", () => {
		assert.deepEqual(statsFor([]), { points: [] });
	});
});

describe("relativeDelta", () => {
	const series = (values: number[]) =>
		values.map((value, i) => ({ date: shiftDate("2026-01-01", i), value }));

	it("compares window means, not two single days", () => {
		// Prior 2 average 10, recent 2 average 20 → +100%.
		assert.equal(relativeDelta(series([10, 10, 20, 20]), 2), 1);
	});

	it("is undefined when there is no prior window to compare against", () => {
		assert.equal(relativeDelta(series([5, 6]), 7), undefined);
		assert.equal(relativeDelta(series([5]), 1), undefined);
	});

	it("is undefined rather than infinite when the prior window is zero", () => {
		assert.equal(relativeDelta(series([0, 0, 5, 5]), 2), undefined);
	});

	it("reports a fall as negative", () => {
		assert.equal(relativeDelta(series([20, 20, 10, 10]), 2), -0.5);
	});
});

describe("availableKeys", () => {
	it("names only the keys some row actually carries", () => {
		const rows = [row("2026-09-12", { steps: 1, hrv_avg: 40 })];
		assert.deepEqual(availableKeys(rows, ["steps", "sleep_hours", "hrv_avg"]), ["steps", "hrv_avg"]);
	});
});

describe("shiftDate", () => {
	it("crosses month and year boundaries", () => {
		assert.equal(shiftDate("2026-03-01", -1), "2026-02-28");
		assert.equal(shiftDate("2026-01-01", -1), "2025-12-31");
		assert.equal(shiftDate("2024-02-28", 1), "2024-02-29");
	});
});

describe("formatting", () => {
	it("compacts large numbers and leaves small ones alone", () => {
		assert.equal(compact(8432), "8,432");
		assert.equal(compact(12934), "12.9K");
		assert.equal(compact(1_400_000), "1.4M");
		assert.equal(compact(48), "48");
		assert.equal(compact(7.25), "7.3");
	});

	it("renders sleep as hours and minutes", () => {
		assert.equal(hoursAndMinutes(7.5), "7h 30m");
		assert.equal(hoursAndMinutes(8), "8h");
	});

	it("signs percentages and keeps small ones precise", () => {
		assert.equal(percent(0.073), "+7.3%");
		assert.equal(percent(-0.234), "-23%");
	});

	it("shortens dates for axis labels", () => {
		assert.equal(shortDate("2026-09-12"), "12 Sep");
		assert.equal(shortDate("2026-01-05"), "5 Jan");
	});
});

describe("niceTicks", () => {
	it("lands on round numbers, preferring fewer clean ticks to more awkward ones", () => {
		assert.deepEqual(niceTicks(0, 12000, 4), [0, 5000, 10000]);
		assert.deepEqual(niceTicks(45, 56, 4), [45, 50, 55]);
	});

	it("never emits a tick outside the range", () => {
		for (const [min, max] of [[0, 13000], [45, 56], [0, 1], [-20, 20]] as const) {
			for (const tick of niceTicks(min, max)) {
				assert.ok(tick >= min && tick <= max, `${tick} outside ${min}..${max}`);
			}
		}
	});

	it("copes with a flat series", () => {
		assert.deepEqual(niceTicks(5, 5), [5]);
	});
});

describe("axisFormat", () => {
	it("uses one convention for the whole axis", () => {
		// Formatting ticks independently gives "0 / 5,000 / 10K" on one scale.
		const ticks = [0, 5000, 10000];
		const format = axisFormat(ticks);
		assert.deepEqual(ticks.map(format), ["0", "5K", "10K"]);
	});

	it("keeps zero plain", () => {
		assert.equal(axisFormat([0, 20000])(0), "0");
	});

	it("commas thousands below the compact threshold", () => {
		assert.deepEqual([0, 1000, 2000].map(axisFormat([0, 1000, 2000])), ["0", "1,000", "2,000"]);
	});

	it("keeps small scales readable", () => {
		assert.deepEqual([0, 2.5, 5].map(axisFormat([0, 2.5, 5])), ["0.0", "2.5", "5.0"]);
	});

	it("never renders two adjacent ticks identically", () => {
		// A VO2 Max axis: rounding by magnitude alone gives "49, 49, 48".
		const ticks = [48, 48.5, 49];
		const labels = ticks.map(axisFormat(ticks));
		assert.equal(new Set(labels).size, labels.length, labels.join(" | "));
		assert.deepEqual(labels, ["48.0", "48.5", "49.0"]);
	});

	it("adds a second decimal when the ticks are that close", () => {
		const ticks = [1.2, 1.25, 1.3];
		assert.deepEqual(ticks.map(axisFormat(ticks)), ["1.20", "1.25", "1.30"]);
	});
});

describe("detail", () => {
	it("gives the exact value a tooltip reader is asking for", () => {
		// compact() would say "12.8K" here, which is not what a hover is for.
		assert.equal(detail(12767), "12,767");
		assert.equal(detail(48), "48");
		assert.equal(detail(7.253), "7.25");
	});
});

describe("latestValue", () => {
	const rows = [
		row("2026-09-10", { steps: 8000, steps_goal: 9000 }),
		row("2026-09-11", { steps: 12000 }),
		row("2026-09-12", { steps: 9500, steps_goal: 11000 }),
	];

	it("reads the newest row that carries the key", () => {
		assert.equal(latestValue(rows, "steps_goal"), 11000);
	});

	it("falls back to an older row when the newest has no value", () => {
		// Garmin only reports a goal on days it recorded one, so the tile has to
		// look back rather than show nothing.
		assert.equal(latestValue(rows.slice(0, 2), "steps_goal"), 9000);
	});

	it("is undefined when no row carries the key", () => {
		assert.equal(latestValue(rows, "resting_hr"), undefined);
		assert.equal(latestValue([], "steps_goal"), undefined);
	});

	it("ignores a non-finite value rather than dividing by it", () => {
		assert.equal(latestValue([row("2026-09-12", { steps_goal: NaN })], "steps_goal"), undefined);
	});
});
