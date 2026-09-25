import type { SocialProfile } from "../garmin/endpoints";
import { GarminAuthError, GarminRateLimitError } from "../garmin/errors";
import { silentLog, type Log } from "../log";
import { epochOf } from "./intraday";
import { pace } from "./metrics";

/**
 * The account file: facts that belong to no day.
 *
 * Who is signed in, the watch, and the "current" numbers Garmin only serves as
 * a latest value — lactate threshold, FTP, running economy, cycling ability —
 * plus the active coach plan, upcoming events and personal records. One request
 * each per sync, never per day. Written to `<dataFolder>/account.json`.
 *
 * Only what a Home screen shows. Never tokens, never the email, never ids a
 * reader has no use for.
 */
export interface AccountInfo {
	displayName?: string;
	fullName?: string;
	avatar?: { large?: string; medium?: string; small?: string };
	device?: { name?: string; imageUrl?: string; lastUpload?: string };
	lactateThreshold?: {
		date?: string;
		heartRate?: number;
		/** Metres per second. See `lactateSpeed` for the unit Garmin actually sends. */
		speed?: number;
		pace?: string;
	};
	ftp?: Partial<Record<"running" | "cycling", { date?: string; watts?: number; wattsPerKg?: number }>>;
	runningEconomy?: { date?: string; score?: number; classification?: string };
	cyclingAbility?: Record<string, string | number>;
	trainingPlans?: Array<{ name?: string; type?: string; status?: string; start?: string; end?: string; weeks?: number }>;
	events?: Array<{
		name?: string;
		date?: string;
		type?: string;
		primary?: boolean;
		distanceMetres?: number;
		goalSeconds?: number;
	}>;
	personalRecords?: Array<{
		type: string;
		value?: number;
		date?: string;
		activityId?: number;
		activityName?: string;
		activityType?: string;
	}>;
}

/** The slice of GarminApi this needs. */
export interface AccountSource {
	readonly profile: SocialProfile | null;
	socialProfile(): Promise<SocialProfile>;
	userSettings(): Promise<Record<string, unknown>>;
	lastUsedDevice(): Promise<Record<string, unknown> | null>;
	lactateThreshold(): Promise<Array<Record<string, unknown>>>;
	powerToWeight(date: string, sport: "Running" | "Cycling"): Promise<Array<Record<string, unknown>>>;
	runningEconomy(date: string): Promise<Record<string, unknown> | null>;
	cyclingAbility(date: string): Promise<Record<string, unknown> | null>;
	trainingPlans(): Promise<Record<string, unknown> | null>;
	upcomingEvents(date: string): Promise<Array<Record<string, unknown>>>;
	personalRecords(): Promise<Array<Record<string, unknown>>>;
}

export interface AccountPayloads {
	profile?: SocialProfile | null;
	settings?: Record<string, unknown> | null;
	device?: Record<string, unknown> | null;
	lactate?: Array<Record<string, unknown>> | null;
	ftpRunning?: Array<Record<string, unknown>> | null;
	ftpCycling?: Array<Record<string, unknown>> | null;
	runningEconomy?: Record<string, unknown> | null;
	cyclingAbility?: Record<string, unknown> | null;
	plans?: Record<string, unknown> | null;
	events?: Array<Record<string, unknown>> | null;
	records?: Array<Record<string, unknown>> | null;
}

export interface AccountFetch {
	account: AccountInfo | null;
	requests: number;
	warnings: string[];
	/** A 429 or a dead session: stop, as the day sync does. */
	fatal?: unknown;
}

/**
 * Fetches every account-level payload, one at a time. A failure costs that one
 * field and a warning; a rate limit or a dead session ends the run.
 */
export async function fetchAccount(
	source: AccountSource,
	today: string,
	units: "metric" | "imperial",
	log: Log = silentLog,
): Promise<AccountFetch> {
	const payloads: AccountPayloads = {};
	const warnings: string[] = [];
	let requests = 0;

	const steps: Array<[keyof AccountPayloads, () => Promise<unknown>]> = [
		// Usually already fetched this session for the display name.
		["profile", () => (source.profile ? Promise.resolve(source.profile) : source.socialProfile())],
		["settings", () => source.userSettings()],
		["device", () => source.lastUsedDevice()],
		["lactate", () => source.lactateThreshold()],
		["ftpRunning", () => source.powerToWeight(today, "Running")],
		["ftpCycling", () => source.powerToWeight(today, "Cycling")],
		["runningEconomy", () => source.runningEconomy(today)],
		["cyclingAbility", () => source.cyclingAbility(today)],
		["plans", () => source.trainingPlans()],
		["events", () => source.upcomingEvents(today)],
		["records", () => source.personalRecords()],
	];

	for (const [name, run] of steps) {
		try {
			if (!(name === "profile" && source.profile)) requests += 1;
			(payloads as Record<string, unknown>)[name] = await run();
		} catch (err) {
			if (err instanceof GarminRateLimitError || err instanceof GarminAuthError) {
				return { account: mapAccount(payloads, units), requests, warnings, fatal: err };
			}
			const text = `${name}: ${err instanceof Error ? err.message : String(err)}`;
			warnings.push(text);
			log.warn(`account ${text}`);
		}
	}

	return { account: mapAccount(payloads, units), requests, warnings };
}

