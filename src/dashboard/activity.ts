import { compact, duration, type WorkoutEntry } from "./series";

/**
 * One activity, as the v2 views read it.
 *
 * Pure, like `series.ts`: no Obsidian, no DOM. The v2 activity components are
 * mostly arrangement, and what arithmetic they need — which sport a typeKey
 * belongs to, how long a split bar is, what share of a session sat in Z3 —
 * lives here where it can be tested without mounting anything.
 */

/**
 * The five sport families the design gives a colour to.
 *
 * A family, not a Garmin typeKey: `running`, `trail_running` and
 * `treadmill_running` are one hue between them.
 */
export type Sport = "run" | "ride" | "swim" | "strength" | "other";

/** One split of a run, as the splits table draws it. */
export interface Split {
	/** How far this split covered, in the activity's distance unit. */
	distance: number;
	/** Seconds per unit of distance — the pace, not the elapsed time. */
	paceSeconds: number;
	hr?: number;
	/** Signed elevation change over the split. */
	elevation?: number;
}

/** Time spent in one heart-rate zone. */
export interface Zone {
	zone: 1 | 2 | 3 | 4 | 5;
	name: string;
	/** The zone's bpm bounds, which is what makes "Z4" mean something. */
	low: number;
	high: number;
	seconds: number;
}

/** One sample of the elevation profile. */
export interface ElevationPoint {
	/** Distance from the start, in the activity's unit. */
	distance: number;
	elevation: number;
}

/** A label/value pair in the detail grid, or a row metric. */
export interface Field {
	label: string;
	value: string;
	unit?: string;
}

export interface SplitRow extends Split {
	/** "1".."8" for whole splits, "0.4" for a trailing partial one. */
	label: string;
	pace: string;
	/** Share of the track the bar fills, 0–1. Longer always means faster. */
	fraction: number;
	/** A partial split's pace is not comparable to a whole one's. */
	partial: boolean;
}

export interface ZoneRow extends Zone {
	clock: string;
	/** Share of the session, 0–1. */
	fraction: number;
	percent: string;
}

const METRES_PER_FOOT = 0.3048;
const YARDS_PER_MILE = 1760;

/**
 * How short the slowest split's bar gets, as a fraction of the track.
 *
 * Read off the design rather than chosen: its slowest split draws 34px of a
 * 160px track. Bars are scaled across the observed range rather than from
 * zero, because the spread between a 4:42 and a 5:12 kilometre is about 10%
 * and a proportional mapping would make every split look identical. This floor
 * is what stops the stretch from reducing the slowest split to nothing.
 */
const SLOWEST_BAR = 0.2125;

/**
 * Which family a Garmin typeKey belongs to.
 *
 * Matched on the stem rather than against a list of every key Garmin has
 * shipped. The keys are composed — `trail_running`, `indoor_cycling`,
 * `virtual_ride`, `open_water_swimming` — so the stem keeps working for a key
 * this was not written against, which a list would not.
 */
export function sportOf(type: string | undefined): Sport {
	if (!type) return "other";
	const key = type.toLowerCase();
	if (key.includes("run")) return "run";
	if (key.includes("cycl") || key.includes("bik") || key.includes("ride") || key === "bmx") {
		return "ride";
	}
	if (key.includes("swim")) return "swim";
	if (key.includes("strength")) return "strength";
	return "other";
}

