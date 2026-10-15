import type { ActivityRow } from "../src/sync/activity-index";
import { buildActivityDetail, type ActivityDetail } from "../src/sync/activity-detail";
import { RIDES } from "./cycling-power-curve-fixture";

/*
 * The captured road ride for the cycling page's tests
 * (ref/activity-details/road-cycling: activity 24706138262, Rally power
 * pedals, Forerunner 970), built through the detail file's own
 * `buildActivityDetail` from payloads transcribed off `api-samples/`: the
 * summary's numbers, laps, zones, weather, the pedals' sensor (no serial),
 * the badge and the rider-position events as Garmin sent them. The id is made
 * up, the name too, and the route is a made-up loop around a made-up origin,
 * so the file holds no one's position.
 *
 * The samples are 66 of the 1,739 rows the page fetches, chosen to keep what
 * the goldens read: the first and last rows of every column (cycling
 * dynamics from 11 s, both pedals from 18 s, to 3,425 s; the samples end at
 * 3,440 s), each column's extremes, the 78 s pause after 1,816 s on the
 * clock, and the angles that fall outside their windows.
 */

export const RIDE_ID = 98765432110;
/** The capture day: the date line shows no year. */
export const TODAY = "2026-10-15";

const START = Date.parse("2026-10-13T07:57:21Z");

const SUMMARY = {
	startTimeLocal: "2026-10-13T11:57:21.0",
	startTimeGMT: "2026-10-13T07:57:21.0",
	distance: 27512.88,
	duration: 3441.266,
	movingDuration: 3408.303,
	elapsedDuration: 3518.451,
	averageSpeed: 7.994999885559082,
	averageMovingSpeed: 8.072310630864923,
	maxSpeed: 12.111000061035156,
	averageHR: 156,
	maxHR: 170,
	minHR: 101,
	calories: 605,
	bmrCalories: 79,
	averagePower: 153,
	maxPower: 398,
	minPower: 0,
	normalizedPower: 167,
	maxPowerTwentyMinutes: 182.02083333333334,
	leftBalance: 49.27,
	rightBalance: 50.73,
	intensityFactor: 0.609000027179718,
	trainingStressScore: 35.099998474121094,
	functionalThresholdPower: 274,
	totalWork: 125.53639362103284,
	averageBikeCadence: 81,
	maxBikeCadence: 103,
	averageSeatedCadence: 82,
	averageStandingCadence: 65,
	seatedTime: 3405.4361114501953,
	standingTime: 35.83000183105469,
	averageSeatedPower: 154,
	maxSeatedPower: 398,
	averageStandingPower: 99,
	maxStandingPower: 329,
	leftPowerPhaseStart: 11.25,
	leftPowerPhaseEnd: 217.96875,
	leftPowerPhaseArcLength: 206.71875,
	leftPowerPhasePeakStart: 67.5,
	leftPowerPhasePeakEnd: 118.125,
	leftPowerPhasePeakArcLength: 50.625,
	rightPowerPhaseStart: 15.46875,
	rightPowerPhaseEnd: 216.5625,
	rightPowerPhaseArcLength: 201.09375,
	rightPowerPhasePeakStart: 68.90625,
	rightPowerPhasePeakEnd: 118.125,
	rightPowerPhasePeakArcLength: 49.21875,
	leftPlatformCenterOffset: 0,
	rightPlatformCenterOffset: -9,
	totalNumberOfStrokes: 4427,
	elevationGain: 196,
	elevationLoss: 180,
	minElevation: -10.6,
	maxElevation: 9.8,
	avgElevation: 0.06,
	trainingEffect: 3.4000000953674316,
	anaerobicTrainingEffect: 0,
	trainingEffectLabel: "TEMPO",
	aerobicTrainingEffectMessage: "IMPACTING_TEMPO_22",
	anaerobicTrainingEffectMessage: "NO_ANAEROBIC_BENEFIT_0",
	activityTrainingLoad: 102.74685668945312,
	beginPotentialStamina: 99,
	endPotentialStamina: 39,
	minAvailableStamina: 39,
	waterEstimated: 878,
	moderateIntensityMinutes: 6,
	vigorousIntensityMinutes: 50,
	differenceBodyBattery: -15,
	directWorkoutFeel: 50,
	directWorkoutRpe: 30,
};

