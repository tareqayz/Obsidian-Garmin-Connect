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
