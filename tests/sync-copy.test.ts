import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { sizeAndTime, sizeText } from "../src/ui/sync-copy";

describe("sync copy", () => {
	it("puts sizes and times into words", () => {
		assert.equal(sizeText(400), "under 1 KB");
		assert.equal(sizeText(4_200_000), "≈ 4.2 MB");
		assert.equal(sizeAndTime(55_100_000, 3_700), "≈ 55 MB · about 1 hour");
	});

	it("shows no request count anywhere a person reads about syncing", () => {
		const files = [
			"src/settings.ts",
			"src/ui/settings-data-rows.ts",
			"src/ui/svelte/DataUpdate.svelte",
			"src/ui/svelte/settings/DataStatus.svelte",
			"src/ui/svelte/SyncRangeForm.svelte",
			"src/ui/svelte/setup/Setup.svelte",
			"src/ui/svelte/home/BackfillPill.svelte",
			"src/ui/svelte/health/StatPageShell.svelte",
			"src/ui/svelte/sleep/SleepPage.svelte",
			"src/ui/svelte/stats/StatsPage.svelte",
			"src/ui/svelte/activities/CategoryPage.svelte",
			"src/ui/svelte/activities/AllActivitiesPage.svelte",
		];
		for (const file of files) {
			const text = readFileSync(file, "utf8");
			// Words shown on screen: quoted strings and template text, not comments or names.
			const shown = text.match(/(["'`])(?:(?!\1)[^\\\n]|\\.)*\1/g) ?? [];
			for (const literal of shown) assert.doesNotMatch(literal, /\brequests?\b/i, `${file}: ${literal}`);
		}
	});
});
