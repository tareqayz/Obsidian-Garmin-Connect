import type {
	ActivityDetails,
	ActivitySplits,
	ActivitySummary,
	ActivityTypedSplits,
	ActivityWeather,
	ActivityZone,
	DeviceAppInfo,
	GarminApi,
	WeighIn,
} from "../garmin/endpoints";
import { GarminApiError, GarminAuthError, GarminRateLimitError } from "../garmin/errors";
import type { IntradayMiss } from "./intraday-registry";
import type { MetricGroup } from "./metrics";

/**
 * One activity's page, as the vault keeps it:
 * `<dataFolder>/activity-details/<id>.json`.
 *
 * The page loads it when it opens (`SyncRunner.loadActivity`): ten requests
 * the first time — eight together, then the device and the weight, which need
 * the summary's firmware id and date — and none after. A block whose request
 * failed is asked for again on the next view; one Garmin had nothing for (a
 * treadmill run's weather) is not. A file whose activity was renamed or trimmed
 * since is fetched afresh. With Run details on, the backfill loads every run
 * in its range the same way, newest first (`backfill.ts`).
 *
 * Values keep Garmin's units (metres, seconds, m/s, °F); the pages round them.
 * The summary's and the laps' figures are kept exactly as Garmin sent them:
 * rounding them here and again on the page would turn a float32 8.6499996
 * into 8.65 and then "8.7" where Garmin shows 8.6. The samples are columns,
 * one value per sample, `null` where the watch had none, so a chart reads a
 * column and the route reads `lat` and `lon`.
 *
 * Pure: the API and the store are handed in.
 */

/** Bumped when the file's shape changes: a file of another version is fetched again. */
export const ACTIVITY_DETAIL_VERSION = 5;

/** One request each, in the order the file lists them. */
export const ACTIVITY_BLOCKS = ["summary", "samples", "laps", "segments", "hrZones", "powerZones", "weather", "gear", "device", "weight"] as const;
export type ActivityBlock = (typeof ACTIVITY_BLOCKS)[number];

/** Blocks that need the summary first: the firmware id and the activity's date. */
const AFTER_SUMMARY: ReadonlySet<ActivityBlock> = new Set(["device", "weight"]);

export interface ActivityDetail {
	version: number;
	id: number;
	name: string;
	/** Garmin's typeKey: `running`, `treadmill_running`, … */
	type: string;
	typeId?: number;
	parentTypeId?: number;
	/** Local start, `YYYY-MM-DDTHH:mm:ss`. */
	start: string;
	/** The same moment in UTC. */
	startGmt?: string;
	/** The activity's own zone, `Asia/Dubai`. */
	timeZone?: string;
	/** `private`, `subscribers` or `public`. */
	privacy?: string;
	/** The notes the user wrote. */
	notes?: string;
	/** The recording device's model and firmware, for `deviceAppInfo()`. */
	deviceVersionPk?: number;
	/** Running power counted the wind (Stats → Power → "Wind Data: Enabled"). */
	windData?: boolean;
	/** The summary's totals and averages, by Garmin's key, in Garmin's units. */
	summary: Record<string, number | string>;
	/** One value per sample, by column (`SAMPLE_COLUMNS`), plus `clock`. */
	samples: Record<string, Array<number | null>>;
	laps: ActivityLap[];
	/** Run/walk detection and workout intervals. */
	segments: ActivitySegment[];
	hrZones: ZoneTime[];
	powerZones: ZoneTime[];
	weather: ActivityWeatherNow | null;
	gear: ActivityGear[];
	/** The device as it was: "Forerunner 970", firmware "18.32". */
	device: { name: string; firmware?: string } | null;
	/** The newest weigh-in on or before the activity's day, for Power (W/kg). */
	weightKg: number | null;
	/** Blocks fetched, data or not. One not listed failed, and the next view asks again. */
	checked: ActivityBlock[];
}

