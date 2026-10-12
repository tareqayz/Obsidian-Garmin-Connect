import { shiftDate } from "../src/sync/day-index";
import type { HeatAcclimationRow } from "../src/sync/heat-acclimation-index";

/**
 * The Heat Acclimation tests' rows: the whole history as
 * `heataltitudeacclimation/daily` sent it on 2026-10-12
 * (ref/performance-stats/heat-acclimation/api-samples/,
 * probe-daily-3660-2016-10-14_2026-10-11.json), the heat columns only, and
 * today's overnight row of 2026-10-12. The 7d and 4w windows roll daily, so
 * the golden numbers only reproduce with today pinned to the capture day.
 * Not a test file: the pages tests and Training Status's import it.
 */
export const TODAY = "2026-10-11";

/**
 * Every day 2025-08-02 → 2026-10-11, seven a line from the line's first
 * day, as `pct/prev` and Garmin's trend: U ACCLIMATIZING, F ACCLIMATIZED,
 * D DEACCLIMATIZING, - null (exactly the 0 % days). "." for a day without a
 * row: 2026-01-05..09.
 */
export const HISTORY = `
2025-08-02 0/0- 0/0- 0/0- 0/0- 0/0- 0/0- 0/0-
2025-08-09 6/0U 6/6F 21/6U 21/21F 21/21F 21/21F 19/21D
2025-08-16 18/19D 16/18D 19/16U 19/19F 18/19D 23/18U 23/23F
2025-08-23 23/23F 20/23D 44/20U 66/44U 67/66U 67/67F 64/67D
2025-08-30 62/64D 56/62D 50/56D 44/50D 38/44D 31/38D 24/31D
2025-09-06 35/24U 35/35F 31/35D 28/31D 24/28D 20/24D 16/20D
2025-09-13 13/16D 11/13D 9/11D 7/9D 5/7D 3/5D 2/3D
2025-09-20 1/2D 0/1- 0/0- 0/0- 0/0- 0/0- 0/0-
2025-09-27 0/0- 0/0- 0/0- 0/0- 0/0- 0/0- 0/0-
2025-10-04 0/0- 0/0- 0/0- 0/0- 0/0- 0/0- 0/0-
2025-10-11 0/0- 22/0U 47/22U 47/47F 72/47U 97/72U 100/97U
2025-10-18 100/100F 100/100F 100/100F 100/100F 100/100F 100/100F 100/100F
2025-10-25 100/100F 100/100F 100/100F 100/100F 100/100F 100/100F 100/100F
2025-11-01 100/100F 85/100F 70/85D 55/70D 42/55D 32/42D 25/32D
2025-11-08 18/25D 12/18D 7/12D 4/7D 1/4D 0/1- 0/0-
2025-11-15 0/0- 0/0- 0/0- 0/0- 0/0- 0/0- 0/0-
2025-11-22 0/0- 0/0- 0/0- 0/0- 0/0- 0/0- 0/0-
2025-11-29 0/0- 0/0- 0/0- 0/0- 0/0- 0/0- 0/0-
2025-12-06 0/0- 0/0- 0/0- 0/0- 0/0- 0/0- 0/0-
2025-12-13 0/0- 0/0- 0/0- 0/0- 0/0- 0/0- 0/0-
2025-12-20 0/0- 0/0- 0/0- 0/0- 0/0- 0/0- 0/0-
2025-12-27 0/0- 0/0- 0/0- 0/0- 0/0- 0/0- 0/0-
2026-01-03 0/0- 0/0- . . . . .
2026-01-10 0/0- 0/0- 0/0- 0/0- 0/0- 0/0- 0/0-
2026-01-17 0/0- 0/0- 0/0- 0/0- 0/0- 0/0- 0/0-
2026-01-24 0/0- 0/0- 0/0- 0/0- 0/0- 0/0- 0/0-
2026-01-31 0/0- 0/0- 0/0- 0/0- 0/0- 0/0- 0/0-
2026-02-07 0/0- 0/0- 0/0- 0/0- 0/0- 0/0- 0/0-
2026-02-14 0/0- 0/0- 0/0- 0/0- 0/0- 0/0- 0/0-
2026-02-21 0/0- 0/0- 0/0- 0/0- 0/0- 0/0- 0/0-
2026-02-28 0/0- 0/0- 0/0- 0/0- 0/0- 0/0- 0/0-
2026-03-07 0/0- 0/0- 12/0U 12/12F 12/12F 17/12U 17/17F
2026-03-14 17/17F 17/17F 15/17D 14/15D 13/14D 10/13D 8/10D
2026-03-21 7/8D 5/7D 3/5D 2/3D 1/2D 0/1- 0/0-
2026-03-28 0/0- 0/0- 0/0- 0/0- 0/0- 0/0- 0/0-
2026-04-04 0/0- 0/0- 9/0U 9/9F 9/9F 9/9F 28/9U
2026-04-11 28/28F 34/28U 34/34F 34/34F 34/34F 30/34D 27/30D
2026-04-18 24/27D 27/24U 27/27F 23/27D 41/23U 41/41F 45/41U
2026-04-25 59/45U 63/59U 63/63F 71/63U 70/71D 68/70D 66/68D
2026-05-02 66/66F 87/66U 87/87F 79/87D 74/79D 87/74U 96/87U
2026-05-09 96/96F 100/96U 100/100F 100/100F 100/100F 100/100F 100/100F
2026-05-16 97/100D 100/97U 100/100F 99/100D 92/99D 97/92U 96/97D
2026-05-23 82/96D 100/82U 100/100F 85/100D 80/85D 92/80U 90/92D
2026-05-30 100/90U 100/100F 100/100F 100/100F 100/100F 97/100D 85/97D
2026-06-06 74/85D 61/74D 75/61U 74/75D 63/74D 57/63D 48/57D
2026-06-13 68/48U 68/68F 85/68U 84/85D 79/84D 75/79D 69/75D
2026-06-20 65/69D 65/65F 50/65D 40/50D 32/40D 23/32D 15/23D
2026-06-27 9/15D 5/9D 27/5U 43/27U 43/43F 67/43U 67/67F
2026-07-04 66/67D 66/66F 65/66D 63/65D 59/63D 50/59D 41/50D
2026-07-11 33/41F 24/33D 17/24D 11/17D 6/11D 2/6D 0/2-
2026-07-18 0/0- 0/0- 0/0- 0/0- 0/0- 0/0- 0/0-
2026-07-25 0/0- 0/0- 25/0U 25/25F 25/25F 50/25U 50/50F
2026-08-01 75/50U 75/75F 75/75F 75/75F 75/75F 73/75D 91/73U
2026-08-08 100/91U 100/100F 100/100F 100/100F 100/100F 100/100F 100/100F
2026-08-15 100/100F 100/100F 84/100D 67/84D 52/67D 38/52D 19/38D
2026-08-22 17/19D 34/17U 57/34U 57/57F 53/57D 52/53D 50/52D
2026-08-29 75/50U 100/100F 100/100F 100/100F 100/100F 100/100F 100/100F
2026-09-05 100/100F 100/100F 100/100F 100/100F 100/100F 100/100F 100/100F
2026-09-12 100/100F 100/100F 100/100F 100/100F 100/100F 100/100F 100/100F
2026-09-19 100/100F 100/100F 100/100F 100/100F 100/100F 100/100F 100/100F
2026-09-26 100/100F 100/100F 100/100F 100/100F 100/100F 100/100F 100/100F
2026-10-03 100/100F 100/100F 100/100F 100/100F 100/100F 100/100F 68/100D
2026-10-10 79/68U 97/79U
`;

