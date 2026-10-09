import type { WeighIn, WeighInRange } from "../garmin/endpoints";
import { defineDayIndex, type DayRowInput } from "./day-index";
import { isFiniteNumber } from "./numbers";

/**
 * Weight: the day index the Weight pages read (ref/health-stats/weight/README.md).
 *
 * A row a day with a weigh-in, filed by Garmin's `calendarDate` (the local day
 * it was taken on, so the 23:00 Nov 2, 2025 weigh-in stays on Nov 2 although
 * its instant is Nov 3 in UTC). `weighIns` has no cap, so one request holds
 * the whole history.
 *
 * Every weigh-in of the day is kept in `ins`, oldest first, so the 1d page
 * lists them without a request of its own:
 * `"HH:MM:SS,grams,delta;…"`, the time being `date`'s local wall clock and
 * the delta Garmin's `weightDelta` in grams (empty when null).
 *
 * `h` is the profile height in cm (`userSettings().userData.height`), read
 * with the window so BMI can be worked out: the account store does not keep
 * it. Absent when the profile has none, and BMI then reads "--".
 *
 * Pure: no Obsidian import.
 */

export interface WeightRow {
	date: string;
	/** The day's latest weigh-in, grams: the day's value in every span. */
	w?: number;
	/** The day's lowest and highest weigh-in, grams. */
	lo?: number;
	hi?: number;
	/** Weigh-ins that day. */
	n?: number;
	/** The mean of all the day's weigh-ins, grams: the 1d hero. */
	avg?: number;
	/** Garmin's change on the latest weigh-in, grams; absent when null. */
	d?: number;
	/** Every weigh-in, oldest first: "HH:MM:SS,grams,delta" joined by ";". */
	ins?: string;
	/** The profile height, cm. */
	h?: number;
}

/** One weigh-in as the 1d page lists it. */
export interface WeighInEntry {
	/** "HH:MM:SS", the local wall clock. */
	time: string;
	grams: number;
	/** Garmin's change, grams, or null. */
	delta: number | null;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** `date` is the local wall clock written as epoch ms: read it with the UTC getters. */
export function wallClock(ms: unknown): string | undefined {
	if (typeof ms !== "number" || !Number.isFinite(ms)) return undefined;
	const d = new Date(ms);
	return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

/** A day's weigh-ins, oldest first. */
function entriesOf(list: readonly WeighIn[]): Array<WeighInEntry & { at: number }> {
	const out: Array<WeighInEntry & { at: number }> = [];
	for (const m of list) {
		const rec = m as Record<string, unknown>;
		const time = wallClock(rec.date);
		if (!time || !isFiniteNumber(rec.weight)) continue;
		out.push({ at: rec.date as number, time, grams: Math.round(rec.weight), delta: isFiniteNumber(rec.weightDelta) ? Math.round(rec.weightDelta) : null });
	}
	return out.sort((a, b) => a.at - b.at);
}

export function serializeWeighIns(entries: readonly WeighInEntry[]): string {
	return entries.map((e) => `${e.time},${e.grams},${e.delta ?? ""}`).join(";");
}

/** The row's weigh-ins, oldest first; a malformed entry is skipped. */
export function weighInsOf(row: Pick<WeightRow, "ins"> | null | undefined): WeighInEntry[] {
	const out: WeighInEntry[] = [];
	for (const part of (row?.ins ?? "").split(";")) {
		const [time, grams, delta] = part.split(",");
		if (!time || !/^\d{2}:\d{2}:\d{2}$/.test(time) || !grams || !Number.isFinite(Number(grams))) continue;
		out.push({ time, grams: Number(grams), delta: delta !== undefined && delta !== "" && Number.isFinite(Number(delta)) ? Number(delta) : null });
	}
	return out;
}

/** A range summary day as an index row. */
export function rowOfWeighDay(day: NonNullable<WeighInRange["dailyWeightSummaries"]>[number] | null | undefined, height?: number): DayRowInput<WeightRow> {
	const entries = entriesOf((day?.allWeightMetrics ?? (day?.latestWeight ? [day.latestWeight] : [])) as WeighIn[]);
	const latest = entries[entries.length - 1];
	const grams = entries.map((e) => e.grams);
	return {
		date: day?.summaryDate,
		w: latest?.grams ?? (day?.latestWeight as Record<string, unknown> | undefined)?.weight,
		lo: grams.length ? Math.min(...grams) : day?.minWeight,
		hi: grams.length ? Math.max(...grams) : day?.maxWeight,
		n: entries.length || day?.numOfWeightEntries,
		avg: grams.length ? grams.reduce((a, b) => a + b, 0) / grams.length : undefined,
		d: latest?.delta ?? undefined,
		ins: serializeWeighIns(entries),
		h: height,
	};
}

/** The rows of a `weighIns` payload. */
export function rowsOfWeighIns(payload: WeighInRange | null | undefined, height?: number): Array<DayRowInput<WeightRow>> {
	return (payload?.dailyWeightSummaries ?? []).map((day) => rowOfWeighDay(day, height));
}

/** The height in cm from `userSettings()`, if the profile has one. */
export function heightOf(settings: unknown): number | undefined {
	const user = (settings as { userData?: { height?: unknown } } | null | undefined)?.userData;
	const h = user?.height;
	return isFiniteNumber(h) && h > 50 && h < 300 ? h : undefined;
}

const whole = {};

export const WEIGHT_INDEX = defineDayIndex<WeightRow>({
	kind: "weight",
	title: "weight",
	folder: "weight",
	version: 1,
	columns: { w: whole, lo: whole, hi: whole, n: whole, avg: whole, d: { signed: true }, ins: { text: true }, h: { precision: 1 } },
	// A day's weigh-ins come back whole: an edited or deleted one must go.
	keepOld: false,
	group: "body",
	// `weighIns` has no cap: the whole history in one request.
	windowDays: 3660,
	emptyWindowsToStop: 1,
	// A weigh-in can be added or deleted for a past day; a week back is refetched.
	refreshDays: 7,
	fetchWindow: async (api, start, end) => {
		let height: number | undefined;
		try {
			height = heightOf(await api.userSettings());
		} catch {
			height = undefined;
		}
		return rowsOfWeighIns(await api.weighIns(start, end), height);
	},
});
