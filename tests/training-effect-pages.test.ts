import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { categoryOf } from "../src/dashboard/activities";
import { trainingEffectScales } from "../src/dashboard/activity-charts";
import { benefitMessage } from "../src/dashboard/activity-copy";
import { BENEFIT_COLOR } from "../src/dashboard/activity-labels";
import type { Span } from "../src/dashboard/periods";
import { PERFORMANCE_REGISTRY } from "../src/dashboard/performance-stats";
import { activityRoute, performanceStatRoute } from "../src/dashboard/routes";
import { PHONE as PHONE_WIDTH } from "../src/dashboard/stat-charts";
import { trainingEffectPlot } from "../src/dashboard/training-effect-charts";
import { BAND_TABLE, BAND_WORDS, DETAIL_HEADERS, SCALE_BAND_TITLES, TE_ABOUT, TE_HELP } from "../src/dashboard/training-effect-copy";
import {
	TE_TICKS,
	activityOfSub,
	activitySub,
	benefitLabel,
	cardRoute,
	dayMaxima,
	teBand,
	teChart,
	teSubtitle,
	teText,
	trainingEffectView,
	type TeChart,
	type TrainingEffectContext,
	type TrainingEffectDetailView,
	type TrainingEffectPeriodView,
	type TrainingEffectRoute,
} from "../src/dashboard/training-effect-pages";
import type { ActivityRow } from "../src/sync/activity-index";
import { ACTIVITIES, PHONE, TODAY, idAt } from "./training-effect-fixture";

/**
 * Golden numbers from ref/performance-stats/training-effect/README.md: the
 * phone shots of Sunday 2026-10-11 21:22, the web of 22:55–22:58 and the
 * payloads of 2026-10-12 12:26–12:41 — the spec's 45 checks
 * (golden-training-effect.py) that reach the page, with the shots' own
 * positions for the values the charts and scales draw. Every span rolls
 * daily, so they reproduce only with today pinned.
 */

const CTX: TrainingEffectContext = { today: TODAY, complete: true };

function view(range: "7d" | "4w", opts: { offset?: number; sub?: string; rows?: readonly ActivityRow[]; ctx?: Partial<TrainingEffectContext> } = {}) {
	const route: TrainingEffectRoute = { range, offset: opts.offset ?? 0, ...(opts.sub ? { sub: opts.sub } : {}) };
	return trainingEffectView(route, opts.rows ?? ACTIVITIES, { ...CTX, ...opts.ctx });
}
const period = (range: "7d" | "4w", opts: Parameters<typeof view>[1] = {}) => view(range, opts) as TrainingEffectPeriodView;
const detail = (id: number, opts: Parameters<typeof view>[1] = {}) => view("7d", { ...opts, sub: activitySub(id) }) as TrainingEffectDetailView;

const aerobic = (v: TrainingEffectPeriodView) => v.charts[0];
const anaerobic = (v: TrainingEffectPeriodView) => v.charts[1];
/** "10-11:4.5": a chart's bars as the spec lists them. */
const bars = (chart: TeChart) => chart.bars.map((b) => `${b.date.slice(5)}:${b.value.toFixed(1)}`);
const cards = (v: TrainingEffectPeriodView) => v.cards.map((c) => `${c.date} / ${c.subtitle}`);

const near = (actual: number, expected: number, tolerance: number, what: string) =>
	assert.ok(Math.abs(actual - expected) <= tolerance + 1e-9, `${what}: ${actual} vs ${expected} (±${tolerance})`);

/** A synthetic index row: a run on Oct 11 unless `r` says otherwise. */
const row = (r: Partial<ActivityRow>): ActivityRow => ({ id: 1, type: "running", typeId: 1, parentTypeId: 17, start: "2026-10-11T07:00:00", begin: Date.parse("2026-10-11T03:00:00Z"), ...r });

/** The run page's scales for a detail page, as the page draws them. */
const knobs = (v: TrainingEffectDetailView, width = PHONE_WIDTH) =>
	trainingEffectScales({ kind: "training-effect", id: "training-effect", title: "Training Effect", help: false, figures: [], scales: v.scales }, width).map((s) => s.knob);

