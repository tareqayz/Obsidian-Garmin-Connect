import { DEVICE_NAMES } from "../garmin/device-names";
import { isFatal } from "./fatal";
import { NewerDataError } from "./file-health";
import type {
	ActivityBadgeDTO,
	ActivityDetails,
	ActivityLength as GarminLength,
	ActivitySensorDTO,
	ActivitySplits,
	ActivitySummary,
	ActivityTypedSplits,
	ActivityWeather,
	ActivityZone,
	DeviceAppInfo,
	GarminApi,
	WeighIn,
} from "../garmin/endpoints";
import { GarminApiError } from "../garmin/errors";
import type { IntradayMiss } from "./intraday-registry";
import type { MetricGroup } from "./metrics";

/**
 * One activity's page, as the vault keeps it:
 * `<dataFolder>/activity-details/<id>.json`.
 *
 * The page loads it when it opens (`SyncRunner.loadActivity`): about eleven
 * requests the first time for a run or a ride, eight for a pool swim or yoga —
 * seven together, then the four the summary decides (power zones only with
 * them, weather only with a route, the weight only with power, the device by
 * its firmware id) — and none after. A block whose request failed is asked
 * for again on the next view; one Garmin had nothing for (a treadmill run's
 * weather) is not. A file whose activity was renamed or trimmed since is
 * fetched afresh. With an Activity details range, the backfill loads every
 * activity in it the same way, newest first (`backfill.ts`).
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

/**
 * Bumped when the file's shape changes: a file of another version is fetched
 * again.
 *
 * 6 (2026-10-15): every sport has a page — a ride's power, cadence and cycling
 * dynamics, a swim's strokes, Swolf and lengths, temperature — and every page
 * its sensors and badges, and whether the activity has a route. A run's file
 * of version 5 reads as version 6 that lacks its summary and badges
 * (`upgradeRun`), so it costs two requests on its next view, not eleven.
 */
export const ACTIVITY_DETAIL_VERSION = 6;

/** One request each at most, in the order the file lists them. */
export const ACTIVITY_BLOCKS = ["summary", "samples", "laps", "segments", "hrZones", "powerZones", "weather", "gear", "device", "weight", "badges"] as const;
export type ActivityBlock = (typeof ACTIVITY_BLOCKS)[number];

/**
 * Blocks that wait for the summary: it says whether each applies — power
 * zones, a route's weather, a weigh-in for power — and gives the firmware id
 * and the day. One that doesn't apply costs no request.
 */
const AFTER_SUMMARY: ReadonlySet<ActivityBlock> = new Set(["powerZones", "weather", "device", "weight"]);

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
	/** It has a GPS track (`metadataDTO.hasPolyline`): its page draws a map. */
	hasPolyline?: boolean;
	/** Garmin keeps its time in power zones (`metadataDTO.hasPowerTimeInZones`). */
	hasPowerZones?: boolean;
	/** A pool swim's pool: its length, in metres or yards. */
	pool?: { length: number; unit: "m" | "yd" };
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
	/** The sensors the activity recorded with: "Rally 100/200", firmware "4.1", battery "OK". Never a serial. */
	sensors?: ActivitySensor[];
	/** The badges the activity earned: "Climber 1". */
	badges?: ActivityBadge[];
	/** A ride's rider positions on the clock: where each stretch of standing or sitting began. */
	positions?: RiderPosition[];
	/** The newest weigh-in on or before the activity's day, for Power (W/kg). */
	weightKg: number | null;
	/** Blocks fetched, data or not. One not listed failed, and the next view asks again. */
	checked: ActivityBlock[];
}

export interface ActivitySensor {
	/** "Rally 100/200", from the product catalogue (`device-names.ts`), else what it measures: "Power Meter". */
	name: string;
	/** Garmin's FIT product number: 3578. */
	product?: number;
	/** `BIKE_POWER`, `HEART_RATE`, … */
	type?: string;
	/** "4.1". */
	firmware?: string;
	/** "OK", "Low", or "73%". */
	battery?: string;
}

export interface ActivityBadge {
	name: string;
	/** Garmin's key, `cycle_climb_500ft`: the badge's description is the app's own copy, by it. */
	key?: string;
}

export interface RiderPosition {
	/** Seconds on the samples' `clock`. */
	at: number;
	/** 0 seated, 1 standing, 2 to seated, 3 to standing. */
	position: number;
}

