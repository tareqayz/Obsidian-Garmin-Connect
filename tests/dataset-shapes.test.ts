import { strict as assert } from "node:assert";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { describe, it } from "node:test";
import { ACTIVITY_BLOCKS } from "../src/sync/activity-detail";
import { INDEX_VERSION as ACTIVITY_INDEX_VERSION } from "../src/sync/activity-index";
import { DAILY_STATS_VERSION } from "../src/sync/daily-stats";
import { DAY_DETAILS_VERSION, RUN_DETAILS_VERSION } from "../src/sync/datasets";
import { DAY_INDEXES } from "../src/sync/day-indexes";
import { DAYS_VERSION } from "../src/sync/days";
import { SERIES_VERSION } from "../src/sync/intraday";
import { INTRADAY_EXTRAS } from "../src/sync/intraday-extras";
import { keptKeys, SERIES_KEYS } from "../src/sync/intraday-registry";
import { ALL_GROUPS, endpointsFor } from "../src/sync/metrics";
import { SLEEP_INDEX_VERSION } from "../src/sync/sleep-index";

/**
 * A guard on the data-set versions (`src/sync/datasets.ts`): what each store
 * keeps, snapshotted beside its version. A release that stores something new
 * for days the vault already holds has to bump the version, so the update
 * dialog offers those days again; this fails when the shape moved and the
 * version did not.
 *
 * After a bump: `UPDATE_SHAPES=1 npm test` writes the new snapshot.
 */

const FIXTURE = "tests/fixtures/dataset-shapes.json";

interface Entry {
	version: number;
	shape: unknown;
}

function current(): Record<string, Entry> {
	const endpoints = Object.entries(endpointsFor(ALL_GROUPS))
		.filter(([, on]) => on)
		.map(([name]) => name)
		.sort();
	const out: Record<string, Entry> = {
		days: {
			version: DAY_DETAILS_VERSION,
			shape: { endpoints, seriesKeys: [...SERIES_KEYS].sort(), kept: keptKeys(INTRADAY_EXTRAS).sort(), daysFile: DAYS_VERSION, seriesFile: SERIES_VERSION },
		},
		runs: { version: RUN_DETAILS_VERSION, shape: { blocks: [...ACTIVITY_BLOCKS] } },
		activities: { version: ACTIVITY_INDEX_VERSION, shape: null },
		"daily-stats": { version: DAILY_STATS_VERSION, shape: null },
		sleep: { version: SLEEP_INDEX_VERSION, shape: null },
	};
	for (const def of DAY_INDEXES) out[`index:${def.kind}`] = { version: def.version, shape: { listKey: def.listKey, columns: [...def.keys] } };
	return out;
}

describe("data-set versions", () => {
	it("bump whenever what a store keeps changes", () => {
		const now = current();
		if (process.env.UPDATE_SHAPES) {
			mkdirSync("tests/fixtures", { recursive: true });
			writeFileSync(FIXTURE, `${JSON.stringify(now, null, "\t")}\n`);
			return;
		}
		assert.ok(existsSync(FIXTURE), `${FIXTURE} is missing: run UPDATE_SHAPES=1 npm test`);
		const held = JSON.parse(readFileSync(FIXTURE, "utf8")) as Record<string, Entry>;
		for (const [store, entry] of Object.entries(now)) {
			const was = held[store];
			assert.ok(was, `${store} is new: run UPDATE_SHAPES=1 npm test to add it`);
			if (was.version === entry.version) {
				assert.deepEqual(
					entry.shape,
					was.shape,
					`${store} keeps something new at version ${entry.version}: bump its version (src/sync/datasets.ts, or the index's own) and add a changes line, then run UPDATE_SHAPES=1 npm test`,
				);
			} else {
				assert.ok(entry.version > was.version, `${store} went back from version ${was.version} to ${entry.version}`);
				assert.fail(`${store} is at version ${entry.version} now: run UPDATE_SHAPES=1 npm test to record it`);
			}
		}
	});
});
