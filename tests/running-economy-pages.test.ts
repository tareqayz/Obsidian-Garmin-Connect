import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { titleCase } from "../src/dashboard/day";
import { daysBetween, daysOf } from "../src/dashboard/periods";
import { ECONOMY_COPY, ESTIMATE_INTRO, ESTIMATE_STEPS, economyClassName, economyWord } from "../src/dashboard/running-economy-copy";
import {
	DASH,
	ECONOMY_DIAL_ANGLES,
	ECONOMY_TITLES,
	ECONOMY_TONES,
	ECONOMY_ZONE_EDGES,
	NO_DATA,
	currentReading,
	economyAngle,
	economyAt,
	economyAxisDay,
	economyBlocks,
	economyChart,
	economyClassIndex,
	economyClassNameAt,
	economyCurrent,
	economyDial,
	economyFigures,
	economyZones,
	economyTicks,
	runningEconomyView,
	type EconomyChart,
	type RunningEconomyContext,
	type RunningEconomyView,
} from "../src/dashboard/running-economy-pages";
import { DIAL_KINDS, dialGeometry } from "../src/dashboard/stat-dial";
import type { RunningEconomyRow } from "../src/sync/running-economy-index";
import { LATEST, ROWS, WEEKLY } from "./running-economy-fixture";

/**
 * Golden numbers from ref/performance-stats/running-economy/README.md: the
 * phone shots of Sunday 2026-10-11 21:21–21:22, the web report of 22:54, and
 * the whole history as `runningeconomy/daily` sent it on 2026-10-12
 * (running-economy-fixture.ts). The 4w / 12w / 1y windows roll daily, so they
 * only reproduce with today pinned.
 */
const TODAY = "2026-10-11";
const CTX: RunningEconomyContext = { today: TODAY, complete: true };
/** `account.json`'s `runningEconomy` as the account sync wrote it on the capture day (`latest/2026-10-11`). */
const ACCOUNT = { runningEconomy: { date: "2026-09-28", score: 224, classification: "INTERMEDIATE" } };

const view = (range: "1d" | "4w" | "12w" | "1y", opts: { offset?: number; rows?: readonly RunningEconomyRow[]; ctx?: Partial<RunningEconomyContext> } = {}): RunningEconomyView =>
	runningEconomyView({ range, offset: opts.offset ?? 0 }, opts.rows ?? ROWS, { ...CTX, ...opts.ctx });

/** A period's points as "MM-DD score", at the day each is drawn. */
const points = (chart: EconomyChart | null) => chart!.points.map((p) => `${p.day.slice(5)} ${p.value}`);
const figures = (v: RunningEconomyView) => v.figures.map((f) => `${f.value} ${f.label}`);
/** A chart's figures, as the view words them. */
const runningEconomyFigures = (chart: EconomyChart) => economyFigures(chart.points.map((p) => p.value)).map((f) => `${f.value} ${f.label}`);
/** The phone's plot runs from x 39 to 386 on every range. */
const px = (x: number) => 39 + x * 347;
const near = (actual: number, expected: number, tolerance: number, what = "") => assert.ok(Math.abs(actual - expected) <= tolerance, `${what} ${actual} is not ${expected} ± ${tolerance}`);

const INTERMEDIATE_COPY =
	"Your running economy shows you have experience, but there’s also plenty of untapped potential at this level. To see improvement, continue to train consistently, and you can even consider safely bumping up your running volume where possible.";

describe("the fixture", () => {
	it("is the history Garmin sent: 87 readings from 2025-08-16 to 2026-09-28, whole numbers", () => {
		assert.deepEqual([ROWS.length, ROWS[0]!.date, ROWS.at(-1)!.date], [87, "2025-08-16", "2026-09-28"]);
		assert.ok(ROWS.every((r) => Number.isInteger(r.score)));
	});

	it("grades every day as the help table does: 87 of 87 words match the score's class", () => {
		const mismatches = ROWS.filter((r) => economyWord(r.classification) !== ["RECREATIONAL", "INTERMEDIATE", "TRAINED"][economyClassIndex(r.score!)]);
		assert.deepEqual(mismatches, []);
	});
});

