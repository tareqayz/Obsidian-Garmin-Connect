import type { EnduranceScore, EnduranceStats } from "../garmin/endpoints";
import { defineDayIndex, type DayRowInput } from "./day-index";
import type { DaySeries } from "./intraday";
import { defineIntraday } from "./intraday-registry";
import { num } from "./numbers";

/**
 * Endurance Score: the day index every view of the page reads — the day's
 * score, class, feedback phrase and top contributors on 1d, and the days the
 * 12w weeks and 1y months are worked out from
 * (ref/performance-stats/endurance-score/README.md) — and the on-view extra
 * that brings an old day's phrase.
 *
 * One route feeds it: `endurancescore/stats?aggregation=daily`
 * (`GarminApi.enduranceStats`), up to 401 days a request (402 is HTTP 400).
 * It keys every calendar day of the window: that day's score as
 * `groupAverage` and its contributor list, or null and an empty list for a
 * day without data — before the history, and today until the watch syncs.
 * Garmin's weekly and monthly groups are means of these days (169 of 169
 * rebuilt), so the page works them out itself and asks nothing on view.
 *
 * - `score` is the day's score, `classId` Garmin's class (1 Recreational …
 *   7 Elite, 0 while calibrating) and `phraseId` the feedback phrase under
 *   the dial. Only the day route (`enduranceScore`) sends the last two, and the
 *   stats route for its newest scored day (`enduranceScoreDTO`), so a history
 *   window brings `score` and `contrib`, and a day sync adds the rest.
 *   Rows keep what they had (`keepOld`): a window refresh must not erase
 *   the class and phrase a day sync wrote.
 * - Garmin's first two weeks are calibrating: no score, `classId` 0,
 *   `phraseId` 2 and Miscellaneous 100% (2025-08-02..15 here). The row is
 *   kept: those days count in their period's shares.
 * - `contrib` is the day's list as text (`encodeContributors`).
 * - Routine syncs feed it for free (`fromDay`) from the day route the day
 *   sync already asks for the `fitness` group; a history walk asks a year a
 *   request, three for this history (the last an empty year).
 *
 * Pure: no Obsidian import, so the tests load the definitions as registered.
 */

export interface EnduranceScoreRow {
	/** The local calendar day, `YYYY-MM-DD`. */
	date: string;
	/** The day's score: `overallScore`, or the daily row's `groupAverage`. None while calibrating. */
	score?: number;
	/** Garmin's class, 1 Recreational … 7 Elite; 0 while calibrating: `classification`. */
	classId?: number;
	/** The feedback phrase under the dial: `feedbackPhrase` (55). 0 is an id. */
	phraseId?: number;
	/** The day's contributors, `encodeContributors`' text: "g0:93.54 t31:2.37 t13:2.06 g8:2.03". */
	contrib?: string;
}

/** One contributor: one of Garmin's sport groups (`g`) or an activity type (`t`), and its share. */
export interface EnduranceEntry {
	kind: "g" | "t";
	/** The group (0 running, 1 cycling, 6 swimming, 8 miscellaneous) or the activity type's id. */
	id: number;
	/** In percent, two decimals at most. */
	share: number;
}

/** Group 8: Miscellaneous, which a list always ends with. */
export const MISC_GROUP = 8;

const DAY = /^\d{4}-\d{2}-\d{2}/;
const ENTRY = /^([gt])(\d+):(\d+(?:\.\d+)?)$/;

const isMisc = (e: EnduranceEntry) => e.kind === "g" && e.id === MISC_GROUP;

/**
 * The order a list is written in: every entry but Miscellaneous by share,
 * the largest first (a tie goes to the group, then to the lower id), and
 * Miscellaneous last. It is the day route's own order; the stats route sends
 * the same entries in another (Running after a type), and one order keeps a
 * day's text the same whichever route wrote it.
 */
function byListOrder(a: EnduranceEntry, b: EnduranceEntry): number {
	if (isMisc(a) !== isMisc(b)) return isMisc(a) ? 1 : -1;
	return b.share - a.share || (a.kind === b.kind ? 0 : a.kind === "g" ? -1 : 1) || a.id - b.id;
}

