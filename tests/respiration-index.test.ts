import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import type { DailySummary, GarminApi, RespirationDay } from "../src/garmin/endpoints";
import type { DaySeries } from "../src/sync/intraday";
import { RESPIRATION_DAY, RESPIRATION_DAY_KEY, RESPIRATION_INDEX, respirationDayIn, respirationDayOf, rowOfStat } from "../src/sync/respiration-index";

describe("RESPIRATION_INDEX", () => {
	it("takes 31-day windows and keeps a night a summary lacks", () => {
		assert.equal(RESPIRATION_INDEX.windowDays, 31);
		assert.equal(RESPIRATION_INDEX.keepOld, true);
		assert.deepEqual(RESPIRATION_INDEX.keys, ["awake", "sleep"]);
	});

	it("maps the range's flat rows, dropping a null night", async () => {
		const api = {
			respirationDaily: async () => [
				{ calendarDate: "2026-10-07", avgWakingRespiration: 14.0, avgSleepRespiration: 14.0 },
				{ calendarDate: "2026-10-08", avgWakingRespiration: 13.0, avgSleepRespiration: null },
			],
		} as unknown as GarminApi;
		const rows = (await RESPIRATION_INDEX.fetchWindow(api, "2026-10-07", "2026-10-08")).map((r) => RESPIRATION_INDEX.normalize(r));
		assert.deepEqual(rows, [
			{ date: "2026-10-07", awake: 14, sleep: 14 },
			{ date: "2026-10-08", awake: 13 },
		]);
		assert.deepEqual(RESPIRATION_INDEX.normalize(rowOfStat(null)), null);
	});

	it("fills the awake value from the daily summary", () => {
		const row = RESPIRATION_INDEX.fromSummary!({ avgWakingRespirationValue: 14 } as DailySummary, "2026-10-07");
		assert.deepEqual(RESPIRATION_INDEX.normalize({ date: "2026-10-07", ...row }), { date: "2026-10-07", awake: 14 });
	});
});

describe("RESPIRATION_DAY", () => {
	const payload: RespirationDay = {
		startTimestampGMT: "2026-10-06T21:00:00.0",
		endTimestampGMT: "2026-10-07T20:00:00.0",
		startTimestampLocal: "2026-10-07T00:00:00.0",
		endTimestampLocal: "2026-10-08T00:00:00.0",
		sleepStartTimestampGMT: "2026-10-06T17:54:19.0",
		sleepEndTimestampGMT: "2026-10-07T03:54:19.0",
		tomorrowSleepStartTimestampGMT: null,
		lowestRespirationValue: 7,
		highestRespirationValue: 21,
		avgWakingRespirationValue: 14,
		respirationValuesArray: [[1791320520000, 13]],
		respirationAveragesValuesArray: [
			[1791324000000, 13.91, 17, 9],
			[1791385200000, -2, null, null],
		],
	};

	it("keeps the hourly rows with their codes, the bounds, the night and the figures, not the two-minute values", () => {
		const day = respirationDayOf(payload)!;
		assert.equal(RESPIRATION_DAY.key, RESPIRATION_DAY_KEY);
		assert.equal(day.end - day.start, 23 * 3_600_000);
		assert.equal(day.startOffset, 3 * 3_600_000);
		assert.equal(day.endOffset, 4 * 3_600_000);
		assert.deepEqual(day.hours, [
			[1791324000000, 13.91, 17, 9],
			[1791385200000, -2, null, null],
		]);
		assert.equal(day.sleepEnd, Date.parse("2026-10-07T03:54:19Z"));
		assert.equal(day.nextSleepStart, undefined);
		assert.deepEqual([day.lowest, day.highest, day.awake], [7, 21, 14]);
		assert.equal("values" in day, false);
	});

	it("reads back what the series file kept, and nothing from a day Garmin never had", () => {
		const day = respirationDayOf(payload)!;
		const series = { extra: { [RESPIRATION_DAY_KEY]: JSON.parse(JSON.stringify(day)) } } as unknown as DaySeries;
		assert.deepEqual(respirationDayIn(series), day);
		assert.equal(respirationDayOf({ startTimestampGMT: null, respirationAveragesValuesArray: [] } as RespirationDay), null);
		assert.equal(respirationDayIn(null), null);
	});
});
