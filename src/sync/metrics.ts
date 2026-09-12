import type { Activity, DailySummary, SleepData } from "../garmin/endpoints";

/**
 * Garmin payloads → frontmatter properties.
 *
 * Pure: no Obsidian, no network, no clock beyond what is passed in. All the
 * fiddly decisions about units, sentinels and rounding live here so they can be
 * tested directly.
 */

export type MetricGroup =
	| "activity"
	| "heart"
	| "sleep"
	| "stress"
	| "hrv"
	| "readiness"
	| "workouts";

export const ALL_GROUPS: MetricGroup[] = [
	"activity",
	"heart",
	"sleep",
	"stress",
	"hrv",
	"readiness",
	"workouts",
];

export type PropertyValue = number | string | Array<Record<string, unknown>>;
export type Properties = Record<string, PropertyValue>;

export interface HrvData {
	hrvSummary?: {
		lastNightAvg?: number | null;
		lastNight5MinHigh?: number | null;
		status?: string | null;
		weeklyAvg?: number | null;
		[key: string]: unknown;
	};
	[key: string]: unknown;
}

export interface ReadinessEntry {
	score?: number | null;
	level?: string | null;
	[key: string]: unknown;
}

export interface DayData {
	summary?: DailySummary | null;
	sleep?: SleepData | null;
	hrv?: HrvData | null;
	readiness?: ReadinessEntry[] | null;
	workouts?: Activity[] | null;
}

export interface MapOptions {
	groups: readonly MetricGroup[];
	units: "metric" | "imperial";
	/** Prepended to every key. Keeps our properties out of the user's namespace. */
	prefix: string;
}

/* ------------------------------------------------------------------ */
/*  Sentinels and conversions                                          */
/* ------------------------------------------------------------------ */

/**
 * Garmin reports "not measured" as a negative number on several fields —
 * `averageStressLevel: -1` is the common one. Writing -1 into a note as though
 * it were a stress score would quietly poison any chart built on it.
 */
function metric(value: unknown, { allowNegative = false } = {}): number | undefined {
	if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
	if (!allowNegative && value < 0) return undefined;
	return value;
}

function round(value: number, dp: number): number {
	const f = 10 ** dp;
	return Math.round(value * f) / f;
}

const METRES_PER_MILE = 1609.344;

function distance(metres: number | undefined, units: MapOptions["units"]) {
	if (metres === undefined) return undefined;
	return units === "imperial"
		? { key: "distance_mi", value: round(metres / METRES_PER_MILE, 2) }
		: { key: "distance_km", value: round(metres / 1000, 2) };
}

function hours(seconds: number | undefined): number | undefined {
	return seconds === undefined ? undefined : round(seconds / 3600, 2);
}

function minutes(seconds: number | undefined): number | undefined {
	return seconds === undefined ? undefined : Math.round(seconds / 60);
}

/**
 * Epoch millis → a local `YYYY-MM-DDTHH:mm` string, which Obsidian recognises as
 * a datetime property.
 *
 * Garmin also sends `*Local` variants, but those have been reported as
 * double-offset for some accounts, so the GMT field is the one to trust.
 */
