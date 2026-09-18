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

import { FetchHttpClient } from "../../src/fetch-http";
import { GarminApi } from "../../src/garmin/endpoints";
import { GarminRateLimitError } from "../../src/garmin/errors";
import { DI_CLIENT_IDS } from "../../src/garmin/constants";
import type { PersistedAuth, TokenStore } from "../../src/garmin/tokens";
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
import { changed, check, failed, report, type Result } from "./verdict";

/* ------------------------------------------------------------------ */
/*  Auth                                                               */
/* ------------------------------------------------------------------ */

/**
 * Keeps the session in the environment rather than on disk, and holds whatever
 * Garmin hands back so a rotated token can be persisted by the caller.
 */
class EnvTokenStore implements TokenStore {
	current: PersistedAuth | null;
	rotated = false;

	constructor(initial: PersistedAuth | null) {
		this.current = initial;
	}

	async load(): Promise<PersistedAuth | null> {
		return this.current;
	}

	async save(auth: PersistedAuth): Promise<void> {
		if (this.current && this.current.refreshToken !== auth.refreshToken) this.rotated = true;
		this.current = auth;
	}

	async clear(): Promise<void> {
		this.current = null;
	}
}

function authFromEnv(): PersistedAuth | null {
	const blob = process.env.GARMIN_TOKENS?.trim();
	if (blob) {
		const parsed = JSON.parse(blob) as Partial<PersistedAuth>;
		if (!parsed.refreshToken) throw new Error("GARMIN_TOKENS has no refreshToken");
		return {
			refreshToken: parsed.refreshToken,
			diClientId: parsed.diClientId ?? DI_CLIENT_IDS[0],
			savedAt: parsed.savedAt ?? Date.now(),
		};
	}
	const refreshToken = process.env.GARMIN_REFRESH_TOKEN?.trim();
	if (!refreshToken) return null;
	return {
		refreshToken,
		diClientId: process.env.GARMIN_DI_CLIENT_ID?.trim() || DI_CLIENT_IDS[0],
		savedAt: Date.now(),
	};
}

async function connect(store: EnvTokenStore): Promise<GarminApi> {
	const api = new GarminApi({ http: new FetchHttpClient(), store });
	if (await api.restore()) {
		// Fail on a dead session here rather than halfway through the sweep,
		// where it would look like an endpoint had broken.
		await api.refreshNow();
		return api;
	}
	const email = process.env.GARMIN_EMAIL?.trim();
	const password = process.env.GARMIN_PASSWORD;
	if (!email || !password) {
		throw new Error(
			"no Garmin session: set GARMIN_TOKENS (or GARMIN_REFRESH_TOKEN), or " +
				"GARMIN_EMAIL and GARMIN_PASSWORD. `npm run api:token` mints one. See api/README.md.",
		);
	}
	await api.login(email, password);
	return api;
}

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

/**
 * Written, never printed: this is the credential that keeps CI signing in, and
 * Garmin may replace it at any point during a run.
 */
function saveSession(store: EnvTokenStore): void {
	const out = option("save-token") ?? process.env.GARMIN_TOKEN_OUT;
	if (!out || !store.current) return;
	writeFileSync(out, `${JSON.stringify(store.current, null, "\t")}\n`, { mode: 0o600 });
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
	saveSession(store);

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

	saveSession(store);

	return failed(results) || (flag("strict") && changed(results)) ? 1 : 0;
}

main().then(
	(code) => process.exit(code),
	(err: unknown) => {
		console.error(`\n✗ ${err instanceof Error ? err.message : String(err)}`);
		process.exit(2);
	},
);
