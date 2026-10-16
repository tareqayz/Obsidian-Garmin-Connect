import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import type { Plugin } from "obsidian";
import type { PersistedAuth } from "../src/garmin/tokens";
import { PluginData } from "../src/plugin-data";
import { DEFAULT_SETTINGS, SETTINGS_VERSION } from "../src/settings-data";

/** A plugin whose data.json is `raw`, recording every save. */
function fakePlugin(raw: unknown) {
	const saved: Record<string, unknown>[] = [];
	const plugin = {
		loadData: async () => raw,
		saveData: async (data: unknown) => {
			saved.push(structuredClone(data) as Record<string, unknown>);
		},
	} as unknown as Plugin;
	return { plugin, saved };
}

/** This device's keychain: the session SecretTokenStore would hold. */
class FakeTokens {
	constructor(public auth: PersistedAuth | null = null) {}
	read(): PersistedAuth | null {
		return this.auth;
	}
	async save(auth: PersistedAuth): Promise<void> {
		this.auth = auth;
	}
}

async function load(raw: unknown, tokens = new FakeTokens()) {
	const { plugin, saved } = fakePlugin(raw);
	const data = new PluginData(plugin, tokens);
	await data.init();
	return { data, saved, tokens };
}

const AUTH = { refreshToken: "refresh", diClientId: "client", savedAt: 1 };