const COLUMNS = [
	"sumDuration",
	"sumDistance",
	"directHeartRate",
	"directSpeed",
	"directElevation",
	"directPower",
	"directAvailableStamina",
	"directPotentialStamina",
	"directPerformanceCondition",
	"directBikeCadence",
	"directRightBalance",
	"directLeftPowerPhaseStart",
	"directLeftPowerPhaseEnd",
	"directLeftPowerPhasePeakStart",
	"directLeftPowerPhasePeakEnd",
	"directRightPowerPhaseStart",
	"directRightPowerPhaseEnd",
	"directRightPowerPhasePeakStart",
	"directRightPowerPhasePeakEnd",
	"directLeftPlatformCenterOffset",
	"directRightPlatformCenterOffset",
] as const;

/** clock (s since the start), then the columns above, as Garmin sent them. */
const ROWS: Array<Array<number | null>> = [
	[0, 0, 0, 101, 0, -4, 0, 99, 99, null, null, null, null, null, null, null, null, null, null, null, null, null],
	[1, 1, 0, 101, 0, -4.2, 0, 99, 99, null, null, null, null, null, null, null, null, null, null, null, null, null],
	[2, 2, 0, 101, 0, -4.2, 0, 99, 99, null, null, null, null, null, null, null, null, null, null, null, null, null],
	[4, 4, 0, 101, 0.196, -4.2, 0, 99, 99, null, null, null, null, null, null, null, null, null, null, null, null, null],
	[6, 6, 4.15, 101, 1.931, -4.2, 0, 99, 99, null, null, null, null, null, null, null, null, null, null, null, null, null],
	[8, 8, 9.24, 101, 2.165, -4.4, 0, 99, 99, null, null, null, null, null, null, null, null, null, null, null, null, null],
	[10, 10, 15.24, 102, 3.191, -4.6, 0, 99, 99, null, null, null, null, null, null, null, null, null, null, null, null, null],
	[11, 11, 18.41, 102, 3.452, -4.6, 138, 99, 99, null, 46, null, 9.844, 208.125, 53.438, 108.281, null, null, null, null, 0, -1],
	[12, 12, 22.02, 103, 3.415, -4.4, 11, 99, 99, null, 46, 66, 9.844, 208.125, 53.438, 108.281, null, null, null, null, 0, -1],
	[14, 14, 28.36, 103, 3.256, -3.2, 11, 99, 99, null, 23, null, null, null, null, null, null, null, null, null, 0, -1],
	[16, 16, 35.58, 104, 4.003, -2.4, 80, 99, 99, null, 26, null, null, null, null, null, 9.844, 202.5, 57.656, 113.906, -2, -5],
	[18, 18, 43.94, 107, 4.684, -0.6, 165, 99, 99, null, 58, 47, 5.625, 223.594, 60.469, 111.094, 9.844, 202.5, 57.656, 113.906, -3, -5],
	[20, 20, 53.16, 115, 5.207, 1.4, 144, 99, 99, null, 65, 54, 19.688, 213.75, 66.094, 126.562, 9.844, 202.5, 57.656, 113.906, -5, -9],
	[22, 22, 64.74, 118, 5.263, 2, 85, 99, 99, null, 72, 57, 19.688, 213.75, 66.094, 126.562, 4.219, 205.312, 61.875, 115.312, -1, -11],
	[26, 26, 84.43, 118, 4.6, -0.2, 0, 99, 99, null, 0, null, null, null, null, null, null, null, null, null, null, null],
	[54, 54, 234.78, 121, 5.263, 1, 121, 99, 99, null, 60, 47, 12.656, 216.562, 75.938, 109.688, 1.406, 189.844, 60.469, 92.812, 3, -11],
	[68, 68, 308.01, 125, 6.037, 2.8, 276, 98, 98, null, 70, 51, 7.031, 209.531, 60.469, 111.094, 0, 230.625, 57.656, 109.688, -4, -10],
	[78, 78, 374.7, 133, 6.886, 1.8, 147, 98, 98, null, 84, 61, 0, 206.719, 63.281, 122.344, 8.438, 202.5, 59.062, 122.344, 1, -10],
	[134, 134, 797.42, 144, 7.157, 4.8, 18, 97, 97, null, 72, 54, 16.875, 215.156, 56.25, 106.875, 15.469, 202.5, 66.094, 123.75, 21, -8],
	[340, 340, 2376.68, 145, 8.342, 0.6, 275, 94, 94, null, 65, 52, 0, 212.344, 63.281, 94.219, 4.219, 187.031, 56.25, 106.875, 0, -10],
	[430, 430, 3254.31, 158, 10.777, -2.2, 228, 91, 92, 2, 77, 48, 11.25, 215.156, 59.062, 125.156, 22.5, 225, 56.25, 136.406, -3, -12],
	[435, 435, 3310.87, 158, 12.111, -3.4, 0, 91, 92, 2, 84, 57, 16.875, 213.75, 67.5, 129.375, 15.469, 219.375, 70.312, 127.969, 0, -5],
	[514, 514, 3945.84, 162, 8.239, -3.2, 196, 89, 90, 2, 78, 58, 331.875, 262.969, 57.656, 120.938, 15.469, 225, 64.688, 125.156, -5, -10],
	[871, 871, 7269.51, 162, 8.743, 0.8, 253, 83, 83, -1, 82, 49, 354.375, 232.031, 59.062, 112.5, 5.625, 267.188, 70.312, 113.906, 1, -10],
	[1012, 1012, 8502.5, 170, 8.286, -4.2, 194, 80, 80, -1, 87, 49, 11.25, 217.969, 60.469, 123.75, 8.438, 223.594, 63.281, 113.906, 0, -4],
	[1242, 1242, 10532.41, 162, 10.609, -10.6, 184, 76, 76, -1, 88, 50, 15.469, 226.406, 61.875, 116.719, 18.281, 222.188, 59.062, 115.312, -1, -17],
	[1452, 1452, 12233.18, 162, 11.383, -6.2, 130, 72, 72, -2, 103, 54, 12.656, 223.594, 67.5, 109.688, 14.062, 202.5, 64.688, 119.531, 1, -3],
	[1522, 1522, 12796.24, 159, 6.252, -1, 292, 71, 71, -2, 74, 47, 354.375, 225, 61.875, 87.188, 19.688, 191.25, 88.594, 112.5, -5, -12],
	[1551, 1551, 13027.02, 158, 10.497, -7.8, 89, 70, 70, -2, 63, 23, 15.469, 213.75, 67.5, 116.719, 25.312, 222.188, 74.531, 113.906, 0, -5],
	[1560, 1560, 13116.33, 160, 7.95, -8.4, 151, 70, 70, -2, 66, 41, 4.219, 233.438, 46.406, 91.406, 18.281, 210.938, 71.719, 109.688, 0, -10],
	[1808, 1808, 14723.74, 141, 3.34, 0.8, 99, 66, 66, -2, 56, 50, 1.406, 223.594, 67.5, 90, 12.656, 195.469, 63.281, 108.281, -29, 0],
	[1816, 1816, 14746.3, 137, 1.344, 0.2, 0, 66, 66, -2, 0, null, null, null, null, null, null, null, null, null, null, null],
	[1895, 1817, 14750.09, 134, 2.454, -3, null, 65, 65, -2, null, null, null, null, null, null, null, null, null, null, null, null],
	[1897, 1819, 14755.92, 134, 3.191, -3.2, 121, 65, 65, -2, 37, 49, null, null, null, null, null, null, null, null, -4, -6],
	[2179, 2101, 16909.211, 156, 6.569, 9.8, 148, 61, 61, -2, 80, 49, 11.25, 217.969, 61.875, 115.312, 19.688, 210.938, 60.469, 116.719, 0, -2],
	[2261, 2183, 17516.221, 157, 7.856, 1.4, 100, 60, 60, -3, 89, 52, 0, 215.156, 66.094, 126.562, 16.875, 222.188, 71.719, 126.562, -2, -16],
	[2263, 2185, 17531.811, 156, 7.81, 1.4, 126, 60, 60, -3, 94, 46, 14.062, 219.375, 66.094, 115.312, 16.875, 222.188, 71.719, 126.562, 1, 18],
	[2444, 2366, 19076.699, 160, 8.79, 4, 206, 57, 57, -3, 83, 48, 9.844, 258.75, 66.094, 108.281, 18.281, 220.781, 115.312, 125.156, -3, -12],
	[2595, 2517, 20442.699, 158, 8.78, 3.6, 136, 54, 54, -3, 84, 68, 108.281, 206.719, 109.688, 126.562, 18.281, 213.75, 74.531, 126.562, 7, 4],
	[2779, 2701, 21997.801, 158, 8.743, 2.2, 125, 51, 51, -3, 90, 50, 1.406, 220.781, 73.125, 126.562, 357.188, 219.375, 68.906, 115.312, -1, -9],
	[2968, 2890, 23531.311, 153, 6.382, -0.2, 131, 48, 48, -3, 84, 54, 36.562, 201.094, 78.75, 120.938, 8.438, 210.938, 29.531, 116.719, 1, 1],
	[3001, 2923, 23736.02, 152, 6.746, 1.2, 150, 48, 48, -3, 91, 55, 354.375, 212.344, 63.281, 129.375, 347.344, 222.188, 66.094, 122.344, -3, -29],
	[3035, 2957, 23975.1, 155, 7.213, 0.8, 196, 47, 47, -3, 88, 50, 351.562, 206.719, 54.844, 120.938, 9.844, 206.719, 111.094, 151.875, -2, -10],
	[3066, 2988, 24210.9, 156, 7.567, 0.4, 334, 47, 47, -3, 83, 46, 19.688, 217.969, 64.688, 98.438, 15.469, 209.531, 71.719, 85.781, -6, -6],
	[3109, 3031, 24546.539, 157, 8.416, 0.2, 170, 46, 46, -3, 89, 51, 352.969, 241.875, 75.938, 171.562, 4.219, 219.375, 74.531, 122.344, 2, -9],
	[3193, 3115, 25269.75, 160, 6.737, 1.4, 183, 44, 44, -3, 84, 47, 22.5, 296.719, 71.719, 113.906, 5.625, 223.594, 60.469, 106.875, -2, -7],
	[3242, 3164, 25634.061, 160, 8.51, 2.2, 138, 43, 43, -3, 91, 59, 2.812, 97.031, 63.281, 95.625, 14.062, 205.312, 70.312, 126.562, 1, -8],
	[3243, 3165, 25643.01, 159, 8.379, 2.2, 0, 43, 43, -3, 91, 47, 2.812, 97.031, 63.281, 95.625, 15.469, 222.188, 71.719, 122.344, 1, -8],
	[3247, 3169, 25672, 159, 6.168, 2.6, 17, 43, 43, -3, 14, null, 2.812, 97.031, 63.281, 95.625, 15.469, 222.188, 71.719, 122.344, 1, -8],
	[3249, 3171, 25683.779, 158, 6.102, 2, 123, 43, 43, -3, 67, 39, 2.812, 97.031, 63.281, 95.625, 15.469, 222.188, 71.719, 122.344, -7, -10],
	[3317, 3239, 26168.82, 156, 6.373, 4.4, 398, 42, 42, -3, 86, 47, 347.344, 192.656, 67.5, 90, 12.656, 195.469, 57.656, 109.688, -5, -6],
	[3331, 3253, 26265.461, 163, 7.297, 3.2, 154, 42, 42, -3, 83, 40, 357.188, 217.969, 71.719, 129.375, 14.062, 209.531, 67.5, 116.719, 1, -5],
	[3491, 3413, 27416.01, 152, 3.816, 6, 0, 39, 39, -3, 49, null, null, null, null, null, null, null, null, null, null, null],
	[3495, 3417, 27430.619, 149, 4.05, 5.6, 109, 39, 39, -3, 56, 100, 12.656, 195.469, 71.719, 116.719, 11.25, 212.344, 63.281, 101.25, 1, -3],
	[3499, 3421, 27447.381, 146, 4.647, 5.6, 154, 39, 39, -3, 72, 54, 8.438, 209.531, 70.312, 118.125, null, null, null, null, 0, -8],
	[3501, 3423, 27457.85, 146, 4.693, 6, 147, 39, 39, -3, 77, 56, 16.875, 201.094, 63.281, 118.125, 19.688, 217.969, 61.875, 104.062, 1, -14],
	[3503, 3425, 27466.9, 146, 4.395, 6.4, 0, 39, 39, -3, 77, 56, 14.062, 188.438, 73.125, 113.906, 19.688, 195.469, 66.094, 119.531, 4, -15],
	[3505, 3427, 27476.07, 146, 4.031, 6.4, 0, 39, 39, -3, 0, null, null, null, null, null, null, null, null, null, null, null],
	[3507, 3429, 27484.711, 144, 3.882, 6, 0, 39, 39, -3, 10, null, null, null, null, null, null, null, null, null, null, null],
	[3509, 3431, 27493.15, 140, 3.994, 5.4, 0, 39, 39, -3, 10, null, null, null, null, null, null, null, null, null, null, null],
	[3511, 3433, 27500.66, 138, 3.938, 5, 0, 39, 39, -3, 23, null, null, null, null, null, null, null, null, null, null, null],
	[3513, 3435, 27508.061, 138, 3.07, 4.8, 0, 39, 39, -3, 0, null, null, null, null, null, null, null, null, null, null, null],
	[3515, 3437, 27512.15, 137, 1.549, 5.2, 0, 39, 39, -3, 0, null, null, null, null, null, null, null, null, null, null, null],
	[3516, 3438, 27512.84, 138, 0.429, 5.6, 0, 39, 39, -3, 0, null, null, null, null, null, null, null, null, null, null, null],
	[3517, 3439, 27512.881, 138, 0.243, 6, 0, 39, 39, -3, 0, null, null, null, null, null, null, null, null, null, null, null],
	[3518, 3440, 27512.881, 138, 0, 6.4, 0, 39, 39, -3, 0, null, null, null, null, null, null, null, null, null, null, null],
];

