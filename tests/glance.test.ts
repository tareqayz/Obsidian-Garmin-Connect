import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
	GLANCE_STATS,
	MAX_GLANCE,
	addStat,
	altitudeView,
	availableStats,
	economyView,
	enduranceView,
	fitnessAgeView,
	floorsView,
	ftpGauge,
	glanceModel,
	healthView,
	heatView,
	hillView,
	lactateView,
	lastActivityView,
	loadFocusView,
	moveStat,
	pulseOxView,
	readGlance,
	readinessDial,
	removeStat,
	respirationView,
	sameList,
	toleranceView,
	trainingLoadView,
	trendOf,
	vo2Gauge,
	weightView,
	type GlanceId,
} from "../src/dashboard/glance";
import type { HomeInput } from "../src/dashboard/home";
import type { DayRow } from "../src/dashboard/series";

const row = (date: string, values: Record<string, number> = {}, text: Record<string, string> = {}): DayRow => ({
	date,
	values,
	text,
});

const input = (rows: DayRow[], date = rows[rows.length - 1]!.date): HomeInput => ({ date, rows, series: null, account: null });

/* The account's own numbers on 2026-09-24, the day the phone screenshots in
   ref/home/at-a-glance were taken — so each expectation is what the app showed. */
const limits = {
	endurance_gauge_low: 3570,
	endurance_gauge_high: 10560,
	endurance_intermediate_from: 5100,
	endurance_trained_from: 5800,
	endurance_well_trained_from: 6600,
	endurance_expert_from: 7300,
	endurance_superior_from: 8100,
	endurance_elite_from: 8800,
};

describe("the stat list", () => {
	it("has Garmin's 36 stats, each once, in the Add a Stat sheet's order", () => {
		assert.equal(GLANCE_STATS.length, 36);
		assert.equal(new Set(GLANCE_STATS.map((s) => s.id)).size, 36);
		assert.deepEqual(
			GLANCE_STATS.slice(0, 13).map((s) => s.title),
			[
				"Altitude Acclimation",
				"Blood Pressure",
				"Body Battery",
				"Calories Burned",
				"Critical Swim Speed",
				"Cycling Ability",
				"Cycling FTP",
				"Cycling VO₂ Max",
				"Endurance Score",
				"Fitness Age",
				"Floors",
				"HRV Status",
				"Health Status",
			],
		);
		assert.equal(GLANCE_STATS.at(-1)!.title, "XC Skiing FTP");
	});

	it("reads a stored list by allowlist: known ids, once each, at most twenty", () => {
		assert.equal(readGlance(undefined), undefined);
		assert.equal(readGlance("heartRate"), undefined);
		assert.deepEqual(readGlance([]), []);
		assert.deepEqual(readGlance(["heartRate", "nope", "heartRate", 7, "vo2max"]), ["heartRate", "vo2max"]);
		assert.equal(readGlance(GLANCE_STATS.map((s) => s.id))!.length, MAX_GLANCE);
	});

	it("adds to the end, never twice and never past twenty", () => {
		assert.deepEqual(addStat(["heartRate"], "vo2max"), ["heartRate", "vo2max"]);
		assert.deepEqual(addStat(["heartRate"], "heartRate"), ["heartRate"]);
		const twenty = GLANCE_STATS.slice(0, 20).map((s) => s.id);
		assert.deepEqual(addStat(twenty, "xcSkiFtp"), twenty);
	});

	it("removes and moves without disturbing the rest", () => {
		const list: GlanceId[] = ["heartRate", "intensity", "calories", "stress"];
		assert.deepEqual(removeStat(list, "intensity"), ["heartRate", "calories", "stress"]);
		assert.deepEqual(moveStat(list, "stress", 0), ["stress", "heartRate", "intensity", "calories"]);
		assert.deepEqual(moveStat(list, "heartRate", 2), ["intensity", "calories", "heartRate", "stress"]);
		assert.deepEqual(moveStat(list, "heartRate", 99), ["intensity", "calories", "stress", "heartRate"]);
		assert.deepEqual(moveStat(list, "vo2max", 0), list);
		assert.ok(sameList(list, [...list]));
		assert.ok(!sameList(list, moveStat(list, "stress", 0)));
	});

	it("offers only what is not on the page yet", () => {
		const offered = availableStats(["heartRate", "altitude"]).map((s) => s.id);
		assert.equal(offered.length, 34);
		assert.equal(offered[0], "bloodPressure");
		assert.ok(!offered.includes("heartRate"));
	});
});

