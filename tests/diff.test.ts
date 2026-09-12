import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { deepEqual, differs } from "../src/sync/diff";

describe("differs", () => {
	it("is false when every incoming value already matches", () => {
		assert.equal(differs({ garmin_steps: 8000, other: 1 }, { garmin_steps: 8000 }), false);
	});

	it("is true when a value changed", () => {
		assert.equal(differs({ garmin_steps: 8000 }, { garmin_steps: 8100 }), true);
	});

	it("is true when the property is new", () => {
		assert.equal(differs({}, { garmin_steps: 8000 }), true);
	});

	it("ignores properties the user owns", () => {
		// A note full of unrelated frontmatter must not look dirty.
		assert.equal(differs({ tags: ["a"], title: "x" }, {}), false);
	});

	it("compares workout lists by value, not identity", () => {
		const existing = { garmin_workouts: [{ name: "Run", minutes: 31 }] };
		assert.equal(differs(existing, { garmin_workouts: [{ name: "Run", minutes: 31 }] }), false);
		assert.equal(differs(existing, { garmin_workouts: [{ name: "Run", minutes: 32 }] }), true);
		assert.equal(
			differs(existing, { garmin_workouts: [{ name: "Run", minutes: 31 }, { name: "Ride" }] }),
			true,
		);
	});

	it("does not treat 0 and null as equal", () => {
		assert.equal(differs({ garmin_steps: null }, { garmin_steps: 0 }), true);
	});

	it("notices a string that became a number", () => {
		assert.equal(differs({ garmin_steps: "8000" }, { garmin_steps: 8000 }), true);
	});
});

describe("deepEqual", () => {
	it("distinguishes an array from an object with numeric keys", () => {
		assert.equal(deepEqual([1, 2], { 0: 1, 1: 2 }), false);
	});

	it("compares nested objects", () => {
		assert.equal(deepEqual({ a: { b: [1, { c: 2 }] } }, { a: { b: [1, { c: 2 }] } }), true);
		assert.equal(deepEqual({ a: { b: [1, { c: 2 }] } }, { a: { b: [1, { c: 3 }] } }), false);
	});

	it("treats objects with different key counts as different", () => {
		assert.equal(deepEqual({ a: 1 }, { a: 1, b: undefined }), false);
	});
});
