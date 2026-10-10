import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import type { GarminApi } from "../src/garmin/endpoints";
import { GarminApiError, GarminRateLimitError } from "../src/garmin/errors";
import {
	ACTIVITY_BLOCKS,
	ACTIVITY_DETAIL_VERSION,
	blocksToFetch,
	buildActivityDetail,
	loadActivity,
	matchesIdentity,
	parseActivityDetail,
	serializeActivityDetail,
	type ActivityBlock,
	type ActivityDetail,
	type ActivityDetailStore,
} from "../src/sync/activity-detail";

// A made-up run: the id, the place and every value are fixtures, not anyone's data.
const ID = 12345678901;
const START = Date.parse("2026-03-12T05:12:00Z");

const SUMMARY = {
	activityId: ID,
	activityName: "Morning Run",
	activityTypeDTO: { typeId: 1, typeKey: "running", parentTypeId: 17 },
	accessControlRuleDTO: { typeId: 2, typeKey: "private" },
	timeZoneUnitDTO: { unitKey: "Europe/Athens", timeZone: "Europe/Athens" },
	metadataDTO: { deviceMetaDataDTO: { deviceId: "42", deviceTypePk: 1, deviceVersionPk: 2 }, hasPolyline: true, lapCount: 2, runPowerWindDataEnabled: true },
	summaryDTO: {
		startTimeLocal: "2026-03-12T07:12:00.0",
		startTimeGMT: "2026-03-12T05:12:00.0",
		startLatitude: 10,
		distance: 1500.5,
		duration: 600.123456,
		averageSpeed: 2.500000123,
		averageHR: 150,
		trainingEffect: 3.200000047683716,
		trainingEffectLabel: "TEMPO",
		minActivityLapDuration: 2.5,
	},
	userInfoDto: { fullname: "Not Kept" },
};

const DETAILS = {
	metricDescriptors: [
		{ metricsIndex: 0, key: "directTimestamp" },
		{ metricsIndex: 1, key: "sumDuration" },
		{ metricsIndex: 2, key: "sumDistance" },
		{ metricsIndex: 3, key: "directHeartRate" },
		{ metricsIndex: 4, key: "directLatitude" },
		{ metricsIndex: 5, key: "directLongitude" },
		{ metricsIndex: 6, key: "directBodyBattery" },
		{ metricsIndex: 7, key: "directPerformanceCondition" },
	],
	activityDetailMetrics: [
		{ metrics: [START, 0, 0, 120, 10.0000012, 20.0000049, 80, null] },
		{ metrics: [START + 5000, 5, 12.345, 125.4, 10.0001, 20.0002, 80, null] },
		{ metrics: [START + 12000, 10, 30.06, null, 10.0002, 20.0004, 79, null] },
	],
	geoPolylineDTO: { minLat: 10, maxLat: 10.0002 },
};

const SPLITS = {
	lapDTOs: [
		{ lapIndex: 1, startTimeGMT: "2026-03-12T05:12:00.0", duration: 355.0561, distance: 1000, averageSpeed: 2.816, averageHR: 141, endLatitude: 10.00011111, endLongitude: 20.00022222 },
		{ lapIndex: 2, startTimeGMT: "2026-03-12T05:17:55.0", duration: 245.067, distance: 500.5, averageSpeed: 2.04 },
	],
};

const TYPED = {
	splits: [
		{ type: "INTERVAL_ACTIVE", startTimeGMT: "2026-03-12T05:12:00.0", endTimeGMT: "2026-03-12T05:22:00.0", duration: 600.12, distance: 1500.5, averageSpeed: 2.500012 },
		{ type: "RWD_WALK", startTimeGMT: "2026-03-12T05:16:07.0", endTimeGMT: "2026-03-12T05:16:11.0", duration: 3.78, distance: 4.79 },
		{ startTimeGMT: "2026-03-12T05:16:07.0" },
	],
};

const HR_ZONES = [
	{ zoneNumber: 2, secsInZone: 72.001, zoneLowBoundary: 122 },
	{ zoneNumber: 1, secsInZone: 4, zoneLowBoundary: 102 },
];

