import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

/**
 * Obsidian loads only styles.css, so Leaflet's stylesheet is copied into it (src/ui/map/leaflet.ts),
 * less what the Community directory's CSS check flags in it: a fallback for an old browser in front
 * of each standard declaration, `!important`, and a `text-indent` on the zoom buttons, which the maps
 * don't show. Each edit says how many times it applies, so a Leaflet upgrade fails here until the
 * copy is made again.
 */
const EDITS: Array<[from: string, to: string, times: number]> = [
	["\tmax-width: none !important;\n\tmax-height: none !important;\n", "\tmax-width: none;\n\tmax-height: none;\n", 2],
	["\t/* Fallback for FF which doesn't support pinch-zoom */\n\ttouch-action: none;\n\ttouch-action: pinch-zoom;\n", "\ttouch-action: pinch-zoom;\n", 1],
	["\tpointer-events: visiblePainted; /* IE 9-10 doesn't have auto */\n\tpointer-events: auto;\n", "\tpointer-events: auto;\n", 2],
	["\tcursor: -webkit-grab;\n\tcursor:    -moz-grab;\n\tcursor:         grab;\n", "\tcursor: grab;\n", 1],
	["\tcursor: move;\n\tcursor: -webkit-grabbing;\n\tcursor:    -moz-grabbing;\n\tcursor:         grabbing;\n", "\tcursor: grabbing;\n", 1],
	["\tfont-size: 12px;\n\tfont-size: 0.75rem;\n", "\tfont-size: 0.75rem;\n", 1],
	["\tfont: bold 18px 'Lucida Console', Monaco, monospace;\n\ttext-indent: 1px;\n", "\tfont: bold 18px 'Lucida Console', Monaco, monospace;\n", 1],
	["\tfont-size: 13px;\n\tfont-size: 1.08333em;\n", "\tfont-size: 1.08333em;\n", 2],
	["\tbackground: #fff;\n\tbackground: rgba(255, 255, 255, 0.8);\n", "\tbackground: rgba(255, 255, 255, 0.8);\n", 1],
	["\tdisplay: inline !important;\n\tvertical-align: baseline !important;\n", "\tdisplay: inline;\n\tvertical-align: baseline;\n", 1],
	["\tmargin: 17px 0;\n\tmargin: 1.3em 0;\n", "\tmargin: 1.3em 0;\n", 1],
];

/**
 * What the directory's CSS check would flag, as `line N: …` on the line it names: `!important`, and a
 * declaration a later one in the same rule overrides (custom properties aside, as the check leaves
 * them). Comments are blanked first, keeping their newlines, so the line numbers are the file's.
 */
function cssProblems(css: string): string[] {
	const text = css.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, " "));
	const lineAt = (offset: number) => text.slice(0, offset).split("\n").length;
	const problems: string[] = [];
	for (const rule of text.matchAll(/\{([^{}]*)\}/g)) {
		const latest = new Map<string, number>();
		let offset = (rule.index ?? 0) + 1;
		for (const declaration of rule[1].split(";")) {
			const line = lineAt(offset + Math.max(0, declaration.search(/\S/)));
			const property = /^\s*([-a-z]+)\s*:/i.exec(declaration)?.[1].toLowerCase();
			if (property && !property.startsWith("--")) {
				const earlier = latest.get(property);
				if (earlier !== undefined) problems.push(`line ${earlier}: ${property}, set again later in the rule`);
				latest.set(property, line);
			}
			if (/!\s*important/i.test(declaration)) problems.push(`line ${line}: !important`);
			offset += declaration.length + 1;
		}
	}
	return problems;
}

describe("styles.css", () => {
	const styles = readFileSync("styles.css", "utf8");

	it("carries the installed Leaflet's stylesheet, with only the listed edits", () => {
		const leaflet = readFileSync("node_modules/leaflet/dist/leaflet.css", "utf8").replace(/\r\n/g, "\n");
		const copy = EDITS.reduce((css, [from, to, times]) => {
			const parts = css.split(from);
			assert.equal(parts.length - 1, times, `leaflet.css should hold ${times}× ${JSON.stringify(from)}`);
			return parts.join(to);
		}, leaflet);
		assert.ok(styles.includes(copy), "copy node_modules/leaflet/dist/leaflet.css (LF endings), with EDITS applied, to the top of styles.css");
	});

	it("has nothing the directory's CSS check flags: no !important, no property twice in a rule", () => {
		assert.deepEqual(cssProblems(styles), []);
	});
});
