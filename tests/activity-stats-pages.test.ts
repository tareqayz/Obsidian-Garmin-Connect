import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { columnStarts, gearView, lapsView, lapTime, NO_GEAR, sectionHeight, statsView, type StatsSection } from "../src/dashboard/activity-stats-pages";
import { pace } from "../src/sync/metrics";
import { buildActivityDetail, type ActivityDetail } from "../src/sync/activity-detail";

// The captured runs' values (spec: ref/activity-details/outdoor-run, "Golden numbers"
// and "Treadmill differences"), with made-up ids and no GPS: these tabs read none.

/** The outdoor run: 10,009 m in 3,360.82 s, a 39 s pause, eleven laps. */
const RUN_DTO = {
	startTimeLocal: "2026-10-10T08:19:48.0",
	startTimeGMT: "2026-10-10T04:19:48.0",
	distance: 10009,
	duration: 3360.82,
	movingDuration: 3357.895,
	elapsedDuration: 3399.14,
	averageSpeed: 2.977999925613403,
	averageMovingSpeed: 2.980736426178451,
	avgGradeAdjustedSpeed: 2.9739999771118164,
	maxSpeed: 3.246999979019165,
	averageHR: 167,
	maxHR: 182,
	calories: 694,
	bmrCalories: 77,
	averagePower: 294,
	maxPower: 442,
	averageRunCadence: 171.296875,
	maxRunCadence: 219,
	strideLength: 104.15999755859376,
	verticalOscillation: 8.919999694824218,
	verticalRatio: 8.569999694824219,
	groundContactTime: 256.8999938964844,
	elevationGain: 87,
	elevationLoss: 90,
	minElevation: -21.8,
	maxElevation: -5.8,
	trainingEffect: 4.300000190734863,
	anaerobicTrainingEffect: 0,
	trainingEffectLabel: "LACTATE_THRESHOLD",
	activityTrainingLoad: 171.5507354736328,
	beginPotentialStamina: 100,
	endPotentialStamina: 53,
	minAvailableStamina: 53,
	impactLoad: 10590,
	waterEstimated: 933,
	moderateIntensityMinutes: 0,
	vigorousIntensityMinutes: 56,
	differenceBodyBattery: -19,
};

const summary = (dto: Record<string, unknown>, typeKey = "running", wind = true) => ({
	activityName: "Test Run",
	activityTypeDTO: { typeKey },
	metadataDTO: { runPowerWindDataEnabled: wind },
	summaryDTO: dto,
});

/** One active interval; run, the pause's empty walk and idle, a walk, run. */
const RUN_TYPED = {
	splits: [
		{ type: "INTERVAL_ACTIVE", startTimeGMT: "2026-10-10T04:19:48.0", endTimeGMT: "2026-10-10T05:16:27.0", duration: 3360.82, distance: 10009.02, averageSpeed: 2.977999925613403 },
		{ type: "RWD_RUN", startTimeGMT: "2026-10-10T04:19:48.0", endTimeGMT: "2026-10-10T04:45:54.0", duration: 1565.904, distance: 4605.95, averageSpeed: 2.940999984741211 },
		{ type: "RWD_WALK", startTimeGMT: "2026-10-10T04:46:07.0", endTimeGMT: "2026-10-10T04:46:07.0", duration: 0, distance: null, averageSpeed: null },
		{ type: "RWD_STAND", startTimeGMT: "2026-10-10T04:46:27.0", endTimeGMT: "2026-10-10T04:46:27.0", duration: 0, distance: null, averageSpeed: null },
		{ type: "RWD_WALK", startTimeGMT: "2026-10-10T04:46:32.0", endTimeGMT: "2026-10-10T04:46:35.0", duration: 3.776, distance: 4.79, averageSpeed: 1.2690000534057617 },
		{ type: "RWD_RUN", startTimeGMT: "2026-10-10T04:46:36.0", endTimeGMT: "2026-10-10T05:16:27.0", duration: 1791.083, distance: 5398.27, averageSpeed: 3.013999938964844 },
	],
};

/** lapIndex, duration (s), distance (m), averageSpeed (m/s). */
const RUN_LAPS: Array<[number, number, number, number]> = [
	[1, 355.056, 1000, 2.815999984741211],
	[2, 343.48, 1000, 2.9110000133514404],
	[3, 336.132, 1000, 2.9749999046325684],
	[4, 329.454, 1000, 3.0350000858306885],
	[5, 337.242, 1000, 2.9649999141693115],
	[6, 341.793, 1000, 2.9260001182556152],
	[7, 324.648, 1000, 3.0799999237060547],
	[8, 325.01, 1000, 3.0769999027252197],
	[9, 333.324, 1000, 3.0000000000000004],
	[10, 332.017, 1000, 3.01200008392334],
	[11, 2.664, 9, 3.378000020980835],
];

