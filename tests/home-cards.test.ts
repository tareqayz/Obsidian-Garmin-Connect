import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { CURRENT_ONLY, GLANCE_EMPTY_TEXT, glanceEmpty } from "../src/dashboard/glance";
import { dayActivityRows, focusEmpty, homeModel } from "../src/dashboard/home";
import type { DayRow } from "../src/dashboard/series";

const row = (date: string, values: Record<string, number> = {}): DayRow => ({ date, values, text: {} });

describe("Today's Activity rows", () => {
	it("says an activity and a Health Snapshot the way Home's cards do", () => {
		const rows = dayActivityRows([
			{ kind: "activity", name: "Morning Run", distance: "8.42 km", minutes: 46.4, calories: 612, start: "2026-10-28T07:12" },
			{ kind: "snapshot", title: "Health Snapshot - Afternoon", hr: 58, spo2: 97, respiration: 14.2, start: "2026-10-28T15:00" },
		]);
		assert.deepEqual(
			rows.map(({ kicker, icon, color, headline, detail }) => ({ kicker, icon, color, headline, detail })),
			[
				{ kicker: "Morning Run", icon: "activity", color: "var(--color-blue)", headline: "8.42 km · 46 min", detail: "612 kcal" },
				{ kicker: "Health Snapshot - Afternoon", icon: "clipboard-plus", color: "var(--color-red)", headline: "58 bpm Avg HR", detail: "97% Avg SpO₂ • 14 brpm Avg Resp" },
			],
		);
	});

	it("falls back to the name, and to the snapshot's own title, when a figure is missing", () => {
		const [activity, snapshot] = dayActivityRows([
			{ kind: "activity", name: "Yoga" },
			{ kind: "snapshot", title: "Health Snapshot" },
		]);
		assert.equal(activity!.headline, "Yoga");
		assert.equal(activity!.detail, undefined);
		assert.equal(snapshot!.headline, "Health Snapshot");
		assert.equal(snapshot!.detail, "");
	});
});

describe("empty cards", () => {
	const model = homeModel({ date: "2026-10-28", rows: [row("2026-10-28", { steps: 9_000, step_goal: 10_000 })], series: null, account: null });

	it("knows which cards have nothing for the day", () => {
		assert.equal(focusEmpty("steps", model), false);
		assert.equal(focusEmpty("sleep", model), true);
		assert.equal(focusEmpty("activities", model), false);
		assert.equal(glanceEmpty("steps", model), false);
		assert.equal(glanceEmpty("stress", model), true);
		// A prompt card is never empty: its prompt is what it shows.
		assert.equal(glanceEmpty("hydration", model), false);
	});

	it("keeps its own words for the cards whose number isn't a day's", () => {
		for (const id of CURRENT_ONLY) assert.ok(GLANCE_EMPTY_TEXT[id], id);
	});
});
