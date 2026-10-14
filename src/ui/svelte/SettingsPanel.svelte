<script lang="ts">
	import { Notice } from "obsidian";
	import type { GarminDomain } from "../../garmin/constants";
	import type GarminPlugin from "../../main";
	import { ALL_GROUPS, FREE_GROUPS, RANGE_GROUPS, REQUESTS_PER_DAY, REQUESTS_PER_SYNC, type MetricGroup } from "../../sync/metrics";
	import { INTRADAY_DAYS } from "../../sync/engine";
	import { isSyncSpeed, SPEED_LABELS } from "../../sync/speed";
	import { DEFAULT_SETTINGS, type GarminSettings } from "../../settings-data";
	import { obsidianSetting } from "./obsidian-setting";

	let { plugin }: { plugin: GarminPlugin } = $props();

	// The plugin object is stable for the life of this panel, so reading through
	// it once is deliberate rather than a missed reactive dependency.
	// svelte-ignore state_referenced_locally
	const s: GarminSettings = plugin.data.settings;
	const save = () => void plugin.data.saveSettings();

	// Only the values that change what is *shown* need to be reactive. Everything
	// else is written straight through by the control's own onChange, which is
	// why changing a toggle no longer rebuilds the whole pane.
	let groups = $state<MetricGroup[]>([...s.groups]);
	// svelte-ignore state_referenced_locally
	let signedIn = $state(plugin.garmin.session !== null);

	const GROUP_LABELS: Record<MetricGroup, string> = {
		activity: "Activity — steps, distance, calories, floors, intensity and active minutes",
		heart: "Heart rate — resting, seven-day resting, min, max",
		sleep: "Sleep — duration, stages, score, Sleep Coach need, respiration, SpO2, restlessness",
		stress: "Stress and Body Battery — averages, peaks, time in each band, charge and drain",
		hrv: "HRV — overnight average, status and your personal baseline range",
		readiness: "Training readiness — score, recovery time and the factors behind it",
		fitness: "Fitness — VO2 Max, fitness age, endurance and hill score, heat and altitude acclimation",
		races: "Race predictions — 5K, 10K, half, marathon",
		respiration: "Respiration — waking average, low and high",
		spo2: "Pulse ox — average, lowest and latest SpO2",
		body: "Body composition — weight, BMI, body fat, muscle and bone mass",
		training: "Training load — status, acute and chronic load, load ratio, load focus, running tolerance",
		workouts: "Workouts — a list of the day's activities",
		intraday:
			"Intraday charts — heart rate, stress, Body Battery, steps and sleep stages, saved as a file per day",
		health: "Health status — overnight HRV, heart rate, SpO2, respiration and skin temperature against your baseline, plus Health Snapshots",
		profile:
			"Profile — watch, avatar, lactate threshold, FTP, running economy, cycling ability, coach plan, upcoming events and personal records",
	};

	// Five of these ride along in the daily summary, so turning them on is free.
	// Saying which is the difference between an informed choice and a guess.
	const freeGroups = new Set<MetricGroup>(FREE_GROUPS);
	const rangeGroups = new Set<MetricGroup>(RANGE_GROUPS);

	function costOf(group: MetricGroup): string {
		if (freeGroups.has(group)) return "Free — shares the daily summary request";
		if (group === "intraday") {
			return `${REQUESTS_PER_DAY.intraday} requests per day, for the newest ${INTRADAY_DAYS} days of a sync only`;
		}
		const perSync = REQUESTS_PER_SYNC[group];
		if (perSync) return `About ${perSync} requests per sync, not per day — saved to account.json`;
		if (rangeGroups.has(group)) return "1 request per sync, not per day";
		const n = REQUESTS_PER_DAY[group] ?? 1;
		return n === 1 ? "1 request per day" : `${n} requests per day`;
	}

	function toggleGroup(group: MetricGroup, on: boolean) {
		groups = on ? [...new Set([...groups, group])] : groups.filter((g) => g !== group);
		s.groups = [...groups];
		save();
	}
</script>

<h3>Connection</h3>

