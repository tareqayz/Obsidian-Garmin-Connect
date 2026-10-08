import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { bloodPressurePlot } from "../src/dashboard/blood-pressure-charts";
import { bloodPressureDayView, bloodPressurePeriodView, bpCategory } from "../src/dashboard/blood-pressure-pages";
import { PHONE } from "../src/dashboard/stat-charts";
import { BLOOD_PRESSURE_INDEX, rowsOfBloodPressure } from "../src/sync/blood-pressure-index";

/** The capture day (ref/health-stats/blood-pressure/README.md): no readings on the account. */
const TODAY = "2026-10-08";
const EMPTY = { rows: [], complete: true };

describe("blood pressure, TODAY 2026-10-08", () => {
	it("maps the empty range payload to no rows", () => {
		assert.deepEqual(rowsOfBloodPressure({ from: "2016-10-08", until: "2026-10-08", measurementSummaries: [], categoryStats: null }), []);
	});
	it("1d empty: --, No Readings", () => {
		const v = bloodPressureDayView({ data: EMPTY, route: { range: "1d", offset: 0 }, today: TODAY });
		assert.equal(v.label, "Today");
		assert.equal(v.hero, "--");
		assert.equal(v.hasReading, false);
	});
	it("7d / 4w / 1y empty: titles, labels, a lone 0 and four -- tiles", () => {
		const w = bloodPressurePeriodView({ data: EMPTY, route: { range: "7d", offset: 0 }, today: TODAY });
		assert.equal(w.title, "Weekly Readings");
		assert.equal(w.label, "Oct 2 - 8");
		assert.deepEqual(w.axis.labels.map((l) => l.text), ["Oct 2", "Oct 8"]);
		assert.deepEqual(w.ticks, [0]);
		assert.deepEqual(w.tiles.map((t) => `${t.value} ${t.label}`), ["-- Normal", "-- High-Normal", "-- Grade 1", "-- Grade 2"]);
		const m = bloodPressurePeriodView({ data: EMPTY, route: { range: "4w", offset: 0 }, today: TODAY });
		assert.equal(m.title, "Monthly Readings");
		assert.deepEqual(m.axis.labels.map((l) => l.text), ["Sep 11", "Oct 8"]);
		const y = bloodPressurePeriodView({ data: EMPTY, route: { range: "1y", offset: 0 }, today: TODAY });
		assert.equal(y.title, "Weekly Ranges");
		assert.equal(y.label, "Oct 10, 2025 - Oct 8, 2026");
		assert.equal(y.axis.labels.length, 13);
	});
	it("an Inferred reading shows and is counted by its ISH category", () => {
		const rows = rowsOfBloodPressure({ measurementSummaries: [{ startDate: "2026-10-07", measurements: [{ systolic: 142, diastolic: 88, pulse: 61 }] }] }).map((r) => BLOOD_PRESSURE_INDEX.normalize(r)!);
		const data = { rows, complete: true };
		assert.equal(bloodPressureDayView({ data, route: { range: "1d", offset: -1 }, today: TODAY }).hero, "142/88");
		const v = bloodPressurePeriodView({ data, route: { range: "7d", offset: 0 }, today: TODAY });
		assert.deepEqual(v.tiles.map((t) => t.value), ["0", "0", "1", "0"]);
		assert.deepEqual(v.ticks, [160, 120, 80, 40, 0]);
		assert.deepEqual([bpCategory(120, 80), bpCategory(132, 80), bpCategory(150, 95), bpCategory(165, 80)], ["normal", "high-normal", "grade1", "grade2"]);
	});
	it("the empty chart sits on the twin's 7d frame (348:65299)", () => {
		const p = bloodPressurePlot(bloodPressurePeriodView({ data: EMPTY, route: { range: "7d", offset: 0 }, today: TODAY }), PHONE, false);
		assert.equal(p.grid[0]!.y, 332.3);
		assert.equal(p.dots[0]!.x, 35);
		assert.equal(p.dots[6]!.x, 364.5);
	});
});
