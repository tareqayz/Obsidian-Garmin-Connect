/**
 * Offline guards for `api/endpoints.json`.
 *
 * The daily contract check needs a live account; these do not. They are what
 * runs on every pull request, and they catch the failures that would otherwise
 * only show up as a probe that silently never ran.
 */
import { strict as assert } from "node:assert";
import { existsSync } from "node:fs";
import { describe, it } from "node:test";

import { GarminApi } from "../src/garmin/endpoints";
import { ALL_GROUPS } from "../src/sync/metrics";
import {
	checkedEndpoints,
	loadCatalogue,
	readSchema,
	schemaPath,
	type CatalogueEntry,
} from "../scripts/api/catalogue";
import { assertProbesMatchCatalogue, PROBES } from "../scripts/api/probes";
import { hasPath } from "../scripts/api/schema";

const catalogue = loadCatalogue();
const checked = checkedEndpoints(catalogue);

function pluginMethod(entry: CatalogueEntry): string {
	return (entry.plugin ?? "").replace(/^GarminApi\./, "");
}

describe("catalogue", () => {
	it("has endpoints at all", () => {
		assert.ok(catalogue.endpoints.length > 100, `only ${catalogue.endpoints.length} endpoints`);
	});

	it("gives every endpoint a unique id", () => {
		const seen = new Set<string>();
		const duplicates = catalogue.endpoints.filter((e) => !seen.add(e.id)).map((e) => e.id);
		assert.deepEqual(duplicates, []);
	});

	it("names only real metric groups", () => {
		const groups = new Set<string>(ALL_GROUPS);
		for (const entry of catalogue.endpoints) {
			for (const group of (entry as { groups?: string[] }).groups ?? []) {
				assert.ok(groups.has(group), `${entry.id}: unknown metric group "${group}"`);
			}
		}
	});

	it("does not check an endpoint that no longer exists upstream", () => {
		const dead = checked.filter((e) => e.status === "gone-upstream").map((e) => e.id);
		assert.deepEqual(dead, [], "a retired path cannot be probed; drop the check flag");
	});
});

describe("checked endpoints", () => {
	it("match the probe table exactly", () => {
		assert.doesNotThrow(() => assertProbesMatchCatalogue(checked));
		assert.equal(Object.keys(PROBES).length, checked.length);
	});

	it("each name a plugin method that exists", () => {
		for (const entry of checked) {
			const name = pluginMethod(entry);
			assert.ok(name, `${entry.id}: checked but no "plugin" method recorded`);
			assert.equal(
				typeof (GarminApi.prototype as unknown as Record<string, unknown>)[name],
				"function",
				`${entry.id}: GarminApi has no ${name}()`,
			);
		}
	});

	it("each declare where their recorded shape lives", () => {
		for (const entry of checked) {
			assert.match(entry.schema ?? "", /^schema\/[a-z0-9-]+\.json$/, `${entry.id}: bad schema path`);
		}
	});

	it("declare critical paths that parse", () => {
		for (const entry of checked) {
			for (const path of entry.critical ?? []) {
				assert.match(
					path,
					/^(?:[A-Za-z0-9_]+|\[\])(?:\[\])*(?:\.(?:[A-Za-z0-9_]+|\[\])(?:\[\])*)*$/,
					`${entry.id}: unreadable critical path "${path}"`,
				);
			}
		}
	});
});

describe("recorded shapes", () => {
	const recorded = checked.filter((entry) => existsSync(schemaPath(entry)));

	it("belong to the endpoint that points at them", () => {
		for (const entry of recorded) {
			assert.equal(readSchema(entry)?.endpoint, entry.id, `${schemaPath(entry)} is misfiled`);
		}
	});

	// The payoff, once a recording exists: a `critical` path Garmin has never
	// sent means the plugin is reading a key that does not exist, which from
	// inside a note is indistinguishable from the metric having no data.
	it("carry every path the plugin claims to read", () => {
		for (const entry of recorded) {
			const shape = readSchema(entry)!.shape;
			for (const path of entry.critical ?? []) {
				assert.ok(hasPath(shape, path), `${entry.id}: nothing recorded at "${path}"`);
			}
		}
	});
});
