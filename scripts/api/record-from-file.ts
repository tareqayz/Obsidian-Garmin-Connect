/**
 * Records `api/schema/<id>.json` from responses captured through the plugin's
 * own client (`scripts/dev/live-api.sh`). It is `npm run api:record` without a
 * token: types only, never values, folded into the existing union the same way.
 *
 *   npm run api:record-file -- <endpoint-id> <response.json> [more.json…]
 *        [--unwrap <dot.path>] [--rerecord]
 *
 * Each file holds one response body. `--unwrap` records the value at a path
 * instead, for GraphQL entries whose probe records the unwrapped object
 * (`--unwrap healthStatusSummary`).
 */
import { readFileSync } from "node:fs";
import { loadCatalogue, readSchema, schemaPath, writeSchema } from "./catalogue";
import { inferAll, isEmptyPayload, merge } from "./schema";

const args = process.argv.slice(2);

function option(name: string): string | undefined {
	const index = args.indexOf(`--${name}`);
	if (index < 0) return undefined;
	const [value] = args.splice(index, 2).slice(1);
	return value;
}

const rerecord = args.includes("--rerecord");
const unwrap = option("unwrap");
const [id, ...files] = args.filter((a) => !a.startsWith("--"));
if (!id || files.length === 0) {
	console.error("usage: npm run api:record-file -- <endpoint-id> <response.json>… [--unwrap a.b] [--rerecord]");
	process.exit(2);
}

const entry = loadCatalogue().endpoints.find((e) => e.id === id);
if (!entry) {
	console.error(`no catalogue entry "${id}" in api/endpoints.json`);
	process.exit(2);
}

const at = (value: unknown, path: string | undefined): unknown =>
	path
		? path.split(".").reduce<unknown>((v, key) => (v && typeof v === "object" ? (v as Record<string, unknown>)[key] : undefined), value)
		: value;

const samples = files
	.map((file) => at(JSON.parse(readFileSync(file, "utf8")), unwrap))
	.filter((sample) => sample !== undefined && !isEmptyPayload(sample));
if (samples.length === 0) {
	console.error("every sample is empty; nothing recorded");
	process.exit(1);
}

const previous = rerecord ? null : readSchema(entry);
const shape = inferAll(samples);
const now = new Date().toISOString();
writeSchema(entry, {
	endpoint: entry.id,
	path: entry.path,
	...(entry.plugin ? { plugin: entry.plugin } : {}),
	firstRecorded: previous?.firstRecorded ?? now,
	updatedAt: now,
	samples: (previous?.samples ?? 0) + samples.length,
	shape: previous ? merge(previous.shape, shape) : shape,
});
console.log(`recorded ${entry.id}: ${samples.length} sample(s) → ${schemaPath(entry)}`);
