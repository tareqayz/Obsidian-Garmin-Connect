/**
 * The calendar grid behind the year heatmap.
 *
 * A line chart answers "which way is this going"; a calendar answers "which
 * days, and which ones are missing" — and for synced data the gaps are as much
 * of the story as the values. Pure, so the arithmetic is testable without a DOM.
 */

import { shiftDate, type DayRow } from "./series";

/** 0 means no data for that day. 1-4 are the ordinal steps, light to dark. */
export type HeatLevel = 0 | 1 | 2 | 3 | 4;

export interface HeatCell {
	date: string;
	value?: number;
	level: HeatLevel;
	/** Outside the requested window — drawn as a hole so weeks stay square. */
	filler?: true;
}

export interface HeatGrid {
	/** Columns of seven cells, Monday at the top, oldest week first. */
	weeks: HeatCell[][];
	/** Where each month starts, for the strip of labels above the grid. */
	months: Array<{ label: string; column: number }>;
	/** The three cut points between the four steps, for the legend. */
	thresholds: number[];
	days: number;
	min?: number;
	max?: number;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Monday = 0. Garmin weeks start on Monday and so does most of the world. */
export function weekdayOf(iso: string): number {
	const [y, m, d] = iso.split("-").map(Number);
	return (new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1)).getUTCDay() + 6) % 7;
}

/**
 * Quartile cut points over the values present.
 *
 * Quantiles rather than an even split of min..max: one outlier day of 30,000
 * steps would otherwise push every ordinary day into the palest step and the
 * whole year would read as empty.
 */
export function thresholdsFor(values: readonly number[]): number[] {
	if (values.length === 0) return [];
	const sorted = [...values].sort((a, b) => a - b);
	const at = (fraction: number) =>
		sorted[Math.min(sorted.length - 1, Math.floor(fraction * sorted.length))]!;
	return [at(0.25), at(0.5), at(0.75)];
}

export function levelOf(value: number, thresholds: readonly number[]): HeatLevel {
	if (thresholds.length < 3) return 3;
	if (value <= thresholds[0]!) return 1;
	if (value <= thresholds[1]!) return 2;
	if (value <= thresholds[2]!) return 3;
	return 4;
}

export function heatGrid(
	rows: readonly DayRow[],
	key: string,
	from: string,
	to: string,
): HeatGrid {
	if (!from || !to || to < from) return { weeks: [], months: [], thresholds: [], days: 0 };

	const byDate = new Map<string, number>();
	for (const row of rows) {
		const value = row.values[key];
		if (typeof value === "number" && Number.isFinite(value)) byDate.set(row.date, value);
	}
	const values = [...byDate.values()];
	const thresholds = thresholdsFor(values);

	// Pad to whole weeks at both ends so every column is seven cells tall and the
	// weekday rows line up across the whole grid.
	const lead = weekdayOf(from);
	const trail = 6 - weekdayOf(to);
	const start = shiftDate(from, -lead);
	const end = shiftDate(to, trail);

	const weeks: HeatCell[][] = [];
	const months: Array<{ label: string; column: number }> = [];
	let current: HeatCell[] = [];
	let lastMonth = "";
	let days = 0;

	for (let date = start; date <= end; date = shiftDate(date, 1)) {
		const inWindow = date >= from && date <= to;
		const value = byDate.get(date);
		current.push(
			inWindow
				? {
						date,
						...(value === undefined ? {} : { value }),
						level: value === undefined ? 0 : levelOf(value, thresholds),
					}
				: { date, level: 0, filler: true },
		);
		if (inWindow) days += 1;

		if (current.length === 7) {
			// Labelled at the column where the month first appears anywhere in the
			// week, not where the week begins: a month starting on a Friday would
			// otherwise never get a label at all.
			const opener = current.find(
				(cell) => !cell.filler && cell.date.slice(0, 7) !== lastMonth,
			);
			if (opener) {
				lastMonth = opener.date.slice(0, 7);
				months.push({
					label: MONTHS[Number(lastMonth.slice(5, 7)) - 1] ?? lastMonth,
					column: weeks.length,
				});
			}
			weeks.push(current);
			current = [];
		}
	}

	return {
		weeks,
		months,
		thresholds,
		days,
		...(values.length ? { min: Math.min(...values), max: Math.max(...values) } : {}),
	};
}
