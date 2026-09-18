/**
 * Reading `api/endpoints.json` and the response shapes recorded beside it.
 *
 * The catalogue is the plugin's written-down understanding of Garmin's API:
 * which paths exist, which of them this plugin calls, and which response fields
 * it would miss if they went away.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import type { Shape } from "./schema";

/**
 * Found by walking up from the working directory rather than from this file:
 * these modules are bundled to a single `.mjs` before they run, so the path
 * they were written at says nothing about where they end up.
 */
function findRoot(from = process.cwd()): string {
	let dir = resolve(from);
	for (let i = 0; i < 6; i++) {
		if (existsSync(join(dir, "api", "endpoints.json"))) return dir;
		const parent = dirname(dir);
		if (parent === dir) break;
		dir = parent;
	}
	throw new Error(`could not find api/endpoints.json above ${from}`);
}

export const ROOT = findRoot();
export const API_DIR = join(ROOT, "api");

export interface CatalogueEntry {
	id: string;
	method: string;
	path: string;
	service: string;
	/** The method in `src/garmin/endpoints.ts` that calls it, if any. */
	plugin?: string;
	/** Covered by the daily contract check. */
	check?: boolean;
	/** Response paths the plugin reads; `[]` descends into array items. */
	critical?: string[];
	/** Recorded shape, relative to `api/`. */
	schema?: string;
	notes?: string;
	status?: string;
}

export interface Catalogue {
	generated: { at: string; source: Record<string, unknown> };
	endpoints: CatalogueEntry[];
}

export interface RecordedSchema {
	endpoint: string;
	path: string;
	plugin?: string;
	firstRecorded: string;
	updatedAt: string;
	/** Cumulative — how many responses have gone into this union. */
	samples: number;
	shape: Shape;
}

export function loadCatalogue(dir = API_DIR): Catalogue {
	return JSON.parse(readFileSync(join(dir, "endpoints.json"), "utf8")) as Catalogue;
}

export function checkedEndpoints(catalogue: Catalogue): CatalogueEntry[] {
	return catalogue.endpoints.filter((entry) => entry.check === true);
}

export function schemaPath(entry: CatalogueEntry, dir = API_DIR): string {
	return join(dir, entry.schema ?? `schema/${entry.id}.json`);
}

/** Null when nothing has been recorded yet — the first run of a new endpoint. */
export function readSchema(entry: CatalogueEntry, dir = API_DIR): RecordedSchema | null {
	try {
		return JSON.parse(readFileSync(schemaPath(entry, dir), "utf8")) as RecordedSchema;
	} catch {
		return null;
	}
}

export function writeSchema(entry: CatalogueEntry, doc: RecordedSchema, dir = API_DIR): void {
	const file = schemaPath(entry, dir);
	mkdirSync(dirname(file), { recursive: true });
	writeFileSync(file, `${JSON.stringify(doc, null, "\t")}\n`);
}
