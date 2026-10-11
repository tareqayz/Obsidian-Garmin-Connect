import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { GLANCE_STATS, type GlanceId } from "../src/dashboard/glance";
import { HEALTH_STATS } from "../src/dashboard/health-stats";
import { PERFORMANCE_REGISTRY, PERFORMANCE_STATS, type PerformanceStatId } from "../src/dashboard/performance-stats";
import { PERIOD_RANGES, monthsLabel, periodLabel, spanOf, type SpanRange, type SpanRule } from "../src/dashboard/periods";
import { linkOf, spanRuleOf, statRegistry, type StatDef } from "../src/dashboard/stat-registry";
import { ALL_GROUPS } from "../src/sync/metrics";

/** The day of the phone's Performance Stats shots (ref/performance-stats), a Sunday. */
const TODAY = "2026-10-11";

const stat = (id: PerformanceStatId) => PERFORMANCE_REGISTRY.get(id)!;
const pageIds = PERFORMANCE_STATS.map((s) => s.id).filter((id) => id !== "cycling-ability");

describe("PERFORMANCE_STATS", () => {
	it("lists the hub's sixteen in the phone's order, then the two pages Training Status opens", () => {
		assert.deepEqual(
			PERFORMANCE_STATS.map((s) => s.id),
			[
				"training-status",
				"training-readiness",
				"hrv-status",
				"race-predictor",
				"vo2-max",
				"running-economy",
				"training-effect",
				"cycling-power-curve",
				"ftp",
				"cycling-ability",
				"critical-swim-speed",
				"running-tolerance",
				"running-lactate-threshold",
				"endurance-score",
				"hill-score",
				"hrv-stress",
				"training-load",
				"heat-acclimation",
			],
		);
		assert.deepEqual(
			PERFORMANCE_STATS.map((s) => s.title),
			[
				"Training Status",
				"Training Readiness",
				"HRV Status",
				"Race Predictor",
				"VO₂ Max",
				"Running Economy",
				"Training Effect",
				"Cycling Power Curve",
				"FTP",
				"Cycling Ability",
				"Critical Swim Speed",
				"Running Tolerance",
				"Running Lactate Threshold",
				"Endurance Score",
				"Hill Score",
				"HRV Stress",
				"Load",
				"Heat Acclimation",
			],
		);
	});

	it("gives every stat ranges in the control's order, the first its default, and an existing group", () => {
		for (const s of PERFORMANCE_STATS) {
			assert.ok(s.ranges.length > 0, s.id);
			assert.deepEqual(
				s.ranges,
				PERIOD_RANGES.filter((r) => s.ranges.includes(r)),
				`${s.id}: ranges out of order or unknown`,
			);
			assert.equal(s.defaultRange, s.ranges[0], s.id);
			assert.ok(ALL_GROUPS.includes(s.group), `${s.id}: no group ${s.group}`);
		}
	});

	it("sets each stat's ranges from the phone, Current as 1d", () => {
		const shown = (id: PerformanceStatId) => stat(id).ranges.map((r) => stat(id).rangeLabels?.[r] ?? r).join(" · ");
		assert.equal(shown("training-status"), "Current · 4w · 12w · 6m");
		assert.equal(shown("training-readiness"), "1d");
		assert.equal(shown("hrv-status"), "1d · 7d · 4w");
		assert.equal(shown("race-predictor"), "Current · 4w · 6m · 1y");
		assert.equal(shown("vo2-max"), "Current · 4w · 12w · 6m");
		assert.equal(shown("running-economy"), "Current · 4w · 12w · 1y");
		assert.equal(shown("training-effect"), "7d · 4w");
		assert.equal(shown("cycling-power-curve"), "4w · 3m · 1y");
		assert.equal(shown("ftp"), "Current · 4w · 12w · 1y");
		assert.equal(shown("critical-swim-speed"), "Current · 7d · 12w · 1y");
		assert.equal(shown("running-tolerance"), "Current · 12w · 1y");
		assert.equal(shown("running-lactate-threshold"), "Current · 4w · 12w · 1y");
		assert.equal(shown("endurance-score"), "1d · 12w · 1y");
		assert.equal(shown("hill-score"), "1d · 4w · 12w · 1y");
		assert.equal(shown("hrv-stress"), "7d · 4w");
		assert.equal(shown("training-load"), "4w");
		assert.equal(shown("heat-acclimation"), "1d · 7d · 4w");
	});

	it("gives the tabbed pages their tabs, the first where they open", () => {
		const tabbed = PERFORMANCE_STATS.filter((s) => s.tabs).map((s) => [s.id, s.tabs]);
		assert.deepEqual(tabbed, [
			["vo2-max", ["running", "cycling"]],
			["ftp", ["cycling", "xc"]],
			["endurance-score", ["score", "contributors"]],
			["training-load", ["focus", "exercise", "training"]],
		]);
	});

	it("shares no id with Health Stats", () => {
		const health = new Set<string>(HEALTH_STATS.map((s) => s.id));
		assert.deepEqual(
			PERFORMANCE_STATS.filter((s) => health.has(s.id)).map((s) => s.id),
			[],
		);
	});
});

