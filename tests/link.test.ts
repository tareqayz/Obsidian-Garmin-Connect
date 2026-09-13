import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { linkTargetFor, withLink } from "../src/sync/link";

describe("withLink", () => {
	it("writes the target as a wikilink so Obsidian treats it as a link", () => {
		const out = withLink({ date: "2026-09-13" }, { property: "link", target: "Garmin/Garmin Health.base" });
		assert.deepEqual(out, { date: "2026-09-13", link: "[[Garmin/Garmin Health.base]]" });
	});

	it("leaves properties untouched when linking is off or unconfigured", () => {
		const props = { date: "2026-09-13" };
		assert.deepEqual(withLink(props, undefined), props);
		assert.deepEqual(withLink(props, { property: "", target: "x" }), props);
		assert.deepEqual(withLink(props, { property: "link", target: "" }), props);
	});
});

describe("linkTargetFor", () => {
	it("drops a note's extension but keeps one Obsidian cannot infer", () => {
		assert.equal(linkTargetFor("Garmin/Garmin Health.base"), "Garmin/Garmin Health.base");
		assert.equal(linkTargetFor("/Garmin/Hub.md/"), "Garmin/Hub");
	});
});