const TRENDS: Readonly<Record<string, string | undefined>> = { U: "ACCLIMATIZING", F: "ACCLIMATIZED", D: "DEACCLIMATIZING", "-": undefined };
const TOKEN = /^(\d+)\/(\d+)([UFD-])$/;

/** The history as index rows, oldest first: `{ date, pct, prev, trend? }`. */
export function heatRows(): HeatAcclimationRow[] {
	const rows: HeatAcclimationRow[] = [];
	for (const line of HISTORY.trim().split("\n")) {
		const [first, ...tokens] = line.trim().split(/\s+/);
		tokens.forEach((token, i) => {
			if (token === ".") return;
			const m = TOKEN.exec(token);
			if (!m) throw new Error(`heat fixture: "${token}" on ${first}`);
			const row: HeatAcclimationRow = { date: shiftDate(first!, i), pct: Number(m[1]), prev: Number(m[2]) };
			const trend = TRENDS[m[3]!];
			if (trend) row.trend = trend;
			rows.push(row);
		});
	}
	return rows;
}

export const HEAT_ROWS: readonly HeatAcclimationRow[] = heatRows();
export const BY_DATE: ReadonlyMap<string, HeatAcclimationRow> = new Map(HEAT_ROWS.map((r) => [r.date, r]));

/**
 * 2026-10-12 at 00:01:42, before the watch synced
 * (probe-daily-future-2026-10-10_2026-10-15.json): the overnight decay, 95
 * from 97. The aggregated route had no heat that morning.
 */
export const OCT_12_ROW: HeatAcclimationRow = { date: "2026-10-12", pct: 95, prev: 97, trend: "DEACCLIMATIZING" };
