import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { bigRing, markerAngle, miniRing, sheetPlot } from "../src/dashboard/health-status-charts";
import { healthSheetView, healthStatusDayView, rangeText, sheetKeyOf, valueText } from "../src/dashboard/health-status-pages";
import { PHONE } from "../src/dashboard/stat-charts";
import type { GarminApi, HealthStatus } from "../src/garmin/endpoints";
import { HEALTH_STATUS_INDEX, rowOfHealthStatus, type HealthStatusRow } from "../src/sync/health-status-index";
import type { SleepRow } from "../src/sync/sleep-index";

/** The capture day (ref/health-stats/health-status/README.md). */
const TODAY = "2026-10-08";

/** The spec's fixture table: value lo hi pct status per metric, HR | HRV | RESP | SKIN, then the sleep line. */
const TABLE = `
2026-09-29 0 | 50 47 62 20 in | 81 65 91 62 in | 14.5 13.1 15.3 64 in | -0.2 -0.6 0.6 33 in | 50 81 14.54 -0.2
2026-09-30 0 | 56 47 62 60 in | 72 65 91 27 in | 15 13.1 15.3 86 in | 0.6 -0.6 0.6 100 in | 56 72 15.07 0.6
2026-10-01 0 | 52 47 62 33 in | 85 65 90 80 in | 14.8 13.1 15.4 74 in | 0 -0.6 0.6 50 in | 52 85 14.89 0
2026-10-02 0 | 51 47 62 27 in | 80 65 90 60 in | 14.2 13.1 15.5 46 in | -0.4 -0.6 0.6 17 in | 51 80 14.23 -0.4
2026-10-03 0 | 52 47 62 33 in | 85 65 91 77 in | 14.5 13.1 15.4 61 in | -0.1 -0.6 0.6 42 in | 52 85 14.50 -0.1
2026-10-04 0 | 50 47 62 20 in | 84 65 91 73 in | 13.9 13.1 15.5 33 in | -0.3 -0.6 0.6 25 in | 50 84 13.92 -0.3
2026-10-05 0 | 53 47 62 40 in | 84 65 91 73 in | 14.7 13.1 15.5 67 in | -0.3 -0.6 0.6 25 in | 53 84 14.74 -0.3
2026-10-06 0 | 56 47 62 60 in | 80 65 91 58 in | 14.8 13.1 15.5 71 in | 0.1 -0.6 0.6 58 in | 56 80 14.88 0.1
2026-10-07 0 | 51 47 62 27 in | 88 65 91 88 in | 14.5 13.1 15.5 58 in | 0 -0.6 0.6 50 in | 51 88 14.52 0
2026-09-16 2 | 59 47 62 80 in | 62 66 92 64 BELOW | 15.8 13 15.4 40 ABOVE | 0.3 -0.6 0.6 75 in | 59 62 15.88 0.3`;

const KEYS = ["hr", "hrv", "resp", "skin"] as const;
const STATUS: Record<string, string> = { in: "IN_RANGE", BELOW: "BELOW", ABOVE: "ABOVE" };

function parse(): { rows: HealthStatusRow[]; sleep: SleepRow[] } {
	const rows: HealthStatusRow[] = [];
	const sleep: SleepRow[] = [];
	for (const line of TABLE.trim().split("\n")) {
		const [head, ...cells] = line.split("|").map((s) => s.trim().split(/\s+/));
		const date = head![0]!;
		const row: Record<string, unknown> = { date, out: Number(head![1]) };
		KEYS.forEach((k, i) => {
			const [v, lo, hi, pct, st] = cells[i]!;
			Object.assign(row, { [k]: Number(v), [`${k}Lo`]: Number(lo), [`${k}Hi`]: Number(hi), [`${k}Pct`]: Number(pct), [`${k}St`]: STATUS[st!] });
		});
		Object.assign(row, { spo2Lo: 0, spo2Hi: 0, spo2Pct: 0, spo2St: "ONBOARDING" });
		rows.push(row as unknown as HealthStatusRow);
		const [hr, hrv, resp, skinC] = cells[4]!.map(Number);
		sleep.push({ date, hr, hrv, resp, skinC } as SleepRow);
	}
	rows.sort((a, b) => a.date.localeCompare(b.date));
	return { rows, sleep };
}

/** `api-samples/p2-summary-2026-10-08.json`, the phone's "Today". */
const OCT8: HealthStatus = {
	calendarDate: "2026-10-08",
	outliersCount: 0,
	metrics: [
		{ type: "HRV", value: 89, baselineUpperLimit: 92, baselineLowerLimit: 65, status: "IN_RANGE", percentage: 89 },
		{ type: "HR", value: 54, baselineUpperLimit: 62, baselineLowerLimit: 47, status: "IN_RANGE", percentage: 47 },
		{ type: "SPO2", value: null, baselineUpperLimit: 0, baselineLowerLimit: 0, status: "ONBOARDING", percentage: 0 },
		{ type: "SKIN_TEMP_C", value: 0.4, baselineUpperLimit: 0.6, baselineLowerLimit: -0.6, status: "IN_RANGE", percentage: 83 },
		{ type: "RESPIRATION", value: 13.7, baselineUpperLimit: 15.5, baselineLowerLimit: 13.1, status: "IN_RANGE", percentage: 25 },
		{ type: "SKIN_TEMP_F", value: 0.7, baselineUpperLimit: 1.1, baselineLowerLimit: -1.1, status: "IN_RANGE", percentage: 83 },
	],
};