const lapDTOs = (laps: Array<[number, number, number, number]>) => ({
	lapDTOs: laps.map(([lapIndex, duration, distance, averageSpeed]) => ({ lapIndex, duration, distance, averageSpeed })),
});

function outdoor(payloads: Record<string, unknown> = {}): ActivityDetail {
	return buildActivityDetail(1, { summary: summary(RUN_DTO), laps: lapDTOs(RUN_LAPS), segments: RUN_TYPED, gear: [], ...payloads }, null)!;
}

/** The treadmill run: 5,436.87 m indoors, no elevation, grade or impact load; respiration, GCT balance and step speed loss. */
const TREADMILL_DTO = {
	startTimeLocal: "2026-09-22T14:06:02.0",
	startTimeGMT: "2026-09-22T11:06:02.0",
	distance: 5436.87,
	duration: 1566.347,
	movingDuration: 1562.456,
	elapsedDuration: 1566.347,
	averageSpeed: 3.4709999561309814,
	averageMovingSpeed: 3.4796948773440066,
	maxSpeed: 4.497000217437744,
	averageHR: 174,
	maxHR: 196,
	calories: 344,
	bmrCalories: 36,
	averagePower: 344,
	maxPower: 454,
	averageRunCadence: 171.734375,
	maxRunCadence: 182,
	strideLength: 121.21999511718751,
	verticalOscillation: 10.36999969482422,
	verticalRatio: 8.449999809265137,
	groundContactTime: 250.39999389648438,
	groundContactBalanceLeft: 49.09000015258789,
	stepSpeedLoss: 0.26040000915527345,
	stepSpeedLossPercent: 7.380000114440918,
	avgRespirationRate: 35.65999984741211,
	minRespirationRate: 15.3100004196167,
	maxRespirationRate: 44.650001525878906,
	trainingEffect: 3.700000047683716,
	anaerobicTrainingEffect: 0,
	trainingEffectLabel: "TEMPO",
	activityTrainingLoad: 134.14447021484375,
	beginPotentialStamina: 100,
	endPotentialStamina: 74,
	minAvailableStamina: 74,
	waterEstimated: 435,
	moderateIntensityMinutes: 0,
	vigorousIntensityMinutes: 25,
	differenceBodyBattery: -8,
};

const TREADMILL_TYPED = {
	splits: [
		{ type: "INTERVAL_ACTIVE", startTimeGMT: "2026-09-22T11:06:02.0", endTimeGMT: "2026-09-22T11:32:08.0", duration: 1566.347, distance: 5436.88, averageSpeed: 3.4709999561309814 },
		{ type: "RWD_RUN", startTimeGMT: "2026-09-22T11:06:02.0", endTimeGMT: "2026-09-22T11:06:10.0", duration: 10.003, distance: 3.22, averageSpeed: 0.3219999969005584 },
		{ type: "RWD_WALK", startTimeGMT: "2026-09-22T11:06:11.0", endTimeGMT: "2026-09-22T11:06:19.0", duration: 8.999, distance: 11.75, averageSpeed: 1.3049999475479126 },
		{ type: "RWD_RUN", startTimeGMT: "2026-09-22T11:06:20.0", endTimeGMT: "2026-09-22T11:32:08.0", duration: 1547.307, distance: 5421.91, averageSpeed: 3.503999948501587 },
	],
};

const treadmill = buildActivityDetail(2, { summary: summary(TREADMILL_DTO, "treadmill_running", false), segments: TREADMILL_TYPED, gear: [] }, null)!;

/** Each section as its title and its rows' label and text. */
const table = (sections: StatsSection[]): Array<[string, Array<[string, string]>]> => sections.map((s) => [s.title, s.rows.map((r) => [r.label, r.text])]);
const bySection = (sections: StatsSection[]) => Object.fromEntries(table(sections));
const without = (dto: Record<string, unknown>, ...keys: string[]) => Object.fromEntries(Object.entries(dto).filter(([key]) => !keys.includes(key)));
const rowOf = (sections: StatsSection[], label: string) => sections.flatMap((s) => s.rows).find((r) => r.label === label);
const withSummary = (detail: ActivityDetail, over: Record<string, number | string>): ActivityDetail => ({ ...detail, summary: { ...detail.summary, ...over } });

