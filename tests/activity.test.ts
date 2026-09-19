import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
	activityWhen,
	detailFields,
	heroFields,
	paceField,
	rowHighlight,
	rowMetrics,
	sportOf,
	splitRows,
	typeLabel,
	zoneRows,
	type Split,
	type Zone,
} from "../src/dashboard/activity";
import { workoutsIn, type DayRow, type WorkoutEntry } from "../src/dashboard/series";

const entry = (over: Partial<WorkoutEntry> = {}): WorkoutEntry => ({
	date: "2026-03-12",
	...over,
});

describe("sportOf", () => {
	it("matches the stem, so composed typeKeys land in the right family", () => {
		for (const key of ["running", "trail_running", "treadmill_running", "virtual_run"]) {
			assert.equal(sportOf(key), "run", key);
		}
		for (const key of ["cycling", "indoor_cycling", "mountain_biking", "virtual_ride", "bmx"]) {
			assert.equal(sportOf(key), "ride", key);
		}
		for (const key of ["lap_swimming", "open_water_swimming"]) {
			assert.equal(sportOf(key), "swim", key);
		}
		assert.equal(sportOf("strength_training"), "strength");
	});

	it("falls back to other rather than guessing", () => {
		assert.equal(sportOf("yoga"), "other");
		assert.equal(sportOf(undefined), "other");
		assert.equal(sportOf(""), "other");
	});
});

describe("typeLabel", () => {
	it("un-snakes and sentence-cases", () => {
		assert.equal(typeLabel("lap_swimming"), "Lap swimming");
		assert.equal(typeLabel("running"), "Running");
		assert.equal(typeLabel(undefined), "Activity");
	});
});

describe("splitRows", () => {
	// The nine splits of the design's Morning Run, as paces in seconds.
	const paces = [312, 304, 298, 306, 292, 301, 295, 288, 282];
	const splits: Split[] = paces.map((paceSeconds, i) => ({
		distance: i === paces.length - 1 ? 0.4 : 1,
		paceSeconds,
	}));

	it("draws the bar lengths the design draws", () => {
		// Against a 160px track, which is what the Figma component uses.
		const widths = splitRows(splits).map((r) => Math.round(r.fraction * 160 * 10) / 10);
		assert.deepEqual(widths, [34, 67.6, 92.8, 59.2, 118, 80.2, 105.4, 134.8, 160]);
	});

	it("gives the fastest split the longest bar", () => {
		const rows = splitRows(splits);
		const fastest = rows.reduce((a, b) => (a.paceSeconds < b.paceSeconds ? a : b));
		const longest = rows.reduce((a, b) => (a.fraction > b.fraction ? a : b));
		assert.equal(fastest, longest);
	});

	it("numbers whole splits and labels the partial one by its distance", () => {
		const labels = splitRows(splits).map((r) => r.label);
		assert.deepEqual(labels, ["1", "2", "3", "4", "5", "6", "7", "8", "0.4"]);
		assert.deepEqual(
			splitRows(splits).map((r) => r.partial),
			[false, false, false, false, false, false, false, false, true],
		);
	});

	it("formats the pace as a clock", () => {
		assert.equal(splitRows(splits)[0]?.pace, "5:12");
		assert.equal(splitRows(splits)[8]?.pace, "4:42");
	});

	it("fills every bar when a run held one pace, rather than dividing by zero", () => {
		const flat = splitRows([
			{ distance: 1, paceSeconds: 300 },
			{ distance: 1, paceSeconds: 300 },
		]);
		assert.deepEqual(
			flat.map((r) => r.fraction),
			[1, 1],
		);
	});

	it("survives an empty set", () => {
		assert.deepEqual(splitRows([]), []);
	});
});

