import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { HILL_FRAMES, hillFrame, hillPlot, type HillPlot } from "../src/dashboard/hill-score-charts";
import { dayPoints, factorGauge, hillDialGauge, monthPoints, vo2Factor, weekPoints, HILL_TICKS, type HillChart } from "../src/dashboard/hill-score-pages";
import { daysOf } from "../src/dashboard/periods";
import { PANE_COLUMN, PHONE } from "../src/dashboard/stat-charts";
import { DIAL_CENTRE, dialGeometry } from "../src/dashboard/stat-dial";

/*
 * The Obsidian twin (Figma page 430:6130). A chart's box starts at the
 * header's foot: y 165 on the phone frames (4w 505:403, 12w 505:662, 1y
 * 505:861), 109 on the month page (505:1016) and 116, the rule, in the panes
 * (508:96997, 508:97627, 508:98164), whose 748 pt column starts at x 32.
 * Positions below are the twin's nodes in the box: a dot's corner plus half
 * its size, its chart frame's offset added (phone 4w 80.83, 12w 78.5, 1y
 * 68.5 under the foot; the panes the same). TODAY 2026-10-11.
 */

/** Daily scores, run-length from each line's first day: the spec's fixture for the months the charts show. */
const SCORES = new Map<string, number>();
for (const [start, runs] of [
	["2025-11-01", "61×3 60×9 58×3 57×3 56×8 55×2 54×2"],
	["2025-12-01", "54×3 53×4 52×3 51×5 50×2 49×3 48×3 47×2 46×4 45×2"],
	["2026-01-01", "44×2 43×6 42×2 41×4 39×10 38 37×6"],
	["2026-02-01", "37×7 36×2 37 36×2 35 34×5 33×5 32×5"],
	["2026-03-01", "32×3 33 32×16 31×3 32×2 31×6"],
	["2026-04-01", "31×21 32×3 33×4 32×2"],
	["2026-05-01", "33 34×15 33×11 34×2 32×2"],
	["2026-06-01", "32×7 31×5 30×4 29 30×9 29×4"],
	["2026-07-01", "29×2 31×4 30×17 29×6 28×2"],
	["2026-08-01", "28×5 29 28×14 27×2 26×9"],
	["2026-09-01", "27×3 26×2 28×4 29×21"],
	["2026-10-01", "29×11"],
] as const) {
	const values = runs.split(" ").flatMap((run) => {
		const [v, n] = run.split("×");
		return Array<number>(Number(n ?? 1)).fill(Number(v));
	});
	const end = new Date(Date.parse(`${start}T00:00:00Z`) + (values.length - 1) * 86_400_000).toISOString().slice(0, 10);
	daysOf({ from: start, to: end }).forEach((day, i) => SCORES.set(day, values[i]!));
}

const chartOf = (plotted: { points: HillChart["points"]; axis: HillChart["axis"] }, dots: boolean): HillChart => ({ ticks: [...HILL_TICKS], ...plotted, dots });
const FOUR_WEEKS = chartOf(dayPoints({ from: "2026-09-14", to: "2026-10-11" }, SCORES), true);
const TWELVE_WEEKS = chartOf(weekPoints({ from: "2026-07-20", to: "2026-10-11" }, SCORES), true);
const YEAR = chartOf(monthPoints({ from: "2025-11-01", to: "2026-10-11" }, SCORES), false);
const MARCH = chartOf(dayPoints({ from: "2026-03-01", to: "2026-03-31" }, SCORES), true);

/** The twin's dots, corner + 4, in the box: `top` is the chart frame's offset under the header's foot. */
const corner = (xs: readonly number[], ys: readonly number[], top: number) => xs.map((x, i) => [x + 4, ys[i]! + top + 4] as const);

function near(p: HillPlot["points"], twin: ReadonlyArray<readonly [number, number]>, within: number) {
	assert.equal(p.length, twin.length);
	p.forEach((pt, i) => {
		const [x, y] = twin[i]!;
		assert.ok(Math.abs(pt.x - x) <= within && Math.abs(pt.y - y) <= within, `dot ${i} at (${pt.x}, ${pt.y}), the twin's (${x.toFixed(2)}, ${y.toFixed(2)})`);
	});
}