/** One pool length. */
export interface ActivityLength {
	/** 1-based, through the whole swim. */
	n?: number;
	/** Seconds on the samples' `clock` at its start. */
	start?: number;
	duration: number;
	/** Metres; 0 for a rest. */
	distance: number;
	/** m/s. */
	speed?: number;
	strokes?: number;
	swolf?: number;
	/** `FREESTYLE`, … */
	stroke?: string;
	hr?: number;
	maxHr?: number;
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
	/** A ride's: rpm, and watts. */
	bikeCadence?: number;
	maxPower?: number;
	normalizedPower?: number;
	/** A swim's: strokes in the lap, Swolf, strokes a minute and a length, metres a stroke. */
	strokes?: number;
	swolf?: number;
	strokeRate?: number;
	maxStrokeRate?: number;
	strokesPerLength?: number;
	strokeDistance?: number;
	/** Lengths swum: 0 on a pool swim's rest. */
	activeLengths?: number;
	/** A pool swim's rest: no length swum. */
	rest?: true;
	/** `FREESTYLE`, … ; absent on a rest. */
	stroke?: string;
	/** °C. */
	temperature?: number;
	/** A pool swim's lengths. */
	lengths?: ActivityLength[];
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
	// A ride's: cadence, the right pedal's share of the power, the power phases (degrees) and platform centre offsets (mm).
	directBikeCadence: ["bikeCadence", 0],
	directRightBalance: ["balanceRight", 1],
	directLeftPowerPhaseStart: ["ppStartL", 1],
	directLeftPowerPhaseEnd: ["ppEndL", 1],
	directLeftPowerPhasePeakStart: ["pppStartL", 1],
	directLeftPowerPhasePeakEnd: ["pppEndL", 1],
	directRightPowerPhaseStart: ["ppStartR", 1],
	directRightPowerPhaseEnd: ["ppEndR", 1],
	directRightPowerPhasePeakStart: ["pppStartR", 1],
	directRightPowerPhasePeakEnd: ["pppEndR", 1],
	directLeftPlatformCenterOffset: ["pcoL", 0],
	directRightPlatformCenterOffset: ["pcoR", 0],
	// An open-water swim's strokes a minute, and the air or water temperature (°C).
	directSwimCadence: ["strokeRate", 0],
	directAirTemperature: ["temperature", 1],
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
	// A ride's power, cadence and cycling dynamics.
	"averageBikeCadence",
	"maxBikeCadence",
	"maxPowerTwentyMinutes",
	"leftBalance",
	"rightBalance",
	"intensityFactor",
	"trainingStressScore",
	"functionalThresholdPower",
	"totalWork",
	"seatedTime",
	"standingTime",
	"averageSeatedPower",
	"maxSeatedPower",
	"averageStandingPower",
	"maxStandingPower",
	"leftPowerPhaseStart",
	"leftPowerPhaseEnd",
	"leftPowerPhaseArcLength",
	"leftPowerPhasePeakStart",
	"leftPowerPhasePeakEnd",
	"leftPowerPhasePeakArcLength",
	"rightPowerPhaseStart",
	"rightPowerPhaseEnd",
	"rightPowerPhaseArcLength",
	"rightPowerPhasePeakStart",
	"rightPowerPhasePeakEnd",
	"rightPowerPhasePeakArcLength",
	"leftPlatformCenterOffset",
	"rightPlatformCenterOffset",
	// A ride's pedal strokes, or a swim's strokes.
	"totalNumberOfStrokes",
	// A swim's.
	"averageSWOLF",
	"averageStrokeDistance",
	"averageStrokes",
	"averageSwimCadence",
	"maxSwimCadence",
	"numberOfActiveLengths",
	"averageTemperature",
	"minTemperature",
	"maxTemperature",
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
	if (got.laps !== undefined) {
		out.laps = lapsOf(got.laps as ActivitySplits | null, clockStart);
		const positions = positionsOf(got.laps as ActivitySplits | null, clockStart);
		if (positions.length) out.positions = positions;
		else delete out.positions;
	}
	if (got.segments !== undefined) out.segments = segmentsOf(got.segments as ActivityTypedSplits | null, clockStart);
	if (got.hrZones !== undefined) out.hrZones = zonesOf(got.hrZones as ActivityZone[] | null);
	if (got.powerZones !== undefined) out.powerZones = zonesOf(got.powerZones as ActivityZone[] | null);
	if (got.weather !== undefined) out.weather = weatherOf(got.weather as ActivityWeather | null);
	if (got.gear !== undefined) out.gear = gearOf(got.gear);
	if (got.device !== undefined) out.device = deviceOf(got.device as DeviceAppInfo | null);
	if (got.weight !== undefined) out.weightKg = weightOf(got.weight as WeighIn | null);
	if (got.badges !== undefined) {
		const badges = badgesOf(got.badges as ActivityBadgeDTO[] | null);
		if (badges.length) out.badges = badges;
		else delete out.badges;
	}
	const checked = new Set<ActivityBlock>(out.checked);
	for (const block of ACTIVITY_BLOCKS) if (got[block] !== undefined) checked.add(block);
	out.checked = ACTIVITY_BLOCKS.filter((block) => checked.has(block));
	return out;
}

