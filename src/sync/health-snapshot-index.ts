import type { GarminApi, HealthSnapshotEpochs, HealthSnapshotSummary, ValueDescriptor } from "../garmin/endpoints";
import type { DaySeries } from "./intraday";
import { defineIntraday } from "./intraday-registry";
import { num } from "./numbers";

/**
 * Health Snapshot: no day index (a day can hold two snapshots, 2025-09-09),
 * two intraday extras loaded on view (ref/health-stats/health-snapshot/README.md):
 *
 * - `SNAPSHOT_LIST`, kept in today's series file: every snapshot, from
 *   `summary/list?until=today&start=1&limit=100` (5 in 14 months). Each row
 *   is the whole summary, so the detail never needs `summary/{date}/{uuid}`.
 * - `SNAPSHOT_DAY`, kept in the snapshot's own local day: the 121 one-second
 *   samples of each snapshot that day, from `epoch/{uuid}`. An extra's fetch
 *   gets only the date, so it lists the day first (`summary/{date}`): 1 + n
 *   requests, once; an old day's file is written only by this view.
 *
 * Pure: no Obsidian import.
 */

export type SnapshotMetric = "HEART_RATE" | "RESPIRATION" | "STRESS" | "SPO2" | "RMSSD_HRV" | "SDRR_HRV";
export const SNAPSHOT_METRICS: readonly SnapshotMetric[] = ["HEART_RATE", "RESPIRATION", "STRESS", "SPO2", "RMSSD_HRV", "SDRR_HRV"];

export interface SnapshotFigures {
	min?: number;
	avg?: number;
	max?: number;
}

export interface SnapshotRow {
	uuid: string;
	/** The recording's local day. */
	date: string;
	name: string;
	/** The recording's wall clock, `YYYY-MM-DDTHH:MM:SS`, never converted. */
	startLocal: string;
	startGMT?: string;
	summaries: Partial<Record<SnapshotMetric, SnapshotFigures>>;
	deviceName?: string;
	deviceVersion?: string;
}

const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v.trim() : undefined);

export function snapshotRowOf(raw: HealthSnapshotSummary | null | undefined): SnapshotRow | null {
	const uuid = str(raw?.activityUuid?.uuid);
	const date = str(raw?.calendarDate);
	const startLocal = str(raw?.startTimestampLocal);
	if (!raw || !uuid || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !startLocal) return null;
	const row: SnapshotRow = { uuid, date, name: str(raw.activityName) ?? "Health Snapshot", startLocal: startLocal.replace(/\.\d+$/, ""), summaries: {} };
	const gmt = str(raw.startTimestampGMT);
	if (gmt) row.startGMT = gmt.replace(/\.\d+$/, "");
	for (const s of Array.isArray(raw.summaryTypeDataList) ? raw.summaryTypeDataList : []) {
		const type = s?.summaryType as SnapshotMetric;
		if (!SNAPSHOT_METRICS.includes(type)) continue;
		const f: SnapshotFigures = {};
		const min = num(s.minValue), avg = num(s.avgValue), max = num(s.maxValue);
		if (min !== undefined) f.min = min;
		if (avg !== undefined) f.avg = Math.round(avg * 100) / 100;
		if (max !== undefined) f.max = max;
		row.summaries[type] = f;
	}
	const device = (raw.deviceMetaData ?? {}) as Record<string, unknown>;
	const deviceName = str(device.deviceName), deviceVersion = str(device.deviceVersion);
	if (deviceName) row.deviceName = deviceName;
	if (deviceVersion) row.deviceVersion = deviceVersion;
	return row;
}

/** Newest first by start (the REST list already is; GraphQL is not). */
export function sortSnapshots(rows: readonly SnapshotRow[]): SnapshotRow[] {
	const key = (r: SnapshotRow) => r.startGMT ?? r.startLocal;
	return [...rows].sort((a, b) => (key(a) < key(b) ? 1 : key(a) > key(b) ? -1 : 0));
}

export const SNAPSHOT_LIST_KEY = "snapshotList";
const PAGE = 100;