/** A made-up loop of 11 km around 10°N 20°E, ridden two and a half times: a position for every distance. */
export function loopAt(metres: number): [number, number] {
	const turn = (2 * Math.PI * metres) / 11000;
	return [Math.round((10 + 0.012 * Math.sin(turn)) * 1e5) / 1e5, Math.round((20.012 - 0.012 * Math.cos(turn)) * 1e5) / 1e5];
}

const lap = (lapIndex: number, startTimeGMT: string, duration: number, distance: number, averageSpeed: number, power: [number, number, number], bikeCadence: number, end: number) => {
	const [endLatitude, endLongitude] = loopAt(end);
	return {
		lapIndex,
		startTimeGMT,
		duration,
		distance,
		averageSpeed,
		averagePower: power[0],
		maxPower: power[1],
		normalizedPower: power[2],
		averageBikeCadence: bikeCadence,
		endLatitude,
		endLongitude,
	};
};

const LAPS = [
	lap(1, "2026-10-13T07:57:21.0", 633.299, 5000, 7.894999980926514, [163, 370, 186], 71, 5000),
	lap(2, "2026-10-13T08:07:55.0", 548.675, 5000, 9.11299991607666, [178, 347, 185], 83, 10000),
	lap(3, "2026-10-13T08:17:04.0", 685.267, 5000, 7.296000003814697, [145, 362, 162], 81, 15000),
	lap(4, "2026-10-13T08:29:46.0", 599.689, 5000, 8.338000297546387, [150, 334, 153], 85, 20000),
	lap(5, "2026-10-13T08:39:46.0", 619.939, 5000, 8.0649995803833, [142, 334, 145], 85, 25000),
	lap(6, "2026-10-13T08:50:06.0", 354.397, 2512.88, 7.091000080108643, [135, 398, 152], 81, 27512.88),
];

