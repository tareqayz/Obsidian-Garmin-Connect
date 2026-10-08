import type { SectionId, SnapshotSection } from "./health-snapshot-pages";
import { r2 } from "./stat-charts";

/**
 * The Health Snapshot detail's four charts, measured off the Obsidian twin
 * (page 239:25, phone 347:163), each box from the bottom of its figures.
 * The x axis is the two minutes, 0:00 … 2:00 every 24 s; the plot runs from
 * 40pt to 23pt short of the box's right edge at any width.
 *
 * y ticks (Inferred from Sep 24): heart rate every 10 bpm inside the data
 * (60–90 for 59–93), respiration every 2 (14–18 for 13–19), Pulse Ox
 * 60–100 and stress 0–100 fixed.
 *
 * Pure.
 */

interface SectionFrame {
	/** The top and bottom tick's y. */
	top: number;
	bottom: number;
	/** Where areas close. */
	floor: number;
	/** The time axis' top: its dots 4pt below, labels 18, caption 34, the box ends 40 down. */
	axis: number;
}

export const SNAPSHOT_LEFT = 40;
export const SNAPSHOT_INSET = 23;
export const SNAPSHOT_SECONDS = 120;

export const SECTION_FRAMES: Readonly<Record<SectionId, SectionFrame>> = {
	heart: { top: 53, bottom: 108, floor: 113, axis: 118 },
	spo2: { top: 35, bottom: 102, floor: 104, axis: 109 },
	respiration: { top: 47.5, bottom: 89, floor: 103, axis: 109 },
	stress: { top: 31.5, bottom: 106, floor: 106, axis: 108 },
};

export function snapshotTicks(id: SectionId, values: readonly number[]): number[] {
	if (id === "spo2") return [100, 90, 80, 70, 60];
	if (id === "stress") return [100, 75, 50, 25, 0];
	const step = id === "heart" ? 10 : 2;
	if (!values.length) return id === "heart" ? [90, 80, 70, 60] : [18, 16, 14];
	const lo = Math.ceil(Math.min(...values) / step) * step;
	const hi = Math.max(lo, Math.floor(Math.max(...values) / step) * step);
	const ticks: number[] = [];
	for (let v = hi; v >= lo; v -= step) ticks.push(v);
	return ticks.length > 1 ? ticks : [hi + step, hi];
}

export interface SnapshotPlot {
	width: number;
	height: number;
	kind: "area" | "step-line" | "step-area";
	grid: Array<{ y: number; label: string }>;
	labelRight: number;
	/** The mark's path: an area closed on the floor, or a line. */
	path: string;
	average?: { y: number; x1: number; x2: number };
	dots: Array<{ x: number; y: number }>;
	labels: Array<{ x: number; y: number; text: string }>;
	caption: { x: number; y: number };
}

const KIND: Record<SectionId, SnapshotPlot["kind"]> = { heart: "area", spo2: "step-line", respiration: "step-area", stress: "step-area" };

export function snapshotPlot(section: SnapshotSection, width: number): SnapshotPlot {
	const f = SECTION_FRAMES[section.id];
	const values = section.series.flatMap(([, v]) => (v === null ? [] : [v]));
	const ticks = snapshotTicks(section.id, values);
	const hi = ticks[0]!, lo = ticks[ticks.length - 1]!;
	const right = Math.max(SNAPSHOT_LEFT + 60, width - SNAPSHOT_INSET);
	const x = (s: number) => r2(SNAPSHOT_LEFT + (s / SNAPSHOT_SECONDS) * (right - SNAPSHOT_LEFT));
	const y = (v: number) => r2(Math.min(f.floor, f.top + ((hi - v) / (hi - lo)) * (f.bottom - f.top)));
	const kind = KIND[section.id];

	// Runs of consecutive readings; a null breaks the mark.
	const runs: Array<Array<[number, number]>> = [];
	let run: Array<[number, number]> | null = null;
	for (const [s, v] of section.series) {
		if (v === null) {
			run = null;
			continue;
		}
		if (!run) runs.push((run = []));
		run.push([s, v]);
	}
	let path = "";
	for (const r of runs) {
		const pts: Array<[number, number]> = [];
		r.forEach(([s, v], i) => {
			if (kind === "area") pts.push([x(s), y(v)]);
			else {
				const next = r[i + 1]?.[0] ?? Math.min(SNAPSHOT_SECONDS, s + 1);
				pts.push([x(s), y(v)], [x(next), y(v)]);
			}
		});
		if (!pts.length) continue;
		const line = pts.map(([px, py], i) => `${i ? "L" : "M"}${px} ${py}`).join(" ");
		path += (path ? " " : "") + (kind === "step-line" ? line : `${line} L${pts[pts.length - 1]![0]} ${f.floor} L${pts[0]![0]} ${f.floor} Z`);
	}

	const plot: SnapshotPlot = {
		width,
		height: f.axis + 40,
		kind,
		grid: ticks.map((t) => ({ y: y(t), label: String(t) })),
		labelRight: 34,
		path,
		dots: [0, 24, 48, 72, 96, 120].map((s) => ({ x: x(s), y: f.axis + 4 })),
		labels: [0, 24, 48, 72, 96, 120].map((s) => ({ x: x(s), y: f.axis + 18, text: `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}` })),
		caption: { x: r2((SNAPSHOT_LEFT + right) / 2), y: f.axis + 34 },
	};
	if (section.average !== undefined && values.length) plot.average = { y: y(section.average), x1: SNAPSHOT_LEFT, x2: r2(right) };
	return plot;
}
