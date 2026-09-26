import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
	PRESETS,
	activitiesView,
	addDays,
	clockText,
	countdown,
	dayToShow,
	eventsView,
	homeModel,
	hoursText,
	humanize,
	intensityView,
	presetFor,
	readinessView,
	sleepCoach,
	statusTone,
	streaks,
	todayActivity,
	trainingStatusView,
	type HomeInput,
} from "../src/dashboard/home";
import type { DayRow } from "../src/dashboard/series";

const row = (date: string, values: Record<string, number> = {}, text: Record<string, string> = {}): DayRow => ({
	date,
	values,
	text,
});

const input = (rows: DayRow[], date = rows[rows.length - 1]!.date): HomeInput => ({
	date,
	rows,
	series: null,
	account: null,
});

describe("presets", () => {
	it("matches Garmin's three presets", () => {
		assert.deepEqual(
			PRESETS.map((p) => [p.name, p.inFocus, p.glance]),
			[
				["Be healthy", ["sleep", "bodyBattery", "steps"], ["heartRate", "intensity", "calories", "stress"]],
				["Stay active", ["sleep", "bodyBattery", "activities"], ["heartRate", "intensity", "steps", "calories"]],
				["Track my training", ["readiness", "trainingStatus"], ["heartRate", "bodyBattery", "sleep", "hrv"]],
			],
		);
	});

	it("falls back to Be healthy for an unknown id", () => {
		assert.equal(presetFor("nope").id, "be-healthy");
	});
});

describe("formatting", () => {
	it("writes Garmin's enums as words", () => {
		assert.equal(humanize("PRODUCTIVE_3"), "Productive");
		assert.equal(humanize("VERY_GOOD"), "Very good");
		assert.equal(humanize(undefined), undefined);
	});

	it("writes hours and clock totals the way the app does", () => {
		assert.equal(hoursText(6.5), "6h 30m");
		assert.equal(hoursText(0.25), "15m");
		assert.equal(clockText(80.383), "1:20:23");
		assert.equal(clockText(5), "5:00");
	});

	it("counts down to an event in weeks and days", () => {
		assert.equal(countdown("2026-09-24", "2026-10-24"), "IN 4 WEEKS, 2 DAYS");
		assert.equal(countdown("2026-09-24", "2026-09-25"), "TOMORROW");
		assert.equal(countdown("2026-09-24", "2026-10-01"), "IN 1 WEEK");
	});

	it("steps across month ends", () => {
		assert.equal(addDays("2026-09-30", 1), "2026-10-01");
		assert.equal(addDays("2026-03-01", -1), "2026-02-28");
	});
});

describe("today's activity", () => {
	it("names a snapshot by the part of the day and lists newest first", () => {
		const items = todayActivity({
			...row("2026-09-24"),
			workouts: [{ name: "Morning Run", start: "2026-09-24T06:10", minutes: 40, distance_km: 7.81 }],
			snapshots: [{ start: "2026-09-24T12:07", hr: 76, spo2: 99, respiration: 16.3 }],
		});
		assert.deepEqual(
			items.map((i) => (i.kind === "snapshot" ? i.title : i.name)),
			["Health Snapshot - Afternoon", "Morning Run"],
		);
		const run = items[1]!;
		assert.equal(run.kind === "activity" && run.distance, "7.81 km");
	});
});

describe("sleep coach", () => {
	it("says how much sleep is needed and why", () => {
		assert.deepEqual(sleepCoach(row("d", { sleep_need_hours: 6.5 }, { sleep_need_feedback: "DECREASED" })), {
			hours: "6h 30m",
			message: "You need less sleep today.",
		});
		assert.equal(sleepCoach(row("d")), null);
	});
});

describe("step streaks", () => {
	const goal = (date: string, steps: number) => row(date, { steps, steps_goal: 9000 });

	it("counts consecutive days on goal and keeps an unfinished today from breaking it", () => {
		const rows = [
			goal("2026-09-18", 9500),
			goal("2026-09-19", 9100),
			goal("2026-09-20", 100),
			goal("2026-09-21", 9500),
			goal("2026-09-22", 9500),
			goal("2026-09-23", 9500),
			goal("2026-09-24", 200),
		];
		assert.deepEqual(streaks(rows, "2026-09-24"), { current: 3, longest: 3 });
	});

	it("breaks on a missing day", () => {
		const rows = [goal("2026-09-20", 9500), goal("2026-09-22", 9500), goal("2026-09-23", 9500)];
		assert.deepEqual(streaks(rows, "2026-09-23"), { current: 2, longest: 2 });
	});

	it("is not current once it ended before yesterday", () => {
		const rows = [goal("2026-09-20", 9500), goal("2026-09-21", 100), goal("2026-09-22", 100)];
		assert.deepEqual(streaks(rows, "2026-09-22"), { current: 0, longest: 1 });
	});
});

