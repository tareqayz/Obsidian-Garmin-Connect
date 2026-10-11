import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
	CARD_IDS,
	chartSub,
	chartsTabView,
	expandedChartView,
	forcedLabels,
	niceStep,
	readChartSub,
	roundHalfAway,
	roundHalfEven,
	teColour,
	zoneStops,
	type ChartCard,
	type ChartsRoute,
	type RunWalkChart,
	type SeriesChart,
	type TrainingEffectChart,
	type ZonesChart,
} from "../src/dashboard/activity-chart-pages";
import type { Units } from "../src/dashboard/activities";
import { buildActivityDetail, type ActivityDetail } from "../src/sync/activity-detail";

/*
 * The captured run's numbers (spec: ref/activity-details/outdoor-run, "Golden
 * numbers"), transcribed from its payloads: the summary, laps, typed splits and
 * zones as Garmin sent them, and nine samples carrying every series' extremes
 * (HR 76–182, speed to 3.247 m/s, GAP to 3.881, cadence 100–219 with its 0 spm
 * samples, stride 35.1–114.6 cm, VR 7.77–12.72, VO 4.47–9.63, GCT 218–270,
 * elevation -21.8 to -5.8 m, power 0–442 W, impact 0.5–1.53) on its timer
 * (0 … 3,361 s, the 39 s pause at 26:06 between rows 4 and 5) and its 10,009 m.
 * A made-up id; no position.
 */
const ID = 98765432101;
const START = Date.parse("2026-10-10T04:19:48Z");

const SUMMARY = {
	activityName: "Chart Run",
	activityTypeDTO: { typeId: 1, typeKey: "running", parentTypeId: 17 },
	summaryDTO: {
		startTimeLocal: "2026-10-10T08:19:48.0",
		startTimeGMT: "2026-10-10T04:19:48.0",
		distance: 10009,
		duration: 3360.82,
		averageSpeed: 2.977999925613403,
		maxSpeed: 3.246999979019165,
		avgGradeAdjustedSpeed: 2.9739999771118164,
		averageHR: 167,
		maxHR: 182,
		averagePower: 294,
		maxPower: 442,
		averageRunCadence: 171.296875,
		maxRunCadence: 219,
		strideLength: 104.15999755859376,
		verticalRatio: 8.569999694824219,
		verticalOscillation: 8.919999694824218,
		groundContactTime: 256.8999938964844,
		minElevation: -21.8,
		maxElevation: -5.8,
		trainingEffect: 4.300000190734863,
		anaerobicTrainingEffect: 0,
		beginPotentialStamina: 100,
		endPotentialStamina: 53,
		impactLoad: 10590,
	},
};

const COLUMNS = [
	"sumDuration",
	"sumDistance",
	"directHeartRate",
	"directSpeed",
	"directGradeAdjustedSpeed",
	"directDoubleCadence",
	"directStrideLength",
	"directVerticalRatio",
	"directVerticalOscillation",
	"directGroundContactTime",
	"directElevation",
	"directPower",
	"directAvailableStamina",
	"directPotentialStamina",
	"directPerformanceCondition",
	"directImpactLoadFactor",
] as const;

/** clock (s since the start), then the columns above. */
const ROWS: Array<Array<number | null>> = [
	[0, 0, 0, 76, 0.877, 0.877, 100, null, null, 5.44, null, -5.8, 70, 100, 100, null, 1.53],
	[4, 4, 2, 78, 0.616, 0.616, 0, null, null, null, null, -6.2, 0, 100, 100, null, 1],
	// Stride, VR and GCT start here, at 0:09, as on the phone's own samples.
	[9, 9, 19.5, 87, 3.191, 3.191, 176, 108.7, 8.11, 8.83, 246, -6.5, 318, 100, 100, null, 1.2],
	// Performance Condition from 6:00.
	[360, 360, 1015.1, 150, 2.9, 2.95, 171, 102, 8.58, 4.47, 218, -21.8, 442, 94, 94, 2, 0.5],
	[1566, 1566, 4605.9, 169, 3.247, 3.881, 170, 35.1, 12.72, 9.63, 270, -15, 290, 77, 77, 1, 1],
	[1605, 1567, 4607.3, 155, 1.288, 1.3, 104, 114.6, 7.77, 8.07, 245, -15, 280, 77, 77, 1, 1],
	[1607, 1569, 4610.7, 155, 1.26, 1.3, 219, 100, 8.7, 8.27, 250, -15, 280, 77, 77, 1, 1],
	[2438, 2400, 7100, 175, 3, 3, 163, 105, 9.18, 9, 255, -10, 300, 65, 65, 0, 1],
	[3399, 3361, 10009, 182, 3, 3, 171, 106, 8.6, 9.2, 258, -12, 300, 53, 53, 0, 1],
];

const SAMPLES = {
	metricDescriptors: [{ metricsIndex: 0, key: "directTimestamp" }, ...COLUMNS.map((key, i) => ({ metricsIndex: i + 1, key }))],
	activityDetailMetrics: ROWS.map(([clock, ...rest]) => ({ metrics: [START + clock! * 1000, ...rest] })),
};