/** The timer's start and its pause, then the rider's positions: 0 seated, 1 standing, 2 to seated, 3 to standing. */
const EVENTS: ReadonlyArray<[clock: number, position: number | null]> = [
	[-1, null],
	[0, null],
	[10, 0],
	[483, 3],
	[487, 0],
	[1253, 3],
	[1260, 0],
	[1469, 3],
	[1471, 0],
	[1571, 3],
	[1577, 1],
	[1578, 2],
	[1584, 0],
	[1792, 1],
	[1817, null],
	[1895, null],
	[1895, 2],
	[1901, 0],
	[2133, 3],
	[2138, 0],
	[3493, 1],
	[3496, 2],
	[3501, 0],
];

function event(clock: number, position: number | null) {
	const ms = START + clock * 1000;
	const startTimeGMT = new Date(ms).toISOString().slice(0, 19) + ".0";
	return position === null
		? { startTimeGMT, startTimeGMTDoubleValue: ms, sectionTypeDTO: { id: 4, key: "timerTrigger", sectionTypeKey: "TIMER_TRIGGER" } }
		: { startTimeGMT, riderPosition: position, startTimeGMTDoubleValue: ms, sectionTypeDTO: { id: 7000, key: "riderPosition", sectionTypeKey: "RIDER_POSITION" } };
}