describe("statsView, the outdoor run", () => {
	const view = statsView(outdoor(), "metric");

	it("reads every row as the phone did, in its order", () => {
		assert.deepEqual(table(view), [
			["Pace", [["Avg Pace", "5:36 /km"], ["Avg Moving Pace", "5:35 /km"], ["Avg Grade-Adj Pace", "5:36 /km"], ["Best Pace", "5:08 /km"]]],
			["Speed", [["Avg Speed", "10.7 km/h"], ["Avg Moving Speed", "10.7 km/h"], ["Avg Grade-Adj Speed", "10.7 km/h"], ["Max Speed", "11.7 km/h"]]],
			["Timing", [["Total Time", "56:01"], ["Moving Time", "55:58"], ["Elapsed Time", "56:39"]]],
			["Run/Walk Detection", [["Run Time", "55:57"], ["Walk Time", "0:04"], ["Idle Time", "0:00"]]],
			["Heart Rate", [["Avg Heart Rate", "167 bpm"], ["Max Heart Rate", "182 bpm"]]],
			["Stamina", [["Beginning Potential", "100%"], ["Ending Potential", "53%"], ["Min Stamina", "53%"]]],
			["Training Effect", [["Primary Benefit", "Threshold (High Aerobic)"], ["Aerobic", "4.3"], ["Anaerobic", "0.0"], ["Exercise Load", "172"]]],
			["Power", [["Avg Power", "294 W"], ["Max Power", "442 W"], ["Wind Data", "Enabled"]]],
			[
				"Running Dynamics",
				[
					["Avg Run Cadence", "171 spm"],
					["Max Run Cadence", "219 spm"],
					["Avg Stride Length", "1.04 m"],
					["Avg Vertical Ratio", "8.6%"],
					["Avg Vertical Oscillation", "8.9 cm"],
					["Avg Ground Contact Time", "257 ms"],
				],
			],
			["Impact Load", [["Impact Load", "10.59 km"], ["Actual Distance", "10.01 km"]]],
			["Elevation", [["Total Ascent", "87 m"], ["Total Descent", "90 m"], ["Min Elevation", "-22 m"], ["Max Elevation", "-6 m"]]],
			["Workout Intervals", [["Run Time", "56:01"], ["Run Distance", "10.01 km"], ["Run Pace", "5:36 /km"]]],
			["Nutrition & Hydration", [["Resting Calories", "77"], ["Active Calories", "617"], ["Total Calories Burned", "694"], ["Est. Sweat Loss", "933 ml"]]],
			["Intensity Minutes", [["Moderate", "0 min"], ["Vigorous", "56 min"], ["Total", "112 min"]]],
			["Body Battery", [["Net Impact", "-19"]]],
		]);
	});

	it("heads the sections as the phone does, HELP on nine of them", () => {
		assert.deepEqual(
			view.map((s) => s.title.toUpperCase()),
			[
				"PACE",
				"SPEED",
				"TIMING",
				"RUN/WALK DETECTION",
				"HEART RATE",
				"STAMINA",
				"TRAINING EFFECT",
				"POWER",
				"RUNNING DYNAMICS",
				"IMPACT LOAD",
				"ELEVATION",
				"WORKOUT INTERVALS",
				"NUTRITION & HYDRATION",
				"INTENSITY MINUTES",
				"BODY BATTERY",
			],
		);
		assert.deepEqual(
			view.filter((s) => s.help).map((s) => s.id),
			["pace", "run-walk", "heart-rate", "stamina", "training-effect", "power", "running-dynamics", "impact-load", "nutrition"],
		);
	});

	it("puts the waveform badge on the fifteen rows the shots show it on, each with the chart it opens", () => {
		assert.deepEqual(
			view.flatMap((s) => s.rows.filter((r) => r.chart).map((r) => [r.label, r.chart])),
			[
				["Avg Pace", "pace"],
				["Avg Grade-Adj Pace", "gap"],
				["Run Time", "run-walk"],
				["Avg Heart Rate", "heart-rate"],
				["Beginning Potential", "stamina"],
				["Aerobic", "training-effect"],
				["Anaerobic", "training-effect"],
				["Avg Power", "power"],
				["Avg Run Cadence", "cadence"],
				["Avg Stride Length", "stride-length"],
				["Avg Vertical Ratio", "vertical-ratio"],
				["Avg Vertical Oscillation", "vertical-oscillation"],
				["Avg Ground Contact Time", "ground-contact-time"],
				["Impact Load", "impact-load"],
				["Total Ascent", "elevation"],
			],
		);
		// Workout Intervals' Run Time has none: only Run/Walk Detection's does.
		assert.equal(view.find((s) => s.id === "workout-intervals")!.rows[0]!.chart, undefined);
	});

	it("splits value and unit, sets Primary Benefit on two lines and marks Vigorous minutes x2", () => {
		assert.deepEqual(rowOf(view, "Avg Pace"), { label: "Avg Pace", value: "5:36", unit: "/km", text: "5:36 /km", chart: "pace" });
		assert.deepEqual(rowOf(view, "Ending Potential"), { label: "Ending Potential", value: "53", unit: "%", text: "53%" });
		assert.deepEqual(rowOf(view, "Primary Benefit"), { label: "Primary Benefit", value: "Threshold", sub: "(High Aerobic)", text: "Threshold (High Aerobic)" });
		assert.deepEqual(rowOf(view, "Vigorous"), { label: "Vigorous", value: "56", unit: "min", text: "56 min", badge: "x2" });
		assert.deepEqual(rowOf(view, "Net Impact"), { label: "Net Impact", value: "-19", text: "-19" });
	});

	it("rounds each figure from Garmin's exact value", () => {
		const raw = (over: Record<string, number>, label: string) => rowOf(statsView(withSummary(outdoor(), over), "metric"), label)?.text;
		// The treadmill run's vertical ratio, 8.449999809: the web reads 8.4, where ×10 first would make 8.5.
		assert.equal(raw({ verticalRatio: 8.449999809265137 }, "Avg Vertical Ratio"), "8.4%");
		// Garmin's float for 8.65 sits below it: 8.6, as the web would read it.
		assert.equal(raw({ verticalRatio: 8.649999618530273 }, "Avg Vertical Ratio"), "8.6%");
		// Elevation halves go away from zero (spec, Field map).
		assert.equal(raw({ minElevation: -21.5 }, "Min Elevation"), "-22 m");
		assert.equal(raw({ differenceBodyBattery: 3 }, "Net Impact"), "+3");
		assert.equal(raw({ calories: 1234, bmrCalories: 77 }, "Active Calories"), "1,157");
	});
});

