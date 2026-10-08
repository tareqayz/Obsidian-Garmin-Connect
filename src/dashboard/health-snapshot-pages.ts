import type { SnapshotMetric, SnapshotRow, SnapshotSample } from "../sync/health-snapshot-index";

/**
 * Garmin Connect's Health Snapshot pages (ref/health-stats/health-snapshot/README.md):
 * the list, newest first, and a snapshot's detail.
 *
 * Rules, measured 2026-10-08:
 * - Times are the recording's local wall clock as sent, never the viewer's.
 * - Figures are the summary's: whole numbers; the respiration average (a
 *   float, 16.31) rounds half up. Garmin's averages are round(mean of the
 *   non-null samples), so `meanFigure` reproduces them from the samples.
 * - Labels: Average / Highest; Pulse Ox shows Lowest.
 *
 * Pure.
 */

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DASH = "--";

/** "12:07 PM" from "…T12:07:35". */
export function clock12(local: string): string {
	const h = Number(local.slice(11, 13));
	const m = local.slice(14, 16);
	return `${h % 12 || 12}:${m} ${h < 12 ? "AM" : "PM"}`;
}

/** "September 24, 2026". */
export function fullDate(date: string): string {
	return `${MONTHS[Number(date.slice(5, 7)) - 1]} ${Number(date.slice(8, 10))}, ${date.slice(0, 4)}`;
}

export interface SnapshotListItem {
	uuid: string;
	date: string;
	title: string;
	/** "2026-09-24, 12:07 PM". */
	detail: string;
}

export function snapshotListView(rows: readonly SnapshotRow[]): SnapshotListItem[] {
	return rows.map((r) => ({ uuid: r.uuid, date: r.date, title: r.name, detail: `${r.startLocal.slice(0, 10)}, ${clock12(r.startLocal)}` }));
}

/** The mean of the non-null values rounded half up, as Garmin derives the summary. */
export function meanFigure(values: ReadonlyArray<number | null>): number | undefined {
	const v = values.filter((x): x is number => x !== null);
	return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : undefined;
}

export type SectionId = "heart" | "spo2" | "respiration" | "stress";

export interface SnapshotFigure {
	value: string;
	label: string;
}

export interface SnapshotSection {
	id: SectionId;
	title: string;
	figures: SnapshotFigure[];
	/** `[s, value]`, s = 0…120. */
	series: Array<[number, number | null]>;
	/** The average line, where the chart draws one (heart rate). */
	average?: number;
}

export interface SnapshotDetailView {
	title: string;
	date: string;
	time: string;
	sections: SnapshotSection[];
	device?: { name: string; version?: string };
	/** The samples are still loading (or never loaded): the charts wait. */
	samples: boolean;
}

const fig = (v: number | undefined, unit: string, label: string): SnapshotFigure => ({ value: v === undefined ? DASH : `${Math.round(v)}${unit}`, label });

const COLUMN: Record<SectionId, 1 | 2 | 3 | 4> = { heart: 1, stress: 2, spo2: 3, respiration: 4 };

export function snapshotDetailView(row: SnapshotRow, samples: readonly SnapshotSample[] | null | undefined): SnapshotDetailView {
	const s = (m: SnapshotMetric) => row.summaries[m] ?? {};
	const series = (id: SectionId): Array<[number, number | null]> => (samples ?? []).map((x) => [x[0], x[COLUMN[id]]]);
	const hr = s("HEART_RATE");
	const sections: SnapshotSection[] = [
		{
			id: "heart",
			title: "Heart Rate (bpm)",
			figures: [fig(hr.avg, " bpm", "Average"), fig(hr.max, " bpm", "Highest"), fig(s("RMSSD_HRV").avg, " ms", "HRV (RMSSD)"), fig(s("SDRR_HRV").avg, " ms", "HRV (SDRR)")],
			series: series("heart"),
			...(hr.avg !== undefined ? { average: Math.round(hr.avg) } : {}),
		},
		{ id: "spo2", title: "Pulse Ox", figures: [fig(s("SPO2").avg, "%", "Average"), fig(s("SPO2").min, "%", "Lowest")], series: series("spo2") },
		{ id: "respiration", title: "Respiration Rate (brpm)", figures: [fig(s("RESPIRATION").avg, " brpm", "Average"), fig(s("RESPIRATION").max, " brpm", "Highest")], series: series("respiration") },
		{ id: "stress", title: "Stress", figures: [fig(s("STRESS").avg, "", "Average"), fig(s("STRESS").max, "", "Highest")], series: series("stress") },
	];
	const view: SnapshotDetailView = { title: row.name, date: fullDate(row.date), time: clock12(row.startLocal), sections, samples: !!samples?.length };
	if (row.deviceName) view.device = row.deviceVersion ? { name: row.deviceName, version: row.deviceVersion } : { name: row.deviceName };
	return view;
}
