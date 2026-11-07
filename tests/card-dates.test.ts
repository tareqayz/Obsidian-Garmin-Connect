import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import moment from "moment";
import { dailyNoteDay, nameDay, propertyDay, resolveCardDate, type CardDateInput } from "../src/embeds/dates";

/** The plugin's strict parse (`core-plugins.ts`), with the moment Obsidian bundles. */
const parse = (text: string, format: string): string | null => {
	const at = moment(text, format, true);
	return at.isValid() && at.format(format) === text ? at.format("YYYY-MM-DD") : null;
};

const TODAY = "2026-10-29";
const input = (over: Partial<CardDateInput>): CardDateInput => ({ path: "Note.md", today: TODAY, parse, daily: { folder: "", format: "YYYY-MM-DD" }, ...over });

describe("which day a card block shows", () => {
	it("takes the block's own date first, and says the note's when it differs", () => {
		assert.deepEqual(resolveCardDate(input({ explicit: { kind: "date", date: "2026-10-21" }, path: "2026-10-28.md" })), {
			date: "2026-10-21",
			live: false,
			source: "block",
			noteDay: "2026-10-28",
		});
		assert.deepEqual(resolveCardDate(input({ explicit: { kind: "yesterday" } })), { date: "2026-10-28", live: false, source: "block" });
		assert.deepEqual(resolveCardDate(input({ explicit: { kind: "today" } })), { date: TODAY, live: true, source: "block" });
	});

	it("reads a daily note's day from its path, with its folder and format", () => {
		assert.equal(resolveCardDate(input({ path: "2026-10-28.md" })).date, "2026-10-28");
		const daily = { folder: "Journal", format: "YYYY/MM/DD dddd" };
		assert.deepEqual(resolveCardDate(input({ path: "Journal/2026/10/28 Wednesday.md", daily })), { date: "2026-10-28", live: false, source: "daily-note", noteDay: "2026-10-28" });
		// Outside the folder, or not its format: not a daily note.
		assert.equal(dailyNoteDay("Elsewhere/2026/10/28 Wednesday.md", daily, parse), null);
		assert.equal(dailyNoteDay("Journal/2026/10/28.md", daily, parse), null);
		// Read strictly: a day the format can't write back isn't taken.
		assert.equal(dailyNoteDay("2026-10-28 copy.md", { folder: "", format: "YYYY-MM-DD" }, parse), null);
	});

	it("then the note's date property, then a date in its name", () => {
		assert.deepEqual(resolveCardDate(input({ path: "Long run.md", frontmatter: { date: "2026-10-20T07:05" } })), { date: "2026-10-20", live: false, source: "property", noteDay: "2026-10-20" });
		assert.deepEqual(resolveCardDate(input({ path: "Runs/Long run 2026-10-19.md", daily: null })), { date: "2026-10-19", live: false, source: "name", noteDay: "2026-10-19" });
		// The daily note's own name wins over a property a template stamped.
		assert.equal(resolveCardDate(input({ path: "2026-10-28.md", frontmatter: { date: "2026-10-29" } })).date, "2026-10-28");
	});

	it("shows today, live, in a note without a day", () => {
		assert.deepEqual(resolveCardDate(input({ path: "Health dashboard.md" })), { date: TODAY, live: true, source: "today" });
	});

	it("reads only real days", () => {
		assert.equal(propertyDay({ date: "2026-13-01" }), null);
		assert.equal(propertyDay({ date: 20261028 }), null);
		assert.equal(nameDay("Notes/2026-02-30.md"), null);
		assert.equal(nameDay("Notes/12026-10-280.md"), null);
		assert.equal(nameDay("Notes/run-2026-10-28.md"), "2026-10-28");
	});
});