export function serializeActivityDetail(detail: ActivityDetail): string {
	return `${JSON.stringify(detail)}\n`;
}

/** A file read back: null when it isn't one, or is of another version (a run's of version 5 is upgraded). */
export function parseActivityDetail(text: string): ActivityDetail | null {
	try {
		const parsed = JSON.parse(text) as Partial<ActivityDetail> | null;
		if (!parsed || typeof parsed !== "object") return null;
		if (typeof parsed.id !== "number") return null;
		if (!parsed.summary || typeof parsed.summary !== "object" || !parsed.samples || typeof parsed.samples !== "object") return null;
		const checked = (parsed.checked ?? []).filter((b): b is ActivityBlock => (ACTIVITY_BLOCKS as readonly string[]).includes(b));
		if (parsed.version === ACTIVITY_DETAIL_VERSION) return { ...emptyDetail(parsed.id), ...parsed, checked } as ActivityDetail;
		if (parsed.version === UPGRADED_VERSION && isRunFamily(parsed)) return upgradeRun({ ...emptyDetail(parsed.id), ...parsed, checked } as ActivityDetail);
		return null;
	} catch {
		return null;
	}
}

/**
 * Version 6 changed nothing a run's page draws but what the summary carries
 * (its sensors, whether it has a route and power zones) and added the badges
 * block: a run's version 5 file is kept, those two blocks marked unfetched,
 * so its next view or download asks two requests instead of eleven. The
 * coverage keeps the file at 5 until it is written, so the backfill treats it
 * as one an older version saved.
 */
export const CHANGED_IN_6: readonly ActivityBlock[] = ["summary", "badges"];

/** The version whose running files are kept and upgraded (`CHANGED_IN_6`) rather than fetched again. */
export const UPGRADED_VERSION = 5;

function upgradeRun(detail: ActivityDetail): ActivityDetail {
	return { ...detail, version: ACTIVITY_DETAIL_VERSION, checked: detail.checked.filter((block) => !CHANGED_IN_6.includes(block)) };
}

/** Running or one of its sub-types (treadmill, trail, track, …): the only sport with pages at version 5. */
function isRunFamily(detail: Partial<ActivityDetail>): boolean {
	return detail.typeId === 1 || detail.parentTypeId === 1;
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
	/** Whether it has a route, power zones, power: false skips the block's request. */
	hasPolyline?: boolean;
	hasPowerZones?: boolean;
	hasPower?: boolean;
}

