import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
	ENDURANCE_CLASSES,
	FTP_CLASSES,
	HILL_CLASSES,
	VO2_CLASSES,
	economyGauge,
	enduranceGauge,
	ftpGauge,
	hillGauge,
	readinessDial,
	vo2Gauge,
	type Gauge,
} from "../src/dashboard/gauges";
import * as glance from "../src/dashboard/glance";
import type { HomeInput } from "../src/dashboard/home";
import type { DayRow } from "../src/dashboard/series";

/* The account's numbers on 2026-10-11, the day of the Performance Stats shots
   (ref/performance-stats/<stat>/api-samples), and the class each page showed:
   VO₂ Max 55 Excellent, Endurance Score 6,413 Trained, Hill Score 29
   Challenger, Running Economy 224 Intermediate, Cycling FTP 4.03 Excellent,
   Training Readiness 18 Poor. */
const ENDURANCE = { low: 3570, high: 10560, limits: [5100, 5800, 6600, 7300, 8100, 8800] };

const tones = (g: Gauge) => g.segments.map((s) => s.tone);
const near = (actual: number | undefined, expected: number) => assert.ok(actual !== undefined && Math.abs(actual - expected) < 0.0005, `at ${actual}, not ${expected}`);

describe("gauges, the account on 2026-10-11", () => {
	it("grade VO₂ Max 54.9 as the phone's 55, Excellent, for a man of 23", () => {
		const g = vo2Gauge(54.9, 23, "male");
		assert.deepEqual([g.value, g.label, g.tone], ["55", "Excellent", "blue"]);
		near(g.at, 0.8305);
		assert.deepEqual(tones(g), ["red", "orange", "green", "blue", "purple"]);
		// The last cycling VO₂ Max, 57.4 on 2025-10-15, is past Excellent.
		assert.equal(vo2Gauge(57.4, 23, "male").label, "Superior");
		assert.deepEqual(VO2_CLASSES, ["Poor", "Fair", "Good", "Excellent", "Superior"]);
	});

	it("place FTP in W/kg linearly: cycling 4.03 Excellent, cross-country skiing 1.63 Untrained", () => {
		const cycling = ftpGauge(274 / 68, "male");
		assert.deepEqual([cycling.value, cycling.label, cycling.tone], ["4.03", "Excellent", "blue"]);
		near(cycling.at, 0.6716);
		const skiing = ftpGauge(111 / 68, "male");
		assert.deepEqual([skiing.value, skiing.label, skiing.tone], ["1.63", "Untrained", "red"]);
		assert.equal(ftpGauge(274 / 68, undefined).label, undefined);
		assert.deepEqual(FTP_CLASSES, ["Untrained", "Fair", "Good", "Excellent", "Superior"]);
	});

	it("put the day's two readiness scores in Garmin's bands: 18 after the run, 64 on waking", () => {
		const after = readinessDial(18);
		assert.deepEqual([after.value, after.at, after.tone], ["18", 0.18, "red"]);
		assert.equal(readinessDial(64).tone, "green");
		assert.equal(readinessDial(100).at, 1);
	});

	it("draw Endurance Score 6,413 on the account's own limits: Trained", () => {
		const g = enduranceGauge(6413, ENDURANCE, 3);
		assert.deepEqual([g.value, g.label, g.tone], [(6413).toLocaleString(), "Trained", "yellow"]);
		near(g.at, 2843 / 6990);
		near(g.segments[3]!.from, (6600 - 3570) / 6990);
		assert.equal(g.segments.length, 7);
		// The limits grade it without Garmin's class, and the class places it without the limits.
		assert.equal(enduranceGauge(6413, ENDURANCE).label, "Trained");
		const even = enduranceGauge(6413, {}, 3);
		assert.deepEqual([even.label, even.at], ["Trained", 2.5 / 7]);
		// A scale that cannot be one is no scale; nothing at all places nothing.
		assert.equal(enduranceGauge(6413, { ...ENDURANCE, high: 3000 }).at, undefined);
		assert.deepEqual([enduranceGauge(6413).label, enduranceGauge(6413).at], [undefined, undefined]);
		assert.equal(ENDURANCE_CLASSES.length, 7);
	});

	it("put Hill Score 29 on its 0–100 dial: Challenger", () => {
		const g = hillGauge(29, 2);
		assert.deepEqual([g.value, g.label, g.at, g.tone], ["29", "Challenger", 0.29, "orange"]);
		assert.equal(hillGauge(29).label, "Challenger");
		assert.deepEqual([hillGauge(95).label, hillGauge(95).tone], ["Elite", "pink"]);
		assert.deepEqual(HILL_CLASSES, ["Recreational", "Challenger", "Trained", "Well-Trained", "Expert", "Elite"]);
	});

	it("keep Running Economy 224 inside the class Garmin names: Intermediate", () => {
		const g = economyGauge(224, "INTERMEDIATE");
		assert.deepEqual([g.value, g.label, g.tone], ["224", "Intermediate", "orange"]);
		near(g.at, 0.1977);
		// Lower is better; a score the limits put elsewhere still lands in the named class.
		const elite = economyGauge(190, "ELITE");
		assert.deepEqual([elite.at, elite.tone], [0.906, "pink"]);
		assert.equal(economyGauge(224, "NEW_CLASS").at, undefined);
		assert.equal(economyGauge(224).label, undefined);
	});
});

describe("At a Glance's dials", () => {
	const row = (date: string, values: Record<string, number>): DayRow => ({ date, values, text: {} });
	const input = (rows: DayRow[]): HomeInput => ({ date: rows[rows.length - 1]!.date, rows, series: null, account: null });

	it("are the shared gauges, the cards adding only a trend", () => {
		assert.equal(glance.vo2Gauge, vo2Gauge);
		assert.equal(glance.ftpGauge, ftpGauge);
		assert.equal(glance.readinessDial, readinessDial);
		const endurance = glance.enduranceView(
			input([
				row("2026-10-11", {
					endurance_score: 6413,
					endurance_classification: 3,
					endurance_gauge_low: 3570,
					endurance_gauge_high: 10560,
					endurance_intermediate_from: 5100,
					endurance_trained_from: 5800,
					endurance_well_trained_from: 6600,
					endurance_expert_from: 7300,
					endurance_superior_from: 8100,
					endurance_elite_from: 8800,
				}),
			]),
		)!;
		assert.deepEqual(endurance, { ...enduranceGauge(6413, ENDURANCE, 3), trend: endurance.trend });
		const hill = glance.hillView(input([row("2026-10-11", { hill_score: 29, hill_score_classification: 2 })]))!;
		assert.deepEqual(hill, { ...hillGauge(29, 2), trend: hill.trend });
		assert.deepEqual(glance.economyView({ runningEconomy: { score: 224, classification: "INTERMEDIATE" } }), economyGauge(224, "INTERMEDIATE"));
	});
});