describe("the Hill Score chart's box, on the phone and in a pane", () => {
	it("4w: gridlines 30.33 apart from 87.83 under the header (y 252.83), from x 46.33 to 25 short of the edge; labels right-aligned at 30.33", () => {
		for (const [width, right] of [[PHONE, 377], [PANE_COLUMN, 723]] as const) {
			const p = hillPlot("4w", FOUR_WEEKS, width);
			assert.equal(p.height, 273.33);
			assert.deepEqual(
				p.grid.map((g) => [g.label, g.y, g.x1, g.x2]),
				[["100", 87.83, 46.33, right], ["75", 118.17, 46.33, right], ["50", 148.5, 46.33, right], ["25", 178.83, 46.33, right], ["0", 209.17, 46.33, right]],
			);
			assert.equal(p.labelRight, 30.33);
		}
		// The page: the top gridline at 165 + 87.83, and the Avg / Max rules at 165 + 273.33 = 438.33.
		assert.deepEqual([(165 + HILL_FRAMES.days.top).toFixed(2), (165 + HILL_FRAMES.days.height).toFixed(2)], ["252.83", "438.33"]);
	});

	it("4w on the phone (505:403): 28 dots at 29 from x 46.33 to 369.01, a day dot under each and the ends labelled", () => {
		const p = hillPlot("4w", FOUR_WEEKS, PHONE);
		const xs = [42.33, 54.28, 66.23, 78.18, 90.13, 102.09, 114.04, 125.99, 137.94, 149.89, 161.84, 173.79, 185.74, 197.69, 209.64, 221.6, 233.55, 245.5, 257.45, 269.4, 281.35, 293.3, 305.25, 317.2, 329.15, 341.11, 353.06, 365.01];
		near(p.points, corner(xs, Array(28).fill(89.15), 80.83), 0.02);
		assert.deepEqual([p.left, p.right, p.pointDots, p.pointRadius], [46.33, 369, true, 4]);
		// The X Axis (503:197): 4 pt day dots and 8 pt ends, all centred 397.33 (232.33 in the box); the twin's run 0.16 left of the dots.
		assert.equal(p.dots.length, 28);
		assert.ok(p.dots.every((d) => d.y === 232.33));
		assert.deepEqual([p.dots[0]!.r, p.dots[1]!.r, p.dots[27]!.r], [4, 2, 4]);
		assert.ok(Math.abs(p.dots[1]!.x - 58.12) <= 0.2 && Math.abs(p.dots[27]!.x - 368.83) <= 0.2);
		assert.deepEqual(p.labels, [{ x: 46.33, y: 245.33, text: "09-14", rotated: false }, { x: 369, y: 245.33, text: "10-11", rotated: false }]);
		assert.equal(p.line, "M46.33 173.98 " + Array.from({ length: 27 }, (_, i) => `L${p.points[i + 1]!.x} 173.98`).join(" "));
	});

	it("4w in a pane (508:96997): the same dots across the 748 pt column, to x 715 (747 on the page)", () => {
		const p = hillPlot("4w", FOUR_WEEKS, PANE_COLUMN);
		const xs = Array.from({ length: 28 }, (_, i) => 42.33 + (i * 668.67) / 27);
		near(p.points, corner(xs, Array(28).fill(89.15), 80.83), 0.02);
		// The pane's axis was redrawn on the dots: day 2 at 69.0956 + 2.
		assert.ok(Math.abs(p.dots[1]!.x - 71.1) <= 0.01);
		assert.deepEqual([p.right, p.grid[0]!.x2], [715, 723]);
	});

	it("12w on the phone (505:662): a dot a Monday week, 28.97 apart, ending 37 short; ticks under each, the Mondays on end", () => {
		const p = hillPlot("12w", TWELVE_WEEKS, PHONE);
		near(
			p.points,
			corner(
				[42.33, 71, 100.33, 129, 158, 187, 216, 245, 274, 303, 332, 361],
				[80.87, 81.96, 81.96, 81.96, 83.06, 84.16, 84.16, 81.96, 80.87, 80.87, 80.87, 80.87],
				78.5,
			),
			0.31,
		);
		assert.deepEqual(
			p.grid.map((g) => g.y),
			[85.5, 112.92, 140.33, 167.75, 195.17],
		);
		// The twin's own lines (505:668): 85.5, 112.83, 140.17, 167.83, 195.17.
		[85.5, 112.83, 140.17, 167.83, 195.17].forEach((y, i) => assert.ok(Math.abs(p.grid[i]!.y - y) <= 0.18));
		assert.deepEqual([p.dots.length, p.dots.every((d) => d.r === 4 && d.y === 214.33)], [12, true]);
		assert.deepEqual(p.labels.map((l) => [l.text, l.y, l.rotated]).slice(0, 2), [["07-20", 237, true], ["07-27", 237, true]]);
		assert.equal(p.labels[11]!.text, "10-05");
		assert.equal(p.right, 365);
	});

	it("12w in a pane (508:97627): the slots spread to x 711, 60.42 apart", () => {
		const p = hillPlot("12w", TWELVE_WEEKS, PANE_COLUMN);
		const xs = [42.33, 102.75, 163.18, 223.6, 284.03, 344.45, 404.88, 465.3, 525.73, 586.15, 646.58, 707];
		near(p.points, corner(xs, [80.87, 81.96, 81.96, 81.96, 83.06, 84.16, 84.16, 81.96, 80.87, 80.87, 80.87, 80.87], 78.5), 0.02);
		assert.deepEqual(p.dots.map((d) => d.x), p.points.map((pt) => pt.x));
	});

	it("1y on the phone (505:861): a line without dots from x 35.83 to 374.83 by days, the gridlines from 36, ticks 1.015 pt a day", () => {
		const p = hillPlot("1y", YEAR, PHONE);
		assert.equal(p.pointDots, false);
		assert.deepEqual([p.left, p.right, p.grid[0]!.x1, p.grid[0]!.x2, p.labelRight], [35.83, 374.83, 36, 377, 28.33]);
		// The twin's ticks (503:435), corner + 4: Feb → Mar the short step.
		const ticks = [35.83, 66.5, 97.83, 129.5, 157.83, 189.17, 219.83, 251.17, 281.5, 313.17, 344.5, 374.83];
		p.dots.forEach((d, i) => assert.ok(Math.abs(d.x - ticks[i]!) <= 0.35 && d.y === 214.33 && d.r === 4, `tick ${i} at ${d.x}`));
		// The line's box (505:869): 63.62 to 103.12 in the chart frame, 68.5 under the foot — 57 at the top, 27 at the bottom.
		const ys = p.points.map((pt) => pt.y);
		assert.deepEqual([Math.min(...ys), Math.max(...ys)], [132.12, 171.62]);
		assert.deepEqual([p.points[0]!.x, p.points[11]!.x], [35.83, 374.83]);
		assert.deepEqual(p.labels.map((l) => l.text).join(" "), "Nov Dec Jan Feb Mar Apr May Jun Jul Aug Sep Oct");
		assert.ok(p.labels.every((l) => l.rotated && l.y === 236.9));
		// The twin's lines: 33 apart from 75.5, the last at 207.17.
		[75.5, 108.5, 141.5, 174.5, 207.17].forEach((y, i) => assert.ok(Math.abs(p.grid[i]!.y - y) <= 0.26));
	});

	it("1y in a pane (508:98164): to x 720.83, the ticks by days", () => {
		const p = hillPlot("1y", YEAR, PANE_COLUMN);
		const ticks = [31.83, 93.36, 156.93, 220.51, 277.94, 341.52, 403.04, 466.62, 528.15, 591.73, 655.3, 716.83].map((x) => x + 4);
		p.dots.forEach((d, i) => assert.ok(Math.abs(d.x - ticks[i]!) <= 0.02, `tick ${i} at ${d.x}`));
		assert.deepEqual([p.right, p.grid[0]!.x2], [720.83, 723]);
	});

	it("the month page (505:1016): 4w's frame, 56 pt higher on the page; March's 31 dots", () => {
		assert.equal(hillFrame("month"), HILL_FRAMES.days);
		const p = hillPlot("month", MARCH, PHONE);
		// The twin's dots: 10.75 apart; 32 at 85.51, 33 at 84.3, 31 at 86.72 in a frame 80.83 under the foot.
		const xs = Array.from({ length: 31 }, (_, i) => 42.33 + (i * 322.67) / 30);
		const y = (v: number) => (v === 33 ? 84.3 : v === 32 ? 85.51 : 86.72);
		near(p.points, corner(xs, MARCH.points.map((pt) => y(pt.value)), 80.83), 0.03);
		assert.deepEqual(p.labels.map((l) => l.text), ["03-01", "03-31"]);
		// On the page: the header ends at 109, so the top gridline is at 196.83 and the Avg / Max row at 382.33.
		assert.deepEqual([(109 + HILL_FRAMES.days.top).toFixed(2), (109 + HILL_FRAMES.days.height).toFixed(2)], ["196.83", "382.33"]);
	});

	it("keeps the bare box for a period without a score: the no-data line centres on the plot", () => {
		const p = hillPlot("4w", null, PHONE);
		assert.deepEqual([p.height, p.grid, p.dots, p.points, p.line, p.pointDots], [273.33, [], [], [], "", false]);
		assert.equal((p.top + p.baseline) / 2, 148.5);
	});

	it("draws a lone point as a dot, even on 1y", () => {
		const lone = chartOf(monthPoints({ from: "2026-10-01", to: "2026-10-11" }, SCORES), false);
		const p = hillPlot("1y", lone, PHONE);
		assert.deepEqual([p.points.length, p.line, p.pointDots], [1, "", true]);
	});
});

