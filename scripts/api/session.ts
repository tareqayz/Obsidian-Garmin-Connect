/**
 * The session the API scripts share: credentials from the environment, never
 * printed, and a rotated refresh token written back out on request.
 */

import { writeFileSync } from "node:fs";

import { FetchHttpClient } from "./fetch-http";
import { GarminApi } from "../../src/garmin/endpoints";
import { DI_CLIENT_IDS } from "../../src/garmin/constants";
import type { PersistedAuth, TokenStore } from "../../src/garmin/tokens";

/* ------------------------------------------------------------------ */
/*  Auth                                                               */
/* ------------------------------------------------------------------ */

/**
 * Keeps the session in the environment rather than on disk, and holds whatever
 * Garmin hands back so a rotated token can be persisted by the caller.
 */
export class EnvTokenStore implements TokenStore {
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

export function authFromEnv(): PersistedAuth | null {
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

export async function connect(store: EnvTokenStore): Promise<GarminApi> {
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

/**
 * Written, never printed: this is the credential that keeps CI signing in, and
 * Garmin may replace it at any point during a run.
 */
export function saveSession(store: EnvTokenStore, path?: string): void {
	const out = path ?? process.env.GARMIN_TOKEN_OUT;
	if (!out || !store.current) return;
	writeFileSync(out, `${JSON.stringify(store.current, null, "\t")}\n`, { mode: 0o600 });
}

