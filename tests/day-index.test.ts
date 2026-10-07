import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
	MAX_WINDOW_DAYS,
	RESERVED_INDEX_NAMES,
	dedupeByDate,
	defineDayIndex,
	extendSpan,
	rowsByYear,
	type DayIndexDef,
	type DayIndexSpec,
} from "../src/sync/day-index";
import { DAY_INDEXES, dayIndex } from "../src/sync/day-indexes";

interface TestRow {
	date: string;
	avg?: number;
	resp?: number;
	change?: number;
	status?: string;
}

const SPEC: DayIndexSpec<TestRow> = {
	kind: "test-stat",
	title: "test",
	folder: "test-stat",
	version: 2,
	columns: { avg: {}, resp: { precision: 2 }, change: { signed: true }, status: { text: true } },
	keepOld: false,
	group: "stress",
	windowDays: 28,
	emptyWindowsToStop: 2,
	fetchWindow: async () => [],
};

const DEF = defineDayIndex(SPEC);
const KEEP = defineDayIndex({ ...SPEC, kind: "keep-stat", folder: "keep-stat", keepOld: true, listKey: "nights" });

// A typed definition sits in the registry's list as it is.
const _registry: readonly DayIndexDef[] = [DEF, KEEP];
void _registry;

describe("defineDayIndex — rows", () => {
	it("keeps each column as its spec says, in the declared order", () => {
		const row = DEF.normalize({ status: "  HIGH ", change: -3.4, resp: 13.456, avg: 29.5, extra: 1, date: "2026-10-04" });
		assert.deepEqual(row, { date: "2026-10-04", avg: 30, resp: 13.46, change: -3, status: "HIGH" });
		assert.deepEqual(Object.keys(row!), ["date", "avg", "resp", "change", "status"]);
		assert.deepEqual(DEF.keys, ["avg", "resp", "change", "status"]);
	});

	it("drops Garmin's sentinels and anything that is not the column's kind", () => {
		assert.deepEqual(DEF.normalize({ date: "2026-10-04", avg: -1, resp: null, change: -2, status: 7 }), { date: "2026-10-04", change: -2 });
		assert.deepEqual(DEF.normalize({ date: "2026-10-04", avg: Number.NaN, resp: "14", status: "  " }), null);
	});

	it("refuses a row without a real date, and a row with nothing in it", () => {
		assert.equal(DEF.normalize({ date: "04/10/2026", avg: 3 }), null);
		assert.equal(DEF.normalize({ avg: 3 }), null);
		assert.equal(DEF.normalize({ date: "2026-10-04" }), null);
		assert.equal(DEF.normalize(null), null);
		assert.equal(DEF.normalize("2026-10-04"), null);
	});
});

