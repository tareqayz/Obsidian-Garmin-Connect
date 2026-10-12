import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { statusTone } from "../src/dashboard/home";
import { CHART_RHYTHM, DIMMED_OPACITY, STRIP_FRAME, stripBox, stripPlot, tableColumnCount, tableColumns } from "../src/dashboard/training-status-charts";
import { STATUS_WORDS, type TrainingStatusKey } from "../src/dashboard/training-status-copy";
import { trainingStatusView, type TrainingStatusPeriodView } from "../src/dashboard/training-status-pages";
import { PERFORMANCE_STATUS_COLOR } from "../src/ui/svelte/health/performance-colors";
import { ROWS, TODAY } from "./training-status-fixture";

/**
 * The strip and its labels against the phone shots of 2026-10-11
 * (ref/performance-stats/training-status/phone/4w/01-top.png, 12w/01-top.png,
 * 12w/02-scroll-1.png, 12w/03-scroll-2.png), read as colour runs along a
 * line at 3 px a point (`ts_strip.py`, `golden-training-status.py`).
 */
const PHONE = 402;
/** The twin's pane (Figma 564:2030 on). */
const PANE = 1190;

/** Each run as the shots measured it: its first pixel and the pixel after its last, and its colour. */
const MEASURED: Record<"4w" | "12w", string> = {
	"4w": "48-320 #0B963F, 326-399 #815AF7, 405-795 #0B963F, 801-914 #F5BF2A, 920-1112 #1976D2, 1118-1152 #F5BF2A",
	"12w":
		"48-68 #1976D2, 74-82 #815AF7, 88-108 #1976D2, 114-135 #6C6C6C, 141-174 #F5BF2A, 180-240 #0B963F, 246-267 #F5BF2A, 273-293 #1976D2, " +
		"299-346 #0B963F, 352-399 #D42FC2, 405-425 #0B963F, 431-452 #F5BF2A, 458-478 #1976D2, 484-491 #F5BF2A, 497-505 #0B963F, 511-531 #E02C2C, " +
		"537-637 #EA670E, 643-663 #D42FC2, 669-716 #F5BF2A, 722-875 #0B963F, 881-901 #815AF7, 907-1033 #0B963F, 1039-1073 #F5BF2A, 1079-1139 #1976D2, 1145-1152 #F5BF2A",
};

/** The x labels' ink, first and after-last pixel, under each strip. */
const LABEL_INK: Record<"4w" | "12w", string> = {
	"4w": "82-172 238-333 397-492 555-650 717-806 875-965 1036-1120",
	"12w": "81-173 239-332 399-490 558-646 717-806 873-968 1033-1123",
};

/** The phone's status colours (the spec's Colours). */
const PHONE_COLOR: Partial<Record<TrainingStatusKey, string>> = {
	productive: "#0B963F",
	peaking: "#815AF7",
	maintaining: "#F5BF2A",
	recovery: "#1976D2",
	unproductive: "#EA670E",
	detraining: "#6C6C6C",
	strained: "#D42FC2",
	overreaching: "#E02C2C",
};

const runsOf = (range: "4w" | "12w") =>
	MEASURED[range].split(", ").map((run) => {
		const [px, color] = run.split(" ") as [string, string];
		const [a, b] = px.split("-").map(Number) as [number, number];
		return { x0: a / 3, x1: b / 3, color };
	});

const view = (range: "4w" | "12w", sub?: string) =>
	trainingStatusView({ range, offset: 0, ...(sub ? { sub } : {}) }, ROWS, { today: TODAY, complete: true }) as TrainingStatusPeriodView;