const WEATHER = { temp: 88, apparentTemp: 89, relativeHumidity: 43, windSpeed: 5, windDirection: 210, windDirectionCompassPoint: "ssw", weatherTypeDTO: { desc: "Clear" }, latitude: 1, weatherStationDTO: { name: "Not Kept" } };
const NO_WEATHER = { temp: null, apparentTemp: null, windSpeed: null, weatherTypeDTO: null };

const GEAR = [{ displayName: "Daily trainers", gearTypeName: "Shoes" }, { gearMakeName: "Brand", gearModelName: "Model" }, { uuid: "x" }];
const APP_INFO = { productDisplayName: "Forerunner 970", versionMajorMinor: "18.32", versionString: "18.32.0.0", imageUrl: "https://example.invalid/not-kept.png" };
const WEIGH_IN = { weight: 68040, calendarDate: "2026-03-10" };

const ALL = {
	summary: SUMMARY,
	samples: DETAILS,
	laps: SPLITS,
	segments: TYPED,
	hrZones: HR_ZONES,
	powerZones: [],
	weather: WEATHER,
	gear: GEAR,
	device: APP_INFO,
	weight: WEIGH_IN,
};

describe("buildActivityDetail", () => {
	const detail = buildActivityDetail(ID, ALL, null)!;

	it("keeps the header and the summary's own keys, rounded", () => {
		assert.equal(detail.version, ACTIVITY_DETAIL_VERSION);
		assert.equal(detail.id, ID);
		assert.equal(detail.name, "Morning Run");
		assert.equal(detail.type, "running");
		assert.equal(detail.typeId, 1);
		assert.equal(detail.parentTypeId, 17);
		assert.equal(detail.start, "2026-03-12T07:12:00");
		assert.equal(detail.startGmt, "2026-03-12T05:12:00");
		assert.equal(detail.timeZone, "Europe/Athens");
		assert.equal(detail.privacy, "private");
		assert.equal(detail.deviceVersionPk, 2);
		assert.equal(detail.windData, true);
		// As Garmin sent them: the page rounds once, so a float32 8.6499996 stays 8.6.
		assert.deepEqual(detail.summary, {
			distance: 1500.5,
			duration: 600.123456,
			averageSpeed: 2.500000123,
			averageHR: 150,
			trainingEffect: 3.200000047683716,
			trainingEffectLabel: "TEMPO",
		});
	});

	it("leaves out what the page doesn't read: the profile and the start's coordinates", () => {
		const text = serializeActivityDetail(detail);
		assert.ok(!text.includes("Not Kept"));
		assert.ok(!("startLatitude" in detail.summary));
		assert.ok(!("minActivityLapDuration" in detail.summary));
	});

	it("turns the samples into named columns, with a clock from the start", () => {
		assert.deepEqual(detail.samples, {
			time: [0, 5, 10],
			distance: [0, 12.3, 30.1],
			hr: [120, 125, null],
			lat: [10, 10.0001, 10.0002],
			lon: [20, 20.0002, 20.0004],
			clock: [0, 5, 12],
		});
	});

	it("keeps laps with their end on the map, segments on the clock, zones in order", () => {
		assert.deepEqual(detail.laps, [
			{ n: 1, start: 0, duration: 355.0561, distance: 1000, speed: 2.816, hr: 141, end: [10.00011, 20.00022] },
			{ n: 2, start: 355, duration: 245.067, distance: 500.5, speed: 2.04 },
		]);
		assert.deepEqual(detail.segments, [
			{ type: "INTERVAL_ACTIVE", start: 0, end: 600, duration: 600.12, distance: 1500.5, speed: 2.500012 },
			{ type: "RWD_WALK", start: 247, end: 251, duration: 3.78, distance: 4.79 },
		]);
		assert.deepEqual(detail.hrZones, [
			{ zone: 1, floor: 102, seconds: 4 },
			{ zone: 2, floor: 122, seconds: 72.001 },
		]);
		assert.deepEqual(detail.powerZones, []);
	});

	it("keeps the weather without its station, the gear's names and the watch", () => {
		assert.deepEqual(detail.weather, { temp: 88, feelsLike: 89, humidity: 43, wind: 5, windFrom: 210, compass: "ssw", desc: "Clear" });
		assert.deepEqual(detail.gear, [{ name: "Daily trainers", type: "Shoes" }, { name: "Brand Model" }]);
		assert.deepEqual(detail.device, { name: "Forerunner 970", firmware: "18.32" });
		assert.equal(detail.weightKg, 68.04);
		assert.deepEqual(detail.checked, [...ACTIVITY_BLOCKS]);
	});

	it("reads indoor weather as none, and no GPS as no route", () => {
		const indoor = buildActivityDetail(ID, { ...ALL, weather: NO_WEATHER, samples: { ...DETAILS, metricDescriptors: DETAILS.metricDescriptors.slice(0, 4) } }, null)!;
		assert.equal(indoor.weather, null);
		assert.ok(!("lat" in indoor.samples));
	});

	it("needs a summary or a file to build on", () => {
		assert.equal(buildActivityDetail(ID, { samples: DETAILS }, null), null);
		assert.equal(buildActivityDetail(ID, { summary: null }, null), null);
	});

	it("replaces only the blocks fetched", () => {
		const base: ActivityDetail = { ...detail, weather: null, checked: detail.checked.filter((b) => b !== "weather") };
		const next = buildActivityDetail(ID, { weather: WEATHER }, base)!;
		assert.deepEqual(next.weather?.temp, 88);
		assert.deepEqual(next.laps, detail.laps);
		assert.deepEqual(next.checked, [...ACTIVITY_BLOCKS]);
	});
});

