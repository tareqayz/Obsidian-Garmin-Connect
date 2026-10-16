import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import type { GarminApi } from "../src/garmin/endpoints";
import { GarminApiError, GarminBlockedError, GarminRateLimitError } from "../src/garmin/errors";
import { NewerDataError } from "../src/sync/file-health";
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
const BADGES = [{ badgeId: 15, badgeKey: "cycle_climb_500ft", badgeName: "Climber 1", badgePoints: 1 }, { badgeId: 16, badgeName: "  " }];

/** The run with power and its time in power zones: every block applies. */
const POWERED = {
	...SUMMARY,
	metadataDTO: { ...SUMMARY.metadataDTO, hasPowerTimeInZones: true },
	summaryDTO: { ...SUMMARY.summaryDTO, averagePower: 250 },
};

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
	badges: BADGES,
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

	it("knows whether there is a route and power zones, and keeps the badges by name and key", () => {
		assert.equal(detail.hasPolyline, true);
		assert.equal("hasPowerZones" in detail, false);
		assert.deepEqual(detail.badges, [{ name: "Climber 1", key: "cycle_climb_500ft" }]);
		assert.equal("badges" in buildActivityDetail(ID, { ...ALL, badges: [] }, null)!, false);
	});
});

describe("buildActivityDetail — every sport (version 6)", () => {
	const RIDE_SUMMARY = {
		...POWERED,
		activityTypeDTO: { typeId: 10, typeKey: "road_biking", parentTypeId: 2 },
		metadataDTO: {
			...POWERED.metadataDTO,
			sensors: [
				{ fitProductNumber: 3578, sku: "006-B3578-00", sourceType: "ANTPLUS", softwareVersion: 4.1, batteryStatus: "OK", antplusDeviceType: "BIKE_POWER", serialNumber: 8_808_808 },
				{ fitProductNumber: 999_999, antplusDeviceType: "HEART_RATE", batteryLevel: 73.4, serialNumber: 9_909_909 },
				{ batteryStatus: "LOW" },
			],
		},
		summaryDTO: { ...POWERED.summaryDTO, averageBikeCadence: 81, intensityFactor: 0.609000027, trainingStressScore: 35.0999985, totalWork: 125.536, leftBalance: 49.27, seatedTime: 3405.44 },
	};
	const RIDE_DETAILS = {
		metricDescriptors: [
			{ metricsIndex: 0, key: "directTimestamp" },
			{ metricsIndex: 1, key: "directBikeCadence" },
			{ metricsIndex: 2, key: "directRightBalance" },
			{ metricsIndex: 3, key: "directLeftPowerPhaseStart" },
			{ metricsIndex: 4, key: "directRightPlatformCenterOffset" },
			{ metricsIndex: 5, key: "directFractionalCadence" },
		],
		activityDetailMetrics: [
			{ metrics: [START, 80, 50.73, 11.25, -9, 0] },
			{ metrics: [START + 1000, 82, 49.9, 12.04, -8, 0] },
		],
	};
	const RIDE_SPLITS = {
		lapDTOs: [{ lapIndex: 1, startTimeGMT: "2026-03-12T05:12:00.0", duration: 633.3, distance: 5000, averageSpeed: 7.9, averageBikeCadence: 80, maxPower: 398, normalizedPower: 167 }],
		eventDTOs: [
			{ startTimeGMT: "2026-03-12T05:12:00.0", startTimeGMTDoubleValue: START, sectionTypeDTO: { id: 1, key: "timerTrigger" } },
			{ startTimeGMT: "2026-03-12T05:12:45.0", startTimeGMTDoubleValue: START + 45_000, riderPosition: 3, sectionTypeDTO: { id: 7000, key: "riderPosition", sectionTypeKey: "RIDER_POSITION" } },
			{ startTimeGMT: "2026-03-12T05:12:30.0", startTimeGMTDoubleValue: START + 30_000, riderPosition: 0, sectionTypeDTO: { id: 7000, key: "riderPosition" } },
		],
	};
	const ride = buildActivityDetail(ID, { ...ALL, summary: RIDE_SUMMARY, samples: RIDE_DETAILS, laps: RIDE_SPLITS }, null)!;

	it("keeps a ride's cadence, balance, power phase and platform offset columns, and its new summary keys", () => {
		assert.deepEqual(ride.samples, { bikeCadence: [80, 82], balanceRight: [50.7, 49.9], ppStartL: [11.3, 12], pcoR: [-9, -8], clock: [0, 1] });
		assert.equal(ride.summary.averageBikeCadence, 81);
		assert.equal(ride.summary.intensityFactor, 0.609000027);
		assert.equal(ride.summary.totalWork, 125.536);
		assert.equal(ride.summary.leftBalance, 49.27);
		assert.equal(ride.summary.seatedTime, 3405.44);
	});

	it("keeps a ride's laps' cadence and power, and its rider positions on the clock in order", () => {
		assert.deepEqual(ride.laps[0], { n: 1, start: 0, duration: 633.3, distance: 5000, speed: 7.9, bikeCadence: 80, maxPower: 398, normalizedPower: 167 });
		assert.deepEqual(ride.positions, [
			{ at: 30, position: 0 },
			{ at: 45, position: 3 },
		]);
		assert.equal("positions" in detail(), false);
	});

	it("names the sensors from the product table, keeps their firmware and battery, and never a serial", () => {
		assert.deepEqual(ride.sensors, [
			{ name: "Rally 100/200", product: 3578, type: "BIKE_POWER", firmware: "4.1", battery: "OK" },
			{ name: "Heart Rate Monitor", product: 999_999, type: "HEART_RATE", battery: "73%" },
			{ name: "Sensor", battery: "Low" },
		]);
		const text = serializeActivityDetail(ride);
		assert.ok(!text.includes("8808808") && !text.includes("9909909"));
	});

	it("keeps a pool's length in its unit, and a pool lap's lengths and strokes, a rest without", () => {
		const POOL_SUMMARY = {
			...SUMMARY,
			activityTypeDTO: { typeId: 27, typeKey: "lap_swimming", parentTypeId: 26 },
			metadataDTO: { hasPolyline: false, hasPowerTimeInZones: false, lapCount: 2 },
			summaryDTO: { ...SUMMARY.summaryDTO, poolLength: 25, unitOfPoolLength: { unitId: 1, unitKey: "meter", factor: 100 }, averageSWOLF: 37, totalNumberOfStrokes: 470, numberOfActiveLengths: 44 },
		};
		const POOL_SPLITS = {
			lapDTOs: [
				{
					lapIndex: 1, startTimeGMT: "2026-03-12T05:12:00.0", duration: 36.248, distance: 25, averageSpeed: 0.69, averageSWOLF: 48, totalNumberOfStrokes: 12, averageSwimCadence: 20, averageStrokes: 12, averageStrokeDistance: 2.08, numberOfActiveLengths: 1, swimStroke: "FREESTYLE",
					lengthDTOs: [{ startTimeGMT: "2026-03-12T05:12:00.0", distance: 25, duration: 36.248, averageSpeed: 0.69, averageHR: 88, totalNumberOfStrokes: 12, averageSWOLF: 48, lengthIndex: 1, swimStroke: "FREESTYLE" }],
				},
				{ lapIndex: 2, startTimeGMT: "2026-03-12T05:12:36.0", duration: 23.75, distance: 0, numberOfActiveLengths: 0, averageSWOLF: 0, totalNumberOfStrokes: 0, swimStroke: null, lengthDTOs: [{ startTimeGMT: "2026-03-12T05:12:36.0", distance: 0, duration: 23.75, swimStroke: null }] },
			],
		};
		const pool = buildActivityDetail(ID, { ...ALL, summary: POOL_SUMMARY, laps: POOL_SPLITS }, null)!;
		assert.deepEqual(pool.pool, { length: 25, unit: "m" });
		assert.equal(pool.hasPolyline, false);
		assert.equal(pool.hasPowerZones, false);
		assert.equal(pool.summary.averageSWOLF, 37);
		assert.deepEqual(pool.laps[0], {
			n: 1, start: 0, duration: 36.248, distance: 25, speed: 0.69, strokes: 12, swolf: 48, strokeRate: 20, strokesPerLength: 12, strokeDistance: 2.08, activeLengths: 1, stroke: "FREESTYLE",
			lengths: [{ n: 1, start: 0, duration: 36.248, distance: 25, speed: 0.69, strokes: 12, swolf: 48, hr: 88, stroke: "FREESTYLE" }],
		});
		assert.deepEqual(pool.laps[1], { n: 2, start: 36, duration: 23.75, distance: 0, strokes: 0, swolf: 0, activeLengths: 0, lengths: [{ start: 36, duration: 23.75, distance: 0 }], rest: true });
		const yards = buildActivityDetail(ID, { ...ALL, summary: { ...POOL_SUMMARY, summaryDTO: { ...POOL_SUMMARY.summaryDTO, poolLength: 25, unitOfPoolLength: { unitId: 2, unitKey: "yard", factor: 91.44 } } } }, null)!;
		assert.deepEqual(yards.pool, { length: 25, unit: "yd" });
	});

	it("keeps an open-water swim's stroke rate and temperature", () => {
		const columns = { metricDescriptors: [{ metricsIndex: 0, key: "directTimestamp" }, { metricsIndex: 1, key: "directSwimCadence" }, { metricsIndex: 2, key: "directAirTemperature" }], activityDetailMetrics: [{ metrics: [START, 29, 28.04] }] };
		const swim = buildActivityDetail(ID, { ...ALL, samples: columns }, null)!;
		assert.deepEqual(swim.samples, { strokeRate: [29], temperature: [28], clock: [0] });
	});

	function detail(): ActivityDetail {
		return buildActivityDetail(ID, ALL, null)!;
	}
});

