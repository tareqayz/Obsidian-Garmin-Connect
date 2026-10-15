import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { GarminRateLimitError } from "../src/garmin/errors";
import { chartKeys } from "../src/sync/datasets";
import type { AccountScan } from "../src/sync/scan";
import { afterScan, agreement, back, newDaysOnly, next, startFlow, stepState } from "../src/ui/setup-flow";

const scan = (over: Partial<AccountScan> = {}): AccountScan => ({ scannedAt: "2026-10-14T06:00:00.000Z", days: 432, weeks: [], activities: 341, complete: true, ...over });

describe("setup flow", () => {
	it("starts at the sign-in, or at the scan when signed in already", () => {
		assert.deepEqual(startFlow(false), { step: "signin", scan: "scanning" });
		assert.deepEqual(startFlow(true), { step: "scan", scan: "scanning" });
	});

	it("shows a scan's result, an empty account, or an error to try again from", () => {
		assert.deepEqual(afterScan({ scan: scan() }), { step: "scan", scan: "result" });
		assert.deepEqual(afterScan({ scan: scan({ days: 0, activities: 0 }) }), { step: "scan", scan: "empty" });
		assert.deepEqual(afterScan({ scan: scan(), fatal: new GarminRateLimitError("slow down") }), { step: "scan", scan: "error" });
		assert.deepEqual(afterScan(null), { step: "scan", scan: "error" });
		// Activities without health data is still history.
		assert.deepEqual(afterScan({ scan: scan({ days: 0 }) }), { step: "scan", scan: "result" });
	});

	it("goes forward a step at a time and back without undoing a sign-in", () => {
		const result = afterScan({ scan: scan() });
		const choose = next(result);
		assert.deepEqual(choose, { step: "choose", scan: "result" });
		assert.deepEqual(next(choose), { step: "start", scan: "result" });
		assert.deepEqual(back(next(choose), true), choose);
		assert.deepEqual(back(choose, true), result);
		assert.deepEqual(back(result, true), result);
		assert.deepEqual(back(result, false), { step: "signin", scan: "result" });
	});

	it("draws the steps before as done and the one shown as current", () => {
		const choose = { step: "choose" as const, scan: "result" as const };
		assert.deepEqual(["signin", "scan", "choose", "start"].map((s) => stepState(choose, s as never)), ["done", "done", "current", "todo"]);
	});
});

describe("what the setup agrees to", () => {
	const groups = ["activity", "sleep", "workouts", "intraday"] as const;

	it("starting the download agrees to every chart index and to Day and Run details", () => {
		const keys = agreement(groups);
		assert.deepEqual(keys.accepted, [...chartKeys(groups), "days@1", "runs@5"]);
		assert.deepEqual(keys.deferred, []);
	});

	it("keeping new days only fetches no history, and puts the charts off rather than leaving them to ask", () => {
		const only = newDaysOnly(groups);
		assert.deepEqual(only.choices, { dayDetails: "new", runDetails: "opened" });
		assert.deepEqual(only.accepted, ["days@1", "runs@5"]);
		assert.deepEqual(only.deferred, chartKeys(groups));
	});
});
