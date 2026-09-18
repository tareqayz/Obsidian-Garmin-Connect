/**
 * Structural shapes for Garmin responses, and the diff between two of them.
 *
 * Garmin ships changes to these payloads without notice and without a version.
 * The only defence is to write down what the API sent, compare the next day's
 * answer against it, and be told when they stop matching.
 *
 * A recorded shape is a **union over time**, not a snapshot. That asymmetry is
 * what keeps the daily check quiet: a field that is merely absent today, or a
 * `number | null` that happens to be a number today, is not news. A field that
 * has vanished, or a type that has never been seen before, is.
 *
 * Pure and dependency-free, so the whole thing is unit-testable without a
 * network or an account.
 */

export type TypeName = "string" | "number" | "boolean" | "null" | "object" | "array";

export interface Shape {
	/** Sorted union of everything ever observed at this position. */
	type: TypeName[];
	/** Set on a field that was absent from at least one object that had siblings. */
	optional?: true;
	/** Present when `type` includes `"object"`. */
	fields?: Record<string, Shape>;
	/** Present when a non-empty array was observed; merged across every element. */
	items?: Shape;
}

/** Guards a pathological payload from blowing up the merge. */
const MAX_ARRAY_ITEMS = 2000;

const TYPE_ORDER: TypeName[] = ["array", "boolean", "null", "number", "object", "string"];

function typeOf(value: unknown): TypeName {
	if (value === null || value === undefined) return "null";
	if (Array.isArray(value)) return "array";
	switch (typeof value) {
		case "string":
			return "string";
		case "number":
			return "number";
		case "boolean":
			return "boolean";
		default:
			return "object";
	}
}

function sortTypes(types: Iterable<TypeName>): TypeName[] {
	const set = new Set(types);
	return TYPE_ORDER.filter((t) => set.has(t));
}

function has(shape: Shape, type: TypeName): boolean {
	return shape.type.includes(type);
}

/** Keys in a stable order, so a recorded schema diffs cleanly in review. */
function sortFields(fields: Record<string, Shape>): Record<string, Shape> {
	const out: Record<string, Shape> = {};
	for (const key of Object.keys(fields).sort()) out[key] = fields[key]!;
	return out;
}

/** The shape of one value. */
export function infer(value: unknown): Shape {
	const type = typeOf(value);
	if (type === "object") {
		const fields: Record<string, Shape> = {};
		for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
			fields[key] = infer(child);
		}
		return { type: [type], fields: sortFields(fields) };
	}
	if (type === "array") {
		const list = value as unknown[];
		let items: Shape | undefined;
		for (const element of list.slice(0, MAX_ARRAY_ITEMS)) {
			const element_ = infer(element);
			items = items ? merge(items, element_) : element_;
		}
		return items ? { type: [type], items } : { type: [type] };
	}
	return { type: [type] };
}

/**
 * Union of two shapes.
 *
 * A field missing from one side only becomes optional when that side was itself
 * an object — a `null` sample says nothing about which fields an object has, so
 * it must not mark every one of them optional.
 */
export function merge(a: Shape, b: Shape): Shape {
	const out: Shape = { type: sortTypes([...a.type, ...b.type]) };
	if (a.optional || b.optional) out.optional = true;

	if (a.fields || b.fields) {
		const fields: Record<string, Shape> = {};
		const keys = new Set([...Object.keys(a.fields ?? {}), ...Object.keys(b.fields ?? {})]);
		for (const key of keys) {
			const left = a.fields?.[key];
			const right = b.fields?.[key];
			if (left && right) fields[key] = merge(left, right);
			else if (left) fields[key] = has(b, "object") ? { ...left, optional: true } : left;
			else fields[key] = has(a, "object") ? { ...right!, optional: true } : right!;
		}
		out.fields = sortFields(fields);
	}

	if (a.items && b.items) out.items = merge(a.items, b.items);
	else if (a.items ?? b.items) out.items = (a.items ?? b.items)!;

	return out;
}

/** The union of a set of samples — normally one endpoint's responses for a few days. */
export function inferAll(samples: readonly unknown[]): Shape {
	let shape: Shape | undefined;
	for (const sample of samples) {
		const next = infer(sample);
		shape = shape ? merge(shape, next) : next;
	}
	return shape ?? { type: [] };
}

/* ------------------------------------------------------------------ */
/*  Diff                                                               */
/* ------------------------------------------------------------------ */

export type ChangeKind =
	/** In today's response, absent from the recorded shape. */
	| "field-added"
	/** Recorded as always present, missing from today's response. */
	| "field-removed"
	/** A type never recorded at this position turned up. */
	| "type-widened"
	/** Object became array, array became scalar, and so on. */
	| "container-changed";

