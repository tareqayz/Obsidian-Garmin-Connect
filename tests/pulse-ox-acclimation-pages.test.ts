import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { acclimationPlot } from "../src/dashboard/pulse-ox-acclimation-charts";
import { acclimationView, type AcclimationPageData } from "../src/dashboard/pulse-ox-acclimation-pages";
import { PHONE } from "../src/dashboard/stat-charts";
import { PULSE_OX_INDEX, rowsOfAcclimation, type PulseOxRow } from "../src/sync/pulse-ox-index";

/** The capture day (ref/health-stats/pulse-ox-acclimation/README.md). */
const TODAY = "2026-10-08";

/** Daily averages May 22 – Jun 27, 2026; Jun 24 has none. */
const DAILY = "98 97 94 94 95 97 98 96 98 97 96 97 97 96 96 98 94 96 98 98 97 98 98 97 98 96 98 97 96 94 95 96 97 -- 95 97 97";
const shift = (date: string, n: number) => new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

function data(extra: PulseOxRow[] = []): AcclimationPageData {
	const pairs = DAILY.split(" ").flatMap((v, i) => (v === "--" ? [] : [[shift("2026-05-22", i), Number(v)]]));
	const rows = rowsOfAcclimation({ spo2DailyAverageArray: pairs }).map((r) => PULSE_OX_INDEX.normalize(r)!);
	return { rows: [...rows, ...extra].sort((a, b) => (a.date < b.date ? -1 : 1)), complete: true };
}
const at = (range: "7d" | "4w", offset: number) => ({ range, offset });

describe("pulse ox acclimation, TODAY 2026-10-08", () => {
	it("Overall is the half-up mean of the daily averages", () => {
		assert.equal(acclimationView({ data: data(), route: at("7d", -15), today: TODAY }).overallText, "96%");
		assert.equal(acclimationView({ data: data(), route: at("7d", -14), today: TODAY }).overall, 97);
		assert.equal(acclimationView({ data: data(), route: at("4w", -4), today: TODAY }).overall, 97);
		assert.equal(acclimationView({ data: data(), route: at("4w", -3), today: TODAY }).overall, 96);
	});
	it("the current 7d has no chart and --; the 4w draws elevation alone", () => {
		const now = acclimationView({ data: data([{ date: "2026-10-07", elev: 120 }]), route: at("7d", 0), today: TODAY });
		assert.equal(now.label, "Oct 2 - 8");
		assert.equal(now.caption, "Last 7 Days - Overall");
		assert.equal(now.showChart, false);
		assert.equal(now.overallText, "--");
		const w4 = acclimationView({ data: data([{ date: "2026-10-07", elev: 120 }]), route: at("4w", 0), today: TODAY });
		assert.equal(w4.showChart, true);
		assert.deepEqual(w4.elevationLabels, ["5k", "4k", "3k", "2k", "1k", "0"]);
	});
	it("groups elevation by day from the six-minute series", () => {
		const rows = rowsOfAcclimation({ monitoringEnvironmentValuesArray: [[Date.parse("2026-06-15T01:00:00Z"), 100], [Date.parse("2026-06-15T02:00:00Z"), 120]] });
		assert.deepEqual(rows, [{ date: "2026-06-15", elev: 110 }]);
	});
	it("sits on the twin's 4w frame (348:59)", () => {
		const p = acclimationPlot(acclimationView({ data: data(), route: at("4w", -4), today: TODAY }), PHONE, false);
		assert.equal(p.dots[0]!.x, 51);
		assert.equal(p.dots[27]!.x, 359);
		assert.equal(p.rightX, 381.7);
		assert.equal(p.grid[0]!.y, 32.6);
		assert.equal(p.points.length, 28);
	});
});