export interface ActivityLap {
	/** 1-based, as the Laps tab numbers them. */
	n: number;
	/** Seconds on the samples' `clock` at the lap's start. */
	start?: number;
	duration: number;
	distance: number;
	movingDuration?: number;
	/** m/s. */
	speed?: number;
	movingSpeed?: number;
	gap?: number;
	maxSpeed?: number;
	hr?: number;
	maxHr?: number;
	power?: number;
	cadence?: number;
	/** cm. */
	stride?: number;
	gct?: number;
	vo?: number;
	vr?: number;
	ascent?: number;
	descent?: number;
	calories?: number;
	/** Where the lap ended, `[lat, lon]`: its marker on the map. */
	end?: [number, number];
}

export interface ActivitySegment {
	/** `RWD_RUN`, `RWD_WALK`, `RWD_STAND`, `INTERVAL_ACTIVE`, … */
	type: string;
	/** Seconds on the samples' `clock`. */
	start: number;
	end: number;
	duration: number;
	distance: number;
	/** m/s: Workout Intervals' Run Pace. */
	speed?: number;
}

export interface ZoneTime {
	zone: number;
	/** The zone's floor: bpm or watts. */
	floor: number | null;
	seconds: number;
}

export interface ActivityWeatherNow {
	/** °F, as Garmin sends it. */
	temp?: number;
	feelsLike?: number;
	humidity?: number;
	/** As Garmin sends it; the page converts. */
	wind?: number;
	gust?: number;
	/** Degrees the wind blows from. */
	windFrom?: number;
	compass?: string;
	desc?: string;
}

export interface ActivityGear {
	name: string;
	type?: string;
}

/**
 * The sample columns kept, by Garmin's metric key: the column's name and the
 * decimals worth keeping. Anything else the watch recorded is left out.
 */
export const SAMPLE_COLUMNS: Readonly<Record<string, readonly [string, number]>> = {
	sumDuration: ["time", 1],
	sumDistance: ["distance", 1],
	directHeartRate: ["hr", 0],
	directSpeed: ["speed", 3],
	directGradeAdjustedSpeed: ["gap", 3],
	directDoubleCadence: ["cadence", 0],
	directStrideLength: ["stride", 1],
	directVerticalOscillation: ["vo", 2],
	directVerticalRatio: ["vr", 2],
	directGroundContactTime: ["gct", 0],
	directElevation: ["elevation", 1],
	directPower: ["power", 0],
	directAvailableStamina: ["stamina", 0],
	directPotentialStamina: ["potential", 0],
	directPerformanceCondition: ["performance", 0],
	directImpactLoadFactor: ["impact", 2],
	directRespirationRate: ["breaths", 1],
	// Recorded on a treadmill run: the left foot's share of ground contact, and step speed loss.
	directGroundContactBalanceLeft: ["gctBalance", 2],
	directStepSpeedLoss: ["speedLoss", 3],
	directStepSpeedLossPercent: ["speedLossPct", 2],
	directLatitude: ["lat", 5],
	directLongitude: ["lon", 5],
};

/** The summary keys kept, numbers and Garmin's own labels. */
const SUMMARY_KEYS = [
	"distance",
	"duration",
	"movingDuration",
	"elapsedDuration",
	"averageSpeed",
	"averageMovingSpeed",
	"avgGradeAdjustedSpeed",
	"maxSpeed",
	"averageHR",
	"maxHR",
	"minHR",
	"calories",
	"bmrCalories",
	"averagePower",
	"maxPower",
	"normalizedPower",
	"averageRunCadence",
	"maxRunCadence",
	"strideLength",
	"verticalOscillation",
	"verticalRatio",
	"groundContactTime",
	"groundContactBalanceLeft",
	"elevationGain",
	"elevationLoss",
	"minElevation",
	"maxElevation",
	"avgElevation",
	"trainingEffect",
	"anaerobicTrainingEffect",
	"trainingEffectLabel",
	"aerobicTrainingEffectMessage",
	"anaerobicTrainingEffectMessage",
	"activityTrainingLoad",
	"beginPotentialStamina",
	"endPotentialStamina",
	"minAvailableStamina",
	"impactLoad",
	"waterEstimated",
	"moderateIntensityMinutes",
	"vigorousIntensityMinutes",
	"differenceBodyBattery",
	"directWorkoutFeel",
	"directWorkoutRpe",
	"steps",
	"avgRespirationRate",
	"minRespirationRate",
	"maxRespirationRate",
	"stepSpeedLoss",
	"stepSpeedLossPercent",
] as const;