export interface Change {
	/** Dotted path; `[]` descends into array items. Empty string is the root. */
	path: string;
	kind: ChangeKind;
	detail: string;
}

function join(parent: string, child: string): string {
	if (!parent) return child;
	return child === "[]" ? `${parent}[]` : `${parent}.${child}`;
}

/**
 * What changed between the recorded union and today's observation.
 *
 * Deliberately one-directional: types and fields the recording has but today's
 * response does not are only reported when the recording says they are always
 * there. Everything else would fire on any quiet day.
 */
export function diff(recorded: Shape, observed: Shape, path = ""): Change[] {
	const changes: Change[] = [];

	const fresh = observed.type.filter((t) => !recorded.type.includes(t));
	if (fresh.length) {
		const container = fresh.some((t) => t === "object" || t === "array");
		changes.push({
			path,
			kind: container ? "container-changed" : "type-widened",
			detail: `was ${recorded.type.join(" | ") || "unrecorded"}, now also ${fresh.join(" | ")}`,
		});
	}

	// A response that came back null today carries no information about fields.
	if (has(observed, "object") && (recorded.fields || observed.fields)) {
		const before = recorded.fields ?? {};
		const after = observed.fields ?? {};
		for (const key of Object.keys(before).sort()) {
			const left = before[key]!;
			const right = after[key];
			if (right) changes.push(...diff(left, right, join(path, key)));
			else if (!left.optional) {
				changes.push({
					path: join(path, key),
					kind: "field-removed",
					detail: `recorded as always present (${left.type.join(" | ")}), absent today`,
				});
			}
		}
		for (const key of Object.keys(after).sort()) {
			if (!(key in before)) {
				changes.push({
					path: join(path, key),
					kind: "field-added",
					detail: `new field (${after[key]!.type.join(" | ")})`,
				});
			}
		}
	}

	if (recorded.items && observed.items) {
		changes.push(...diff(recorded.items, observed.items, join(path, "[]")));
	}

	return changes;
}

/* ------------------------------------------------------------------ */
/*  Paths                                                              */
/* ------------------------------------------------------------------ */

/**
 * Every value a dotted path resolves to. `[]` fans out over array elements, so
 * `[].generic.vo2MaxPreciseValue` reaches into each day of a range response.
 *
 * Returns an empty list when nothing matches — which is the difference between
 * "the field is missing" and "the field is null" that the check turns on.
 */
export function resolve(root: unknown, path: string): unknown[] {
	let current: unknown[] = [root];
	for (const segment of path.split(".")) {
		const [name, ...descents] = segment.split("[]");
		if (name) current = step(current, name);
		for (let i = 0; i < descents.length; i++) {
			current = current.flatMap((value) => (Array.isArray(value) ? value : []));
		}
	}
	return current;
}

function step(values: readonly unknown[], key: string): unknown[] {
	const out: unknown[] = [];
	for (const value of values) {
		if (value !== null && typeof value === "object" && !Array.isArray(value)) {
			if (key in (value as Record<string, unknown>)) {
				out.push((value as Record<string, unknown>)[key]);
			}
		}
	}
	return out;
}

export type PathStatus = "ok" | "null" | "missing";

/**
 * How a path fared across a set of samples.
 *
 * `null` matters as much as `missing` does: a property that is present but
 * always empty is the signature of reading the right endpoint with the wrong
 * field name, which looks identical to "no data" from inside the plugin.
 */
export function statusOf(samples: readonly unknown[], path: string): PathStatus {
	let seen = false;
	for (const sample of samples) {
		for (const value of resolve(sample, path)) {
			seen = true;
			if (value !== null && value !== undefined) return "ok";
		}
	}
	return seen ? "null" : "missing";
}

/** True when a response carries nothing to compare — a rest day, not a change. */
export function isEmptyPayload(value: unknown): boolean {
	if (value === null || value === undefined) return true;
	if (Array.isArray(value)) return value.length === 0;
	if (typeof value === "object") return Object.keys(value as object).length === 0;
	return false;
}

/**
 * Whether a recorded shape has ever carried a path.
 *
 * Lets the offline tests catch a `critical` entry that names a field Garmin
 * does not send — a plugin reading the wrong key looks exactly like a metric
 * with no data, which is the hardest kind of bug to see from inside a note.
 */
export function hasPath(shape: Shape, path: string): boolean {
	let current: Shape[] = [shape];
	for (const segment of path.split(".")) {
		const [name, ...descents] = segment.split("[]");
		if (name) {
			current = current.flatMap((s) => {
				const field = s.fields?.[name];
				return field ? [field] : [];
			});
		}
		for (let i = 0; i < descents.length; i++) {
			current = current.flatMap((s) => (s.items ? [s.items] : []));
		}
		if (!current.length) return false;
	}
	return true;
}
