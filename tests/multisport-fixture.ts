import { buildActivityDetail, type ActivityDetail } from "../src/sync/activity-detail";

/*
 * The multisport its page was specified on, transcribed from
 * ref/activity-details/multisport (its api-samples): Garmin's summary with its
 * five children, the splits (a lap a leg) and the details as sent, the parent's
 * rows the swim's only and its polyline the whole race. The ids are made up,
 * and so are the name and the route: a few points a leg around a made-up
 * origin, at the real legs' times, so the file holds no one's position.
 */

export const MULTISPORT_ID = 98765432110;
export const LEG_IDS = [98765432111, 98765432112, 98765432113, 98765432114, 98765432115] as const;
export const TODAY = "2026-10-21";

const START = Date.parse("2025-10-25T02:36:29Z");
const gmt = (seconds: number) => `${new Date(START + seconds * 1000).toISOString().slice(0, 19)}.0`;

/** Each leg's start (s after the race's), duration, distance, speed and calories, as the splits send them. */
const LEGS = [
	{ type: "open_water_swimming", at: 0, duration: 2520.712, distance: 1835.68, speed: 0.7279999852180481, calories: 487 },
	{ type: "transition_v2", at: 2556, duration: 186.02, distance: 162.23, speed: 0.8719999790191652, calories: 17 },
	{ type: "road_biking", at: 2742, duration: 10140.009, distance: 89756.33, speed: 8.85200023651123, calories: 1527 },
	{ type: "transition_v2", at: 12882, duration: 155.971, distance: 142.79, speed: 0.9150000214576721, calories: 22 },
	{ type: "running", at: 13037, duration: 5797.862, distance: 20953.76, speed: 3.614000082015991, calories: 1363 },
] as const;

export const SUMMARY = {
	activityId: MULTISPORT_ID,
	activityName: "Coastal Multisport",
	isMultiSportParent: true,
	activityTypeDTO: { typeId: 89, typeKey: "multi_sport", parentTypeId: 17 },
	accessControlRuleDTO: { typeKey: "private" },
	timeZoneUnitDTO: { timeZone: "Asia/Dubai" },
	metadataDTO: {
		hasPolyline: true,
		hasPowerTimeInZones: false,
		lapCount: 5,
		childIds: [...LEG_IDS],
		childActivityTypes: LEGS.map((leg) => leg.type),
		deviceMetaDataDTO: { deviceVersionPk: 999262 },
	},
	summaryDTO: {
		startTimeLocal: "2025-10-25T06:36:29.0",
		startTimeGMT: "2025-10-25T02:36:29.0",
		distance: 112850.79,
		duration: 18800.574,
		elapsedDuration: 18836.875,
		averageSpeed: 6.002518371699297,
		maxHR: 188,
		calories: 3416,
		elevationGain: 566,
		trainingEffect: 5,
		anaerobicTrainingEffect: 2.200000047683716,
		trainingEffectLabel: "LACTATE_THRESHOLD",
		directWorkoutFeel: 50,
		directWorkoutRpe: 100,
	},
};

export const SPLITS = {
	lapDTOs: LEGS.map((leg, i) => ({
		lapIndex: i + 1,
		startTimeGMT: gmt(leg.at),
		duration: leg.duration,
		distance: leg.distance,
		averageSpeed: leg.speed,
		calories: leg.calories,
	})),
};

/** Three points a leg, a leg's first at its start, made up around (0.5, 10.0). */
export const POLYLINE = LEGS.flatMap((leg, i) =>
	[0, 0.5, 0.99].map((f, j) => ({ lat: 0.5 + i * 0.01 + j * 0.001, lon: 10 + i * 0.01, time: START + Math.round((leg.at + f * leg.duration) * 1000) })),
);

/** The parent's details: two of the swim's rows, and the whole race's polyline. */
export const DETAILS = {
	metricDescriptors: [
		{ metricsIndex: 0, key: "directTimestamp" },
		{ metricsIndex: 1, key: "directLatitude" },
		{ metricsIndex: 2, key: "directLongitude" },
		{ metricsIndex: 3, key: "directHeartRate" },
	],
	activityDetailMetrics: [{ metrics: [START, 0.5, 10, 129] }, { metrics: [START + 2555000, 0.501, 10, 138] }],
	geoPolylineDTO: { polyline: POLYLINE },
};

export function multisport(): ActivityDetail {
	const detail = buildActivityDetail(MULTISPORT_ID, { summary: SUMMARY, samples: DETAILS, laps: SPLITS, badges: [{ badgeName: "Brick", badgeKey: "activity_multisport" }] }, null);
	if (!detail) throw new Error("no detail");
	return detail;
}

/** The first transition's own page: a leg, which names its multisport. */
export function transition(): ActivityDetail {
	const leg = LEGS[1];
	const detail = buildActivityDetail(
		LEG_IDS[1],
		{
			summary: {
				activityId: LEG_IDS[1],
				activityName: "Transition 1",
				parentId: MULTISPORT_ID,
				activityTypeDTO: { typeId: 189, typeKey: "transition_v2", parentTypeId: 4 },
				summaryDTO: {
					startTimeLocal: "2025-10-25T07:19:05.0",
					startTimeGMT: gmt(leg.at),
					distance: leg.distance,
					duration: leg.duration,
					averageSpeed: leg.speed,
					averageHR: 127,
					elevationGain: 3,
					calories: leg.calories,
					trainingEffectLabel: "AEROBIC_BASE",
				},
			},
		},
		null,
	);
	if (!detail) throw new Error("no detail");
	return detail;
}
