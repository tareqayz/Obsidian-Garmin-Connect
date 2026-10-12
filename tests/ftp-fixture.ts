import type { BiometricChange } from "../src/garmin/endpoints";

/*
 * The FTP history as Garmin sent it on 2026-10-12 at 13:50, daily and without
 * a sport (ref/performance-stats/ftp/api-samples/ftp-daily-nosport-* and
 * p2w-daily-nosport-*, 2024-10-11..2025-10-12 and 2025-10-13..2026-10-11):
 * every row of both routes, which pair one to one — day, series, W, W/kg.
 * 46 rows on 35 days from 2025-08-02. Each W/kg is the W ÷ the day's weight,
 * float for float: 67.0 kg to 2025-10-08, 67.199 on 10-13, 68.0 from 11-02.
 */
export const CHANGES: ReadonlyArray<readonly [string, string, number, number]> = [
	["2025-08-02", "cross_country_skiing", 111, 1.6567164179104477],
	["2025-08-02", "cycling", 186, 2.7761194029850746],
	["2025-08-02", "running", 394, 5.880597014925373],
	["2025-08-03", "cross_country_skiing", 111, 1.6567164179104477],
	["2025-08-03", "cycling", 186, 2.7761194029850746],
	["2025-08-03", "running", 337, 5.029850746268656],
	["2025-08-05", "running", 373, 5.567164179104478],
	["2025-08-07", "running", 380, 5.6716417910447765],
	["2025-08-15", "running", 373, 5.567164179104478],
	["2025-09-01", "cycling", 221, 3.298507462686567],
	["2025-09-01", "running", 372, 5.552238805970149],
	["2025-09-06", "cycling", 224, 3.343283582089552],
	["2025-09-15", "cycling", 227, 3.388059701492537],
	["2025-09-18", "running", 371, 5.537313432835821],
	["2025-10-01", "running", 370, 5.522388059701493],
	["2025-10-08", "running", 380, 5.6716417910447765],
	["2025-10-13", "cross_country_skiing", 111, 1.6518102947960536],
	["2025-10-13", "cycling", 274, 4.077441628595664],
	["2025-10-13", "running", 380, 5.65484605425676],
	["2025-11-02", "cross_country_skiing", 111, 1.6323529411764706],
	["2025-11-02", "cycling", 274, 4.029411764705882],
	["2025-11-02", "running", 380, 5.588235294117647],
	["2025-11-05", "running", 388, 5.705882352941177],
	["2025-11-10", "running", 389, 5.720588235294118],
	["2026-01-15", "running", 384, 5.647058823529412],
	["2026-01-26", "running", 383, 5.632352941176471],
	["2026-02-03", "running", 381, 5.602941176470588],
	["2026-02-14", "running", 379, 5.573529411764706],
	["2026-02-21", "running", 378, 5.5588235294117645],
	["2026-03-08", "running", 376, 5.529411764705882],
	["2026-03-12", "running", 375, 5.514705882352941],
	["2026-03-17", "running", 374, 5.5],
	["2026-03-22", "running", 373, 5.485294117647059],
	["2026-03-27", "running", 366, 5.382352941176471],
	["2026-04-22", "running", 369, 5.426470588235294],
	["2026-05-30", "running", 366, 5.382352941176471],
	["2026-06-13", "running", 360, 5.294117647058823],
	["2026-07-02", "running", 366, 5.382352941176471],
	["2026-07-27", "running", 354, 5.205882352941177],
	["2026-08-16", "running", 351, 5.161764705882353],
	["2026-08-23", "running", 350, 5.147058823529412],
	["2026-09-09", "running", 353, 5.1911764705882355],
	["2026-09-19", "running", 354, 5.205882352941177],
	["2026-10-08", "cross_country_skiing", 111, 1.6323529411764706],
	["2026-10-08", "cycling", 274, 4.029411764705882],
	["2026-10-08", "running", 354, 5.205882352941177],
];

const change = (day: string, series: string, value: number): BiometricChange => ({ from: day, until: day, series, value, updatedDate: day });

/** `functionalThresholdPower/range/{start}/{end}` without a sport: the window's rows, oldest first, `[]` for none. */
export function wattsPayload(start: string, end: string): BiometricChange[] {
	return CHANGES.filter(([day]) => day >= start && day <= end).map(([day, series, watts]) => change(day, series, watts));
}