describe("statsView, the treadmill run", () => {
	const view = statsView(treadmill, "metric");

	it("drops what an indoor run has no data for: elevation, impact load, grade-adjusted rows", () => {
		assert.deepEqual(
			view.map((s) => s.id),
			["pace", "speed", "timing", "run-walk", "heart-rate", "stamina", "training-effect", "power", "running-dynamics", "workout-intervals", "nutrition", "respiration", "intensity-minutes", "body-battery"],
		);
		assert.equal(rowOf(view, "Avg Grade-Adj Pace"), undefined);
		assert.equal(rowOf(view, "Avg Grade-Adj Speed"), undefined);
	});

	it("reads its rows as the web does, with the phone's formats", () => {
		const sections = bySection(view);
		assert.deepEqual(sections["Pace"], [["Avg Pace", "4:48 /km"], ["Avg Moving Pace", "4:47 /km"], ["Best Pace", "3:42 /km"]]);
		assert.deepEqual(sections["Timing"], [["Total Time", "26:06"], ["Moving Time", "26:02"], ["Elapsed Time", "26:06"]]);
		// No idle split at all: Idle Time still reads 0:00, as outdoors (Inferred).
		assert.deepEqual(sections["Run/Walk Detection"], [["Run Time", "25:57"], ["Walk Time", "0:09"], ["Idle Time", "0:00"]]);
		assert.deepEqual(sections["Training Effect"], [["Primary Benefit", "Tempo (High Aerobic)"], ["Aerobic", "3.7"], ["Anaerobic", "0.0"], ["Exercise Load", "134"]]);
		assert.deepEqual(sections["Power"], [["Avg Power", "344 W"], ["Max Power", "454 W"], ["Wind Data", "Disabled"]]);
		assert.deepEqual(sections["Workout Intervals"], [["Run Time", "26:06"], ["Run Distance", "5.44 km"], ["Run Pace", "4:48 /km"]]);
		assert.deepEqual(sections["Nutrition & Hydration"], [["Resting Calories", "36"], ["Active Calories", "308"], ["Total Calories Burned", "344"], ["Est. Sweat Loss", "435 ml"]]);
		assert.deepEqual(sections["Intensity Minutes"], [["Moderate", "0 min"], ["Vigorous", "25 min"], ["Total", "50 min"]]);
		assert.deepEqual(sections["Body Battery"], [["Net Impact", "-8"]]);
	});

	it("adds the web's respiration, GCT balance and step speed loss rows (their place on the phone Inferred)", () => {
		const sections = bySection(view);
		assert.deepEqual(sections["Running Dynamics"], [
			["Avg Run Cadence", "172 spm"],
			["Max Run Cadence", "182 spm"],
			["Avg Stride Length", "1.21 m"],
			["Avg Vertical Ratio", "8.4%"],
			["Avg Vertical Oscillation", "10.4 cm"],
			["Avg GCT Balance", "49.1% L / 50.9% R"],
			["Avg Ground Contact Time", "250 ms"],
			["Avg Step Speed Loss", "26.0 cm/s"],
			["Avg Step Speed Loss %", "7.38%"],
		]);
		assert.deepEqual(sections["Respiration Rate"], [["Avg Respiration Rate", "36 brpm"], ["Min Respiration Rate", "15 brpm"], ["Max Respiration Rate", "45 brpm"]]);
		assert.equal(view.find((s) => s.id === "respiration")!.help, false);
		assert.equal(rowOf(view, "Avg GCT Balance")!.chart, undefined);
	});
});