export function mapAccount(p: AccountPayloads, units: "metric" | "imperial" = "metric"): AccountInfo | null {
	const out: AccountInfo = {};
	const profile = p.profile;
	if (profile) {
		text(out, "displayName", profile.displayName);
		text(out, "fullName", profile.fullName);
		// Not `userName`: on Garmin that is the sign-in email, and this file sits
		// in a synced vault.
		const avatar: NonNullable<AccountInfo["avatar"]> = {};
		text(avatar, "large", profile.profileImageUrlLarge);
		text(avatar, "medium", profile.profileImageUrlMedium);
		text(avatar, "small", profile.profileImageUrlSmall);
		if (Object.keys(avatar).length) out.avatar = avatar;
	}

	if (p.device) {
		const device: NonNullable<AccountInfo["device"]> = {};
		text(device, "name", p.device.lastUsedDeviceName);
		text(device, "imageUrl", p.device.imageUrl);
		const upload = num(p.device.lastUsedDeviceUploadTime);
		if (upload !== undefined) device.lastUpload = new Date(upload).toISOString();
		if (Object.keys(device).length) out.device = device;
	}

	const lactate = lactateOf(p.lactate, p.settings, units);
	if (lactate) out.lactateThreshold = lactate;

	const ftp: NonNullable<AccountInfo["ftp"]> = {};
	for (const [sport, rows] of [["running", p.ftpRunning], ["cycling", p.ftpCycling]] as const) {
		const row = (rows ?? [])[0];
		if (!row) continue;
		const entry: { date?: string; watts?: number; wattsPerKg?: number } = {};
		const date = dayOf(row.calendarDate);
		if (date) entry.date = date;
		const watts = num(row.functionalThresholdPower);
		if (watts !== undefined) entry.watts = watts;
		const ratio = num(row.powerToWeight);
		if (ratio !== undefined) entry.wattsPerKg = Math.round(ratio * 100) / 100;
		if (Object.keys(entry).length) ftp[sport] = entry;
	}
	if (Object.keys(ftp).length) out.ftp = ftp;

	if (p.runningEconomy) {
		const economy: NonNullable<AccountInfo["runningEconomy"]> = {};
		const date = dayOf(p.runningEconomy.calendarDate);
		if (date) economy.date = date;
		const score = num(p.runningEconomy.score);
		if (score !== undefined) economy.score = score;
		text(economy, "classification", p.runningEconomy.classification);
		if (Object.keys(economy).length) out.runningEconomy = economy;
	}

	if (p.cyclingAbility) {
		const ability: Record<string, string | number> = {};
		for (const [key, value] of Object.entries(p.cyclingAbility)) {
			if (key === "calendarDate") {
				const date = dayOf(value);
				if (date) ability.date = date;
			} else if (typeof value === "number" && Number.isFinite(value)) ability[key] = value;
			else if (typeof value === "string" && value) ability[key] = value;
		}
		if (Object.keys(ability).length) out.cyclingAbility = ability;
	}

	// Finished plans stay in Garmin's list for good; only the live ones are news.
	const plans = asArray(p.plans?.trainingPlanList)
		.filter((plan) => !/^completed$/i.test(String(obj(plan.trainingStatus)?.statusKey ?? "")))
		.map((plan) => {
			const row: NonNullable<AccountInfo["trainingPlans"]>[number] = {};
			text(row, "name", plan.name);
			text(row, "type", obj(plan.trainingType)?.typeKey);
			text(row, "status", obj(plan.trainingStatus)?.statusKey);
			const start = dayOf(plan.startDate);
			if (start) row.start = start;
			const end = dayOf(plan.endDate);
			if (end) row.end = end;
			const weeks = num(plan.durationInWeeks);
			if (weeks !== undefined) row.weeks = weeks;
			return row;
		});
	if (plans.length) out.trainingPlans = plans;

	const events = (p.events ?? []).map((event) => {
		const row: NonNullable<AccountInfo["events"]>[number] = {};
		text(row, "name", event.eventName);
		const date = dayOf(event.date);
		if (date) row.date = date;
		text(row, "type", event.eventType);
		const custom = obj(event.eventCustomization);
		if (typeof custom?.isPrimaryEvent === "boolean") row.primary = custom.isPrimaryEvent;
		const target = obj(event.completionTarget);
		if (target?.unit === "meter") {
			const metres = num(target.value);
			if (metres !== undefined) row.distanceMetres = metres;
		}
		const goal = obj(custom?.customGoal);
		if (goal?.unit === "second") {
			const seconds = num(goal.value);
			if (seconds !== undefined) row.goalSeconds = seconds;
		}
		return row;
	});
	if (events.length) out.events = events;

	const records = (p.records ?? []).map((pr) => {
		const typeId = num(pr.typeId);
		const row: NonNullable<AccountInfo["personalRecords"]>[number] = {
			type: (typeId !== undefined && PR_TYPES[typeId]) || `type_${typeId ?? "unknown"}`,
		};
		const value = num(pr.value);
		if (value !== undefined) row.value = value;
		const date = dayOf(pr.actStartDateTimeInGMTFormatted ?? pr.prStartTimeGmtFormatted);
		if (date) row.date = date;
		// Step records have no activity and say so with 0.
		const activityId = num(pr.activityId);
		if (activityId) row.activityId = activityId;
		text(row, "activityName", pr.activityName);
		text(row, "activityType", pr.activityType);
		return row;
	});
	if (records.length) out.personalRecords = records;

	return Object.keys(out).length ? out : null;
}

