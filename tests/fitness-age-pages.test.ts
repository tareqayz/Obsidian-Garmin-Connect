import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { trendPlot } from "../src/dashboard/fitness-age-charts";
import { REACHED, factorValue, fitnessCurrentView, fitnessTrendView } from "../src/dashboard/fitness-age-pages";
import { PHONE } from "../src/dashboard/stat-charts";
import type { FitnessAge } from "../src/garmin/endpoints";
import { FITNESS_AGE_DAY, FITNESS_AGE_INDEX, fitnessAgeDayOf, rowOfFitnessStat, type FitnessAgeRow } from "../src/sync/fitness-age-index";

/** The capture day (ref/health-stats/fitness-age/README.md). */
const TODAY = "2026-10-08";

/** api-samples/fitnessage-2026-10-08.json (live 05:22). */
const OCT_8: FitnessAge = {
	chronologicalAge: 23, fitnessAge: 18, achievableFitnessAge: 18, previousFitnessAge: 18,
	components: {
		vigorousDaysAvg: { value: 3.5, stale: false, numOfWeeksForIm: 6 },
		rhr: { value: 48, stale: false },
		vigorousMinutesAvg: { value: 170.6, stale: false, numOfWeeksForIm: 6 },
		bmi: { value: 23.9, targetValue: 20.6, improvementValue: 3.3, potentialAge: 18, priority: 1, stale: false, lastMeasurementDate: "2025-11-02" },
	},
	lastUpdated: "2026-10-06T00:00:00.0",
};
/** fitnessage-2026-02-10.json: vigorous days off target, priority 1; BMI 2. */
const FEB_10: FitnessAge = {
	chronologicalAge: 22, fitnessAge: 18, achievableFitnessAge: 18, previousFitnessAge: 18,
	components: {
		vigorousDaysAvg: { value: 2, targetValue: 3, potentialAge: 18, priority: 1, stale: false, numOfWeeksForIm: 6 },
		rhr: { value: 49, stale: false },
		vigorousMinutesAvg: { value: 113.8, stale: false, numOfWeeksForIm: 6 },
		bmi: { value: 23.9, targetValue: 20.6, improvementValue: 3.3, potentialAge: 18, priority: 2, stale: false, lastMeasurementDate: "2025-11-02" },
	},
	lastUpdated: "2026-02-10T00:00:00.0",
};
/** fitnessage-2025-07-15.json: before any data. */
const BEFORE: FitnessAge = {
	chronologicalAge: 22,
	components: { vigorousDaysAvg: { stale: true, staleInputs: ["VIGOROUS_DAYS"] }, rhr: { stale: true, staleInputs: ["RHR"] }, vigorousMinutesAvg: { stale: true }, bmi: { stale: true, staleInputs: ["WEIGHT"] } },
	lastUpdated: "2025-07-15T00:00:00.0",
};

/** Row days Sep 10 → Oct 8 (README fixture; Oct 8's row landed by the phone capture at 10:4x). */
const ROW_DAYS = "09-10 09-11 09-12 09-14 09-15 09-16 09-17 09-19 09-20 09-22 09-23 09-25 09-27 09-28 09-30 10-02 10-03 10-05 10-06".split(" ");
const rows = (extra: string[] = []): FitnessAgeRow[] => [...ROW_DAYS, ...extra].map((d) => ({ date: `2026-${d}`, age: 18, achievable: 18 }));

describe("fitness age index", () => {
	it("is registered with 29-day windows", () => {
		assert.equal(FITNESS_AGE_INDEX.windowDays, 29);
		assert.equal(FITNESS_AGE_DAY.key, "fitnessAgeDay");
	});
	it("keeps the raw fitness age to 3 dp", () => {
		const row = FITNESS_AGE_INDEX.normalize(rowOfFitnessStat({ calendarDate: "2025-08-03", values: { fitnessAge: 18.649547087936988, achievableFitnessAge: 18, vigorousDaysAvg: 0.16666, rhr: 67, bmi: 23.53 } }));
		assert.deepEqual(row, { date: "2025-08-03", age: 18.65, achievable: 18, rhr: 67, vigDays: 0.1667, bmi: 23.53 });
	});
	it("keeps the payload's lastUpdated day", () => {
		assert.equal(fitnessAgeDayOf(OCT_8)?.lastUpdated, "2026-10-06");
	});
});