/** A share as written: two decimals at most, no trailing zeros ("93.54", "2.4", "100", "0"). */
function shareText(share: number): string {
	return String(Math.round(share * 100) / 100);
}

/**
 * A contributor list as `contrib` keeps it: `g<group>:<share>` for one of
 * Garmin's sport groups, `t<activityTypeId>:<share>` for an activity type,
 * space-separated, in list order (`byListOrder`), the share in percent as
 * Garmin sends it (two decimals at most, trailing zeros dropped).
 * "g0:93.54 t31:2.37 t13:2.06 g8:2.03"; a calibrating day "g8:100". An entry
 * without a group or a type, or without a share, is left out; undefined for
 * an empty list.
 */
export function encodeContributors(list: unknown): string | undefined {
	if (!Array.isArray(list)) return undefined;
	const entries: EnduranceEntry[] = [];
	for (const raw of list as unknown[]) {
		if (!raw || typeof raw !== "object") continue;
		const item = raw as Record<string, unknown>;
		const group = num(item.group);
		const type = num(item.activityTypeId);
		const share = num(item.contribution);
		if (share === undefined || share < 0) continue;
		if (group !== undefined && Number.isInteger(group) && group >= 0) entries.push({ kind: "g", id: group, share });
		else if (type !== undefined && Number.isInteger(type) && type >= 0) entries.push({ kind: "t", id: type, share });
	}
	if (!entries.length) return undefined;
	return entries
		.sort(byListOrder)
		.map((e) => `${e.kind}${e.id}:${shareText(e.share)}`)
		.join(" ");
}

/** A row's `contrib` as entries, in the order written; a malformed entry is skipped. */
export function decodeContributors(text: string | undefined): EnduranceEntry[] {
	if (!text) return [];
	const out: EnduranceEntry[] = [];
	for (const word of text.trim().split(/\s+/)) {
		const m = ENTRY.exec(word);
		if (m) out.push({ kind: m[1] as "g" | "t", id: Number(m[2]), share: Number(m[3]) });
	}
	return out;
}

/** A payload's day, `YYYY-MM-DD`; undefined without one. */
export function enduranceDateOf(payload: Pick<EnduranceScore, "calendarDate"> | null | undefined): string | undefined {
	const date = payload?.calendarDate;
	return typeof date === "string" && DAY.test(date) ? date.slice(0, 10) : undefined;
}

/** Garmin's phrase id, a number; a numeric string is read as one, any other word dropped. */
function phraseOf(value: unknown): number | undefined {
	if (typeof value === "string" && /^\d+$/.test(value.trim())) return Number(value.trim());
	return num(value);
}

/** The day route's payload (`enduranceScore`) as an index row; the definition drops what is null. */
export function rowOfEnduranceDay(payload: EnduranceScore | null | undefined): DayRowInput<EnduranceScoreRow> {
	return {
		date: enduranceDateOf(payload),
		score: payload?.overallScore,
		classId: payload?.classification,
		phraseId: phraseOf(payload?.feedbackPhrase),
		contrib: encodeContributors(payload?.contributors),
	};
}

/**
 * A daily stats window as index rows: one per key of `groupMap` inside
 * `start..end`, its score and list, and the class and phrase of the window's
 * newest scored day (`enduranceScoreDTO`), the only day the route sends them
 * for. A day without data gives an empty row, which the definition drops.
 */
export function rowsOfEnduranceStats(stats: EnduranceStats | null | undefined, start: string, end: string): Array<DayRowInput<EnduranceScoreRow>> {
	const dto = stats?.enduranceScoreDTO;
	const dtoDate = enduranceDateOf(dto);
	const rows: Array<DayRowInput<EnduranceScoreRow>> = [];
	for (const [key, group] of Object.entries(stats?.groupMap ?? {})) {
		if (!DAY.test(key)) continue;
		const date = key.slice(0, 10);
		if (date < start || date > end) continue;
		const row: DayRowInput<EnduranceScoreRow> = { date, score: group?.groupAverage, contrib: encodeContributors(group?.enduranceContributorDTOList) };
		if (date === dtoDate) {
			row.classId = dto?.classification;
			row.phraseId = phraseOf(dto?.feedbackPhrase);
		}
		rows.push(row);
	}
	return rows;
}

