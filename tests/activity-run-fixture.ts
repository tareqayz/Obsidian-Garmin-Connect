import { buildActivityDetail, type ActivityDetail } from "../src/sync/activity-detail";

/*
 * Two runs for tests that look at the whole activity page at once (the run
 * page baseline): an outdoor run and a treadmill run, with every block the
 * page reads. The numbers are the captured runs' (spec:
 * ref/activity-details/outdoor-run, "Golden numbers" and "Treadmill
 * differences"), transcribed as the other activity tests have them; the ids
 * are made up, and the route is a made-up track around a made-up origin,
 * so the file holds no one's position.
 */

export const OUTDOOR_ID = 98765432101;
export const TREADMILL_ID = 98765432102;
/** The page's "today" in these tests: the date line then shows no year. */
export const TODAY = "2026-10-15";

const START = Date.parse("2026-10-10T04:19:48Z");

const OUTDOOR_DTO = {
	startTimeLocal: "2026-10-10T08:19:48.0",
	startTimeGMT: "2026-10-10T04:19:48.0",
	distance: 10009,
	duration: 3360.82,
	movingDuration: 3357.895,
	elapsedDuration: 3399.14,
	averageSpeed: 2.977999925613403,
	averageMovingSpeed: 2.980736426178451,
	avgGradeAdjustedSpeed: 2.9739999771118164,
	maxSpeed: 3.246999979019165,
	averageHR: 167,
	maxHR: 182,
	calories: 694,
	bmrCalories: 77,
	averagePower: 294,
	maxPower: 442,
	averageRunCadence: 171.296875,
	maxRunCadence: 219,
	strideLength: 104.15999755859376,
	verticalOscillation: 8.919999694824218,
	verticalRatio: 8.569999694824219,
	groundContactTime: 256.8999938964844,
	elevationGain: 87,
	elevationLoss: 90,
	minElevation: -21.8,
	maxElevation: -5.8,
	trainingEffect: 4.300000190734863,
	anaerobicTrainingEffect: 0,
	trainingEffectLabel: "LACTATE_THRESHOLD",
	activityTrainingLoad: 171.5507354736328,
	beginPotentialStamina: 100,
	endPotentialStamina: 53,
	minAvailableStamina: 53,
	impactLoad: 10590,
	waterEstimated: 933,
	moderateIntensityMinutes: 0,
	vigorousIntensityMinutes: 56,
	differenceBodyBattery: -19,
	directWorkoutFeel: 50,
	directWorkoutRpe: 60,
};

const OUTDOOR_COLUMNS = [
	"sumDuration",
	"sumDistance",
	"directHeartRate",
	"directSpeed",
	"directGradeAdjustedSpeed",
	"directDoubleCadence",
	"directStrideLength",
	"directVerticalRatio",
	"directVerticalOscillation",
	"directGroundContactTime",
	"directElevation",
	"directPower",
	"directAvailableStamina",
	"directPotentialStamina",
	"directPerformanceCondition",
	"directImpactLoadFactor",
	"directLatitude",
	"directLongitude",
] as const;

/**
 * clock (s since the start), then the columns above: nine samples carrying
 * every series' extremes on the run's timer (the 39 s pause at 26:06 sits
 * between rows 4 and 5), then a made-up position heading north-east from
 * 10°N 20°E.
 */
const OUTDOOR_ROWS: Array<Array<number | null>> = [
	[0, 0, 0, 76, 0.877, 0.877, 100, null, null, 5.44, null, -5.8, 70, 100, 100, null, 1.53, 10, 20],
	[4, 4, 2, 78, 0.616, 0.616, 0, null, null, null, null, -6.2, 0, 100, 100, null, 1, 10.00002, 20.00001],
	[9, 9, 19.5, 87, 3.191, 3.191, 176, 108.7, 8.11, 8.83, 246, -6.5, 318, 100, 100, null, 1.2, 10.00015, 20.0001],
	[360, 360, 1015.1, 150, 2.9, 2.95, 171, 102, 8.58, 4.47, 218, -21.8, 442, 94, 94, 2, 0.5, 10.008, 20.005],
	[1566, 1566, 4605.9, 169, 3.247, 3.881, 170, 35.1, 12.72, 9.63, 270, -15, 290, 77, 77, 1, 1, 10.036, 20.022],
	[1605, 1567, 4607.3, 155, 1.288, 1.3, 104, 114.6, 7.77, 8.07, 245, -15, 280, 77, 77, 1, 1, 10.03601, 20.02201],
	[1607, 1569, 4610.7, 155, 1.26, 1.3, 219, 100, 8.7, 8.27, 250, -15, 280, 77, 77, 1, 1, 10.03604, 20.02203],
	[2438, 2400, 7100, 175, 3, 3, 163, 105, 9.18, 9, 255, -10, 300, 65, 65, 0, 1, 10.054, 20.036],
	[3399, 3361, 10009, 182, 3, 3, 171, 106, 8.6, 9.2, 258, -12, 300, 53, 53, 0, 1, 10.075, 20.05],
];

