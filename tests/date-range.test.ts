import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { checkRange, EARLIEST, historyFloor, historyNote, outcomeMeta, outcomeTitle, spanText } from "../src/ui/date-range";
import { scanOf } from "./support/account-fixture";

const format = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });
const dayText = (date: string) => format.format(new Date(`${date}T12:00:00`));
const TODAY = "2026-10-21";
const START = "2019-03-02";
const check = (from: string, to: string, start: string | null = START) => checkRange(from, to, TODAY, start ?? undefined, dayText);

describe("Sync a date range: which days it syncs", () => {
	it("syncs the days picked", () => {
		assert.deepEqual(check("2026-10-10", TODAY), { ok: true, from: "2026-10-10", to: TODAY, atStart: false });
	});

	it("starts at the history's first day at the earliest, and says so", () => {
		assert.deepEqual(check("2018-01-01", "2019-03-31"), { ok: true, from: START, to: "2019-03-31", atStart: true });
		assert.deepEqual(check(START, "2019-03-31"), { ok: true, from: START, to: "2019-03-31", atStart: true });
		// Without a scan, only Garmin Connect's own start holds, and there's nothing to say.
		assert.deepEqual(check("2005-01-01", "2010-03-31", null), { ok: true, from: EARLIEST, to: "2010-03-31", atStart: false });
	});

	it("ends today at the latest", () => {
		assert.deepEqual(check("2026-10-10", "2026-12-31"), { ok: true, from: "2026-10-10", to: TODAY, atStart: false });
	});

	it("says why it can't, and which date to fix", () => {
		assert.deepEqual(check(TODAY, "2026-10-10"), { ok: false, message: "The end date is before the start.", field: "to" });
		assert.deepEqual(check("2026-11-01", "2026-11-05"), { ok: false, message: "The start date is after today.", field: "from" });
		assert.deepEqual(check("2018-01-01", "2018-12-31"), { ok: false, message: "Garmin has nothing before Mar 2, 2019.", field: "to" });
		assert.deepEqual(check("2005-01-01", "2005-12-31", null), { ok: false, message: "Garmin has nothing before Jan 1, 2010.", field: "to" });
	});

	it("waits quietly while a field is empty", () => {
		assert.deepEqual(check("", TODAY), { ok: false });
		assert.deepEqual(check("2026-10-10", "2026-02-31x"), { ok: false });
	});
});

describe("Sync a date range: where the history starts", () => {
	it("is the scan's first day or the oldest activity, whichever is older, once a scan reached it", () => {
		const scan = scanOf("2019-03-02", TODAY);
		assert.equal(historyFloor(scan, "2019-06-01"), "2019-03-02");
		assert.equal(historyFloor(scan, "2018-11-20"), "2018-11-20");
		assert.equal(historyFloor({ ...scan, complete: false }, "2018-11-20"), undefined);
		assert.equal(historyFloor(null, "2018-11-20"), undefined);
	});
});

describe("Sync a date range: the outcome card", () => {
	it("says what the button does, with the span, size and time", () => {
		const now = { days: 12, requests: 186, bytes: 540_000, seconds: 30, background: false };
		const later = { days: 731, requests: 9_000, bytes: 120_000_000, seconds: 3 * 3_600, background: true };
		assert.deepEqual([outcomeTitle(now), outcomeMeta(now)], ["Syncs now", "12 days · ≈ 540 KB · under a minute"]);
		assert.deepEqual([outcomeTitle(later), outcomeMeta(later)], ["Downloads in the background", "2 years · ≈ 120 MB · about 3 hours"]);
		assert.equal(historyNote(START, dayText), "Your Garmin history starts Mar 2, 2019.");
	});

	it("counts days for two months, months for two years, then years", () => {
		assert.deepEqual([1, 12, 59, 60, 365, 729, 730, 3_650].map(spanText), ["1 day", "12 days", "59 days", "2 months", "12 months", "24 months", "2 years", "10 years"]);
	});
});
