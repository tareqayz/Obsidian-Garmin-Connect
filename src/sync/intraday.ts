import type {
	BodyBatteryEvent,
	DailyStress,
	FloorsChart,
	HeartRateData,
	IntensityChart,
	SleepData,
	StepsChartEntry,
	ValueDescriptor,
} from "../garmin/endpoints";

/**
 * Garmin's intraday payloads → the per-day series file.
 *
 * Pure, like `metrics.ts`. The series cannot live in frontmatter: a day of
 * heart rate is several hundred points, and the metadata cache and every
 * frontmatter diff would carry all of them. So they go to a JSON file of their
 * own per day (see `series-store.ts`) and only a scalar or two reaches the note.
 *
 * Every timestamp is epoch milliseconds, UTC. Garmin mixes epoch numbers and
 * zone-less GMT strings across these endpoints; one convention on the way out
 * is what lets a chart overlay stress on Body Battery without caring which
 * endpoint each came from.
 */

/** `[epochMs, value]`. `null` is a gap Garmin reported — off-wrist, mid-activity. */
export type SeriesPoint = [number, number | null];

export interface StepsBucket {
	start: number;
	end: number;
	steps: number;
	/** Garmin's label for the bucket: `sedentary`, `active`, `highlyActive`, `sleeping`. */
	level?: string;
}

/** A 15-minute stretch with any floors in it. Quiet stretches are left out. */
export interface FloorsBucket {
	start: number;
	end: number;
	up: number;
	down: number;
}

export interface SleepLevel {
	start: number;
	end: number;
	/** Garmin's stage code, as sent. Believed to be 0 deep, 1 light, 2 REM, 3 awake. */
	level: number;
}

export interface BodyBatteryMarker {
	type?: string;
	start?: number;
	minutes?: number;
	/** Signed change in Body Battery across the event. */
	impact?: number;
	feedback?: string;
	activity?: string;
	activityType?: string;
	activityId?: number;
	averageStress?: number;
}

/** One part of the sleep score: Garmin's verdict, the night's figure, and the range it is judged against. */
export interface SleepFactor {
	/** EXCELLENT, GOOD, FAIR, POOR. */
	qualifier?: string;
	/** The stages' share of the night, in percent. Absent for the other parts. */
	value?: number;
	/** The optimal range: percent for the stages, seconds for duration, a level or a count otherwise. */
	optimalStart?: number;
	optimalEnd?: number;
	/** A stage's optimal range in seconds, for its page's bar. */
	idealStart?: number;
	idealEnd?: number;
}

export type SleepFactorKey = "duration" | "stress" | "deep" | "light" | "rem" | "awakeCount" | "restlessness";

/** The night's sleep need, minutes, and Garmin's reasons for it. */
export interface SleepNeedInfo {
	baseline?: number;
	actual?: number;
	feedback?: string;
	training?: string;
	history?: string;
	hrv?: string;
	nap?: string;
}

/** Sleep alignment: the optimal window and both midpoints, in minutes from midnight (negative before it). */
export interface SleepAlignmentInfo {
	status?: string;
	start?: number;
	end?: number;
	mid?: number;
	last?: number;
}

/**
 * Everything the Sleep page's day view draws, from the night's sleep payload.
 * Times are epoch milliseconds, UTC; `offset` turns them into the watch's clock.
 */
export interface SleepDetail {
	start: number;
	end: number;
	/** The watch's local time minus UTC that night, ms. */
	offset?: number;
	score?: number;
	quality?: string;
	seconds?: number;
	deep?: number;
	light?: number;
	rem?: number;
	awake?: number;
	factors?: Partial<Record<SleepFactorKey, SleepFactor>>;
	/** Garmin's message keys: the headline, the insight under it, and the personal one. */
	feedback?: string;
	insight?: string;
	personal?: string;
	avgStress?: number;
	avgHr?: number;
	restingHr?: number;
	bodyBatteryChange?: number;
	respAvg?: number;
	respLow?: number;
	spo2Avg?: number;
	spo2Low?: number;
	hrv?: number;
	hrvStatus?: string;
	skinC?: number;
	skinF?: number;
	awakeCount?: number;
	restlessCount?: number;
	/** Breathing variations, when the watch measures them. */
	breathing?: string;
	need?: SleepNeedInfo;
	nextNeed?: SleepNeedInfo;
	alignment?: SleepAlignmentInfo;
	/** `[epochMs, count]`: a restless moment can count more than one. */
	restless?: SeriesPoint[];
	heartRate?: SeriesPoint[];
	bodyBattery?: SeriesPoint[];
	hrvValues?: SeriesPoint[];
	stress?: SeriesPoint[];
	/** `[hourEndMs, breaths a minute]`: the hourly averages the app steps through. */
	respiration?: SeriesPoint[];
}