describe("classes", () => {
	it("follow the help table: Recreational ≥ 225, Intermediate 215–224, Trained 205–214 … Elite ≤ 184", () => {
		const at = (score: number) => economyClassNameAt(economyClassIndex(score));
		assert.deepEqual(
			[240, 225, 224, 215, 214, 205, 204, 195, 194, 190, 189, 185, 184, 170].map((s) => `${s} ${at(s)}`),
			[
				"240 Recreational",
				"225 Recreational",
				"224 Intermediate",
				"215 Intermediate",
				"214 Trained",
				"205 Trained",
				"204 Well-Trained",
				"195 Well-Trained",
				"194 Expert",
				"190 Expert",
				"189 Superior",
				"185 Superior",
				"184 Elite",
				"170 Elite",
			],
		);
	});

	it("name Garmin's words as the help table does: Well-Trained, where titleCase says Well Trained", () => {
		assert.equal(titleCase("WELL_TRAINED"), "Well Trained");
		assert.equal(economyClassName("WELL_TRAINED"), "Well-Trained");
		assert.deepEqual(
			["RECREATIONAL", "INTERMEDIATE", "TRAINED", "WELL_TRAINED", "EXPERT", "SUPERIOR", "ELITE"].map(economyClassName),
			["Recreational", "Intermediate", "Trained", "Well-Trained", "Expert", "Superior", "Elite"],
		);
		assert.deepEqual(["Well-Trained", "well trained", "WELL TRAINED"].map(economyWord), ["WELL_TRAINED", "WELL_TRAINED", "WELL_TRAINED"]);
		assert.deepEqual([economyClassName("SOMETHING"), economyClassName(undefined), economyClassName("CONSTRUCTOR")], [undefined, undefined, undefined]);
	});

	it("change the series' colour halfway between two classes' scores", () => {
		assert.deepEqual(ECONOMY_ZONE_EDGES, [224.5, 214.5, 204.5, 194.5, 189.5, 184.5]);
		assert.deepEqual(ECONOMY_TONES, ["red", "orange", "yellow", "green", "blue", "purple", "pink"]);
	});
});

describe("the dial", () => {
	it("is linear from 235 at −150° to 180 at +150°: 224 at −90°, the edges at the worse classes' lowest scores", () => {
		assert.equal(economyAt(224), 0.2);
		assert.equal(economyAngle(224), -90);
		assert.deepEqual(ECONOMY_DIAL_ANGLES, [-150, -95.45, -40.91, 13.64, 68.18, 95.45, 122.73, 150]);
		// Clamped at the ends.
		assert.deepEqual([economyAngle(240), economyAngle(235), economyAngle(180), economyAngle(170)], [-150, -150, 150, 150]);
	});

	it("puts the gaps where the shot has them, within 0.07°: −40.93, 13.66, 68.25, 95.51, 122.77", () => {
		const g = dialGeometry("economy", economyDial({ score: 224, classification: "INTERMEDIATE" }).gauge);
		assert.deepEqual(
			g.bands.map((b) => b.tone),
			["red", "orange", "yellow", "green", "blue", "purple", "pink"],
		);
		const centres = g.bands.slice(1).map((b, i) => (g.bands[i]!.to + b.from) / 2);
		[-95.45, -40.93, 13.66, 68.25, 95.51, 122.77].forEach((measured, i) => near(centres[i]!, measured, 0.07, `gap ${i + 1}`));
		// 3.26° wide.
		g.bands.slice(1).forEach((b, i) => near(b.from - g.bands[i]!.to, 3.26, 1e-9));
		// The ring 82.55 → 92.45, its round caps reaching ±153.3° on the centreline.
		assert.deepEqual([g.rc, g.width, DIAL_KINDS.economy.radius - DIAL_KINDS.economy.width], [87.5, 9.9, 82.55]);
		near(150 + ((g.caps[1]!.r / g.rc) * 180) / Math.PI, 153.3, 0.07, "cap");
		assert.deepEqual([g.caps[0]!.tone, g.caps[1]!.tone], ["red", "pink"]);
	});

	it("marks 224 at −90.0° (the shot's −90.06°): a Ø 15 orange disc in a 3 pt ring", () => {
		const dial = economyDial({ score: 224, classification: "INTERMEDIATE" });
		assert.deepEqual([dial.gauge.value, dial.gauge.at, dial.gauge.tone, dial.gauge.label, dial.angle], ["224", 0.2, "orange", undefined, -90]);
		near(dial.angle!, -90.06, 0.07, "marker");
		const marker = dialGeometry("economy", dial.gauge).marker!;
		assert.deepEqual([marker.r, marker.outline, marker.tone], [7.5, 3, "orange"]);
		near(marker.x, 98 - 87.5, 1e-9);
		near(marker.y, 98, 1e-9);
	});

	it("colours the marker by Garmin's class, so a boundary score sits on its gap in its own class's colour", () => {
		// 215 is Intermediate, on the Intermediate/Trained edge: orange, not the light orange the band under it would give.
		const edge = economyDial({ score: 215, classification: "INTERMEDIATE" });
		assert.deepEqual([edge.angle, edge.gauge.tone], [-40.91, "orange"]);
		assert.deepEqual([economyDial({ score: 225, classification: "RECREATIONAL" }).angle, economyDial({ score: 225, classification: "RECREATIONAL" }).gauge.tone], [-95.45, "red"]);
		// A word this build doesn't know: the score's class.
		assert.equal(economyDial({ score: 200, classification: "NEW_CLASS" }).gauge.tone, "green");
		assert.equal(economyDial({ score: 200 }).gauge.tone, "green");
	});

	it("draws the bands alone and \"--\" without a reading", () => {
		const dial = economyDial(undefined);
		assert.deepEqual([dial.gauge.value, dial.gauge.at, dial.gauge.tone, dial.angle], [DASH, undefined, undefined, undefined]);
		assert.equal(dialGeometry("economy", dial.gauge).marker, undefined);
		assert.equal(dialGeometry("economy", dial.gauge).bands.length, 7);
	});
});