describe("all activities", () => {
	it("totals the last seven days and labels them", () => {
		const rows: DayRow[] = [
			{ ...row("2026-09-19"), workouts: [{ minutes: 20 }] },
			{ ...row("2026-09-23"), workouts: [{ minutes: 30 }, { minutes: 30.383 }] },
			row("2026-09-24"),
		];
		const view = activitiesView(input(rows, "2026-09-24"));
		assert.equal(view.range, "Sep 18-24");
		assert.equal(view.total, "1:20:23");
		assert.deepEqual(
			view.days.map((d) => d.label),
			["F", "S", "S", "M", "T", "W", "T"],
		);
		assert.equal(view.month.length, 28);
		assert.equal(view.month.filter(Boolean).length, 2);
	});
});

describe("intensity minutes", () => {
	it("runs Monday to today against the weekly goal", () => {
		const rows = [
			row("2026-09-21", { intensity_minutes: 30 }),
			row("2026-09-22", { intensity_minutes: 0 }),
			row("2026-09-23", { intensity_minutes: 80, intensity_goal: 150 }),
		];
		const view = intensityView(input(rows, "2026-09-23"))!;
		assert.equal(view.total, 110);
		assert.equal(view.goal, 150);
		assert.deepEqual(
			view.week.map((d) => d.total),
			[30, 30, 110, null, null, null, null],
		);
		assert.equal(view.week[2]!.today, true);
	});
});

describe("training readiness", () => {
	it("reads the factors Garmin lists under the score", () => {
		const view = readinessView(
			row(
				"d",
				{ training_readiness: 86, recovery_time_hours: 4 },
				{
					training_readiness_level: "HIGH",
					readiness_feedback: "ENERGIZED_BY_GOOD_SLEEP",
					readiness_sleep_feedback: "EXCELLENT",
					hrv_status: "BALANCED",
					readiness_load_feedback: "OPTIMAL",
				},
			),
		)!;
		assert.equal(view.level, "High");
		assert.equal(view.message, "Energized by good sleep");
		assert.deepEqual(view.factors.slice(0, 4), [
			{ label: "Sleep", value: "Excellent" },
			{ label: "Recovery", value: "Low Need" },
			{ label: "HRV Status", value: "Balanced" },
			{ label: "Acute Load", value: "Optimal" },
		]);
	});
});

describe("training status", () => {
	it("maps Garmin's numbered statuses to a tone", () => {
		assert.equal(statusTone("PRODUCTIVE_3"), "productive");
		assert.equal(statusTone("MAINTAINING_1"), "maintaining");
		assert.equal(statusTone(undefined), "none");
	});

	it("merges four weeks of status into runs", () => {
		const rows = [
			row("2026-09-22", {}, { training_status: "MAINTAINING_1" }),
			row("2026-09-23", {}, { training_status: "PRODUCTIVE_3" }),
			row(
				"2026-09-24",
				{ heat_acclimation_pct: 100, vo2max: 55 },
				{ training_status: "PRODUCTIVE_3", load_focus: "ANAEROBIC_SHORTAGE", training_status_since: "2026-09-23" },
			),
		];
		const view = trainingStatusView(input(rows), rows[2])!;
		assert.equal(view.status, "Productive");
		assert.equal(view.loadFocus, "Anaerobic Shortage");
		assert.equal(view.since, "Sep 23");
		assert.deepEqual(view.history, [
			{ tone: "none", days: 25 },
			{ tone: "maintaining", days: 1 },
			{ tone: "productive", days: 2 },
		]);
	});
});

describe("events", () => {
	it("lists upcoming events soonest first and drops past ones", () => {
		const events = eventsView(
			{
				events: [
					{ name: "Later", date: "2026-12-01" },
					{ name: "IRONMAN 70.3 Dhofar", date: "2026-10-24" },
					{ name: "Past", date: "2026-01-01" },
				],
			},
			"2026-09-24",
		);
		assert.deepEqual(events[0], { name: "IRONMAN 70.3 Dhofar", countdown: "IN 4 WEEKS, 2 DAYS", when: "Sat, Oct 24" });
		assert.deepEqual(
			events.map((e) => e.name),
			["IRONMAN 70.3 Dhofar", "Later"],
		);
	});
});

describe("the whole screen", () => {
	it("builds from an empty vault without throwing", () => {
		const model = homeModel({ date: "2026-09-24", rows: [], series: null, account: null });
		assert.equal(model.sleep, null);
		assert.equal(model.steps, null);
		assert.deepEqual(model.today, []);
		assert.equal(model.activities.total, "0:00");
	});

	it("shows the newest synced day when today has not synced", () => {
		assert.equal(dayToShow([row("2026-09-22"), row("2026-09-23")], "2026-09-24"), "2026-09-23");
		assert.equal(dayToShow([], "2026-09-24"), "2026-09-24");
	});
});
