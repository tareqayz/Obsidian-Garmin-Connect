import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { snapshotPlot, snapshotTicks } from "../src/dashboard/health-snapshot-charts";
import { meanFigure, snapshotDetailView, snapshotListView } from "../src/dashboard/health-snapshot-pages";
import { PHONE } from "../src/dashboard/stat-charts";
import type { HealthSnapshotSummary } from "../src/garmin/endpoints";
import { SNAPSHOT_DAY, SNAPSHOT_LIST, snapshotListOf, snapshotSamplesOf, type SnapshotSample } from "../src/sync/health-snapshot-index";

/** Snapshots do not change after recording; the capture day is 2026-10-08 (ref/health-stats/health-snapshot/README.md). */
const TODAY = "2026-10-08";

/** A list row as `summary/list` sends it (api-samples/list-until-2026-10-08-start-1-limit-20.json), trimmed to what the plugin reads. */
function snap(uuid: string, date: string, name: string, local: string, gmt: string, f: number[][], sw: string): HealthSnapshotSummary {
	const types = ["HEART_RATE", "RESPIRATION", "STRESS", "SPO2"];
	return {
		activityUuid: { uuid },
		calendarDate: date,
		activityName: name,
		startTimestampLocal: `${local}.0`,
		startTimestampGMT: `${gmt}.0`,
		summaryTypeDataList: [
			...types.map((summaryType, i) => ({ summaryType, minValue: f[i]![0]!, avgValue: f[i]![1]!, maxValue: f[i]![2]! })),
			{ summaryType: "RMSSD_HRV", avgValue: f[4]![0]! },
			{ summaryType: "SDRR_HRV", avgValue: f[4]![1]! },
		],
		deviceMetaData: { deviceName: "Forerunner 970", deviceVersion: sw },
	};
}

/** In the REST list's order, newest first; the GraphQL order (oldest first) is tested reversed. */
const LIST: HealthSnapshotSummary[] = [
	snap("c0faeeaf", "2026-09-24", "Health Snapshot - Afternoon", "2026-09-24T12:07:35", "2026-09-24T09:07:35", [[59, 76, 93], [13, 16.309999465942383, 19], [28, 45, 66], [97, 99, 100], [86, 100]], "18.29"),
	snap("2d7672db", "2026-01-12", "Health Snapshot - Evening", "2026-01-12T18:10:17", "2026-01-13T02:10:17", [[61, 64, 75], [8, 11.85, 16], [33, 44, 62], [99, 100, 100], [49, 87]], "15.33"),
	snap("e5f787b1", "2025-09-09", "Health Snapshot - Morning", "2025-09-09T09:32:32", "2025-09-09T16:32:32", [[75, 85, 96], [16, 19.35, 23], [56, 74, 84], [99, 99, 100], [61, 70]], "12.70"),
	snap("f399110f", "2025-09-09", "Health Snapshot - Morning", "2025-09-09T09:21:05", "2025-09-09T16:21:05", [[77, 85, 93], [11, 12.92, 14], [76, 79, 83], [99, 100, 100], [58, 52]], "12.70"),
	snap("c251aebf", "2025-08-22", "Health Snapshot - Evening", "2025-08-22T18:33:15", "2025-08-23T01:33:15", [[76, 83, 90], [13, 16.79, 20], [68, 76, 83], [98, 99, 100], [46, 56]], "12.70"),
];

/** epoch-2026-09-24-c0faeeaf.json, column by column; "_" is null. */
const SEP_24 = {
	hr: "67 67 67 67 68 69 70 70 71 71 71 71 72 72 71 71 71 72 73 74 79 83 85 86 86 87 86 86 86 81 73 70 69 69 69 68 68 69 70 71 71 75 78 79 80 80 80 80 81 81 82 82 82 83 83 82 82 79 77 75 73 72 72 71 71 69 68 67 67 67 67 69 71 72 74 78 78 80 83 84 84 85 84 82 82 86 89 92 93 93 93 92 88 88 89 88 87 84 85 85 86 87 86 86 84 81 76 71 67 64 61 60 59 59 62 64 66 68 69 69 70",
	stress: "29 29 29 29 29 29 29 29 29 29 29 29 29 29 29 29 29 29 29 29 28 28 28 28 28 36 36 36 36 36 45 45 45 45 45 46 46 46 46 46 49 49 49 49 49 49 49 49 49 49 50 50 50 50 50 51 51 51 51 51 50 50 50 50 50 48 48 48 48 48 48 48 48 48 48 43 43 43 43 43 42 42 42 42 42 36 36 36 36 36 37 37 37 37 37 46 46 46 46 46 54 54 54 54 54 66 66 66 66 66 66 66 66 66 66 65 65 65 65 65 57",
	spo2: "_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ 97 97 99 99 99 99 99 99 99 99 99 99 99 99 99 99 99 100 99 99 99 100 100 100 100 100 100 100 100 100 100",
	resp: "18 18 18 19 19 19 19 19 19 19 19 19 19 19 19 19 19 19 18 18 18 18 18 18 18 18 18 18 18 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 17 16 16 16 16 16 16 16 15 15 15 15 15 15 15 14 14 14 14 14 14 14 14 14 13 13 13 13 13 13 13 13 13 13 13 13 13 13 13 13 13 13 13 13",
};
const col = (s: string) => s.split(" ").map((v) => (v === "_" ? null : Number(v)));
const T0 = 1790240855000;
const EPOCHS = {
	activityUuid: "c0faeeaf",
	epochDescriptorDTOList: ["timestamp", "heartRate", "stress", "spo2", "respiration"].map((key, index) => ({ key, index })),
	epochArray: col(SEP_24.hr).map((hr, i) => [T0 + i * 1000, hr, col(SEP_24.stress)[i]!, col(SEP_24.spo2)[i]!, col(SEP_24.resp)[i]!]),
};

