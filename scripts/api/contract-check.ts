/**
 * Asks Garmin what it is sending today and compares it with what we wrote down.
 *
 *   npm run api:check                 verify; exit 1 if a contract broke
 *   npm run api:record                fold today's answer into api/schema/*.json
 *   npm run api:check -- --rerecord   replace the schemas with today's answer
 *
 * Every request goes through the plugin's own `GarminApi`, so a path, header or
 * parameter that stops working here is one that stops working in the plugin.
 *
 * Credentials come from the environment and are never printed:
 *   GARMIN_TOKENS          {"refreshToken":"…","diClientId":"…"} — preferred
 *   GARMIN_REFRESH_TOKEN   + optional GARMIN_DI_CLIENT_ID
 *   GARMIN_EMAIL/PASSWORD  full sign-in; fails on an MFA challenge
 *
 * Garmin rotates refresh tokens on use. `--save-token <path>` writes the current
 * one back out so CI can return it to its secret; without that, a rotation
 * leaves the next run holding a token Garmin has already retired.
 *
 * Exit codes: 0 clean or only advisory changes, 1 a contract broke, 2 the check
 * could not run at all (no session, rate limited, catalogue inconsistent).
 */

import { writeFileSync } from "node:fs";

import { GarminRateLimitError } from "../../src/garmin/errors";
import {
	checkedEndpoints,
	loadCatalogue,
	readSchema,
	writeSchema,
	type CatalogueEntry,
} from "./catalogue";
import {
	assertProbesMatchCatalogue,
	buildWindow,
	isoDay,
	PAUSE_MS,
	PROBES,
	sleep,
} from "./probes";
import { merge } from "./schema";
import { authFromEnv, connect, EnvTokenStore, saveSession } from "./session";
import { changed, check, failed, report, type Result } from "./verdict";

/* ------------------------------------------------------------------ */
/*  Recording                                                          */
/* ------------------------------------------------------------------ */

/** Fold today's observation into the recorded union, or replace it outright. */
function record(entry: CatalogueEntry, result: Result, rerecord: boolean): void {
	if (!result.shape || result.verdict === "error" || result.verdict === "no-data") return;
	const previous = rerecord ? null : readSchema(entry);
	const now = new Date().toISOString();
	writeSchema(entry, {
		endpoint: entry.id,
		path: entry.path,
		...(entry.plugin ? { plugin: entry.plugin } : {}),
		firstRecorded: previous?.firstRecorded ?? now,
		updatedAt: now,
		samples: (previous?.samples ?? 0) + result.samples,
		shape: previous ? merge(previous.shape, result.shape) : result.shape,
	});
}

/* ------------------------------------------------------------------ */
/*  Entry point                                                        */
/* ------------------------------------------------------------------ */

const flag = (name: string) => process.argv.includes(`--${name}`);

function option(name: string): string | undefined {
	const index = process.argv.indexOf(`--${name}`);
	return index >= 0 ? process.argv[index + 1] : undefined;
}

/** `--days 0` or `--days nonsense` would quietly sample nothing. */
function positive(raw: string | undefined, fallback: number): number {
	const value = Number(raw);
	return Number.isInteger(value) && value > 0 ? value : fallback;
}

async function main(): Promise<number> {
	const rerecord = flag("rerecord");
	const update = flag("update") || rerecord;
	const checked = checkedEndpoints(loadCatalogue());
	assertProbesMatchCatalogue(checked);

	const window = buildWindow(positive(option("days"), 3), positive(option("range"), 14));
	const store = new EnvTokenStore(authFromEnv());
	const api = await connect(store);
	// Before the sweep, not only after it. Signing in can rotate the token on
	// its own, and a rate limit part-way through would otherwise throw away the
	// only copy of the credential the next run needs.
	saveSession(store, option("save-token"));

	const results: Result[] = [];
	for (const entry of checked) {
		try {
			const samples = await PROBES[entry.id]!(api, window);
			results.push(check(entry, samples, readSchema(entry)));
		} catch (err) {
			// A 429 voids the whole run: the endpoints after it would report as
			// broken when all that happened is Garmin stopped answering.
			if (err instanceof GarminRateLimitError) throw err;
			results.push({
				entry,
				verdict: "error",
				samples: 0,
				changes: [],
				critical: [],
				reads: [],
				error: err instanceof Error ? `${err.name}: ${err.message}` : String(err),
			});
		}
		await sleep(PAUSE_MS);
	}

	if (update) for (const result of results) record(result.entry, result, rerecord);

	const text = report(results, window, isoDay(0));
	console.log(text);
	const out = option("report");
	if (out) writeFileSync(out, `${text}\n`);

	saveSession(store, option("save-token"));

	return failed(results) || (flag("strict") && changed(results)) ? 1 : 0;
}

main().then(
	(code) => process.exit(code),
	(err: unknown) => {
		console.error(`\n✗ ${err instanceof Error ? err.message : String(err)}`);
		process.exit(2);
	},
);
