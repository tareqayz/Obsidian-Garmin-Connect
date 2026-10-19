import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

// Obsidian loads only styles.css, so Leaflet's stylesheet is copied into it (src/ui/map/leaflet.ts).
describe("styles.css", () => {
	it("carries the installed Leaflet's stylesheet verbatim", () => {
		const leaflet = readFileSync("node_modules/leaflet/dist/leaflet.css", "utf8").replace(/\r\n/g, "\n");
		const styles = readFileSync("styles.css", "utf8");
		assert.ok(styles.includes(leaflet), "copy node_modules/leaflet/dist/leaflet.css (LF endings) to the top of styles.css");
	});
});
