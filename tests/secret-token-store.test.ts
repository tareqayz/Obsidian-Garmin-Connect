import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import type { App } from "obsidian";
import { parseSession, SecretTokenStore, SESSION_SECRET } from "../src/garmin/secret-token-store";

/** An app whose keychain is a map, or no keychain at all (an Obsidian before 1.11.4). */
function appWith(secrets: Map<string, string> | null): App {
	const secretStorage = secrets && {
		getSecret: (id: string) => secrets.get(id) ?? null,
		setSecret: (id: string, value: string) => void secrets.set(id, value),
		listSecrets: () => [...secrets.keys()],
	};
	return (secretStorage ? { secretStorage } : {}) as unknown as App;
}

const AUTH = { refreshToken: "refresh-1", diClientId: "GARMIN_CONNECT_MOBILE_ANDROID_DI_2025Q2", savedAt: 5 };

describe("SecretTokenStore", () => {
	it("keeps the session in the keychain under one id, by its three fields", async () => {
		const secrets = new Map<string, string>();
		const store = new SecretTokenStore(appWith(secrets));
		assert.equal(await store.load(), null);
		await store.save({ ...AUTH, extra: "dropped" } as typeof AUTH);
		assert.deepEqual(JSON.parse(secrets.get(SESSION_SECRET)!), AUTH);
		assert.deepEqual(store.read(), AUTH);
	});

	it("clears to an empty secret, which reads as no session", async () => {
		const secrets = new Map([[SESSION_SECRET, JSON.stringify(AUTH)]]);
		const store = new SecretTokenStore(appWith(secrets));
		await store.clear();
		assert.equal(secrets.get(SESSION_SECRET), "");
		assert.equal(await store.load(), null);
	});

	it("remembers that this device held a session, so a session that ends here asks for a sign-in", async () => {
		const local = new Map<string, unknown>();
		const app = Object.assign(appWith(new Map()), {
			loadLocalStorage: (key: string) => local.get(key) ?? null,
			saveLocalStorage: (key: string, value: unknown) => void local.set(key, value),
		});
		const store = new SecretTokenStore(app);
		assert.equal(store.hadSessionHere, false);
		await store.save(AUTH);
		await store.clear();
		assert.equal(store.hadSessionHere, true);
	});

	it("holds the session in memory where Obsidian has no keychain", async () => {
		const store = new SecretTokenStore(appWith(null));
		await store.save(AUTH);
		assert.deepEqual(await store.load(), AUTH);
		await store.clear();
		assert.equal(await store.load(), null);
	});
});

describe("parseSession", () => {
	it("reads only a session with a refresh token and a client id", () => {
		assert.deepEqual(parseSession(JSON.stringify(AUTH)), AUTH);
		assert.deepEqual(parseSession(JSON.stringify({ refreshToken: "r", diClientId: "c" })), { refreshToken: "r", diClientId: "c", savedAt: 0 });
		assert.equal(parseSession(JSON.stringify({ refreshToken: "", diClientId: "c" })), null);
		assert.equal(parseSession(JSON.stringify({ diClientId: "c" })), null);
		assert.equal(parseSession("not json"), null);
		assert.equal(parseSession("null"), null);
	});
});
