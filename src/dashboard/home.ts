import type { AccountInfo } from "../sync/account";
import type { DaySeries, SeriesPoint, SleepLevel } from "../sync/intraday";
import type { DayRow } from "./series";

/**
 * The Home screen: a rebuild of Garmin Connect's home, preset for preset.
 *
 * Pure. Everything the cards draw is worked out here from the synced day rows,
 * that day's series file and `account.json`, so the Svelte side only lays it
 * out. It is deliberately a copy of Garmin's screen rather than a new design,
 * which is what makes a side-by-side check against the phone possible.
 */

export type PresetId = "be-healthy" | "stay-active" | "track-my-training";
export type FocusId = "sleep" | "bodyBattery" | "steps" | "activities" | "readiness" | "trainingStatus";
export type GlanceId =
	| "heartRate"
	| "intensity"
	| "calories"
	| "stress"
	| "steps"
	| "bodyBattery"
	| "sleep"
	| "hrv";
export type MoreId = "events" | "coachPlans" | "challenges";

export interface Preset {
	id: PresetId;
	name: string;
	/** The line under the name in Garmin's Reset Home sheet. */
	blurb: string;
	/** What the preset sheet lists under the name. */
	highlights: string[];
	inFocus: FocusId[];
	glance: GlanceId[];
	more: MoreId[];
}

/** Garmin's three presets, as the app ships them. */
export const PRESETS: readonly Preset[] = [
	{
		id: "be-healthy",
		name: "Be healthy",
		blurb: "You’re most interested in getting to know your body better.",
		highlights: ["Sleep", "Body Battery", "Steps"],
		inFocus: ["sleep", "bodyBattery", "steps"],
		glance: ["heartRate", "intensity", "calories", "stress"],
		more: ["challenges"],
	},
	{
		id: "stay-active",
		name: "Stay active",
		blurb: "You’re an active person who is interested in both exercise and overall wellbeing.",
		highlights: ["Sleep", "Body Battery", "Exercise trends"],
		inFocus: ["sleep", "bodyBattery", "activities"],
		glance: ["heartRate", "intensity", "steps", "calories"],
		more: ["events", "coachPlans", "challenges"],
	},
	{
		id: "track-my-training",
		name: "Track my training",
		blurb: "You’re a competitive athlete who is most interested in training and improving.",
		highlights: ["Training readiness", "Training status"],
		inFocus: ["readiness", "trainingStatus"],
		glance: ["heartRate", "bodyBattery", "sleep", "hrv"],
		more: ["events", "coachPlans", "challenges"],
	},
];

export const DEFAULT_PRESET: PresetId = "be-healthy";

export function presetFor(id: string | undefined): Preset {
	return PRESETS.find((p) => p.id === id) ?? PRESETS[0]!;
}

export function isPresetId(value: unknown): value is PresetId {
	return PRESETS.some((p) => p.id === value);
}

/* ------------------------------------------------------------------ */
/*  Input                                                              */
/* ------------------------------------------------------------------ */

export interface HomeInput {
	/** The day on screen, `YYYY-MM-DD`. */
	date: string;
	/** Every synced day, oldest first. */
	rows: readonly DayRow[];
	/** That day's series file, if one was written. */
	series: DaySeries | null;
	account: AccountInfo | null;
}

/* ------------------------------------------------------------------ */
/*  Small helpers                                                      */
/* ------------------------------------------------------------------ */

const DAY_MS = 86_400_000;

/** Local midnight of a `YYYY-MM-DD` day, as epoch ms. */
export function dayStart(date: string): number {
	const [y, m, d] = date.split("-").map(Number);
	return new Date(y!, m! - 1, d!).getTime();
}

export function addDays(date: string, days: number): string {
	const [y, m, d] = date.split("-").map(Number);
	const next = new Date(y!, m! - 1, d! + days);
	return isoOf(next);
}