describe("the strip on a phone", () => {
	for (const range of ["4w", "12w"] as const) {
		it(`${range}: every run's edges within 0.17 pt of the shot, in its colour; the last ends at 384`, () => {
			const plot = stripPlot(view(range), PHONE)!;
			const measured = runsOf(range);
			assert.equal(plot.width, 368);
			assert.equal(plot.rects.length, measured.length);
			plot.rects.forEach((rect, i) => {
				const shot = measured[i]!;
				assert.ok(Math.abs(rect.x0 - shot.x0) <= 0.17 && Math.abs(rect.x1 - shot.x1) <= 0.17, `${range} run ${i}: ${rect.x0.toFixed(2)}–${rect.x1.toFixed(2)} vs ${shot.x0.toFixed(2)}–${shot.x1.toFixed(2)}`);
				assert.equal(PHONE_COLOR[rect.status!], shot.color, `${range} run ${i}`);
				assert.deepEqual([rect.y0, rect.y1, rect.selected], [0, 64, false]);
			});
			assert.equal(plot.rects[0]!.x0, 16);
			assert.ok(Math.abs(plot.rects[plot.rects.length - 1]!.x1 - 384) < 1e-9);
		});

		it(`${range}: the seven labels' ink centred within 0.33 pt of 16 + (2i + 1)·370/14`, () => {
			const plot = stripPlot(view(range), PHONE)!;
			const ink = LABEL_INK[range].split(" ").map((px) => px.split("-").map(Number) as [number, number]);
			assert.deepEqual(plot.labels.map((l) => l.text), view(range).axis.map((a) => a.text));
			plot.labels.forEach((label, i) => {
				assert.ok(Math.abs(label.x - (16 + ((2 * i + 1) * 370) / 14)) < 1e-9);
				const centre = (ink[i]![0] + ink[i]![1]) / 6;
				assert.ok(Math.abs(label.x - centre) <= 1 / 3 + 1e-9, `${range} label ${i}: ${label.x.toFixed(2)} vs ${centre.toFixed(2)}`);
			});
		});
	}

	it("with a row selected, that run stays 64 tall at its own x and the other 24 drop to the 16 pt foot", () => {
		for (const [sub, px] of [
			["run:2026-08-24", [511, 531]],
			["run:2026-07-25", [114, 135]],
		] as const) {
			const plot = stripPlot(view("12w", sub), PHONE)!;
			const full = plot.rects.filter((r) => r.y0 === 0);
			assert.equal(full.length, 1, sub);
			assert.ok(full[0]!.selected);
			assert.ok(Math.abs(full[0]!.x0 - px[0] / 3) <= 0.17 && Math.abs(full[0]!.x1 - px[1] / 3) <= 0.17, sub);
			// The foot: 300.33–316.33 on a strip from 252.33, bottom-aligned.
			const feet = plot.rects.filter((r) => !r.selected);
			assert.equal(feet.length, 24);
			assert.ok(feet.every((r) => r.y0 === STRIP_FRAME.height - STRIP_FRAME.foot && r.y1 === 64 && r.y0 === 48));
		}
	});

	it("a day is (width + 2)/N: 13.214 pt on 4w, 4.405 on 12w, 2.033 on 6m, days without a row included", () => {
		for (const [range, days] of [
			["4w", 28],
			["12w", 84],
			["6m", 182],
		] as const) {
			const v = trainingStatusView({ range, offset: 0 }, ROWS, { today: TODAY, complete: true }) as TrainingStatusPeriodView;
			const plot = stripPlot(v, PHONE)!;
			plot.rects.forEach((r, i) => assert.ok(Math.abs((r.x1 + STRIP_FRAME.gap - r.x0) / v.strip!.blocks[i]!.days - 370 / days) < 1e-9, `${range} block ${i}`));
		}
		// Without rows before Jul 20, 6m's first 98 days are one empty block, drawn as nothing.
		const partial = trainingStatusView({ range: "6m", offset: 0 }, ROWS.filter((r) => r.date >= "2026-07-20"), { today: TODAY, complete: true }) as TrainingStatusPeriodView;
		assert.deepEqual([partial.strip!.blocks[0]!.days, stripPlot(partial, PHONE)!.rects[0]!.status], [98, null]);
		assert.equal(stripPlot({ ...partial, strip: null }, PHONE), null);
	});
});

/** The twin's pane strips, each run's x from the strip's left and its width (564:2030, 565:2178). */
const PANE_RUNS: Record<"4w" | "12w", string> = {
	"4w": "0 185.5, 187.5 51.57, 241.07 265.86, 508.93 78.36, 589.29 131.93, 723.21 24.79",
	"12w":
		"0 15.86, 17.86 6.93, 26.79 15.86, 44.65 15.86, 62.51 24.79, 89.3 42.64, 133.94 15.86, 151.8 15.86, 169.66 33.71, 205.37 33.71, " +
		"241.08 15.86, 258.94 15.86, 276.8 15.86, 294.66 6.93, 303.59 6.93, 312.52 15.86, 330.38 69.43, 401.81 15.86, 419.67 33.71, " +
		"455.38 105.14, 562.52 15.86, 580.38 87.29, 669.67 24.79, 696.46 42.64, 741.1 6.93",
};

