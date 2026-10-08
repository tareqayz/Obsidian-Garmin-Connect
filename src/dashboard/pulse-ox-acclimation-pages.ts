import type { PulseOxRow } from "../sync/pulse-ox-index";
import { canStepBack, dayAxis, daysOf, meanOf, periodLabel, periodOf, spread, type PeriodAxis, type PeriodRoute } from "./periods";
import { spo2Band, type Spo2Band } from "./pulse-ox-pages";

/**
 * Garmin Connect's Pulse Ox Acclimation page, from the pulse ox index
 * (`src/sync/pulse-ox-index.ts`). Pure. The rules
 * (ref/health-stats/pulse-ox-acclimation/README.md):
 *
 * - 7d and 4w only, "Last 7 Days - Overall" / "Last 4 Weeks - Overall".
 * - Overall = round half up of the mean of the daily averages over the days
 *   with one (Jun 19–25: 573 / 6 = 95.5 → 96).
 * - A dual-axis chart: SpO₂ 0–100 on the left, a dot a day coloured by its
 *   band (Inferred); the elevation area on the right, 0–5k unless the data
 *   runs higher (the day's mean elevation, Inferred).
 * - Without a reading the 7d shows "No pulse ox acclimation data." and no
 *   chart; the 4w still draws the elevation.
 */

export interface AcclimationPageData {
	rows: readonly PulseOxRow[];
	complete: boolean;
}

export interface AcclimationInput {
	data: AcclimationPageData;
	route: PeriodRoute;
	today: string;
}

export const SPO2_AXIS = [100, 80, 60, 40, 20, 0];

export interface AcclimationView {
	range: "7d" | "4w";
	from: string;
	to: string;
	label: string;
	/** "Last 7 Days - Overall". */
	caption: string;
	canGoBack: boolean;
	canGoForward: boolean;
	/** False: the empty message instead of the chart. */
	showChart: boolean;
	points: Array<{ x: number; value: number; band: Spo2Band }>;
	/** The elevation area's points, metres; null where a day has none. */
	elevation: Array<{ x: number; value: number | null }>;
	/** The right axis' top, metres: 5000 unless the data runs higher. */
	elevationTop: number;
	/** The right axis' labels, top first: "5k" … "0". */
	elevationLabels: string[];
	axis: PeriodAxis;
	overall?: number;
	overallText: string;
}

export function acclimationView(input: AcclimationInput): AcclimationView {
	const { data, route, today } = input;
	const range = route.range === "4w" ? "4w" : "7d";
	const span = periodOf(range, route.offset, today);
	const days = daysOf(span);
	const rows = new Map(data.rows.map((r) => [r.date, r]));
	const points: AcclimationView["points"] = [];
	const elevation: AcclimationView["elevation"] = [];
	days.forEach((d, i) => {
		const row = rows.get(d);
		const x = spread(i, days.length);
		if (row?.avg !== undefined) points.push({ x, value: row.avg, band: spo2Band(row.avg) });
		elevation.push({ x, value: row?.elev ?? null });
	});
	const overall = meanOf(points.map((p) => p.value), "round");
	const highest = Math.max(0, ...elevation.map((e) => e.value ?? 0));
	const steps = Math.max(5, Math.ceil(highest / 1000));
	const top = steps * 1000;
	const hasElevation = elevation.some((e) => e.value !== null);
	return {
		range,
		from: span.from,
		to: span.to,
		label: periodLabel(span.from, span.to, today),
		caption: range === "7d" ? "Last 7 Days - Overall" : "Last 4 Weeks - Overall",
		canGoBack: canStepBack(data.rows[0]?.date, data.complete, span.from),
		canGoForward: route.offset < 0,
		showChart: points.length > 0 || (range === "4w" && hasElevation),
		points,
		elevation,
		elevationTop: top,
		elevationLabels: [5, 4, 3, 2, 1, 0].map((k) => (k ? `${(k * top) / 5000}k` : "0")),
		axis: dayAxis(days),
		...(overall !== undefined ? { overall } : {}),
		overallText: overall !== undefined ? `${overall}%` : "--",
	};
}