describe("the fixture", () => {
	it("is the 31 listed activities of Aug 17 – Oct 11 as the index keeps them: training effect to a tenth, the local start", () => {
		assert.equal(ACTIVITIES.length, 31);
		assert.deepEqual([ACTIVITIES[0]!.start, ACTIVITIES[30]!.start], ["2026-10-11T08:21:37", "2026-08-22T12:00:27"]);
		const oct11 = ACTIVITIES[0]!;
		// 0.20000000298023224 → 0.2, 4.300000190734863 → 4.3: `rowOf` keeps a tenth, 0 included.
		assert.deepEqual([oct11.aerobic, oct11.anaerobic, oct11.benefit, oct11.aerobicMsg, oct11.load], [4.5, 0.2, "LACTATE_THRESHOLD", "HIGHLY_IMPROVING_LACTATE_THRESHOLD_13", 203.85]);
		assert.deepEqual([ACTIVITIES[1]!.aerobic, ACTIVITIES[1]!.anaerobic], [4.3, 0]);
		assert.ok(ACTIVITIES.every((r) => r.aerobic !== undefined && r.anaerobic !== undefined && r.benefit !== undefined));
		const swim = ACTIVITIES.find((r) => r.type === "lap_swimming")!;
		assert.deepEqual([swim.start, new Date(swim.begin).toISOString()], ["2026-09-14T23:50:17", "2026-09-14T20:50:17.000Z"]);
	});

	it("equals the spec's redacted fixture for Sep 14 – Oct 11, row for row", () => {
		const spec = [
			"10-11 08:21 running 4.5/0.2 LACTATE_THRESHOLD",
			"10-10 08:19 running 4.3/0.0 LACTATE_THRESHOLD",
			"10-03 14:59 running 4.1/0.0 LACTATE_THRESHOLD",
			"09-28 08:03 running 4.4/0.2 LACTATE_THRESHOLD",
			"09-27 16:05 running 3.6/0.0 LACTATE_THRESHOLD",
			"09-25 05:56 running 4.1/0.0 VO2MAX",
			"09-23 06:55 running 3.8/0.0 LACTATE_THRESHOLD",
			"09-22 14:06 treadmill_running 3.7/0.0 TEMPO",
			"09-19 11:07 running 2.8/0.0 TEMPO",
			"09-16 14:13 running 3.0/0.0 AEROBIC_BASE",
			"09-15 13:51 running 3.2/0.0 AEROBIC_BASE",
			"09-14 23:50 lap_swimming 2.4/1.5 RECOVERY",
		];
		assert.deepEqual(
			ACTIVITIES.filter((r) => r.start >= "2026-09-14").map((r) => `${r.start.slice(5, 10)} ${r.start.slice(11, 16)} ${r.type} ${teText(r.aerobic)}/${teText(r.anaerobic)} ${r.benefit}`),
			spec,
		);
	});
});

describe("the page", () => {
	it("is the registry's Training Effect: 7d · 4w on the wide control, 7d first, read from the workouts group", () => {
		const stat = PERFORMANCE_REGISTRY.page("training-effect")!;
		assert.deepEqual([stat.title, stat.ranges, stat.defaultRange, stat.rangeControl, stat.group, stat.hub], ["Training Effect", ["7d", "4w"], "7d", "wide", "workouts", undefined]);
		// Rolling 7 and 28 days ending today: the registry's defaults, so no `spans`.
		assert.equal(stat.spans, undefined);
	});

	it("draws both charts on a fixed 0–5 axis, labelled 5 down to 0 at their own values", () => {
		const v = period("7d");
		for (const chart of v.charts) assert.deepEqual([chart.ticks, chart.top], [[5, 4, 3, 2, 1, 0], 5]);
		assert.deepEqual(
			v.charts.map((c) => [c.key, c.title]),
			[
				["aerobic", "Aerobic"],
				["anaerobic", "Anaerobic"],
			],
		);
		// The phone's y labels sit on value × 25.6 above the feet (355.0), centred.
		TE_TICKS.forEach((t, i) => near(PHONE.feet.aerobic - t * PHONE.unit, PHONE.yLabels[i]!, 0.31, `label ${t}`));
	});
});

describe("7d — Oct 5 – 11", () => {
	it("is the 7 days ending today, Oct 5 - 11, stepping back while the index has older activities", () => {
		const v = period("7d");
		assert.deepEqual([v.kind, v.range, v.label, v.span], ["period", "7d", "Oct 5 - 11", { from: "2026-10-05", to: TODAY }]);
		assert.deepEqual([v.canGoBack, v.canGoForward, v.empty], [true, false, undefined]);
	});

	it("draws Aerobic on Oct 10 (4.3) and Oct 11 (4.5), and Anaerobic on Oct 11 alone: Oct 10's 0.0 has no bar", () => {
		const v = period("7d");
		assert.deepEqual(bars(aerobic(v)), ["10-10:4.3", "10-11:4.5"]);
		assert.deepEqual(bars(anaerobic(v)), ["10-11:0.2"]);
		assert.deepEqual(
			aerobic(v).bars.map((b) => [b.slot, b.x, b.at]),
			[
				[5, 5 / 6, 4.3 / 5],
				[6, 1, 4.5 / 5],
			],
		);
	});

	it("draws the phone's bars: heights value × 25.6 within 0.13 pt, centres within 0.06, 36.57 pt wide", () => {
		const v = period("7d");
		const plot = trainingEffectPlot(aerobic(v), PHONE_WIDTH);
		plot.bars.forEach((bar, i) => {
			const [left, right, height] = PHONE["7d"].aerobic[i]!;
			near(bar.height, height, 0.13, `${bar.date} height`);
			// 0.05 on the shot's own pixel thirds; the extents here are rounded to the hundredth.
			near(bar.x + bar.width / 2, (left + right) / 2, 0.06, `${bar.date} centre`);
			near(bar.width, right - left, 0.24, `${bar.date} width`);
		});
		near(plot.barWidth, 36.57, 0.01, "0.7 × 350 / 6.7");
		// The 0.2 bar: 5.12 pt of value, drawn 4.67 tall on the phone under its round top.
		near(anaerobic(v).bars[0]!.value * PHONE.unit, 5.12, 0.001, "Oct 11's anaerobic 0.2");
		assert.ok(PHONE["7d"].anaerobic[0]! < 5.12);
	});

	it("puts a dot under each day's slot, the ends large and labelled 10-05 and 10-11", () => {
		const v = period("7d");
		for (const chart of v.charts) {
			assert.deepEqual(
				chart.axis.dots.map((d) => d.large),
				[true, false, false, false, false, false, true],
			);
			assert.deepEqual(
				chart.axis.labels.map((l) => [l.x, l.text]),
				[
					[0, "10-05"],
					[1, "10-11"],
				],
			);
			trainingEffectPlot(chart, PHONE_WIDTH).dots.forEach((d, i) => near(d.x, PHONE["7d"].dots[i]!, 0.17, `dot ${i}`));
		}
	});

	it("lists the two runs newest first, word for word as the phone", () => {
		assert.deepEqual(cards(period("7d")), ["Oct 11, 2026 / Threshold (High Aerobic) • 4.5 • 0.2", "Oct 10, 2026 / Threshold (High Aerobic) • 4.3 • 0.0"]);
	});

	it("opens each card's Training Effect page on top, the route's sub naming the activity", () => {
		const [oct11] = period("7d").cards;
		const id = idAt("2026-10-11T08:21");
		assert.deepEqual(oct11!.route, { page: "performance-stat", stat: "training-effect", range: "7d", offset: 0, sub: `activity:${id}` });
		assert.deepEqual(oct11!.route, performanceStatRoute("training-effect", { range: "7d", sub: activitySub(id) }));
	});
});