{#key signedIn}
	<div
		use:obsidianSetting={(setting) => {
			const session = plugin.garmin.session;
			setting
				.setName("Status")
				.setDesc(
					session
						? `Signed in. Session saved ${new Date(session.savedAt).toLocaleString()}.`
						: "Not signed in.",
				)
				.addButton((b) =>
					b.setButtonText(session ? "Sign out" : "Sign in").onClick(async () => {
						if (session) {
							await plugin.signOut();
							new Notice("Signed out of Garmin Connect.");
							signedIn = false;
						} else {
							plugin.openLogin(() => (signedIn = plugin.garmin.session !== null));
						}
					}),
				);
		}}
	></div>
{/key}

<div
	use:obsidianSetting={(setting) =>
		setting
			.setName("Garmin email")
			.setDesc("Only the email is stored. The password is used to sign in and never saved.")
			.addText((t) =>
				t
					.setPlaceholder("you@example.com")
					.setValue(s.email)
					.onChange((v) => {
						s.email = v.trim();
						save();
					}),
			)}
></div>

<div
	use:obsidianSetting={(setting) =>
		setting
			.setName("Region")
			.setDesc("garmin.cn is the mainland China tenant; everyone else uses garmin.com.")
			.addDropdown((d) =>
				d
					.addOption("garmin.com", "garmin.com")
					.addOption("garmin.cn", "garmin.cn")
					.setValue(s.domain)
					.onChange(async (v) => {
						s.domain = v as GarminDomain;
						save();
						await plugin.rebuildClient();
						signedIn = plugin.garmin.session !== null;
					}),
			)}
></div>

<h3>Sync</h3>

<div
	use:obsidianSetting={(setting) =>
		setting
			.setName("Sync on startup")
			.setDesc("Runs a recent-days sync shortly after Obsidian loads.")
			.addToggle((t) =>
				t.setValue(s.syncOnStartup).onChange((v) => {
					s.syncOnStartup = v;
					save();
				}),
			)}
></div>

<div
	use:obsidianSetting={(setting) =>
		setting
			.setName("Download runs")
			.setDesc(
				"Saves every run's page — charts, laps and route — to the vault in the background after a sync, " +
					"newest first, so it opens without a connection. About 150 KB and ten requests a run. " +
					"Off, a run downloads when you first open it.",
			)
			.addToggle((t) =>
				t.setValue(s.data.runDetails !== "opened").onChange((v) => {
					s.data.runDetails = v ? "all" : "opened";
					save();
					if (v) plugin.sync.startDownloads();
				}),
			)}
></div>

<div
	use:obsidianSetting={(setting) =>
		setting
			.setName("Units")
			.setDesc("Auto asks Garmin which system your account uses.")
			.addDropdown((d) =>
				d
					.addOption("auto", "Auto (from your Garmin account)")
					.addOption("metric", "Metric — km")
					.addOption("imperial", "Imperial — miles")
					.setValue(s.units)
					.onChange((v) => {
						s.units = v as GarminSettings["units"];
						save();
					}),
			)}
></div>

<h3>Storage</h3>

<div
	use:obsidianSetting={(setting) =>
		setting
			.setName("Data folder")
			.setDesc(
				"Everything the sync writes is JSON in this folder — a file a year for the days in days/, " +
					"intraday charts in series/, and the activity, sleep and health indexes. " +
					"Moving it does not move files already written.",
			)
			.addText((t) =>
				t
					.setPlaceholder(DEFAULT_SETTINGS.dataFolder)
					.setValue(s.dataFolder)
					.onChange((v) => {
						s.dataFolder = v.trim() || DEFAULT_SETTINGS.dataFolder;
						save();
					}),
			)}
></div>

<h3>Metrics</h3>
<p class="hint">
	Each group says what it costs in Garmin requests: most per day synced, a few once per sync. The free
	ones share the daily summary request, so one request a day covers all of them.
</p>

{#each ALL_GROUPS as group (group)}
	<div
		use:obsidianSetting={(setting) =>
			setting
				.setName(GROUP_LABELS[group])
				.setDesc(costOf(group))
				.addToggle((t) =>
					t.setValue(groups.includes(group)).onChange((on) => toggleGroup(group, on)),
				)}
	></div>
{/each}

<h3>Maps</h3>

<div
	use:obsidianSetting={(setting) =>
		setting
			.setName("Map tiles")
			.setDesc(
				"Draws OpenStreetMap's map under an activity's route. The tiles come from tile.openstreetmap.org, which sees the area of each activity you open. Off, the route is drawn on its own.",
			)
			.addToggle((t) =>
				t.setValue(s.mapTiles).onChange((v) => {
					s.mapTiles = v;
					save();
				}),
			)}
></div>

<h3>Advanced</h3>

<div
	use:obsidianSetting={(setting) =>
		setting
			.setName("Sync speed")
			.setDesc(
				"How hard a sync leans on Garmin. Gentle is the old pace; Normal about twice it, well " +
					"under what Garmin was measured to allow. If Garmin asks to slow down, the sync waits and carries on slower.",
			)
			.addDropdown((dd) =>
				dd
					.addOptions(SPEED_LABELS)
					.setValue(s.syncSpeed)
					.onChange((v) => {
						if (!isSyncSpeed(v)) return;
						s.syncSpeed = v;
						save();
					}),
			)}
></div>

<div
	use:obsidianSetting={(setting) =>
		setting
			.setName("Stop after empty days")
			.setDesc(
				"A backfill walks newest to oldest. When it reaches past the start of your " +
					"Garmin history it gives up after this many days with nothing in them, " +
					"instead of asking all the way to the start date and being rate limited. " +
					"Set to 0 to always walk the whole range.",
			)
			.addSlider((sl) =>
				sl
					.setLimits(0, 120, 5)
					.setValue(s.stopAfterEmptyDays)
					.setDynamicTooltip()
					.onChange((v) => {
						s.stopAfterEmptyDays = v;
						save();
					}),
			)}
></div>

<div
	use:obsidianSetting={(setting) =>
		setting
			.setName("Save every diagnostics run to the vault")
			.setDesc("The only practical way to read the diagnostics from a phone.")
			.addToggle((t) =>
				t.setValue(s.autoSaveLog).onChange((v) => {
					s.autoSaveLog = v;
					save();
				}),
			)}
></div>

<div
	use:obsidianSetting={(setting) =>
		setting
			.setName("Log folder")
			.setDesc("Where saved diagnostics runs go.")
			.addText((t) =>
				t
					.setPlaceholder(DEFAULT_SETTINGS.logFolder)
					.setValue(s.logFolder)
					.onChange((v) => {
						s.logFolder = v.trim() || DEFAULT_SETTINGS.logFolder;
						save();
					}),
			)}
></div>

<style>
	.hint {
		color: var(--text-muted);
		font-size: var(--font-ui-smaller, 12px);
		margin: -0.5em 0 0.5em;
	}
</style>