export function toLocalDateTime(epochMs: number | undefined): string | undefined {
	if (typeof epochMs !== "number" || !Number.isFinite(epochMs)) return undefined;
	const d = new Date(epochMs);
	const pad = (n: number) => String(n).padStart(2, "0");
	return (
		`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
		`T${pad(d.getHours())}:${pad(d.getMinutes())}`
	);
}

/** `"2026-09-12 07:31:00"` → `"2026-09-12"`. Garmin's local activity timestamps. */
export function localDateOf(startTimeLocal: string | undefined): string | undefined {
	if (typeof startTimeLocal !== "string") return undefined;
	const match = startTimeLocal.match(/^(\d{4}-\d{2}-\d{2})/);
	return match ? match[1] : undefined;
}

/* ------------------------------------------------------------------ */
/*  Mapping                                                            */
/* ------------------------------------------------------------------ */

export function mapDay(data: DayData, opts: MapOptions): Properties {
	const out: Properties = {};
	const groups = new Set(opts.groups);
	const set = (key: string, value: PropertyValue | undefined) => {
		// Absent stays absent: a day Garmin has no data for should not gain a
		// row of empty properties.
		if (value === undefined) return;
		out[`${opts.prefix}${key}`] = value;
	};

	const summary = data.summary ?? undefined;

	if (groups.has("activity") && summary) {
		set("steps", metric(summary.totalSteps));
		set("steps_goal", metric(summary.dailyStepGoal));
		const d = distance(metric(summary.totalDistanceMeters), opts.units);
		if (d) set(d.key, d.value);
		set("calories", metric(summary.totalKilocalories));
		set("calories_active", metric(summary.activeKilocalories));
		set("floors", metric(summary.floorsAscended));

		const moderate = metric(summary.moderateIntensityMinutes);
		const vigorous = metric(summary.vigorousIntensityMinutes);
		set("intensity_moderate", moderate);
		set("intensity_vigorous", vigorous);
		if (moderate !== undefined || vigorous !== undefined) {
			// Garmin's own weighting: vigorous minutes count double.
			set("intensity_minutes", (moderate ?? 0) + (vigorous ?? 0) * 2);
		}
	}

	if (groups.has("heart") && summary) {
		set("resting_hr", metric(summary.restingHeartRate));
		set("min_hr", metric(summary.minHeartRate));
		set("max_hr", metric(summary.maxHeartRate));
	}

	if (groups.has("stress") && summary) {
		set("stress_avg", metric(summary.averageStressLevel));
		set("body_battery_high", metric(summary.bodyBatteryHighestValue));
		set("body_battery_low", metric(summary.bodyBatteryLowestValue));
	}

	if (groups.has("sleep")) {
		const dto = data.sleep?.dailySleepDTO;
		if (dto) {
			set("sleep_hours", hours(metric(dto.sleepTimeSeconds)));
			set("sleep_deep_hours", hours(metric(dto.deepSleepSeconds)));
			set("sleep_light_hours", hours(metric(dto.lightSleepSeconds)));
			set("sleep_rem_hours", hours(metric(dto.remSleepSeconds)));
			set("sleep_awake_hours", hours(metric(dto.awakeSleepSeconds)));
			set("sleep_start", toLocalDateTime(metric(dto.sleepStartTimestampGMT)));
			set("sleep_end", toLocalDateTime(metric(dto.sleepEndTimestampGMT)));

			const overall = (dto.sleepScores as { overall?: { value?: unknown } } | undefined)
				?.overall?.value;
			set("sleep_score", metric(overall));
		}
	}

	if (groups.has("hrv")) {
		const hrv = data.hrv?.hrvSummary;
		if (hrv) {
			set("hrv_avg", metric(hrv.lastNightAvg));
			set("hrv_high", metric(hrv.lastNight5MinHigh));
			set("hrv_weekly_avg", metric(hrv.weeklyAvg));
			if (typeof hrv.status === "string" && hrv.status) set("hrv_status", hrv.status);
		}
	}

	if (groups.has("readiness")) {
		const entry = data.readiness?.[0];
		if (entry) {
			set("training_readiness", metric(entry.score));
			if (typeof entry.level === "string" && entry.level) {
				set("training_readiness_level", entry.level);
			}
		}
	}

	if (groups.has("workouts")) {
		const workouts = (data.workouts ?? []).map((a) => mapWorkout(a, opts.units));
		if (workouts.length) set("workouts", workouts);
	}

	return out;
}

function mapWorkout(activity: Activity, units: MapOptions["units"]): Record<string, unknown> {
	const row: Record<string, unknown> = {};
	if (activity.activityName) row.name = activity.activityName;
	if (activity.activityType?.typeKey) row.type = activity.activityType.typeKey;
	if (activity.startTimeLocal) row.start = activity.startTimeLocal.replace(" ", "T").slice(0, 16);

	const mins = minutes(metric(activity.duration));
	if (mins !== undefined) row.minutes = mins;

	const d = distance(metric(activity.distance), units);
	if (d) row[d.key] = d.value;

	const calories = metric(activity.calories);
	if (calories !== undefined) row.calories = Math.round(calories);

	const hr = metric(activity.averageHR);
	if (hr !== undefined) row.avg_hr = Math.round(hr);

	return row;
}

/** Groups activities by the local calendar day they started on. */
export function bucketWorkoutsByDate(activities: readonly Activity[]): Map<string, Activity[]> {
	const byDate = new Map<string, Activity[]>();
	for (const activity of activities) {
		const date = localDateOf(activity.startTimeLocal);
		if (!date) continue;
		const list = byDate.get(date);
		if (list) list.push(activity);
		else byDate.set(date, [activity]);
	}
	return byDate;
}

/** Which endpoints a given set of groups actually needs. Fewer calls, fewer 429s. */
export function endpointsFor(groups: readonly MetricGroup[]) {
	const set = new Set(groups);
	return {
		summary: set.has("activity") || set.has("heart") || set.has("stress"),
		sleep: set.has("sleep"),
		hrv: set.has("hrv"),
		readiness: set.has("readiness"),
		workouts: set.has("workouts"),
	};
}
