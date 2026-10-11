import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { vo2Scale } from "../src/dashboard/gauges";
import { performanceStatRoute } from "../src/dashboard/routes";
import type { DayRow } from "../src/dashboard/series";
import {
	FITNESS_AGE_LINK,
	NO_DATA,
	NO_READING,
	VO2_TABS,
	blockReadings,
	markerAngle,
	readingLabel,
	readingsOf,
	topPercent,
	vo2DialGauge,
	vo2MaxView,
	vo2Person,
	vo2Ticks,
	type Vo2MaxContext,
	type Vo2MaxView,
} from "../src/dashboard/vo2-max-pages";
import type { Vo2MaxRow } from "../src/sync/vo2-max-index";

/**
 * Golden numbers from ref/performance-stats/vo2-max/README.md: the phone shots
 * of Sunday 2026-10-11 21:11–21:14, the web report of 22:52, and the whole
 * history as `maxmet/daily` sent it at 23:19
 * (api-samples/probe-daily-3660-2016-10-14_2026-10-11.json). The 4w / 12w / 6m
 * windows roll daily, so they only reproduce with today pinned.
 */
const TODAY = "2026-10-11";

/**
 * Every running reading, `day=precise`, with Garmin's integer after a slash
 * where it is not the precise value rounded half up (the six x.5 days).
 */
const RUNNING = [
	"2025-08: 03=52.9 05=54.4 06=54.3 07=54.6 08=54.6 11=54.1 15=53.6 16=53.4 17=53.6 19=52.8 21=54.6 22=54.6 23=54.7 25=54.9 26=54.9 27=54.9 28=55.8 31=55",
	"2025-09: 01=55.6 02=55.7 03=55.7 05=55.5/55 06=55.9 07=55.9 08=55.8 09=55.8 12=56.2 13=56.2 16=56.1 18=56.3 21=55 25=55.7 26=56.1 29=56.2",
	"2025-10: 01=56 04=56.4 05=56.4 08=56.9 09=56.7 12=56.2 13=56.2 15=56.1 16=56.1 17=56.1 18=56.5/56 22=56.6 25=56.7 29=57.1",
	"2025-11: 01=56.7 03=56.8 04=56.8 05=56.9 09=56.9 10=56.7 15=56.4 16=56.4 19=56.6 21=56.9 23=57 25=57",
	"2025-12: 02=57 07=57.6 13=57.7 28=57.7",
	"2026-01: 01=57.6 15=56.1 16=56.9 23=56.3 24=56.3 26=56.2 28=55.9 30=56.1",
	"2026-02: 03=56.4 07=56.7 10=57 13=56.6 14=55.8 17=55.8 21=55.3",
	"2026-03: 08=54.4 09=54.7 12=54.9 17=55.3 18=55.1 22=55.2 24=55.3 27=55.1 28=55.1 30=55.1 31=55",
	"2026-04: 04=55.2 06=54.9 08=54.9 10=55.1 12=55.2 16=55.3 18=55.4 19=55.2 22=55.6 23=55.5 24=55.4 25=55.5/55 26=55.3 28=55.3",
	"2026-05: 01=56 02=55.9 03=56.2 07=56.2 08=56.1 10=56.2 12=55.9 17=55.6 21=55.6 24=55.6 28=56.1 30=55.4 31=55",
	"2026-06: 01=55.4 07=55 08=54.5/54 13=54.2 15=54 17=53.8 19=54.4 26=54.1 29=54.7 30=54.6",
	"2026-07: 02=55.8 11=55.6 18=55.6 27=55.3 30=55.1",
	"2026-08: 01=55.1 07=54.9 08=54.8 09=55.1 10=55.1 16=54.5/54 23=53.8 24=53.9 29=53.7 30=53.8 31=53.8",
	"2026-09: 03=53.6 05=54.2 07=54 09=55.1 12=55.5/55 15=55.1 16=54.9 19=55.3 23=54.7 25=55 27=55.1 28=54.8",
	"2026-10: 03=54.9 10=54.8 11=54.9",
];
/** Every cycling reading: ten, all in 2025. */
const CYCLING = ["2025-09: 01=55.9 06=56.4 10=56.5/56 13=56.6 15=57 27=57", "2025-10: 01=56.9 04=57.3 13=57.5/57 15=57.4"];