/** `powerToWeight/range/{start}/{end}?aggregation=daily` without a sport. */
export function wkgPayload(start: string, end: string): BiometricChange[] {
	return CHANGES.filter(([day]) => day >= start && day <= end).map(([day, series, , wkg]) => change(day, series, wkg));
}

/**
 * The spec's fixture block (README, "Fixture data"): each day's rows, `c`
 * cycling, `x` cross-country skiing, `r` running as W/(W/kg) to 4 dp. What
 * the index must hold.
 */
export const SPEC_ROWS = `
2025-08-02 c186/2.7761 x111/1.6567 r394/5.8806 · 2025-08-03 c186/2.7761 x111/1.6567 r337/5.0299
2025-08-05 r373/5.5672 · 08-07 r380/5.6716 · 08-15 r373/5.5672 · 09-01 c221/3.2985 r372/5.5522
2025-09-06 c224/3.3433 · 09-15 c227/3.3881 · 09-18 r371/5.5373 · 10-01 r370/5.5224 · 10-08 r380/5.6716
2025-10-13 c274/4.0774 x111/1.6518 r380/5.6548 · 2025-11-02 c274/4.0294 x111/1.6324 r380/5.5882
2025-11-05 r388/5.7059 · 11-10 r389/5.7206 · 2026-01-15 r384/5.6471 · 01-26 r383/5.6324 · 02-03 r381/5.6029
2026-02-14 r379/5.5735 · 02-21 r378/5.5588 · 03-08 r376/5.5294 · 03-12 r375/5.5147 · 03-17 r374/5.5
2026-03-22 r373/5.4853 · 03-27 r366/5.3824 · 04-22 r369/5.4265 · 05-30 r366/5.3824 · 06-13 r360/5.2941
2026-07-02 r366/5.3824 · 07-27 r354/5.2059 · 08-16 r351/5.1618 · 08-23 r350/5.1471 · 09-09 r353/5.1912
2026-09-19 r354/5.2059 · 2026-10-08 c274/4.0294 x111/1.6324 r354/5.2059
`;

/** `SPEC_ROWS` as rows: a day written "MM-DD" takes the year of the day before it. */
export function specRows(): Array<Record<string, number | string>> {
	const keys: Record<string, [string, string]> = { c: ["cycling", "cyclingWkg"], x: ["xc", "xcWkg"], r: ["running", "runningWkg"] };
	let year = "";
	return SPEC_ROWS.trim()
		.split(/\s*·\s*|\n/)
		.map((item) => {
			const [day, ...cells] = item.trim().split(" ");
			if (day!.length === 10) year = day!.slice(0, 4);
			const row: Record<string, number | string> = { date: day!.length === 10 ? day! : `${year}-${day}` };
			for (const cell of cells) {
				const [watts, wkg] = cell.slice(1).split("/").map(Number);
				const [w, r] = keys[cell[0]!]!;
				row[w] = watts!;
				row[r] = wkg!;
			}
			return row;
		});
}

/**
 * `powerToWeight/latest/2026-10-11` as the account sync fetched it at 22:29 on
 * the capture day (api-samples/power-to-weight-latest-2026-10-11.json, the
 * profile id left out); the web's at 22:59 and the live one of Oct 12 13:53
 * are the same rows.
 */
export const LATEST_2026_10_11: ReadonlyArray<Record<string, unknown>> = [
	{ calendarDate: "2026-10-08T10:27:27.8", origin: "weight", sport: "RUNNING", functionalThresholdPower: 354, weight: 68, powerToWeight: 5.205882352941177, ftpCreateTime: "2026-09-19T11:22:14.0", weightCreateTime: "2026-10-08T10:27:27.8", isStale: false },
	{ calendarDate: "2026-10-08T10:27:27.8", origin: "weight", sport: "CYCLING", functionalThresholdPower: 274, weight: 68, powerToWeight: 4.029411764705882, ftpCreateTime: "2025-10-13T11:09:17.547", weightCreateTime: "2026-10-08T10:27:27.8", isStale: false },
	{ calendarDate: "2026-10-08T10:27:27.8", origin: "weight", sport: "CROSS_COUNTRY_SKIING", functionalThresholdPower: 111, weight: 68, powerToWeight: 1.6323529411764706, ftpCreateTime: "2025-08-02T20:44:02.546", weightCreateTime: "2026-10-08T10:27:27.8", isStale: true },
];