const lap = (lapIndex: number, startTimeGMT: string, duration: number, distance: number, averageSpeed: number, endLatitude: number, endLongitude: number) => ({
	lapIndex,
	startTimeGMT,
	duration,
	distance,
	averageSpeed,
	endLatitude,
	endLongitude,
});

const OUTDOOR_SPLITS = {
	lapDTOs: [
		lap(1, "2026-10-10T04:19:48.0", 355.056, 1000, 2.815999984741211, 10.008, 20.005),
		lap(2, "2026-10-10T04:25:44.0", 343.48, 1000, 2.9110000133514404, 10.015, 20.01),
		lap(3, "2026-10-10T04:31:28.0", 336.132, 1000, 2.9749999046325684, 10.022, 20.014),
		lap(4, "2026-10-10T04:37:04.0", 329.454, 1000, 3.0350000858306885, 10.029, 20.018),
		lap(5, "2026-10-10T04:42:33.0", 337.242, 1000, 2.9649999141693115, 10.036, 20.022),
		lap(6, "2026-10-10T04:48:49.0", 341.793, 1000, 2.9260001182556152, 10.043, 20.027),
		lap(7, "2026-10-10T04:54:31.0", 324.648, 1000, 3.0799999237060547, 10.05, 20.032),
		lap(8, "2026-10-10T04:59:55.0", 325.01, 1000, 3.0769999027252197, 10.057, 20.037),
		lap(9, "2026-10-10T05:05:20.0", 333.324, 1000, 3.0000000000000004, 10.064, 20.042),
		lap(10, "2026-10-10T05:10:54.0", 332.017, 1000, 3.01200008392334, 10.071, 20.047),
		lap(11, "2026-10-10T05:16:26.0", 2.664, 9, 3.378000020980835, 10.075, 20.05),
	],
};

const OUTDOOR_TYPED = {
	splits: [
		{ type: "INTERVAL_ACTIVE", startTimeGMT: "2026-10-10T04:19:48.0", endTimeGMT: "2026-10-10T05:16:27.0", duration: 3360.82, distance: 10009.02, averageSpeed: 2.977999925613403 },
		{ type: "RWD_RUN", startTimeGMT: "2026-10-10T04:19:48.0", endTimeGMT: "2026-10-10T04:45:54.0", duration: 1565.904, distance: 4605.95, averageSpeed: 2.940999984741211 },
		{ type: "RWD_WALK", startTimeGMT: "2026-10-10T04:46:07.0", endTimeGMT: "2026-10-10T04:46:07.0", duration: 0, distance: null, averageSpeed: null },
		{ type: "RWD_STAND", startTimeGMT: "2026-10-10T04:46:27.0", endTimeGMT: "2026-10-10T04:46:27.0", duration: 0, distance: null, averageSpeed: null },
		{ type: "RWD_WALK", startTimeGMT: "2026-10-10T04:46:32.0", endTimeGMT: "2026-10-10T04:46:35.0", duration: 3.776, distance: 4.79, averageSpeed: 1.2690000534057617 },
		{ type: "RWD_RUN", startTimeGMT: "2026-10-10T04:46:36.0", endTimeGMT: "2026-10-10T05:16:27.0", duration: 1791.083, distance: 5398.27, averageSpeed: 3.013999938964844 },
	],
};