function rowsOf(running: readonly string[], cycling: readonly string[]): Vo2MaxRow[] {
	const byDate = new Map<string, Vo2MaxRow>();
	const add = (lines: readonly string[], precise: "vo2" | "cycling", integer: "vo2Value" | "cyclingValue") => {
		for (const line of lines) {
			const [month, days] = line.split(": ");
			for (const item of days!.split(" ")) {
				const [day, value] = item.split("=");
				const [v, i] = value!.split("/").map(Number);
				const date = `${month}-${day}`;
				const row = byDate.get(date) ?? { date };
				row[precise] = v!;
				row[integer] = i ?? Math.round(v!);
				byDate.set(date, row);
			}
		}
	};
	add(running, "vo2", "vo2Value");
	add(cycling, "cycling", "cyclingValue");
	return [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
}

const ROWS = rowsOf(RUNNING, CYCLING);
/** A man of 23 (`chronological_age` in the day files, `sex` in account.json). */
const CTX: Vo2MaxContext = { today: TODAY, complete: true, age: 23, sex: "male" };

const view = (range: "1d" | "4w" | "12w" | "6m", opts: { offset?: number; tab?: string; rows?: readonly Vo2MaxRow[]; ctx?: Partial<Vo2MaxContext> } = {}): Vo2MaxView =>
	vo2MaxView({ range, offset: opts.offset ?? 0, tab: opts.tab }, opts.rows ?? ROWS, { ...CTX, ...opts.ctx });

const dots = (v: Vo2MaxView) => v.chart!.points.map((p) => `${p.date.slice(5)} ${p.value.toFixed(1)}`);
/** A point's day in its period, as the shots were read: 0 on the first day. */
const dayIn = (x: number, days: number) => Math.round(x * (days - 1) * 1000) / 1000;

/** Chart values read off the shots (vo2-chart.py): the dot's day in the period, and its value on the gridlines. */
const SHOT_4W: Array<[number, number]> = [[1, 55.1], [2, 54.9], [5, 55.299], [9, 54.701], [11, 55.0], [13, 55.099], [14, 54.801], [19, 54.9], [26, 54.8], [27, 54.9]];
const SHOT_12W: Array<[number, number]> = [[12, 55.1], [20, 55.1], [27, 54.499], [34, 53.802], [41, 53.8], [47, 54.201], [54, 55.498], [61, 55.3], [69, 55.1], [75, 54.9], [83, 54.9]];
const SHOT_6M: Array<[number, number]> = [
	[6, 55.2], [13, 55.3], [20, 56.2], [27, 56.199], [34, 55.601], [41, 55.599], [48, 55.001], [55, 55.0], [61, 54.2], [67, 54.398], [74, 54.1], [80, 55.8], [89, 55.6],
	[96, 55.599], [110, 55.101], [118, 55.098], [125, 54.5], [132, 53.801], [139, 53.801], [145, 54.199], [152, 55.499], [159, 55.3], [167, 55.1], [173, 54.9], [181, 54.899],
];

function matchesShot(v: Vo2MaxView, shot: ReadonlyArray<[number, number]>, days: number) {
	const points = v.chart!.points;
	assert.equal(points.length, shot.length);
	points.forEach((p, i) => {
		const [day, value] = shot[i]!;
		assert.equal(dayIn(p.x, days), day, `${p.date} on day ${dayIn(p.x, days)}, not ${day}`);
		assert.ok(Math.abs(p.value - value) < 0.01, `${p.date}: ${p.value}, not ${value}`);
	});
}

/** The measured x of the axis' dots in the 12w and 6m shots, px, on a plot from 117 to 1157 px. */
function axisMatchesShot(v: Vo2MaxView, px: readonly number[]) {
	const at = v.chart!.axis.dots.map((d) => 117 + d.x * (1157 - 117));
	assert.equal(at.length, px.length);
	at.forEach((x, i) => assert.ok(Math.abs(x - px[i]!) <= 1.5, `dot ${i} at ${x.toFixed(1)} px, not ${px[i]}`));
}

const FITNESS_AGE = { page: "health-stat", stat: "fitness-age", range: "1d", offset: 0 };
const COPY = "Your VO₂ Max is in the top 10% for your age and gender.";
const CYCLING_COPY = "Your Cycling VO₂ Max is in the top 5% for your age and gender.";

describe("the fixture", () => {
	it("is the history Garmin sent: 161 days, 158 running readings and 10 cycling, from 2025-08-03", () => {
		assert.equal(ROWS.length, 161);
		assert.equal(readingsOf(ROWS, "running").length, 158);
		assert.equal(readingsOf(ROWS, "cycling").length, 10);
		assert.equal(ROWS[0]!.date, "2025-08-03");
	});
});

describe("Current, VO₂ Max tab", () => {
	const v = view("1d");

	it("Today · 55 · Excellent · top 10%, from Oct 11's 54.9 and Garmin's 55", () => {
		assert.equal(v.tab, "running");
		assert.equal(v.dial!.date, TODAY);
		assert.equal(v.dial!.label, "Today");
		assert.deepEqual([v.dial!.gauge.value, v.dial!.gauge.label, v.dial!.gauge.tone], ["55", "Excellent", "blue"]);
		assert.equal(v.copy, COPY);
		assert.deepEqual(v.link, { text: FITNESS_AGE_LINK, route: FITNESS_AGE });
		assert.equal(v.link.text, "View Your Fitness Age");
		assert.equal(v.empty, undefined);
	});

	it("has no period row and no stepper, and no chart", () => {
		assert.deepEqual([v.label, v.canGoBack, v.chart], [null, false, null]);
		// The route's offset is not a day: Current is the newest reading whatever it says.
		assert.equal(view("1d", { offset: -5 }).dial!.date, TODAY);
	});

	it("puts the marker where the spec's dial puts 54.9: 279.8° from the bottom, 3.2° short of the shot's 283.0°", () => {
		// No simple rule puts 54.9 at the measured 283.0° (Rules → Dial); the map's own place is the golden number.
		assert.ok(Math.abs(v.dial!.angle! - 279.8) < 0.05, `at ${v.dial!.angle}`);
		assert.ok(Math.abs(v.dial!.angle! - 283.0) < 3.5);
		// Inside Excellent's arc, short of the blue/purple gap at 285.1°.
		assert.ok(v.dial!.angle! > 240.1 && v.dial!.angle! < 285.1);
	});
});

describe("Current, Cycling tab", () => {
	const v = view("1d", { tab: "cycling" });

	it("Wednesday, Oct 15 · 57 · Superior · top 5%: the newest ride's reading, a year old, without its year", () => {
		assert.equal(v.tab, "cycling");
		assert.equal(v.dial!.date, "2025-10-15");
		assert.equal(v.dial!.label, "Wednesday, Oct 15");
		assert.deepEqual([v.dial!.gauge.value, v.dial!.gauge.label, v.dial!.gauge.tone], ["57", "Superior", "purple"]);
		assert.equal(v.copy, CYCLING_COPY);
		assert.deepEqual(v.link.route, FITNESS_AGE);
	});

	it("puts the marker within 0.5° of the shot's 296.2°, a quarter into Superior", () => {
		assert.ok(Math.abs(v.dial!.angle! - 296.2) < 0.5, `at ${v.dial!.angle}`);
		assert.ok(Math.abs(v.dial!.gauge.at! - 0.8875) < 1e-9);
	});
});

describe("the dial's arc", () => {
	it("splits 300° at the measured gaps: 150.0°, 195.1°, 240.1° and 285.1°", () => {
		const bounds = view("1d").dial!.gauge.segments.slice(1).map((s) => markerAngle(s.from));
		[150.0, 195.1, 240.1, 285.1].forEach((measured, i) => assert.ok(Math.abs(bounds[i]! - measured) < 0.5, `gap ${i} at ${bounds[i]}`));
		assert.deepEqual([markerAngle(0), markerAngle(1)], [30, 330]);
	});

	it("runs from Fair − 12 to Superior + 8 for a man of 20–29, float for float the web gauge's 'Data ranges from 29.700000000000003 to 63.4'", () => {
		const scale = vo2Scale(23, "male")!;
		assert.deepEqual(scale, [29.700000000000003, 41.7, 45.4, 51.1, 55.4, 63.4]);
		assert.equal(`Data ranges from ${scale[0]} to ${scale[5]}`, "Data ranges from 29.700000000000003 to 63.4");
		// The web's own dial is linear between those ends on a 270° arc: 246.9° for 54.9, 266.9° for 57.4.
		const web = (value: number) => 45 + ((value - scale[0]!) / (scale[5]! - scale[0]!)) * 270;
		assert.deepEqual([web(54.9).toFixed(1), web(57.4).toFixed(1)], ["246.9", "266.9"]);
	});
});

describe("4w, Sep 14 – Oct 11", () => {
	const v = view("4w");

	it("plots every reading at its day: 10 dots", () => {
		assert.equal(v.label, "Sep 14 - Oct 11");
		assert.deepEqual(dots(v), ["09-15 55.1", "09-16 54.9", "09-19 55.3", "09-23 54.7", "09-25 55.0", "09-27 55.1", "09-28 54.8", "10-03 54.9", "10-10 54.8", "10-11 54.9"]);
		matchesShot(v, SHOT_4W, 28);
	});

	it("labels 58 to 54, and a dot a day under the plot with the ends large: 09-14, 10-11", () => {
		assert.deepEqual(v.chart!.ticks, [58, 57, 56, 55, 54]);
		const axis = v.chart!.axis;
		assert.equal(axis.dots.length, 28);
		assert.deepEqual(axis.dots.flatMap((d, i) => (d.large ? [i] : [])), [0, 27]);
		assert.deepEqual(axis.labels, [{ x: 0, text: "09-14" }, { x: 1, text: "10-11" }]);
		// Nothing comes in from before the period: Sep 12's reading is not a dot.
		assert.equal(v.chart!.points[0]!.date, "2026-09-15");
	});

	it("keeps the running copy and the link under the chart, and can step back", () => {
		assert.equal(v.copy, COPY);
		assert.deepEqual(v.link.route, FITNESS_AGE);
		assert.equal(v.canGoBack, true);
	});
});

describe("12w, Jul 20 – Oct 11", () => {
	const v = view("12w");

	it("plots each 7-day block's last reading from Jul 20, at its own day: 11 dots, none for Jul 20–26", () => {
		assert.equal(v.label, "Jul 20 - Oct 11");
		assert.deepEqual(dots(v), [
			"08-01 55.1", "08-09 55.1", "08-16 54.5", "08-23 53.8", "08-30 53.8", "09-05 54.2", "09-12 55.5", "09-19 55.3", "09-27 55.1", "10-03 54.9", "10-11 54.9",
		]);
		matchesShot(v, SHOT_12W, 84);
	});

	it("is not the block's highest (Aug 10–16 would be 55.1) nor Sunday weeks (Aug 8's 54.8 for Aug 9's 55.1)", () => {
		assert.ok(dots(v).includes("08-16 54.5"));
		assert.ok(dots(v).includes("08-09 55.1"));
	});

	it("labels 57 to 53; 13 axis dots, every 7 days and the last day, the ends large: 07-20, 10-11", () => {
		assert.deepEqual(v.chart!.ticks, [57, 56, 55, 54, 53]);
		const axis = v.chart!.axis;
		assert.deepEqual(axis.dots.map((d) => dayIn(d.x, 84)), [0, 7, 14, 21, 28, 35, 42, 49, 56, 63, 70, 77, 83]);
		assert.deepEqual(axis.dots.flatMap((d, i) => (d.large ? [i] : [])), [0, 12]);
		assert.deepEqual(axis.labels.map((l) => l.text), ["07-20", "10-11"]);
		axisMatchesShot(v, [117.0, 204.5, 292.0, 379.5, 467.5, 555.5, 643.0, 730.5, 818.5, 906.5, 994.0, 1081.5, 1157.0]);
		assert.equal(v.copy, COPY);
	});
});

describe("6m, Apr 13 – Oct 11", () => {
	const v = view("6m");

	it("plots 26 blocks' last readings: 25 dots, the line running 07-18 → 08-01 over the empty Jul 20–26", () => {
		assert.equal(v.label, "Apr 13 - Oct 11");
		assert.deepEqual(dots(v), [
			"04-19 55.2", "04-26 55.3", "05-03 56.2", "05-10 56.2", "05-17 55.6", "05-24 55.6", "05-31 55.0", "06-07 55.0", "06-13 54.2", "06-19 54.4", "06-26 54.1", "07-02 55.8", "07-11 55.6",
			"07-18 55.6", "08-01 55.1", "08-09 55.1", "08-16 54.5", "08-23 53.8", "08-30 53.8", "09-05 54.2", "09-12 55.5", "09-19 55.3", "09-27 55.1", "10-03 54.9", "10-11 54.9",
		]);
		matchesShot(v, SHOT_6M, 182);
	});

	it("labels 57 to 53; six axis dots every 36 days and the last, all large and labelled", () => {
		assert.deepEqual(v.chart!.ticks, [57, 56, 55, 54, 53]);
		const axis = v.chart!.axis;
		assert.deepEqual(axis.dots.map((d) => dayIn(d.x, 182)), [0, 36, 72, 108, 144, 181]);
		assert.ok(axis.dots.every((d) => d.large));
		// Evenly spaced fifths would read 07-31 and 09-05.
		assert.deepEqual(axis.labels.map((l) => l.text), ["04-13", "05-19", "06-24", "07-30", "09-04", "10-11"]);
		axisMatchesShot(v, [116.5, 323.5, 531.0, 738.0, 944.5, 1157.5]);
		assert.equal(v.copy, COPY);
	});
});

describe("Garmin's own aggregations are the same rule", () => {
	const running = readingsOf(ROWS, "running");
	const pick = (from: string, to: string) => blockReadings(running, { from, to }).map((r) => `${r.date.slice(5)} ${r.value.toFixed(1)}`);

	it("maxmet/weekly/2026-07-20/2026-10-11 is the 12w's dots", () => {
		assert.deepEqual(pick("2026-07-20", "2026-10-11"), dots(view("12w")));
	});

	it("maxmet/weekly/2026-07-21/2026-10-12 takes Tuesday blocks from its start", () => {
		assert.deepEqual(pick("2026-07-21", "2026-10-12"), [
			"07-27 55.3", "08-01 55.1", "08-10 55.1", "08-16 54.5", "08-24 53.9", "08-31 53.8", "09-07 54.0", "09-12 55.5", "09-19 55.3", "09-28 54.8", "10-03 54.9", "10-11 54.9",
		]);
	});

	it("the web's 4 Weeks, Sunday blocks from Sep 20: four points", () => {
		assert.deepEqual(pick("2026-09-20", "2026-10-11"), ["09-25 55.0", "10-03 54.9", "10-10 54.8", "10-11 54.9"]);
	});
});

describe("the Cycling tab's ranges (Inferred)", () => {
	it("say the web's no-data line where the chart goes, keeping the cycling copy and the link", () => {
		for (const [range, label] of [["4w", "Sep 14 - Oct 11"], ["12w", "Jul 20 - Oct 11"], ["6m", "Apr 13 - Oct 11"]] as const) {
			const v = view(range, { tab: "cycling" });
			assert.deepEqual([v.label, v.chart, v.empty, v.copy], [label, null, NO_DATA, CYCLING_COPY], range);
			assert.equal(v.empty, "You have no data for this time period.");
			assert.deepEqual(v.link.route, FITNESS_AGE);
		}
	});

	it("draw 6m −1's single ride, Oct 15 57.4, as a lone dot", () => {
		const v = view("6m", { tab: "cycling", offset: -1 });
		assert.equal(v.label, "Oct 13, 2025 - Apr 12, 2026");
		assert.deepEqual(dots(v), ["10-15 57.4"]);
		assert.deepEqual(v.chart!.ticks, [61, 60, 59, 58, 57]);
	});

	it("draw 6m −2's eight rides as five blocks' last ones (Apr 14 – Oct 12, 2025, Monday blocks)", () => {
		assert.deepEqual(dots(view("6m", { tab: "cycling", offset: -2 })), ["09-06 56.4", "09-13 56.6", "09-15 57.0", "09-27 57.0", "10-04 57.3"]);
	});
});

describe("previous periods (Inferred)", () => {
	it("are labelled by their spans", () => {
		assert.equal(view("4w", { offset: -1 }).label, "Aug 17 - Sep 13");
		assert.equal(view("12w", { offset: -1 }).label, "Apr 27 - Jul 19");
		assert.equal(view("6m", { offset: -1 }).label, "Oct 13, 2025 - Apr 12, 2026");
		assert.equal(view("6m", { offset: -2 }).label, "Apr 14-Oct 12, 2025");
	});

	it("keep the current class's copy under the chart", () => {
		assert.equal(view("12w", { offset: -1 }).copy, COPY);
	});

	it("step back until the index is whole and its oldest day is not before the period", () => {
		assert.equal(view("6m", { offset: -1 }).canGoBack, true);
		assert.equal(view("6m", { offset: -2 }).canGoBack, false);
		// While the history walk is still coming, older data may exist.
		assert.equal(view("6m", { offset: -2, ctx: { complete: false } }).canGoBack, true);
	});

	it("widen the y step past a spread of 4 rather than drop a dot: 6m −2, 52.9 to 56.4", () => {
		const v = view("6m", { offset: -2 });
		assert.equal(v.chart!.points.length, 11);
		assert.deepEqual(v.chart!.ticks, [60, 58, 56, 54, 52]);
	});
});

describe("rules", () => {
	it("show Garmin's integer on the dial, and grade the precise value: a day whose newest reading is Sep 12's 55.5 / 55", () => {
		const v = view("1d", { rows: ROWS.filter((r) => r.date <= "2026-09-12") });
		assert.equal(v.dial!.label, "Saturday, Sep 12");
		assert.deepEqual([v.dial!.gauge.value, v.dial!.gauge.label], ["55", "Superior"]);
		// 55.4, sent as 55, is Superior too: the class compares the precise value with >=.
		const scale = vo2Scale(23, "male");
		assert.deepEqual([vo2DialGauge({ value: 55.4, shown: 55 }, scale).label, vo2DialGauge({ value: 55.4, shown: 55 }, scale).value], ["Superior", "55"]);
		assert.equal(vo2DialGauge({ value: 55.39, shown: 55 }, scale).label, "Excellent");
	});

	it("read 'Today', else the weekday and the short date, with no year", () => {
		assert.equal(readingLabel(TODAY, TODAY), "Today");
		assert.equal(readingLabel("2026-10-10", TODAY), "Saturday, Oct 10");
		assert.equal(readingLabel("2025-10-15", TODAY), "Wednesday, Oct 15");
	});

	it("round the 'top' up to a multiple of 5 from the interpolated percentile: 54.9 → 93.3 → 10; 57.4 → 95 → 5", () => {
		const scale = vo2Scale(23, "male")!;
		assert.equal(topPercent(54.9, scale), 10);
		assert.equal(topPercent(57.4, scale), 5);
		// At a class's own limit the percentile is the class's: Excellent's 80 → "top 20%".
		assert.equal(topPercent(51.1, scale), 20);
		assert.equal(topPercent(48.25, scale), 30);
	});

	it("put the y axis' bottom on the lowest dot's floor, five whole numbers up", () => {
		assert.deepEqual(vo2Ticks([54.7, 55.3]), [58, 57, 56, 55, 54]);
		assert.deepEqual(vo2Ticks([53, 57]), [57, 56, 55, 54, 53]);
		assert.deepEqual(vo2Ticks([]), []);
	});

	it("take the newest age the day files hold and the account's sex", () => {
		const days: DayRow[] = [
			{ date: "2025-08-03", values: { chronological_age: 22 }, text: {} },
			{ date: "2026-10-10", values: { chronological_age: 23 }, text: {} },
			{ date: TODAY, values: { steps: 4000 }, text: {} },
		];
		assert.deepEqual(vo2Person(days, { sex: "male" }, TODAY), { age: 23, sex: "male" });
		assert.deepEqual(vo2Person([], null, TODAY), {});
	});

	it("open on the first tab, and keep the one the route names", () => {
		assert.deepEqual(VO2_TABS.map((t) => t.label), ["VO₂ Max", "Cycling"]);
		assert.equal(vo2MaxView(performanceStatRoute("vo2-max"), ROWS, CTX).tab, "running");
		assert.equal(vo2MaxView(performanceStatRoute("vo2-max", { tab: "cycling", range: "4w" }), ROWS, CTX).tab, "cycling");
		assert.equal(view("1d", { tab: "swimming" }).tab, "running");
	});
});

describe("without data", () => {
	it("Current without any reading: no dial, a no-data line, no copy, the link", () => {
		const v = view("1d", { tab: "cycling", rows: rowsOf(RUNNING, []) });
		assert.deepEqual([v.dial, v.empty, v.copy], [null, NO_READING, undefined]);
		assert.deepEqual(v.link.route, FITNESS_AGE);
		assert.deepEqual([view("1d", { rows: [] }).dial, view("4w", { rows: [] }).empty], [null, NO_DATA]);
	});

	it("without an age or a sex: the number, no class, no marker, no copy", () => {
		const v = view("1d", { ctx: { age: undefined } });
		assert.deepEqual([v.dial!.gauge.value, v.dial!.gauge.label, v.dial!.angle, v.copy], ["55", undefined, undefined, undefined]);
		assert.equal(view("1d", { ctx: { sex: undefined } }).dial!.gauge.at, undefined);
	});

	it("before the first sync: the index may hold more, so '<' stays", () => {
		assert.equal(view("4w", { rows: [], ctx: { complete: false } }).canGoBack, true);
		assert.equal(view("4w", { rows: [] }).canGoBack, false);
	});
});