const FETCH: Record<ActivityBlock, (api: GarminApi, id: number, facts: SummaryFacts) => Promise<unknown>> = {
	summary: (api, id) => api.activity(id),
	samples: (api, id) => api.activityDetails(id),
	laps: (api, id) => api.activitySplits(id),
	segments: (api, id) => api.activityTypedSplits(id),
	hrZones: (api, id) => api.activityHrZones(id),
	// Garmin says when it keeps none; an activity without a route has no weather.
	powerZones: (api, id, facts) => (facts.hasPowerZones === false ? Promise.resolve([]) : api.activityPowerZones(id)),
	weather: (api, id, facts) => (facts.hasPolyline === false ? Promise.resolve(null) : api.activityWeather(id)),
	gear: (api, id) => api.activityGear(id),
	// No firmware id, or no day: nothing to ask, which reads as Garmin having none.
	device: (api, _id, facts) => (facts.versionPk ? api.deviceAppInfo(facts.versionPk) : Promise.resolve(null)),
	// The weight is only for Power (W/kg).
	weight: (api, _id, facts) => (facts.date && facts.hasPower !== false ? api.weightLatest(facts.date) : Promise.resolve(null)),
	badges: (api, id) => api.activityBadges(id),
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
		// A newer build's file: stop, as for a 429. Read as a success it would be
		// fetched again at every plan, and saved never.
		if (err instanceof NewerDataError) return { detail: before, reason: "failed", error: message(err), fatal: err };
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

/** The firmware id, the local day and what applies, from the summary just fetched or the file. */
function factsOf(summary: ActivitySummary | null | undefined, base: ActivityDetail | null): SummaryFacts {
	const versionPk = summary?.metadataDTO?.deviceMetaDataDTO?.deviceVersionPk ?? base?.deviceVersionPk;
	const start = clockTime(summary?.summaryDTO?.startTimeLocal) ?? base?.start;
	const facts: SummaryFacts = {};
	if (typeof versionPk === "number" && Number.isSafeInteger(versionPk) && versionPk > 0) facts.versionPk = versionPk;
	if (start) facts.date = start.slice(0, 10);
	const meta = summary?.metadataDTO;
	const hasPolyline = typeof meta?.hasPolyline === "boolean" ? meta.hasPolyline : base?.hasPolyline;
	if (hasPolyline !== undefined) facts.hasPolyline = hasPolyline;
	const hasPowerZones = typeof meta?.hasPowerTimeInZones === "boolean" ? meta.hasPowerTimeInZones : base?.hasPowerZones;
	if (hasPowerZones !== undefined) facts.hasPowerZones = hasPowerZones;
	const power = summary ? numberOf(summary.summaryDTO?.averagePower) : base ? numberOf(base.summary.averagePower) : undefined;
	if (summary || base) facts.hasPower = power !== undefined && power > 0;
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
	const polyline = summary.metadataDTO?.hasPolyline;
	if (typeof polyline === "boolean") out.hasPolyline = polyline;
	const powerZones = summary.metadataDTO?.hasPowerTimeInZones;
	if (typeof powerZones === "boolean") out.hasPowerZones = powerZones;
	const pool = poolOf(dto);
	if (pool) out.pool = pool;
	const sensors = sensorsOf(summary.metadataDTO?.sensors);
	if (sensors.length) out.sensors = sensors;
	return out;
}

/** A pool swim's pool: Garmin keeps the length in centimetres and names its unit, `factor` centimetres to one. */
/**
 * The summary's pool: `poolLength` is in the pool's own unit (25 for a 25 m
 * pool), where the activity list sends centimetres (2500) beside the same
 * `unitOfPoolLength`.
 */
function poolOf(dto: Record<string, unknown>): ActivityDetail["pool"] | undefined {
	const length = numberOf(dto.poolLength);
	const unit = dto.unitOfPoolLength as { unitKey?: unknown } | null | undefined;
	const key = unit?.unitKey === "meter" ? "m" : unit?.unitKey === "yard" ? "yd" : undefined;
	if (length === undefined || length <= 0 || !key) return undefined;
	return { length: round(length, 2), unit: key };
}

/** What a sensor measures, for one the product catalogue doesn't name (Inferred words). */
const SENSOR_WORDS: Readonly<Record<string, string>> = {
	BIKE_POWER: "Power Meter",
	HEART_RATE: "Heart Rate Monitor",
	BIKE_SPEED_CADENCE: "Speed/Cadence Sensor",
	BIKE_SPEED: "Speed Sensor",
	BIKE_CADENCE: "Cadence Sensor",
	FOOTPOD: "Foot Pod",
	STRIDE_SPEED_DISTANCE: "Foot Pod",
	TEMPERATURE: "Temperature Sensor",
};

/** The sensors an activity used, named by product number; never their serials. */
function sensorsOf(sensors: ActivitySensorDTO[] | null | undefined): ActivitySensor[] {
	const out: ActivitySensor[] = [];
	for (const sensor of sensors ?? []) {
		if (!sensor || typeof sensor !== "object") continue;
		const product = numberOf(sensor.fitProductNumber);
		const type = typeof sensor.antplusDeviceType === "string" && sensor.antplusDeviceType ? sensor.antplusDeviceType : undefined;
		const name = (product !== undefined ? DEVICE_NAMES[product] : undefined) ?? (type ? SENSOR_WORDS[type] : undefined) ?? "Sensor";
		const item: ActivitySensor = { name };
		if (product !== undefined) item.product = product;
		if (type) item.type = type;
		const firmware = sensor.softwareVersion;
		if (typeof firmware === "number" && Number.isFinite(firmware)) item.firmware = String(firmware);
		else if (typeof firmware === "string" && firmware.trim()) item.firmware = firmware.trim();
		const status = typeof sensor.batteryStatus === "string" && sensor.batteryStatus ? sensor.batteryStatus : undefined;
		const level = numberOf(sensor.batteryLevel);
		if (status) item.battery = status === "OK" ? "OK" : status.charAt(0) + status.slice(1).toLowerCase();
		else if (level !== undefined) item.battery = `${Math.round(level)}%`;
		out.push(item);
	}
	return out;
}

/** The badges an activity earned, by name and key. */
function badgesOf(badges: ActivityBadgeDTO[] | null | undefined): ActivityBadge[] {
	const out: ActivityBadge[] = [];
	for (const badge of badges ?? []) {
		const name = typeof badge?.badgeName === "string" ? badge.badgeName.trim() : "";
		if (!name) continue;
		out.push(typeof badge.badgeKey === "string" && badge.badgeKey ? { name, key: badge.badgeKey } : { name });
	}
	return out;
}

/** A ride's rider positions, from the laps payload's events: where each stretch began, on the clock. */
function positionsOf(splits: ActivitySplits | null, clockStart: number | undefined): RiderPosition[] {
	if (clockStart === undefined) return [];
	const out: RiderPosition[] = [];
	for (const event of splits?.eventDTOs ?? []) {
		const kind = event?.sectionTypeDTO?.key ?? event?.sectionTypeDTO?.sectionTypeKey;
		if (kind !== "riderPosition" && kind !== "RIDER_POSITION") continue;
		const position = numberOf(event.riderPosition);
		const ms = numberOf(event.startTimeGMTDoubleValue) ?? epochOfGmt(clockTime(event.startTimeGMT));
		if (position === undefined || ms === undefined) continue;
		out.push({ at: Math.round((ms - clockStart) / 1000), position });
	}
	return out.sort((a, b) => a.at - b.at);
}

/** A pool swim's lengths in a lap. */
function lengthsOf(lengths: GarminLength[] | null | undefined, clockStart: number | undefined): ActivityLength[] {
	const out: ActivityLength[] = [];
	for (const length of lengths ?? []) {
		const item: ActivityLength = { duration: numberOf(length.duration) ?? 0, distance: numberOf(length.distance) ?? 0 };
		const start = clockOf(length.startTimeGMT, clockStart);
		if (start !== undefined) item.start = start;
		keep(item, "speed", length.averageSpeed);
		keep(item, "strokes", length.totalNumberOfStrokes);
		keep(item, "swolf", length.averageSWOLF);
		keep(item, "hr", length.averageHR);
		keep(item, "maxHr", length.maxHR);
		keep(item, "n", length.lengthIndex);
		if (typeof length.swimStroke === "string" && length.swimStroke) item.stroke = length.swimStroke;
		out.push(item);
	}
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
		keep(out, "bikeCadence", lap.averageBikeCadence);
		keep(out, "maxPower", lap.maxPower);
		keep(out, "normalizedPower", lap.normalizedPower);
		keep(out, "strokes", lap.totalNumberOfStrokes);
		keep(out, "swolf", lap.averageSWOLF);
		keep(out, "strokeRate", lap.averageSwimCadence);
		keep(out, "maxStrokeRate", lap.maxSwimCadence);
		keep(out, "strokesPerLength", lap.averageStrokes);
		keep(out, "strokeDistance", lap.averageStrokeDistance);
		keep(out, "activeLengths", lap.numberOfActiveLengths);
		keep(out, "temperature", lap.averageTemperature);
		if (typeof lap.swimStroke === "string" && lap.swimStroke) out.stroke = lap.swimStroke;
		const lengths = lengthsOf(lap.lengthDTOs, clockStart);
		if (lengths.length) out.lengths = lengths;
		// A pool swim's rest: a lap of lengths none of which was swum.
		if (lengths.length && out.activeLengths === 0 && out.distance === 0) out.rest = true;
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


function message(err: unknown): string {
	return err instanceof Error ? err.message : String(err);
}
