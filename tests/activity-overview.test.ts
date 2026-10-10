import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { activityWhen, effortColor, effortOf, feelLabel, primaryBenefit, sportTitle } from "../src/dashboard/activity-labels";
import { overviewView, weatherChip } from "../src/dashboard/activity-overview";
import { buildActivityDetail, type ActivityDetail } from "../src/sync/activity-detail";

// The captured run's summary values (spec: ref/activity-details/outdoor-run), with a
// made-up id and a made-up route: no one's GPS.
const SUMMARY = {
	activityName: "Dubai Running",
	activityTypeDTO: { typeId: 1, typeKey: "running", parentTypeId: 17 },
	accessControlRuleDTO: { typeKey: "private" },
	summaryDTO: {
		startTimeLocal: "2026-10-10T08:19:48.0",
		startTimeGMT: "2026-10-10T04:19:48.0",
		distance: 10009,
		duration: 3360.82,
		averageSpeed: 2.977999925613403,
		maxSpeed: 3.246999979019165,
		averageHR: 167,
		calories: 694,
		trainingEffectLabel: "LACTATE_THRESHOLD",
		directWorkoutFeel: 50,
		directWorkoutRpe: 60,
	},
};
const ROUTE = {
	metricDescriptors: [
		{ metricsIndex: 0, key: "directLatitude" },
		{ metricsIndex: 1, key: "directLongitude" },
	],
	activityDetailMetrics: [{ metrics: [10, 20] }, { metrics: [10.001, 20.001] }],
};
const WEATHER = { temp: 88, windSpeed: 5, windDirection: 210, windDirectionCompassPoint: "ssw", weatherTypeDTO: { desc: "Clear" } };

function detail(extra: Record<string, unknown> = {}): ActivityDetail {
	return buildActivityDetail(1, { summary: SUMMARY, samples: ROUTE, weather: WEATHER, device: { productDisplayName: "Forerunner 970", versionMajorMinor: "18.32" }, ...extra }, null)!;
}

describe("overviewView", () => {
	const view = overviewView(detail(), "metric", "2026-10-10");

	it("reads the date line, the name and the distance as the phone does", () => {
		assert.equal(view.when, "Oct 10 @ 8:19 AM");
		assert.equal(view.title, "Dubai Running");
		assert.equal(view.private, true);
		assert.equal(view.glyph, "run");
		assert.deepEqual(view.distance, { value: "10.01", unit: "km" });
	});

	it("has the four figures, two of them opening their charts", () => {
		assert.deepEqual(view.figures, [
			{ value: "167", unit: "bpm", label: "Avg Heart Rate", chart: "heart-rate" },
			{ value: "5:36", unit: "/km", label: "Avg Pace", chart: "pace" },
			{ value: "56:01", label: "Total Time" },
			{ value: "694", label: "Total Calories" },
		]);
	});

	it("evaluates the run: Threshold (High Aerobic), Normal, Hard 6/10", () => {
		assert.equal(view.benefit?.label, "Threshold (High Aerobic)");
		assert.equal(view.feel, "Normal");
		assert.deepEqual(view.effort, { value: 6, score: "6/10", label: "Hard" });
	});

	it("names the watch with the firmware the run was recorded on, and the running links", () => {
		assert.deepEqual(view.device, { name: "Forerunner 970", firmware: "18.32" });
		assert.deepEqual(
			view.links.map((l) => l.label),
			["Running Personal Records", "All Running Activities"],
		);
		assert.deepEqual(view.links[0]!.route, { page: "records", tab: "running" });
	});

	it("draws the map only with a route", () => {
		assert.equal(view.map, true);
		const indoor = overviewView(detail({ samples: { metricDescriptors: [], activityDetailMetrics: [] } }), "metric");
		assert.equal(indoor.map, false);
		assert.equal(indoor.weather, null);
	});
});

describe("weatherChip", () => {
	it("shows °F as °C and Garmin's wind ×1.852 as the phone does: 31°, 9", () => {
		assert.deepEqual(weatherChip(detail(), "metric"), { temp: "31°", icon: "sun", wind: "9", windFrom: 210 });
	});

	it("keeps °F in imperial, and has no chip without weather", () => {
		assert.equal(weatherChip(detail(), "imperial")?.temp, "88°");
		assert.equal(weatherChip(detail({ weather: { temp: null, windSpeed: null } }), "metric"), null);
	});
});

describe("activity labels", () => {
	it("names the sport and the day", () => {
		assert.equal(sportTitle("running"), "Running");
		assert.equal(sportTitle("treadmill_running"), "Treadmill Running");
		assert.equal(activityWhen("2026-10-03T14:59:19", "2026-10-10"), "Oct 3 @ 2:59 PM");
		assert.equal(activityWhen("2025-12-31T00:05:00", "2026-10-10"), "Dec 31, 2025 @ 12:05 AM");
	});

	it("knows the confirmed benefits, feel and effort words", () => {
		assert.equal(primaryBenefit("TEMPO")?.label, "Tempo (High Aerobic)");
		assert.deepEqual(primaryBenefit("SOMETHING_NEW"), { name: "Something New", group: null, label: "Something New" });
		assert.equal(primaryBenefit(undefined), null);
		assert.equal(feelLabel(50), "Normal");
		assert.equal(feelLabel(42), null);
		assert.deepEqual(effortOf(40), { value: 4, score: "4/10", label: "Somewhat Hard" });
		assert.equal(effortColor(6), "#f5bf2a");
	});
});