describe("4w — Sep 14 – Oct 11", () => {
	it("is the 28 days ending today, Sep 14 - Oct 11, rolling: not the web's Sunday block", () => {
		const v = period("4w");
		assert.deepEqual([v.range, v.label, v.span, v.canGoBack, v.canGoForward], ["4w", "Sep 14 - Oct 11", { from: "2026-09-14", to: TODAY }, true, false]);
	});

	it("draws 12 aerobic bars, the day maxima of 11 runs and the Sep 14 23:50 pool swim, which is Sep 14's", () => {
		const v = period("4w");
		assert.deepEqual(bars(aerobic(v)), ["09-14:2.4", "09-15:3.2", "09-16:3.0", "09-19:2.8", "09-22:3.7", "09-23:3.8", "09-25:4.1", "09-27:3.6", "09-28:4.4", "10-03:4.1", "10-10:4.3", "10-11:4.5"]);
		assert.deepEqual(
			aerobic(v).bars.map((b) => b.slot),
			PHONE["4w"].slots,
		);
		assert.deepEqual(bars(anaerobic(v)), ["09-14:1.5", "09-28:0.2", "10-11:0.2"]);
		// The swim started 23:50:17 at +03, 00:50 on Sep 15 on the phone's +04: its local day decides.
		const swim = ACTIVITIES.find((r) => r.type === "lap_swimming")!;
		assert.equal(swim.start.slice(0, 10), "2026-09-14");
		assert.deepEqual([aerobic(v).bars[0]!.date, aerobic(v).bars[0]!.slot], ["2026-09-14", 0]);
	});

	it("draws the phone's heights within 0.16 pt (the 1.5 within 0.4) and its 28 slots: 8.84 pt bars, 12.635 apart", () => {
		const v = period("4w");
		aerobic(v).bars.forEach((b, i) => near(b.value * PHONE.unit, PHONE["4w"].heights[i]!, 0.16, `${b.date} height`));
		near(anaerobic(v).bars[0]!.value * PHONE.unit, PHONE["4w"].anaerobic[0]!, 0.4, "Sep 14's anaerobic 1.5");
		const plot = trainingEffectPlot(aerobic(v), PHONE_WIDTH);
		assert.equal(plot.dots.length, 28);
		near(plot.dots[0]!.x, PHONE["4w"].dots[0]!, 0.09, "first dot");
		near(plot.dots[27]!.x, PHONE["4w"].dots[1]!, 0.09, "last dot");
		near(plot.barWidth, 8.84, 0.01, "bar width");
		assert.ok(plot.barWidth >= PHONE["4w"].width[0] && plot.barWidth <= PHONE["4w"].width[1]);
		assert.deepEqual(
			aerobic(v).axis.labels.map((l) => l.text),
			["09-14", "10-11"],
		);
	});

	it("lists all 12 activities newest first: the phone's first three word for word, the rest as the spec predicts (Inferred)", () => {
		const v = period("4w");
		assert.equal(v.cards.length, 12);
		assert.deepEqual(cards(v), [
			"Oct 11, 2026 / Threshold (High Aerobic) • 4.5 • 0.2",
			"Oct 10, 2026 / Threshold (High Aerobic) • 4.3 • 0.0",
			"Oct 3, 2026 / Threshold (High Aerobic) • 4.1 • 0.0",
			"Sep 28, 2026 / Threshold (High Aerobic) • 4.4 • 0.2",
			"Sep 27, 2026 / Threshold (High Aerobic) • 3.6 • 0.0",
			"Sep 25, 2026 / VO₂ Max (High Aerobic) • 4.1 • 0.0",
			"Sep 23, 2026 / Threshold (High Aerobic) • 3.8 • 0.0",
			"Sep 22, 2026 / Tempo (High Aerobic) • 3.7 • 0.0",
			"Sep 19, 2026 / Tempo (High Aerobic) • 2.8 • 0.0",
			"Sep 16, 2026 / Base (Low Aerobic) • 3.0 • 0.0",
			"Sep 15, 2026 / Base (Low Aerobic) • 3.2 • 0.0",
			"Sep 14, 2026 / Recovery (Low Aerobic) • 2.4 • 1.5",
		]);
	});

	it("counts every sport, as the web's per-sport reports together do: 11 runs and the swim [web only]", () => {
		const v = period("4w");
		const sports = v.cards.map((c) => categoryOf(ACTIVITIES.find((r) => r.id === c.id)!));
		assert.deepEqual([sports.filter((s) => s === "running").length, sports.filter((s) => s === "swimming").length], [11, 1]);
	});
});