/** What the activity index says the activity is, to tell a file that is out of date. */
export interface ActivityIdentity {
	name?: string;
	/** Metres. */
	distance?: number;
	/** Seconds. */
	duration?: number;
}

/** Whether a file still describes the activity the index lists. */
export function matchesIdentity(detail: ActivityDetail, row?: ActivityIdentity | null): boolean {
	if (detail.version !== ACTIVITY_DETAIL_VERSION) return false;
	if (!row) return true;
	if (row.name !== undefined && row.name !== detail.name) return false;
	const distance = numberOf(detail.summary.distance);
	const duration = numberOf(detail.summary.duration);
	// The index rounds both to 0.01.
	if (row.distance !== undefined && distance !== undefined && Math.abs(row.distance - distance) > 0.5) return false;
	if (row.duration !== undefined && duration !== undefined && Math.abs(row.duration - duration) > 0.5) return false;
	return true;
}

/** The blocks a view still has to fetch: every one for a missing or outdated file. */
export function blocksToFetch(detail: ActivityDetail | null, row?: ActivityIdentity | null): ActivityBlock[] {
	if (!detail || !matchesIdentity(detail, row)) return [...ACTIVITY_BLOCKS];
	return ACTIVITY_BLOCKS.filter((block) => !detail.checked.includes(block));
}

/** The payloads one load fetched, by block. `undefined` is a block not fetched. */
export type ActivityPayloads = Partial<Record<ActivityBlock, unknown>>;

/**
 * A detail from what a load fetched, over the file it had when that file still
 * describes the activity. A block fetched replaces the file's; the rest stay.
 * Null when there is neither a summary nor a file to build on.
 */
export function buildActivityDetail(id: number, got: ActivityPayloads, base: ActivityDetail | null): ActivityDetail | null {
	const summary = got.summary as ActivitySummary | null | undefined;
	if (!base && !summary) return null;
	const out: ActivityDetail = base ? { ...base, checked: [...base.checked] } : emptyDetail(id);
	if (summary) Object.assign(out, headerOf(summary));
	const clockStart = epochOfGmt(out.startGmt);
	if (got.samples !== undefined) out.samples = samplesOf(got.samples as ActivityDetails | null, clockStart);
	if (got.laps !== undefined) out.laps = lapsOf(got.laps as ActivitySplits | null, clockStart);
	if (got.segments !== undefined) out.segments = segmentsOf(got.segments as ActivityTypedSplits | null, clockStart);
	if (got.hrZones !== undefined) out.hrZones = zonesOf(got.hrZones as ActivityZone[] | null);
	if (got.powerZones !== undefined) out.powerZones = zonesOf(got.powerZones as ActivityZone[] | null);
	if (got.weather !== undefined) out.weather = weatherOf(got.weather as ActivityWeather | null);
	if (got.gear !== undefined) out.gear = gearOf(got.gear);
	if (got.device !== undefined) out.device = deviceOf(got.device as DeviceAppInfo | null);
	if (got.weight !== undefined) out.weightKg = weightOf(got.weight as WeighIn | null);
	const checked = new Set<ActivityBlock>(out.checked);
	for (const block of ACTIVITY_BLOCKS) if (got[block] !== undefined) checked.add(block);
	out.checked = ACTIVITY_BLOCKS.filter((block) => checked.has(block));
	return out;
}

export function serializeActivityDetail(detail: ActivityDetail): string {
	return `${JSON.stringify(detail)}\n`;
}

