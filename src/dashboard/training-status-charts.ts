import type { TrainingStatusKey } from "./training-status-copy";
import type { TrainingStatusPeriodView } from "./training-status-pages";

/**
 * The Training Status page's geometry: the spec's rules, measured on the
 * phone's 4w and 12w shots (ref/performance-stats/training-status/README.md,
 * Rules → Strip and X labels), placed as the Obsidian twin places them
 * (Figma 430:6100: phone 561:60, pane 564:2030), and drawn by `StatusStrip`'s
 * "page" variant and `StatTable`'s "status" kind.
 *
 * - The strip is 64 tall. On a phone it is 368 wide at x 16 (16 from the
 *   page's left, 18 from its right); in a pane it fills the 748 pt column at
 *   x 32. Its day space runs 2 pt past its right edge (370 pt, 750), so a day
 *   is D = (width + 2)/N and each run gives its last 2 pt to the gap: a run
 *   starting i days in and n days long spans x + i·D to x + (i + n)·D − 2.
 *   All 31 runs on the two shots land within 0.17 pt; the last ends at 384.
 * - With a run selected, it keeps its 64 pt and every other block drops to a
 *   16 pt foot, bottom-aligned.
 * - The seven x labels are centred at x + (2i + 1)·(width + 2)/14: 16 +
 *   (2i + 1)·370/14 on a phone (within 0.33 pt of the shots; centring on the
 *   368 pt strip drifts 1.7 pt), 32 + (2i + 1)·750/14 in a pane.
 * - Under the labels, the table: one column on a phone, two 370 pt columns 8
 *   apart in a pane, filled row by row (newest left, then right), the zebra
 *   by grid row. Each column has its own header.
 * - An unselected row of the table dims to half opacity over the table's
 *   background (#1D1D1D on the phone, --background-secondary in the twin):
 *   fills #101010 → #161616 and #252525 → #212121, text #F4F4F4 → #898989,
 *   dots at half colour (#0B963F → #145A2E).
 *
 * Pure.
 */

/** The strip's height, the foot every other run drops to while one is selected, and the gap between runs, pt. */
export const STRIP_FRAME = { height: 64, foot: 16, gap: 2 } as const;

/** The opacity an unselected row is drawn at, over the table's background. */
export const DIMMED_OPACITY = 0.5;

/** Where the shell's twins switch to the 1190 pt pane layout (StatPageShell). */
const PANE_MIN = 1000;
/** Where the shell's body narrows to its 1126 pt column with 32 pt margins. */
const WIDE_MIN = 640;
const BODY = 1126;
/** The side column a pane keeps empty beside the strip and the table, with its gap. */
const SIDE = 370 + 8;

/**
 * The chart block's vertical rhythm, pt, the same on a phone and in a pane
 * but for its top: from the shell's header to the strip (phone 165 → 196.33,
 * pane 116 → 148), the strip, the labels 8.04 under it, and the table's
 * header 24.96 under them (phone 309.33, pane 261). On a phone the block
 * stays pinned under the header while the table scrolls under it, as the
 * app's 12w does.
 */
export const CHART_RHYTHM = { phoneTop: 31.33, paneTop: 32, labelGap: 8.04, labels: 16, tableGap: 24.96 } as const;

/** The strip's box on a page `width` pt wide: its left edge and its width. */
export function stripBox(width: number): { left: number; width: number } {
	const content = width >= WIDE_MIN ? Math.min(BODY, width - 64) : width;
	const left = (width - content) / 2;
	return width >= PANE_MIN ? { left, width: content - SIDE } : { left: left + 16, width: content - 34 };
}

/** The table's columns: two in a pane, one on a phone. */
export function tableColumnCount(pane: boolean): number {
	return pane ? 2 : 1;
}

/** Rows spread over `columns` columns row by row, newest left then right: a row's index in its column is its grid row. */
export function tableColumns<T>(rows: readonly T[], columns: number): T[][] {
	const out: T[][] = Array.from({ length: Math.max(1, columns) }, () => []);
	rows.forEach((row, i) => out[i % out.length]!.push(row));
	return out;
}

export interface StripRect {
	x0: number;
	x1: number;
	/** From the strip's top: 0 for a full block, `height − foot` for a foot. */
	y0: number;
	y1: number;
	/** Null for days without a row: drawn empty. */
	status: TrainingStatusKey | null;
	selected: boolean;
}

export interface StripPlot {
	/** The strip's left edge and width, pt: 16 and 368 on a phone, 32 and 748 in a pane. */
	left: number;
	width: number;
	/** One a block of the view's strip, oldest first. */
	rects: StripRect[];
	/** The x labels' centres, pt from the page's left edge. */
	labels: Array<{ x: number; text: string }>;
}

/** A period's strip and labels on a page `width` pt wide. Null for a period without a row. */
export function stripPlot(view: Pick<TrainingStatusPeriodView, "strip" | "axis" | "days">, width: number): StripPlot | null {
	const strip = view.strip;
	if (!strip) return null;
	const { height, foot, gap } = STRIP_FRAME;
	const box = stripBox(width);
	const space = box.width + gap;
	const day = space / view.days;
	return {
		left: box.left,
		width: box.width,
		rects: strip.blocks.map((block, i) => {
			const short = strip.selected !== undefined && strip.selected !== i;
			return {
				x0: box.left + block.start * day,
				x1: box.left + (block.start + block.days) * day - gap,
				y0: short ? height - foot : 0,
				y1: height,
				status: block.status,
				selected: strip.selected === i,
			};
		}),
		labels: view.axis.map((a) => ({ x: box.left + a.x * space, text: a.text })),
	};
}