const lap = (lapIndex: number, startTimeGMT: string, duration: number, distance: number, averageSpeed: number) => ({ lapIndex, startTimeGMT, duration, distance, averageSpeed });
const SPLITS = {
	lapDTOs: [
		lap(1, "2026-10-10T04:19:48.0", 355.056, 1000, 2.815999984741211),
		lap(2, "2026-10-10T04:25:44.0", 343.48, 1000, 2.9110000133514404),
		lap(3, "2026-10-10T04:31:28.0", 336.132, 1000, 2.9749999046325684),
		lap(4, "2026-10-10T04:37:04.0", 329.454, 1000, 3.0350000858306885),
		lap(5, "2026-10-10T04:42:33.0", 337.242, 1000, 2.9649999141693115),
		lap(6, "2026-10-10T04:48:49.0", 341.793, 1000, 2.9260001182556152),
		lap(7, "2026-10-10T04:54:31.0", 324.648, 1000, 3.0799999237060547),
		lap(8, "2026-10-10T04:59:55.0", 325.01, 1000, 3.0769999027252197),
		lap(9, "2026-10-10T05:05:20.0", 333.324, 1000, 3.0000000000000004),
		lap(10, "2026-10-10T05:10:54.0", 332.017, 1000, 3.01200008392334),
		lap(11, "2026-10-10T05:16:26.0", 2.664, 9, 3.378000020980835),
	],
};

const TYPED = {
	splits: [
		{ type: "INTERVAL_ACTIVE", startTimeGMT: "2026-10-10T04:19:48.0", endTimeGMT: "2026-10-10T05:16:27.0", duration: 3360.82, distance: 10009.02, averageSpeed: 2.977999925613403 },
		{ type: "RWD_RUN", startTimeGMT: "2026-10-10T04:19:48.0", endTimeGMT: "2026-10-10T04:45:54.0", duration: 1565.904, distance: 4605.95 },
		{ type: "RWD_WALK", startTimeGMT: "2026-10-10T04:46:07.0", endTimeGMT: "2026-10-10T04:46:07.0", duration: 0 },
		{ type: "RWD_STAND", startTimeGMT: "2026-10-10T04:46:27.0", endTimeGMT: "2026-10-10T04:46:27.0", duration: 0 },
		{ type: "RWD_WALK", startTimeGMT: "2026-10-10T04:46:32.0", endTimeGMT: "2026-10-10T04:46:35.0", duration: 3.776, distance: 4.79 },
		{ type: "RWD_RUN", startTimeGMT: "2026-10-10T04:46:36.0", endTimeGMT: "2026-10-10T05:16:27.0", duration: 1791.083, distance: 5398.27 },
	],
};

const zone = (zoneNumber: number, secsInZone: number, zoneLowBoundary: number) => ({ zoneNumber, secsInZone, zoneLowBoundary });
const HR_ZONES = [zone(1, 4, 102), zone(2, 72.001, 122), zone(3, 758.992, 143), zone(4, 2493.367, 163), zone(5, 0, 184)];
const POWER_ZONES = [zone(1, 1154.621, 227), zone(2, 1593.776, 280), zone(3, 444.944, 318), zone(4, 141.001, 354), zone(5, 12.998, 407)];

/** The run as the page gets it; the weigh-in that day was 68.0 kg (web: 294 W → 4.32 W/kg). */
function run(extra: Partial<ActivityDetail> = {}): ActivityDetail {
	const detail = buildActivityDetail(ID, { summary: SUMMARY, samples: SAMPLES, laps: SPLITS, segments: TYPED, hrZones: HR_ZONES, powerZones: POWER_ZONES }, null)!;
	return { ...detail, weightKg: 68, ...extra };
}

const RUN = run();

function tab(route: Partial<ChartsRoute> = {}, units: Units = "metric", detail = RUN): ChartCard[] {
	return chartsTabView(detail, { axis: "time", ...route }, units).cards;
}

function card<K extends ChartCard["kind"]>(cards: ChartCard[], id: string, kind: K): Extract<ChartCard, { kind: K }> {
	const found = cards.find((c) => c.id === id);
	assert.ok(found, `no ${id} card`);
	assert.equal(found.kind, kind);
	return found as Extract<ChartCard, { kind: K }>;
}