describe("statsView, edge states", () => {
	it("leaves out a metric Garmin did not send rather than show 0", () => {
		const bare = buildActivityDetail(3, { summary: summary({ startTimeGMT: "2026-10-10T04:19:48.0", distance: 5000, duration: 1500, averageSpeed: 3.3333 }) }, null)!;
		assert.deepEqual(table(statsView(bare, "metric")), [
			["Pace", [["Avg Pace", "5:00 /km"]]],
			["Speed", [["Avg Speed", "12.0 km/h"]]],
			["Timing", [["Total Time", "25:00"]]],
		]);
	});

	it("shows Wind Data only beside a power figure", () => {
		const view = statsView(outdoor({ summary: summary(without(RUN_DTO, "averagePower", "maxPower")) }), "metric");
		assert.equal(view.find((s) => s.id === "power"), undefined);
		assert.equal(rowOf(view, "Wind Data"), undefined);
	});

	it("has no run/walk or workout sections without typed splits", () => {
		const view = statsView(outdoor({ segments: null }), "metric");
		assert.equal(view.find((s) => s.id === "run-walk"), undefined);
		assert.equal(view.find((s) => s.id === "workout-intervals"), undefined);
	});

	it("gives a ride speeds, not paces (Inferred: only runs are specified)", () => {
		const ride = statsView(outdoor({ summary: summary(RUN_DTO, "road_biking") }), "metric");
		assert.equal(ride.find((s) => s.id === "pace"), undefined);
		assert.equal(rowOf(ride, "Run Pace"), undefined);
		assert.equal(rowOf(ride, "Avg Speed")?.text, "10.7 km/h");
	});

	it("writes imperial through the plugin's helpers: /mi, mph, mi, ft", () => {
		const view = statsView(outdoor(), "imperial");
		const text = (label: string) => rowOf(view, label)?.text;
		assert.equal(text("Avg Pace"), "9:00 /mi");
		assert.equal(text("Best Pace"), "8:16 /mi");
		assert.equal(text("Avg Speed"), "6.7 mph");
		assert.equal(text("Max Speed"), "7.3 mph");
		assert.equal(text("Impact Load"), "6.58 mi");
		assert.equal(text("Run Distance"), "6.22 mi");
		assert.equal(text("Total Ascent"), "285 ft");
		assert.equal(text("Min Elevation"), "-72 ft");
		// Inferred: no imperial shots.
		assert.equal(text("Avg Stride Length"), "3.42 ft");
		assert.equal(text("Avg Vertical Oscillation"), "3.5 in");
		assert.equal(text("Est. Sweat Loss"), "32 oz");
	});
});