describe("the Training Effect page — the Oct 11 run", () => {
	const id = idAt("2026-10-11T08:21");

	it("opens from its card's route and names the activity's benefit, its dot and what it did", () => {
		const v = view("7d", { sub: period("7d").cards[0]!.route.sub }) as TrainingEffectDetailView;
		assert.deepEqual([v.kind, v.id, v.date], ["detail", id, TODAY]);
		assert.deepEqual(v.benefit, {
			label: "Threshold (High Aerobic)",
			group: "High Aerobic",
			copy: "Nice! Activities like this improve your muscular endurance and fatigue resistance, allowing you to sustain a hard effort for longer time. It increased your high aerobic training load.",
		});
		assert.equal(BENEFIT_COLOR[v.benefit.group!], "#ea670e");
		assert.deepEqual(DETAIL_HEADERS, { benefit: "PRIMARY BENEFIT", aerobic: "AEROBIC", anaerobic: "ANAEROBIC", related: "RELATED ACTIVITY" });
	});

	it("words each scale by its value's band: 4.5 Highly Impacting Aerobic Fitness, 0.2 No Anaerobic Benefit", () => {
		const [aero, anaero] = detail(id).scales;
		assert.deepEqual([aero!.label, aero!.value, aero!.text, aero!.band, aero!.colour, aero!.title], ["Aerobic", 4.5, "4.5", 4, "orange", "Highly Impacting Aerobic Fitness"]);
		assert.equal(aero!.copy, "Way to go! You should see a significant increase in your cardiorespiratory fitness thanks to this difficult aerobic activity.");
		assert.deepEqual(aero!.copyLines, ["Way to go! You should see a significant increase in", "your cardiorespiratory fitness thanks to this difficult", "aerobic activity."]);
		assert.deepEqual([anaero!.label, anaero!.value, anaero!.text, anaero!.band, anaero!.colour, anaero!.title], ["Anaerobic", 0.2, "0.2", 0, "grey", "No Anaerobic Benefit"]);
		assert.equal(anaero!.copy, "You did not gain any anaerobic benefit from this activity.");
	});

	it("puts the knobs at 16 + v / 5 × 370 on the run page's scale: 349.00 and 30.80, the phone's 349.00 and 30.67", () => {
		const v = detail(id);
		const [aero, anaero] = knobs(v);
		assert.deepEqual([aero!.x, anaero!.x], [349, 30.8]);
		assert.deepEqual([aero!.colour, anaero!.colour], ["orange", "grey"]);
		PHONE.detail[TODAY].knobs.forEach((x, i) => near(knobs(v)[i]!.x, x, 0.2, `knob ${i}`));
		// The value is centred under its knob: the phone's ink centres within 0.16 pt.
		PHONE.detail[TODAY].labels.forEach((x, i) => near(knobs(v)[i]!.x, x, 0.16, `label ${i}`));
		assert.deepEqual(
			v.scales.map((s) => s.at),
			[0.9, 0.04],
		);
	});

	it("names the related activity: the run's disc, Dubai Running, Oct 11 @ 8:21 AM and the card's subtitle; it opens the run", () => {
		assert.deepEqual(detail(id).related, {
			id,
			name: "Dubai Running",
			when: "Oct 11 @ 8:21 AM",
			subtitle: "Threshold (High Aerobic) • 4.5 • 0.2",
			glyph: "run",
			disc: "orange",
			category: "running",
			route: activityRoute(id),
		});
	});

	it("does not use Garmin's message keys: HIGHLY_IMPROVING_LACTATE_THRESHOLD_13 still reads the band's words", () => {
		const oct11 = ACTIVITIES.find((r) => r.id === id)!;
		assert.equal(oct11.aerobicMsg, "HIGHLY_IMPROVING_LACTATE_THRESHOLD_13");
		const words = JSON.stringify(detail(id));
		assert.ok(!words.includes("Lactate"), "the web's 'Highly Impacting Lactate Threshold' is not the phone's");
		// Another key, the same value: the same words.
		const other = detail(7, { rows: [{ ...oct11, id: 7, aerobicMsg: "IMPACTING_TEMPO_22" }] });
		assert.equal(other.scales[0]!.title, "Highly Impacting Aerobic Fitness");
	});
});