describe("banded dials", () => {
	it("draws Endurance Score from the account's own class limits", () => {
		const rows = [
			row("2026-09-17", { endurance_score: 6365, ...limits }),
			row("2026-09-24", { endurance_score: 6336, endurance_classification: 3, ...limits }),
		];
		const g = enduranceView(input(rows))!;
		assert.equal(g.value, (6336).toLocaleString());
		assert.equal(g.label, "Trained");
		assert.equal(g.segments.length, 7);
		assert.equal(g.tone, "yellow");
		assert.ok(Math.abs(g.at! - 0.3957) < 0.001, `at ${g.at}`);
		assert.equal(g.trend, "down");
	});

	it("puts Hill Score on a 0–100 dial and calls a flat week flat", () => {
		const rows = [
			row("2026-09-21", { hill_score: 29, hill_score_classification: 2 }),
			row("2026-09-24", { hill_score: 29, hill_score_classification: 2 }),
		];
		const g = hillView(input(rows))!;
		assert.equal(g.label, "Challenger");
		assert.equal(g.at, 0.29);
		assert.equal(g.tone, "orange");
		assert.equal(g.trend, "flat");
	});

	it("grades VO₂ Max against Garmin's age-and-sex table", () => {
		const g = vo2Gauge(55, 23, "male");
		assert.equal(g.value, "55");
		assert.equal(g.label, "Excellent");
		assert.equal(g.tone, "blue");
		assert.ok(g.at! > 0.83 && g.at! < 0.849, `at ${g.at}`);
		assert.equal(vo2Gauge(55, 23, "female").label, "Superior");
		// The same number grades higher with age: 40 is Excellent at 65.
		assert.equal(vo2Gauge(40, 65, "male").label, "Excellent");
		assert.equal(vo2Gauge(30, 25, "male").label, "Poor");
		// Without an age or a sex there is nothing to grade against.
		assert.equal(vo2Gauge(55, undefined, "male").label, undefined);
		assert.equal(vo2Gauge(55, 23, undefined).at, undefined);
	});

	it("places FTP linearly and grades it with Garmin's FTP table", () => {
		const cycling = ftpGauge(4.03, "male");
		assert.equal(cycling.value, "4.03");
		assert.equal(cycling.label, "Excellent");
		assert.ok(Math.abs(cycling.at! - 0.672) < 0.005, `at ${cycling.at}`);
		const skiing = ftpGauge(1.63, "male");
		assert.equal(skiing.label, "Untrained");
		assert.equal(skiing.tone, "red");
		assert.equal(ftpGauge(4.03, undefined).label, undefined);
	});

	it("uses readiness's published bands", () => {
		const g = readinessDial(86);
		assert.equal(g.at, 0.86);
		assert.equal(g.tone, "blue");
		assert.equal(readinessDial(96).tone, "purple");
		assert.equal(readinessDial(10).tone, "red");
	});

	it("keeps the Running Economy marker inside the class Garmin names", () => {
		const g = economyView({ runningEconomy: { score: 224, classification: "INTERMEDIATE" } })!;
		assert.equal(g.label, "Intermediate");
		assert.equal(g.tone, "orange");
		assert.ok(Math.abs(g.at! - 0.198) < 0.002, `at ${g.at}`);
		// A score the inferred limits would put elsewhere still lands in the named class.
		const odd = economyView({ runningEconomy: { score: 190, classification: "INTERMEDIATE" } })!;
		assert.ok(odd.at! >= 0.179 && odd.at! <= 0.366);
		assert.equal(economyView({ runningEconomy: { classification: "INTERMEDIATE" } }), null);
		assert.equal(economyView({ runningEconomy: { score: 224, classification: "NEW_CLASS" } })!.at, undefined);
	});
});

