import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
	byYear,
	extendCoverage,
	mergeDays,
	parseMeta,
	parseYear,
	rowFromSummary,
	rowsFromRanges,
	serializeMeta,
	serializeYear,
	type DailyStatsRow,
} from "../src/sync/daily-stats";

describe("rowFromSummary", () => {
	it("keeps what the Steps, Floors and Intensity pages read, floors rounded down", () => {
		const row = rowFromSummary("2026-10-03", {
			totalSteps: 11710,
			dailyStepGoal: 6770,
			totalDistanceMeters: 55800,
			wellnessDistanceMeters: 11465.4,
			totalKilocalories: 2606,
			floorsAscended: 32.79,
			floorsDescended: 18.2,
			userFloorsAscendedGoal: 10,
			moderateIntensityMinutes: 13,
			vigorousIntensityMinutes: 45,
			intensityMinutesGoal: 150,
		});
		assert.deepEqual(row, {
			date: "2026-10-03",
			steps: 11710,
			stepGoal: 6770,
			// On foot: the day's total with the ride in it is not this page's distance.
			distance: 11465,
			calories: 2606,
			floorsUp: 32,
			floorsDown: 18,
			floorsGoal: 10,
			moderate: 13,
			vigorous: 45,
			intensityGoal: 150,
		});
	});

	it("counts a floor that float arithmetic left a hair short", () => {
		assert.equal(rowFromSummary("2026-10-03", { totalSteps: 1, floorsAscended: 31.9999999 })?.floorsUp, 32);
	});

	it("has no row for a day the watch recorded nothing", () => {
		assert.equal(rowFromSummary("2026-01-06", { totalSteps: null, includesWellnessData: false }), null);
		assert.equal(rowFromSummary("2026-01-06", { dailyStepGoal: 7000 }), null);
		assert.equal(rowFromSummary("2026-01-06", null), null);
	});
});

describe("rowsFromRanges", () => {
	it("folds the three windows into a row a day, oldest first", () => {
		const rows = rowsFromRanges(
			[
				{ calendarDate: "2026-10-04", totalSteps: 1988, totalDistance: 1529, stepGoal: 7270 },
				{ calendarDate: "2026-10-03", totalSteps: 11710, totalDistance: 11465, stepGoal: 6770 },
			],
			[{ calendarDate: "2026-10-03", values: { wellnessFloorsAscended: 32, wellnessFloorsDescended: 18, wellnessUserFloorsAscendedGoal: 10 } }],
			[
				{ calendarDate: "2026-10-03", weeklyGoal: 150, moderateValue: 13, vigorousValue: 45 },
				{ calendarDate: "not a date", weeklyGoal: 150, moderateValue: 1, vigorousValue: 1 },
			],
		);
		assert.deepEqual(rows, [
			{ date: "2026-10-03", steps: 11710, stepGoal: 6770, distance: 11465, floorsUp: 32, floorsDown: 18, floorsGoal: 10, moderate: 13, vigorous: 45, intensityGoal: 150 },
			{ date: "2026-10-04", steps: 1988, stepGoal: 7270, distance: 1529 },
		]);
	});
});

describe("mergeDays", () => {
	const old: DailyStatsRow[] = [
		{ date: "2026-10-01", steps: 4310 },
		{ date: "2026-10-02", steps: 3000, calories: 2100 },
		{ date: "2026-10-03", steps: 11000, calories: 2500 },
	];

	it("replaces the days a batch asked about and leaves the rest", () => {
		const rows = mergeDays(old, { rows: [{ date: "2026-10-03", steps: 11710 }], dates: ["2026-10-03"] });
		assert.deepEqual(rows, [
			{ date: "2026-10-01", steps: 4310 },
			{ date: "2026-10-02", steps: 3000, calories: 2100 },
			// A backfill has no calories; the routine sync's stay.
			{ date: "2026-10-03", steps: 11710, calories: 2500 },
		]);
	});

	it("drops a day asked about that came back with nothing", () => {
		const rows = mergeDays(old, { rows: [], dates: ["2026-10-02"] });
		assert.deepEqual(
			rows.map((r) => r.date),
			["2026-10-01", "2026-10-03"],
		);
	});

	it("adds new days in date order", () => {
		const rows = mergeDays(old, { rows: [{ date: "2026-09-30", steps: 4065 }, { date: "2026-10-04", steps: 1988 }], dates: [] });
		assert.deepEqual(
			rows.map((r) => r.date),
			["2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"],
		);
	});
});

describe("extendCoverage", () => {
	it("is the fetch itself before the index has any", () => {
		assert.deepEqual(extendCoverage(null, "2026-10-01", "2026-10-04"), { from: "2026-10-01", to: "2026-10-04" });
	});

	it("joins a fetch that overlaps or touches what is held", () => {
		const meta = { version: 1 as const, from: "2025-08-01", to: "2026-10-01", complete: true };
		assert.deepEqual(extendCoverage(meta, "2026-10-02", "2026-10-04"), { from: "2025-08-01", to: "2026-10-04" });
		assert.deepEqual(extendCoverage(meta, "2025-07-05", "2025-07-31"), { from: "2025-07-05", to: "2026-10-01" });
	});

	it("will not paper over a gap", () => {
		const meta = { version: 1 as const, from: "2025-08-01", to: "2026-09-20", complete: false };
		assert.deepEqual(extendCoverage(meta, "2026-10-02", "2026-10-04"), { from: "2025-08-01", to: "2026-09-20" });
	});
});

describe("year files", () => {
	const rows: DailyStatsRow[] = [
		{ date: "2026-01-02", steps: 9000, stepGoal: 8000 },
		{ date: "2025-12-31", floorsUp: 3, steps: 7000 },
	];

	it("split by year and write a day a line, keys in one order", () => {
		const years = byYear(rows);
		assert.deepEqual([...years.keys()], ["2026", "2025"]);
		const text = serializeYear("2025", years.get("2025")!);
		assert.equal(text, '{\n\t"version": 1,\n\t"year": 2025,\n\t"days": [\n\t\t{"date":"2025-12-31","steps":7000,"floorsUp":3}\n\t]\n}\n');
	});

	it("read back what they wrote, dropping malformed rows", () => {
		const text = serializeYear("2026", rows.slice(0, 1)).replace("]", ', {"date": "nope"}, {"steps": 1}]');
		assert.deepEqual(parseYear(text), [{ date: "2026-01-02", steps: 9000, stepGoal: 8000 }]);
		assert.deepEqual(parseYear("not json"), []);
	});

	it("keep their meta, and refuse one from another version", () => {
		const meta = { version: 1 as const, from: "2025-08-01", to: "2026-10-04", complete: true };
		assert.deepEqual(parseMeta(serializeMeta(meta)), meta);
		assert.equal(parseMeta('{"version": 2, "complete": true}'), null);
		assert.deepEqual(parseMeta('{"version": 1}'), { version: 1, complete: false });
	});
});