describe("the Training Effect page — the Oct 10 run", () => {
	const id = idAt("2026-10-10T08:19");

	it("puts 4.3 at 334.20 (the phone's 334.33) and 0.0 at the scale's start, 16.00, its value centred there, not clamped", () => {
		const v = detail(id);
		const [aero, anaero] = knobs(v);
		assert.deepEqual([aero!.x, anaero!.x], [334.2, 16]);
		PHONE.detail["2026-10-10"].knobs.forEach((x, i) => near(knobs(v)[i]!.x, x, 0.2, `knob ${i}`));
		PHONE.detail["2026-10-10"].labels.forEach((x, i) => near(knobs(v)[i]!.x, x, 0.16, `label ${i}`));
		assert.deepEqual(
			v.scales.map((s) => [s.text, s.title]),
			[
				["4.3", "Highly Impacting Aerobic Fitness"],
				["0.0", "No Anaerobic Benefit"],
			],
		);
	});

	it("names the run as the shot does: Oct 10 @ 8:19 AM, … • 4.3 • 0.0", () => {
		const { related } = detail(id);
		assert.deepEqual([related.name, related.when, related.subtitle], ["Dubai Running", "Oct 10 @ 8:19 AM", "Threshold (High Aerobic) • 4.3 • 0.0"]);
	});
});

describe("the web's report, running only [web only]", () => {
	const runs = ACTIVITIES.filter((r) => categoryOf(r) === "running");
	const web = (span: Span, key: "aerobic" | "anaerobic") => bars(teChart(runs, span, key));

	it("7d, Oct 5-11: Sat 4.3, Sun 4.5; anaerobic Sun 0.2", () => {
		const span = { from: "2026-10-05", to: TODAY };
		assert.deepEqual([web(span, "aerobic"), web(span, "anaerobic")], [["10-10:4.3", "10-11:4.5"], ["10-11:0.2"]]);
	});

	it("7d before, Sep 28 - Oct 4: Mon 4.4 / 0.2, Sat 4.1", () => {
		const span = { from: "2026-09-28", to: "2026-10-04" };
		assert.deepEqual([web(span, "aerobic"), web(span, "anaerobic")], [["09-28:4.4", "10-03:4.1"], ["09-28:0.2"]]);
	});

	it("4w, the 22-day Sunday block Sep 20 - Oct 11: eight runs, the swim not a run", () => {
		const span = { from: "2026-09-20", to: TODAY };
		assert.deepEqual(web(span, "aerobic"), ["09-22:3.7", "09-23:3.8", "09-25:4.1", "09-27:3.6", "09-28:4.4", "10-03:4.1", "10-10:4.3", "10-11:4.5"]);
		assert.deepEqual(web(span, "anaerobic"), ["09-28:0.2", "10-11:0.2"]);
	});

	it("4w before, Aug 23 - Sep 19: 14 bars, each day's highest aerobic and, apart, its highest anaerobic", () => {
		const span = { from: "2026-08-23", to: "2026-09-19" };
		const aero = web(span, "aerobic");
		assert.equal(aero.length, 14);
		assert.deepEqual(aero, ["08-23:3.5", "08-24:3.7", "08-29:2.3", "08-30:3.5", "08-31:3.8", "09-03:3.1", "09-04:2.8", "09-05:3.3", "09-07:3.1", "09-09:3.3", "09-12:3.2", "09-15:3.2", "09-16:3.0", "09-19:2.8"]);
		assert.deepEqual(web(span, "anaerobic"), ["08-30:2.3", "09-05:0.2", "09-12:2.3"]);
		// The days with several runs: 08-23 of 3.5 / 2.9 / 2.6, 08-31 of 3.8 / 2.5, 09-07 of 3.1 / 2.1, 09-12 of 3.2 / 2.4 / 3.1.
		const of = (day: string) => runs.filter((r) => r.start.startsWith(day)).map((r) => [r.aerobic, r.anaerobic]);
		assert.deepEqual(of("2026-08-23"), [
			[2.6, 0],
			[2.9, 0],
			[3.5, 0],
		]);
		assert.deepEqual(of("2026-09-12"), [
			[3.1, 2.3],
			[2.4, 0.6],
			[3.2, 0],
		]);
		assert.deepEqual([dayMaxima(runs, span, "aerobic").get("2026-08-31"), dayMaxima(runs, span, "aerobic").get("2026-09-07")], [3.8, 3.1]);
	});

	it("words the run's Training Effect section as the web's activity page: 4.5 Highly Impacting, 0.2 No Benefit, 204", () => {
		const oct11 = ACTIVITIES[0]!;
		const section = (v: number | undefined) => `${teText(v)} ${BAND_WORDS[teBand(v!)]}`;
		assert.deepEqual([section(oct11.aerobic), section(oct11.anaerobic), String(Math.round(oct11.load!))], ["4.5 Highly Impacting", "0.2 No Benefit", "204"]);
		// The treadmill run's 3.7.
		assert.equal(section(ACTIVITIES.find((r) => r.type === "treadmill_running")!.aerobic), "3.7 Impacting");
	});

	it("takes the bands from the web help's table, which the Help sheet repeats word for word", () => {
		assert.equal(BAND_TABLE, "Overreaching 5.0 Highly Impacting 4.0 - 4.9 Impacting 3.0 - 3.9 Maintaining 2.0 - 2.9 Some Benefit 1.0 - 1.9 No Benefit 0.0 - 0.9");
		assert.deepEqual(
			[0, 0.9, 1, 1.9, 2, 2.9, 3, 3.9, 4, 4.9, 5].map(teBand),
			[0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5],
		);
		const help = TE_HELP.sections.flatMap((s) => s.parts.flatMap((p) => p.paragraphs));
		assert.ok(help.includes("If you have more than one activity in a day, Garmin Connect will display your highest aerobic Training Effect value in graphs where it appears."));
		assert.ok(help.includes("If you have more than one activity in a day, Garmin Connect will display your highest anaerobic Training Effect value in graphs where it appears."));
	});
});