describe("PluginData", () => {
	it("starts from the defaults without writing when there is no file", async () => {
		const { data, saved } = await load(null);
		assert.deepEqual(data.settings, DEFAULT_SETTINGS);
		assert.equal(data.hasSession, false);
		assert.equal(saved.length, 0);
	});

	it("reads a current file without rewriting it", async () => {
		const { data, saved } = await load({ settings: { ...DEFAULT_SETTINGS, stopAfterEmptyDays: 7 }, home: { preset: "be-healthy", hidden: [] } }, new FakeTokens(AUTH));
		assert.equal(data.settings.stopAfterEmptyDays, 7);
		assert.equal(data.hasSession, true);
		assert.equal(saved.length, 0);
	});

	it("moves the session an older build kept in data.json to this device's keychain, and saves without it", async () => {
		const { data, saved, tokens } = await load({ settings: { ...DEFAULT_SETTINGS }, auth: { ...AUTH, extra: "dropped" }, home: { preset: "be-healthy", hidden: [] } });
		assert.deepEqual(tokens.auth, AUTH);
		assert.equal(data.hasSession, true);
		assert.equal(saved.length, 1);
		assert.deepEqual(Object.keys(saved[0]!).sort(), ["home", "settings"]);
	});

	it("keeps this device's own session over one data.json still carries", async () => {
		const mine = { refreshToken: "mine", diClientId: "client", savedAt: 2 };
		const { saved, tokens } = await load({ settings: { ...DEFAULT_SETTINGS }, auth: AUTH }, new FakeTokens(mine));
		assert.deepEqual(tokens.auth, mine);
		assert.equal("auth" in saved[0]!, false);
	});

	it("never writes a session into data.json", async () => {
		const { data, saved } = await load({ settings: { ...DEFAULT_SETTINGS } }, new FakeTokens(AUTH));
		await data.saveSettings();
		await data.saveHome({ preset: "be-healthy", hidden: [] });
		assert.equal(JSON.stringify(saved).includes("refresh"), false);
	});

	it("carries nothing it does not read into the next save", async () => {
		const { data, saved } = await load({
			settings: { ...DEFAULT_SETTINGS, password: "hunter2", fromALaterBuild: true },
			auth: AUTH,
			somethingElse: { password: "hunter2" },
		});
		await data.saveSettings();
		const last = saved.at(-1)!;
		assert.deepEqual(Object.keys(last.settings as object).sort(), Object.keys(DEFAULT_SETTINGS).sort());
		assert.equal(JSON.stringify(saved).includes("hunter2"), false);
		assert.equal("somethingElse" in last, false);
	});

	it("drops the retired classic dashboard's layouts on the next save", async () => {
		const { data, saved } = await load({ settings: { ...DEFAULT_SETTINGS }, layouts: { version: 1, active: "default", layouts: [] } });
		assert.equal(saved.length, 0);
		await data.saveHome({ preset: "be-healthy", hidden: [] });
		assert.deepEqual(Object.keys(saved[0]!).sort(), ["home", "settings"]);
	});

	it("keeps map tiles on unless they were turned off, and only for a real boolean", async () => {
		assert.equal((await load({ settings: { ...DEFAULT_SETTINGS } })).data.settings.mapTiles, true);
		assert.equal((await load({ settings: { ...DEFAULT_SETTINGS, mapTiles: false } })).data.settings.mapTiles, false);
		assert.equal((await load({ settings: { ...DEFAULT_SETTINGS, mapTiles: "no" } })).data.settings.mapTiles, true);
		const { data, saved } = await load({ settings: { ...DEFAULT_SETTINGS, mapTiles: false } });
		await data.saveSettings();
		assert.equal((saved[0]!.settings as { mapTiles: boolean }).mapTiles, false);
	});

	it("turns an older build's Download runs into the Activity details range", async () => {
		const v4 = (over: Record<string, unknown>) => ({ settings: { ...DEFAULT_SETTINGS, settingsVersion: 4, ...over } });
		assert.equal((await load(v4({ downloadRuns: true }))).data.settings.data.activityDetails, "all");
		assert.equal((await load(v4({ downloadRuns: false }))).data.settings.data.activityDetails, "opened");
		assert.equal((await load(v4({ downloadRuns: "yes" }))).data.settings.data.activityDetails, "opened");
		const { saved } = await load(v4({ downloadRuns: true }));
		assert.equal("downloadRuns" in (saved[0]!.settings as object), false);
	});

	it("starts a fresh install without a setup, so the wizard runs", async () => {
		const { data } = await load(null);
		assert.equal(data.settings.setup, null);
		assert.deepEqual(data.settings.data, { dayDetails: "90d", activityDetails: "opened", accepted: [], deferred: [] });
		// Each instance has its own ledger.
		data.settings.data.accepted.push("days@1");
		assert.deepEqual((await load(null)).data.settings.data.accepted, []);
	});

	it("takes a vault that was already syncing as set up, its charts accepted and its day details left to ask", async () => {
		const { data, saved } = await load({ settings: { ...DEFAULT_SETTINGS, settingsVersion: 4, downloadRuns: true, groups: ["activity", "sleep", "workouts"] }, auth: AUTH });
		assert.equal(data.settings.setup?.migrated, true);
		assert.ok(!Number.isNaN(Date.parse(data.settings.setup!.completedAt)));
		assert.deepEqual(data.settings.data, {
			dayDetails: "30d",
			activityDetails: "all",
			accepted: ["activities@3", "daily-stats@1", "sleep@1", "index:critical-swim-speed@1", "runs@5"],
			deferred: [],
		});
		assert.equal(saved.length, 1);
		// Without a session there was nothing to set up.
		assert.equal((await load({ settings: { ...DEFAULT_SETTINGS, settingsVersion: 4 } })).data.settings.setup, null);
		// A version 1 file gets the groups switched on first, and their charts accepted.
		const old = await load({ settings: { settingsVersion: 1, groups: ["activity"] }, auth: AUTH });
		assert.ok(old.data.settings.data.accepted.includes("index:respiration@1"));
	});

	it("reads the setup and the ledger by allowlist", async () => {
		const { data } = await load({
			settings: {
				...DEFAULT_SETTINGS,
				setup: { completedAt: "2026-10-14T06:00:00.000Z", migrated: "yes", extra: 1 },
				data: { dayDetails: "forever", runDetails: "1y", accepted: ["days@1", "nope", 3, "days@1"], deferred: "index:stress@1" },
			},
		});
		assert.deepEqual(data.settings.setup, { completedAt: "2026-10-14T06:00:00.000Z" });
		// `runDetails` is read as the Activity details range it became.
		assert.deepEqual(data.settings.data, { dayDetails: "90d", activityDetails: "1y", accepted: ["days@1"], deferred: [] });
		assert.equal((await load({ settings: { ...DEFAULT_SETTINGS, setup: { completedAt: "soon" } } })).data.settings.setup, null);
	});

	it("takes another device's choices, and nothing else, when data.json changes underneath", async () => {
		let raw: Record<string, unknown> = { settings: { ...DEFAULT_SETTINGS, stopAfterEmptyDays: 7 }, auth: AUTH };
		const plugin = { loadData: async () => raw, saveData: async () => undefined } as unknown as Plugin;
		const data = new PluginData(plugin, new FakeTokens());
		await data.init();
		raw = { settings: { ...DEFAULT_SETTINGS, stopAfterEmptyDays: 30, setup: { completedAt: "2026-10-14T06:00:00.000Z" }, data: { dayDetails: "1y", runDetails: "all", accepted: ["days@1"], deferred: [] } }, auth: null };
		await data.reloadChoices();
		assert.equal(data.settings.setup?.completedAt, "2026-10-14T06:00:00.000Z");
		assert.deepEqual(data.settings.data.accepted, ["days@1"]);
		assert.equal(data.settings.stopAfterEmptyDays, 7);
		assert.equal(data.hasSession, true);
	});

	it("keeps values a slider can show", async () => {
		const { data } = await load({ settings: { ...DEFAULT_SETTINGS, stopAfterEmptyDays: 999, syncSpeed: "ludicrous", units: "furlongs", domain: "example.com" } });
		assert.equal(data.settings.stopAfterEmptyDays, 365);
		assert.equal(data.settings.syncSpeed, "normal");
		assert.equal(data.settings.units, DEFAULT_SETTINGS.units);
		assert.equal(data.settings.domain, "garmin.com");
	});

	it("reads an older build's pause between days as the nearest sync speed", async () => {
		const speedFor = async (pauseBetweenDays: unknown) => {
			const { syncSpeed: _, ...rest } = DEFAULT_SETTINGS;
			const { data } = await load({ settings: { ...rest, pauseBetweenDays } });
			return data.settings.syncSpeed;
		};
		assert.equal(await speedFor(250), "normal");
		assert.equal(await speedFor(0), "fast");
		assert.equal(await speedFor(2000), "gentle");
		assert.equal(await speedFor(undefined), "normal");
	});

	it("drops the Days to sync setting a build before smart sync saved", async () => {
		const { data } = await load({ settings: { ...DEFAULT_SETTINGS, syncDays: 7 } });
		assert.equal("syncDays" in data.settings, false);
	});

	it("migrates a version 1 file, switching on the groups added since but not one turned off", async () => {
		const { data, saved } = await load({ settings: { settingsVersion: 1, groups: ["activity", "sleep", "races"] } });
		assert.equal(data.settings.settingsVersion, SETTINGS_VERSION);
		assert.deepEqual(data.settings.groups, ["activity", "sleep", "races", "respiration", "spo2", "body", "training", "intraday", "health", "profile"]);
		assert.equal(saved.length, 1);
		assert.equal((saved[0]!.settings as { settingsVersion: number }).settingsVersion, SETTINGS_VERSION);
	});

	it("leaves an empty group list empty through a migration", async () => {
		const { data } = await load({ settings: { settingsVersion: 3, groups: [] } });
		assert.deepEqual(data.settings.groups, []);
	});

	it("replaces a file in an unknown shape with defaults, keeping none of its keys", async () => {
		const { data, saved } = await load({ email: "me@example.com", password: "hunter2", syncDays: 9 });
		assert.deepEqual(data.settings, DEFAULT_SETTINGS);
		assert.equal(saved.length, 1);
		assert.equal(JSON.stringify(saved[0]).includes("hunter2"), false);
		assert.equal("password" in saved[0]!, false);
	});

	it("treats an auth entry without a refresh token as no session", async () => {
		const { data, tokens } = await load({ settings: { ...DEFAULT_SETTINGS }, auth: { diClientId: "client", savedAt: 1 } });
		assert.equal(data.hasSession, false);
		assert.equal(tokens.auth, null);
	});
});
