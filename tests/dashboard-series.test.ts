import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { duration, shiftDate } from "../src/dashboard/series";

describe("shiftDate", () => {
	it("crosses month and year boundaries", () => {
		assert.equal(shiftDate("2026-03-01", -1), "2026-02-28");
		assert.equal(shiftDate("2026-01-01", -1), "2025-12-31");
		assert.equal(shiftDate("2024-02-28", 1), "2024-02-29");
	});
});

describe("duration", () => {
	it("reads minutes and seconds, and hours once there are any", () => {
		assert.equal(duration(1471), "24:31");
		assert.equal(duration(59.6), "1:00");
		assert.equal(duration(11524), "3:12:04");
	});
});
