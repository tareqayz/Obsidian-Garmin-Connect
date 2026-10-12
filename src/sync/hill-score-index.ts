import type { HillScore } from "../garmin/endpoints";
import { defineDayIndex, type DayRowInput } from "./day-index";

/**
 * Hill Score: the day index every view of the page reads — the day's score,
 * its factors and Garmin's class and feedback phrase on 1d, and the days
 * behind the 4w / 12w / 1y charts and the month pages
 * (ref/performance-stats/hill-score/README.md).
 *
 * One route feeds it all: `hillScoreScalar` (GraphQL, `GarminApi.hillScores`),
 * which the day sync already asks for the `fitness` group. It proxies
 * `metrics-service/metrics/hillscore/stats` and sends the same rows: one a
 * day, newest first, whatever the aggregation, up to 401 days a request (402
 * is HTTP 400). Every day from the first has a row; today's comes once the
 * watch has scored it, so the newest day can be missing for a while.
 *
 * - `score`, `strength` and `endurance` are Garmin's whole numbers,
 *   `classId` its class (1 Recreational … 6 Elite) and `phraseId` the
 *   feedback phrase under the dial.
 * - Garmin's first two weeks are calibrating: a row with `classId` 0 and
 *   `phraseId` 1 and no scores (2025-08-02..15 here). The row is kept, so the
 *   page can tell a calibrating day from a day without data.
 * - Several devices may score the same day: the primary training device's
 *   row wins, as the day sync picks it (`engine.ts`).
 * - VO₂ Max is not a column: the list's `vo2Max` is always null. The page
 *   reads the vo2-max index for its VO₂ factor.
 * - Routine syncs feed it for free (`fromDay`), from the range call they make
 *   anyway; a history walk asks a year a request, two for this history.
 *
 * Pure: no Obsidian import, so the tests load the definition as registered.
 */

export interface HillScoreRow {
	/** The local calendar day, `YYYY-MM-DD`. */
	date: string;
	/** The hill score, 1–100: `overallScore`. None while calibrating. */
	score?: number;
	/** Hill Strength, 0–100: `strengthScore`. */
	strength?: number;
	/** Hill Endurance, 0–100: `enduranceScore`. */
	endurance?: number;
	/** Garmin's class, 1 Recreational … 6 Elite; 0 while calibrating: `hillScoreClassificationId`. */
	classId?: number;
	/** The feedback phrase under the dial: `hillScoreFeedbackPhraseId`. */
	phraseId?: number;
}

const DAY = /^\d{4}-\d{2}-\d{2}/;

/** A hill score row's day, `YYYY-MM-DD`; undefined for a row without one. */
export function hillDateOf(row: Pick<HillScore, "calendarDate"> | null | undefined): string | undefined {
	const date = row?.calendarDate;
	return typeof date === "string" && DAY.test(date) ? date.slice(0, 10) : undefined;
}

/** A `hillScoreDTOList` row as an index row; the definition drops what is null or missing. */
export function rowOfHillScore(row: HillScore | null | undefined): DayRowInput<HillScoreRow> {
	return {
		date: hillDateOf(row),
		score: row?.overallScore,
		strength: row?.strengthScore,
		endurance: row?.enduranceScore,
		classId: row?.hillScoreClassificationId,
		phraseId: row?.hillScoreFeedbackPhraseId,
	};
}

/**
 * One row a day: where several devices scored the same day, the primary
 * training device's, as the day sync's `hillByDate` keeps it (of equal rows,
 * the later in the list). Rows without a day are left out.
 */
export function primaryHillRows(rows: readonly HillScore[]): HillScore[] {
	const byDate = new Map<string, HillScore>();
	const ranked = [...rows].sort((a, b) => Number(a?.primaryTrainingDevice === true) - Number(b?.primaryTrainingDevice === true));
	for (const row of ranked) {
		const date = hillDateOf(row);
		if (date) byDate.set(date, row);
	}
	return [...byDate.values()];
}

export const HILL_SCORE_INDEX = defineDayIndex<HillScoreRow>({
	kind: "hill-score",
	// "Sync hill score history".
	title: "hill score",
	folder: "hill-score",
	version: 1,
	columns: { score: {}, strength: {}, endurance: {}, classId: {}, phraseId: {} },
	// A day's row comes whole.
	keepOld: false,
	group: "fitness",
	// The cap is 401 days; a year a request matches the day sync's chunks for this route.
	windowDays: 365,
	// Today's row lands only when the watch syncs, so yesterday's can come after
	// the plugin's last sync of it. Free when the run's own days cover both.
	refreshDays: 2,
	// Every day from the first has a row: an empty year is the start.
	emptyWindowsToStop: 1,
	fetchWindow: async (api, start, end) => primaryHillRows(await api.hillScores(start, end)).map(rowOfHillScore),
	// Free on a routine sync: the day's row of the range call it made anyway. A
	// day Garmin has not scored has `hillScore: null`, so it is covered with no row.
	fromDay: { needs: ["hillScore"], read: (day) => (day.hillScore ? rowOfHillScore(day.hillScore) : null) },
});
