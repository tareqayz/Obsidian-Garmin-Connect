<script lang="ts">
	import { Notice } from "obsidian";
	import type { GarminDomain } from "../../garmin/constants";
	import type GarminPlugin from "../../main";
	import { DAILY_NOTE_DEFAULTS, coreDailyNoteOptions } from "../../sync/daily-note";
	import { ALL_GROUPS, type MetricGroup } from "../../sync/metrics";
	import type { StorageMode } from "../../sync/runner";
	import { DEFAULT_SETTINGS, type GarminSettings } from "../../settings";
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
	// svelte-ignore state_referenced_locally
	let storageMode = $state(s.storageMode);
	let groups = $state<MetricGroup[]>([...s.groups]);
	// svelte-ignore state_referenced_locally
	let signedIn = $state(plugin.garmin.session !== null);

	// svelte-ignore state_referenced_locally
	let core = coreDailyNoteOptions(plugin.app);

	const GROUP_LABELS: Record<MetricGroup, string> = {
		activity: "Activity — steps, distance, calories, floors, intensity minutes",
		heart: "Heart rate — resting, min, max",
		sleep: "Sleep — duration, stages, score, start and end",
		stress: "Stress and Body Battery",
		hrv: "HRV — overnight average and status",
		readiness: "Training readiness",
		workouts: "Workouts — a list of the day's activities",
	};

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
			.setName("Days to sync")
			.setDesc(
				"How far back a recent-days sync reaches. Garmin keeps revising a day after it " +
					"ends — sleep is finalised late — so more than one day is worth it.",
			)
			.addSlider((sl) =>
				sl
					.setLimits(1, 30, 1)
					.setValue(s.syncDays)
					.setDynamicTooltip()
					.onChange((v) => {
						s.syncDays = v;
						save();
					}),
			)}
></div>

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
			.setName("Where to put the data")
			.setDesc(
				"A data folder keeps one note per day in a folder of its own, which never touches " +
					"notes you wrote and lets you backfill days that have no note yet. Daily notes " +
					"put the properties in the note you already keep for that day.",
			)
			.addDropdown((d) =>
				d
					.addOption("dataFolder", "Data folder (one note per day)")
					.addOption("dailyNotes", "Daily notes")
					.addOption("both", "Both")
					.setValue(s.storageMode)
					.onChange((v) => {
						s.storageMode = v as StorageMode;
						storageMode = s.storageMode;
						save();
					}),
			)}
></div>

{#if storageMode !== "dailyNotes"}
	<div
		use:obsidianSetting={(setting) =>
			setting
				.setName("Data folder")
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

	<div
		use:obsidianSetting={(setting) =>
			setting
				.setName("Property prefix in the data folder")
				.setDesc("Blank by default — nothing in a folder of its own to collide with.")
				.addText((t) =>
					t
						.setPlaceholder("(none)")
						.setValue(s.dataFolderPrefix)
						.onChange((v) => {
							s.dataFolderPrefix = v;
							save();
						}),
				)}
	></div>

	<div
		use:obsidianSetting={(setting) =>
			setting
				.setName("Table view")
				.setDesc(
					"Creates a Bases view over the data folder on the first sync that writes " +
						"something. It is never overwritten once it exists.",
				)
				.addToggle((t) =>
					t.setValue(s.createBasesView).onChange((v) => {
						s.createBasesView = v;
						save();
					}),
				)
				.addButton((b) =>
					b
						.setButtonText("Rebuild now")
						.setTooltip("Replaces the view with one matching your current settings")
						.onClick(async () => {
							new Notice(`Rebuilt ${await plugin.sync.rewriteBasesView()}`);
						}),
				)}
	></div>
{/if}

<h3>Metrics</h3>
<p class="hint">Turning a group off also stops the request that fetches it.</p>

{#each ALL_GROUPS as group (group)}
	<div
		use:obsidianSetting={(setting) =>
			setting.setName(GROUP_LABELS[group]).addToggle((t) =>
				t.setValue(groups.includes(group)).onChange((on) => toggleGroup(group, on)),
			)}
	></div>
{/each}

{#if storageMode !== "dataFolder"}
	<h3>Daily notes</h3>

	<div
		use:obsidianSetting={(setting) =>
			setting
				.setName("Property prefix in daily notes")
				.setDesc(
					`Prepended to every property, so "steps" becomes "${s.prefix}steps". Clear it at ` +
						"your own risk — an unprefixed key can collide with your own.",
				)
				.addText((t) =>
					t
						.setPlaceholder("garmin_")
						.setValue(s.prefix)
						.onChange((v) => {
							s.prefix = v;
							save();
						}),
				)}
	></div>

	<div
		use:obsidianSetting={(setting) =>
			setting
				.setName("Folder")
				.setDesc(
					`Leave blank to follow the core Daily Notes plugin (currently "${core.folder || "vault root"}").`,
				)
				.addText((t) =>
					t
						.setPlaceholder(core.folder || "vault root")
						.setValue(s.dailyNoteFolder)
						.onChange((v) => {
							s.dailyNoteFolder = v.trim();
							save();
						}),
				)}
	></div>

	<div
		use:obsidianSetting={(setting) =>
			setting
				.setName("Date format")
				.setDesc(
					`Moment tokens. Leave blank to follow Daily Notes (currently "${core.format || DAILY_NOTE_DEFAULTS.format}").`,
				)
				.addText((t) =>
					t
						.setPlaceholder(core.format || DAILY_NOTE_DEFAULTS.format)
						.setValue(s.dailyNoteFormat)
						.onChange((v) => {
							s.dailyNoteFormat = v.trim();
							save();
						}),
				)}
	></div>

	<div
		use:obsidianSetting={(setting) =>
			setting
				.setName("Create missing notes")
				.setDesc(
					"Off by default. While off, days without a daily note are skipped before any " +
						"request is made, which also keeps request counts down.",
				)
				.addToggle((t) =>
					t.setValue(s.createMissingNotes).onChange((v) => {
						s.createMissingNotes = v;
						save();
					}),
				)}
	></div>
{/if}

<h3>Diagnostics</h3>

<div
	use:obsidianSetting={(setting) =>
		setting
			.setName("Pause between days")
			.setDesc("Milliseconds. Slows a long backfill enough to stay under Garmin's limits.")
			.addSlider((sl) =>
				sl
					.setLimits(0, 2000, 50)
					.setValue(s.pauseBetweenDays)
					.setDynamicTooltip()
					.onChange((v) => {
						s.pauseBetweenDays = v;
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
			.setName("Save every probe run to the vault")
			.setDesc("The only practical way to read probe output from a phone.")
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