/** `running` → `Running`, `lap_swimming` → `Lap swimming`. */
export function typeLabel(type: string | undefined): string {
	if (!type) return "Activity";
	const words = type.replace(/_/g, " ");
	return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Seconds as `m:ss`, or `h:mm:ss` past the hour. */
export function clock(seconds: number): string {
	return duration(seconds);
}

/** One decimal, with a bare integer left bare: `43.5%`, `31%`. */
function trim(value: number): string {
	return value.toFixed(1).replace(/\.0$/, "");
}

/**
 * The time a workout took, in seconds.
 *
 * `mapWorkout` rounds to whole minutes on the way into frontmatter, so this
 * cannot resolve finer than that however it is formatted.
 */
export function workoutSeconds(entry: WorkoutEntry): number | undefined {
	return entry.minutes === undefined ? undefined : entry.minutes * 60;
}

/**
 * Splits with their labels and bar lengths worked out.
 *
 * The bar encodes speed, so the fastest split is always the longest one —
 * inverting pace here rather than in the component is what keeps that promise
 * in one place.
 */
export function splitRows(splits: readonly Split[]): SplitRow[] {
	if (splits.length === 0) return [];

	const paces = splits.map((s) => s.paceSeconds);
	const fastest = Math.min(...paces);
	const slowest = Math.max(...paces);
	const spread = slowest - fastest;

	let whole = 0;
	return splits.map((split) => {
		// A split short of its nominal distance is the leftover at the end.
		const partial = split.distance < 0.995;
		if (!partial) whole += 1;
		// A run at a metronome's pace has no spread to scale across; every bar
		// is then full rather than a division by zero.
		const t = spread === 0 ? 0 : (split.paceSeconds - fastest) / spread;
		return {
			...split,
			label: partial ? trim(split.distance) : String(whole),
			pace: clock(split.paceSeconds),
			fraction: 1 - (1 - SLOWEST_BAR) * t,
			partial,
		};
	});
}

/**
 * Zones hardest first, each with its share of the session.
 *
 * Ordered by intensity because the colour ramp is ordered: Z5 on top makes the
 * hot end of the ramp the top of the block.
 */
export function zoneRows(zones: readonly Zone[]): ZoneRow[] {
	const total = zones.reduce((sum, z) => sum + z.seconds, 0);
	return [...zones]
		.sort((a, b) => b.zone - a.zone)
		.map((zone) => ({
			...zone,
			clock: clock(zone.seconds),
			fraction: total > 0 ? zone.seconds / total : 0,
			percent: `${trim(total > 0 ? (zone.seconds / total) * 100 : 0)}%`,
		}));
}

/**
 * The third column of an activity row, which is the one that varies.
 *
 * A pace means nothing for a ride and a speed means nothing for a lift, so
 * each family gets the number its own sport is read in.
 */
export function rowHighlight(entry: WorkoutEntry): Field {
	const sport = sportOf(entry.type);
	const seconds = workoutSeconds(entry);
	const distance = entry.distance;

	if (sport === "strength") {
		return {
			label: "Effect",
			value: entry.training_effect === undefined ? "—" : String(entry.training_effect),
		};
	}

	if (sport === "ride") {
		if (!distance || !seconds) return { label: "Speed", value: "—" };
		const perHour = distance.value / (seconds / 3600);
		return { label: distance.unit === "mi" ? "mph" : "km/h", value: perHour.toFixed(1) };
	}

	if (sport === "swim") {
		if (!distance || !seconds || distance.value === 0) return { label: "Pace", value: "—" };
		// Swims are read per 100, not per kilometre or mile.
		const hundreds =
			distance.unit === "mi" ? (distance.value * YARDS_PER_MILE) / 100 : distance.value * 10;
		return {
			label: distance.unit === "mi" ? "/100 yd" : "/100 m",
			value: clock(seconds / hundreds),
		};
	}

	return {
		label: `Pace /${distance?.unit ?? "km"}`,
		value: entry.pace ?? "—",
	};
}

/**
 * The same number as `rowHighlight`, split for a label-over-value layout.
 *
 * A row writes "Pace /km" on one 9px line because it has one line. The hero and
 * the detail grid put the unit beside the value in the muted weight, so they
 * need the two apart. Null for a lift, whose highlight is its training effect —
 * the grid already carries that as a field of its own.
 */
export function paceField(entry: WorkoutEntry): Field | null {
	const sport = sportOf(entry.type);
	if (sport === "strength") return null;

	const highlight = rowHighlight(entry);
	if (highlight.value === "—") return null;

	if (sport === "ride") {
		return { label: "Avg speed", value: highlight.value, unit: highlight.label };
	}
	// "Pace /km" and "/100 m" both carry the unit in the label; the hero wants
	// it beside the number instead.
	return {
		label: "Avg pace",
		value: highlight.value,
		unit: highlight.label.replace(/^Pace /, ""),
	};
}

/** The four columns of an activity row, in order. */
export function rowMetrics(entry: WorkoutEntry): Field[] {
	const seconds = workoutSeconds(entry);
	return [
		{
			label: "Distance",
			value: entry.distance ? `${entry.distance.value} ${entry.distance.unit}` : "—",
		},
		{ label: "Time", value: seconds === undefined ? "—" : clock(seconds) },
		rowHighlight(entry),
		{ label: "Avg HR", value: entry.avg_hr === undefined ? "—" : String(entry.avg_hr) },
	];
}

/**
 * The three headline numbers above an activity.
 *
 * Distance, time and pace for anything that covers ground. A lift covers none,
 * so it leads with its duration instead of an empty distance.
 */
export function heroFields(entry: WorkoutEntry): Field[] {
	const seconds = workoutSeconds(entry);
	const time: Field = { label: "Time", value: seconds === undefined ? "—" : clock(seconds) };

	if (!entry.distance) {
		const out: Field[] = [time];
		if (entry.avg_hr !== undefined) {
			out.push({ label: "Avg HR", value: String(entry.avg_hr), unit: "bpm" });
		}
		if (entry.calories !== undefined) {
			out.push({ label: "Calories", value: compact(entry.calories), unit: "kcal" });
		}
		return out;
	}

	const pace = paceField(entry);
	return [
		{
			label: "Distance",
			value: String(entry.distance.value),
			unit: entry.distance.unit,
		},
		time,
		...(pace ? [pace] : []),
	];
}

/**
 * Everything else the vault holds about one activity.
 *
 * Only what is actually there: `mapWorkout` writes a deliberately short row,
 * so a field with nothing behind it is left out rather than printed as a dash.
 * `extra` is for fields a caller has from somewhere this does not know about.
 */
export function detailFields(entry: WorkoutEntry, extra: readonly Field[] = []): Field[] {
	const out: Field[] = [];
	const seconds = workoutSeconds(entry);

	if (seconds !== undefined) out.push({ label: "Time", value: clock(seconds) });
	if (entry.distance) {
		out.push({
			label: "Distance",
			value: String(entry.distance.value),
			unit: entry.distance.unit,
		});
	}

	const pace = paceField(entry);
	if (pace) out.push(pace);

	if (entry.avg_hr !== undefined) {
		out.push({ label: "Avg HR", value: String(entry.avg_hr), unit: "bpm" });
	}
	if (entry.max_hr !== undefined) {
		out.push({ label: "Max HR", value: String(entry.max_hr), unit: "bpm" });
	}
	if (entry.ascent) {
		out.push({ label: "Ascent", value: String(entry.ascent.value), unit: entry.ascent.unit });
	}
	if (entry.calories !== undefined) {
		out.push({ label: "Calories", value: compact(entry.calories), unit: "kcal" });
	}
	if (entry.steps !== undefined) {
		out.push({ label: "Steps", value: compact(entry.steps) });
	}
	if (entry.training_effect !== undefined) {
		out.push({
			label: "Training effect",
			value: String(entry.training_effect),
			unit: "aerobic",
		});
	}

	return [...out, ...extra];
}

/**
 * "2026-03-12" + "2026-03-12T07:12" → "Thursday 12 March · 07:12".
 *
 * Spelled out rather than `shortDate`'s "12 Mar": this is the one line naming
 * a single session, not a tick under a chart where the space is contested.
 */
export function activityWhen(entry: WorkoutEntry): string {
	const days = [
		"Sunday",
		"Monday",
		"Tuesday",
		"Wednesday",
		"Thursday",
		"Friday",
		"Saturday",
	];
	const months = [
		"January",
		"February",
		"March",
		"April",
		"May",
		"June",
		"July",
		"August",
		"September",
		"October",
		"November",
		"December",
	];

	const [y, m, d] = entry.date.split("-").map(Number);
	if (!y || !m || !d) return entry.date;

	// Constructed in local time on purpose: the date is the one Garmin filed
	// the session under, so shifting it through UTC could move it a day.
	const weekday = days[new Date(y, m - 1, d).getDay()] ?? "";
	const time = entry.start?.includes("T") ? entry.start.slice(11, 16) : "";
	const stamp = `${weekday} ${d} ${months[m - 1] ?? m}`;
	return time ? `${stamp} · ${time}` : stamp;
}

/** Metres or feet, whichever the activity was synced in. */
export function toDisplayElevation(metres: number, unit: string): number {
	return unit === "ft" ? Math.round(metres / METRES_PER_FOOT) : Math.round(metres);
}