describe("Current", () => {
	const v = view("1d");

	it("Monday, Sep 28 · 224 · Intermediate and its copy: the newest reading, 13 days back", () => {
		const c = v.current!;
		assert.deepEqual([c.date, c.label, c.dial.gauge.value, c.heading], ["2026-09-28", "Monday, Sep 28", "224", "Intermediate"]);
		assert.equal(c.copy, INTERMEDIATE_COPY);
		assert.equal(ECONOMY_COPY.INTERMEDIATE, INTERMEDIATE_COPY);
		assert.equal(c.steps, undefined);
		// No line inside the dial: the class is under it.
		assert.equal(c.dial.gauge.label, undefined);
		assert.deepEqual([c.dial.angle, c.dial.gauge.tone], [-90, "orange"]);
	});

	it("is not a stepper: no period row, no '<', no chart, and the offset changes nothing", () => {
		assert.deepEqual([v.label, v.canGoBack, v.chart, v.figures, v.title, v.empty], [null, false, null, [], undefined, undefined]);
		assert.deepEqual(view("1d", { offset: -3 }).current, v.current);
	});

	it("reproduces runningeconomy/latest/{date} from the index: the newest reading on or before the day, none before the first", () => {
		for (const [date, latest] of Object.entries(LATEST)) {
			const reading = currentReading(ROWS, null, date);
			if (latest === null) assert.equal(reading, undefined, date);
			else assert.deepEqual(reading, { date: latest.calendarDate, score: latest.score, classification: latest.classification }, date);
		}
	});

	it("reads the account's reading while the index has none, and whichever is newer once it does", () => {
		const fallback = view("1d", { rows: [], ctx: { account: ACCOUNT } }).current!;
		assert.deepEqual([fallback.label, fallback.dial.gauge.value, fallback.heading], ["Monday, Sep 28", "224", "Intermediate"]);
		// An account newer than the index (the fitness group off since): the account's.
		const newer = view("1d", { ctx: { account: { runningEconomy: { date: "2026-10-10", score: 222, classification: "INTERMEDIATE" } } } }).current!;
		assert.deepEqual([newer.label, newer.dial.gauge.value], ["Saturday, Oct 10", "222"]);
		// An older one: the index's.
		const older = view("1d", { ctx: { account: { runningEconomy: { date: "2026-09-27", score: 223, classification: "INTERMEDIATE" } } } }).current!;
		assert.deepEqual([older.label, older.dial.gauge.value], ["Monday, Sep 28", "224"]);
		// An account file without the day: the number, no date line.
		const undated = view("1d", { rows: [], ctx: { account: { runningEconomy: { score: 224, classification: "INTERMEDIATE" } } } }).current!;
		assert.deepEqual([undated.label, undated.dial.gauge.value, undated.date], [null, "224", undefined]);
	});

	it("says Today on the day of a reading (Inferred, as VO₂ Max)", () => {
		const today = view("1d", { rows: [...ROWS, { date: TODAY, score: 223, classification: "INTERMEDIATE" }] }).current!;
		assert.deepEqual([today.label, today.dial.gauge.value], ["Today", "223"]);
		// A row past today (another clock) is not Current.
		const ahead = view("1d", { rows: [...ROWS, { date: "2026-10-12", score: 223, classification: "INTERMEDIATE" }] }).current!;
		assert.equal(ahead.label, "Monday, Sep 28");
	});

	it("names the class from Garmin's word, without copy where it is unknown", () => {
		const c = economyCurrent({ date: "2026-09-28", score: 200, classification: "WELL_TRAINED" }, TODAY);
		assert.deepEqual([c.heading, c.copy, c.dial.gauge.tone], ["Well-Trained", undefined, "green"]);
	});

	it("without any reading: the bands, \"--\", and the help's Getting an Estimate (Inferred)", () => {
		const c = view("1d", { rows: [], ctx: { account: null } }).current!;
		assert.deepEqual([c.label, c.date, c.dial.gauge.value, c.dial.angle, c.heading, c.copy], [null, undefined, "--", undefined, "Getting an Estimate", ESTIMATE_INTRO]);
		assert.deepEqual(c.steps, [...ESTIMATE_STEPS]);
		assert.equal(c.steps!.length, 5);
		assert.equal(c.steps![0], "You must already have running VO₂ Max and lactate threshold estimates.");
	});
});