describe("a detail file", () => {
	const detail = buildActivityDetail(ID, ALL, null)!;

	it("reads back what it wrote, and nothing of another version", () => {
		assert.deepEqual(parseActivityDetail(serializeActivityDetail(detail)), detail);
		assert.equal(parseActivityDetail(serializeActivityDetail({ ...detail, version: 0 })), null);
		assert.equal(parseActivityDetail("{"), null);
		assert.equal(parseActivityDetail("[]"), null);
	});

	it("is out of date once the activity is renamed or trimmed", () => {
		assert.ok(matchesIdentity(detail, { name: "Morning Run", distance: 1500.5, duration: 600.12 }));
		assert.ok(matchesIdentity(detail, null));
		assert.ok(!matchesIdentity(detail, { name: "Evening Run" }));
		assert.ok(!matchesIdentity(detail, { distance: 1400 }));
		assert.ok(!matchesIdentity(detail, { duration: 590 }));
	});

	it("asks for the blocks it lacks, and for all of them when out of date", () => {
		assert.deepEqual(blocksToFetch(null), [...ACTIVITY_BLOCKS]);
		assert.deepEqual(blocksToFetch(detail), []);
		assert.deepEqual(blocksToFetch({ ...detail, checked: ["summary", "samples"] }), ACTIVITY_BLOCKS.slice(2));
		assert.deepEqual(blocksToFetch(detail, { name: "Renamed" }), [...ACTIVITY_BLOCKS]);
	});
});

/* ------------------------------------------------------------------ */

class MemoryStore implements ActivityDetailStore {
	files = new Map<number, string>();
	writes = 0;
	async readActivityDetail(id: number): Promise<ActivityDetail | null> {
		const text = this.files.get(id);
		return text === undefined ? null : parseActivityDetail(text);
	}
	async writeActivityDetail(id: number, detail: ActivityDetail): Promise<"written" | "unchanged"> {
		const text = serializeActivityDetail(detail);
		if (this.files.get(id) === text) return "unchanged";
		this.files.set(id, text);
		this.writes += 1;
		return "written";
	}
}

const METHOD: Record<ActivityBlock, string> = {
	summary: "activity",
	samples: "activityDetails",
	laps: "activitySplits",
	segments: "activityTypedSplits",
	hrZones: "activityHrZones",
	powerZones: "activityPowerZones",
	weather: "activityWeather",
	gear: "activityGear",
	device: "deviceAppInfo",
	weight: "weightLatest",
};

/** An API that answers each block from `answers`: a payload, or an error to throw. */
function fakeApi(answers: Partial<Record<ActivityBlock, unknown>>): { api: GarminApi; calls: string[]; args: Record<string, unknown> } {
	const calls: string[] = [];
	const args: Record<string, unknown> = {};
	const api: Record<string, unknown> = {};
	for (const block of ACTIVITY_BLOCKS) {
		api[METHOD[block]] = async (arg: unknown) => {
			calls.push(block);
			args[block] = arg;
			const answer = block in answers ? answers[block] : ALL[block];
			if (answer instanceof Error) throw answer;
			return answer;
		};
	}
	return { api: api as unknown as GarminApi, calls, args };
}