describe("columnStarts", () => {
	const sections = statsView(outdoor(), "metric");

	it("splits the run's sections 5 · 4 · 6 across the pane's three columns, as the twin does", () => {
		assert.deepEqual(columnStarts(sections, 3), [5, 9]);
		assert.deepEqual([sections[5]!.title, sections[9]!.title], ["Stamina", "Impact Load"]);
		// The twin's cards: Pace 185.67 tall, Training Effect 207.67 with its two-line row.
		assert.equal(sectionHeight(sections[0]!).toFixed(2), "185.67");
		assert.equal(sectionHeight(sections[6]!).toFixed(2), "207.67");
	});

	it("balances two columns the same way, and needs no break for one", () => {
		assert.deepEqual(columnStarts(sections, 2), [7]);
		assert.deepEqual(columnStarts(sections, 1), []);
		assert.deepEqual(columnStarts(sections.slice(0, 2), 3), [1]);
		assert.deepEqual(columnStarts([], 3), []);
	});
});

describe("lapsView", () => {
	const view = lapsView(outdoor(), "metric");

	it("has the eleven laps as the phone shows them", () => {
		assert.deepEqual(
			view.columns,
			[{ label: "Lap" }, { label: "Time" }, { label: "Distance", unit: "km" }, { label: "Avg Pace", unit: "min/km" }],
		);
		assert.deepEqual(
			view.rows.map((r) => [r.n, r.time, r.distance, r.pace]),
			[
				[1, "5:55.1", "1.00", "5:55"],
				[2, "5:43.5", "1.00", "5:44"],
				[3, "5:36.1", "1.00", "5:36"],
				[4, "5:29.5", "1.00", "5:29"],
				[5, "5:37.2", "1.00", "5:37"],
				[6, "5:41.8", "1.00", "5:42"],
				[7, "5:24.6", "1.00", "5:25"],
				[8, "5:25.0", "1.00", "5:25"],
				[9, "5:33.3", "1.00", "5:33"],
				[10, "5:32.0", "1.00", "5:32"],
				[11, "0:02.7", "0.01", "4:56"],
			],
		);
	});

	it("paces a lap by its averageSpeed, not its time over its distance", () => {
		// Lap 2: 1000 ÷ 2.911 = 343.52 s → 5:44; 343.48 s for 1 km would read 5:43.
		assert.equal(view.rows[1]!.pace, "5:44");
		assert.equal(pace(1000, 343.48, "metric"), "5:43");
		// Lap 4 reads 5:29 although its time rounds to 5:29.5.
		assert.deepEqual([view.rows[3]!.time, view.rows[3]!.pace], ["5:29.5", "5:29"]);
	});

	it("reads miles in imperial", () => {
		const imperial = lapsView(outdoor(), "imperial");
		assert.deepEqual(imperial.columns.slice(2), [
			{ label: "Distance", unit: "mi" },
			{ label: "Avg Pace", unit: "min/mi" },
		]);
		assert.deepEqual(imperial.rows[1], { n: 2, time: "5:43.5", distance: "0.62", pace: "9:13" });
		assert.deepEqual(imperial.rows[10], { n: 11, time: "0:02.7", distance: "0.01", pace: "7:56" });
	});

	it("falls back to time over distance without a speed, and to -- without either", () => {
		const detail = { ...outdoor(), laps: [{ n: 1, duration: 300, distance: 1000 }, { n: 2, duration: 5, distance: 0 }] };
		assert.deepEqual(
			lapsView(detail, "metric").rows.map((r) => r.pace),
			["5:00", "--"],
		);
	});

	it("rounds lap times to the tenth, hours when a lap is that long", () => {
		assert.deepEqual([343.48, 329.454, 2.664, 59.96, 0.04, 3723.44].map(lapTime), ["5:43.5", "5:29.5", "0:02.7", "1:00.0", "0:00.0", "1:02:03.4"]);
	});
});

describe("gearView", () => {
	it("shows the web's empty state, without its Add Gear button, when nothing is linked", () => {
		assert.deepEqual(gearView(outdoor()), { items: [], empty: { title: "No gear added", text: "Adding your gear to activities lets you track its use over time." } });
		assert.deepEqual(gearView(outdoor()).empty, { ...NO_GEAR });
	});

	it("lists linked gear by name and type", () => {
		const view = gearView(outdoor({ gear: [{ displayName: "Daily trainers", gearTypeName: "Shoes" }] }));
		assert.deepEqual(view, { items: [{ name: "Daily trainers", type: "Shoes" }], empty: null });
	});

	it("claims nothing before the gear has loaded", () => {
		const unloaded = buildActivityDetail(4, { summary: summary(RUN_DTO) }, null)!;
		assert.deepEqual(gearView(unloaded), { items: [], empty: null });
	});
});
