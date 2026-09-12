/**
 * Mounts the real Dashboard component in a plain browser with synthetic data,
 * so the layout can be screenshotted and eyeballed without launching Obsidian.
 *
 *   npm run preview:dashboard
 */
import { mount } from "svelte";
import Dashboard from "../src/ui/svelte/Dashboard.svelte";
import { shiftDate, type DayRow } from "../src/dashboard/series";

const TODAY = "2026-09-12";

/** Deterministic pseudo-random so screenshots are comparable between runs. */
function rng(seed: number) {
	let state = seed;
	return () => {
		state = (state * 1664525 + 1013904223) % 4294967296;
		return state / 4294967296;
	};
}

function build(days: number): DayRow[] {
	const rand = rng(42);
	const rows: DayRow[] = [];
	for (let i = days - 1; i >= 0; i--) {
		const date = shiftDate(TODAY, -i);
		const weekend = [0, 6].includes(new Date(`${date}T12:00:00Z`).getUTCDay());

		// A few days with nothing, as a real watch produces.
		if (rand() < 0.04) continue;

		const deep = 0.9 + rand() * 0.8;
		const rem = 1.1 + rand() * 0.9;
		const light = 3.4 + rand() * 1.4;
		const awake = 0.2 + rand() * 0.4;
		const drift = Math.sin(i / 18) * 3;

		rows.push({
			date,
			values: {
				steps: Math.round((weekend ? 5200 : 9400) + rand() * 5200 - drift * 120),
				steps_goal: 10000,
				distance_km: Math.round((4 + rand() * 5) * 100) / 100,
				calories: Math.round(2200 + rand() * 700),
				resting_hr: Math.round(48 + drift + rand() * 4),
				hrv_avg: Math.round(44 - drift + rand() * 12),
				body_battery_high: Math.round(72 + rand() * 22),
				body_battery_low: Math.round(8 + rand() * 22),
				training_readiness: Math.round(52 - drift * 2 + rand() * 34),
				sleep_hours: Math.round((deep + rem + light + awake) * 100) / 100,
				sleep_deep_hours: Math.round(deep * 100) / 100,
				sleep_rem_hours: Math.round(rem * 100) / 100,
				sleep_light_hours: Math.round(light * 100) / 100,
				sleep_awake_hours: Math.round(awake * 100) / 100,
				sleep_score: Math.round(68 + rand() * 26),
			},
		});
	}
	return rows;
}

mount(Dashboard, {
	target: document.getElementById("app") as HTMLElement,
	props: {
		initialRows: build(400),
		today: TODAY,
		canSync: true,
		// Stands in for a real run so the syncing state can be screenshotted.
		onSync: async () => {
			await new Promise((r) => setTimeout(r, 1200));
			return "3 written, 1 unchanged";
		},
		onBackfill: () => console.log("backfill modal would open"),
	},
});

(window as unknown as { __ready: boolean }).__ready = true;