export const ENDURANCE_SCORE_INDEX = defineDayIndex<EnduranceScoreRow>({
	kind: "endurance-score",
	// "Sync endurance score history".
	title: "endurance score",
	folder: "endurance-score",
	version: 1,
	columns: { score: {}, classId: {}, phraseId: {}, contrib: { text: true } },
	// A window brings the score and the list; the day sync adds the class and phrase, which a later window must not erase.
	keepOld: true,
	group: "fitness",
	// The cap is 401 days; a year a request.
	windowDays: 365,
	// Today's score lands when the watch syncs, so yesterday's can come after the
	// plugin's last sync of it. Free when the run's own days cover both.
	refreshDays: 2,
	// Every day from the first has a list: an empty year is the start.
	emptyWindowsToStop: 1,
	fetchWindow: async (api, start, end) => rowsOfEnduranceStats(await api.enduranceStats(start, end, "daily"), start, end),
	// Free on a routine sync: the day route the day sync asks anyway. A day
	// without a score is HTTP 204, `endurance: null`: covered, with no row.
	fromDay: { needs: ["endurance"], read: (day) => (day.endurance ? rowOfEnduranceDay(day.endurance) : null) },
});

/* ------------------------------------------------------------------ */
/*  An old day's phrase, on view                                       */
/* ------------------------------------------------------------------ */

/** What the 1d page keeps of a day's `enduranceScore`: the class and phrase a history row lacks, and the dial's scale. */
export interface EnduranceDay {
	classId?: number;
	phraseId?: number;
	/** The dial's ends: `gaugeLowerLimit`, `gaugeUpperLimit`. */
	low?: number;
	high?: number;
	/** Where Intermediate, Trained, Well-Trained, Expert, Superior and Elite start; all six or none. */
	limits?: number[];
}

export const ENDURANCE_DAY_KEY = "enduranceDay";

const LIMIT_FIELDS = [
	"classificationLowerLimitIntermediate",
	"classificationLowerLimitTrained",
	"classificationLowerLimitWellTrained",
	"classificationLowerLimitExpert",
	"classificationLowerLimitSuperior",
	"classificationLowerLimitElite",
] as const;

/** The block a day's payload keeps; null for a day without one (HTTP 204). */
export function enduranceDayOf(payload: EnduranceScore | null | undefined): EnduranceDay | null {
	if (!payload || typeof payload !== "object") return null;
	const day: EnduranceDay = {};
	const classId = num(payload.classification);
	if (classId !== undefined && classId >= 0) day.classId = classId;
	const phraseId = phraseOf(payload.feedbackPhrase);
	if (phraseId !== undefined && phraseId >= 0) day.phraseId = phraseId;
	const low = num(payload.gaugeLowerLimit);
	const high = num(payload.gaugeUpperLimit);
	if (low !== undefined) day.low = low;
	if (high !== undefined) day.high = high;
	const limits = LIMIT_FIELDS.map((field) => num(payload[field]));
	if (limits.every((v) => v !== undefined)) day.limits = limits;
	return day;
}

/** The kept block from a day's series file, or null. */
export function enduranceDayIn(series: DaySeries | null | undefined): EnduranceDay | null {
	const raw = series?.extra?.[ENDURANCE_DAY_KEY] as EnduranceDay | undefined;
	return raw && typeof raw === "object" ? raw : null;
}

/**
 * The 1d page's day payload, `loadIntraday(date, [ENDURANCE_DAY.key])`, asked
 * only when the day's row has no `phraseId`: a day the history walk brought
 * and no day sync covered (every day before 2026-09-21 in this vault). No
 * `fromDay`: a synced day's row already has the phrase.
 */
export const ENDURANCE_DAY = defineIntraday<EnduranceScore | null, EnduranceDay>({
	key: ENDURANCE_DAY_KEY,
	group: "fitness",
	fetch: (api, date) => api.enduranceScore(date),
	map: (payload) => enduranceDayOf(payload),
});
