import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { PHONE } from "../src/dashboard/stat-charts";
import { weightPlot } from "../src/dashboard/weight-charts";
import { changeText, weightDayView, weightPeriodView, weightTicks, type WeightPageData } from "../src/dashboard/weight-pages";
import type { WeighInRange } from "../src/garmin/endpoints";
import { heightOf, rowsOfWeighIns, WEIGHT_INDEX, weighInsOf, type WeightRow } from "../src/sync/weight-index";

/** The capture day (ref/health-stats/weight/README.md). */
const TODAY = "2026-10-08";

/** The pinned weigh-ins: the whole history, live 2026-10-08, newest first, with today's 10:27 68.0 kg. */
const LOCAL = (s: string) => Date.parse(`${s}Z`);
const m = (day: string, time: string, weight: number, weightDelta: number | null) => ({ calendarDate: day, date: LOCAL(`${day}T${time}`), weight, weightDelta });
const PAYLOAD: WeighInRange = {
	dailyWeightSummaries: [
		{ summaryDate: "2026-10-08", allWeightMetrics: [m("2026-10-08", "10:27:27", 68000, null)] },
		{ summaryDate: "2025-11-02", allWeightMetrics: [m("2025-11-02", "23:00:11", 68000, 799.9999999999972)] },
		{ summaryDate: "2025-10-13", allWeightMetrics: [m("2025-10-13", "20:26:08", 67199, 200.00000000000284)] },
		{ summaryDate: "2025-08-03", allWeightMetrics: [m("2025-08-03", "07:42:51", 67000, -1000), m("2025-08-03", "07:42:47", 68039, 1000)] },
		{ summaryDate: "2025-08-02", allWeightMetrics: [m("2025-08-02", "12:46:15", 67000, -99.99999999999432), m("2025-08-02", "12:33:30", 67130, null)] },
	],
};

function rows(height: number | undefined = 169): WeightRow[] {
	return rowsOfWeighIns(PAYLOAD, height)
		.map((r) => WEIGHT_INDEX.normalize(r))
		.filter((r): r is WeightRow => r !== null)
		.reverse();
}
const data = (h?: number): WeightPageData => ({ rows: rows(h), complete: true });
const at = (range: "1d" | "7d" | "4w" | "1y", offset = 0) => ({ range, offset });

describe("weight index", () => {
	it("files by calendarDate with the local wall clock, Nov 2's DST weigh-in included", () => {
		const nov2 = rows().find((r) => r.date === "2025-11-02")!;
		assert.deepEqual(weighInsOf(nov2), [{ time: "23:00:11", grams: 68000, delta: 800 }]);
		const aug2 = rows().find((r) => r.date === "2025-08-02")!;
		assert.equal(aug2.w, 67000);
		assert.equal(aug2.avg, 67065);
		assert.equal(aug2.n, 2);
		assert.deepEqual([aug2.lo, aug2.hi], [67000, 67130]);
	});
	it("reads the height from userSettings", () => {
		assert.equal(heightOf({ userData: { height: 169 } }), 169);
		assert.equal(heightOf({ userData: {} }), undefined);
	});
});