describe("4w: Sep 14 - Oct 11", () => {
	const v = view("4w");
	const chart = v.chart!;

	it("plots every reading at its day: 09-15 222 · 09-16 223 · 09-23 224 · 09-25 223 · 09-27 223 · 09-28 224", () => {
		assert.deepEqual([v.label, v.title, v.canGoBack, v.current, v.empty], ["Sep 14 - Oct 11", "Daily Values", true, null, undefined]);
		assert.deepEqual(points(chart), ["09-15 222", "09-16 223", "09-23 224", "09-25 223", "09-27 223", "09-28 224"]);
		assert.ok(chart.points.every((p) => p.date === p.day));
	});

	it("places the dots where the shot has them, 39 + d × 347/27, within 0.3 pt", () => {
		const shot = [51.72, 64.49, 154.43, 180.19, 205.81, 218.67];
		chart.points.forEach((p, i) => near(px(p.x), shot[i]!, 0.3, p.date));
		assert.equal(chart.points[0]!.x, 1 / 27);
	});

	it("Avg 223 (1339 / 6 = 223.17), Best 222", () => {
		assert.deepEqual(figures(v), ["223 Avg Running Economy", "222 Best Running Economy"]);
	});

	it("labels the gridlines 225 to 221, and a dot a day under the plot, the ends large and labelled 9-14 and 10-11", () => {
		assert.deepEqual(chart.ticks, [225, 224, 223, 222, 221]);
		assert.equal(chart.axis.dots.length, 28);
		assert.deepEqual(chart.axis.dots.filter((d) => d.large).map((d) => d.x), [0, 1]);
		near(px(chart.axis.dots[1]!.x) - px(chart.axis.dots[0]!.x), 12.85, 0.01);
		assert.deepEqual(chart.axis.labels, [{ x: 0, text: "9-14" }, { x: 1, text: "10-11" }]);
		assert.deepEqual(chart.axisSpan, { from: "2026-09-14", to: "2026-10-11" });
	});

	it("draws orange Intermediate dots joined by one orange line, and a legend of that class with a dot", () => {
		assert.ok(chart.points.every((p) => p.tone === "orange" && p.classIndex === 1));
		assert.equal(chart.dots, true);
		assert.deepEqual(chart.legend, [{ name: "Intermediate", tone: "orange" }]);
		// One class: the line in one colour, unclipped.
		assert.deepEqual(chart.zones, [{ classIndex: 1, tone: "orange", above: null, below: null }]);
	});
});