export interface DaySeries {
	/**
	 * When the day began on the watch's clock. The day's charts run from here,
	 * which need not be midnight on this computer's clock.
	 */
	dayStart?: number;
	stress?: SeriesPoint[];
	bodyBattery?: SeriesPoint[];
	heartRate?: SeriesPoint[];
	steps?: StepsBucket[];
	floors?: FloorsBucket[];
	/**
	 * `[bucketEndMs, minutes]` for each 15 minutes with any, vigorous counted
	 * twice, the way the week's total adds them up.
	 */
	intensity?: SeriesPoint[];
	sleepLevels?: SleepLevel[];
	/** The night's scores, factors and overnight series, for the Sleep page. */
	sleep?: SleepDetail;
	bodyBatteryEvents?: BodyBatteryMarker[];
}

export interface IntradayPayloads {
	stress?: DailyStress | null;
	heartRate?: HeartRateData | null;
	steps?: StepsChartEntry[] | null;
	floors?: FloorsChart | null;
	intensity?: IntensityChart | null;
	bodyBatteryEvents?: BodyBatteryEvent[] | null;
	sleep?: SleepData | null;
}

/** Bumped if the file's shape changes in a way a reader has to know about. */
export const SERIES_VERSION = 1;

export function mapSeries(payloads: IntradayPayloads): DaySeries {
	const out: DaySeries = {};

	const stress = payloads.stress;
	if (stress) {
		// Negative stress is Garmin's "not measured" (-1 off-wrist, -2 moving).
		// A gap, not a zero.
		const points = column(
			stress.stressValuesArray,
			indexOf(stress.stressValueDescriptorsDTOList, "stressLevel", 1),
			{ negativeIsGap: true },
		);
		if (points.length) out.stress = points;

		const battery = column(
			stress.bodyBatteryValuesArray,
			indexOf(stress.bodyBatteryValueDescriptorsDTOList, "bodyBatteryLevel", 2),
			{ negativeIsGap: true },
		);
		if (battery.length) out.bodyBattery = battery;
	}

	const hr = payloads.heartRate;
	if (hr) {
		const points = column(
			hr.heartRateValues,
			indexOf(hr.heartRateValueDescriptors as ValueDescriptor[] | undefined, "heartrate", 1),
			{ negativeIsGap: true },
		);
		if (points.length) out.heartRate = points;
	}

	const steps: StepsBucket[] = [];
	for (const entry of payloads.steps ?? []) {
		const start = epochOf(entry?.startGMT);
		const end = epochOf(entry?.endGMT);
		const count = finite(entry?.steps);
		if (start === undefined || end === undefined || count === undefined) continue;
		const bucket: StepsBucket = { start, end, steps: count };
		if (typeof entry.primaryActivityLevel === "string" && entry.primaryActivityLevel) {
			bucket.level = entry.primaryActivityLevel;
		}
		steps.push(bucket);
	}
	if (steps.length) out.steps = steps;

	const floors = payloads.floors;
	if (floors) {
		const d = floors.floorsValueDescriptorDTOList;
		const at = {
			start: indexOf(d, "startTimeGMT", 0),
			end: indexOf(d, "endTimeGMT", 1),
			up: indexOf(d, "floorsAscended", 2),
			down: indexOf(d, "floorsDescended", 3),
		};
		const buckets: FloorsBucket[] = [];
		for (const row of floors.floorValuesArray ?? []) {
			if (!Array.isArray(row)) continue;
			const start = epochOf(row[at.start]);
			const end = epochOf(row[at.end]);
			const up = finite(row[at.up]) ?? 0;
			const down = finite(row[at.down]) ?? 0;
			if (start === undefined || end === undefined || (up <= 0 && down <= 0)) continue;
			buckets.push({ start, end, up: Math.max(0, up), down: Math.max(0, down) });
		}
		if (buckets.length) out.floors = buckets;
	}

	const im = payloads.intensity;
	if (im) {
		const d = im.imValueDescriptorsDTOList;
		const points = column(im.imValuesArray, indexOf(d, "value", 1), { negativeIsGap: true }, indexOf(d, "timestamp", 0)).filter(
			(p): p is [number, number] => p[1] !== null && p[1] > 0,
		);
		if (points.length) out.intensity = points;
	}

	// Only beside something that is charted against it.
	const dayStart = epochOf(payloads.floors?.startTimestampGMT ?? payloads.intensity?.startTimestampGMT);
	if (dayStart !== undefined && (out.steps || out.floors || out.intensity)) out.dayStart = dayStart;

	const levels: SleepLevel[] = [];
	const rawLevels = payloads.sleep?.sleepLevels;
	for (const entry of Array.isArray(rawLevels) ? rawLevels : []) {
		const row = entry as Record<string, unknown> | null;
		const start = epochOf(row?.startGMT);
		const end = epochOf(row?.endGMT);
		const level = finite(row?.activityLevel);
		if (start === undefined || end === undefined || level === undefined) continue;
		levels.push({ start, end, level });
	}
	if (levels.length) out.sleepLevels = levels;

	const detail = payloads.sleep ? mapSleepDetail(payloads.sleep) : null;
	if (detail) out.sleep = detail;

	const markers: BodyBatteryMarker[] = [];
	for (const entry of payloads.bodyBatteryEvents ?? []) {
		const event = entry?.event ?? undefined;
		const marker: BodyBatteryMarker = {};
		assignText(marker, "type", event?.eventType);
		const start = epochOf(event?.eventStartTimeGmt);
		if (start !== undefined) marker.start = start;
		const ms = finite(event?.durationInMilliseconds);
		if (ms !== undefined) marker.minutes = Math.round(ms / 60_000);
		const impact = finite(event?.bodyBatteryImpact);
		if (impact !== undefined) marker.impact = impact;
		assignText(marker, "feedback", event?.shortFeedback ?? event?.feedbackType);
		assignText(marker, "activity", entry?.activityName);
		assignText(marker, "activityType", entry?.activityType);
		const id = finite(entry?.activityId);
		if (id !== undefined) marker.activityId = id;
		const avg = finite(entry?.averageStress);
		if (avg !== undefined && avg >= 0) marker.averageStress = avg;
		if (Object.keys(marker).length) markers.push(marker);
	}
	if (markers.length) out.bodyBatteryEvents = markers;

	return out;
}

