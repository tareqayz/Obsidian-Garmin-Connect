import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { gaugeArcs, pulseOxPlot } from "../src/dashboard/pulse-ox-charts";
import { pulseOxDayView, pulseOxPeriodView, spo2Band, type PulseOxPageData } from "../src/dashboard/pulse-ox-pages";
import { PHONE } from "../src/dashboard/stat-charts";
import type { Spo2Acclimation } from "../src/garmin/endpoints";
import { PULSE_OX_INDEX, rowsOfAcclimation, spo2DayOf, type PulseOxRow } from "../src/sync/pulse-ox-index";

/** The capture day (ref/health-stats/pulse-ox/README.md). */
const TODAY = "2026-10-08";

/** Daily averages, May 22 – Jun 27, 2026 (acclimationDaily, live 2026-10-08); Jun 24 has none. */
const DAILY = "98 97 94 94 95 97 98 96 98 97 96 97 97 96 96 98 94 96 98 98 97 98 98 97 98 96 98 97 96 94 95 96 97 -- 95 97 97";
const shift = (date: string, n: number) => new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

function rows(): PulseOxRow[] {
	const pairs = DAILY.split(" ").flatMap((v, i) => (v === "--" ? [] : [[shift("2026-05-22", i), Number(v)]]));
	return rowsOfAcclimation({ spo2DailyAverageArray: pairs }).map((r) => PULSE_OX_INDEX.normalize(r)!).sort((a, b) => (a.date < b.date ? -1 : 1));
}
const data = (): PulseOxPageData => ({ rows: rows(), complete: true });

/** Jun 15, 2026 (UTC+3): hourly averages at local 00–03 and 21–23. */
function jun15(): Spo2Acclimation {
	const start = Date.parse("2026-06-14T21:00:00Z");
	const values: Record<number, number> = { 0: 98, 1: 99, 2: 99, 3: 99, 21: 98, 22: 95, 23: 96 };
	return {
		calendarDate: "2026-06-15",
		startTimestampGMT: "2026-06-14T21:00:00.0",
		endTimestampGMT: "2026-06-15T21:00:00.0",
		averageSpO2: 98,
		lowestSpO2: 85,
		latestSpO2: 97,
		latestSpO2TimestampLocal: "2026-06-16T00:00:00.0",
		lastSevenDaysAvgSpO2: 97.71428571428571,
		avgSleepSpO2: 99,
		spO2HourlyAverages: Array.from({ length: 24 }, (_, h) => [start + h * 3_600_000, values[h] ?? null, 100]),
	};
}

describe("pulse ox, TODAY 2026-10-08", () => {
	it("1d Jun 15: Avg 98 = round(mean of the hourly averages), Lowest 85, 7-day 98, overnight 99", () => {
		const day = spo2DayOf(jun15())!;
		const v = pulseOxDayView({ data: data(), route: { range: "1d", offset: -115 }, today: TODAY, day });
		assert.equal(v.date, "2026-06-15");
		assert.equal(v.gauge, 98);
		assert.equal(v.hourlyMean, 98);
		assert.equal(v.bars.length, 7);
		assert.deepEqual(v.figures.map((f) => f.value), ["85%", "97%", "98%", "99%"]);
		assert.equal(v.axis.labels.map((l) => l.text).join(" "), "12 AM 6 AM 12 PM 6 PM 12 AM");
	});
	it("today: -- and no data", () => {
		const v = pulseOxDayView({ data: data(), route: { range: "1d", offset: 0 }, today: TODAY, day: null });
		assert.equal(v.gauge, undefined);
		assert.equal(v.state, "empty");
		assert.equal(v.label, "Today");
	});
	it("7d Jun 19 – 25 (offset −15): 96, the 95.5 tie rounded up; Jun 12 – 18: 97", () => {
		const v = pulseOxPeriodView({ data: data(), route: { range: "7d", offset: -15 }, today: TODAY });
		assert.equal(v.label, "Jun 19 - 25");
		assert.equal(v.figures[0]!.value, "96%");
		assert.deepEqual(v.days.map((d) => d.value), ["95%", "", "97%", "96%", "95%", "94%", "96%"]);
		assert.equal(v.axis.labels[0]!.text, "Fri");
		assert.equal(pulseOxPeriodView({ data: data(), route: { range: "7d", offset: -16 }, today: TODAY }).average, 97);
	});
	it("4w May 22 – Jun 18 (offset −4): 97; Jun 19 – Jul 16 (offset −3): 96; the current 4w is --", () => {
		assert.equal(pulseOxPeriodView({ data: data(), route: { range: "4w", offset: -4 }, today: TODAY }).average, 97);
		assert.equal(pulseOxPeriodView({ data: data(), route: { range: "4w", offset: -3 }, today: TODAY }).average, 96);
		const now = pulseOxPeriodView({ data: data(), route: { range: "4w", offset: 0 }, today: TODAY });
		assert.equal(now.figures[0]!.value, "--");
		assert.deepEqual(now.axis.labels.map((l) => l.text), ["09-14", "09-21", "09-28", "10-05"]);
	});
	it("bands and the twin's 7d frame (348:63419)", () => {
		assert.deepEqual([spo2Band(95), spo2Band(85), spo2Band(75), spo2Band(65), spo2Band(undefined)], ["high", "mid", "low", "poor", "none"]);
		const p = pulseOxPlot(pulseOxPeriodView({ data: data(), route: { range: "7d", offset: 0 }, today: TODAY }), PHONE, false);
		assert.equal(p.columns[0], 33.5);
		assert.equal(p.columns[7], 387.5);
		assert.equal(p.labels[0]!.x, 58.79);
		assert.equal(p.grid[0]!.label, "100%");
		assert.equal(gaugeArcs(180, 8).length, 4);
	});
});