describe("12w: Jul 20 - Oct 11", () => {
	const v = view("12w");
	const chart = v.chart!;

	it("plots each 7-day block's lowest at its first day: 07-27 221 · 09-14 222 · 09-21 223 · 09-28 224", () => {
		assert.deepEqual([v.label, v.title], ["Jul 20 - Oct 11", "Weekly Averages"]);
		assert.deepEqual(points(chart), ["07-27 221", "09-14 222", "09-21 223", "09-28 224"]);
		// Each from the day of its block's lowest (the first, on a tie): the Jul 27 block holds 07-27 and 07-30, both 221; the Sep 21 block 224, 223 and 223.
		assert.deepEqual(chart.points.map((p) => p.date.slice(5)), ["07-27", "09-15", "09-25", "09-28"]);
	});

	it("places the dots at their blocks' first days, 39 + d × 347/83, within 0.3 pt", () => {
		const shot = [68.0, 272.88, 302.28, 331.46];
		chart.points.forEach((p, i) => near(px(p.x), shot[i]!, 0.3, p.day));
	});

	it("Avg 223 (the points' 890 / 4 = 222.5, rounded half up), Best 221", () => {
		assert.deepEqual(figures(v), ["223 Avg Running Economy", "221 Best Running Economy"]);
		// The days' mean, 222.625, also rounds to 223; floor of the points' would say 222.
		assert.equal(Math.floor(890 / 4), 222);
	});

	it("labels the gridlines 224 to 220; 13 axis dots, each block's first day and the last day, the ends large: 7-20, 10-11", () => {
		assert.deepEqual(chart.ticks, [224, 223, 222, 221, 220]);
		assert.equal(chart.axis.dots.length, 13);
		assert.deepEqual(chart.axis.dots.map((d) => d.large), [true, ...Array(11).fill(false), true]);
		near(px(chart.axis.dots[1]!.x) - px(chart.axis.dots[0]!.x), 29.27, 0.01);
		assert.equal(px(chart.axis.dots[12]!.x), 386);
		assert.deepEqual(chart.axis.labels.map((l) => l.text), ["7-20", "10-11"]);
		assert.deepEqual([chart.dots, chart.legend], [true, [{ name: "Intermediate", tone: "orange" }]]);
	});
});

describe("1y: Oct 13, 2025 - Oct 11, 2026", () => {
	const v = view("1y");
	const chart = v.chart!;
	const SPEC_POINTS = [
		"10-13 214", "10-20 215", "10-27 215", "11-03 215", "11-10 215", "11-17 215", "11-24 215", "12-01 215", "12-08 215",
		"01-12 214", "03-16 215", "03-23 216", "03-30 217", "04-06 217", "04-13 217", "04-20 217", "04-27 218", "05-04 218",
		"05-11 218", "05-18 218", "05-25 218", "06-01 219", "06-15 220", "06-29 220", "07-13 220", "07-27 221", "09-14 222",
		"09-21 223", "09-28 224",
	];

	it("draws the 29 Monday blocks' lowest scores, the spec's points", () => {
		assert.deepEqual([v.label, v.title], ["Oct 13, 2025 - Oct 11, 2026", "Weekly Averages"]);
		assert.deepEqual(points(chart), SPEC_POINTS);
		assert.equal(chart.points.reduce((sum, p) => sum + p.value, 0), 6306);
	});

	it("Avg 217 (6306 / 29 = 217.45), Best 214", () => {
		assert.deepEqual(figures(v), ["217 Avg Running Economy", "214 Best Running Economy"]);
	});

	it("labels the gridlines 230 to 210: steps of 1 and 2 can't reach 224 from below 214", () => {
		assert.deepEqual(chart.ticks, [230, 225, 220, 215, 210]);
	});

	it("runs a day axis from Oct 1, 2025 to Oct 1, 2026: the points at their blocks' first days, a dot and a name at each month start", () => {
		assert.deepEqual(chart.axisSpan, { from: "2025-10-01", to: "2026-10-01" });
		// The line's ends: Oct 13 at x 50.4, Sep 28 at 383.2 (0.9507 pt a day).
		near(px(chart.points[0]!.x), 50.4, 0.1, "first");
		near(px(chart.points.at(-1)!.x), 383.2, 0.1, "last");
		const shot = [39.17, 68.67, 97.17, 126.67, 156.0, 182.67, 212.17, 240.67, 270.17, 298.5, 328.17, 357.67, 386.17];
		assert.equal(chart.axis.dots.length, 13);
		chart.axis.dots.forEach((d, i) => near(px(d.x), shot[i]!, 0.3, `month ${i}`));
		assert.ok(chart.axis.dots.every((d) => d.large));
		assert.deepEqual(chart.axis.labels.map((l) => l.text), ["Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct"]);
		assert.ok(chart.axis.labels.every((l) => l.rotated === true));
	});

	it("is a line without dots, light orange below 214.5 around Oct 13 and Jan 12, orange elsewhere; its legend Intermediate then Trained", () => {
		assert.equal(chart.dots, false);
		assert.deepEqual(chart.legend, [
			{ name: "Intermediate", tone: "orange" },
			{ name: "Trained", tone: "yellow" },
		]);
		// The line in two bands: orange down to 214.5, light orange below it, where Oct 13's and Jan 12's 214 take it.
		assert.deepEqual(chart.zones, [
			{ classIndex: 1, tone: "orange", above: null, below: 214.5 },
			{ classIndex: 2, tone: "yellow", above: 214.5, below: null },
		]);
		assert.deepEqual(
			chart.points.filter((p) => p.tone === "yellow").map((p) => p.day),
			["2025-10-13", "2026-01-12"],
		);
	});
});