describe("previous periods (Inferred)", () => {
	it("7d −1 is Sep 28 - Oct 4: aerobic Sep 28 4.4 and Oct 3 4.1, anaerobic Sep 28 0.2, two cards", () => {
		const v = period("7d", { offset: -1 });
		assert.deepEqual([v.label, v.span, v.canGoForward], ["Sep 28 - Oct 4", { from: "2026-09-28", to: "2026-10-04" }, true]);
		assert.deepEqual([bars(aerobic(v)), bars(anaerobic(v))], [["09-28:4.4", "10-03:4.1"], ["09-28:0.2"]]);
		assert.deepEqual(cards(v), ["Oct 3, 2026 / Threshold (High Aerobic) • 4.1 • 0.0", "Sep 28, 2026 / Threshold (High Aerobic) • 4.4 • 0.2"]);
		// A card keeps the period it opens from.
		assert.deepEqual([v.cards[0]!.route.range, v.cards[0]!.route.offset], ["7d", -1]);
	});

	it("4w −1 is Aug 17 - Sep 13: 19 cards on 13 days, every sport's day maxima", () => {
		const v = period("4w", { offset: -1 });
		assert.deepEqual([v.label, v.span], ["Aug 17 - Sep 13", { from: "2026-08-17", to: "2026-09-13" }]);
		assert.equal(v.cards.length, 19);
		assert.deepEqual(bars(aerobic(v)), ["08-22:3.5", "08-23:3.5", "08-24:3.7", "08-28:2.9", "08-29:2.3", "08-30:3.5", "08-31:3.8", "09-03:3.1", "09-04:2.8", "09-05:3.3", "09-07:3.1", "09-09:3.3", "09-12:3.2"]);
		assert.deepEqual(bars(anaerobic(v)), ["08-22:1.0", "08-28:0.1", "08-30:2.3", "09-05:0.2", "09-12:2.3"]);
	});

	it("draws Sep 12's 3.2 from the 07:44 run and its 2.3 from the 21:05 run, and gives each of its three runs a card", () => {
		const v = period("4w", { offset: -1 });
		const sep12 = (chart: TeChart) => chart.bars.find((b) => b.date === "2026-09-12")!.value;
		assert.deepEqual([sep12(aerobic(v)), sep12(anaerobic(v))], [3.2, 2.3]);
		assert.equal(ACTIVITIES.find((r) => r.id === idAt("2026-09-12T07:44"))!.aerobic, 3.2);
		assert.equal(ACTIVITIES.find((r) => r.id === idAt("2026-09-12T21:05"))!.anaerobic, 2.3);
		assert.deepEqual(
			v.cards.filter((c) => c.date === "Sep 12, 2026").map((c) => [c.id, c.subtitle]),
			[
				[idAt("2026-09-12T21:05"), "Tempo (High Aerobic) • 3.1 • 2.3"],
				[idAt("2026-09-12T08:32"), "Tempo (High Aerobic) • 2.4 • 0.6"],
				[idAt("2026-09-12T07:44"), "Base (Low Aerobic) • 3.2 • 0.0"],
			],
		);
	});

	it("stops at the index's oldest activity once it is complete, and steps on while it is not", () => {
		// The oldest is Aug 22, inside Aug 17 - Sep 13.
		assert.equal(period("4w", { offset: -1 }).canGoBack, false);
		assert.equal(period("4w", { offset: -1, ctx: { complete: false } }).canGoBack, true);
		assert.equal(period("7d", { offset: -7 }).canGoBack, false);
	});
});