function isoOf(d: Date): string {
	const pad = (n: number) => String(n).padStart(2, "0");
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Garmin's enum spellings → words: `VERY_GOOD` → "Very good". */
export function humanize(value: string | undefined): string | undefined {
	if (!value) return undefined;
	const words = value
		.replace(/_\d+$/, "")
		.toLowerCase()
		.split(/[_\s]+/)
		.filter(Boolean);
	if (!words.length) return undefined;
	const text = words.join(" ");
	return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Every word capitalised, the way Garmin labels a status: "Low Need". */
export function titleCase(value: string | undefined): string | undefined {
	const text = humanize(value);
	return text?.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** `7.5` → "7h 30m". */
export function hoursText(hours: number | undefined): string | undefined {
	if (hours === undefined || !Number.isFinite(hours)) return undefined;
	const total = Math.round(hours * 60);
	const h = Math.floor(total / 60);
	const m = total % 60;
	return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** Minutes → "1:20:23"-style, the way Garmin totals activity time. */
export function clockText(minutes: number): string {
	const total = Math.round(minutes * 60);
	const h = Math.floor(total / 3600);
	const m = Math.floor((total % 3600) / 60);
	const s = total % 60;
	const pad = (n: number) => String(n).padStart(2, "0");
	return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

function rowOn(rows: readonly DayRow[], date: string): DayRow | undefined {
	for (let i = rows.length - 1; i >= 0; i--) {
		if (rows[i]!.date === date) return rows[i];
		if (rows[i]!.date < date) break;
	}
	return undefined;
}

function num(row: DayRow | undefined, key: string): number | undefined {
	const v = row?.values[key];
	return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

function str(row: DayRow | undefined, key: string): string | undefined {
	const v = row?.text?.[key];
	return typeof v === "string" && v ? v : undefined;
}

function lastDays(rows: readonly DayRow[], date: string, days: number): Array<{ date: string; row?: DayRow }> {
	const out: Array<{ date: string; row?: DayRow }> = [];
	for (let i = days - 1; i >= 0; i--) {
		const d = addDays(date, -i);
		out.push({ date: d, row: rowOn(rows, d) });
	}
	return out;
}

const WEEKDAY = ["S", "M", "T", "W", "T", "F", "S"];

function weekdayLetter(date: string): string {
	return WEEKDAY[new Date(dayStart(date)).getDay()]!;
}

/** Distance in the unit the note was written in. */
function distanceOf(row: DayRow | undefined): { value: number; unit: "km" | "mi" } | undefined {
	const km = num(row, "distance_km");
	if (km !== undefined) return { value: km, unit: "km" };
	const mi = num(row, "distance_mi");
	if (mi !== undefined) return { value: mi, unit: "mi" };
	return undefined;
}

/* ------------------------------------------------------------------ */
/*  Today's Activity                                                   */
/* ------------------------------------------------------------------ */

export interface ActivityItem {
	kind: "activity";
	name: string;
	type?: string;
	start?: string;
	minutes?: number;
	distance?: string;
	calories?: number;
}

export interface SnapshotItem {
	kind: "snapshot";
	/** "Health Snapshot - Afternoon". */
	title: string;
	hr?: number;
	spo2?: number;
	respiration?: number;
	start?: string;
}

export type TodayItem = ActivityItem | SnapshotItem;

function partOfDay(start: string | undefined): string {
	const hour = Number(start?.slice(11, 13));
	if (!Number.isFinite(hour)) return "";
	if (hour < 12) return "Morning";
	if (hour < 17) return "Afternoon";
	return "Evening";
}

export function todayActivity(row: DayRow | undefined): TodayItem[] {
	const items: TodayItem[] = [];
	for (const w of row?.workouts ?? []) {
		const name = typeof w.name === "string" ? w.name : "Activity";
		const km = typeof w.distance_km === "number" ? w.distance_km : undefined;
		const mi = typeof w.distance_mi === "number" ? w.distance_mi : undefined;
		items.push({
			kind: "activity",
			name,
			type: typeof w.type === "string" ? w.type : undefined,
			start: typeof w.start === "string" ? w.start : undefined,
			minutes: typeof w.minutes === "number" ? w.minutes : undefined,
			distance: km !== undefined ? `${km.toFixed(2)} km` : mi !== undefined ? `${mi.toFixed(2)} mi` : undefined,
			calories: typeof w.calories === "number" ? w.calories : undefined,
		});
	}
	for (const s of row?.snapshots ?? []) {
		const start = typeof s.start === "string" ? s.start : undefined;
		const part = partOfDay(start);
		items.push({
			kind: "snapshot",
			title: part ? `Health Snapshot - ${part}` : "Health Snapshot",
			hr: typeof s.hr === "number" ? s.hr : undefined,
			spo2: typeof s.spo2 === "number" ? s.spo2 : undefined,
			respiration: typeof s.respiration === "number" ? s.respiration : undefined,
			start,
		});
	}
	// Newest first, the way Garmin stacks the day.
	return items.sort((a, b) => (b.start ?? "").localeCompare(a.start ?? ""));
}

/* ------------------------------------------------------------------ */
/*  Sleep Coach                                                        */
/* ------------------------------------------------------------------ */

export interface SleepCoach {
	hours: string;
	message: string;
}

const NEED_MESSAGE: Record<string, string> = {
	DECREASED: "You need less sleep today.",
	INCREASED: "You need more sleep today.",
	NO_CHANGE: "Your sleep need hasn’t changed.",
};

export function sleepCoach(row: DayRow | undefined): SleepCoach | null {
	const hours = hoursText(num(row, "sleep_need_hours"));
	if (!hours) return null;
	const feedback = str(row, "sleep_need_feedback");
	return {
		hours,
		message: (feedback && NEED_MESSAGE[feedback]) ?? "Based on your recent sleep and activity.",
	};
}

/* ------------------------------------------------------------------ */
/*  Sleep                                                              */
/* ------------------------------------------------------------------ */

export interface SleepView {
	score?: number;
	quality?: string;
	duration?: string;
	levels: SleepLevel[];
	start?: number;
	end?: number;
}

export function sleepView(row: DayRow | undefined, series: DaySeries | null): SleepView | null {
	const score = num(row, "sleep_score");
	const hours = num(row, "sleep_hours");
	const levels = series?.sleepLevels ?? [];
	if (score === undefined && hours === undefined && !levels.length) return null;
	return {
		score,
		quality: humanize(str(row, "sleep_quality"))?.replace(/^\w/, (c) => c.toUpperCase()),
		duration: hoursText(hours),
		levels,
		start: levels[0]?.start,
		end: levels[levels.length - 1]?.end,
	};
}

/* ------------------------------------------------------------------ */
/*  Body Battery                                                       */
/* ------------------------------------------------------------------ */

export interface BatteryView {
	latest?: number;
	charged?: number;
	drained?: number;
	high?: number;
	points: SeriesPoint[];
	stress: SeriesPoint[];
	/** Local midnight to midnight: the chart's x domain. */
	from: number;
	to: number;
	/** Where sleep ended and a snapshot was taken, for the chart's markers. */
	wake?: number;
	snapshot?: number;
}

export function batteryView(input: HomeInput, row: DayRow | undefined): BatteryView | null {
	const s = input.series;
	const latest = num(row, "body_battery_latest");
	if (latest === undefined && !s?.bodyBattery?.length) return null;
	const from = dayStart(input.date);
	const sleepEnd = s?.sleepLevels?.length ? s.sleepLevels[s.sleepLevels.length - 1]!.end : undefined;
	const snap = row?.snapshots?.[0]?.start;
	return {
		latest,
		charged: num(row, "body_battery_charged"),
		drained: num(row, "body_battery_drained"),
		high: num(row, "body_battery_high"),
		points: s?.bodyBattery ?? [],
		stress: s?.stress ?? [],
		from,
		to: from + DAY_MS,
		wake: sleepEnd,
		snapshot: typeof snap === "string" ? new Date(snap).getTime() : undefined,
	};
}

/* ------------------------------------------------------------------ */
/*  Steps                                                              */
/* ------------------------------------------------------------------ */

export interface StepsView {
	steps: number;
	goal?: number;
	distance?: string;
	/** Running total through the day. */
	cumulative: SeriesPoint[];
	from: number;
	to: number;
	currentStreak: number;
	longestStreak: number;
	/** The last seven days, oldest first: weekday letter and whether the goal was met. */
	week: Array<{ label: string; met: boolean | null; today: boolean }>;
}

export function stepsView(input: HomeInput, row: DayRow | undefined): StepsView | null {
	const steps = num(row, "steps");
	if (steps === undefined) return null;
	const from = dayStart(input.date);
	const cumulative: SeriesPoint[] = [];
	let total = 0;
	for (const b of input.series?.steps ?? []) {
		if (!cumulative.length) cumulative.push([b.start, 0]);
		total += b.steps;
		cumulative.push([b.end, total]);
	}
	const dist = distanceOf(row);
	const { current, longest } = streaks(input.rows, input.date);
	return {
		steps,
		goal: num(row, "steps_goal"),
		distance: dist ? `${dist.value.toFixed(1)} ${dist.unit}` : undefined,
		cumulative,
		from,
		to: from + DAY_MS,
		currentStreak: current,
		longestStreak: longest,
		week: lastDays(input.rows, input.date, 7).map(({ date, row: r }) => {
			const s = num(r, "steps");
			const g = num(r, "steps_goal");
			return {
				label: weekdayLetter(date),
				met: s === undefined || g === undefined ? null : s >= g,
				today: date === input.date,
			};
		}),
	};
}

/**
 * Consecutive days on which the step goal was met.
 *
 * Today only extends a streak once the goal is met; an unfinished today does
 * not break one, which is how Garmin counts it.
 */
export function streaks(rows: readonly DayRow[], date: string): { current: number; longest: number } {
	let longest = 0;
	let run = 0;
	/** The last day the goal was met, while the run is unbroken. */
	let last: string | undefined;
	for (const r of rows) {
		if (r.date > date) break;
		const s = num(r, "steps");
		const g = num(r, "steps_goal");
		if (s !== undefined && g !== undefined && s >= g) {
			run = last !== undefined && addDays(last, 1) === r.date ? run + 1 : 1;
			last = r.date;
			longest = Math.max(longest, run);
		} else if (r.date !== date) {
			run = 0;
			last = undefined;
		}
	}
	// A run that ended before yesterday is not current.
	const current = last !== undefined && (last === date || last === addDays(date, -1)) ? run : 0;
	return { current, longest };
}

/* ------------------------------------------------------------------ */
/*  All Activities                                                     */
/* ------------------------------------------------------------------ */

export interface ActivitiesView {
	/** "Sep 18-24". */
	range: string;
	total: string;
	days: Array<{ label: string; minutes: number }>;
	/** The last 28 days, oldest first: whether anything was recorded. */
	month: boolean[];
}

function workoutMinutes(row: DayRow | undefined): number {
	let total = 0;
	for (const w of row?.workouts ?? []) if (typeof w.minutes === "number") total += w.minutes;
	return total;
}

const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function shortDate(date: string): string {
	return `${MONTH[Number(date.slice(5, 7)) - 1]} ${Number(date.slice(8, 10))}`;
}

export function activitiesView(input: HomeInput): ActivitiesView {
	const week = lastDays(input.rows, input.date, 7);
	const first = week[0]!.date;
	const last = week[week.length - 1]!.date;
	const sameMonth = first.slice(0, 7) === last.slice(0, 7);
	const days = week.map(({ date, row }) => ({ label: weekdayLetter(date), minutes: workoutMinutes(row) }));
	return {
		range: `${shortDate(first)}-${sameMonth ? Number(last.slice(8, 10)) : shortDate(last)}`,
		total: clockText(days.reduce((sum, d) => sum + d.minutes, 0)),
		days,
		month: lastDays(input.rows, input.date, 28).map(({ row }) => workoutMinutes(row) > 0),
	};
}

/* ------------------------------------------------------------------ */
/*  Training Readiness                                                 */
/* ------------------------------------------------------------------ */

export interface ReadinessView {
	score: number;
	level?: string;
	message?: string;
	factors: Array<{ label: string; value: string }>;
}

const READINESS_MESSAGE: Record<string, string> = {
	TIME_TO_RECHARGE: "Time to recharge",
	ENERGIZED_BY_GOOD_SLEEP: "Energized by good sleep",
	WELL_RECOVERED: "Well recovered",
	READY_FOR_THE_DAY: "Ready for the day",
};

export function readinessView(row: DayRow | undefined): ReadinessView | null {
	const score = num(row, "training_readiness");
	if (score === undefined) return null;
	const feedback = str(row, "readiness_feedback");
	const recovery = num(row, "recovery_time_hours");
	const factor = (label: string, value: string | undefined) => (value ? [{ label, value }] : []);
	return {
		score,
		level: titleCase(str(row, "training_readiness_level")),
		message: feedback ? READINESS_MESSAGE[feedback] ?? humanize(feedback) : undefined,
		factors: [
			...factor("Sleep", titleCase(str(row, "readiness_sleep_feedback"))),
			...factor(
				"Recovery",
				recovery !== undefined ? (recovery < 12 ? "Low Need" : recovery < 36 ? "Moderate" : "High Need") : undefined,
			),
			...factor("HRV Status", titleCase(str(row, "hrv_status"))),
			...factor("Acute Load", titleCase(str(row, "readiness_load_feedback"))),
			...factor("Recent Sleep", titleCase(str(row, "readiness_sleep_history_feedback"))),
			...factor("Recent Stress", titleCase(str(row, "readiness_stress_history_feedback"))),
		],
	};
}

/* ------------------------------------------------------------------ */
/*  Training Status                                                    */
/* ------------------------------------------------------------------ */

export type StatusTone = "detraining" | "recovery" | "maintaining" | "productive" | "peaking" | "strained" | "unproductive" | "none";

export function statusTone(status: string | undefined): StatusTone {
	const s = (status ?? "").toUpperCase();
	if (s.startsWith("PRODUCTIVE")) return "productive";
	if (s.startsWith("PEAKING")) return "peaking";
	if (s.startsWith("MAINTAINING")) return "maintaining";
	if (s.startsWith("RECOVERY")) return "recovery";
	if (s.startsWith("UNPRODUCTIVE")) return "unproductive";
	if (s.startsWith("DETRAINING")) return "detraining";
	if (s.startsWith("STRAINED") || s.startsWith("OVERREACHING")) return "strained";
	return "none";
}

export interface TrainingStatusView {
	status: string;
	tone: StatusTone;
	loadFocus?: string;
	heat?: number;
	side: Array<{ label: string; value: string }>;
	/** Four weeks of status, oldest first, merged into runs. */
	history: Array<{ tone: StatusTone; days: number }>;
	since?: string;
}

export function trainingStatusView(input: HomeInput, row: DayRow | undefined): TrainingStatusView | null {
	const status = str(row, "training_status");
	if (!status) return null;
	const vo2 = num(row, "vo2max");
	const side: Array<{ label: string; value: string }> = [];
	if (vo2 !== undefined) side.push({ label: "VO₂ Max", value: String(vo2) });
	const load = titleCase(str(row, "training_load_status"));
	if (load) side.push({ label: "Load", value: load });
	const hrv = titleCase(str(row, "hrv_status"));
	if (hrv) side.push({ label: "HRV Status", value: hrv });

	const history: Array<{ tone: StatusTone; days: number }> = [];
	for (const { row: r } of lastDays(input.rows, input.date, 28)) {
		const tone = statusTone(str(r, "training_status"));
		const last = history[history.length - 1];
		if (last && last.tone === tone) last.days++;
		else history.push({ tone, days: 1 });
	}
	const since = str(row, "training_status_since");
	return {
		status: humanize(status)!,
		tone: statusTone(status),
		loadFocus: titleCase(str(row, "load_focus")),
		heat: num(row, "heat_acclimation_pct"),
		side,
		history,
		since: since ? shortDate(since) : undefined,
	};
}

/* ------------------------------------------------------------------ */
/*  At a Glance                                                        */
/* ------------------------------------------------------------------ */

export interface HeartRateView {
	current?: number;
	resting?: number;
	min?: number;
	max?: number;
}

export function heartRateView(row: DayRow | undefined, series: DaySeries | null): HeartRateView | null {
	const points = series?.heartRate ?? [];
	let current = num(row, "hr_latest");
	for (let i = points.length - 1; i >= 0 && current === undefined; i--) {
		const v = points[i]![1];
		if (v !== null) current = v;
	}
	const resting = num(row, "resting_hr");
	if (current === undefined && resting === undefined) return null;
	return { current, resting, min: num(row, "min_hr"), max: num(row, "max_hr") };
}

export interface IntensityView {
	total: number;
	goal: number;
	/** Monday first: running total for each day of this week so far. */
	week: Array<{ label: string; total: number | null; today: boolean }>;
}

/** Garmin's intensity week runs Monday to Sunday. */
export function intensityView(input: HomeInput): IntensityView | null {
	const today = new Date(dayStart(input.date)).getDay();
	const back = (today + 6) % 7;
	const monday = addDays(input.date, -back);
	let running = 0;
	let seen = false;
	const week: IntensityView["week"] = [];
	for (let i = 0; i < 7; i++) {
		const date = addDays(monday, i);
		const label = "MTWTFSS"[i]!;
		if (date > input.date) {
			week.push({ label, total: null, today: false });
			continue;
		}
		const v = num(rowOn(input.rows, date), "intensity_minutes");
		if (v !== undefined) seen = true;
		running += v ?? 0;
		week.push({ label, total: running, today: date === input.date });
	}
	if (!seen) return null;
	const goal = num(rowOn(input.rows, input.date), "intensity_goal") ?? 150;
	return { total: running, goal, week };
}

export interface CaloriesView {
	total: number;
	active?: number;
	resting?: number;
}

export function caloriesView(row: DayRow | undefined): CaloriesView | null {
	const total = num(row, "calories");
	if (total === undefined) return null;
	return { total, active: num(row, "calories_active"), resting: num(row, "calories_bmr") };
}

export interface StressView {
	average?: number;
	/** Minutes in each band: rest, low, medium, high. */
	bands: [number, number, number, number];
	points: SeriesPoint[];
	from: number;
	to: number;
}

export function stressView(input: HomeInput, row: DayRow | undefined): StressView | null {
	const average = num(row, "stress_avg");
	const points = input.series?.stress ?? [];
	if (average === undefined && !points.length) return null;
	const from = dayStart(input.date);
	return {
		average,
		bands: [
			num(row, "stress_rest_minutes") ?? 0,
			num(row, "stress_low_minutes") ?? 0,
			num(row, "stress_medium_minutes") ?? 0,
			num(row, "stress_high_minutes") ?? 0,
		],
		points,
		from,
		to: from + DAY_MS,
	};
}

export interface HrvView {
	status?: string;
	weekly?: number;
	low?: number;
	high?: number;
	/** Nightly averages for four weeks, oldest first. */
	nights: Array<number | null>;
}

export function hrvView(input: HomeInput, row: DayRow | undefined): HrvView | null {
	const status = titleCase(str(row, "hrv_status"));
	const weekly = num(row, "hrv_weekly_avg");
	if (!status && weekly === undefined) return null;
	return {
		status,
		weekly,
		low: num(row, "hrv_baseline_low"),
		high: num(row, "hrv_baseline_high"),
		nights: lastDays(input.rows, input.date, 28).map(({ row: r }) => num(r, "hrv_avg") ?? null),
	};
}

/* ------------------------------------------------------------------ */
/*  Events and plans                                                   */
/* ------------------------------------------------------------------ */

export interface EventView {
	name: string;
	/** "IN 4 WEEKS, 2 DAYS". */
	countdown: string;
	/** "Sat, Oct 24". */
	when: string;
}

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function countdown(from: string, to: string): string {
	const days = Math.round((dayStart(to) - dayStart(from)) / DAY_MS);
	if (days === 0) return "TODAY";
	if (days === 1) return "TOMORROW";
	const weeks = Math.floor(days / 7);
	const rest = days % 7;
	const parts: string[] = [];
	if (weeks) parts.push(`${weeks} WEEK${weeks === 1 ? "" : "S"}`);
	if (rest) parts.push(`${rest} DAY${rest === 1 ? "" : "S"}`);
	return `IN ${parts.join(", ")}`;
}

export function eventsView(account: AccountInfo | null, date: string): EventView[] {
	return (account?.events ?? [])
		.filter((e): e is { name: string; date: string } => Boolean(e.name && e.date && e.date >= date))
		.sort((a, b) => a.date.localeCompare(b.date))
		.map((e) => ({
			name: e.name,
			countdown: countdown(date, e.date),
			when: `${WEEKDAY_SHORT[new Date(dayStart(e.date)).getDay()]}, ${shortDate(e.date)}`,
		}));
}

export interface PlanView {
	name: string;
	detail?: string;
}

export function plansView(account: AccountInfo | null): PlanView[] {
	return (account?.trainingPlans ?? [])
		.filter((p): p is typeof p & { name: string } => Boolean(p.name))
		.map((p) => ({
			name: p.name,
			detail: [humanize(p.type), p.weeks ? `${p.weeks} weeks` : undefined, p.end ? `ends ${shortDate(p.end)}` : undefined]
				.filter(Boolean)
				.join(" · ") || undefined,
		}));
}

/* ------------------------------------------------------------------ */
/*  The whole screen                                                   */
/* ------------------------------------------------------------------ */

export interface HomeModel {
	date: string;
	today: TodayItem[];
	sleepCoach: SleepCoach | null;
	sleep: SleepView | null;
	battery: BatteryView | null;
	steps: StepsView | null;
	activities: ActivitiesView;
	readiness: ReadinessView | null;
	trainingStatus: TrainingStatusView | null;
	heartRate: HeartRateView | null;
	intensity: IntensityView | null;
	calories: CaloriesView | null;
	stress: StressView | null;
	hrv: HrvView | null;
	events: EventView[];
	plans: PlanView[];
	/** When the watch last uploaded, for the header. */
	device?: string;
}

/** Today, or the newest synced day before it when today has not synced yet. */
export function dayToShow(rows: readonly DayRow[], today: string): string {
	for (let i = rows.length - 1; i >= 0; i--) {
		if (rows[i]!.date <= today) return rows[i]!.date;
	}
	return today;
}

export function homeModel(input: HomeInput): HomeModel {
	const row = rowOn(input.rows, input.date);
	return {
		date: input.date,
		today: todayActivity(row),
		sleepCoach: sleepCoach(row),
		sleep: sleepView(row, input.series),
		battery: batteryView(input, row),
		steps: stepsView(input, row),
		activities: activitiesView(input),
		readiness: readinessView(row),
		trainingStatus: trainingStatusView(input, row),
		heartRate: heartRateView(row, input.series),
		intensity: intensityView(input),
		calories: caloriesView(row),
		stress: stressView(input, row),
		hrv: hrvView(input, row),
		events: eventsView(input.account, input.date),
		plans: plansView(input.account),
		device: input.account?.device?.name,
	};
}
