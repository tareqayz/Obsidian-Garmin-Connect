import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
	diff,
	hasPath,
	infer,
	inferAll,
	isEmptyPayload,
	merge,
	resolve,
	statusOf,
	type Shape,
} from "../scripts/api/schema";

describe("infer", () => {
	it("reads scalars, nulls and containers", () => {
		assert.deepEqual(infer(3), { type: ["number"] });
		assert.deepEqual(infer(null), { type: ["null"] });
		assert.deepEqual(infer(undefined), { type: ["null"] });
		assert.deepEqual(infer([]), { type: ["array"] });
		assert.deepEqual(infer({}), { type: ["object"], fields: {} });
	});

	it("merges every element of an array into one item shape", () => {
		const shape = infer([{ a: 1 }, { a: null, b: "x" }]);
		assert.deepEqual(shape.items?.fields?.a, { type: ["null", "number"] });
		assert.deepEqual(shape.items?.fields?.b, { type: ["string"], optional: true });
	});

	it("sorts fields so a recorded schema diffs cleanly", () => {
		assert.deepEqual(Object.keys(infer({ b: 1, a: 2, c: 3 }).fields ?? {}), ["a", "b", "c"]);
	});
});

describe("merge", () => {
	it("marks a field missing from a sibling object optional", () => {
		const shape = merge(infer({ a: 1, b: 2 }), infer({ a: 1 }));
		assert.equal(shape.fields?.a.optional, undefined);
		assert.equal(shape.fields?.b.optional, true);
	});

	it("does not optionalise fields because another sample was null", () => {
		// A null response says nothing about which fields the object has. Letting
		// it mark them optional would quietly disarm every removal check.
		const shape = merge(infer({ a: 1, b: 2 }), infer(null));
		assert.deepEqual(shape.type, ["null", "object"]);
		assert.equal(shape.fields?.a.optional, undefined);
		assert.equal(shape.fields?.b.optional, undefined);
	});

	it("keeps an item shape when the other sample was an empty array", () => {
		const shape = merge(infer([{ score: 1 }]), infer([]));
		assert.deepEqual(shape.items?.fields?.score, { type: ["number"] });
	});

	it("unions types in a stable order", () => {
		assert.deepEqual(merge(infer("x"), infer(null)).type, ["null", "string"]);
		assert.deepEqual(merge(infer(null), infer("x")).type, ["null", "string"]);
	});
});

describe("diff", () => {
	const recorded = inferAll([{ steps: 100, hr: null, nested: { deep: 1 } }]);

	it("says nothing when today matches", () => {
		assert.deepEqual(diff(recorded, inferAll([{ steps: 4, hr: 7, nested: { deep: 2 } }])), [
			// hr was recorded as null only, so a number at that position is new.
			{ path: "hr", kind: "type-widened", detail: "was null, now also number" },
		]);
	});

	it("reports a field that was always present and is now gone", () => {
		const changes = diff(recorded, inferAll([{ steps: 1, nested: { deep: 1 } }]));
		assert.deepEqual(changes.map((c) => [c.kind, c.path]), [["field-removed", "hr"]]);
	});

	it("stays quiet about an absent field the recording already calls optional", () => {
		const optional = merge(recorded, inferAll([{ steps: 1, nested: { deep: 1 } }]));
		assert.deepEqual(diff(optional, inferAll([{ steps: 1, nested: { deep: 1 } }])), []);
	});

	it("reports new fields and nested changes with a dotted path", () => {
		const changes = diff(recorded, inferAll([{ steps: 1, hr: null, nested: { deep: 1, extra: 2 } }]));
		assert.deepEqual(changes.map((c) => [c.kind, c.path]), [["field-added", "nested.extra"]]);
	});

	it("calls a container swap what it is", () => {
		const changes = diff(inferAll([{ a: 1 }]), inferAll([[{ a: 1 }]]));
		assert.equal(changes[0]?.kind, "container-changed");
		assert.equal(changes[0]?.path, "");
	});

	it("descends into array items", () => {
		const before = inferAll([[{ score: 1 }]]);
		const after = inferAll([[{ level: "high" }]]);
		assert.deepEqual(diff(before, after).map((c) => [c.kind, c.path]), [
			["field-removed", "[].score"],
			["field-added", "[].level"],
		]);
	});

	it("ignores a type the recording has but today does not", () => {
		// number | null recorded, plain number today: a quiet day, not a change.
		const before = merge(infer({ hr: 1 }), infer({ hr: null }));
		assert.deepEqual(diff(before, infer({ hr: 2 })), []);
	});
});

describe("resolve", () => {
	const readiness = [{ score: 40 }, { score: null }];

	it("walks dotted paths", () => {
		assert.deepEqual(resolve({ a: { b: 1 } }, "a.b"), [1]);
		assert.deepEqual(resolve({ a: {} }, "a.b"), []);
	});

	it("fans out over array items", () => {
		assert.deepEqual(resolve(readiness, "[].score"), [40, null]);
		assert.deepEqual(resolve({ rows: readiness }, "rows[].score"), [40, null]);
	});

	it("tells a present null apart from an absent field", () => {
		assert.deepEqual(resolve({ a: null }, "a"), [null]);
		assert.deepEqual(resolve({}, "a"), []);
	});
});

describe("statusOf", () => {
	it("prefers any non-null sighting across samples", () => {
		assert.equal(statusOf([{ v: null }, { v: 3 }], "v"), "ok");
	});

	it("separates a field that is always null from one that is never there", () => {
		assert.equal(statusOf([{ v: null }, { v: null }], "v"), "null");
		assert.equal(statusOf([{}, {}], "v"), "missing");
	});

	it("reads through array items", () => {
		assert.equal(statusOf([[{ score: null }, { score: 2 }]], "[].score"), "ok");
		assert.equal(statusOf([[{ other: 1 }]], "[].score"), "missing");
	});
});

describe("isEmptyPayload", () => {
	it("treats null, [] and {} as nothing to compare", () => {
		for (const value of [null, undefined, [], {}]) assert.equal(isEmptyPayload(value), true);
		for (const value of [0, "", [1], { a: 1 }]) assert.equal(isEmptyPayload(value), false);
	});
});

describe("hasPath", () => {
	const shape: Shape = inferAll([[{ generic: { vo2MaxValue: 1 } }]]);

	it("finds a path the recording has carried", () => {
		assert.equal(hasPath(shape, "[].generic.vo2MaxValue"), true);
	});

	it("rejects a path nothing has ever sent", () => {
		assert.equal(hasPath(shape, "[].generic.vo2MaxPreciseValue"), false);
		assert.equal(hasPath(shape, "[].cycling.vo2MaxValue"), false);
	});
});
