/**
 * Turning synced rows into plottable series and headline numbers.
 *
 * Pure: no Obsidian, no DOM, no clock except what is passed in. The dashboard's
 * arithmetic is the part most worth testing, so it lives on its own.
 */

/** One synced day, as the dashboard reads it back out of frontmatter. */
export interface DayRow {
	date: string;
	values: Record<string, number>;
	/**
	 * Garmin's qualitative properties — `hrv_status`, `training_status`. Kept
	 * apart from `values` so nothing tries to average them.
	 */
	text?: Record<string, string>;
	/** The day's activities, as `mapWorkout` wrote them. */
	workouts?: Array<Record<string, unknown>>;
}

/** One activity, with the day it belongs to attached. */
export interface WorkoutEntry {
	date: string;
	name?: string;
	type?: string;
	start?: string;
	minutes?: number;
	calories?: number;
	avg_hr?: number;
	max_hr?: number;
	pace?: string;
	training_effect?: number;
	steps?: number;
	distance?: { value: number; unit: string };
	/** Elevation gained, in metres or feet depending on the synced units. */
	ascent?: { value: number; unit: string };
}

export interface Point {
	date: string;
	value: number;
}

export interface Stats {
	points: Point[];
	latest?: Point;
	mean?: number;
	min?: Point;
	max?: Point;
	/**
	 * Recent-window mean minus the window before it, as a fraction. Undefined
	 * when either window is empty — a delta against nothing is not a delta.
	 */
	delta?: number;
}

/** Rows within the last `days` days, oldest first. */
export function inRange(rows: readonly DayRow[], days: number, today: string): DayRow[] {
	const cutoff = shiftDate(today, -(days - 1));
	return rows
		.filter((r) => r.date >= cutoff && r.date <= today)
		.sort((a, b) => a.date.localeCompare(b.date));
}

export function seriesOf(rows: readonly DayRow[], key: string): Point[] {
	const points: Point[] = [];
	for (const row of rows) {
		const value = row.values[key];
		if (typeof value === "number" && Number.isFinite(value)) {
			points.push({ date: row.date, value });
		}
	}
	return points;
}

export function statsFor(points: readonly Point[], window = 7): Stats {
	if (points.length === 0) return { points: [] };

	let min = points[0]!;
	let max = points[0]!;
	let total = 0;
	for (const p of points) {
		if (p.value < min.value) min = p;
		if (p.value > max.value) max = p;
		total += p.value;
	}

	return {
		points: [...points],
		latest: points[points.length - 1],
		mean: total / points.length,
		min,
		max,
		delta: relativeDelta(points, window),
	};
}

/**
 * Change between the last `window` points and the `window` before them.
 *
 * Comparing windows rather than the two most recent days is deliberate: a single
 * day of Garmin data swings far too much to be a trend.
 */
export function relativeDelta(points: readonly Point[], window: number): number | undefined {
	if (points.length < 2) return undefined;
	const recent = points.slice(-window);
	const prior = points.slice(-window * 2, -window);
	if (recent.length === 0 || prior.length === 0) return undefined;

	const priorMean = mean(prior);
	if (priorMean === 0) return undefined;
	return (mean(recent) - priorMean) / Math.abs(priorMean);
}

function mean(points: readonly Point[]): number {
	return points.reduce((sum, p) => sum + p.value, 0) / points.length;
}

/** The most recent non-empty value of a text property, with its date. */
export function latestText(
	rows: readonly DayRow[],
	key: string,
): { date: string; value: string } | undefined {
	for (let i = rows.length - 1; i >= 0; i--) {
		const value = rows[i]!.text?.[key];
		if (typeof value === "string" && value) return { date: rows[i]!.date, value };
	}
	return undefined;
}

/**
 * Every activity in the range, newest first.
 *
 * Distance arrives under whichever unit key the sync was written with, so it is
 * normalised here rather than in the component — the dashboard should not have
 * to know that a vault synced in miles exists.
 */
export function workoutsIn(rows: readonly DayRow[]): WorkoutEntry[] {
	const out: WorkoutEntry[] = [];
	for (const row of rows) {
		for (const raw of row.workouts ?? []) {
			const entry: WorkoutEntry = { date: row.date };
			for (const key of ["name", "type", "start", "pace"] as const) {
				const value = raw[key];
				if (typeof value === "string" && value) entry[key] = value;
			}
			for (const key of [
				"minutes",
				"calories",
				"avg_hr",
				"max_hr",
				"training_effect",
				"steps",
			] as const) {
				const value = raw[key];
				if (typeof value === "number" && Number.isFinite(value)) entry[key] = value;
			}
			const km = raw.distance_km;
			const mi = raw.distance_mi;
			if (typeof km === "number") entry.distance = { value: km, unit: "km" };
			else if (typeof mi === "number") entry.distance = { value: mi, unit: "mi" };
			// `mapWorkout` has always written these two; reading them back is what
			// was missing, which is why an activity's climb never reached the UI.
			const metres = raw.elevation_gain_m;
			const feet = raw.elevation_gain_ft;
			if (typeof metres === "number") entry.ascent = { value: metres, unit: "m" };
			else if (typeof feet === "number") entry.ascent = { value: feet, unit: "ft" };
			out.push(entry);
		}
	}
	// Within a day Garmin lists newest first already; across days, sort by the
	// start time when there is one so an evening run precedes that morning's.
	return out.sort((a, b) => (b.start ?? b.date).localeCompare(a.start ?? a.date));
}

/** Which of a set of keys any row actually carries — drives what gets drawn. */
export function availableKeys(rows: readonly DayRow[], keys: readonly string[]): string[] {
	return keys.filter((key) =>
		rows.some((row) => typeof row.values[key] === "number" && Number.isFinite(row.values[key])),
	);
}