describe("the strip in a pane", () => {
	it("fills the 748 pt column at x 32: a day is 750/N, every run's width within 0.01 pt of the twin's, its x within 0.05 (the twin adds up rounded widths)", () => {
		assert.deepEqual(stripBox(PANE), { left: 32, width: 748 });
		assert.deepEqual(stripBox(PHONE), { left: 16, width: 368 });
		for (const range of ["4w", "12w"] as const) {
			const plot = stripPlot(view(range), PANE)!;
			const twin = PANE_RUNS[range].split(", ").map((run) => run.split(" ").map(Number) as [number, number]);
			assert.equal(plot.rects.length, twin.length);
			plot.rects.forEach((rect, i) => {
				const [x, w] = twin[i]!;
				assert.ok(Math.abs(rect.x0 - 32 - x) <= 0.05 && Math.abs(rect.x1 - rect.x0 - w) <= 0.01, `${range} run ${i}: ${(rect.x0 - 32).toFixed(2)} ${(rect.x1 - rect.x0).toFixed(2)} vs ${x} ${w}`);
			});
		}
	});

	it("centres the labels at 32 + (2i + 1)·750/14, the twin's scaled Strip Labels", () => {
		stripPlot(view("4w"), PANE)!.labels.forEach((label, i) => assert.ok(Math.abs(label.x - (32 + ((2 * i + 1) * 750) / 14)) < 1e-9));
	});

	it("keeps the selected run full and drops the others to the foot, as on a phone (565:2178)", () => {
		const plot = stripPlot(view("12w", "run:2026-08-24"), PANE)!;
		const full = plot.rects.filter((r) => r.y0 === 0);
		assert.deepEqual(full.map((r) => r.status), ["overreaching"]);
		assert.ok(Math.abs(full[0]!.x0 - 32 - 312.52) <= 0.05 && Math.abs(full[0]!.x1 - full[0]!.x0 - 15.86) <= 0.01);
		assert.equal(plot.rects.filter((r) => r.y0 === STRIP_FRAME.height - STRIP_FRAME.foot).length, 24);
	});
});

describe("the page's rhythm", () => {
	it("puts the strip, the labels, the table's header and its rows where the twin has them", () => {
		const { phoneTop, paneTop, labelGap, labels, tableGap } = CHART_RHYTHM;
		const at = (header: number, top: number) => {
			const strip = header + top;
			const label = strip + STRIP_FRAME.height + labelGap;
			const table = label + labels + tableGap;
			return [strip, label, table, table + 52].map((y) => Number(y.toFixed(2)));
		};
		// Phone (561:60): under the 165 pt header; pane (564:2030): under the 116 pt one.
		assert.deepEqual(at(165, phoneTop), [196.33, 268.37, 309.33, 361.33]);
		assert.deepEqual(at(116, paneTop), [148, 220.04, 261, 313]);
	});

	it("fills the pane's two columns row by row, newest left: 4w 3 + 3, 12w 13 + 12 (565:2416, 565:2417)", () => {
		assert.deepEqual([tableColumnCount(false), tableColumnCount(true)], [1, 2]);
		const four = view("4w").table.map((r) => r.dates);
		assert.deepEqual(tableColumns(four, 2), [
			["Since Oct 11", "Oct 3 - 5", "Sep 21 - 22"],
			["Oct 6 - 10", "Sep 23 - Oct 2", "Sep 14 - 20"],
		]);
		assert.deepEqual(tableColumns(four, 1), [four]);
		const twelve = tableColumns(view("12w").table, 2);
		assert.deepEqual(twelve.map((c) => c.length), [13, 12]);
		assert.deepEqual([twelve[0]![12]!.dates, twelve[1]![4]!.dates], ["Jul 20 - 21", "Aug 24 - 25"]);
	});
});

describe("the table's dimmed rows", () => {
	/** A colour drawn at `alpha` over `bg`, a channel at a time. */
	const over = (fg: string, bg: string, alpha: number) =>
		[1, 3, 5].map((i) => alpha * parseInt(fg.slice(i, i + 2), 16) + (1 - alpha) * parseInt(bg.slice(i, i + 2), 16));
	const channels = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

	it("are the row at half opacity over the table's #1D1D1D: the fills, the text and the dots, each channel within 1", () => {
		assert.equal(DIMMED_OPACITY, 0.5);
		for (const [fg, seen] of [
			["#101010", "#161616"],
			["#252525", "#212121"],
			["#F4F4F4", "#898989"],
			["#0B963F", "#145A2E"],
			["#F5BF2A", "#896E23"],
		] as const) {
			const drawn = over(fg, "#1D1D1D", DIMMED_OPACITY);
			channels(seen).forEach((c, i) => assert.ok(Math.abs(drawn[i]! - c) <= 1, `${fg} → ${seen}: ${drawn.join(",")}`));
		}
	});
});

describe("the status colours", () => {
	it("cover every status the page shows, Overreaching apart from Strained, No Status and Paused greys of their own", () => {
		for (const status of Object.keys(STATUS_WORDS) as TrainingStatusKey[]) assert.ok(PERFORMANCE_STATUS_COLOR[status], status);
		assert.notEqual(PERFORMANCE_STATUS_COLOR.overreaching, PERFORMANCE_STATUS_COLOR.strained);
		const colours = Object.values(PERFORMANCE_STATUS_COLOR);
		assert.equal(new Set(colours).size, colours.length);
		// Home's In Focus card keeps its own merged tone.
		assert.equal(statusTone("OVERREACHING_1"), "strained");
	});
});