describe("edges", () => {
	it("keeps both charts' axes and shows the web's line in place of the list for a period without activities (Inferred)", () => {
		const v = period("7d", { rows: [] });
		assert.deepEqual([v.charts[0].bars, v.charts[1].bars, v.cards, v.empty, v.canGoBack], [[], [], [], TE_ABOUT, false]);
		assert.equal(v.charts[0].axis.dots.length, 7);
		assert.equal(TE_ABOUT, "Training Effect is measured from 0 to 5 and tells you how a specific activity has impacted your overall training.");
	});

	it("lists a 0.0 / 0.0 activity, Garmin's yoga of 2025-12-24, with no bar on either chart (Inferred)", () => {
		const yoga = row({ id: 2, type: "yoga", typeId: 43, parentTypeId: 29, start: "2025-12-24T13:17:00", begin: Date.parse("2025-12-24T09:17:00Z"), aerobic: 0, anaerobic: 0, benefit: "UNKNOWN" });
		const v = period("7d", { rows: [yoga], ctx: { today: "2025-12-27" } });
		assert.deepEqual(cards(v), ["Dec 24, 2025 / Unknown • 0.0 • 0.0"]);
		assert.deepEqual([v.charts[0].bars, v.charts[1].bars, v.empty], [[], [], undefined]);
		// UNKNOWN reads Unknown with no dot and no copy.
		const d = view("7d", { rows: [yoga], sub: activitySub(2), ctx: { today: "2025-12-27" } }) as TrainingEffectDetailView;
		assert.deepEqual(d.benefit, { label: "Unknown", group: null });
		assert.deepEqual(
			d.scales.map((s) => [s.title, s.colour, s.copy]),
			[
				["No Aerobic Benefit", "grey", undefined],
				["No Anaerobic Benefit", "grey", "You did not gain any anaerobic benefit from this activity."],
			],
		);
		assert.deepEqual([d.related.name, d.related.glyph, d.related.route], ["Yoga", "yoga", activityRoute(d.related.id)]);
	});

	it("leaves out an activity without a training effect", () => {
		const v = period("7d", { rows: [row({ id: 3 }), row({ id: 4, aerobic: 3.1, anaerobic: 0.4, benefit: "TEMPO" })] });
		assert.deepEqual(
			v.cards.map((c) => c.id),
			[4],
		);
		assert.deepEqual([bars(aerobic(v)), bars(anaerobic(v))], [["10-11:3.1"], ["10-11:0.4"]]);
	});

	it("puts an activity on its local start day: Aug 6 18:28 at −07 is Aug 6's, Aug 5's evening run Aug 5's, though both are a day on in GMT", () => {
		const trip = [
			row({ id: 5, start: "2025-08-06T18:28:00", begin: Date.parse("2025-08-07T01:28:00Z"), aerobic: 3.4, anaerobic: 0 }),
			row({ id: 6, start: "2025-08-05T19:10:00", begin: Date.parse("2025-08-06T02:10:00Z"), aerobic: 2.6, anaerobic: 0.3 }),
		];
		const v = period("7d", { rows: trip, ctx: { today: "2025-08-07" } });
		assert.deepEqual(bars(aerobic(v)), ["08-05:2.6", "08-06:3.4"]);
		assert.deepEqual(
			v.cards.map((c) => c.date),
			["Aug 6, 2025", "Aug 5, 2025"],
		);
	});

	it("draws a multisport as the parent row the list keeps: 5.0 at the plot's top, Overreaching on red; its row opens nothing (Inferred)", () => {
		const multi = row({ id: 8, type: "multi_sport", typeId: 89, parentTypeId: 17, start: "2025-10-25T06:36:00", begin: Date.parse("2025-10-25T02:36:00Z"), aerobic: 5, anaerobic: 2.2, benefit: "LACTATE_THRESHOLD" });
		const v = period("7d", { rows: [multi], ctx: { today: "2025-10-26" } });
		assert.deepEqual(
			aerobic(v).bars.map((b) => [b.value, b.at]),
			[[5, 1]],
		);
		const d = view("7d", { rows: [multi], sub: activitySub(8) }) as TrainingEffectDetailView;
		assert.deepEqual(
			d.scales.map((s) => [s.text, s.band, s.title, s.colour, s.copy]),
			[
				["5.0", 5, "Overreaching", "red", undefined],
				["2.2", 2, "Maintaining Anaerobic Fitness", "blue", undefined],
			],
		);
		assert.deepEqual(knobs(d).map((k) => k.x), [386, 178.8]);
		// Another year's date line carries the year.
		assert.deepEqual([d.related.name, d.related.when, d.related.glyph, d.related.category, d.related.route], ["Multisport", "Oct 25, 2025 @ 6:36 AM", "medal", "multisport", activityRoute(d.related.id)]);
	});

	it("opens the swim's page too, its related row naming the sport and opening the swim", () => {
		const d = detail(idAt("2026-09-14T23:50"));
		assert.deepEqual(d.benefit, { label: "Recovery (Low Aerobic)", group: "Low Aerobic" });
		assert.deepEqual(
			d.scales.map((s) => [s.text, s.title, s.colour]),
			[
				["2.4", "Maintaining Aerobic Fitness", "blue"],
				["1.5", "Some Anaerobic Benefit", "grey"],
			],
		);
		assert.deepEqual([d.related.name, d.related.when, d.related.subtitle, d.related.glyph, d.related.route], ["Pool Swimming", "Sep 14 @ 11:50 PM", "Recovery (Low Aerobic) • 2.4 • 1.5", "swimming", activityRoute(d.related.id)]);
		// The treadmill run's row opens it, as every sport's does.
		const treadmill = idAt("2026-09-22T14:06");
		assert.deepEqual(detail(treadmill).related.route, activityRoute(treadmill));
	});

	it("falls back to the list for a sub-page whose activity is gone, or no longer has a training effect (Inferred)", () => {
		assert.equal(view("7d", { sub: activitySub(999) }).kind, "period");
		const id = idAt("2026-10-11T08:21");
		const edited = ACTIVITIES.map((r) => (r.id === id ? { ...r, aerobic: undefined } : r));
		assert.equal(view("7d", { sub: activitySub(id), rows: edited }).kind, "period");
		assert.equal(view("4w", { sub: "month:2026-03" }).kind, "period");
	});

	it("reads the sub-page back only when it names an activity id", () => {
		assert.equal(activitySub(24680971010), "activity:24680971010");
		assert.equal(activityOfSub("activity:24680971010"), 24680971010);
		assert.deepEqual(
			[undefined, "", "activity:", "activity:0", "activity:-3", "activity:1.5", "activity:abc", "activity:99999999999999999", "month:2026-03", " activity:1"].map(activityOfSub),
			Array(10).fill(undefined),
		);
		// The route keeps it: a short token.
		assert.equal(cardRoute("4w", -2, 24680971010).sub, "activity:24680971010");
		assert.deepEqual(cardRoute("4w", -2, 24680971010), { page: "performance-stat", stat: "training-effect", range: "4w", offset: -2, sub: "activity:24680971010" });
	});

	it("reads another range as the default 7d", () => {
		const v = trainingEffectView({ range: "1d", offset: 0 }, ACTIVITIES, CTX) as TrainingEffectPeriodView;
		assert.deepEqual([v.range, v.label], ["7d", "Oct 5 - 11"]);
	});

	it("shows a value it lacks as --, and leaves that scale out (Inferred)", () => {
		const partial = row({ id: 9, aerobic: 2.7, benefit: "AEROBIC_BASE" });
		assert.equal(teSubtitle(partial), "Base (Low Aerobic) • 2.7 • --");
		const d = view("7d", { rows: [partial], sub: activitySub(9) }) as TrainingEffectDetailView;
		assert.deepEqual(
			d.scales.map((s) => s.key),
			["aerobic"],
		);
		assert.deepEqual(bars(anaerobic(period("7d", { rows: [partial] }))), []);
	});
});