describe("how far back a card looks", () => {
	it("keeps a year-old cycling VO₂ Max off the card, as the app does", () => {
		const rows = [
			row("2025-10-15", { vo2max_cycling: 57.4 }),
			row("2026-09-24", { vo2max: 55, chronological_age: 23 }),
		];
		const model = glanceModel(input(rows), rows[1], "metric");
		assert.equal(model.cyclingVo2, null);
		assert.equal(model.vo2max?.value, "55");
	});

	it("bounds a daily stat to the last week", () => {
		assert.equal(enduranceView(input([row("2026-09-01", { endurance_score: 6000 }), row("2026-09-24")])), null);
		assert.equal(enduranceView(input([row("2026-09-20", { endurance_score: 6000 }), row("2026-09-24")]))?.value, (6000).toLocaleString());
	});
});

describe("trends", () => {
	it("compares with the value a week back, or the earliest inside the week", () => {
		const rows = [row("2026-09-17", { x: 100 }), row("2026-09-24", { x: 110 })];
		assert.equal(trendOf(rows, "2026-09-24", "x", 0), "up");
		assert.equal(trendOf([row("2026-09-20", { x: 5 }), row("2026-09-24", { x: 5 })], "2026-09-24", "x", 0), "flat");
		// A reading from months ago is not last week's.
		assert.equal(trendOf([row("2026-06-01", { x: 1 }), row("2026-09-24", { x: 5 })], "2026-09-24", "x", 0), "flat");
		assert.equal(trendOf([], "2026-09-24", "x", 0), undefined);
	});
});