const { rows, sleep } = parse();
const data = { rows, complete: true };
const day = (offset: number) => healthStatusDayView({ data, route: { range: "1d", offset }, today: TODAY });
const cards = (v: ReturnType<typeof day>) => v.metrics.map((m) => `${m.title} · ${m.subtitle} · ${m.value}`);

describe("HEALTH_STATUS_INDEX", () => {
	it("takes the whole history in one request and re-reads 28 days", () => {
		assert.equal(HEALTH_STATUS_INDEX.windowDays, 3660);
		assert.equal(HEALTH_STATUS_INDEX.refreshDays, 28);
		assert.equal(HEALTH_STATUS_INDEX.keepOld, false);
		assert.equal(HEALTH_STATUS_INDEX.group, "health");
	});

	it("keeps value, limits, percentage and status per metric, and drops SKIN_TEMP_F", async () => {
		const api = { healthStatusRange: async () => [OCT8] } as unknown as GarminApi;
		const [row] = (await HEALTH_STATUS_INDEX.fetchWindow(api, "2026-10-08", "2026-10-08")).map((r) => HEALTH_STATUS_INDEX.normalize(r));
		assert.deepEqual(row, {
			date: "2026-10-08",
			hr: 54, hrLo: 47, hrHi: 62, hrPct: 47, hrSt: "IN_RANGE",
			hrv: 89, hrvLo: 65, hrvHi: 92, hrvPct: 89, hrvSt: "IN_RANGE",
			resp: 13.7, respLo: 13.1, respHi: 15.5, respPct: 25, respSt: "IN_RANGE",
			skin: 0.4, skinLo: -0.6, skinHi: 0.6, skinPct: 83, skinSt: "IN_RANGE",
			spo2Lo: 0, spo2Hi: 0, spo2Pct: 0, spo2St: "ONBOARDING",
			out: 0,
		});
	});

	it("cuts respiration and rounds UNKNOWN's unrounded limits", () => {
		const row = HEALTH_STATUS_INDEX.normalize(
			rowOfHealthStatus({ calendarDate: "2026-10-06", outliersCount: 0, metrics: [
				{ type: "RESPIRATION", value: 14.88, baselineLowerLimit: 13.1, baselineUpperLimit: 15.5, status: "IN_RANGE", percentage: 71 },
				{ type: "HR", value: null, baselineLowerLimit: 45.36598710732655, baselineUpperLimit: 61.9, status: "UNKNOWN", percentage: 0 },
			] }),
		);
		assert.equal(row?.resp, 14.8);
		assert.equal(row?.hr, undefined);
		assert.equal(row?.hrLo, 45);
		assert.equal(row?.hrSt, "UNKNOWN");
	});
});