describe("the Performance hub", () => {
	it("shows fifteen rows once every page is registered: not Cycling Ability, not the hidden pages", () => {
		assert.deepEqual(
			PERFORMANCE_REGISTRY.hubStats(PERFORMANCE_STATS.map((s) => s.id)).map((s) => s.id),
			[
				"training-status",
				"training-readiness",
				"hrv-status",
				"race-predictor",
				"vo2-max",
				"running-economy",
				"training-effect",
				"cycling-power-curve",
				"ftp",
				"critical-swim-speed",
				"running-tolerance",
				"running-lactate-threshold",
				"endurance-score",
				"hill-score",
				"hrv-stress",
			],
		);
	});

	it("lists registered pages only, in the app's order whatever order they were registered in", () => {
		assert.deepEqual(PERFORMANCE_REGISTRY.hubStats([]), []);
		assert.deepEqual(
			PERFORMANCE_REGISTRY.hubStats(["hill-score", "nonsense", "vo2-max"]).map((s) => s.id),
			["vo2-max", "hill-score"],
		);
	});

	it("routes the hidden pages and gives them commands", () => {
		assert.deepEqual(
			PERFORMANCE_REGISTRY.pageStats(["heat-acclimation", "training-load", "training-status"]).map((s) => s.id),
			["training-status", "training-load", "heat-acclimation"],
		);
		assert.equal(PERFORMANCE_REGISTRY.page("training-load")?.title, "Load");
		assert.deepEqual(
			PERFORMANCE_STATS.filter((s) => s.hub === false).map((s) => s.id),
			["training-load", "heat-acclimation"],
		);
	});

	it("keeps Cycling Ability listed but without a page", () => {
		assert.equal(stat("cycling-ability").title, "Cycling Ability");
		assert.equal(stat("cycling-ability").group, "profile");
		assert.equal(PERFORMANCE_REGISTRY.page("cycling-ability"), undefined);
		assert.deepEqual(PERFORMANCE_REGISTRY.pageStats(["cycling-ability"]), []);
		assert.deepEqual(PERFORMANCE_REGISTRY.hubStats(["cycling-ability"]), []);
		assert.equal(PERFORMANCE_REGISTRY.page("darts"), undefined);
		assert.equal(PERFORMANCE_REGISTRY.page("stress"), undefined);
		assert.equal(pageIds.length, 17);
	});
});