describe("weight pages, TODAY 2026-10-08", () => {
	it("1d today: 68.0 kg, 10:27 AM, BMI 23.8", () => {
		const v = weightDayView({ data: data(), route: at("1d"), today: TODAY });
		assert.equal(v.label, "Today");
		assert.equal(v.hero, "68.0");
		assert.deepEqual(v.weighIns, [{ time: "10:27 AM", weight: "68.0 kg", bmi: "23.8" }]);
	});
	it("1d Aug 2, 2025: the day mean 67.1 over both weigh-ins", () => {
		const offset = -432;
		const v = weightDayView({ data: data(), route: at("1d", offset), today: TODAY });
		assert.equal(v.date, "2025-08-02");
		assert.equal(v.hero, "67.1");
		assert.deepEqual(v.weighIns.map((w) => `${w.time} ${w.weight}`), ["12:33 PM 67.1 kg", "12:46 PM 67.0 kg"]);
	});
	it("1d Nov 2, 2025 shows 11:00 PM; without a height BMI is --", () => {
		const v = weightDayView({ data: data(0), route: at("1d", -340), today: TODAY });
		assert.equal(v.date, "2025-11-02");
		assert.deepEqual(v.weighIns, [{ time: "11:00 PM", weight: "68.0 kg", bmi: "--" }]);
	});
	it("1y current: 67.7 kg · 23.7, week cards newest first with a null change as 0.0 kg →", () => {
		const v = weightPeriodView({ data: data(), route: at("1y"), today: TODAY });
		assert.equal(v.label, "Oct 10, 2025 - Oct 8, 2026");
		assert.equal(v.figures.map((f) => f.value).join(" "), "67.7 23.7");
		assert.deepEqual(v.cards.map((c) => `${c.title} | ${c.value} | ${c.change}`), [
			"Oct 2 - 8 | 68.0 kg | 0.0 kg →",
			"Oct 31 - Nov 6, 2025 | 68.0 kg | 0.8 kg ↑",
			"Oct 10-16, 2025 | 67.2 kg | 0.0 kg →",
		]);
		assert.deepEqual(v.ticks, [70, 69, 68, 67]);
		assert.deepEqual(v.line.map((p) => p.value), [67.2, 68, 68]);
		const bmi = weightPeriodView({ data: data(), route: at("1y"), today: TODAY, series: "bmi" });
		assert.deepEqual(bmi.ticks, [26, 25, 24, 23]);
	});
	it("Oct 2 – 8 holds today's weigh-in; 7d Aug 1 – 7, 2025 averages the daily latest: 67.0 · 23.5", () => {
		const now = weightPeriodView({ data: data(), route: at("7d"), today: TODAY });
		assert.equal(now.hasData, true);
		assert.equal(now.average, 68000);
		const aug = weightPeriodView({ data: data(), route: at("7d", -61), today: TODAY });
		assert.equal(aug.label, "Aug 1-7, 2025");
		assert.equal(aug.average, 67000);
		assert.equal(aug.figures[1]!.value, "23.5");
		assert.deepEqual(aug.points.map((p) => [p.value, p.low, p.high]), [[67, 67, 67.1], [67, 67, 68]]);
		assert.deepEqual(aug.cards.map((c) => c.change), ["1.0 kg ↓", "0.1 kg ↓"]);
	});
	it("4w Oct 10 – Nov 6, 2025: 67.6 · 23.7; 7d Oct 31 – Nov 6: 68.0 · 23.8; empty spans --", () => {
		const w4 = weightPeriodView({ data: data(), route: at("4w", -12), today: TODAY });
		assert.equal(w4.average, 67599.5);
		assert.equal(w4.figures[1]!.value, "23.7");
		const nov = weightPeriodView({ data: data(), route: at("7d", -48), today: TODAY });
		assert.equal(nov.figures[1]!.value, "23.8");
		const empty = weightPeriodView({ data: data(), route: at("7d", -1), today: TODAY });
		assert.equal(empty.hasData, false);
		assert.deepEqual(empty.figures.map((f) => `${f.value} ${f.label}`), ["-- Change", "-- BMI"]);
	});
	it("prints changes and ticks", () => {
		assert.equal(changeText(null), "0.0 kg →");
		assert.equal(changeText(799.99), "0.8 kg ↑");
		assert.deepEqual(weightTicks(67.2, 68), [70, 69, 68, 67]);
	});
	it("places the 1y line on the twin's phone frame (348:64948)", () => {
		const p = weightPlot(weightPeriodView({ data: data(), route: at("1y"), today: TODAY }), PHONE, false);
		assert.equal(p.grid[0]!.y, 62.3);
		assert.equal(p.grid[3]!.y, 213.5);
		assert.equal(p.dots[0]!.x, 44);
		assert.equal(p.dots[12]!.x, 368);
		assert.match(p.line, /^M\d/);
	});
});