const zone = (zoneNumber: number, secsInZone: number, zoneLowBoundary: number) => ({ zoneNumber, secsInZone, zoneLowBoundary });

const OUTDOOR_PAYLOADS = {
	summary: {
		activityName: "Baseline Run",
		activityTypeDTO: { typeId: 1, typeKey: "running", parentTypeId: 17 },
		accessControlRuleDTO: { typeKey: "private" },
		metadataDTO: { runPowerWindDataEnabled: true },
		summaryDTO: OUTDOOR_DTO,
	},
	samples: {
		metricDescriptors: [{ metricsIndex: 0, key: "directTimestamp" }, ...OUTDOOR_COLUMNS.map((key, i) => ({ metricsIndex: i + 1, key }))],
		activityDetailMetrics: OUTDOOR_ROWS.map(([clock, ...rest]) => ({ metrics: [START + clock! * 1000, ...rest] })),
	},
	laps: OUTDOOR_SPLITS,
	segments: OUTDOOR_TYPED,
	hrZones: [zone(1, 4, 102), zone(2, 72.001, 122), zone(3, 758.992, 143), zone(4, 2493.367, 163), zone(5, 0, 184)],
	powerZones: [zone(1, 1154.621, 227), zone(2, 1593.776, 280), zone(3, 444.944, 318), zone(4, 141.001, 354), zone(5, 12.998, 407)],
	weather: { temp: 88, apparentTemp: 95, relativeHumidity: 60, windSpeed: 5, windDirection: 210, windDirectionCompassPoint: "ssw", weatherTypeDTO: { desc: "Clear" } },
	gear: [{ displayName: "Test Shoes", gearTypeName: "Shoes" }],
	device: { productDisplayName: "Forerunner 970", versionMajorMinor: "18.32" },
	weight: { weight: 68000 },
};

/** The outdoor run with every block; `weightKg` 68 (web: 294 W → 4.32 W/kg). */
export function outdoorRun(): ActivityDetail {
	const detail = buildActivityDetail(OUTDOOR_ID, OUTDOOR_PAYLOADS, null)!;
	return { ...detail, weightKg: 68 };
}

const TREADMILL_START = Date.parse("2026-09-22T11:06:02Z");

const TREADMILL_DTO = {
	startTimeLocal: "2026-09-22T14:06:02.0",
	startTimeGMT: "2026-09-22T11:06:02.0",
	distance: 5436.87,
	duration: 1566.347,
	movingDuration: 1562.456,
	elapsedDuration: 1566.347,
	averageSpeed: 3.4709999561309814,
	averageMovingSpeed: 3.4796948773440066,
	maxSpeed: 4.497000217437744,
	averageHR: 174,
	maxHR: 196,
	calories: 344,
	bmrCalories: 36,
	averagePower: 344,
	maxPower: 454,
	averageRunCadence: 171.734375,
	maxRunCadence: 182,
	strideLength: 121.21999511718751,
	verticalOscillation: 10.36999969482422,
	verticalRatio: 8.449999809265137,
	groundContactTime: 250.39999389648438,
	groundContactBalanceLeft: 49.09000015258789,
	stepSpeedLoss: 0.26040000915527345,
	stepSpeedLossPercent: 7.380000114440918,
	avgRespirationRate: 35.65999984741211,
	minRespirationRate: 15.3100004196167,
	maxRespirationRate: 44.650001525878906,
	trainingEffect: 3.700000047683716,
	anaerobicTrainingEffect: 0,
	trainingEffectLabel: "TEMPO",
	activityTrainingLoad: 134.14447021484375,
	beginPotentialStamina: 100,
	endPotentialStamina: 74,
	minAvailableStamina: 74,
	waterEstimated: 435,
	moderateIntensityMinutes: 0,
	vigorousIntensityMinutes: 25,
	differenceBodyBattery: -8,
	directWorkoutRpe: 40,
};

const TREADMILL_COLUMNS = [
	"sumDuration",
	"sumDistance",
	"directHeartRate",
	"directSpeed",
	"directDoubleCadence",
	"directStrideLength",
	"directVerticalRatio",
	"directVerticalOscillation",
	"directGroundContactTime",
	"directPower",
	"directAvailableStamina",
	"directPotentialStamina",
	"directPerformanceCondition",
	"directRespirationRate",
	"directGroundContactBalanceLeft",
] as const;