describe("defineDayIndex — year files", () => {
	const rows: TestRow[] = [
		{ date: "2026-10-02", avg: 31, status: "LOW" },
		{ date: "2026-10-01", avg: 28, resp: 14.25, change: -4 },
	];

	it("writes one row a line, oldest first, keys in order, nothing that changes between runs", () => {
		const text = DEF.serializeYear("2026", rows);
		assert.equal(
			text,
			'{\n\t"version": 2,\n\t"year": 2026,\n\t"days": [\n' +
				'\t\t{"date":"2026-10-01","avg":28,"resp":14.25,"change":-4},\n' +
				'\t\t{"date":"2026-10-02","avg":31,"status":"LOW"}\n' +
				"\t]\n}\n",
		);
		assert.equal(DEF.serializeYear("2026", [...rows].reverse()), text);
	});

	it("writes an emptied year as an empty list, under the index's own list key", () => {
		assert.equal(DEF.serializeYear("2025", []), '{\n\t"version": 2,\n\t"year": 2025,\n\t"days": []\n}\n');
		assert.match(KEEP.serializeYear("2026", rows), /\n\t"nights": \[\n/);
	});

	it("round-trips", () => {
		assert.deepEqual(DEF.parseYear(DEF.serializeYear("2026", rows)), [rows[1], rows[0]]);
		assert.deepEqual(KEEP.parseYear(KEEP.serializeYear("2026", rows)).length, 2);
	});

	it("drops malformed rows, and reads a malformed file as empty", () => {
		const text = JSON.stringify({ version: 2, year: 2026, days: [{ date: "2026-10-01", avg: 3 }, { date: "nope", avg: 4 }, 7, { date: "2026-10-03", resp: 13.999 }] });
		assert.deepEqual(DEF.parseYear(text), [
			{ date: "2026-10-01", avg: 3 },
			{ date: "2026-10-03", resp: 14 },
		]);
		assert.deepEqual(DEF.parseYear("{not json"), []);
		assert.deepEqual(DEF.parseYear('{"version":2,"nights":[]}'), []);
		assert.deepEqual(DEF.parseYear("null"), []);
	});
});

describe("defineDayIndex — meta file", () => {
	it("round-trips, leaving out what it does not know", () => {
		const text = DEF.serializeMeta({ version: 2, from: "2025-01-01", to: "2026-10-04", complete: true });
		assert.equal(text, '{\n\t"version": 2,\n\t"from": "2025-01-01",\n\t"to": "2026-10-04",\n\t"complete": true\n}\n');
		assert.deepEqual(DEF.parseMeta(text), { version: 2, from: "2025-01-01", to: "2026-10-04", complete: true });
		assert.equal(DEF.serializeMeta({ version: 2, complete: false }), '{\n\t"version": 2,\n\t"complete": false\n}\n');
	});

	it("reads another version, or a malformed file, as no meta: the index is fetched again", () => {
		assert.equal(DEF.parseMeta('{"version":1,"complete":true}'), null);
		assert.equal(DEF.parseMeta("{"), null);
		assert.deepEqual(DEF.parseMeta('{"version":2,"from":"soon","complete":"yes"}'), { version: 2, complete: false });
	});
});

describe("defineDayIndex — merge", () => {
	const held: TestRow[] = [
		{ date: "2026-10-01", avg: 20, status: "LOW" },
		{ date: "2026-10-02", avg: 25, resp: 14 },
		{ date: "2026-10-03", avg: 30 },
	];

	it("replaces every day the batch asked about, and drops one it found empty", () => {
		const merged = DEF.merge(held, { rows: [{ date: "2026-10-02", avg: 26 }], dates: ["2026-10-02", "2026-10-03"] });
		assert.deepEqual(merged, [
			{ date: "2026-10-01", avg: 20, status: "LOW" },
			{ date: "2026-10-02", avg: 26 },
		]);
	});

	it("keeps the fields a new row lacks under keepOld", () => {
		const merged = KEEP.merge(held, { rows: [{ date: "2026-10-01", avg: 21 }], dates: ["2026-10-01"] });
		assert.deepEqual(merged[0], { date: "2026-10-01", avg: 21, status: "LOW" });
	});

	it("adds new days in order and cleans what it is handed", () => {
		const merged = DEF.merge(held, { rows: [{ date: "2026-09-30", avg: 9.6, resp: -1 }, { date: "bad", avg: 1 }], dates: ["2026-09-30"] });
		assert.deepEqual(merged.map((r) => r.date), ["2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03"]);
		assert.deepEqual(merged[0], { date: "2026-09-30", avg: 10 });
	});
});

describe("defineDayIndex — checks", () => {
	const bad = (over: Record<string, unknown>) => () => defineDayIndex({ ...SPEC, ...over } as DayIndexSpec<TestRow>);

	it("refuses a window Garmin would answer 400 for", () => {
		assert.equal(MAX_WINDOW_DAYS, 28);
		assert.throws(bad({ windowDays: 29 }), /windowDays/);
		assert.throws(bad({ windowDays: 0 }), /windowDays/);
		assert.doesNotThrow(bad({ windowDays: 7 }));
	});

	it("refuses names the store already uses, and names that are not names", () => {
		for (const name of RESERVED_INDEX_NAMES) {
			assert.throws(bad({ kind: name }), /taken/);
			assert.throws(bad({ folder: name }), /taken/);
		}
		assert.throws(bad({ kind: "Stress" }), /kind/);
		assert.throws(bad({ folder: "a/b" }), /folder/);
		assert.throws(bad({ title: " " }), /title/);
		assert.throws(bad({ version: 0 }), /version/);
		assert.throws(bad({ listKey: "year" }), /listKey/);
	});

	it("refuses columns that cannot be kept", () => {
		assert.throws(bad({ columns: {} }), /no columns/);
		assert.throws(bad({ columns: { date: {} } }), /cannot be used/);
		assert.throws(bad({ columns: { avg: { text: true, precision: 1 } } }), /text/);
		assert.throws(bad({ columns: { avg: { precision: 7 } } }), /precision/);
		assert.throws(bad({ emptyWindowsToStop: 0 }), /emptyWindowsToStop/);
		assert.throws(bad({ maxHistoryDays: -5 }), /maxHistoryDays/);
	});
});

describe("day index helpers", () => {
	it("joins a fetch onto what it touches, and leaves a stretch with a gap alone", () => {
		assert.deepEqual(extendSpan(null, "2026-09-01", "2026-09-28"), { from: "2026-09-01", to: "2026-09-28" });
		assert.deepEqual(extendSpan({ from: "2026-09-01", to: "2026-09-28" }, "2026-09-29", "2026-10-04"), { from: "2026-09-01", to: "2026-10-04" });
		assert.deepEqual(extendSpan({ from: "2026-09-01", to: "2026-09-28" }, "2026-08-01", "2026-08-31"), { from: "2026-08-01", to: "2026-09-28" });
		assert.deepEqual(extendSpan({ from: "2026-09-01", to: "2026-09-28" }, "2026-10-01", "2026-10-04"), { from: "2026-09-01", to: "2026-09-28" });
	});

	it("files rows by year and keeps one a day", () => {
		const rows = [
			{ date: "2025-12-31", avg: 1 },
			{ date: "2026-01-01", avg: 2 },
			{ date: "2025-12-31", avg: 3 },
		];
		assert.deepEqual([...rowsByYear(rows).keys()], ["2025", "2026"]);
		assert.deepEqual(dedupeByDate(rows), [
			{ date: "2025-12-31", avg: 3 },
			{ date: "2026-01-01", avg: 2 },
		]);
	});
});

describe("DAY_INDEXES", () => {
	it("holds working definitions with names of their own", () => {
		const kinds = new Set<string>();
		const folders = new Set<string>();
		for (const def of DAY_INDEXES) {
			assert.ok(!kinds.has(def.kind), `kind ${def.kind} registered twice`);
			assert.ok(!folders.has(def.folder), `folder ${def.folder} used twice`);
			kinds.add(def.kind);
			folders.add(def.folder);
			assert.ok(def.windowDays >= 1 && def.windowDays <= MAX_WINDOW_DAYS, def.kind);
			assert.equal(dayIndex(def.kind), def);
		}
		assert.equal(dayIndex("nope"), undefined);
	});
});
