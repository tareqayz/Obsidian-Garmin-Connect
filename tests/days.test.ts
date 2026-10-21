import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import type { Properties } from "../src/sync/metrics";
import { DayBuffer, dayRowOf, isDaysFile, parseDays, serializeDays, type DayProperties, type DayYearStore } from "../src/sync/days";

describe("day files", () => {
	it("round-trips a year's days", () => {
		const days: DayProperties = new Map<string, Properties>([
			["2026-10-02", { steps: 9000, hrv_status: "BALANCED" }],
			["2026-10-01", { steps: 8000, workouts: [{ type: "running", distance_km: 5 }] }],
		]);
		const text = serializeDays("2026", days);
		assert.deepEqual(parseDays(text), days);
		// Dates in order, so the same days always make the same text.
		assert.ok(text.indexOf("2026-10-01") < text.indexOf("2026-10-02"));
		assert.equal(serializeDays("2026", parseDays(text)), text);
	});

	it("writes only the year's own days", () => {
		const text = serializeDays("2026", new Map([["2025-12-31", { steps: 1 }], ["2026-01-01", { steps: 2 }]]));
		assert.deepEqual([...parseDays(text).keys()], ["2026-01-01"]);
	});


	it("reads a malformed file as empty and drops malformed days", () => {
		assert.equal(parseDays("not json").size, 0);
		const days = parseDays(JSON.stringify({ days: { "2026-10-01": { steps: 1 }, nope: { steps: 2 }, "2026-10-02": [1] } }));
		assert.deepEqual([...days.keys()], ["2026-10-01"]);
	});

	it("names year files only", () => {
		assert.equal(isDaysFile("2026.json"), true);
		assert.equal(isDaysFile("index.json"), false);
	});

	it("splits a day into numbers, text and lists for Home", () => {
		const row = dayRowOf("2026-10-01", {
			date: "2026-10-01",
			steps: 8000,
			hrv_status: "BALANCED",
			empty: "",
			workouts: [{ type: "running" }, "stray"],
			health_snapshots: [],
		});
		assert.deepEqual(row, {
			date: "2026-10-01",
			values: { steps: 8000 },
			text: { hrv_status: "BALANCED" },
			workouts: [{ type: "running" }],
		});
	});
});

/** Year files in memory, counting reads and writes. */
class MemoryYears implements DayYearStore {
	files = new Map<string, string>();
	writes: string[] = [];
	reads = 0;
	/** What each write was told the file held. */
	held: Array<string | undefined> = [];
	async readYear(year: string): Promise<string | null> {
		this.reads += 1;
		return this.files.get(year) ?? null;
	}
	async writeYear(year: string, body: string, held?: string): Promise<"written" | "unchanged"> {
		this.held.push(held);
		if (this.files.get(year) === body) return "unchanged";
		this.files.set(year, body);
		this.writes.push(year);
		return "written";
	}
}

describe("day buffer", () => {
	it("writes each year file once, however many of its days a run wrote", async () => {
		const years = new MemoryYears();
		const buffer = new DayBuffer(years);
		const dates = ["2026-01-02", "2026-01-01", "2025-12-31", "2025-12-30"];
		for (const date of dates) assert.equal(await buffer.write(date, { steps: 1000 }), "written");
		assert.deepEqual(years.writes, []);
		assert.equal(buffer.pending, 4);
		assert.equal(await buffer.flush(), 2);
		assert.deepEqual(years.writes, ["2025", "2026"]);
		assert.deepEqual([...parseDays(years.files.get("2026")!).keys()], ["2026-01-01", "2026-01-02"]);
		assert.equal(buffer.pending, 0);
	});

	it("merges a day over what it held, keeping keys the new write lacks", async () => {
		const years = new MemoryYears();
		years.files.set("2026", serializeDays("2026", new Map([["2026-10-01", { steps: 8000, vo2max: 50 }]])));
		const buffer = new DayBuffer(years);
		await buffer.write("2026-10-01", { steps: 8100 });
		await buffer.flush();
		assert.deepEqual(parseDays(years.files.get("2026")!).get("2026-10-01"), { steps: 8100, vo2max: 50 });
	});

	it("reads a year once while writing and once more at flush, and hands that text to the write", async () => {
		const years = new MemoryYears();
		const before = serializeDays("2026", new Map([["2026-10-01", { steps: 8000 }]]));
		years.files.set("2026", before);
		const buffer = new DayBuffer(years);
		for (const date of ["2026-10-04", "2026-10-03", "2026-10-02"]) await buffer.write(date, { steps: 1 });
		assert.equal(years.reads, 1);
		await buffer.flush();
		assert.equal(years.reads, 2);
		assert.deepEqual(years.held, [before]);
		assert.equal(parseDays(years.files.get("2026")!).size, 4);
	});

	it("answers unchanged for a day that already holds the values, and then writes nothing", async () => {
		const years = new MemoryYears();
		years.files.set("2026", serializeDays("2026", new Map([["2026-10-01", { steps: 8000, vo2max: 50 }]])));
		const buffer = new DayBuffer(years);
		assert.equal(await buffer.write("2026-10-01", { steps: 8000 }), "unchanged");
		assert.equal(await buffer.flush(), 0);
		assert.deepEqual(years.writes, []);
		// A day written twice in a run answers from the first write.
		assert.equal(await buffer.write("2026-10-02", { steps: 1 }), "written");
		assert.equal(await buffer.write("2026-10-02", { steps: 1 }), "unchanged");
	});

	it("merges over the file as it is at flush, keeping a day another device wrote meanwhile", async () => {
		const years = new MemoryYears();
		years.files.set("2026", serializeDays("2026", new Map([["2026-10-01", { steps: 8000 }]])));
		const buffer = new DayBuffer(years);
		await buffer.write("2026-10-02", { steps: 9000 });
		years.files.set("2026", serializeDays("2026", new Map([["2026-10-01", { steps: 8000 }], ["2026-10-03", { steps: 7000 }]])));
		await buffer.flush();
		assert.deepEqual(parseDays(years.files.get("2026")!), new Map([["2026-10-01", { steps: 8000 }], ["2026-10-02", { steps: 9000 }], ["2026-10-03", { steps: 7000 }]]));
	});
});