describe("Current", () => {
	it("Oct 8: hero, headline, Reduce BMI, three on-target cards in the phone's order", () => {
		const v = fitnessCurrentView(fitnessAgeDayOf(OCT_8), rows());
		assert.equal(v.state, "ready");
		assert.equal(v.updated, "Updated October 6");
		assert.equal(v.fitnessAge, "18");
		assert.equal(v.age, "23");
		assert.equal(v.headline, REACHED);
		assert.deepEqual(v.recommendations, [{ factor: "bmi", title: "Reduce BMI", detail: "Weekly avg: 23.9" }]);
		assert.deepEqual(v.onTarget.map((c) => c.detail), ["Maintain at least 75 min/wk", "Maintain at least 3 days/wk", "Maintain 48 bpm"]);
		assert.deepEqual(v.onTarget.map((c) => c.title), ["Vigorous Minutes", "Vigorous Days", "Resting Heart Rate"]);
		assert.equal(v.track.fitness, 0.5);
		assert.ok(Math.abs(v.track.age! - 0.784) < 0.001);
		assert.deepEqual(v.bmi && { t: v.bmi.target, a: v.bmi.average }, { t: "20.6", a: "23.9" });
	});
	it("Feb 10: recommendations by priority", () => {
		const v = fitnessCurrentView(fitnessAgeDayOf(FEB_10), []);
		assert.deepEqual(v.recommendations.map((c) => c.detail), ["Weekly avg: 2", "Weekly avg: 23.9"]);
		assert.deepEqual(v.onTarget.map((c) => c.factor), ["vigorousMinutesAvg", "rhr"]);
	});
	it("vigorous days truncate, the others round to 1 dp", () => {
		assert.equal(factorValue("vigorousDaysAvg", 3.6667), "3.6");
		assert.equal(factorValue("vigorousDaysAvg", 0.1667), "0.1");
		assert.equal(factorValue("bmi", 23.8087), "23.8");
		assert.equal(factorValue("rhr", 48), "48");
	});
	it("before any data: no Updated, no cards", () => {
		const v = fitnessCurrentView(fitnessAgeDayOf(BEFORE), []);
		assert.equal(v.state, "empty");
		assert.equal(v.updated, undefined);
		assert.equal(v.recommendations.length + v.onTarget.length, 0);
	});
	it("while loading: the index's newest age", () => {
		assert.equal(fitnessCurrentView(undefined, rows()).fitnessAge, "18");
	});
});

describe("Trends", () => {
	it("7d Oct 2 – 8: four rows (Oct 2, 3, 5, 6)", () => {
		const v = fitnessTrendView({ rows: rows(), complete: true, route: { range: "7d", offset: 0 }, today: TODAY });
		assert.equal(v.label, "Oct 2 - 8");
		assert.equal(v.title, "Daily Totals");
		assert.deepEqual(v.points.map((p) => p.date), ["2026-10-02", "2026-10-03", "2026-10-05", "2026-10-06"]);
		assert.deepEqual(v.ticks, [20, 18, 16]);
		assert.deepEqual(v.axis.labels.map((l) => l.text), ["10-02", "10-08"]);
	});
	it("4w Sep 11 – Oct 8: 18 rows", () => {
		const v = fitnessTrendView({ rows: rows(), complete: true, route: { range: "4w", offset: 0 }, today: TODAY });
		assert.equal(v.label, "Sep 11 - Oct 8");
		assert.equal(v.points.length, 18);
	});
	it("1y: 52 weeks newest first, whole ages; a past year's week is the mean of its rows", () => {
		const v = fitnessTrendView({ rows: rows(), complete: true, route: { range: "1y", offset: 0 }, today: TODAY });
		assert.equal(v.label, "Oct 10, 2025 - Oct 8, 2026");
		assert.equal(v.weeks.length, 52);
		assert.deepEqual(v.weeks.slice(0, 2).map((w) => [w.title, w.value]), [["Oct 2 - 8", "18"], ["Sep 25 - Oct 1", "18"]]);
		const first: FitnessAgeRow[] = [["03", 18.649547], ["04", 18], ["05", 18], ["06", 18.370367], ["07", 18.22654], ["08", 18.082713]].map(([d, a]) => ({ date: `2025-08-${d}`, age: a as number }));
		const prev = fitnessTrendView({ rows: first, complete: true, route: { range: "1y", offset: -1 }, today: TODAY });
		const aug1 = prev.points.find((p) => p.date === "2025-08-01")!;
		assert.ok(Math.abs(aug1.value - 18.2493) < 1e-4);
		assert.equal(prev.weeks.find((w) => w.from === "2025-08-01")!.value, "18");
	});
});

describe("chart geometry at PHONE = 402 (twin 346:65312, 346:65487)", () => {
	it("7d: points on the 18 line at 50 and 363, gridlines 20 / 16", () => {
		const v = fitnessTrendView({ rows: rows(["10-08"]), complete: true, route: { range: "7d", offset: 0 }, today: TODAY });
		const p = trendPlot(v, PHONE);
		assert.deepEqual(p.grid.map((g) => g.y), [44.58, 101.33, 158.08]);
		assert.equal(p.points[0]!.x, 50);
		assert.equal(p.points.at(-1)!.x, 363);
		assert.equal(p.points[0]!.y, 101.33);
		assert.equal(p.dots[0]!.x, 50);
	});
	it("1y: no dots on the line, month dots from 38 to 366", () => {
		const v = fitnessTrendView({ rows: rows(), complete: true, route: { range: "1y", offset: 0 }, today: TODAY });
		const p = trendPlot(v, PHONE);
		assert.equal(p.points.length, 0);
		assert.equal(p.dots[0]!.x, 38);
		assert.equal(p.dots.at(-1)!.x, 366);
	});
});
