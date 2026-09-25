import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
	epochOf,
	latestValue,
	mapAccount,
	mapSeries,
	parseSeries,
	serializeSeries,
} from "../src/sync/intraday";

describe("mapSeries", () => {
	it("finds the stress and Body Battery columns from Garmin's descriptors", () => {
		const series = mapSeries({
			stress: {
				stressValueDescriptorsDTOList: [
					{ key: "timestamp", index: 0 },
					{ key: "stressLevel", index: 1 },
				],
				stressValuesArray: [
					[1_000, 30],
					[2_000, -2],
				],
				bodyBatteryValueDescriptorsDTOList: [
					{ key: "timestamp", index: 0 },
					{ key: "bodyBatteryStatus", index: 1 },
					{ key: "bodyBatteryLevel", index: 2 },
				],
				bodyBatteryValuesArray: [[1_000, "MEASURED", 55, 2.0]],
			},
		});
		assert.deepEqual(series.stress, [
			[1_000, 30],
			[2_000, null],
		]);
		assert.deepEqual(series.bodyBattery, [[1_000, 55]]);
	});

	it("turns zone-less GMT strings into epoch millis", () => {
		const series = mapSeries({
			steps: [{ startGMT: "2026-09-12T08:00:00.0", endGMT: "2026-09-12T08:15:00.0", steps: 300, primaryActivityLevel: "active" }],
			sleep: { sleepLevels: [{ startGMT: "2026-09-11T22:00:00.0", endGMT: "2026-09-11T22:30:00.0", activityLevel: 1 }] },
		});
		assert.deepEqual(series.steps, [
			{ start: Date.UTC(2026, 8, 12, 8), end: Date.UTC(2026, 8, 12, 8, 15), steps: 300, level: "active" },
		]);
		assert.deepEqual(series.sleepLevels, [
			{ start: Date.UTC(2026, 8, 11, 22), end: Date.UTC(2026, 8, 11, 22, 30), level: 1 },
		]);
	});

	it("reduces Body Battery events to markers", () => {
		const series = mapSeries({
			bodyBatteryEvents: [
				{
					event: {
						eventType: "SLEEP",
						eventStartTimeGmt: "2026-09-11T22:00:00.0",
						durationInMilliseconds: 27_000_000,
						bodyBatteryImpact: 52,
						shortFeedback: "RESTFUL_PERIOD",
					},
				},
			],
		});
		assert.deepEqual(series.bodyBatteryEvents, [
			{ type: "SLEEP", start: Date.UTC(2026, 8, 11, 22), minutes: 450, impact: 52, feedback: "RESTFUL_PERIOD" },
		]);
	});

	it("is empty for empty payloads", () => {
		assert.deepEqual(mapSeries({ stress: {}, heartRate: {}, steps: [], bodyBatteryEvents: null }), {});
	});
});

describe("latestValue", () => {
	it("skips trailing gaps", () => {
		assert.equal(latestValue([[1, 50], [2, 55], [3, null]]), 55);
		assert.equal(latestValue([]), undefined);
	});
});

describe("epochOf", () => {
	it("keeps explicit zones and numbers", () => {
		assert.equal(epochOf(5), 5);
		assert.equal(epochOf("2026-09-12T08:00:00+02:00"), Date.UTC(2026, 8, 12, 6));
		assert.equal(epochOf("nonsense"), undefined);
	});
});

describe("series file", () => {
	it("round-trips and is byte-stable for the same input", () => {
		const series = mapSeries({ heartRate: { heartRateValues: [[1, 60]] } });
		const text = serializeSeries("2026-09-12", series);
		assert.equal(text, serializeSeries("2026-09-12", series));
		assert.deepEqual(parseSeries(text), series);
		assert.equal(parseSeries("{not json"), null);
	});
});

describe("mapAccount", () => {
	it("keeps the name and avatar URLs and nothing else", () => {
		assert.deepEqual(
			mapAccount({
				displayName: "abc",
				fullName: "A Runner",
				profileImageUrlLarge: "https://s3.example/large.png",
				profileId: 42,
				location: "somewhere",
			}),
			{ displayName: "abc", fullName: "A Runner", avatar: { large: "https://s3.example/large.png" } },
		);
		assert.equal(mapAccount(null), null);
	});
});
