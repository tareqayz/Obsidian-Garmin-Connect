import type { AccountInfo } from "../sync/account";
import type { DaySeries, SeriesPoint, SleepLevel } from "../sync/intraday";
import {
	DAY_MS,
	addDays,
	clockText,
	dayStart,
	distanceOf,
	hoursText,
	humanize,
	lastDays,
	num,
	rowOn,
	shortDate,
	str,
	titleCase,
	unitsOf,
	weekdayLetter,
} from "./day";
import { glanceModel, type GlanceId, type GlanceModel } from "./glance";
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
	/** Everything only the At a Glance cards draw. The views above are shared with In Focus. */
	glance: GlanceModel;
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
		glance: glanceModel(input, row, unitsOf(input.rows)),
		events: eventsView(input.account, input.date),
		plans: plansView(input.account),
		device: input.account?.device?.name,
	};
}