/** A file read back: null when it isn't one, or is of another version. */
export function parseActivityDetail(text: string): ActivityDetail | null {
	try {
		const parsed = JSON.parse(text) as Partial<ActivityDetail> | null;
		if (!parsed || typeof parsed !== "object") return null;
		if (parsed.version !== ACTIVITY_DETAIL_VERSION || typeof parsed.id !== "number") return null;
		if (!parsed.summary || typeof parsed.summary !== "object" || !parsed.samples || typeof parsed.samples !== "object") return null;
		return {
			...emptyDetail(parsed.id),
			...parsed,
			checked: (parsed.checked ?? []).filter((b): b is ActivityBlock => (ACTIVITY_BLOCKS as readonly string[]).includes(b)),
		} as ActivityDetail;
	} catch {
		return null;
	}
}

/* ------------------------------------------------------------------ */
/*  Loading                                                            */
/* ------------------------------------------------------------------ */

/** Where details are read from and written to. `VaultSeriesStore` in the plugin. */
export interface ActivityDetailStore {
	readActivityDetail(id: number): Promise<ActivityDetail | null>;
	/** Skips the write when the text would not change. */
	writeActivityDetail(id: number, detail: ActivityDetail): Promise<"written" | "unchanged">;
}

/** A load as a page gets it back. */
export interface ActivityLoad {
	/** The page's data, or null when there is none yet. */
	detail: ActivityDetail | null;
	/** Why `detail` is null or still lacks a block. */
	reason?: IntradayMiss;
	/** What went wrong, when the reason is "failed". */
	error?: string;
}

export interface LoadActivityOptions {
	signedIn: boolean;
	groups: readonly MetricGroup[];
	/** The activity's index row, when it has one. */
	row?: ActivityIdentity | null;
}

/** What the summary tells the blocks that wait for it. */
interface SummaryFacts {
	versionPk?: number;
	/** The activity's local day. */
	date?: string;
}

const FETCH: Record<ActivityBlock, (api: GarminApi, id: number, facts: SummaryFacts) => Promise<unknown>> = {
	summary: (api, id) => api.activity(id),
	samples: (api, id) => api.activityDetails(id),
	laps: (api, id) => api.activitySplits(id),
	segments: (api, id) => api.activityTypedSplits(id),
	hrZones: (api, id) => api.activityHrZones(id),
	powerZones: (api, id) => api.activityPowerZones(id),
	weather: (api, id) => api.activityWeather(id),
	gear: (api, id) => api.activityGear(id),
	// No firmware id, or no day: nothing to ask, which reads as Garmin having none.
	device: (api, _id, facts) => (facts.versionPk ? api.deviceAppInfo(facts.versionPk) : Promise.resolve(null)),
	weight: (api, _id, facts) => (facts.date ? api.weightLatest(facts.date) : Promise.resolve(null)),
};

/**
 * Loads one activity: reads its file, fetches the blocks it lacks (all of them
 * when the file is missing or out of date), and writes the file back. `fatal`
 * is a 429 or a dead session, which every later load would hit too.
 */
export async function loadActivity(
	api: GarminApi,
	store: ActivityDetailStore,
	id: number,
	opts: LoadActivityOptions,
): Promise<ActivityLoad & { fatal?: unknown }> {
	const before = await store.readActivityDetail(id);
	const wanted = blocksToFetch(before, opts.row);
	if (!wanted.length) return { detail: before };
	if (!opts.groups.includes("workouts")) return { detail: before, reason: "off" };
	if (!opts.signedIn) return { detail: before, reason: "signed-out" };

	const got: ActivityPayloads = {};
	let fatal: unknown;
	let error: string | undefined;
	let gone = false;
	const fetchAll = async (blocks: ActivityBlock[], facts: SummaryFacts) => {
		const settled = await Promise.allSettled(blocks.map((block) => FETCH[block](api, id, facts)));
		settled.forEach((result, i) => {
			const block = blocks[i]!;
			if (result.status === "fulfilled") {
				got[block] = result.value;
			} else if (isFatal(result.reason)) {
				if (fatal === undefined) fatal = result.reason;
			} else {
				if (block === "summary" && result.reason instanceof GarminApiError && result.reason.status === 404) gone = true;
				if (error === undefined) error = message(result.reason);
			}
		});
	};

	const base = before && matchesIdentity(before, opts.row) ? before : null;
	await fetchAll(wanted.filter((block) => !AFTER_SUMMARY.has(block)), {});
	const later = wanted.filter((block) => AFTER_SUMMARY.has(block));
	const facts = factsOf(got.summary as ActivitySummary | null | undefined, base);
	// After a 429 or a dead session, nothing more is asked.
	if (later.length && fatal === undefined && (got.summary || base)) await fetchAll(later, facts);
	// A summary is what the page is built on: without one, nothing new to show.
	if (!base && !got.summary) {
		if (fatal !== undefined) return { detail: before, reason: "failed", error: message(fatal), fatal };
		if (gone || got.summary === null) return { detail: before, reason: "unavailable" };
		return { detail: before, reason: "failed", error: error ?? "no summary" };
	}
	const detail = buildActivityDetail(id, got, base);
	if (!detail) return { detail: before, reason: "failed", error: error ?? "no summary" };
	try {
		await store.writeActivityDetail(id, detail);
	} catch (err) {
		if (error === undefined) error = `detail file: ${message(err)}`;
	}
	if (!blocksToFetch(detail, opts.row).length) return { detail };
	if (fatal !== undefined) return { detail, reason: "failed", error: message(fatal), fatal };
	return { detail, reason: "failed", error };
}