const FACTOR_KEYS: Record<string, SleepFactorKey> = {
	totalDuration: "duration",
	stress: "stress",
	deepPercentage: "deep",
	lightPercentage: "light",
	remPercentage: "rem",
	awakeCount: "awakeCount",
	restlessness: "restlessness",
};

/**
 * The night's scores, factors and overnight series, or null on a day with no
 * night. Several of the night's figures sit beside `dailySleepDTO` rather than
 * in it (resting heart rate, Body Battery, HRV, skin temperature, restless
 * moments), so both places are read, the top level first.
 */
export function mapSleepDetail(sleep: SleepData): SleepDetail | null {
	const dto = (sleep.dailySleepDTO ?? {}) as Record<string, unknown>;
	const top = sleep as Record<string, unknown>;
	const pick = (key: string): unknown => (top[key] !== undefined && top[key] !== null ? top[key] : dto[key]);
	const start = finite(dto.sleepStartTimestampGMT);
	const end = finite(dto.sleepEndTimestampGMT);
	if (start === undefined || end === undefined || end <= start) return null;

	const out: SleepDetail = { start, end };
	const local = finite(dto.sleepStartTimestampLocal);
	if (local !== undefined) out.offset = local - start;

	const scores = (dto.sleepScores ?? {}) as Record<string, Record<string, unknown> | undefined>;
	const overall = scores.overall;
	assignNumber(out, "score", overall?.value);
	assignText(out, "quality", overall?.qualifierKey);
	assignNumber(out, "seconds", dto.sleepTimeSeconds);
	assignNumber(out, "deep", dto.deepSleepSeconds);
	assignNumber(out, "light", dto.lightSleepSeconds);
	assignNumber(out, "rem", dto.remSleepSeconds);
	assignNumber(out, "awake", dto.awakeSleepSeconds);

	const factors: Partial<Record<SleepFactorKey, SleepFactor>> = {};
	for (const [raw, key] of Object.entries(FACTOR_KEYS)) {
		const part = scores[raw];
		if (!part || typeof part !== "object") continue;
		const factor: SleepFactor = {};
		assignText(factor, "qualifier", part.qualifierKey);
		assignNumber(factor, "value", part.value);
		assignNumber(factor, "optimalStart", part.optimalStart);
		assignNumber(factor, "optimalEnd", part.optimalEnd);
		assignNumber(factor, "idealStart", part.idealStartInSeconds);
		assignNumber(factor, "idealEnd", part.idealEndInSeconds);
		if (Object.keys(factor).length) factors[key] = factor;
	}
	if (Object.keys(factors).length) out.factors = factors;

	for (const [key, from] of [
		["feedback", "sleepScoreFeedback"],
		["insight", "sleepScoreInsight"],
		["personal", "sleepScorePersonalizedInsight"],
	] as const) {
		const value = dto[from];
		if (typeof value === "string" && value && value !== "NONE" && value !== "NOT_AVAILABLE") out[key] = value;
	}

	assignNumber(out, "avgStress", pick("avgSleepStress"));
	assignNumber(out, "avgHr", pick("avgHeartRate"));
	assignNumber(out, "restingHr", pick("restingHeartRate"));
	const battery = finite(pick("bodyBatteryChange"));
	if (battery !== undefined) out.bodyBatteryChange = battery;
	assignNumber(out, "respAvg", pick("averageRespirationValue"));
	assignNumber(out, "respLow", pick("lowestRespirationValue"));
	assignNumber(out, "spo2Avg", pick("averageSpO2Value"));
	assignNumber(out, "spo2Low", pick("lowestSpO2Value"));
	assignNumber(out, "hrv", pick("avgOvernightHrv"));
	assignText(out, "hrvStatus", pick("hrvStatus"));
	const skinC = finite(pick("avgSkinTempDeviationC"));
	const skinF = finite(pick("avgSkinTempDeviationF"));
	if (skinC !== undefined) out.skinC = skinC;
	if (skinF !== undefined) out.skinF = skinF;
	assignNumber(out, "awakeCount", pick("awakeCount"));
	assignNumber(out, "restlessCount", pick("restlessMomentsCount"));
	assignText(out, "breathing", pick("breathingDisruptionSeverity"));

	const need = needOf(dto.sleepNeed);
	if (need) out.need = need;
	const next = needOf(dto.nextSleepNeed ?? top.nextSleepNeed);
	if (next) out.nextNeed = next;

	const align = dto.sleepAlignment as Record<string, unknown> | undefined;
	if (align && typeof align === "object") {
		const a: SleepAlignmentInfo = {};
		assignText(a, "status", align.status);
		assignSigned(a, "start", align.optimalSleepWindowStartMins);
		assignSigned(a, "end", align.optimalSleepWindowEndMins);
		assignSigned(a, "mid", align.optimalSleepWindowMidpointMins);
		assignSigned(a, "last", align.lastSleepMidpointMins);
		if (Object.keys(a).length) out.alignment = a;
	}

	// The overnight series. The payload pads the night by an hour each side;
	// a sample a few minutes out still belongs to its edge, as the chart draws it.
	const within = (t: number) => t >= start - 180_000 && t <= end + 180_000;
	const points = (list: unknown, at: string, value: string, keepNegative = false): SeriesPoint[] => {
		if (!Array.isArray(list)) return [];
		const found: SeriesPoint[] = [];
		for (const item of list) {
			const row = item as Record<string, unknown> | null;
			const t = epochOf(row?.[at]);
			const v = finite(row?.[value]);
			if (t === undefined || !within(t)) continue;
			found.push([t, v === undefined || (!keepNegative && v < 0) ? null : v]);
		}
		return found;
	};
	const restless = points(top.sleepRestlessMoments, "startGMT", "value").filter((p) => (p[1] ?? 0) > 0);
	if (restless.length) out.restless = restless;
	const hr = points(top.sleepHeartRate, "startGMT", "value");
	if (hr.length) out.heartRate = hr;
	const bb = points(top.sleepBodyBattery, "startGMT", "value");
	if (bb.length) out.bodyBattery = bb;
	const hrv = points(top.hrvData, "startGMT", "value");
	if (hrv.length) out.hrvValues = hrv;
	const stress = points(top.sleepStress, "startGMT", "value");
	if (stress.length) out.stress = stress;
	const resp = points(top.wellnessEpochRespirationAveragesList, "epochEndTimestampGmt", "respirationAverageValue");
	if (resp.some((p) => p[1] !== null)) out.respiration = resp;

	return out;
}