/**
 * Garmin's `prtypes` ids, from `personalrecordtype/prtypes`. Values are seconds
 * for the timed ones, metres for distances, steps for the step ones.
 */
const PR_TYPES: Record<number, string> = {
	1: "run_1k",
	2: "run_1mile",
	3: "run_5k",
	4: "run_10k",
	5: "run_half_marathon",
	6: "run_marathon",
	7: "run_farthest",
	8: "ride_farthest",
	9: "ride_max_elevation",
	10: "ride_max_power",
	11: "ride_40k",
	12: "steps_best_day",
	13: "steps_best_week",
	14: "steps_best_month",
	15: "steps_longest_streak",
	16: "steps_current_streak",
	17: "swim_longest_pool",
	18: "swim_100m_pool",
	19: "swim_100yd_pool",
	20: "swim_400m_pool",
};

/**
 * Garmin splits the threshold across rows — one carries `speed`, another the
 * heart rate, spelled `hearRate` — so each field is taken from whichever row has
 * it. User settings carry the heart rate too, as a fallback.
 *
 * `speed` arrives as tenths of the real value: 0.3722 for a threshold pace of
 * 4:29/km, which sits where it should between this account's predicted 10K
 * (3.64 m/s) and 5K (3.89 m/s) paces. Hence ×10.
 */
function lactateOf(
	rows: Array<Record<string, unknown>> | null | undefined,
	settings: Record<string, unknown> | null | undefined,
	units: "metric" | "imperial",
): AccountInfo["lactateThreshold"] | undefined {
	const out: NonNullable<AccountInfo["lactateThreshold"]> = {};
	let rawSpeed: number | undefined;
	for (const row of rows ?? []) {
		const date = dayOf(row.calendarDate);
		if (date && (!out.date || date > out.date)) out.date = date;
		rawSpeed ??= num(row.speed);
		out.heartRate ??= num(row.hearRate) ?? num(row.heartRate);
	}
	const user = obj(settings?.userData);
	rawSpeed ??= num(user?.lactateThresholdSpeed);
	out.heartRate ??= num(user?.lactateThresholdHeartRate);
	if (out.heartRate === undefined) delete out.heartRate;
	if (rawSpeed !== undefined && rawSpeed > 0) {
		out.speed = Math.round(rawSpeed * 10 * 1000) / 1000;
		const text = pace(out.speed, 1, units);
		if (text) out.pace = text;
	}
	return Object.keys(out).length ? out : undefined;
}

/* ------------------------------------------------------------------ */

function num(value: unknown): number | undefined {
	return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function obj(value: unknown): Record<string, unknown> | undefined {
	return value && typeof value === "object" && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: undefined;
}

function asArray(value: unknown): Array<Record<string, unknown>> {
	return Array.isArray(value) ? value.filter((v): v is Record<string, unknown> => Boolean(obj(v))) : [];
}

/** `2026-09-19T11:29:57.527` or an epoch → `2026-09-19`. */
function dayOf(value: unknown): string | undefined {
	if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
	const ms = epochOf(value);
	return typeof value === "number" && ms !== undefined ? new Date(ms).toISOString().slice(0, 10) : undefined;
}

function text<T extends object>(target: T, key: keyof T, value: unknown): void {
	if (typeof value === "string" && value.trim()) (target as Record<keyof T, unknown>)[key] = value;
}
