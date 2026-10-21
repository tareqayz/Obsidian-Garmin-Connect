import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { shiftDate } from "../src/sync/day-index";
import { ASSUMED_HORIZON_DAYS, cutOf, learn, MISSES_TO_LEARN, parseHorizon, plannedCut, timelineVerdict, type TimelineVerdict } from "../src/sync/horizons";
import { mapSeries } from "../src/sync/intraday";

const TODAY = "2026-10-21";
const at = (date: string, hour: number) => Date.parse(`${date}T${String(hour).padStart(2, "0")}:00:00Z`);

describe("what a day's timelines say about the horizon", () => {
	it("served when any of the four holds points, missed when only totals came, nothing on a day not worn", () => {
		const date = "2026-05-01";
		assert.equal(timelineVerdict({ stress: { avgStressLevel: 30, stressValuesArray: [[at(date, 8), 25]] } }, null), "served");
		assert.equal(timelineVerdict({ stress: { avgStressLevel: 30, stressValuesArray: [] }, heartRate: { restingHeartRate: 52, heartRateValues: null } }, null), "missed");
		// Floors have no total of their own: the summary's count says there were some.
		assert.equal(timelineVerdict({ floors: { floorValuesArray: [] } }, { floorsAscended: 4 } as never), "missed");
		assert.equal(timelineVerdict({ intensity: { startDayMinutes: 40, endDayMinutes: 70, imValuesArray: null } }, null), "missed");
		assert.equal(timelineVerdict({ stress: { avgStressLevel: -1, stressValuesArray: [] } }, null), "none");
		assert.equal(timelineVerdict({}, null), "none");
	});
});

describe("learning the horizon", () => {
	/** Days going back from `from`, newest first, all with the same verdict. */
	const run = (from: string, n: number, verdict: TimelineVerdict): Array<[string, TimelineVerdict]> => Array.from({ length: n }, (_, i) => [shiftDate(from, -i), verdict]);

	it(`is set by ${MISSES_TO_LEARN} misses in a row: Garmin keeps the days younger than the newest of them`, () => {
		const newest = shiftDate(TODAY, -142);
		const heard = [...run(shiftDate(TODAY, -100), 42, "served"), ...run(newest, MISSES_TO_LEARN, "missed")];
		const got = learn(undefined, { misses: 0 }, heard, TODAY);
		assert.equal(got.horizon, 141);
		assert.equal(cutOf(got.horizon, TODAY), newest);
		// Six are not enough, and a day not worn neither breaks nor extends the run.
		assert.equal(learn(undefined, { misses: 0 }, run(newest, MISSES_TO_LEARN - 1, "missed"), TODAY).horizon, undefined);
		const gapped = [...run(newest, 3, "missed"), [shiftDate(newest, -3), "none"] as [string, TimelineVerdict], ...run(shiftDate(newest, -4), 4, "missed")];
		assert.equal(learn(undefined, { misses: 0 }, gapped, TODAY).horizon, 141);
	});

	it("carries a run across chunks, and is cleared by a day served past it", () => {
		const newest = shiftDate(TODAY, -150);
		const first = learn(undefined, { misses: 0 }, run(newest, 4, "missed"), TODAY);
		assert.deepEqual(first.streak, { misses: 4, newest });
		const second = learn(first.horizon, first.streak, run(shiftDate(newest, -4), 3, "missed"), TODAY);
		assert.equal(second.horizon, 149);
		// The check of an old day finds Garmin keeping it again.
		assert.equal(learn(149, { misses: 0 }, [[shiftDate(TODAY, -400), "served"]], TODAY).horizon, null);
		// A served day younger than the horizon changes nothing.
		assert.equal(learn(149, { misses: 0 }, [[shiftDate(TODAY, -20), "served"]], TODAY).horizon, 149);
	});

	it("learns nothing from empty timelines on recent days: that is something else going wrong", () => {
		assert.equal(learn(undefined, { misses: 0 }, run(shiftDate(TODAY, -2), 10, "missed"), TODAY).horizon, undefined);
	});

	it("reckons with the assumed horizon until one is learned, none once Garmin served past it", () => {
		assert.equal(plannedCut(undefined, TODAY), shiftDate(TODAY, -(ASSUMED_HORIZON_DAYS + 1)));
		assert.equal(plannedCut(null, TODAY), null);
		assert.equal(plannedCut(100, TODAY), shiftDate(TODAY, -101));
	});

	it("reads back a horizon of this data version only", () => {
		assert.equal(parseHorizon({ days: 141, version: 2 }, 2), 141);
		assert.equal(parseHorizon({ days: null, version: 2 }, 2), null);
		assert.equal(parseHorizon({ days: 141, version: 1 }, 2), undefined);
		assert.equal(parseHorizon({ days: 3, version: 2 }, 2), undefined);
	});
});

describe("a series past the horizon", () => {
	it("starts its day at the steps chart's first bucket when floors and intensity weren't asked", () => {
		const start = at("2025-03-02", 5);
		const series = mapSeries({ steps: [{ startGMT: "2025-03-02T05:00:00.0", endGMT: "2025-03-02T05:15:00.0", steps: 12 }] as never });
		assert.equal(series.dayStart, start);
	});
});
