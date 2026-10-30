import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { GLANCE_STATS } from "../src/dashboard/glance";
import { healthStat } from "../src/dashboard/health-stats";
import { PERFORMANCE_REGISTRY } from "../src/dashboard/performance-stats";
import { STAT_RANGES } from "../src/dashboard/stats-pages";
import { CARDS, cardByName, cardKey, closestCard } from "../src/embeds/catalog";
import { CHARTS, chartByName, closestChart } from "../src/embeds/charts";
import {
	activitySnippet,
	chartSnippet,
	MAX_CARDS,
	parseCardBlock,
	snippetFor,
	type ActivitySpec,
	type BlockSpec,
	type CardSpec,
	type ChartSpec,
	type SpecError,
} from "../src/embeds/spec";

const read = (source: string): BlockSpec => {
	const got = parseCardBlock(source);
	if ("error" in got) assert.fail(got.error.message);
	return got.spec;
};
const spec = (source: string): CardSpec => {
	const got = read(source);
	if (got.kind !== "cards") assert.fail(`expected cards, got ${got.kind}`);
	return got;
};
const charts = (source: string): ChartSpec => {
	const got = read(source);
	if (got.kind !== "charts") assert.fail(`expected charts, got ${got.kind}`);
	return got;
};
const activity = (source: string): ActivitySpec => {
	const got = read(source);
	if (got.kind !== "activity") assert.fail(`expected an activity, got ${got.kind}`);
	return got;
};
const inner = (block: string) => block.replace(/^```garmin\n|```\n$/g, "");
const error = (source: string): SpecError => {
	const read = parseCardBlock(source);
	if (!("error" in read)) assert.fail("expected an error");
	return read.error;
};

describe("card blocks: reading a ```garmin block", () => {
	it("reads show, date and size, with blank lines and comments", () => {
		const read = spec("# the morning\nshow: sleep, body-battery\n\ndate: 2026-10-28\nsize: small\n");
		assert.deepEqual(read.cards.map((c) => c.id), ["sleep", "body-battery"]);
		assert.deepEqual(read.date, { kind: "date", date: "2026-10-28" });
		assert.equal(read.size, "small");
	});

	it("takes names in any case, spacing or Home's own ids, each once", () => {
		assert.deepEqual(spec("show: Heart Rate, heartRate, HRV, intensity_minutes, Body Battery").cards.map((c) => c.id), ["heart-rate", "hrv-status", "intensity-minutes", "body-battery"]);
		assert.deepEqual(spec("Show:   STEPS\r\n").cards.map((c) => c.id), ["steps"]);
	});

	it("reads today and yesterday, and takes a template's unfilled date as none", () => {
		assert.deepEqual(spec("show: sleep\ndate: today").date, { kind: "today" });
		assert.deepEqual(spec("show: sleep\ndate: Yesterday").date, { kind: "yesterday" });
		assert.equal(spec("show: sleep\ndate: {{date:YYYY-MM-DD}}").date, undefined);
		assert.equal(spec('show: sleep\ndate: <% tp.date.now("YYYY-MM-DD") %>').date, undefined);
		assert.deepEqual(spec('show: sleep\ndate: "2026-10-28"').date, { kind: "date", date: "2026-10-28" });
	});

	it("says what's wrong, on which line, and what was meant", () => {
		assert.deepEqual(error("show: slep"), { line: 1, message: "Unknown card “slep”. Did you mean sleep?", hint: "Insert card… lists every card." });
		assert.equal(error("show: sleep\ndat: today").message, "Unknown option “dat”. Did you mean date?");
		assert.equal(error("show: sleep\ndat: today").line, 2);
		assert.equal(error("sleep").message, "Each line is a key and a value, such as show: sleep.");
		assert.equal(error("date: today").message, "Add a show, chart or activity line, such as show: sleep.");
		assert.equal(error("show: ").message, "Name a card after show:, such as show: sleep.");
		assert.equal(error("show: sleep\nshow: steps").message, "show appears twice.");
		assert.equal(error("show: sleep\ndate: 2026-02-30").message, "date takes YYYY-MM-DD, today or yesterday.");
		assert.equal(error("show: sleep\nsize: huge").message, "size takes small or normal.");
		assert.equal(error("show: day, sleep").message, "day goes in a block of its own.");
		assert.equal(error("show: sleep, activities").message, "activities goes in a block of its own.");
		assert.equal(error("show: zzzzzz").message, "Unknown card “zzzzzz”.");
	});

	it("holds at most as many cards as See All", () => {
		const names = CARDS.filter((c) => c.kind === "glance").slice(0, MAX_CARDS + 1).map((c) => c.id);
		assert.equal(error(`show: ${names.join(", ")}`).message, `Show at most ${MAX_CARDS} cards in one block.`);
		assert.equal(spec(`show: ${names.slice(0, MAX_CARDS).join(", ")}`).cards.length, MAX_CARDS);
	});

	it("inserts a block that reads back as the card", () => {
		for (const card of CARDS) {
			assert.deepEqual(spec(inner(snippetFor(card))).cards, [card]);
			const dated = snippetFor(card, { date: "2026-10-28" });
			assert.ok(dated.startsWith("```garmin\n") && dated.endsWith("```\n"));
			assert.deepEqual(spec(inner(dated)).date, { kind: "date", date: "2026-10-28" });
		}
	});
});