describe("a detail file", () => {
	const detail = buildActivityDetail(ID, ALL, null)!;

	it("reads back what it wrote, and nothing of another version", () => {
		assert.deepEqual(parseActivityDetail(serializeActivityDetail(detail)), detail);
		assert.equal(parseActivityDetail(serializeActivityDetail({ ...detail, version: 0 })), null);
		assert.equal(parseActivityDetail("{"), null);
		assert.equal(parseActivityDetail("[]"), null);
	});

	it("keeps a run's version 5 file, only its summary and badges left to fetch; any other sport's is fetched again", () => {
		const v5: ActivityDetail = { ...detail, version: 5, checked: detail.checked.filter((b) => b !== "badges") };
		const upgraded = parseActivityDetail(serializeActivityDetail(v5))!;
		assert.equal(upgraded.version, ACTIVITY_DETAIL_VERSION);
		assert.deepEqual(blocksToFetch(upgraded), ["summary", "badges"]);
		assert.deepEqual(upgraded.laps, detail.laps);
		const treadmill = parseActivityDetail(serializeActivityDetail({ ...v5, type: "treadmill_running", typeId: 18, parentTypeId: 1 }));
		assert.equal(treadmill?.version, ACTIVITY_DETAIL_VERSION);
		assert.equal(parseActivityDetail(serializeActivityDetail({ ...v5, type: "road_biking", typeId: 10, parentTypeId: 2 })), null);
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
	badges: "activityBadges",
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
		const { api, calls } = fakeApi({ summary: POWERED });
		const first = await loadActivity(api, store, ID, SIGNED_IN);
		assert.equal(first.reason, undefined);
		assert.equal(first.detail?.name, "Morning Run");
		assert.deepEqual(calls.sort(), [...ACTIVITY_BLOCKS].sort());
		assert.equal(store.writes, 1);

		const again = await loadActivity(api, store, ID, SIGNED_IN);
		assert.equal(again.reason, undefined);
		assert.equal(calls.length, ACTIVITY_BLOCKS.length);
	});

	it("asks for power zones, weather, the device and the weight once the summary says they apply", async () => {
		const { api, calls, args } = fakeApi({ summary: POWERED });
		await loadActivity(api, new MemoryStore(), ID, SIGNED_IN);
		assert.deepEqual(calls.slice(-4).sort(), ["device", "powerZones", "weather", "weight"]);
		assert.equal(args.device, 2);
		assert.equal(args.weight, "2026-03-12");
	});

	it("asks nothing the summary says doesn't apply: no route, no power zones, no power", async () => {
		const plain = { ...SUMMARY, metadataDTO: { ...SUMMARY.metadataDTO, hasPolyline: false, hasPowerTimeInZones: false } };
		const { api, calls } = fakeApi({ summary: plain });
		const load = await loadActivity(api, new MemoryStore(), ID, SIGNED_IN);
		assert.deepEqual(calls.filter((c) => ["powerZones", "weather", "weight"].includes(c)), []);
		assert.equal(calls.length, ACTIVITY_BLOCKS.length - 3);
		assert.deepEqual([load.detail?.powerZones, load.detail?.weather, load.detail?.weightKg], [[], null, null]);
		assert.deepEqual(load.detail?.checked, [...ACTIVITY_BLOCKS]);
	});

	it("upgrades a run saved at version 5 with two requests: the summary and the badges", async () => {
		const store = new MemoryStore();
		const saved = buildActivityDetail(ID, ALL, null)!;
		store.files.set(ID, serializeActivityDetail({ ...saved, version: 5, checked: saved.checked.filter((b) => b !== "badges") }));
		const { api, calls } = fakeApi({});
		const load = await loadActivity(api, store, ID, SIGNED_IN);
		assert.deepEqual(calls.sort(), ["badges", "summary"]);
		assert.equal(load.reason, undefined);
		assert.equal(load.detail?.version, ACTIVITY_DETAIL_VERSION);
		assert.equal(parseActivityDetail(store.files.get(ID)!)?.version, ACTIVITY_DETAIL_VERSION);
	});

	it("stops at Garmin's edge refusing the client, as at a 429: no more blocks asked", async () => {
		const blocked = fakeApi({ samples: new GarminBlockedError("Garmin's edge refused the request", 403) });
		const load = await loadActivity(blocked.api, new MemoryStore(), ID, SIGNED_IN);
		assert.ok(load.fatal instanceof GarminBlockedError);
		assert.ok(!blocked.calls.includes("device") && !blocked.calls.includes("weight"));
	});

	it("stops when a newer build wrote the activity's file, rather than fetch it again at every plan", async () => {
		class NewerStore extends MemoryStore {
			override async writeActivityDetail(): Promise<"written" | "unchanged"> {
				throw new NewerDataError("Garmin/data/activity-details/1.json");
			}
		}
		const { api } = fakeApi({ summary: POWERED });
		const load = await loadActivity(api, new NewerStore(), ID, SIGNED_IN);
		assert.ok(load.fatal instanceof NewerDataError);
		assert.equal(load.reason, "failed");
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
		await loadActivity(fakeApi({ summary: POWERED }).api, store, ID, SIGNED_IN);
		const { api, calls } = fakeApi({ summary: { ...POWERED, activityName: "Renamed Run" } });
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