describe("stat cards", () => {
	it("reads Running Tolerance in kilometre equivalents", () => {
		const t = toleranceView(
			input([row("2026-09-24", { running_tolerance: 37561, running_tolerance_load: 19072, running_tolerance_distance_km: 23.28 })]),
			"metric",
		)!;
		assert.deepEqual({ load: t.load, tolerance: t.tolerance }, { load: "19.1", tolerance: "38 km" });
		assert.ok(Math.abs(t.share - 0.5078) < 0.001);
		assert.equal(toleranceView(input([row("2026-09-24", { running_tolerance: 37561, running_tolerance_load: 19072 })]), "imperial")!.tolerance, "23 mi");
	});

	it("shows training load as the app does", () => {
		const t = trainingLoadView(
			input([row("2026-09-24", { training_load_acute: 375, training_load_chronic: 404, training_load_ratio: 0.9 }, { training_load_status: "OPTIMAL" })]),
		)!;
		assert.deepEqual(t, { status: "Optimal", acute: 375, chronic: 404, ratio: 0.9 });
	});

	it("counts whole floors and ticks the days the goal was met", () => {
		const rows = [
			row("2026-09-18", { floors: 0, floors_goal: 10 }),
			row("2026-09-19", { floors: 10.60531, floors_goal: 10 }),
			row("2026-09-24", { floors: 2.12959, floors_goal: 10 }),
		];
		const f = floorsView(input(rows), rows[2])!;
		assert.equal(f.floors, 2);
		assert.equal(f.goal, 10);
		assert.deepEqual(
			f.week.map((d) => d.met),
			[false, true, null, null, null, null, false],
		);
	});

	it("scales Load Focus to the widest bar and dates its four weeks", () => {
		const r = row(
			"2026-09-24",
			{
				load_anaerobic: 91,
				load_anaerobic_target_min: 133,
				load_anaerobic_target_max: 400,
				load_aerobic_high: 955,
				load_aerobic_high_target_min: 400,
				load_aerobic_high_target_max: 801,
				load_aerobic_low: 630,
				load_aerobic_low_target_min: 334,
				load_aerobic_low_target_max: 734,
			},
			{ load_focus: "ANAEROBIC_SHORTAGE" },
		);
		const lf = loadFocusView(input([r]))!;
		assert.equal(lf.focus, "Anaerobic Shortage");
		assert.equal(lf.scale, 955);
		assert.equal(lf.range, "Aug 28 - Sep 24");
		assert.deepEqual(
			lf.bars.map((b) => [b.value, b.tone]),
			[
				[91, "purple"],
				[955, "orange"],
				[630, "cyan"],
			],
		);
		assert.equal(loadFocusView(input([row("2026-09-24", { load_aerobic_high: 1 }, { load_focus: "AEROBIC_LOW_SHORTAGE" })]))!.focus, "Low Aerobic Shortage");
	});

	it("dates the latest weigh-in and measures it against the one before", () => {
		const rows = [
			row("2025-10-13", { weight_kg: 67.2 }),
			row("2025-11-02", { weight_kg: 68 }),
			row("2026-09-24", { steps: 1 }),
		];
		assert.deepEqual(weightView(input(rows)), { value: "68.0 kg", change: "+0.8 kg", bmi: undefined, updated: "Nov 2, 2025" });
		assert.equal(weightView(input([row("2026-09-24")])), null);
	});

	it("totals the last activity the way the app does", () => {
		const rows: DayRow[] = [
			{
				...row("2026-09-23"),
				workouts: [
					{ name: "Morning Walk", type: "walking", start: "2026-09-23T07:00", minutes: 20, distance_km: 1.5 },
					{ name: "Kuwait City Running", type: "running", start: "2026-09-23T18:00", minutes: 42, duration_s: 2533, distance_km: 7.46 },
				],
			},
			row("2026-09-24"),
		];
		const a = lastActivityView(input(rows))!;
		assert.equal(a.name, "Kuwait City Running");
		assert.deepEqual(a.stats, [
			{ value: "7.46 km", label: "Distance" },
			{ value: "42:13", label: "Total Time" },
			{ value: "5:40 /km", label: "Avg Pace" },
		]);
		const ride = lastActivityView(input([{ ...row("2026-09-24"), workouts: [{ type: "road_biking", minutes: 60, distance_km: 30 }] }]))!;
		assert.deepEqual(ride.stats.at(-1), { value: "30.0 km/h", label: "Avg Speed" });
		assert.equal(ride.icon, "bike");
	});

	it("shows Health Status only once every metric has a baseline", () => {
		const r = (spo2: string) =>
			row("2026-09-24", {}, { health_hrv_status: "BELOW", health_hr_status: "IN_RANGE", health_spo2_status: spo2 });
		assert.equal(healthView(r("ONBOARDING"))!.onboarding, true);
		const h = healthView(r("IN_RANGE"))!;
		assert.equal(h.onboarding, false);
		assert.equal(h.outside, 1);
		assert.deepEqual(h.metrics[0], { label: "HRV", status: "Below", ok: false });
		assert.equal(healthView(row("2026-09-24")), null);
	});

	it("combines the lactate threshold with running FTP", () => {
		const l = lactateView(
			{
				lactateThreshold: { date: "2026-09-19", heartRate: 182, pace: "4:29" },
				ftp: { running: { date: "2026-09-19", watts: 354, wattsPerKg: 5.21 } },
			},
			"metric",
			"2026-09-24",
		)!;
		assert.deepEqual(
			l.stats.map((s) => s.value),
			["182 bpm", "4:29 /km", "354 W", "5.21 W/kg"],
		);
		assert.equal(l.updated, "Sep 19");
		assert.equal(lactateView(null, "metric", "2026-09-24"), null);
	});

	it("dates fitness age by when Garmin recalculated it", () => {
		const f = fitnessAgeView(input([row("2026-09-24", { fitness_age: 18, chronological_age: 23 }, { fitness_age_updated: "2026-09-23" })]))!;
		assert.deepEqual(f, { age: 18, actual: 23, updated: "Sep 23" });
	});

	it("words acclimation the way the app does, and hides altitude at sea level", () => {
		const heat = heatView(input([row("2026-09-24", { heat_acclimation_pct: 100 }, { heat_acclimation_trend: "ACCLIMATIZED" })]))!;
		assert.deepEqual(heat, { value: "100%", trend: "flat", message: "Maintaining acclimation.", updated: "Sep 24" });
		assert.equal(altitudeView(input([row("2026-09-24", { altitude_acclimation_m: 0 })])), null);
		assert.equal(
			altitudeView(input([row("2026-09-24", { altitude_acclimation_m: 2450 }, { altitude_acclimation_trend: "ACCLIMATIZING" })]))!.value,
			`${(2450).toLocaleString()} m`,
		);
	});

	it("leaves respiration and pulse ox empty on a day without readings", () => {
		assert.equal(pulseOxView(row("2026-09-24")), null);
		assert.deepEqual(respirationView(row("2026-09-24", { respiration_latest: 14, respiration_avg: 13, sleep_respiration: 14 })), {
			latest: 14,
			average: 13,
			sleep: 14,
		});
	});
});