describe("zoneRows", () => {
	// The design's Morning Run: 42:18 of moving time across five zones.
	const zones: Zone[] = [
		{ zone: 1, name: "Warm up", low: 117, high: 130, seconds: 228 },
		{ zone: 2, name: "Easy", low: 131, high: 144, seconds: 786 },
		{ zone: 3, name: "Aerobic", low: 145, high: 157, seconds: 1104 },
		{ zone: 4, name: "Threshold", low: 158, high: 171, seconds: 378 },
		{ zone: 5, name: "Maximum", low: 172, high: 185, seconds: 42 },
	];

	it("orders hardest first, matching the ramp", () => {
		assert.deepEqual(
			zoneRows(zones).map((r) => r.zone),
			[5, 4, 3, 2, 1],
		);
	});

	it("reports the shares the design reports", () => {
		assert.deepEqual(
			zoneRows(zones).map((r) => r.percent),
			["1.7%", "14.9%", "43.5%", "31%", "9%"],
		);
	});

	it("formats each zone's time as a clock", () => {
		assert.deepEqual(
			zoneRows(zones).map((r) => r.clock),
			["0:42", "6:18", "18:24", "13:06", "3:48"],
		);
	});

	it("does not divide by zero when nothing was recorded", () => {
		const empty = zoneRows([{ zone: 1, name: "Warm up", low: 1, high: 2, seconds: 0 }]);
		assert.equal(empty[0]?.fraction, 0);
		assert.equal(empty[0]?.percent, "0%");
	});
});

describe("rowHighlight", () => {
	it("gives a run its pace, straight from the synced string", () => {
		const run = entry({ type: "running", pace: "5:02", distance: { value: 8.4, unit: "km" } });
		assert.deepEqual(rowHighlight(run), { label: "Pace /km", value: "5:02" });
	});

	it("gives a ride a speed", () => {
		const ride = entry({ type: "cycling", minutes: 63, distance: { value: 24.1, unit: "km" } });
		assert.deepEqual(rowHighlight(ride), { label: "km/h", value: "23.0" });
	});

	it("gives a swim a pace per hundred", () => {
		const swim = entry({ type: "lap_swimming", minutes: 38, distance: { value: 1.5, unit: "km" } });
		// 2280s over fifteen hundreds. The design's 2:33 comes from 2300s — the
		// difference is mapWorkout rounding a duration to whole minutes, which is
		// the finest this can resolve however it is formatted.
		assert.deepEqual(rowHighlight(swim), { label: "/100 m", value: "2:32" });
	});

	it("switches to imperial units with the synced distance", () => {
		const ride = entry({ type: "cycling", minutes: 60, distance: { value: 20, unit: "mi" } });
		assert.equal(rowHighlight(ride).label, "mph");
		const swim = entry({ type: "lap_swimming", minutes: 38, distance: { value: 1, unit: "mi" } });
		assert.equal(swim && rowHighlight(swim).label, "/100 yd");
	});

	it("gives a lift its training effect, having no ground to cover", () => {
		const lift = entry({ type: "strength_training", minutes: 45, training_effect: 2.1 });
		assert.deepEqual(rowHighlight(lift), { label: "Effect", value: "2.1" });
	});

	it("says nothing rather than zero when the numbers are missing", () => {
		assert.equal(rowHighlight(entry({ type: "cycling" })).value, "—");
		assert.equal(rowHighlight(entry({ type: "lap_swimming" })).value, "—");
		assert.equal(rowHighlight(entry({ type: "strength_training" })).value, "—");
	});
});

describe("rowMetrics", () => {
	it("is always four columns, dashed where there is no value", () => {
		const metrics = rowMetrics(entry({ type: "strength_training", minutes: 45 }));
		assert.equal(metrics.length, 4);
		assert.deepEqual(
			metrics.map((m) => m.label),
			["Distance", "Time", "Effect", "Avg HR"],
		);
		assert.equal(metrics[0]?.value, "—");
		assert.equal(metrics[1]?.value, "45:00");
	});
});

describe("paceField", () => {
	it("splits the unit off the label, which the row keeps joined", () => {
		const run = entry({ type: "running", pace: "5:02", distance: { value: 8.4, unit: "km" } });
		assert.equal(rowHighlight(run).label, "Pace /km");
		assert.deepEqual(paceField(run), { label: "Avg pace", value: "5:02", unit: "/km" });
	});

	it("names a ride's number a speed", () => {
		const ride = entry({ type: "cycling", minutes: 63, distance: { value: 24.1, unit: "km" } });
		assert.deepEqual(paceField(ride), { label: "Avg speed", value: "23.0", unit: "km/h" });
	});

	it("keeps a swim's per-hundred unit", () => {
		const swim = entry({ type: "lap_swimming", minutes: 38, distance: { value: 1.5, unit: "km" } });
		assert.deepEqual(paceField(swim), { label: "Avg pace", value: "2:32", unit: "/100 m" });
	});

	it("is nothing for a lift, whose highlight is a grid field already", () => {
		assert.equal(paceField(entry({ type: "strength_training", training_effect: 2.1 })), null);
	});

	it("is nothing when the numbers behind it are missing", () => {
		assert.equal(paceField(entry({ type: "cycling" })), null);
	});
});