/** clock, then the columns above: no position, elevation, grade or impact indoors. */
const TREADMILL_ROWS: Array<Array<number | null>> = [
	[0, 0, 0, 98, 0.32, 100, null, null, null, null, 120, 100, 100, null, 15.3, null],
	[10, 10, 3.22, 104, 1.305, 0, null, null, null, null, 0, 100, 100, null, 18.2, null],
	[19, 19, 15, 120, 3.4, 168, 118, 8.2, 10.1, 248, 330, 99, 99, null, 22.4, 48.15],
	[360, 360, 1200, 165, 3.5, 172, 121, 8.4, 10.3, 250, 344, 92, 92, 1, 33.1, 49.2],
	[900, 900, 3120, 178, 4.497, 182, 124, 8.7, 10.6, 252, 454, 84, 84, -1, 44.65, 51.12],
	[1566, 1566, 5436.87, 196, 3.47, 171, 121, 8.4, 10.4, 251, 344, 74, 74, -2, 40.2, 49],
];

const TREADMILL_TYPED = {
	splits: [
		{ type: "INTERVAL_ACTIVE", startTimeGMT: "2026-09-22T11:06:02.0", endTimeGMT: "2026-09-22T11:32:08.0", duration: 1566.347, distance: 5436.88, averageSpeed: 3.4709999561309814 },
		{ type: "RWD_RUN", startTimeGMT: "2026-09-22T11:06:02.0", endTimeGMT: "2026-09-22T11:06:10.0", duration: 10.003, distance: 3.22, averageSpeed: 0.3219999969005584 },
		{ type: "RWD_WALK", startTimeGMT: "2026-09-22T11:06:11.0", endTimeGMT: "2026-09-22T11:06:19.0", duration: 8.999, distance: 11.75, averageSpeed: 1.3049999475479126 },
		{ type: "RWD_RUN", startTimeGMT: "2026-09-22T11:06:20.0", endTimeGMT: "2026-09-22T11:32:08.0", duration: 1547.307, distance: 5421.91, averageSpeed: 3.503999948501587 },
	],
};

const TREADMILL_PAYLOADS = {
	summary: {
		activityName: "Baseline Treadmill",
		activityTypeDTO: { typeId: 18, typeKey: "treadmill_running", parentTypeId: 1 },
		accessControlRuleDTO: { typeKey: "subscribers" },
		metadataDTO: { runPowerWindDataEnabled: false },
		summaryDTO: TREADMILL_DTO,
	},
	samples: {
		metricDescriptors: [{ metricsIndex: 0, key: "directTimestamp" }, ...TREADMILL_COLUMNS.map((key, i) => ({ metricsIndex: i + 1, key }))],
		activityDetailMetrics: TREADMILL_ROWS.map(([clock, ...rest]) => ({ metrics: [TREADMILL_START + clock! * 1000, ...rest] })),
	},
	laps: {
		lapDTOs: [
			{ lapIndex: 1, startTimeGMT: "2026-09-22T11:06:02.0", duration: 300.5, distance: 1000, averageSpeed: 3.3277870216306153 },
			{ lapIndex: 2, startTimeGMT: "2026-09-22T11:11:03.0", duration: 289.2, distance: 1000, averageSpeed: 3.457814661134163 },
			{ lapIndex: 3, startTimeGMT: "2026-09-22T11:15:52.0", duration: 976.647, distance: 3436.87, averageSpeed: 3.519045 },
		],
	},
	segments: TREADMILL_TYPED,
	hrZones: [zone(1, 30, 102), zone(2, 60, 122), zone(3, 300, 143), zone(4, 900, 163), zone(5, 276.347, 184)],
	powerZones: [],
	weather: null,
	gear: [],
	device: { productDisplayName: "Forerunner 970", versionMajorMinor: "18.29" },
	weight: null,
};

/** The treadmill run: no route, no weather, no power zones, no weigh-in. */
export function treadmillRun(): ActivityDetail {
	return buildActivityDetail(TREADMILL_ID, TREADMILL_PAYLOADS, null)!;
}