describe("extras", () => {
	it("are keyed as registered", () => {
		assert.equal(SNAPSHOT_LIST.key, "snapshotList");
		assert.equal(SNAPSHOT_DAY.key, "snapshotDay");
	});
	it("the list sorts newest first whatever the order sent", () => {
		assert.deepEqual(snapshotListOf([...LIST].reverse()).map((r) => r.uuid), LIST.map((s) => s.activityUuid!.uuid));
	});
	it("samples: 121 a second apart, SpO2 from 1:30", () => {
		const s = snapshotSamplesOf(EPOCHS);
		assert.equal(s.length, 121);
		assert.equal(s.at(-1)![0], 120);
		assert.equal(s.findIndex((x) => x[3] !== null), 90);
	});
});

describe("list", () => {
	it("five rows, newest first, the local clock as sent", () => {
		assert.deepEqual(snapshotListView(snapshotListOf(LIST)).map((i) => `${i.title} · ${i.detail}`), [
			"Health Snapshot - Afternoon · 2026-09-24, 12:07 PM",
			"Health Snapshot - Evening · 2026-01-12, 6:10 PM",
			"Health Snapshot - Morning · 2025-09-09, 9:32 AM",
			"Health Snapshot - Morning · 2025-09-09, 9:21 AM",
			"Health Snapshot - Evening · 2025-08-22, 6:33 PM",
		]);
	});
});

describe("detail", () => {
	const rows = snapshotListOf(LIST);
	const samples: SnapshotSample[] = snapshotSamplesOf(EPOCHS);
	it("2026-09-24 12:07: every figure", () => {
		const v = snapshotDetailView(rows[0]!, samples);
		assert.equal(v.title, "Health Snapshot - Afternoon");
		assert.equal(v.date, "September 24, 2026");
		assert.equal(v.time, "12:07 PM");
		assert.deepEqual(v.sections.map((s) => s.figures.map((f) => `${f.value} ${f.label}`)), [
			["76 bpm Average", "93 bpm Highest", "86 ms HRV (RMSSD)", "100 ms HRV (SDRR)"],
			["99% Average", "97% Lowest"],
			["16 brpm Average", "19 brpm Highest"],
			["45 Average", "66 Highest"],
		]);
		assert.deepEqual(v.device, { name: "Forerunner 970", version: "18.29" });
	});
	it("2026-01-12 18:10 (UTC−8): the local day and clock, respiration 11.85 → 12", () => {
		const v = snapshotDetailView(rows[1]!, null);
		assert.equal(v.date, "January 12, 2026");
		assert.equal(v.time, "6:10 PM");
		assert.equal(v.sections[2]!.figures[0]!.value, "12 brpm");
		assert.equal(v.samples, false);
	});
	it("averages are round(mean) of the samples", () => {
		assert.equal(meanFigure(samples.map((s) => s[1])), 76);
		assert.equal(meanFigure(samples.map((s) => s[2])), 45);
		assert.equal(meanFigure(samples.map((s) => s[3])), 99);
		assert.equal(Math.round(samples.reduce((a, s) => a + s[4]!, 0) / 121 * 100) / 100, 16.31);
	});
});

describe("chart geometry at PHONE = 402 (twin 347:163)", () => {
	const v = snapshotDetailView(snapshotListOf(LIST)[0]!, snapshotSamplesOf(EPOCHS));
	it("ticks: HR 90–60, Pulse Ox 100–60, respiration 18–14, stress 100–0", () => {
		assert.deepEqual(v.sections.map((s) => snapshotTicks(s.id, s.series.flatMap(([, x]) => (x === null ? [] : [x])))), [
			[90, 80, 70, 60], [100, 90, 80, 70, 60], [18, 16, 14], [100, 75, 50, 25, 0],
		]);
	});
	it("HR: plot 40 → 379, average line at 76, axis 0:00 … 2:00", () => {
		const p = snapshotPlot(v.sections[0]!, PHONE);
		assert.equal(p.dots[0]!.x, 40);
		assert.equal(p.dots.at(-1)!.x, 379);
		assert.deepEqual(p.labels.map((l) => l.text), ["0:00", "0:24", "0:48", "1:12", "1:36", "2:00"]);
		assert.equal(p.average!.y, 78.67);
		assert.equal(p.grid[0]!.y, 53);
		assert.equal(p.grid.at(-1)!.y, 108);
	});
	it("Pulse Ox starts at 1:30 (x 294.25)", () => {
		const p = snapshotPlot(v.sections[1]!, PHONE);
		assert.ok(p.path.startsWith("M294.25 "));
	});
});
void TODAY;