describe("blocks: Garmin's weekly route, computed", () => {
	const blocksOf = (from: string, to: string) =>
		economyBlocks(ROWS, { from, to })
			.map((b) => `${b.day}=${b.value}${economyClassIndex(b.value) === 2 ? "T" : ""}`)
			.join(" ");

	it("equals every weekly payload seen: 124 of 124 blocks, in five alignments and four single-day or short windows", () => {
		let scored = 0;
		for (const [from, to, rows, blocks, source] of WEEKLY) {
			assert.equal(blocksOf(from, to), blocks, source);
			scored += blocks ? blocks.split(" ").length : 0;
			// Garmin's rows: a block every 7 days from startDate when the window holds a reading, else none.
			const count = ROWS.some((r) => r.date >= from && r.date <= to) ? Math.ceil(daysOf({ from, to }).length / 7) : 0;
			assert.equal(count, rows, source);
		}
		assert.equal(scored, 124);
	});

	it("takes a block's lowest, not its mean: Sat 2026-03-28 → 04-03 holds 216, 217 and 218 and gives 216", () => {
		assert.equal(blocksOf("2026-03-28", "2026-04-03"), "2026-03-28=216");
		const days = ROWS.filter((r) => r.date >= "2026-03-28" && r.date <= "2026-04-03").map((r) => r.score!);
		assert.deepEqual(days, [216, 217, 218]);
		assert.equal(days.reduce((a, b) => a + b, 0) / days.length, 217);
	});

	it("is where floor(mean) fails, the only block it does, in both payloads that hold it", () => {
		const misses: string[] = [];
		for (const [from, to, , blocks] of WEEKLY) {
			for (const item of blocks ? blocks.split(" ") : []) {
				const [day, value] = item.split("=");
				const end = daysBetween(day!, to) < 6 ? to : daysOf({ from: day!, to }).slice(0, 7).at(-1)!;
				const scores = ROWS.filter((r) => r.date >= day! && r.date <= end).map((r) => r.score!);
				const floor = Math.floor(scores.reduce((a, b) => a + b, 0) / scores.length);
				if (floor !== parseInt(value!, 10)) misses.push(`${from} ${day}`);
			}
		}
		assert.deepEqual(misses, ["2025-10-11 2026-03-28", "2026-03-28 2026-03-28"]);
	});

	it("counts only readings up to the window's end: Sep 14 → 24 clips its second block to Sep 21–24, Sep 23's 224", () => {
		assert.equal(blocksOf("2026-09-14", "2026-09-24"), "2026-09-14=222 2026-09-21=224");
	});
});

describe("the web's periods", () => {
	it("1 Year (Oct 12, 2025 - Oct 11, 2026, Sunday blocks): 30 points, Avg 217 (217.43), Best 214, Intermediate and Trained", () => {
		const chart = economyChart("1y", ROWS, { from: "2025-10-12", to: "2026-10-11" })!;
		assert.equal(chart.points.length, 30);
		assert.equal(Math.round((chart.points.reduce((s, p) => s + p.value, 0) / 30) * 100) / 100, 217.43);
		assert.deepEqual(
			runningEconomyFigures(chart),
			["217 Avg Running Economy", "214 Best Running Economy"],
		);
		assert.deepEqual(chart.legend.map((l) => l.name), ["Intermediate", "Trained"]);
	});

	it("1 Year −1 (Oct 12, 2024 - Oct 11, 2025, Saturday blocks): 213 213 214 214 214 214 214, Avg 214, Best 213, Trained only", () => {
		const chart = economyChart("1y", ROWS, { from: "2024-10-12", to: "2025-10-11" })!;
		assert.deepEqual(chart.points.map((p) => p.value), [213, 213, 214, 214, 214, 214, 214]);
		assert.deepEqual(runningEconomyFigures(chart), ["214 Avg Running Economy", "213 Best Running Economy"]);
		// The three Intermediate days (215) never make a block's lowest.
		assert.deepEqual(chart.legend, [{ name: "Trained", tone: "yellow" }]);
		assert.equal(ROWS.filter((r) => r.date <= "2025-10-11" && r.score === 215).length, 3);
	});
});