describe("healthStatusDayView", () => {
	const withOct8 = { rows: [...rows, HEALTH_STATUS_INDEX.normalize(rowOfHealthStatus(OCT8))! as HealthStatusRow], complete: true };

	it("Oct 8 (phone Today): four in range, Pulse Ox calibrating", () => {
		const v = healthStatusDayView({ data: withOct8, route: { range: "1d", offset: 0 }, today: TODAY });
		assert.equal(v.label, "Today");
		assert.equal(v.headline, "All your metrics are in range");
		assert.deepEqual(v.groups.map((g) => g.title), ["WITHIN RANGE", "NO DATA"]);
		assert.deepEqual(cards(v), [
			"Heart Rate · Within 47-62 bpm · 54 bpm",
			"HRV · Within 65-92 ms · 89 ms",
			"Respiration · Within 13.1-15.5 brpm · 13.7 brpm",
			"Skin Temp · Within -0.6° to +0.6° · +0.4°",
			"Pulse Ox · Calibrating · --",
		]);
		assert.deepEqual(v.metrics.map((m) => m.pct), [47, 89, 25, 83, undefined]);
	});

	it("Oct 5 (phone, pass 1) and its ring markers", () => {
		const v = day(-3);
		assert.deepEqual(cards(v).slice(0, 4), ["Heart Rate · Within 47-62 bpm · 53 bpm", "HRV · Within 65-91 ms · 84 ms", "Respiration · Within 13.1-15.5 brpm · 14.7 brpm", "Skin Temp · Within -0.6° to +0.6° · -0.3°"]);
		assert.deepEqual(v.metrics.slice(0, 4).map((m) => markerAngle(m.pct!)), [108, 48.6, 59.4, 135]);
	});

	it("Oct 7 (web): skin zero reads 0°, label is the long date", () => {
		const v = day(-1);
		assert.equal(v.label, "Wednesday, October 7");
		assert.deepEqual(cards(v).slice(0, 4), ["Heart Rate · Within 47-62 bpm · 51 bpm", "HRV · Within 65-91 ms · 88 ms", "Respiration · Within 13.1-15.5 brpm · 14.5 brpm", "Skin Temp · Within -0.6° to +0.6° · 0°"]);
	});

	it("Oct 6: respiration 14.8 and skin +0.1°; Sep 30: 15 brpm without .0", () => {
		assert.deepEqual([day(-2).metrics[2]!.value, day(-2).metrics[3]!.value], ["14.8 brpm", "+0.1°"]);
		assert.equal(day(-8).metrics[2]!.value, "15 brpm");
		assert.equal(day(-8).label, "Wednesday, September 30");
	});

	it("Oct 8 without a row (web 204): no data, Pulse Ox not enabled", () => {
		const v = day(0);
		assert.equal(v.headline, "No data available");
		assert.equal(v.copy, "Wear your device while sleeping to reveal your metrics.");
		assert.deepEqual(v.groups.map((g) => g.title), ["NO DATA"]);
		assert.deepEqual(v.metrics.map((m) => m.subtitle), ["No data", "No data", "No data", "No data", "Not enabled during sleep"]);
		assert.ok(v.metrics.every((m) => m.value === "--" && m.pct === undefined));
	});

	it("Sep 16 (inferred): two outliers in an out-of-range group first", () => {
		const v = day(-22);
		assert.equal(v.headline, "2 metrics are out of range");
		assert.deepEqual(v.groups.map((g) => [g.title, g.metrics.map((m) => m.key)]), [["OUT OF RANGE", ["hrv", "resp"]], ["WITHIN RANGE", ["hr", "skin"]], ["NO DATA", ["spo2"]]]);
		assert.equal(v.metrics[1]!.subtitle, "Below 66-92 ms");
	});

	it("formats", () => {
		assert.equal(valueText("skin", -0.3), "-0.3°");
		assert.equal(rangeText("resp", 13, 15.4), "13-15.4 brpm");
		assert.equal(sheetKeyOf("hrv"), "hrv");
		assert.equal(sheetKeyOf("nope"), null);
	});
});

describe("healthSheetView (Sep 29 - Oct 5)", () => {
	const sheet = (key: "hr" | "hrv" | "resp" | "skin") => healthSheetView({ data, sleep, date: "2026-10-05", key });

	it("y ticks reproduce all four sheets", () => {
		assert.deepEqual(sheet("hr").tickLabels, ["64", "59", "54", "49", "44"]);
		assert.deepEqual(sheet("hrv").tickLabels, ["94", "86", "78", "70", "62"]);
		assert.deepEqual(sheet("resp").tickLabels, ["18", "16", "14", "12", "10"]);
		assert.deepEqual(sheet("skin").tickLabels, ["+1.0", "+0.5", "0", "-0.5", "-1.0"]);
	});

	it("the line is the sleep index, the band each day's limits", () => {
		assert.deepEqual(sheet("hr").line, [50, 56, 52, 51, 52, 50, 53]);
		assert.deepEqual(sheet("resp").line, [14.54, 15.07, 14.89, 14.23, 14.5, 13.92, 14.74]);
		assert.deepEqual(sheet("hrv").band.map((b) => b!.hi), [91, 91, 90, 90, 91, 91, 91]);
		assert.deepEqual(sheet("resp").band.map((b) => b!.hi), [15.3, 15.3, 15.4, 15.5, 15.4, 15.5, 15.5]);
		assert.deepEqual(sheet("hr").axis.labels.map((l) => l.text), ["09-29", "10-05"]);
	});

	it("copy, typical range and the big ring", () => {
		const hr = sheet("hr");
		assert.equal(hr.heading, "Within range");
		assert.equal(hr.copy, "Your in-range heart rate for this sleep suggests that you're maintaining your current state of health.");
		assert.equal(hr.metric.range, "47-62 bpm");
		assert.equal(sheet("skin").metric.range, "-0.6° to +0.6°");
		assert.equal(sheet("hrv").info.typicalRange, false);
		const ring = bigRing(40);
		assert.deepEqual([ring.marker.x, ring.marker.y], [70.28, 18.92]);
		assert.equal(miniRing(100).marker.x, 35.45);
	});

	it("chart geometry at the phone: gridlines 44.75 apart, slots 43 to 378", () => {
		const p = sheetPlot(sheet("hr"), PHONE);
		assert.deepEqual(p.grid.map((g) => g.y), [22.5, 67.25, 112, 156.75, 201.5]);
		assert.equal(p.points[0]!.x, 43);
		assert.equal(p.points[6]!.x, 378);
		assert.equal(p.points[6]!.y, 120.95);
	});
});