/**
 * The same, for Garmin's qualitative properties.
 *
 * Kept separate because nothing charts a string: these reach the table and the
 * detail views, never a series.
 */
export function availableTextKeys(rows: readonly DayRow[], keys: readonly string[]): string[] {
	return keys.filter((key) => rows.some((row) => Boolean(row.text?.[key])));
}

/* ------------------------------------------------------------------ */
/*  Dates                                                              */
/* ------------------------------------------------------------------ */

const DAY_MS = 86_400_000;

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Inclusive day count between two ISO dates, or 0 for anything else.
 *
 * The shape is checked rather than assumed: `Date.UTC` happily turns `""` into
 * a real date in 1900, so an empty window would otherwise measure as one day.
 */
export function daysBetween(from: string, to: string): number {
	if (!ISO_DAY.test(from) || !ISO_DAY.test(to)) return 0;
	const [fy, fm, fd] = from.split("-").map(Number);
	const [ty, tm, td] = to.split("-").map(Number);
	const start = Date.UTC(fy!, fm! - 1, fd!);
	const end = Date.UTC(ty!, tm! - 1, td!);
	if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 0;
	return Math.round((end - start) / DAY_MS) + 1;
}

export function shiftDate(iso: string, days: number): string {
	const [y, m, d] = iso.split("-").map(Number);
	return new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1) + days * DAY_MS).toISOString().slice(0, 10);
}

/* ------------------------------------------------------------------ */
/*  Formatting                                                         */
/* ------------------------------------------------------------------ */

/** 1284 → "1,284"; 12934 → "12.9K". Proportional figures, so no padding. */
export function compact(value: number): string {
	const abs = Math.abs(value);
	if (abs >= 1_000_000) return `${trim(value / 1_000_000)}M`;
	if (abs >= 10_000) return `${trim(value / 1000)}K`;
	if (abs >= 1000) return Math.round(value).toLocaleString();
	if (Number.isInteger(value)) return String(value);
	return trim(value);
}

function trim(value: number): string {
	return value.toFixed(1).replace(/\.0$/, "");
}

/**
 * The exact value, for a tooltip or a table cell.
 *
 * Not `compact`: a reader who has hovered a bar wants 12,767, not "12.8K".
 */
export function detail(value: number): string {
	if (Number.isInteger(value)) return value.toLocaleString();
	return (Math.round(value * 100) / 100).toLocaleString();
}

/** Seconds → "24:31" or "3:12:04". What a race prediction should read as. */
export function duration(seconds: number): string {
	const total = Math.round(seconds);
	const h = Math.floor(total / 3600);
	const m = Math.floor((total % 3600) / 60);
	const sec = total % 60;
	const pad = (n: number) => String(n).padStart(2, "0");
	return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

/** Rows inside an explicit window, oldest first. */
export function between(rows: readonly DayRow[], from: string, to: string): DayRow[] {
	if (!from || !to || to < from) return [];
	return rows
		.filter((r) => r.date >= from && r.date <= to)
		.sort((a, b) => a.date.localeCompare(b.date));
}

/** 7.5 → "7h 30m" */
export function hoursAndMinutes(hours: number): string {
	const whole = Math.floor(hours);
	const mins = Math.round((hours - whole) * 60);
	return mins === 0 ? `${whole}h` : `${whole}h ${mins}m`;
}

export function percent(fraction: number): string {
	const pct = fraction * 100;
	const sign = pct > 0 ? "+" : "";
	return `${sign}${Math.abs(pct) < 10 ? pct.toFixed(1) : Math.round(pct)}%`;
}

/** "2026-09-12" → "12 Sep" */
export function shortDate(iso: string): string {
	const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
	const [, m, d] = iso.split("-");
	return `${Number(d)} ${months[Number(m) - 1] ?? m}`;
}

/**
 * One formatter for a whole tick set.
 *
 * Formatting each tick independently produces axes that read "0 / 5,000 / 10K" —
 * three different conventions on one scale. The set decides the convention.
 */
export function axisFormat(ticks: readonly number[]): (value: number) => string {
	const max = Math.max(0, ...ticks.map(Math.abs));
	// Zero is always plain: "0K" is noise on an axis that starts at nothing.
	if (max >= 10_000) return (v) => (v === 0 ? "0" : `${trim(v / 1000)}K`);
	if (max >= 1000) return (v) => Math.round(v).toLocaleString();

	// Decimals are chosen by trying the shortest form that still tells the truth
	// about every tick. Deciding from magnitude alone renders a VO2 Max axis of
	// 48.0/48.5/49.0 as "49, 49, 48"; deciding from the gap alone renders a tick
	// at 2.5 as "3".
	for (let places = 0; places <= 3; places++) {
		const labels = ticks.map((t) => t.toFixed(places));
		const faithful = ticks.every((t, i) => Math.abs(Number(labels[i]) - t) < 1e-9);
		if (faithful && new Set(labels).size === labels.length) {
			return (v) => v.toFixed(places);
		}
	}
	return (v) => trim(v);
}

/** Axis ticks on round numbers, per the "clean numbers" rule. */
export function niceTicks(min: number, max: number, count = 4): number[] {
	if (!Number.isFinite(min) || !Number.isFinite(max)) return [];
	if (min === max) return [min];
	const raw = (max - min) / Math.max(1, count);
	const magnitude = 10 ** Math.floor(Math.log10(raw));
	const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? magnitude * 10;

	const ticks: number[] = [];
	for (let t = Math.ceil(min / step) * step; t <= max + step / 1000; t += step) {
		ticks.push(Math.round(t * 1e6) / 1e6);
	}
	return ticks;
}