/* ------------------------------------------------------------------ */

function emptyDetail(id: number): ActivityDetail {
	return {
		version: ACTIVITY_DETAIL_VERSION,
		id,
		name: "",
		type: "",
		start: "",
		summary: {},
		samples: {},
		laps: [],
		segments: [],
		hrZones: [],
		powerZones: [],
		weather: null,
		gear: [],
		device: null,
		weightKg: null,
		checked: [],
	};
}

/** The firmware id and the local day, from the summary just fetched or the file. */
function factsOf(summary: ActivitySummary | null | undefined, base: ActivityDetail | null): SummaryFacts {
	const versionPk = summary?.metadataDTO?.deviceMetaDataDTO?.deviceVersionPk ?? base?.deviceVersionPk;
	const start = clockTime(summary?.summaryDTO?.startTimeLocal) ?? base?.start;
	const facts: SummaryFacts = {};
	if (typeof versionPk === "number" && Number.isSafeInteger(versionPk) && versionPk > 0) facts.versionPk = versionPk;
	if (start) facts.date = start.slice(0, 10);
	return facts;
}

function headerOf(summary: ActivitySummary): Partial<ActivityDetail> {
	const dto = summary.summaryDTO ?? {};
	const out: Partial<ActivityDetail> = {
		name: typeof summary.activityName === "string" ? summary.activityName : "",
		type: summary.activityTypeDTO?.typeKey ?? "",
		start: clockTime(dto.startTimeLocal) ?? "",
		summary: summaryOf(dto),
	};
	const typeId = summary.activityTypeDTO?.typeId;
	if (typeof typeId === "number") out.typeId = typeId;
	const parentTypeId = summary.activityTypeDTO?.parentTypeId;
	if (typeof parentTypeId === "number") out.parentTypeId = parentTypeId;
	const startGmt = clockTime(dto.startTimeGMT);
	if (startGmt) out.startGmt = startGmt;
	const timeZone = summary.timeZoneUnitDTO?.timeZone;
	if (typeof timeZone === "string" && timeZone) out.timeZone = timeZone;
	const privacy = summary.accessControlRuleDTO?.typeKey;
	if (typeof privacy === "string" && privacy) out.privacy = privacy;
	if (typeof summary.description === "string" && summary.description.trim()) out.notes = summary.description;
	const versionPk = summary.metadataDTO?.deviceMetaDataDTO?.deviceVersionPk;
	if (typeof versionPk === "number" && Number.isSafeInteger(versionPk) && versionPk > 0) out.deviceVersionPk = versionPk;
	const wind = summary.metadataDTO?.runPowerWindDataEnabled;
	if (typeof wind === "boolean") out.windData = wind;
	return out;
}

