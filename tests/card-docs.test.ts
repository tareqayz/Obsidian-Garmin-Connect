import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { CARDS } from "../src/embeds/catalog";
import { CHARTS, rangesInWords } from "../src/embeds/charts";

/** The Guide's own section on cards in notes, up to the next top-level heading. */
function guideSection(): string {
	const guide = readFileSync("docs/GUIDE.md", "utf8");
	const start = guide.indexOf("## Garmin cards in notes");
	assert.ok(start >= 0, "GUIDE.md has a Garmin cards in notes section");
	const end = guide.indexOf("\n## ", start + 1);
	return guide.slice(start, end < 0 ? undefined : end);
}

describe("the Guide on cards in notes", () => {
	it("names every card a block can show, by its show: name and title", () => {
		const section = guideSection();
		for (const card of CARDS) {
			assert.match(section, new RegExp(`\\| ${card.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}( \\(big\\))? \\| \`${card.id}\` \\|`), card.id);
		}
	});

	it("marks the big cards, and only those", () => {
		const section = guideSection();
		for (const card of CARDS) assert.equal(section.includes(`| ${card.title} (big) |`), card.kind === "focus", card.id);
	});

	it("names every chart with its ranges", () => {
		const section = guideSection();
		for (const chart of CHARTS) assert.ok(section.includes(`| ${chart.title} | \`${chart.id}\` | ${rangesInWords(chart.ranges)} | ${chart.description} |`), chart.id);
	});
});
