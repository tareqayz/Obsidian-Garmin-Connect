import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { debugInfo } from "../src/debug-info";
import { RequestStats } from "../src/garmin/request-stats";
import type GarminPlugin from "../src/main";
import { DEFAULT_SETTINGS, defaultData } from "../src/settings-data";
import { MemoryVault } from "./support/memory-vault";

function plugin(overrides: Record<string, unknown> = {}) {
	const vault = new MemoryVault();
	vault.seed("Garmin/data/days/2025.unreadable-20261016-113005.json", "{");
	vault.seed("Garmin/data/days/2026.json", "{}");
	return {
		app: vault.asApp(),
		manifest: { version: "1.0.0-beta.1" },
		data: { settings: { ...DEFAULT_SETTINGS, data: defaultData(), email: "someone@example.com" } },
		garmin: {
			isAuthenticated: true,
			session: { savedAt: Date.parse("2026-10-16T08:00:00Z"), accessExpiresAt: null },
			stats: new RequestStats(),
			name: "Ana Example",
			profile: { displayName: "ana-example-123" },
		},
		sync: {
			backfillProgress: null,
			lastSync: {
				at: "2026-10-16T08:00:00.000Z",
				from: "2026-10-15",
				to: "2026-10-16",
				report: {
					days: [{ date: "2026-10-15", status: "failed", properties: 0, error: "Garmin's answer for this day couldn't be read: x" }],
					warnings: ["sleep 2026-10-16: /wellness-service/wellness/dailySleepData/ana-example-123: HTTP 500 for someone@example.com at 198.51.100.7, Ana Example"],
					written: 1,
					unchanged: 0,
					skipped: 0,
					failed: 1,
					requests: 30,
				},
			},
		},
		...overrides,
	} as unknown as GarminPlugin;
}

describe("debug info", () => {
	it("says what a bug report needs: versions, settings, session, the last sync and the data folder", async () => {
		const text = await debugInfo(plugin());
		assert.match(text, /- Plugin: 1\.0\.0-beta\.1/);
		assert.doesNotMatch(text, /Sync speed/);
		assert.match(text, /- Pace: 20 requests\/s, 3 days at once\n/);
		assert.doesNotMatch(text, /This hour|an hour/);
		assert.match(text, /- Signed in on this device: yes/);
		assert.match(text, /- Days: 1 written, 0 unchanged, 0 skipped, 1 failed/);
		assert.match(text, /Failed 2026-10-15: Garmin's answer for this day couldn't be read/);
		assert.match(text, /Files set aside: Garmin\/data\/days\/2025\.unreadable-20261016-113005\.json/);
	});

	it("carries no email, name, display name or IP address", async () => {
		const text = await debugInfo(plugin(), { error: new Error("boom for ana-example-123") });
		for (const secret of ["someone@example.com", "Ana Example", "ana-example-123", "198.51.100.7"]) {
			assert.equal(text.includes(secret), false, secret);
		}
		assert.match(text, /\[display name\]/);
		assert.match(text, /Error: boom for \[display name\]/);
	});
});