describe("At a Glance links", () => {
	const claims = [...HEALTH_STATS, ...PERFORMANCE_STATS].flatMap((s: StatDef) => (s.glance ?? []).map((g) => ({ stat: s, link: linkOf(g) })));

	it("name only cards that exist, each claimed once at most across Health and Performance", () => {
		const known = new Set(GLANCE_STATS.map((g) => g.id));
		const claimed = new Map<GlanceId, string>();
		for (const { stat: s, link } of claims) {
			assert.ok(known.has(link.id), `${s.id}: no glance card ${link.id}`);
			assert.equal(claimed.get(link.id), undefined, `${link.id} claimed twice`);
			claimed.set(link.id, s.id);
		}
		// Altitude Acclimation and Cycling Ability are left out for now: their cards open nothing.
		assert.equal(claimed.has("altitude"), false);
		assert.equal(claimed.has("cyclingAbility"), false);
	});

	it("land on a tab the stat has, and a range it has", () => {
		for (const { stat: s, link } of claims) {
			if (link.tab !== undefined) assert.ok(s.tabs?.includes(link.tab), `${link.id}: ${s.id} has no tab ${link.tab}`);
			if (link.range !== undefined) assert.ok(s.ranges.includes(link.range), `${link.id}: ${s.id} has no range ${link.range}`);
		}
	});

	it("open each card's page, on the tab it names", () => {
		const target = (glance: GlanceId) => {
			const t = PERFORMANCE_REGISTRY.glanceTarget(glance);
			return t && { ...t, stat: t.stat.id };
		};
		assert.deepEqual(target("trainingStatus"), { stat: "training-status" });
		assert.deepEqual(target("loadFocus"), { stat: "training-load", tab: "focus" });
		assert.deepEqual(target("trainingLoad"), { stat: "training-load", tab: "training" });
		assert.deepEqual(target("heat"), { stat: "heat-acclimation" });
		assert.deepEqual(target("readiness"), { stat: "training-readiness" });
		assert.deepEqual(target("hrv"), { stat: "hrv-status" });
		assert.deepEqual(target("vo2max"), { stat: "vo2-max" });
		assert.deepEqual(target("cyclingVo2"), { stat: "vo2-max", tab: "cycling" });
		assert.deepEqual(target("runningEconomy"), { stat: "running-economy" });
		assert.deepEqual(target("criticalSwimSpeed"), { stat: "critical-swim-speed" });
		assert.deepEqual(target("runningTolerance"), { stat: "running-tolerance" });
		assert.deepEqual(target("lactateThreshold"), { stat: "running-lactate-threshold" });
		assert.deepEqual(target("endurance"), { stat: "endurance-score" });
		assert.deepEqual(target("hillScore"), { stat: "hill-score" });
		assert.deepEqual(target("cyclingFtp"), { stat: "ftp", tab: "cycling" });
		assert.deepEqual(target("xcSkiFtp"), { stat: "ftp", tab: "xc" });
		assert.equal(target("altitude"), undefined);
		assert.equal(target("cyclingAbility"), undefined);
		assert.equal(target("stress"), undefined);
	});

	it("open nothing until the page is registered", () => {
		assert.equal(PERFORMANCE_REGISTRY.glanceTarget("cyclingVo2", []), undefined);
		assert.equal(PERFORMANCE_REGISTRY.glanceTarget("cyclingVo2", ["hill-score"]), undefined);
		assert.deepEqual(PERFORMANCE_REGISTRY.glanceTarget("cyclingVo2", ["vo2-max"])?.tab, "cycling");
	});
});

describe("spans, today 2026-10-11", () => {
	it("are rules for the stat's own longer ranges", () => {
		const valid = (rule: SpanRule) =>
			"days" in rule
				? Number.isInteger(rule.days) && rule.days > 0
				: "weeks" in rule
					? Number.isInteger(rule.weeks) && rule.weeks > 0 && Number.isInteger(rule.weekStart) && rule.weekStart >= 0 && rule.weekStart <= 6
					: "monthEnds" in rule
						? Number.isInteger(rule.monthEnds) && rule.monthEnds > 0
						: Number.isInteger(rule.months) && rule.months > 0;
		for (const s of PERFORMANCE_STATS) {
			for (const range of Object.keys(s.spans ?? {}) as SpanRange[]) {
				const rule = s.spans![range]!;
				assert.ok(s.ranges.includes(range), `${s.id}: a span for ${range}, a range it lacks`);
				assert.ok(valid(rule), `${s.id} ${range}: ${JSON.stringify(rule)}`);
			}
		}
	});

	it("cut every period the phone showed", () => {
		/* Each range's period label in the shots, all taken on TODAY. Training
		   Status's 6m was not shot. */
		const PHONE: Partial<Record<PerformanceStatId, Partial<Record<SpanRange, string>>>> = {
			"training-status": { "4w": "Sep 14 - Oct 11", "12w": "Jul 20 - Oct 11" },
			"hrv-status": { "7d": "Oct 5 - 11", "4w": "Sep 14 - Oct 11" },
			"race-predictor": { "4w": "Sep 14 - Oct 11", "6m": "May 31 - Oct 11", "1y": "Nov 30, 2025 - Oct 11, 2026" },
			"vo2-max": { "4w": "Sep 14 - Oct 11", "12w": "Jul 20 - Oct 11", "6m": "Apr 13 - Oct 11" },
			"running-economy": { "4w": "Sep 14 - Oct 11", "12w": "Jul 20 - Oct 11", "1y": "Oct 13, 2025 - Oct 11, 2026" },
			"training-effect": { "7d": "Oct 5 - 11", "4w": "Sep 14 - Oct 11" },
			"cycling-power-curve": { "4w": "Sep 14 - Oct 11", "3m": "Jul 12 - Oct 11", "1y": "Oct 12, 2025 - Oct 11, 2026" },
			ftp: { "4w": "Sep 14 - Oct 11", "12w": "Jul 20 - Oct 11", "1y": "Oct 13, 2025 - Oct 11, 2026" },
			"critical-swim-speed": { "7d": "Oct 5 - 11", "12w": "Jul 20 - Oct 11", "1y": "Oct 13, 2025 - Oct 11, 2026" },
			"running-tolerance": { "12w": "Jul 26 - Oct 11", "1y": "Oct 19, 2025 - Oct 11, 2026" },
			"running-lactate-threshold": { "4w": "Sep 14 - Oct 11", "12w": "Jul 20 - Oct 11", "1y": "Oct 13, 2025 - Oct 11, 2026" },
			"endurance-score": { "12w": "Jul 20 - Oct 11", "1y": "Oct 13, 2025 - Oct 11, 2026" },
			"hill-score": { "4w": "Sep 14 - Oct 11", "12w": "Jul 20 - Oct 11", "1y": "Nov 2025 - Oct 2026" },
			"hrv-stress": { "7d": "Oct 5 - 11", "4w": "Sep 14 - Oct 11" },
			"training-load": { "4w": "Sep 14 - Oct 11" },
			"heat-acclimation": { "7d": "Oct 5 - 11", "4w": "Sep 14 - Oct 11" },
		};
		let checked = 0;
		for (const s of PERFORMANCE_STATS) {
			for (const range of s.ranges) {
				if (range === "1d") continue;
				const expected = PHONE[s.id]?.[range];
				if (expected === undefined) {
					assert.equal(`${s.id} ${range}`, "training-status 6m", "a period the shots have no label for");
					continue;
				}
				const rule = spanRuleOf(s, range);
				const { from, to } = spanOf(rule, 0, TODAY);
				const label = "months" in rule && rule.calendar ? monthsLabel(from, to) : periodLabel(from, to, TODAY);
				assert.equal(label, expected, `${s.id} ${range}`);
				checked++;
			}
		}
		assert.equal(checked, 39);
	});
});

