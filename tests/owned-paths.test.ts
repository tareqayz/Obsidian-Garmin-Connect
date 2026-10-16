import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { diagnosticsNotes, planDelete, type PathEntry } from "../src/sync/owned-paths";

const file = (path: string, size = 100): PathEntry => ({ name: path.split("/").pop()!, path, size });
const folder = (path: string, children: PathEntry[]): PathEntry => ({ name: path.split("/").pop()!, path, children });

describe("what Delete synced data removes", () => {
	it("trashes a folder of the plugin's whole when everything in it is the plugin's", () => {
		const root = folder("Garmin/data", [
			folder("Garmin/data/days", [file("Garmin/data/days/2025.json", 500), file("Garmin/data/days/2026.json", 900), file("Garmin/data/days/index.json", 50)]),
			folder("Garmin/data/series", [file("Garmin/data/series/2026-10-14.json", 40), file("Garmin/data/series/2026-10-13 2.json", 40)]),
			folder("Garmin/data/activity-details", [file("Garmin/data/activity-details/90000000001.json", 150), file("Garmin/data/activity-details/index.json", 10)]),
			folder("Garmin/data/stress", [file("Garmin/data/stress/2026.json", 20), file("Garmin/data/stress/index.json", 1)]),
			file("Garmin/data/account.json", 5),
			file("Garmin/data/sync-state.json", 1),
			file("Garmin/data/scan 2.json", 1),
		]);
		const plan = planDelete(root, ["stress"]);
		assert.deepEqual(plan.trash, [
			"Garmin/data/days",
			"Garmin/data/series",
			"Garmin/data/activity-details",
			"Garmin/data/stress",
			"Garmin/data/account.json",
			"Garmin/data/sync-state.json",
			"Garmin/data/scan 2.json",
		]);
		assert.deepEqual([plan.files, plan.bytes, plan.emptyAfter], [12, 1718, true]);
	});

	it("keeps anything that isn't the plugin's, and the folders that hold it", () => {
		const root = folder("Health", [
			folder("Health/days", [file("Health/days/2026.json"), file("Health/days/my diary.md")]),
			folder("Health/Projects", [file("Health/Projects/plan.md")]),
			file("Health/Notes.md"),
			file("Health/account.json"),
		]);
		const plan = planDelete(root, []);
		assert.deepEqual(plan.trash, ["Health/days/2026.json", "Health/account.json"]);
		assert.equal(plan.emptyAfter, false);
		assert.equal(plan.files, 2);
	});

	it("leaves an index folder alone until it is registered, and a nested folder always", () => {
		const root = folder("d", [folder("d/stress", [file("d/stress/2026.json")]), folder("d/days", [file("d/days/2026.json"), folder("d/days/old", [])])]);
		const plan = planDelete(root, []);
		assert.deepEqual(plan.trash, ["d/days/2026.json"]);
		assert.equal(plan.emptyAfter, false);
	});

	it("counts other sync services' conflict copies and the files the store set aside as the plugin's", () => {
		const days = folder("d/days", [
			file("d/days/2026.json"),
			file("d/days/2026.sync-conflict-20261016-113005-ABCDEFG.json"),
			file("d/days/2025 (Ana's conflicted copy 2026-10-16).json"),
			file("d/days/2024.unreadable-20261016-113005.json"),
		]);
		const plan = planDelete(folder("d", [days, file("d/backfill.unreadable-20261016-113005.json")]), []);
		assert.deepEqual(plan.trash, ["d/days", "d/backfill.unreadable-20261016-113005.json"]);
		assert.equal(plan.files, 5);
		assert.equal(plan.emptyAfter, true);
	});

	it("has nothing to do without a data folder", () => {
		assert.deepEqual(planDelete(null, []), { trash: [], files: 0, bytes: 0, emptyAfter: true });
		assert.deepEqual(planDelete(file("Garmin/data"), []).trash, []);
	});

	it("finds the diagnostics notes the plugin saved, and no other note", () => {
		const logs = folder("Garmin/diagnostics", [file("Garmin/diagnostics/garmin-probe-2026-10-14T06-00.md"), file("Garmin/diagnostics/notes.md")]);
		assert.deepEqual(diagnosticsNotes(logs).map((e) => e.name), ["garmin-probe-2026-10-14T06-00.md"]);
		assert.deepEqual(diagnosticsNotes(null), []);
	});
});
