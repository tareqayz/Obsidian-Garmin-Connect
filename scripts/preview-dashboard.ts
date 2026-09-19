/**
 * Mounts the real Dashboard component in a plain browser with synthetic data,
 * so the layout can be screenshotted and eyeballed without launching Obsidian.
 *
 *   npm run preview:dashboard
 */
import { mount } from "svelte";
import { DEFAULT_LAYOUTS, type LayoutsState } from "../src/dashboard/layouts";
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

const ACTIVITIES = [
	{ type: "running", name: "Morning Run" },
	{ type: "cycling", name: "Evening Ride" },
	{ type: "lap_swimming", name: "Pool Swim" },
	{ type: "strength_training", name: "Gym" },
	{ type: "walking", name: "Walk" },
];

function workout(date: string, rand: () => number): Record<string, unknown> {
	const kind = ACTIVITIES[Math.floor(rand() * ACTIVITIES.length)]!;
	const minutes = Math.round(28 + rand() * 62);
	const km = Math.round((4 + rand() * 12) * 100) / 100;
	const secondsPerKm = Math.round((minutes * 60) / km);
	return {
		name: kind.name,
		type: kind.type,
		start: `${date}T0${Math.floor(6 + rand() * 3)}:${Math.floor(10 + rand() * 45)}`,
		minutes,
		distance_km: kind.type === "strength_training" ? undefined : km,
		calories: Math.round(240 + rand() * 520),
		avg_hr: Math.round(128 + rand() * 30),
		max_hr: Math.round(158 + rand() * 24),
		elevation_gain_m: Math.round(rand() * 220),
		training_effect: Math.round((2 + rand() * 3) * 10) / 10,
		pace:
			kind.type === "strength_training"
				? undefined
				: `${Math.floor(secondsPerKm / 60)}:${String(secondsPerKm % 60).padStart(2, "0")}`,
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
				// VO2 Max only updates after a qualifying run, so it steps rather
				// than moving daily — the preview should show that honestly.
				vo2max: Math.round((48 + drift * 0.35) * 10) / 10,
				endurance_score: Math.round(7100 + drift * 120 + rand() * 60),
				race_5k: Math.round(1460 - drift * 12 + rand() * 40),
				race_10k: Math.round(3040 - drift * 26 + rand() * 80),
				race_half: Math.round(6720 - drift * 55 + rand() * 160),
				race_marathon: Math.round(14200 - drift * 120 + rand() * 340),

				// Everything below arrives from the same requests as the above —
				// the preview carries it so the new cards can be eyeballed.
				calories_active: Math.round(520 + rand() * 480),
				calories_bmr: 1680,
				floors: Math.round(4 + rand() * 18),
				floors_goal: 10,
				intensity_minutes: Math.round(20 + rand() * 70),
				intensity_moderate: Math.round(10 + rand() * 40),
				intensity_vigorous: Math.round(5 + rand() * 20),
				intensity_goal: 150,
				active_minutes: Math.round(180 + rand() * 120),
				highly_active_minutes: Math.round(20 + rand() * 60),
				sedentary_minutes: Math.round(560 + rand() * 180),
				resting_hr_7d: Math.round(49 + drift * 0.6),
				min_hr: Math.round(42 + rand() * 4),
				max_hr: Math.round(140 + rand() * 40),

				sleep_resting_hr: Math.round(47 + drift + rand() * 4),
				sleep_avg_stress: Math.round(14 + rand() * 12),
				sleep_awake_count: Math.round(rand() * 4),
				sleep_restless_moments: Math.round(6 + rand() * 24),
				sleep_respiration: Math.round((13 + rand() * 3) * 10) / 10,
				sleep_spo2: Math.round(94 + rand() * 4),
				sleep_spo2_low: Math.round(87 + rand() * 5),
				sleep_body_battery_change: Math.round(28 + rand() * 38),

				stress_avg: Math.round(24 + drift + rand() * 18),
				stress_max: Math.round(70 + rand() * 28),
				stress_rest_minutes: Math.round(360 + rand() * 160),
				stress_low_minutes: Math.round(240 + rand() * 140),
				stress_medium_minutes: Math.round(90 + rand() * 90),
				stress_high_minutes: Math.round(10 + rand() * 60),
				body_battery_charged: Math.round(50 + rand() * 40),
				body_battery_drained: Math.round(48 + rand() * 42),
				body_battery_latest: Math.round(20 + rand() * 60),

				hrv_high: Math.round(58 - drift + rand() * 14),
				hrv_weekly_avg: Math.round(46 - drift),
				hrv_baseline_low: Math.round(38 - drift * 0.4),
				hrv_baseline_high: Math.round(58 - drift * 0.4),

				readiness_sleep_score: Math.round(66 + rand() * 28),
				readiness_hrv_factor: Math.round(40 + rand() * 55),
				recovery_time_hours: Math.round(rand() * 38),
				acute_load: Math.round(680 + drift * 20 + rand() * 120),

				respiration_avg: Math.round((14 + rand() * 3) * 10) / 10,
				respiration_min: Math.round((10 + rand() * 2) * 10) / 10,
				respiration_max: Math.round((19 + rand() * 4) * 10) / 10,
				spo2_avg: Math.round(95 + rand() * 3),
				spo2_low: Math.round(89 + rand() * 5),
				spo2_latest: Math.round(95 + rand() * 4),

				fitness_age: Math.round((34 - drift * 0.12) * 10) / 10,
				vo2max_cycling: Math.round((44 + drift * 0.2) * 10) / 10,
				training_load_acute: Math.round(700 + drift * 40 + rand() * 180),
				training_load_chronic: Math.round(760 + drift * 12),
				training_load_ratio: Math.round((0.75 + rand() * 0.8) * 100) / 100,
				training_load_weekly: Math.round(620 + rand() * 260),

				// Weighed a few times a week rather than daily, which is what makes
				// the gaps in this series worth previewing.
				...(rand() < 0.4
					? {
							weight_kg: Math.round((77 - drift * 0.06 + rand() * 0.9) * 10) / 10,
							bmi: Math.round((23.4 - drift * 0.02) * 10) / 10,
							body_fat_pct: Math.round((17.4 + rand()) * 10) / 10,
							body_water_pct: Math.round((55 + rand() * 2) * 10) / 10,
							muscle_mass_kg: Math.round((33 + rand() * 0.6) * 10) / 10,
						}
					: {}),
			},
			text: {
				hrv_status: ["BALANCED", "BALANCED", "UNBALANCED", "LOW"][Math.floor(rand() * 4)]!,
				stress_qualifier: ["BALANCED", "CALM", "STRESSFUL"][Math.floor(rand() * 3)]!,
				training_status: ["PRODUCTIVE_1", "MAINTAINING_1", "RECOVERY_1"][
					Math.floor(rand() * 3)
				]!,
				training_load_status: "OPTIMAL",
				sleep_quality: ["GOOD", "FAIR", "EXCELLENT"][Math.floor(rand() * 3)]!,
			},
			...(rand() < 0.45 ? { workouts: [workout(date, rand)] } : {}),
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
		initialLayouts: DEFAULT_LAYOUTS,
		onLayouts: (next: LayoutsState) => console.log("layouts saved", next.active),
	},
});

(window as unknown as { __ready: boolean }).__ready = true;