describe("previous periods (Inferred)", () => {
	it("4w −1, Aug 17 - Sep 13: no reading, the web's line in the chart's place, no title, legend or figures", () => {
		const v = view("4w", { offset: -1 });
		assert.deepEqual([v.label, v.chart, v.empty, v.title, v.figures, v.canGoBack], ["Aug 17 - Sep 13", null, NO_DATA, undefined, [], true]);
		assert.equal(NO_DATA, "You have no data for this time period.");
	});

	it("4w −2, Jul 20 - Aug 16: 07-27 221 · 07-30 221, Avg 221, Best 221, 224 to 220", () => {
		const v = view("4w", { offset: -2 });
		assert.deepEqual([v.label, points(v.chart)], ["Jul 20 - Aug 16", ["07-27 221", "07-30 221"]]);
		assert.deepEqual(figures(v), ["221 Avg Running Economy", "221 Best Running Economy"]);
		assert.deepEqual(v.chart!.ticks, [224, 223, 222, 221, 220]);
	});

	it("12w −1, Apr 27 - Jul 19 (the web's 12 Weeks −1): 218 ×5 · 219 · 220 ×3, Avg 219 (218.78), Best 218, 221 to 217", () => {
		const v = view("12w", { offset: -1 });
		assert.equal(v.label, "Apr 27 - Jul 19");
		assert.deepEqual(points(v.chart), ["04-27 218", "05-04 218", "05-11 218", "05-18 218", "05-25 218", "06-01 219", "06-15 220", "06-29 220", "07-13 220"]);
		assert.deepEqual(figures(v), ["219 Avg Running Economy", "218 Best Running Economy"]);
		assert.deepEqual(v.chart!.ticks, [221, 220, 219, 218, 217]);
		assert.deepEqual(v.chart!.axis.labels.map((l) => l.text), ["4-27", "7-19"]);
		assert.deepEqual(v.chart!.legend.map((l) => l.name), ["Intermediate"]);
	});

	it("12w −4, Aug 18 - Nov 9, 2025: 213 · 214 ×7 · 215 ×3, Avg 214, Best 213, 216 to 212, both classes, worse first", () => {
		const v = view("12w", { offset: -4 });
		assert.equal(v.label, "Aug 18-Nov 9, 2025");
		assert.deepEqual(v.chart!.points.map((p) => p.value), [213, 214, 214, 214, 214, 214, 214, 214, 215, 215, 215]);
		assert.deepEqual(figures(v), ["214 Avg Running Economy", "213 Best Running Economy"]);
		assert.deepEqual(v.chart!.ticks, [216, 215, 214, 213, 212]);
		assert.deepEqual(v.chart!.legend.map((l) => l.name), ["Intermediate", "Trained"]);
		assert.deepEqual(v.chart!.points.map((p) => p.tone), [...Array(8).fill("yellow"), ...Array(3).fill("orange")]);
		assert.deepEqual(v.chart!.zones.map((z) => [z.tone, z.above, z.below]), [["orange", null, 214.5], ["yellow", 214.5, null]]);
	});

	it("12w −5, May 26 - Aug 17, 2025: a lone point, the Aug 11 block's 213, which is Avg and Best (the days' mean would say 214)", () => {
		const v = view("12w", { offset: -5 });
		assert.deepEqual(points(v.chart), ["08-11 213"]);
		assert.deepEqual(figures(v), ["213 Avg Running Economy", "213 Best Running Economy"]);
		assert.deepEqual(v.chart!.zones, [{ classIndex: 2, tone: "yellow", above: null, below: null }]);
		assert.deepEqual(v.chart!.ticks, [216, 215, 214, 213, 212]);
	});

	it("1y −1, Oct 14, 2024 - Oct 12, 2025: 8 Monday blocks from Aug 11, Avg 214, Best 213, 216 to 212, Trained, the axis Oct 1 → Oct 1", () => {
		const v = view("1y", { offset: -1 });
		assert.equal(v.label, "Oct 14, 2024 - Oct 12, 2025");
		assert.deepEqual(points(v.chart), ["08-11 213", "08-18 213", "08-25 214", "09-01 214", "09-08 214", "09-15 214", "09-29 214", "10-06 214"]);
		assert.deepEqual(figures(v), ["214 Avg Running Economy", "213 Best Running Economy"]);
		assert.deepEqual(v.chart!.ticks, [216, 215, 214, 213, 212]);
		assert.deepEqual(v.chart!.legend, [{ name: "Trained", tone: "yellow" }]);
		assert.deepEqual(v.chart!.axisSpan, { from: "2024-10-01", to: "2025-10-01" });
		// The history starts inside it: "<" stops once the index is complete.
		assert.equal(v.canGoBack, false);
		assert.equal(view("1y", { offset: -1, ctx: { complete: false } }).canGoBack, true);
	});

	it("goes back while older readings exist, or may", () => {
		assert.equal(view("4w", { offset: -14 }).canGoBack, true);
		// 4w −15 holds the first reading: nothing older.
		assert.deepEqual([view("4w", { offset: -15 }).label, points(view("4w", { offset: -15 }).chart), view("4w", { offset: -15 }).canGoBack], ["Jul 21-Aug 17, 2025", ["08-16 214", "08-17 213"], false]);
		assert.equal(view("4w", { rows: [] }).canGoBack, false);
		assert.equal(view("4w", { rows: [], ctx: { complete: false } }).canGoBack, true);
	});

	it("an empty index shows the empty line on every range", () => {
		for (const range of ["4w", "12w", "1y"] as const) {
			const v = view(range, { rows: [] });
			assert.deepEqual([v.chart, v.empty, v.figures, v.title], [null, NO_DATA, [], undefined], range);
		}
	});
});