function summaryOf(dto: Record<string, unknown>): Record<string, number | string> {
	const out: Record<string, number | string> = {};
	for (const key of SUMMARY_KEYS) {
		const value = dto[key];
		if (typeof value === "number" && Number.isFinite(value)) out[key] = value;
		else if (typeof value === "string" && value) out[key] = value;
	}
	return out;
}

function samplesOf(details: ActivityDetails | null, clockStart: number | undefined): Record<string, Array<number | null>> {
	const descriptors = details?.metricDescriptors ?? [];
	const rows = details?.activityDetailMetrics ?? [];
	if (!rows.length) return {};
	const out: Record<string, Array<number | null>> = {};
	for (const { key, metricsIndex } of descriptors) {
		const column = SAMPLE_COLUMNS[key];
		if (!column) continue;
		const [name, places] = column;
		const values = rows.map((row) => {
			const value = row?.metrics?.[metricsIndex];
			return typeof value === "number" && Number.isFinite(value) ? round(value, places) : null;
		});
		// A column the watch never filled is not worth a line of nulls.
		if (values.some((v) => v !== null)) out[name] = values;
	}
	const stamp = descriptors.find((d) => d.key === "directTimestamp");
	if (stamp && clockStart !== undefined) {
		out.clock = rows.map((row) => {
			const value = row?.metrics?.[stamp.metricsIndex];
			return typeof value === "number" && Number.isFinite(value) ? Math.round((value - clockStart) / 1000) : null;
		});
	}
	return out;
}

function lapsOf(splits: ActivitySplits | null, clockStart: number | undefined): ActivityLap[] {
	const laps = splits?.lapDTOs ?? [];
	return laps.map((lap, i) => {
		const out: ActivityLap = {
			n: typeof lap.lapIndex === "number" ? lap.lapIndex : i + 1,
			duration: numberOf(lap.duration) ?? 0,
			distance: numberOf(lap.distance) ?? 0,
		};
		const start = clockOf(lap.startTimeGMT, clockStart);
		if (start !== undefined) out.start = start;
		// As Garmin sent them, like the summary: the page rounds once.
		keep(out, "movingDuration", lap.movingDuration);
		keep(out, "speed", lap.averageSpeed);
		keep(out, "movingSpeed", lap.averageMovingSpeed);
		keep(out, "gap", lap.avgGradeAdjustedSpeed);
		keep(out, "maxSpeed", lap.maxSpeed);
		keep(out, "hr", lap.averageHR);
		keep(out, "maxHr", lap.maxHR);
		keep(out, "power", lap.averagePower);
		keep(out, "cadence", lap.averageRunCadence);
		keep(out, "stride", lap.strideLength);
		keep(out, "gct", lap.groundContactTime);
		keep(out, "vo", lap.verticalOscillation);
		keep(out, "vr", lap.verticalRatio);
		keep(out, "ascent", lap.elevationGain);
		keep(out, "descent", lap.elevationLoss);
		keep(out, "calories", lap.calories);
		const lat = numberOf(lap.endLatitude);
		const lon = numberOf(lap.endLongitude);
		if (lat !== undefined && lon !== undefined) out.end = [round(lat, 5), round(lon, 5)];
		return out;
	});
}

function segmentsOf(typed: ActivityTypedSplits | null, clockStart: number | undefined): ActivitySegment[] {
	const out: ActivitySegment[] = [];
	for (const split of typed?.splits ?? []) {
		if (typeof split.type !== "string") continue;
		const start = clockOf(split.startTimeGMT, clockStart);
		const end = clockOf(split.endTimeGMT, clockStart);
		if (start === undefined || end === undefined) continue;
		const segment: ActivitySegment = {
			type: split.type,
			start,
			end,
			duration: numberOf(split.duration) ?? 0,
			distance: numberOf(split.distance) ?? 0,
		};
		keep(segment, "speed", split.averageSpeed);
		out.push(segment);
	}
	return out;
}

function zonesOf(zones: ActivityZone[] | null): ZoneTime[] {
	const out: ZoneTime[] = [];
	for (const zone of zones ?? []) {
		if (typeof zone.zoneNumber !== "number") continue;
		const floor = numberOf(zone.zoneLowBoundary);
		out.push({ zone: zone.zoneNumber, floor: floor ?? null, seconds: numberOf(zone.secsInZone) ?? 0 });
	}
	return out.sort((a, b) => a.zone - b.zone);
}