describe("chart blocks: reading chart, range and size", () => {
	it("reads the charts, the range and the day, the range a day by default", () => {
		const got = charts("chart: sleep, Heart Rate, spo2\nrange: 7D\ndate: 2026-10-28");
		assert.deepEqual(got.charts.map((c) => c.id), ["sleep", "heart-rate", "pulse-ox"]);
		assert.equal(got.range, "7d");
		assert.deepEqual(got.date, { kind: "date", date: "2026-10-28" });
		assert.equal(charts("chart: stress").range, "1d");
		assert.equal(charts("chart: stress\nrange: 4w\nsize: small").size, "small");
	});

	it("says which stats have no chart, which ranges a chart lacks, and what size: small needs", () => {
		assert.deepEqual(error("chart: strss"), { line: 1, message: "Unknown chart “strss”. Did you mean stress?", hint: "Insert card… lists every chart." });
		assert.equal(error("chart: vo2-max").message, "VO₂ Max has no chart yet.");
		assert.equal(error("chart: sleep\nrange: 2w").message, "range takes 1d, 7d, 4w or 1y.");
		assert.deepEqual(error("chart: stress, body-battery\nrange: 1y"), { line: 2, message: "Body Battery has no 1y chart." });
		assert.deepEqual(error("chart: stress\nsize: small"), { line: 2, message: "size: small draws trends. Add range: 7d, 4w or 1y." });
		assert.equal(error("show: sleep\nrange: 7d").message, "range goes with chart.");
		assert.deepEqual(error("show: sleep\nchart: sleep"), { line: 2, message: "Use one of show, chart and activity in a block." });
		assert.equal(error("chart: ").message, "Name a chart after chart:, such as chart: sleep.");
	});

	it("inserts a block that reads back as the chart, for the day", () => {
		for (const chart of CHARTS) {
			const got = charts(inner(chartSnippet(chart)));
			assert.deepEqual([got.charts, got.range], [[chart], "1d"]);
			assert.deepEqual(charts(inner(chartSnippet(chart, { date: "2026-10-28" }))).date, { kind: "date", date: "2026-10-28" });
		}
	});
});

describe("activity blocks", () => {
	it("reads latest, all or an id, with a day for the first two", () => {
		assert.deepEqual(activity("activity: latest\ndate: yesterday"), { kind: "activity", pick: { kind: "latest" }, date: { kind: "yesterday" } });
		assert.deepEqual(activity("activity: ALL").pick, { kind: "all" });
		assert.deepEqual(activity("activity: 20612345678").pick, { kind: "id", id: 20612345678 });
	});

	it("refuses anything else, and the options it doesn't take", () => {
		assert.equal(error("activity: run").message, "activity takes latest, all or an activity’s id.");
		assert.equal(error("activity: 0").message, "activity takes latest, all or an activity’s id.");
		assert.equal(error("activity: latest\nsize: small").message, "size goes with show or chart.");
		assert.equal(error("activity: latest\nrange: 7d").message, "range goes with chart.");
		assert.equal(error("activity: latest\nshow: sleep").message, "Use one of show, chart and activity in a block.");
	});

	it("inserts a block that reads back as the pick, dated only when it's the day's", () => {
		assert.deepEqual(activity(inner(activitySnippet({ kind: "id", id: 42 }, { date: "2026-10-28" }))), { kind: "activity", pick: { kind: "id", id: 42 } });
		assert.deepEqual(activity(inner(activitySnippet({ kind: "latest" }, { date: "2026-10-28" }))).date, { kind: "date", date: "2026-10-28" });
	});
});