describe("the y axis", () => {
	it("steps 1, 2, 5, 10 …: the smallest whose five lines reach the highest point from below the lowest", () => {
		assert.deepEqual(economyTicks([222, 224]), [225, 224, 223, 222, 221]);
		assert.deepEqual(economyTicks([221, 224]), [224, 223, 222, 221, 220]);
		assert.deepEqual(economyTicks([214, 224]), [230, 225, 220, 215, 210]);
		// A step of 2 (unseen): a spread of 4 to 7.
		assert.deepEqual(economyTicks([218, 222]), [224, 222, 220, 218, 216]);
		assert.deepEqual(economyTicks([217, 222]), [224, 222, 220, 218, 216]);
		// Wider spreads (unseen): 10, then 20.
		assert.deepEqual(economyTicks([205, 224]), [240, 230, 220, 210, 200]);
		assert.deepEqual(economyTicks([190, 224]), [260, 240, 220, 200, 180]);
		assert.deepEqual(economyTicks([]), []);
	});
});

describe("the line's colours", () => {
	it("band every class the line passes through, worse first, the outer bands open", () => {
		const zones = economyZones([226, 203]);
		assert.deepEqual(
			zones.map((z) => [z.tone, z.above, z.below]),
			[
				["red", null, 224.5],
				["orange", 224.5, 214.5],
				["yellow", 214.5, 204.5],
				["green", 204.5, null],
			],
		);
	});

	it("keep one open band for a line inside one class, or a lone point", () => {
		assert.deepEqual(economyZones([222, 224, 215]), [{ classIndex: 1, tone: "orange", above: null, below: null }]);
		assert.deepEqual(economyZones([180]), [{ classIndex: 6, tone: "pink", above: null, below: null }]);
		assert.deepEqual(economyZones([]), []);
	});
});

describe("words", () => {
	it("title 4w Daily Values, 12w and 1y Weekly Averages; axis ends M-dd", () => {
		assert.deepEqual(ECONOMY_TITLES, { "4w": "Daily Values", "12w": "Weekly Averages", "1y": "Weekly Averages" });
		assert.deepEqual(["2026-09-14", "2026-10-11", "2026-07-20", "2025-08-03"].map(economyAxisDay), ["9-14", "10-11", "7-20", "8-03"]);
	});
});
