/**
 * Offline guards for `api/endpoints.json`.
 *
 * The daily contract check needs a live account; these do not. They are what
 * runs on every pull request, and they catch the failures that would otherwise
 * only show up as a probe that silently never ran.
 */
import { strict as assert } from "node:assert";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import { GarminApi } from "../src/garmin/endpoints";
import { ALL_GROUPS } from "../src/sync/metrics";
import {
	API_DIR,
	checkedEndpoints,
	loadCatalogue,
	readSchema,
	schemaPath,
	writeSchema,
	type CatalogueEntry,
	type RecordedSchema,
} from "../scripts/api/catalogue";
import { assertProbesMatchCatalogue, PROBES, yearBefore } from "../scripts/api/probes";
import { fieldName, foldKeys, hasPath, type Shape } from "../scripts/api/schema";

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

	// A device id, an activity id or a day written down as a field name is the
	// account's data in a public file. The message names where, never the key.
	it("hold no ids or dates as field names", () => {
		const dir = join(API_DIR, "schema");
		for (const name of readdirSync(dir).filter((file) => file.endsWith(".json"))) {
			const found = new Set<string>();
			const walk = (shape: Shape | undefined, path: string): void => {
				if (!shape) return;
				for (const [key, child] of Object.entries(shape.fields ?? {})) {
					if (fieldName(key) !== key) found.add(path || "(root)");
					walk(child, path ? `${path}.${fieldName(key)}` : fieldName(key));
				}
				walk(shape.items, `${path}[]`);
			};
			walk((JSON.parse(readFileSync(join(dir, name), "utf8")) as RecordedSchema).shape, "");
			assert.deepEqual([...found], [], `${name}: id or date keys under ${[...found].join(", ")}`);
		}
	});
});

describe("recording", () => {
	const entry: CatalogueEntry = {
		id: "training-status-daily",
		method: "GET",
		path: "/metrics-service/metrics/trainingstatus/daily/{date}",
		service: "metrics-service",
		schema: "schema/training-status-daily.json",
	};
	// As the device-keyed maps were recorded before the recorder folded them.
	const old: Shape = {
		type: ["object"],
		fields: { latestTrainingStatusData: { type: ["object"], fields: { "3000000001": { type: ["object"], fields: { trainingStatus: { type: ["number"] } } } } } },
	};
	const doc: RecordedSchema = { endpoint: entry.id, path: entry.path, firstRecorded: "2026-10-01T00:00:00.000Z", updatedAt: "2026-10-01T00:00:00.000Z", samples: 1, shape: old };

	it("writes the placeholder, never the id, and reads an old file back folded", () => {
		const dir = mkdtempSync(join(tmpdir(), "garmin-api-schema-"));
		try {
			writeSchema(entry, doc, dir);
			const text = readFileSync(schemaPath(entry, dir), "utf8");
			assert.ok(text.includes('"<id>"') && !text.includes("3000000001"));
			writeFileSync(schemaPath(entry, dir), JSON.stringify(doc));
			assert.deepEqual(readSchema(entry, dir)?.shape, foldKeys(old));
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
});

describe("probe windows", () => {
	// The weekly weight and blood pressure routes answer 400 to anything but
	// exactly 52 weeks, so a probe a day off would read as a broken endpoint.
	it("span the 52 weeks the weekly ranges insist on", () => {
		assert.equal(yearBefore("2026-10-08"), "2025-10-10");
		assert.equal(yearBefore("2025-12-30"), "2025-01-01");
	});
});