const zone = (zoneNumber: number, secsInZone: number, zoneLowBoundary: number) => ({ zoneNumber, secsInZone, zoneLowBoundary });

const PAYLOADS = {
	summary: {
		activityName: "Baseline Ride",
		activityTypeDTO: { typeId: 10, typeKey: "road_biking", parentTypeId: 2 },
		accessControlRuleDTO: { typeKey: "private" },
		metadataDTO: {
			hasPolyline: true,
			hasPowerTimeInZones: true,
			sensors: [
				{
					manufacturer: "GARMIN",
					sku: "006-B3578-00",
					fitProductNumber: 3578,
					sourceType: "ANTPLUS",
					antplusDeviceType: "BIKE_POWER",
					softwareVersion: 4.1,
					batteryStatus: "OK",
				},
			],
		},
		summaryDTO: SUMMARY,
	},
	samples: {
		metricDescriptors: [
			{ metricsIndex: 0, key: "directTimestamp" },
			...COLUMNS.map((key, i) => ({ metricsIndex: i + 1, key })),
			{ metricsIndex: COLUMNS.length + 1, key: "directLatitude" },
			{ metricsIndex: COLUMNS.length + 2, key: "directLongitude" },
		],
		activityDetailMetrics: ROWS.map(([clock, ...rest]) => ({ metrics: [START + clock! * 1000, ...rest, ...loopAt(rest[1]!)] })),
	},
	laps: { lapDTOs: LAPS, eventDTOs: EVENTS.map(([clock, position]) => event(clock, position)) },
	segments: { splits: [] },
	hrZones: [zone(1, 29.96, 99), zone(2, 121.815, 118), zone(3, 1460.473, 138), zone(4, 1828.939, 158), zone(5, 0, 177)],
	powerZones: [zone(1, 1395.226, 0), zone(2, 1533.002, 151), zone(3, 339.975, 205), zone(4, 107.985, 246), zone(5, 48.001, 287), zone(6, 15.998, 329), zone(7, 0, 413)],
	weather: { temp: 93, apparentTemp: 93, dewPoint: 59, relativeHumidity: 32, windDirection: 170, windDirectionCompassPoint: "s", windSpeed: 9, windGust: null, weatherTypeDTO: { desc: "Mostly Cloudy" } },
	gear: [],
	device: { productDisplayName: "Forerunner 970", versionMajorMinor: "18.32" },
	weight: { weight: 68000 },
	badges: [{ badgeId: 15, badgeKey: "cycle_climb_500ft", badgeName: "Climber 1", badgePoints: 1 }],
};

/** The ride with every block: weighed 68.0 kg (W/kg: 398 W → 5.85). */
export function roadRide(): ActivityDetail {
	return buildActivityDetail(RIDE_ID, PAYLOADS, null)!;
}

/**
 * The ride's own activity-index row: its best power by duration as the list
 * sent it (`maxAvgPower_*`; equal to the web's per-activity power curve), in
 * the index beside the account's fifteen other power rides
 * (`cycling-power-curve-fixture.ts`), whose 1 s 687 W of Sep 13, 2025 is
 * still the Record.
 */
export const RIDE_ROW: ActivityRow = {
	id: RIDE_ID,
	name: "Baseline Ride",
	type: "road_biking",
	typeId: 10,
	parentTypeId: 2,
	start: "2026-10-13T11:57:21",
	begin: START,
	distance: 27512.88,
	duration: 3441.27,
	power: { "1": 398, "2": 355, "5": 340, "10": 323, "20": 288, "30": 251, "60": 237, "120": 218, "300": 204, "600": 194, "1200": 182, "1800": 164 },
};

/** The activity index the page reads: the ride and the other fifteen power rides, newest first. */
export const INDEX_ROWS: readonly ActivityRow[] = [RIDE_ROW, ...RIDES];