describe("the dials on the twin's Stat Dial and Factor Dial", () => {
	const dist = (a: { x: number; y: number }, b: readonly [number, number]) => Math.hypot(a.x - b[0], a.y - b[1]);

	it("puts 29's marker within 0.15 pt of the twin's (504:16: its 24 pt box at 12.47, 48.37), orange", () => {
		const g = dialGeometry("hill", hillDialGauge(29));
		assert.ok(dist(g.marker!, [12.47 + 12, 48.37 + 12]) < 0.15, `marker at (${g.marker!.x}, ${g.marker!.y})`);
		assert.deepEqual([g.marker!.tone, g.marker!.outline, g.rc, g.width, DIAL_CENTRE], ["orange", 2, 82.6, 6, 98]);
	});

	it("puts the factor sheets' markers where the twin does: 7 at (33.81, 149.98) (503:495), 14 at (19.44, 123.52) (505:278)", () => {
		assert.ok(dist(dialGeometry("hill", factorGauge(7)).marker!, [21.81 + 12, 137.98 + 12]) < 0.02);
		assert.ok(dist(dialGeometry("hill", factorGauge(14)).marker!, [110.44 - 103 + 12, 529.52 - 418 + 12]) < 0.02);
	});

	it("draws the VO₂ sheet with the VO₂ Max page's marker: 4.6 pt short of the twin's measured 102.98° (503:522)", () => {
		const vo2 = vo2Factor({ date: "2026-10-11", value: 54.9, shown: 55 }, { age: 23, sex: "male" }).sheet!.gauge;
		const g = dialGeometry("hill", vo2);
		assert.equal(g.separators, undefined);
		assert.ok(Math.abs(dist(g.marker!, [166.49 + 12, 104.55 + 12]) - 4.62) < 0.05, `${dist(g.marker!, [178.49, 116.55])} pt from the twin's`);
		assert.equal(g.marker!.tone, "blue");
	});
});
