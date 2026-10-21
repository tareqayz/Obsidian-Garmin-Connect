import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { rebuildAt, REBUILD_EVERY_MS } from "../src/dashboard/rebuild-schedule";

describe("when Home redraws while files change", () => {
	it("redraws as soon as the files settle when nothing is writing", () => {
		assert.equal(rebuildAt(1_000, { syncingSince: 0, backfilling: false }), null);
	});

	it("waits for a sync's end, or a full interval after it started on a long one", () => {
		// Last redraw an hour ago; the sync started a second ago: nothing before it ends, or 30 s in.
		assert.equal(rebuildAt(0, { syncingSince: 3_600_000, backfilling: false }), 3_600_000 + REBUILD_EVERY_MS);
		// A long range sync that already redrew once: the next comes an interval later.
		assert.equal(rebuildAt(3_640_000, { syncingSince: 3_600_000, backfilling: false }), 3_640_000 + REBUILD_EVERY_MS);
	});

	it("redraws at most every interval while the history download writes", () => {
		assert.equal(rebuildAt(5_000, { syncingSince: 0, backfilling: true }), 5_000 + REBUILD_EVERY_MS);
	});
});
