import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { GLANCE_STATS } from "../src/dashboard/glance";
import { CARDS, cardByName, cardKey, closestCard } from "../src/embeds/catalog";
import { MAX_CARDS, parseCardBlock, snippetFor, type CardSpec, type SpecError } from "../src/embeds/spec";

const spec = (source: string): CardSpec => {
	const read = parseCardBlock(source);
	if ("error" in read) assert.fail(read.error.message);
	return read.spec;
};
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
		assert.equal(error("date: today").message, "Add a show line, such as show: sleep.");
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
			assert.deepEqual(spec(snippetFor(card).replace(/^```garmin\n|```\n$/g, "")).cards, [card]);
			const dated = snippetFor(card, { date: "2026-10-28" });
			assert.ok(dated.startsWith("```garmin\n") && dated.endsWith("```\n"));
			assert.deepEqual(spec(dated.replace(/^```garmin\n|```\n$/g, "")).date, { kind: "date", date: "2026-10-28" });
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
