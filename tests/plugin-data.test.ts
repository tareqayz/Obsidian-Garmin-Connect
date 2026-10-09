import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import type { Plugin } from "obsidian";
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

async function load(raw: unknown) {
	const { plugin, saved } = fakePlugin(raw);
	const data = new PluginData(plugin);
	await data.init();
	return { data, saved };
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
		const { data, saved } = await load({ settings: { ...DEFAULT_SETTINGS, syncDays: 7 }, auth: AUTH, home: { preset: "be-healthy", hidden: [] } });
		assert.equal(data.settings.syncDays, 7);
		assert.equal(data.hasSession, true);
		assert.deepEqual(await data.load(), AUTH);
		assert.equal(saved.length, 0);
	});

	it("carries nothing it does not read into the next save", async () => {
		const { data, saved } = await load({
			settings: { ...DEFAULT_SETTINGS, password: "hunter2", fromALaterBuild: true },
			auth: AUTH,
			somethingElse: { password: "hunter2" },
		});
		await data.saveSettings();
		assert.equal(saved.length, 1);
		assert.deepEqual(Object.keys(saved[0]!.settings as object).sort(), Object.keys(DEFAULT_SETTINGS).sort());
		assert.equal(JSON.stringify(saved[0]).includes("hunter2"), false);
		assert.equal("somethingElse" in saved[0]!, false);
	});

	it("drops the retired classic dashboard's layouts on the next save", async () => {
		const { data, saved } = await load({ settings: { ...DEFAULT_SETTINGS }, auth: AUTH, layouts: { version: 1, active: "default", layouts: [] } });
		assert.equal(saved.length, 0);
		await data.saveHome({ preset: "be-healthy", hidden: [] });
		assert.deepEqual(Object.keys(saved[0]!).sort(), ["auth", "home", "settings"]);
	});

	it("keeps values a slider can show", async () => {
		const { data } = await load({ settings: { ...DEFAULT_SETTINGS, syncDays: 999, pauseBetweenDays: -5, units: "furlongs", domain: "example.com" } });
		assert.equal(data.settings.syncDays, 30);
		assert.equal(data.settings.pauseBetweenDays, 0);
		assert.equal(data.settings.units, DEFAULT_SETTINGS.units);
		assert.equal(data.settings.domain, "garmin.com");
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
		const { data } = await load({ settings: { ...DEFAULT_SETTINGS }, auth: { diClientId: "client", savedAt: 1 } });
		assert.equal(data.hasSession, false);
		assert.equal(await data.load(), null);
	});
});