const series = (cards: ChartCard[], id: string) => card(cards, id, "series") as SeriesChart;
const figures = (c: ChartCard) => c.figures.map((f) => [f.value, f.unit ?? "", f.label]);
const labels = (c: SeriesChart) => c.y.labels.map((l) => l.text);
const ticks = (axis: { ticks: Array<{ text: string }> }) => axis.ticks.map((t) => t.text);
const near = (actual: number, expected: number, tolerance = 0.01) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} is not ${expected} ± ${tolerance}`);

describe("chartsTabView: the cards", () => {
	it("lists the phone's sixteen cards in its order", () => {
		assert.deepEqual(
			tab().map((c) => c.id),
			[...CARD_IDS],
		);
		assert.deepEqual(
			tab().map((c) => c.title),
			[
				"Pace",
				"Heart Rate",
				"Training Effect",
				"Elevation",
				"Power (W)",
				"Stamina",
				"Performance Condition",
				"Cadence",
				"Stride Length",
				"Vertical Ratio",
				"Vertical Oscillation",
				"Ground Contact Time",
				"Impact Load Factor",
				"Run/Walk",
				"Time in Heart Rate Zones",
				"Time in Power Zones",
			],
		);
	});

	it("marks the cards with a ? as the phone does", () => {
		assert.deepEqual(
			tab()
				.filter((c) => !c.help)
				.map((c) => c.id),
			["heart-rate", "elevation", "power", "stride-length"],
		);
	});

	it("titles Pace, Heart Rate and Power by the picker's choice, and offers the choices", () => {
		const pace = series(tab(), "pace");
		assert.deepEqual(pace.picker, {
			key: "pace",
			options: [
				{ value: "pace", label: "Pace" },
				{ value: "gap", label: "Grade-Adjusted Pace" },
				{ value: "lap-pace", label: "Lap Average Pace" },
			],
			chosen: "pace",
		});
		const chosen = tab({ pace: "gap", heart: "zones", power: "per-kg" });
		assert.equal(series(chosen, "pace").title, "Grade-Adjusted Pace");
		assert.equal(series(chosen, "heart-rate").title, "Heart Rate Zones");
		assert.equal(series(chosen, "power").title, "Power (W/kg)");
		assert.equal(series(tab({ pace: "lap-pace" }), "pace").title, "Lap Average Pace");
		assert.deepEqual(series(tab(), "heart-rate").picker?.options.map((o) => o.label), ["Heart Rate", "Heart Rate Zones"]);
		assert.deepEqual(series(tab(), "power").picker?.options.map((o) => o.label), ["Power (W)", "Power (W/kg)"]);
	});

	it("is empty without samples: the tab shows its loading or empty state", () => {
		const bare = buildActivityDetail(ID, { summary: SUMMARY, laps: SPLITS, hrZones: HR_ZONES }, null)!;
		assert.deepEqual(chartsTabView(bare, { axis: "time" }, "metric"), { axis: "time", cards: [] });
	});
});

describe("chartsTabView: figures (golden numbers)", () => {
	const cards = tab();

	it("rounds each figure as the phone does", () => {
		assert.deepEqual(figures(series(cards, "pace")), [
			["5:36", "/km", "Average"],
			["5:08", "/km", "Best"],
		]);
		assert.deepEqual(figures(series(cards, "heart-rate")), [
			["167", "bpm", "Average"],
			["182", "bpm", "Maximum"],
		]);
		assert.deepEqual(figures(series(cards, "elevation")), [
			["-22", "m", "Minimum"],
			["-6", "m", "Maximum"],
		]);
		assert.deepEqual(figures(series(cards, "power")), [
			["294", "W", "Average"],
			["442", "W", "Maximum"],
		]);
		assert.deepEqual(figures(series(cards, "stamina")), [
			["100", "%", "Beginning Potential"],
			["53", "%", "Ending Potential"],
		]);
		assert.deepEqual(figures(series(cards, "performance-condition")), []);
		assert.deepEqual(figures(series(cards, "cadence")), [
			["171", "spm", "Average"],
			["219", "spm", "Maximum"],
		]);
		assert.deepEqual(figures(series(cards, "stride-length")), [["1.04", "m", "Average"]]);
		assert.deepEqual(figures(series(cards, "vertical-ratio")), [["8.6", "%", "Average"]]);
		assert.deepEqual(figures(series(cards, "vertical-oscillation")), [["8.9", "cm", "Average"]]);
		assert.deepEqual(figures(series(cards, "ground-contact-time")), [["257", "ms", "Average"]]);
		assert.deepEqual(figures(series(cards, "impact-load")), [
			["10.59", "km", "Impact Load"],
			["10.01", "km", "Actual Distance"],
		]);
	});

	it("reads the other pace charts' best: Grade-Adjusted from its fastest sample, Lap Average from its fastest lap", () => {
		assert.deepEqual(figures(series(tab({ pace: "gap" }), "pace")), [
			["5:36", "/km", "Average"],
			["4:18", "/km", "Best"],
		]);
		assert.deepEqual(figures(series(tab({ pace: "lap-pace" }), "pace")), [
			["5:36", "/km", "Average"],
			["4:56", "/km", "Best"],
		]);
	});

	it("shows Power (W/kg) as watts over the day's weight, two decimals (web: 4.32, 6.50)", () => {
		assert.deepEqual(figures(series(tab({ power: "per-kg" }), "power")), [
			["4.32", "W/kg", "Average"],
			["6.50", "W/kg", "Maximum"],
		]);
	});

	it("dots Training Effect's figures in their knob's colour", () => {
		const te = card(cards, "training-effect", "training-effect") as TrainingEffectChart;
		assert.deepEqual(te.figures, [
			{ value: "4.3", label: "Aerobic", dot: "orange" },
			{ value: "0.0", label: "Anaerobic", dot: "grey" },
		]);
		assert.deepEqual(te.scales, [
			{ label: "Aerobic", value: 4.3, colour: "orange" },
			{ label: "Anaerobic", value: 0, colour: "grey" },
		]);
	});

	it("sums the run/walk segments: 55:57 run, 0:04 walk", () => {
		assert.deepEqual(figures(card(cards, "run-walk", "run-walk")), [
			["55:57", "", "Run Time"],
			["0:04", "", "Walk Time"],
		]);
	});
});

describe("chartsTabView: y axes (golden labels)", () => {
	const cards = tab();
	const bounds = (c: SeriesChart, bottom: number, top: number, tolerance = 0.01) => {
		near(c.y.bottom, bottom, tolerance);
		near(c.y.top, top, tolerance);
	};

	it("runs Pace fast-up from 0.98 × the best pace to three times as far past the average", () => {
		const pace = series(cards, "pace");
		bounds(pace, 403.75, 301.82);
		assert.deepEqual(labels(pace), ["5:00", "5:20", "5:40", "6:00", "6:20", "6:40"]);
		const gap = series(tab({ pace: "gap" }), "pace");
		bounds(gap, 503.72, 252.51);
		assert.deepEqual(labels(gap), ["4:10", "5:00", "5:50", "6:40", "7:30", "8:20"]);
	});

	it("runs Lap Average Pace from 0.98 × the fastest lap to 1.02 × the slowest", () => {
		const laps = series(tab({ pace: "lap-pace" }), "pace");
		bounds(laps, 362.22, 290.11);
		assert.deepEqual(labels(laps), ["5:00", "5:20", "5:40", "6:00"]);
	});

	it("pads the top 0.443 of the range for heart rate, cadence and stride, from 0.98 × the minimum", () => {
		const hr = series(cards, "heart-rate");
		bounds(hr, 74.48, 228.96);
		assert.deepEqual(labels(hr), ["200", "150", "100"]);
		bounds(series(tab({ heart: "zones" }), "heart-rate"), 74.48, 228.96);
		// Cadence skips its 0 spm samples: the bottom is 0.98 × 100.
		const cadence = series(cards, "cadence");
		bounds(cadence, 98, 271.72);
		assert.deepEqual(labels(cadence), ["250", "200", "150", "100"]);
		const stride = series(cards, "stride-length");
		bounds(stride, 0.344, 1.4982, 0.001);
		assert.deepEqual(labels(stride), ["1.5", "1", "0.5"]);
	});

	it("pads 0.405 for elevation, vertical oscillation and ground contact time", () => {
		const elevation = series(cards, "elevation");
		bounds(elevation, -21.364, 0.68);
		assert.deepEqual(labels(elevation), ["0", "-5", "-10", "-15", "-20"]);
		const vo = series(cards, "vertical-oscillation");
		bounds(vo, 4.3806, 11.7198);
		// "12" sits 5.7 pt above the plot and is drawn; "4" would sit 7.1 pt below and is not.
		assert.deepEqual(labels(vo), ["12", "10", "8", "6"]);
		const gct = series(cards, "ground-contact-time");
		bounds(gct, 213.64, 291.06);
		assert.deepEqual(labels(gct), ["291", "272", "252", "233", "214"]);
	});

	it("forces five labels on Vertical Ratio and Ground Contact Time, rounded half-even", () => {
		const vr = series(cards, "vertical-ratio");
		bounds(vr, 7.6146, 12.72);
		assert.deepEqual(labels(vr), ["13", "11", "10", "9", "8"]);
		assert.deepEqual(
			vr.y.labels.map((l) => Math.round(l.value * 100) / 100),
			[12.72, 11.44, 10.17, 8.89, 7.61],
		);
	});

	it("keeps Power's, Stamina's, Performance Condition's and Impact Load Factor's own rules", () => {
		const power = series(cards, "power");
		bounds(power, 0, 733.72);
		assert.deepEqual(labels(power), ["600", "400", "200", "0"]);
		const perKg = series(tab({ power: "per-kg" }), "power");
		bounds(perKg, 0, 10.79);
		assert.deepEqual(labels(perKg), ["10", "8", "6", "4", "2", "0"]);
		const stamina = series(cards, "stamina");
		bounds(stamina, 0, 100);
		assert.deepEqual(labels(stamina), ["100", "80", "60", "40", "20", "0"]);
		const performance = series(cards, "performance-condition");
		bounds(performance, -3, 3);
		assert.deepEqual(labels(performance), ["+2", "0", "-2"]);
		const impact = series(cards, "impact-load");
		bounds(impact, 0, 3.06);
		assert.deepEqual(labels(impact), ["3", "2", "1", "0"]);
	});

	it("widens Performance Condition past ±3 rather than leave the plot", () => {
		const detail = run();
		detail.samples = { ...detail.samples, performance: [null, null, null, -8, 1, 1, 1, 0, 0] };
		const performance = series(tab({}, "metric", detail), "performance-condition");
		assert.deepEqual([performance.y.bottom, performance.y.top], [-8, 8]);
		// A 16-point range steps by 5: ±10 would sit 17 pt past the plot.
		assert.deepEqual(labels(performance), ["+5", "0", "-5"]);
	});
});

describe("chartsTabView: x axes (golden ticks)", () => {
	const cards = tab();

	it("divides the timer time into five: 0:00 … 56:01, the 39 s pause closed", () => {
		for (const id of ["pace", "heart-rate", "elevation", "power", "stamina", "performance-condition", "cadence", "vertical-oscillation", "impact-load"]) {
			const c = series(cards, id);
			assert.deepEqual(ticks(c.x), ["0:00", "11:12", "22:24", "33:37", "44:49", "56:01"], id);
			assert.equal(c.x.title, "Time (h:m:s)");
		}
		assert.deepEqual(
			series(cards, "pace").x.ticks.map((t) => t.at),
			[0, 0.2, 0.4, 0.6, 0.8, 1],
		);
	});

	it("starts Stride Length, Vertical Ratio and Ground Contact Time at their first sample: 0:09", () => {
		for (const id of ["stride-length", "vertical-ratio", "ground-contact-time"]) assert.deepEqual(ticks(series(cards, id).x), ["0:09", "11:19", "22:30", "33:40", "44:51", "56:01"], id);
		// …and their dots from there: the first is at the axis' start.
		assert.equal(series(cards, "ground-contact-time").points.x[0], 0);
	});

	it("runs Run/Walk to the summary's 56:00.82 and draws only its first five ticks", () => {
		const rw = card(cards, "run-walk", "run-walk") as RunWalkChart;
		assert.deepEqual(ticks(rw.x), ["0:00", "11:12", "22:24", "33:36", "44:49"]);
		assert.deepEqual(
			rw.x.ticks.map((t) => t.at),
			[0, 0.2, 0.4, 0.6, 0.8],
		);
	});

	it("labels Distance mode 0.00 … 10.00 in 2 km steps on every chart, Run/Walk too", () => {
		const distance = tab({ axis: "distance" });
		for (const c of distance) {
			if (c.kind !== "series" && c.kind !== "run-walk") continue;
			assert.deepEqual(ticks(c.x), ["0.00", "2.00", "4.00", "6.00", "8.00", "10.00"], c.id);
			assert.equal(c.x.title, "Distance (km)");
		}
		// 10.00 sits 0.3 pt short of the plot's end: the run went on 9 m.
		near(series(distance, "pace").x.ticks[5]!.at, 10 / 10.009, 1e-9);
		// The dot charts start at 0 here.
		assert.equal(series(distance, "stride-length").x.ticks[0]!.text, "0.00");
	});
});

describe("chartsTabView: marks", () => {
	const cards = tab();

	it("draws the areas from each sample's place on the timer", () => {
		const hr = series(cards, "heart-rate");
		assert.equal(hr.mark, "area");
		assert.equal(hr.fill, "heart-rate");
		assert.deepEqual(hr.points.y, [76, 78, 87, 150, 169, 155, 155, 175, 182]);
		assert.deepEqual(
			hr.points.x.map((x) => Math.round(x * 3361)),
			[0, 4, 9, 360, 1566, 1567, 1569, 2400, 3361],
		);
	});

	it("draws pace as seconds per km, a stop at the slow end", () => {
		const pace = series(cards, "pace");
		near(pace.points.y[4]!, 1000 / 3.247);
		near(pace.points.y[1]!, 1000 / 0.616);
		const stopped = run();
		stopped.samples = { ...stopped.samples, speed: [0, ...RUN.samples.speed!.slice(1)] };
		assert.equal(series(tab({}, "metric", stopped), "pace").points.y[0], Infinity);
	});

	it("puts the average lines at the summary's averages, dashed on the dot charts", () => {
		const avg = (id: string, route: Partial<ChartsRoute> = {}) => series(tab(route), id).average;
		near(avg("pace")!.value, 335.8);
		near(avg("pace", { pace: "gap" })!.value, 336.25);
		near(avg("pace", { pace: "lap-pace" })!.value, 335.8);
		assert.deepEqual(avg("heart-rate"), { value: 167, dashed: false });
		assert.deepEqual(avg("heart-rate", { heart: "zones" }), { value: 167, dashed: false });
		assert.deepEqual(avg("power"), { value: 294, dashed: false });
		near(avg("power", { power: "per-kg" })!.value, 294 / 68);
		near(avg("stride-length")!.value, 1.0416);
		assert.equal(avg("stride-length")!.dashed, true);
		near(avg("ground-contact-time")!.value, 256.9);
		near(avg("cadence")!.value, 171.3);
		near(avg("vertical-ratio")!.value, 8.57);
		near(avg("vertical-oscillation")!.value, 8.92);
		assert.equal(avg("elevation"), undefined);
		assert.equal(avg("stamina"), undefined);
	});

	it("draws Impact Load Factor's white line at 1.0 and Performance Condition's steps from 0", () => {
		assert.equal(series(cards, "impact-load").reference, 1);
		const performance = series(cards, "performance-condition");
		assert.equal(performance.mark, "steps");
		assert.equal(performance.base, 0);
		assert.equal(performance.reference, 0);
		assert.deepEqual(performance.points.y, [null, null, null, 2, 1, 1, 1, 0, 0]);
	});

	it("colours the running-dynamics dots by Garmin's bands", () => {
		const colours = (id: string) => series(cards, id).colours;
		// Cadence: 100 red, (0 spm: none), 176 blue, 171 green, 170, 104 red, 219 purple, 163 orange, 171.
		assert.deepEqual(colours("cadence"), ["red", null, "blue", "green", "green", "red", "purple", "orange", "green"]);
		// GCT from 0:09: 246 green, 218 blue, 270 green, 245 green (rules out the newer 249–277 table).
		assert.deepEqual(colours("ground-contact-time"), ["green", "blue", "green", "green", "green", "green", "green"]);
		// VO: 5.44 purple, 8.83 green, 4.47 purple, 9.63 green, 8.07 blue, 8.27 green.
		assert.deepEqual(colours("vertical-oscillation"), ["purple", null, "green", "purple", "green", "blue", "green", "green", "green"]);
		// VR: 8.11 green, 8.58 green, 12.72 red, 7.77 green, 8.7 orange, 9.18 orange, 8.6 green.
		assert.deepEqual(colours("vertical-ratio"), ["green", "green", "red", "green", "orange", "orange", "green"]);
		// The documented edges: a value at a band's edge stays in it (10.1 % orange, 11.5 cm orange, 6.4 cm blue, 183 spm blue).
		const edges = run();
		edges.samples = { ...edges.samples, vr: [null, null, 10.1, 10.11, 6.1, 6.09, 7.4, 7.5, 10.2], vo: [6.4, null, 6.39, 11.5, 11.56, 8.1, 8.2, 9.7, 9.8], cadence: [183, 0, 184, 174, 173, 164, 163, 153, 152] };
		const at = (id: string) => series(tab({}, "metric", edges), id).colours;
		assert.deepEqual(at("vertical-ratio"), ["orange", "orange", "blue", "purple", "blue", "green", "red"]);
		assert.deepEqual(at("vertical-oscillation"), ["blue", null, "purple", "orange", "red", "blue", "green", "green", "orange"]);
		assert.deepEqual(at("cadence"), ["blue", null, "purple", "blue", "green", "green", "orange", "orange", "red"]);
		const stride = series(cards, "stride-length");
		assert.equal(stride.colours, undefined);
		assert.equal(stride.colour, "blue");
	});

	it("draws Lap Average Pace as one block per lap: as wide as its time, as high as its own average speed", () => {
		const laps = series(tab({ pace: "lap-pace" }), "pace");
		assert.equal(laps.mark, "blocks");
		assert.equal(laps.blocks!.length, 11);
		near(laps.blocks![0]!.to, 355.056 / 3361, 1e-9);
		// Lap 2 reads 5:44 from its speed, not 5:43 from 343.48 s over 1 km.
		near(laps.blocks![1]!.value, 1000 / 2.911, 0.001);
		// The 2.7 s last lap is a sliver, and the best pace.
		near(laps.blocks![10]!.to - laps.blocks![10]!.from, 2.664 / 3361, 1e-9);
		near(laps.blocks![10]!.value, 296.03);
		const distance = series(tab({ axis: "distance", pace: "lap-pace" }), "pace");
		near(distance.blocks![0]!.to, 1000 / 10009, 1e-9);
	});

	it("colours the Heart Rate Zones line through the zones' floors", () => {
		const zones = series(tab({ heart: "zones" }), "heart-rate");
		assert.equal(zones.mark, "line");
		assert.equal(zones.fill, undefined);
		assert.deepEqual(zones.stops, [
			{ value: 102, colour: "sky" },
			{ value: 122, colour: "blue" },
			{ value: 143, colour: "green" },
			{ value: 173.5, colour: "orange" },
			{ value: 184, colour: "orange" },
			{ value: 194.5, colour: "red" },
		]);
		assert.equal(zoneStops([]), null);
	});

	it("keys Stamina's area and Potential line", () => {
		const stamina = series(cards, "stamina");
		assert.equal(stamina.fill, "stamina");
		assert.deepEqual(stamina.line!.y, [100, 100, 100, 94, 77, 77, 77, 65, 53]);
		assert.deepEqual(stamina.legend, [
			{ label: "Stamina", colour: "orange", kind: "dot" },
			{ label: "Potential", colour: "white", kind: "dash" },
		]);
	});
});

describe("chartsTabView: Training Effect, Run/Walk and the zones", () => {
	const cards = tab();

	it("colours a Training Effect by its segment, 4.0 already orange and 5 the red cap", () => {
		assert.deepEqual([0, 1.9, 2, 3, 3.9, 4, 4.3, 5].map(teColour), ["grey", "grey", "blue", "green", "green", "orange", "orange", "red"]);
	});

	it("lays the run/walk segments on the timer: the zero-length ones inside the pause take no width", () => {
		const rw = card(cards, "run-walk", "run-walk") as RunWalkChart;
		assert.deepEqual(
			rw.lanes.map((l) => [l.label, l.colour]),
			[
				["Idle", "yellow"],
				["Walk", "green"],
				["Run", "blue"],
			],
		);
		assert.deepEqual(
			rw.bars.map((b) => b.lane),
			["run", "walk", "run"],
		);
		// The first run ends at 26:06; the walk falls on the timer just after the pause.
		near(rw.bars[0]!.from, 0);
		near(rw.bars[0]!.to, 1566 / 3360.82, 1e-6);
		near(rw.bars[1]!.from * 3360.82, 1566.97, 0.01);
		near(rw.bars[1]!.to * 3360.82, 1569, 0.01);
		near(rw.bars[2]!.to, 1);
		assert.deepEqual(
			rw.legend.map((k) => k.label),
			["Run", "Walk", "Idle"],
		);
	});

	it("reads the heart-rate zones as the phone does", () => {
		const hr = card(cards, "time-in-hr-zones", "zones") as ZonesChart;
		assert.deepEqual(
			hr.rows.map((r) => [r.title, r.range, r.name, r.time, r.percent, r.fill, r.colour]),
			[
				["Zone 5", "> 183 bpm", "Maximum", "0:00", "0%", 0, "zone-5"],
				["Zone 4", "163 - 183 bpm", "Threshold", "41:33", "74%", 0.74, "zone-4"],
				["Zone 3", "143 - 162 bpm", "Aerobic", "12:39", "22%", 0.22, "zone-3"],
				["Zone 2", "122 - 142 bpm", "Easy", "1:12", "2%", 0.02, "zone-2"],
				["Zone 1", "102 - 121 bpm", "Warm Up", "0:04", "0%", 0, "zone-1"],
			],
		);
	});

	it("reads the power zones, Zone 1 as the web confirms it", () => {
		const power = card(cards, "time-in-power-zones", "zones") as ZonesChart;
		assert.deepEqual(
			power.rows.map((r) => [r.title, r.range, r.name, r.time, r.percent]),
			[
				["Zone 5", "> 406 Watts", "Short Interval", "0:13", "0%"],
				["Zone 4", "354 - 406 Watts", "Long Interval", "2:21", "4%"],
				["Zone 3", "318 - 353 Watts", "Tempo", "7:25", "13%"],
				["Zone 2", "280 - 317 Watts", "Moderate", "26:34", "47%"],
				["Zone 1", "227 - 279 Watts", "Easy", "19:15", "34%"],
			],
		);
	});
});

describe("chartsTabView: what an activity lacks", () => {
	/** A treadmill run: no elevation, no grade-adjusted pace, no Performance Condition, no zones, no weigh-in. */
	const treadmill = run({ hrZones: [], powerZones: [], weightKg: null });
	treadmill.samples = { ...treadmill.samples, elevation: [], gap: [], performance: [] };
	const cards = tab({ pace: "gap", heart: "zones", power: "per-kg" }, "metric", treadmill);

	it("leaves out the cards it has no data for, never showing 0", () => {
		const ids = cards.map((c) => c.id);
		for (const gone of ["elevation", "performance-condition", "time-in-hr-zones", "time-in-power-zones"]) assert.ok(!ids.includes(gone as never), gone);
		assert.ok(ids.includes("impact-load"));
	});

	it("falls back to a choice it has, and drops a picker left with one choice", () => {
		const pace = series(cards, "pace");
		assert.equal(pace.metric, "pace");
		assert.deepEqual(pace.picker?.options.map((o) => o.value), ["pace", "lap-pace"]);
		const hr = series(cards, "heart-rate");
		assert.equal(hr.metric, "heart-rate");
		assert.equal(hr.picker, undefined);
		const power = series(cards, "power");
		assert.equal(power.title, "Power (W)");
		assert.equal(power.picker, undefined);
	});

	it("leaves a figure out when the summary has no value for it", () => {
		const bare = run();
		bare.summary = { ...bare.summary };
		delete bare.summary.impactLoad;
		assert.deepEqual(figures(series(tab({}, "metric", bare), "impact-load")), [["10.01", "km", "Actual Distance"]]);
	});
});

describe("chartsTabView: imperial", () => {
	const cards = tab({}, "imperial");

	it("paces per mile and measures in miles and feet", () => {
		assert.deepEqual(figures(series(cards, "pace")), [
			["9:00", "/mi", "Average"],
			["8:16", "/mi", "Best"],
		]);
		assert.deepEqual(figures(series(cards, "elevation")), [
			["-72", "ft", "Minimum"],
			["-19", "ft", "Maximum"],
		]);
		assert.deepEqual(figures(series(cards, "stride-length")), [["3.42", "ft", "Average"]]);
		assert.deepEqual(figures(series(cards, "vertical-oscillation")), [["3.5", "in", "Average"]]);
		assert.deepEqual(figures(series(cards, "impact-load")), [
			["6.58", "mi", "Impact Load"],
			["6.22", "mi", "Actual Distance"],
		]);
	});

	it("bands vertical oscillation in centimetres whatever the units", () => {
		assert.deepEqual(series(cards, "vertical-oscillation").colours, series(tab(), "vertical-oscillation").colours);
	});

	it("labels Distance mode in miles", () => {
		const pace = series(tab({ axis: "distance" }, "imperial"), "pace");
		assert.deepEqual(ticks(pace.x), ["0.00", "1.00", "2.00", "3.00", "4.00", "5.00", "6.00"]);
		assert.equal(pace.x.title, "Distance (mi)");
	});
});

describe("expandedChartView: the landscape chart", () => {
	const open = (sub: string) => expandedChartView(RUN, { axis: "time", sub }, "metric")!;
	const right = (sub: string) => open(sub).secondary!.y.labels.map((l) => l.text);
	/** The primary of a chart of samples. */
	const primary = (sub: string) => {
		const p = open(sub).primary;
		assert.equal(p.kind, "series");
		return p as SeriesChart;
	};

	it("titles the primary alone, or primary & overlay, swapped by the swap button", () => {
		assert.equal(open("chart:heart-rate").title, "Heart Rate");
		assert.equal(open("chart:heart-rate:cadence").title, "Heart Rate & Cadence");
		assert.equal(open("chart:heart-rate:elevation:swap").title, "Elevation & Heart Rate");
		assert.equal(open("chart:heart-rate:gap:swap").title, "Grade-Adjusted Pace & Heart Rate");
		assert.equal(open("chart:heart-rate:ground-contact-time:swap").title, "Ground Contact Time & Heart Rate");
		assert.equal(open("chart:heart-rate:heart-rate-zones").title, "Heart Rate & Heart Rate Zones");
		assert.equal(open("chart:heart-rate").swap, null);
		assert.equal(open("chart:heart-rate:elevation").swap, "chart:heart-rate:elevation:swap");
		assert.equal(open("chart:heart-rate:elevation:swap").swap, "chart:heart-rate:elevation");
	});

	it("labels the overlay's axis with five even values, half-even (golden)", () => {
		assert.deepEqual(right("chart:heart-rate:cadence"), ["272", "228", "185", "141", "98"]);
		assert.deepEqual(right("chart:heart-rate:ground-contact-time"), ["291", "272", "252", "233", "214"]);
		assert.deepEqual(right("chart:heart-rate:elevation"), ["1", "-5", "-10", "-16", "-21"]);
		assert.deepEqual(right("chart:heart-rate:elevation:swap"), ["229", "190", "152", "113", "74"]);
		assert.deepEqual(right("chart:heart-rate:ground-contact-time:swap"), ["229", "190", "152", "113", "74"]);
		// A pace overlay shows its top label only: 0.98 × the best GAP pace.
		assert.deepEqual(right("chart:heart-rate:gap"), ["4:13"]);
	});

	it("keeps the primary's portrait axis on the left", () => {
		assert.deepEqual(labels(primary("chart:heart-rate")), ["200", "150", "100"]);
		assert.deepEqual(labels(primary("chart:heart-rate:elevation:swap")), ["0", "-5", "-10", "-15", "-20"]);
		assert.deepEqual(labels(primary("chart:heart-rate:gap:swap")), ["4:10", "5:00", "5:50", "6:40", "7:30", "8:20"]);
		assert.deepEqual(labels(primary("chart:heart-rate:ground-contact-time:swap")), ["291", "272", "252", "233", "214"]);
	});

	it("draws each overlay in its colour: HR a crimson line, GAP blue, elevation green, cadence and GCT banded dots", () => {
		const of = (sub: string) => {
			const s = open(sub).secondary!;
			return [s.metric, s.mark, s.colour];
		};
		assert.deepEqual(of("chart:heart-rate:elevation:swap"), ["heart-rate", "line", "crimson"]);
		assert.deepEqual(of("chart:heart-rate:gap"), ["gap", "line", "blue"]);
		assert.deepEqual(of("chart:heart-rate:elevation"), ["elevation", "line", "green"]);
		assert.deepEqual(of("chart:heart-rate:cadence"), ["cadence", "dots", "deep-orange"]);
		assert.deepEqual(of("chart:heart-rate:ground-contact-time"), ["ground-contact-time", "dots", "green"]);
		assert.deepEqual(of("chart:heart-rate:heart-rate-zones"), ["heart-rate-zones", "zones", "crimson"]);
		assert.ok(open("chart:heart-rate:ground-contact-time").secondary!.colours);
	});

	it("dims an area primary and drops its average while an overlay is on; dots keep theirs", () => {
		assert.equal(open("chart:heart-rate").dim, false);
		assert.deepEqual(primary("chart:heart-rate").average, { value: 167, dashed: false });
		assert.equal(open("chart:heart-rate:cadence").dim, true);
		assert.equal(primary("chart:heart-rate:cadence").average, undefined);
		assert.equal(open("chart:heart-rate:ground-contact-time:swap").dim, false);
		near(primary("chart:heart-rate:ground-contact-time:swap").average!.value, 256.9);
	});

	it("runs every chart from 0:00, the dot charts too", () => {
		assert.deepEqual(ticks(open("chart:heart-rate:ground-contact-time:swap").x!), ["0:00", "11:12", "22:24", "33:37", "44:49", "56:01"]);
	});

	it("opens the ids the Stats and Overview badges use", () => {
		for (const id of [
			"pace",
			"gap",
			"run-walk",
			"heart-rate",
			"stamina",
			"training-effect",
			"power",
			"cadence",
			"stride-length",
			"vertical-ratio",
			"vertical-oscillation",
			"ground-contact-time",
			"impact-load",
			"elevation",
		]) {
			const view = open(`chart:${id}`);
			assert.ok(view, id);
			assert.equal(view.ref.base, id);
		}
	});

	it("opens Run/Walk on the activity's whole time axis, with overlays but no swap", () => {
		const alone = open("chart:run-walk");
		assert.equal(alone.title, "Run/Walk");
		assert.equal(alone.primary.kind, "run-walk");
		assert.deepEqual(ticks(alone.x!), ["0:00", "11:12", "22:24", "33:37", "44:49", "56:01"]);
		assert.ok(alone.chips.length > 0);
		const overlaid = open("chart:run-walk:heart-rate:swap");
		assert.equal(overlaid.title, "Run/Walk & Heart Rate");
		assert.equal(overlaid.ref.swapped, false);
		assert.equal(overlaid.swap, null);
		assert.equal(overlaid.dim, true);
		assert.deepEqual(right("chart:run-walk:heart-rate"), ["229", "190", "152", "113", "74"]);
	});

	it("opens Training Effect as its two scales, nothing to overlay", () => {
		const te = open("chart:training-effect:heart-rate");
		assert.equal(te.title, "Training Effect");
		assert.equal(te.primary.kind, "training-effect");
		assert.deepEqual([te.secondary, te.chips, te.swap, te.x], [null, [], null, null]);
	});

	it("lists the other charts as chips, alphabetically, the overlay's selected and staying so when swapped", () => {
		const chips = open("chart:heart-rate:elevation:swap").chips;
		assert.deepEqual(
			chips.slice(0, 5).map((c) => c.label),
			["Cadence", "Elevation", "Grade-Adjusted Pace", "Ground Contact Time", "Heart Rate Zones"],
		);
		assert.ok(!chips.some((c) => c.metric === "heart-rate"));
		assert.deepEqual(
			chips.filter((c) => c.selected).map((c) => c.metric),
			["elevation"],
		);
		assert.equal(chips.find((c) => c.metric === "elevation")!.sub, "chart:heart-rate");
		assert.equal(chips.find((c) => c.metric === "cadence")!.sub, "chart:heart-rate:cadence");
		assert.equal(open("chart:heart-rate").chips.filter((c) => c.selected).length, 0);
	});

	it("opens nothing for a sub that is not a chart the activity has", () => {
		assert.equal(expandedChartView(RUN, { axis: "time", sub: "map" }, "metric"), null);
		assert.equal(expandedChartView(RUN, { axis: "time" }, "metric"), null);
		const treadmill = run();
		treadmill.samples = { ...treadmill.samples, gap: [] };
		assert.equal(expandedChartView(treadmill, { axis: "time", sub: "chart:gap" }, "metric"), null);
		assert.equal(expandedChartView(treadmill, { axis: "time", sub: "chart:heart-rate:gap" }, "metric")!.secondary, null);
	});
});

describe("chart subs", () => {
	it("reads and writes chart:<base>[:<overlay>[:swap]]", () => {
		assert.deepEqual(readChartSub("chart:pace"), { base: "pace", overlay: null, swapped: false });
		assert.deepEqual(readChartSub("chart:heart-rate:cadence:swap"), { base: "heart-rate", overlay: "cadence", swapped: true });
		assert.deepEqual(readChartSub("chart:heart-rate:heart-rate"), { base: "heart-rate", overlay: null, swapped: false });
		for (const bad of [undefined, "", "chart", "chart:nope", "graph:pace", "chart:pace:cadence:swap:more"]) assert.equal(readChartSub(bad), null, String(bad));
		for (const sub of ["chart:pace", "chart:heart-rate:cadence", "chart:heart-rate:cadence:swap"]) assert.equal(chartSub(readChartSub(sub)!), sub);
	});
});

describe("numbers", () => {
	it("picks nice steps at 1.5, 3 and 7", () => {
		assert.deepEqual([0.2885, 1.5, 2.0018, 18.03, 25.48, 38.6, 62.8, 0.765].map(niceStep), [0.2, 2, 2, 20, 20, 50, 50, 1]);
	});

	it("rounds half-even like NumberFormatter, and elevation half away from zero", () => {
		assert.deepEqual([252.5, 228.5, 151.5, -2.5, -3.5, 0.5, 1.2].map((v) => roundHalfEven(v)), [252, 228, 152, -2, -4, 0, 1]);
		assert.deepEqual([-21.8, -5.8, -21.5, 21.5, 0.4].map(roundHalfAway), [-22, -6, -22, 22, 0]);
	});

	it("forces five labels from bottom to top, top first", () => {
		assert.deepEqual(
			forcedLabels(0, 100, String).map((l) => l.text),
			["100", "75", "50", "25", "0"],
		);
	});
});
