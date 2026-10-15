import { buildActivityDetail, type ActivityDetail } from "../src/sync/activity-detail";

/*
 * Garmin's Stair Stepper, the basic page's model (ref/activity-details/basic:
 * activity 24150511862), transcribed from its api-samples with a made-up id
 * and six of its 761 samples: the first two, the least heart rate (83 bpm at
 * 0:10), the most (162 at 21:53), one between and the last, on its 34:52
 * timer.
 */

export const BASIC_ID = 98765432106;
/** The page's "today", the capture day. */
export const TODAY = "2026-10-15";
const START = Date.parse("2026-08-28T16:01:25Z");

const SUMMARY_DTO = {
	startTimeLocal: "2026-08-28T19:01:25.0",
	startTimeGMT: "2026-08-28T16:01:25.0",
	distance: 0,
	duration: 2092.296,
	movingDuration: 0,
	elapsedDuration: 2092.296,
	averageSpeed: 0,
	calories: 354,
	bmrCalories: 48,
	averageHR: 146,
	maxHR: 162,
	minHR: 83,
	trainingEffect: 2.9000000953674316,
	anaerobicTrainingEffect: 0.10000000149011612,
	aerobicTrainingEffectMessage: "MAINTAINING_AEROBIC_FITNESS_1",
	anaerobicTrainingEffectMessage: "NO_ANAEROBIC_BENEFIT_0",
	waterEstimated: 398,
	trainingEffectLabel: "AEROBIC_BASE",
	activityTrainingLoad: 61.71232604980469,
	minActivityLapDuration: 2092.296,
	moderateIntensityMinutes: 4,
	vigorousIntensityMinutes: 30,
	steps: 322,
	differenceBodyBattery: -7,
};

/** Clock seconds, then the timer, distance, heart rate and the steps' cadence, as sent. */
const ROWS: ReadonlyArray<readonly [number, number, number, number, number]> = [
	[0, 0, 0, 87, 0],
	[1, 1, 0, 87, 0],
	[10, 10, 0, 83, 0],
	[888, 888, 0, 152, 0],
	[1313, 1313, 0, 162, 0],
	[2092, 2092, 0, 156, 0],
];

const zone = (zoneNumber: number, secsInZone: number, zoneLowBoundary: number) => ({ zoneNumber, secsInZone, zoneLowBoundary });

const PAYLOADS = {
	summary: {
		activityName: "Stair Stepper",
		activityTypeDTO: { typeId: 31, typeKey: "stair_climbing", parentTypeId: 29 },
		accessControlRuleDTO: { typeKey: "private" },
		metadataDTO: { hasPolyline: false, hasPowerTimeInZones: false },
		summaryDTO: SUMMARY_DTO,
	},
	samples: {
		metricDescriptors: ["directTimestamp", "sumDuration", "sumDistance", "directHeartRate", "directDoubleCadence"].map((key, metricsIndex) => ({ metricsIndex, key })),
		activityDetailMetrics: ROWS.map(([clock, ...rest]) => ({ metrics: [START + clock * 1000, ...rest] })),
	},
	laps: { lapDTOs: [{ lapIndex: 1, startTimeGMT: "2026-08-28T16:01:25.0", distance: 0, duration: 2092.296, movingDuration: 0, elapsedDuration: 2092.296, averageSpeed: 0, calories: 354, bmrCalories: 48, averageHR: 146, maxHR: 162, lengthDTOs: [] }] },
	segments: { splits: [] },
	hrZones: [zone(1, 248, 103), zone(2, 128.995, 124), zone(3, 1682.904, 144), zone(4, 0, 165), zone(5, 0, 185)],
	powerZones: [],
	weather: null,
	gear: [],
	device: { productDisplayName: "Forerunner 970", versionMajorMinor: "17.39" },
	weight: null,
	badges: [],
};

/** The Stair Stepper with every block: no route, no weather, no power, no self-evaluation. */
export function stairStepper(): ActivityDetail {
	return buildActivityDetail(BASIC_ID, PAYLOADS, null)!;
}