describe("statRegistry", () => {
	type Id = "own" | "listed" | "hidden" | "pageless";
	const registry = statRegistry(
		[
			{ id: "own", title: "Own", ranges: ["1d"], defaultRange: "1d", group: "sleep", glance: ["sleep"] },
			{ id: "listed", title: "Listed", ranges: ["7d", "4w"], defaultRange: "7d", group: "stress", glance: [{ id: "stress", range: "4w", sub: "events" }] },
			{ id: "hidden", title: "Hidden", ranges: ["4w"], defaultRange: "4w", group: "training", hub: false },
			{ id: "pageless", title: "Pageless", ranges: ["1d"], defaultRange: "1d", group: "profile", glance: ["cyclingAbility"] },
		] satisfies StatDef<Id>[],
		{ ownRoute: ["own"], noPage: ["pageless"] },
	);
	const all = ["own", "listed", "hidden", "pageless"];

	it("keeps a stat with its own route in the hub and off the shared route", () => {
		assert.deepEqual(
			registry.hubStats([]).map((s) => s.id),
			["own"],
		);
		assert.equal(registry.page("own"), undefined);
		assert.equal(registry.get("own")?.title, "Own");
		assert.equal(registry.glanceTarget("sleep", all), undefined);
	});

	it("keeps a stat without a page out of both, and a hidden one out of the hub only", () => {
		assert.deepEqual(
			registry.hubStats(all).map((s) => s.id),
			["own", "listed"],
		);
		assert.deepEqual(
			registry.pageStats(all).map((s) => s.id),
			["listed", "hidden"],
		);
		assert.equal(registry.glanceTarget("cyclingAbility"), undefined);
	});

	it("hands a glance card's sub-page and range over with its stat", () => {
		assert.deepEqual(registry.glanceTarget("stress", ["listed"]), { stat: registry.get("listed"), sub: "events", range: "4w" });
		assert.equal(registry.glanceTarget("stress", ["own"]), undefined);
	});

	it("cuts a range by the stat's own rule, or the range's default", () => {
		assert.deepEqual(spanRuleOf({ spans: { "1y": { monthEnds: 12 } } }, "1y"), { monthEnds: 12 });
		assert.deepEqual(spanRuleOf({ spans: { "1y": { monthEnds: 12 } } }, "4w"), { days: 28 });
		assert.deepEqual(spanRuleOf({}, "3m"), { months: 3 });
	});
});
