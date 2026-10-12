import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { toggleChip } from "../src/dashboard/stat-controls";

describe("chips", () => {
	it("turn several on and off: Race Predictor's distances", () => {
		const multi = { multi: true };
		assert.deepEqual(toggleChip(["5k", "10k"], "half", multi), ["5k", "10k", "half"]);
		assert.deepEqual(toggleChip(["5k", "10k"], "5k", multi), ["10k"]);
		assert.deepEqual(toggleChip(["10k"], "10k", multi), []);
		// With one required, the last stays on.
		assert.deepEqual(toggleChip(["10k"], "10k", { multi: true, required: true }), ["10k"]);
	});

	it("keep one on at most: Chronic Load, LT's second axis", () => {
		assert.deepEqual(toggleChip([], "chronic"), ["chronic"]);
		assert.deepEqual(toggleChip(["chronic"], "chronic"), []);
		assert.deepEqual(toggleChip(["pace"], "power"), ["power"]);
		assert.deepEqual(toggleChip(["pace"], "pace", { required: true }), ["pace"]);
	});
});