describe("chart catalog", () => {
	it("charts the 11 stats, each on its page's own ranges", () => {
		assert.deepEqual(CHARTS.map((c) => c.id), ["sleep", "body-battery", "stress", "heart-rate", "steps", "floors", "intensity-minutes", "hrv-status", "respiration", "pulse-ox", "weight"]);
		const own = (id: string) => {
			if (id === "hrv-status") return PERFORMANCE_REGISTRY.get(id)!.ranges;
			if (["steps", "floors", "intensity-minutes"].includes(id)) return STAT_RANGES;
			return healthStat(id)!.ranges;
		};
		for (const chart of CHARTS) assert.deepEqual(chart.ranges, own(chart.id), chart.id);
	});

	it("answers to its card's names, and to a near miss", () => {
		assert.equal(chartByName("SpO2")?.id, "pulse-ox");
		assert.equal(chartByName("intensity")?.id, "intensity-minutes");
		assert.equal(chartByName("hrv")?.id, "hrv-status");
		assert.equal(chartByName("vo2-max"), undefined);
		assert.equal(closestChart("wieght")?.id, "weight");
	});

	it("describes every chart in one short sentence", () => {
		for (const chart of CHARTS) {
			assert.match(chart.description, /^[A-Z].*\.$/, chart.id);
			assert.ok(chart.description.split(" ").length <= 12, chart.id);
		}
	});
});

describe("card catalog", () => {
	it("draws every At a Glance card but the prompt-only ones", () => {
		const drawn = new Set(CARDS.map((c) => c.glance).filter(Boolean));
		const promptOnly = ["bloodPressure", "criticalSwimSpeed", "hydration", "lifestyle", "nutrition"];
		for (const stat of GLANCE_STATS) assert.equal(drawn.has(stat.id), !promptOnly.includes(stat.id), stat.id);
	});

	it("gives every name, alias included, to one card", () => {
		const owner = new Map<string, string>();
		for (const card of CARDS) {
			for (const name of new Set([card.id, ...card.aliases].map(cardKey))) {
				assert.ok(!owner.has(name) || owner.get(name) === card.id, `${name}: ${owner.get(name)} and ${card.id}`);
				owner.set(name, card.id);
			}
		}
		assert.equal(new Set(CARDS.map((c) => c.id)).size, CARDS.length);
	});

	it("draws Home's In Focus cards big and keeps the small version where Home has one", () => {
		assert.deepEqual(
			CARDS.filter((c) => c.kind === "focus").map((c) => [c.id, c.focus, c.glance ?? null]),
			[
				["sleep", "sleep", "sleep"],
				["body-battery", "bodyBattery", "bodyBattery"],
				["training-readiness", "readiness", "readiness"],
				["steps", "steps", "steps"],
				["activity-week", "activities", null],
				["training-status", "trainingStatus", "trainingStatus"],
			],
		);
	});

	it("describes every card in one short sentence", () => {
		for (const card of CARDS) {
			assert.match(card.description, /^[A-Z].*\.$/, card.id);
			assert.ok(card.description.split(" ").length <= 12, card.id);
		}
	});

	it("finds a card by a near miss", () => {
		assert.equal(cardByName("HRV Status")?.id, "hrv-status");
		assert.equal(closestCard("stres")?.id, "stress");
		assert.equal(closestCard("bodybatery")?.id, "body-battery");
		assert.equal(closestCard("qqq"), undefined);
	});
});