describe("the words", () => {
	it("names the benefits as the activity pages do; VO₂ Max with its subscript, Unknown for none", () => {
		assert.deepEqual(
			["LACTATE_THRESHOLD", "VO2MAX", "TEMPO", "AEROBIC_BASE", "RECOVERY", "ANAEROBIC_CAPACITY", "SPEED", "UNKNOWN", "NO_BENEFIT", undefined].map(benefitLabel),
			[
				"Threshold (High Aerobic)",
				"VO₂ Max (High Aerobic)",
				"Tempo (High Aerobic)",
				"Base (Low Aerobic)",
				"Recovery (Low Aerobic)",
				"Anaerobic Capacity (Anaerobic)",
				"Sprint (Anaerobic)",
				"Unknown",
				"No Benefit",
				"Unknown",
			],
		);
	});

	it("keys the benefit copy by `benefit`: Threshold's alone is known", () => {
		assert.equal(detail(idAt("2026-10-03T14:59")).benefit.copy, benefitMessage("LACTATE_THRESHOLD"));
		assert.equal(detail(idAt("2026-09-25T05:56")).benefit.copy, undefined);
	});

	it("titles every band of both scales, the two seen and the rest after them (Inferred)", () => {
		assert.deepEqual(SCALE_BAND_TITLES.aerobic, ["No Aerobic Benefit", "Some Aerobic Benefit", "Maintaining Aerobic Fitness", "Impacting Aerobic Fitness", "Highly Impacting Aerobic Fitness", "Overreaching"]);
		assert.deepEqual(SCALE_BAND_TITLES.anaerobic, ["No Anaerobic Benefit", "Some Anaerobic Benefit", "Maintaining Anaerobic Fitness", "Impacting Anaerobic Fitness", "Highly Impacting Anaerobic Fitness", "Overreaching"]);
		// Each title carries its band's word, as the two seen do.
		for (const titles of Object.values(SCALE_BAND_TITLES)) titles.forEach((t, band) => assert.ok(t.replace(/ (Aerobic|Anaerobic)/, "").startsWith(BAND_WORDS[band]!.replace(" Benefit", "")), t));
	});

	it("builds Help from the web's dialog: what it is, Using Training Effect, Aerobic, Anaerobic, Primary Benefit (Inferred)", () => {
		assert.equal(TE_HELP.title, "Training Effect");
		assert.deepEqual(
			TE_HELP.sections.map((s) => s.title),
			[undefined, "Using Training Effect", "Aerobic", "Anaerobic", "Primary Benefit"],
		);
		const benefit = TE_HELP.sections[4]!.parts;
		assert.equal(benefit[0]!.note, "Anaerobic Sprint Anaerobic Capacity High Aerobic VO₂ Max Threshold Tempo Low Aerobic Base Recovery");
		assert.ok(benefit[1]!.paragraphs[0]!.endsWith("Your primary benefit statement also explains how the activity affected your training load, which is a measure of your effort over the past 7 days."));
	});
});