const SIGNED_IN = { signedIn: true, groups: ["workouts" as const] };

describe("loadActivity", () => {
	it("fetches every block once, writes the file, and is answered from it next time", async () => {
		const store = new MemoryStore();
		const { api, calls } = fakeApi({});
		const first = await loadActivity(api, store, ID, SIGNED_IN);
		assert.equal(first.reason, undefined);
		assert.equal(first.detail?.name, "Morning Run");
		assert.deepEqual(calls.sort(), [...ACTIVITY_BLOCKS].sort());
		assert.equal(store.writes, 1);

		const again = await loadActivity(api, store, ID, SIGNED_IN);
		assert.equal(again.reason, undefined);
		assert.equal(calls.length, ACTIVITY_BLOCKS.length);
	});

	it("asks for the device and the weight once the summary gives the firmware id and the day", async () => {
		const { api, calls, args } = fakeApi({});
		await loadActivity(api, new MemoryStore(), ID, SIGNED_IN);
		assert.deepEqual(calls.slice(-2).sort(), ["device", "weight"]);
		assert.equal(args.device, 2);
		assert.equal(args.weight, "2026-03-12");
	});

	it("asks nothing after a 429, and nothing for the device without a firmware id", async () => {
		const limited = fakeApi({ samples: new GarminRateLimitError("slow down") });
		await loadActivity(limited.api, new MemoryStore(), ID, SIGNED_IN);
		assert.ok(!limited.calls.includes("device") && !limited.calls.includes("weight"));

		const noFirmware = fakeApi({ summary: { ...SUMMARY, metadataDTO: { lapCount: 2 } } });
		const load = await loadActivity(noFirmware.api, new MemoryStore(), ID, SIGNED_IN);
		assert.ok(!noFirmware.calls.includes("device"));
		assert.equal(load.detail?.device, null);
		assert.ok(load.detail?.checked.includes("device"));
	});

	it("says why it can't fetch, without asking Garmin", async () => {
		const store = new MemoryStore();
		const { api, calls } = fakeApi({});
		assert.deepEqual(await loadActivity(api, store, ID, { signedIn: false, groups: ["workouts"] }), { detail: null, reason: "signed-out" });
		assert.deepEqual(await loadActivity(api, store, ID, { signedIn: true, groups: ["sleep"] }), { detail: null, reason: "off" });
		assert.equal(calls.length, 0);
	});

	it("keeps what came back when one block fails, and asks only for that block next view", async () => {
		const store = new MemoryStore();
		const failing = fakeApi({ weather: new GarminApiError("server error", 500, "") });
		const first = await loadActivity(failing.api, store, ID, SIGNED_IN);
		assert.equal(first.reason, "failed");
		assert.equal(first.detail?.weather, null);
		assert.ok(!first.detail?.checked.includes("weather"));

		const fixed = fakeApi({});
		const second = await loadActivity(fixed.api, store, ID, SIGNED_IN);
		assert.equal(second.reason, undefined);
		assert.deepEqual(fixed.calls, ["weather"]);
		assert.equal(second.detail?.weather?.temp, 88);
	});

	it("fetches everything again once the index shows the activity renamed", async () => {
		const store = new MemoryStore();
		await loadActivity(fakeApi({}).api, store, ID, SIGNED_IN);
		const { api, calls } = fakeApi({ summary: { ...SUMMARY, activityName: "Renamed Run" } });
		const load = await loadActivity(api, store, ID, { ...SIGNED_IN, row: { name: "Renamed Run" } });
		assert.equal(load.detail?.name, "Renamed Run");
		assert.equal(calls.length, ACTIVITY_BLOCKS.length);
	});

	it("reads a deleted activity as unavailable, and a 429 as fatal", async () => {
		const gone = await loadActivity(fakeApi({ summary: new GarminApiError("not found", 404, "") }).api, new MemoryStore(), ID, SIGNED_IN);
		assert.equal(gone.reason, "unavailable");
		assert.equal(gone.detail, null);

		const limited = await loadActivity(fakeApi({ summary: new GarminRateLimitError("slow down") }).api, new MemoryStore(), ID, SIGNED_IN);
		assert.equal(limited.reason, "failed");
		assert.ok(limited.fatal instanceof GarminRateLimitError);
	});
});