function needOf(raw: unknown): SleepNeedInfo | null {
	if (!raw || typeof raw !== "object") return null;
	const n = raw as Record<string, unknown>;
	const out: SleepNeedInfo = {};
	assignNumber(out, "baseline", n.baseline);
	assignNumber(out, "actual", n.actual);
	assignText(out, "feedback", n.feedback);
	assignText(out, "training", n.trainingFeedback);
	assignText(out, "history", n.sleepHistoryAdjustment);
	assignText(out, "hrv", n.hrvAdjustment);
	assignText(out, "nap", n.napAdjustment);
	return Object.keys(out).length ? out : null;
}

export function isEmptySeries(series: DaySeries): boolean {
	return Object.keys(series).length === 0;
}

/** The last reading that is not a gap. */
export function latestValue(points: readonly SeriesPoint[] | undefined): number | undefined {
	if (!points) return undefined;
	for (let i = points.length - 1; i >= 0; i--) {
		const value = points[i]![1];
		if (value !== null) return value;
	}
	return undefined;
}

/**
 * The file body for one day.
 *
 * Stable output for the same input, so the store can skip a write by comparing
 * text — the same reason `writeFrontmatter` diffs before touching a note.
 */
export function serializeSeries(date: string, series: DaySeries): string {
	return `${JSON.stringify({ date, version: SERIES_VERSION, ...series })}\n`;
}