async function fetchAll(api: GarminApi, until: string): Promise<HealthSnapshotSummary[]> {
	const out: HealthSnapshotSummary[] = [];
	for (let start = 1; start < 10 * PAGE; start += PAGE) {
		const page = await api.healthSnapshotList(until, start, PAGE);
		out.push(...page);
		if (page.length < PAGE) break;
	}
	return out;
}

export function snapshotListOf(payload: HealthSnapshotSummary[] | null | undefined): SnapshotRow[] {
	return sortSnapshots((Array.isArray(payload) ? payload : []).flatMap((r) => snapshotRowOf(r) ?? []));
}

/** Every snapshot: `loadIntraday(today, [SNAPSHOT_LIST.key])`. */
export const SNAPSHOT_LIST = defineIntraday<HealthSnapshotSummary[], SnapshotRow[]>({
	key: SNAPSHOT_LIST_KEY,
	group: "health",
	fetch: (api, date) => fetchAll(api, date),
	map: (payload) => snapshotListOf(payload),
});

export function snapshotListIn(series: DaySeries | null | undefined): SnapshotRow[] | null {
	const raw = series?.extra?.[SNAPSHOT_LIST_KEY];
	return Array.isArray(raw) ? (raw as SnapshotRow[]) : null;
}

/* ------------------------------------------------------------------ */
/*  Samples                                                            */
/* ------------------------------------------------------------------ */

/** One second: `[s, hr, stress, spo2, resp]`, s = 0…120 from the first sample; null where none. */
export type SnapshotSample = [s: number, hr: number | null, stress: number | null, spo2: number | null, resp: number | null];

export const SNAPSHOT_DAY_KEY = "snapshotDay";

function columnOf(descriptors: ValueDescriptor[] | null | undefined, key: string, fallback: number): number {
	for (const d of Array.isArray(descriptors) ? descriptors : []) if (d?.key === key && typeof d.index === "number") return d.index;
	return fallback;
}

const reading = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null);

export function snapshotSamplesOf(payload: HealthSnapshotEpochs | null | undefined): SnapshotSample[] {
	const cols = payload?.epochDescriptorDTOList;
	const at = { t: columnOf(cols, "timestamp", 0), hr: columnOf(cols, "heartRate", 1), stress: columnOf(cols, "stress", 2), spo2: columnOf(cols, "spo2", 3), resp: columnOf(cols, "respiration", 4) };
	const rows = (Array.isArray(payload?.epochArray) ? payload!.epochArray! : []).filter((r) => Array.isArray(r) && typeof r[at.t] === "number");
	rows.sort((a, b) => (a[at.t] as number) - (b[at.t] as number));
	const first = rows[0]?.[at.t] as number | undefined;
	return rows.map((r) => [Math.round(((r[at.t] as number) - first!) / 1000), reading(r[at.hr]), reading(r[at.stress]), reading(r[at.spo2]), reading(r[at.resp])]);
}

/** A day's snapshots' samples, by uuid. */
export type SnapshotDay = Record<string, SnapshotSample[]>;

/** The samples of a day's snapshots: `loadIntraday(date, [SNAPSHOT_DAY.key])`. */
export const SNAPSHOT_DAY = defineIntraday<Array<[string, HealthSnapshotEpochs | null]>, SnapshotDay>({
	key: SNAPSHOT_DAY_KEY,
	group: "health",
	fetch: async (api, date) => {
		const out: Array<[string, HealthSnapshotEpochs | null]> = [];
		for (const s of await api.wellnessActivities(date)) {
			const uuid = str(s?.activityUuid?.uuid);
			if (uuid) out.push([uuid, await api.healthSnapshotEpochs(uuid)]);
		}
		return out;
	},
	map: (payload) => {
		const day: SnapshotDay = {};
		for (const [uuid, epochs] of payload ?? []) {
			const samples = snapshotSamplesOf(epochs);
			if (samples.length) day[uuid] = samples;
		}
		return Object.keys(day).length ? day : null;
	},
});

export function snapshotDayIn(series: DaySeries | null | undefined): SnapshotDay | null {
	const raw = series?.extra?.[SNAPSHOT_DAY_KEY];
	return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as SnapshotDay) : null;
}