function weatherOf(weather: ActivityWeather | null): ActivityWeatherNow | null {
	if (!weather) return null;
	const out: ActivityWeatherNow = {};
	put(out, "temp", weather.temp, 1);
	put(out, "feelsLike", weather.apparentTemp, 1);
	put(out, "humidity", weather.relativeHumidity, 0);
	put(out, "wind", weather.windSpeed, 1);
	put(out, "gust", weather.windGust, 1);
	put(out, "windFrom", weather.windDirection, 0);
	if (typeof weather.windDirectionCompassPoint === "string" && weather.windDirectionCompassPoint) out.compass = weather.windDirectionCompassPoint;
	const desc = weather.weatherTypeDTO?.desc;
	if (typeof desc === "string" && desc) out.desc = desc;
	// Indoors Garmin answers with every field null.
	return Object.keys(out).length ? out : null;
}

function gearOf(gear: unknown): ActivityGear[] {
	if (!Array.isArray(gear)) return [];
	const out: ActivityGear[] = [];
	for (const item of gear) {
		if (!item || typeof item !== "object") continue;
		const g = item as Record<string, unknown>;
		const made = [g.gearMakeName, g.gearModelName].filter((s) => typeof s === "string" && s).join(" ");
		const name = [g.displayName, g.customMakeModel, made].find((s): s is string => typeof s === "string" && s.trim() !== "");
		if (!name) continue;
		const type = typeof g.gearTypeName === "string" && g.gearTypeName ? g.gearTypeName : undefined;
		out.push(type ? { name, type } : { name });
	}
	return out;
}

function deviceOf(info: DeviceAppInfo | null): { name: string; firmware?: string } | null {
	const name = info?.productDisplayName;
	if (typeof name !== "string" || !name) return null;
	const firmware = info?.versionMajorMinor ?? info?.versionString;
	return typeof firmware === "string" && firmware ? { name, firmware } : { name };
}

/** Grams, as Garmin keeps weight, to kilograms. */
function weightOf(weighIn: WeighIn | null): number | null {
	const grams = numberOf(weighIn?.weight);
	return grams !== undefined && grams > 0 ? round(grams / 1000, 3) : null;
}

/** `2026-10-10T08:19:48.0` → `2026-10-10T08:19:48`. */
function clockTime(value: unknown): string | undefined {
	if (typeof value !== "string") return undefined;
	const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/.exec(value);
	return match?.[1];
}

/** A UTC `YYYY-MM-DDTHH:mm:ss` as epoch ms. */
function epochOfGmt(value: string | undefined): number | undefined {
	if (!value) return undefined;
	const ms = Date.parse(`${value}Z`);
	return Number.isFinite(ms) ? ms : undefined;
}

/** A UTC time as seconds on the samples' clock. */
function clockOf(value: unknown, clockStart: number | undefined): number | undefined {
	if (clockStart === undefined) return undefined;
	const ms = epochOfGmt(clockTime(value));
	return ms === undefined ? undefined : Math.round((ms - clockStart) / 1000);
}

function put<T extends object>(out: T, key: keyof T & string, value: unknown, places: number): void {
	const n = numberOf(value);
	if (n !== undefined) (out as Record<string, unknown>)[key] = round(n, places);
}

/** A number as Garmin sent it, when it is one. */
function keep<T extends object>(out: T, key: keyof T & string, value: unknown): void {
	const n = numberOf(value);
	if (n !== undefined) (out as Record<string, unknown>)[key] = n;
}

function numberOf(value: unknown): number | undefined {
	return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function round(value: number, places: number): number {
	const factor = 10 ** places;
	return Math.round(value * factor) / factor;
}

/** Errors that make every later request pointless. */
function isFatal(err: unknown): boolean {
	return err instanceof GarminRateLimitError || err instanceof GarminAuthError;
}

function message(err: unknown): string {
	return err instanceof Error ? err.message : String(err);
}