export function parseSeries(text: string): DaySeries | null {
	try {
		const parsed = JSON.parse(text) as Record<string, unknown>;
		if (!parsed || typeof parsed !== "object") return null;
		const { date: _date, version: _version, ...series } = parsed;
		return series as DaySeries;
	} catch {
		return null;
	}
}

/* ------------------------------------------------------------------ */

function column(
	rows: unknown,
	index: number,
	{ negativeIsGap }: { negativeIsGap: boolean },
	timeIndex = 0,
): SeriesPoint[] {
	if (!Array.isArray(rows)) return [];
	const points: SeriesPoint[] = [];
	for (const row of rows) {
		if (!Array.isArray(row)) continue;
		const ts = finite(row[timeIndex]);
		if (ts === undefined) continue;
		const value = finite(row[index]);
		points.push([ts, value === undefined || (negativeIsGap && value < 0) ? null : value]);
	}
	return points;
}

/** Where a named column sits, per Garmin's descriptor list, or the known default. */
function indexOf(descriptors: ValueDescriptor[] | null | undefined, key: string, fallback: number): number {
	if (Array.isArray(descriptors)) {
		for (const d of descriptors) {
			if (d?.key === key && typeof d.index === "number") return d.index;
		}
	}
	return fallback;
}

/** Epoch millis from an epoch number or a zone-less GMT string like `2026-09-19T21:58:00.0`. */
export function epochOf(value: unknown): number | undefined {
	if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
	if (typeof value !== "string" || !value) return undefined;
	let text = value.trim().replace(" ", "T");
	if (!/[zZ]|[+-]\d{2}:?\d{2}$/.test(text)) text += "Z";
	const ms = Date.parse(text);
	return Number.isFinite(ms) ? ms : undefined;
}

function finite(value: unknown): number | undefined {
	return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function assignText<T extends object>(target: T, key: keyof T, value: unknown): void {
	if (typeof value === "string" && value.trim()) (target as Record<keyof T, unknown>)[key] = value;
}

/** A finite, non-negative number. Garmin sends -1 and -2 for "not measured". */
function assignNumber<T extends object>(target: T, key: keyof T, value: unknown): void {
	if (typeof value === "number" && Number.isFinite(value) && value >= 0) (target as Record<keyof T, unknown>)[key] = value;
}

function assignSigned<T extends object>(target: T, key: keyof T, value: unknown): void {
	if (typeof value === "number" && Number.isFinite(value)) (target as Record<keyof T, unknown>)[key] = value;
}