describe("heroFields", () => {
	it("leads with distance for anything that covers ground", () => {
		const run = entry({
			type: "running",
			minutes: 42,
			pace: "5:02",
			distance: { value: 8.4, unit: "km" },
		});
		assert.deepEqual(
			heroFields(run).map((f) => f.label),
			["Distance", "Time", "Avg pace"],
		);
		assert.equal(heroFields(run)[0]?.unit, "km");
		assert.equal(heroFields(run)[2]?.unit, "/km");
	});

	it("drops the third slot rather than showing an empty one", () => {
		const bare = entry({ type: "running", minutes: 42, distance: { value: 8.4, unit: "km" } });
		assert.deepEqual(
			heroFields(bare).map((f) => f.label),
			["Distance", "Time"],
		);
	});

	it("leads with duration for a lift, rather than an empty distance", () => {
		const lift = entry({ type: "strength_training", minutes: 45, avg_hr: 112, calories: 300 });
		assert.deepEqual(
			heroFields(lift).map((f) => f.label),
			["Time", "Avg HR", "Calories"],
		);
	});
});

describe("detailFields", () => {
	it("omits what the vault does not hold rather than printing dashes", () => {
		const labels = detailFields(entry({ type: "running", minutes: 42 })).map((f) => f.label);
		assert.deepEqual(labels, ["Time"]);
	});

	it("carries every field the synced row does hold", () => {
		const full = entry({
			type: "running",
			minutes: 42,
			pace: "5:02",
			distance: { value: 8.4, unit: "km" },
			avg_hr: 152,
			max_hr: 178,
			calories: 512,
			steps: 7400,
			training_effect: 3.2,
			ascent: { value: 142, unit: "m" },
		});
		assert.deepEqual(
			detailFields(full).map((f) => f.label),
			[
				"Time",
				"Distance",
				"Avg pace",
				"Avg HR",
				"Max HR",
				"Ascent",
				"Calories",
				"Steps",
				"Training effect",
			],
		);
	});

	it("lists a lift's training effect once, not as a highlight and a field", () => {
		const lift = entry({ type: "strength_training", minutes: 45, training_effect: 2.1 });
		const labels = detailFields(lift).map((f) => f.label);
		assert.deepEqual(labels.filter((l) => l === "Training effect").length, 1);
	});

	it("appends fields the caller has from elsewhere", () => {
		const extra = detailFields(entry({ minutes: 1 }), [{ label: "Descent", value: "138", unit: "m" }]);
		assert.equal(extra[extra.length - 1]?.label, "Descent");
	});
});

describe("activityWhen", () => {
	it("names the weekday and spells the month", () => {
		assert.equal(
			activityWhen(entry({ start: "2026-03-12T07:12" })),
			"Thursday 12 March · 07:12",
		);
	});

	it("drops the time when the row has no start", () => {
		assert.equal(activityWhen(entry()), "Thursday 12 March");
	});
});

describe("workoutsIn", () => {
	it("reads back the climb and steps that mapWorkout writes", () => {
		const rows: DayRow[] = [
			{
				date: "2026-03-12",
				values: {},
				workouts: [
					{ name: "Morning Run", type: "running", elevation_gain_m: 142, steps: 7400 },
				],
			},
		];
		const [workout] = workoutsIn(rows);
		assert.deepEqual(workout?.ascent, { value: 142, unit: "m" });
		assert.equal(workout?.steps, 7400);
	});

	it("keeps the imperial climb in feet", () => {
		const rows: DayRow[] = [
			{ date: "2026-03-12", values: {}, workouts: [{ elevation_gain_ft: 466 }] },
		];
		assert.deepEqual(workoutsIn(rows)[0]?.ascent, { value: 466, unit: "ft" });
	});
});
