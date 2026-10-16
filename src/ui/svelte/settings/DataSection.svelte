<script lang="ts">
	import { onDestroy, onMount } from "svelte";
	import { Notice, normalizePath, type Setting } from "obsidian";
	import { folderProblem } from "../../../sync/vault-paths";
	import type GarminPlugin from "../../../main";
	import { DEFAULT_SETTINGS } from "../../../settings-data";
	import { ACTIVITY_DETAILS_KEY, ACTIVITY_DETAILS_RANGES, DAY_DETAILS_KEY, DAY_DETAILS_RANGES, rangeStart, isActivityDetailsRange, isDayDetailsRange } from "../../../sync/datasets";
	import { estimate, formatBytes, formatDuration, withBudget, type Estimate } from "../../../sync/estimate";
	import type { BackfillProgress } from "../../../sync/runner";
	import { historyStart } from "../../../sync/scan";
	import { VaultSeriesStore } from "../../../sync/series-store";
	import { SYNC_SPEEDS } from "../../../sync/speed";
	import { obsidianSetting } from "../obsidian-setting";
	import type { UpdateLine } from "../../setup-flow";

	/**
	 * Settings → Data: where the data lives, what it takes on disk, how much
	 * history to keep, the download in progress, the setup again, and deleting
	 * it all.
	 */
	let { plugin }: { plugin: GarminPlugin } = $props();

	// svelte-ignore state_referenced_locally
	const s = plugin.data.settings;
	const save = () => void plugin.data.saveSettings();

	// svelte-ignore state_referenced_locally
	let usage = $state(new VaultSeriesStore(plugin.app, s.dataFolder).diskUsage());
	let est = $state<Estimate | null>(null);
	let start = $state<string | undefined>(undefined);
	// svelte-ignore state_referenced_locally
	let progress = $state<BackfillProgress | null>(plugin.sync.backfillProgress);
	let updates = $state<UpdateLine[]>([]);
	let daySetting: Setting | undefined;
	let detailSetting: Setting | undefined;

	const dateFormat = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" });
	const monthFormat = new Intl.DateTimeFormat(undefined, { month: "short", year: "numeric" });
	const timeFormat = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
	const count = new Intl.NumberFormat();

	/** What is missing for the ranges chosen, from the last scan and what the vault holds. */
	async function refresh(): Promise<void> {
		const store = new VaultSeriesStore(plugin.app, s.dataFolder);
		usage = store.diskUsage();
		updates = await plugin.updateLines("all");
		const scan = await store.readScan();
		if (!scan) {
			est = null;
			describe();
			return;
		}
		const [index, coverage, detailFiles, charts] = await Promise.all([
			store.readActivities(),
			store.readDayCoverage(s.groups.includes("intraday")),
			store.readDetailCoverage(),
			store.readChartMetas(),
		]);
		start = historyStart(scan);
		est = estimate({
			today: new Date().toISOString().slice(0, 10),
			groups: s.groups,
			speed: s.syncSpeed,
			scan,
			dayDetails: s.data.dayDetails,
			activityDetails: s.data.activityDetails,
			activities: index.rows.map((row) => ({ id: row.id, date: row.start.slice(0, 10), run: plugin.isRun(row) })),
			held: {
				daySpans: coverage.spans,
				details: detailFiles,
				charts: new Map([...charts].filter((entry): entry is [string, { complete: boolean; from?: string }] => entry[1] !== null)),
			},
		});
		describe();
	}

	function day(date: string | null | undefined): string {
		return date ? dateFormat.format(new Date(`${date}T12:00:00`)) : "";
	}

	function describe(): void {
		const days = est?.sets.find((x) => x.id === "day-details");
		const details = est?.sets.find((x) => x.id === "activity-details");
		const from = s.data.dayDetails === "new" ? null : rangeStart(s.data.dayDetails, new Date().toISOString().slice(0, 10), start);
		let dayText = "Keeps every new day.";
		if (s.data.dayDetails === "new") dayText = "Keeps every new day from the setup on.";
		else if (days?.units) dayText += ` Older days back to ${day(from)}: + ${count.format(days.units)} days · ≈ ${formatBytes(days.bytes)} · ${formatDuration(days.seconds)} to fill.`;
		else if (est) dayText += ` Everything back to ${day(from)} is in this vault.`;
		daySetting?.setDesc(dayText);

		let detailText = "An activity downloads when you open it.";
		if (s.data.activityDetails !== "opened")
			detailText = details?.units
				? `Every activity is saved. ${count.format(details.units)} ${details.units === 1 ? "activity" : "activities"} left to download.`
				: "Every activity is saved.";
		detailSetting?.setDesc(detailText);
	}

	const unsubscribe: Array<() => void> = [];
	onMount(() => {
		unsubscribe.push(
			plugin.sync.onBackfill((next) => {
				progress = next;
				// A unit just finished: the sizes and what is left moved.
				void refresh();
			}),
			// Deleted, or set up again: everything here moved.
			plugin.onDataChanged(() => {
				progress = plugin.sync.backfillProgress;
				void refresh();
			}),
		);
		void refresh();
	});
	onDestroy(() => unsubscribe.forEach((off) => off()));

	/** Choosing a range is agreeing to fetch it: the backfill starts on what is missing. */
	function choose(key: string): void {
		if (!s.data.accepted.includes(key)) s.data.accepted = [...s.data.accepted, key];
		s.data.deferred = s.data.deferred.filter((k) => k !== key);
		save();
		plugin.setupChanged();
		plugin.sync.kickBackfill();
		void refresh();
	}

	let percent = $derived(progress && progress.done + progress.remaining > 0 ? Math.min(99, Math.round((progress.done / (progress.done + progress.remaining)) * 100)) : 0);

	function progressLine(p: BackfillProgress): string {
		const what = p.task === "details" ? "Activity details" : p.task === "days" ? "Day details" : "Charts & trends";
		const reached = p.reached ? ` · back to ${monthFormat.format(new Date(`${p.reached}T12:00:00`))}` : "";
		const until = p.until ? timeFormat.format(new Date(p.until)) : "";
		if (p.status === "paused" && p.reason === "user") return `Download paused · ${percent}% · ${what}${reached}`;
		if (p.status === "paused" && p.reason === "sign-in") return "Your Garmin session ended. Sign in to keep downloading.";
		if (p.status === "paused" && p.reason === "rate-limit") return `Garmin asked us to slow down · resumes at ${until}`;
		if (p.status === "paused" && p.reason === "blocked") return `Garmin's bot check refused this device · trying again at ${until}`;
		if (p.status === "paused" && p.reason === "update") return "Another device runs a newer version of the plugin. Update it here to keep downloading.";
		if (p.status === "paused") return `Something went wrong · trying again at ${until}`;
		if (p.status === "waiting") return `Resting under the hourly limit · resumes at ${until}`;
		if (p.status === "elsewhere") return `Downloading on ${p.device ?? "another device"}. This device leaves it to that one.`;
		const rate = SYNC_SPEEDS[s.syncSpeed].limits.rate;
		const left = withBudget(p.remaining, p.remaining / rate, s.syncSpeed);
		return `Downloading ${what}${reached} · ${percent}% · ${formatDuration(left)} left`;
	}
</script>

<div use:obsidianSetting={(setting) => setting.setName("Data").setHeading()}></div>

<div
	use:obsidianSetting={(setting) =>
		setting
			.setName("Data folder")
			.setDesc("Where the synced JSON files live. Moving it does not move files already written.")
			.addText((t) => {
				t.setPlaceholder(DEFAULT_SETTINGS.dataFolder).setValue(s.dataFolder);
				// Saved once, on Enter or leaving the field: a folder taken a keystroke
				// at a time would scatter half-typed folders through the vault.
				const commit = () => {
					const next = normalizePath(t.getValue().trim() || DEFAULT_SETTINGS.dataFolder);
					const problem = folderProblem(next, plugin.app.vault.configDir);
					if (problem) {
						new Notice(problem);
						t.setValue(s.dataFolder);
						return;
					}
					if (next === s.dataFolder) return;
					s.dataFolder = next;
					t.setValue(next);
					save();
				};
				t.inputEl.addEventListener("blur", commit);
				t.inputEl.addEventListener("keydown", (e) => {
					if (e.key === "Enter") t.inputEl.blur();
				});
			})}
></div>

{#key usage}
	<div
		use:obsidianSetting={(setting) =>
			setting
				.setName("On disk")
				.setDesc(
					`${formatBytes(usage.total)} — Charts & trends ${formatBytes(usage.charts)} · Day details ${formatBytes(usage.days)} · Activity details ${formatBytes(usage.details)} · Other ${formatBytes(usage.other)}`,
				)}
	></div>
{/key}

<div
	use:obsidianSetting={(setting) => {
		daySetting = setting;
		setting
			.setName("Day details")
			.setDesc("Keeps every new day.")
			.addDropdown((d) => {
				for (const range of DAY_DETAILS_RANGES) d.addOption(range.id, range.label);
				d.setValue(s.data.dayDetails).onChange((v) => {
					if (!isDayDetailsRange(v)) return;
					s.data.dayDetails = v;
					choose(DAY_DETAILS_KEY);
				});
			});
	}}
></div>

<div
	use:obsidianSetting={(setting) => {
		detailSetting = setting;
		setting
			.setName("Activity details")
			.setDesc("An activity downloads when you open it.")
			.addDropdown((d) => {
				for (const range of ACTIVITY_DETAILS_RANGES) d.addOption(range.id, range.label);
				d.setValue(s.data.activityDetails).onChange((v) => {
					if (!isActivityDetailsRange(v)) return;
					s.data.activityDetails = v;
					choose(ACTIVITY_DETAILS_KEY);
				});
			});
	}}
></div>

{#if progress}
	<div class="backfill" role="status">
		{#if progress.status === "running" || (progress.status === "paused" && progress.reason === "user")}
			<div class="bar"><span style:width="{percent}%"></span></div>
		{/if}
		<div class="row">
			<span class="line">{progressLine(progress)}</span>
			{#if progress.status === "running"}
				<button onclick={() => void plugin.sync.pauseBackfill()}>Pause</button>
			{:else if progress.status === "paused" && progress.reason === "sign-in"}
				<button class="mod-cta" onclick={() => plugin.openLogin()}>Sign in</button>
			{:else if progress.status === "paused"}
				<button class="mod-cta" onclick={() => void plugin.sync.resumeBackfill()}>Resume</button>
			{/if}
		</div>
	</div>
{/if}

{#if updates.length}
	<div class="updates" role="region" aria-label="New data for your history">
		<strong>New data for your history</strong>
		<ul>
			{#each updates as line (line.key)}
				<li>{line.title} <span class="muted">— {line.detail} · ≈ {line.bytes >= 1_000_000 ? formatBytes(line.bytes) : `${count.format(line.requests)} requests`}</span></li>
			{/each}
		</ul>
		<div class="row end">
			<button class="mod-cta" onclick={() => void plugin.agreeTo(updates.map((line) => line.key), []).then(refresh)}>Download</button>
		</div>
	</div>
{/if}

<div
	use:obsidianSetting={(setting) =>
		setting
			.setName("Run setup again")
			.setDesc("Scan your Garmin history again and choose what to keep.")
			.addButton((b) => b.setButtonText("Open setup").onClick(() => plugin.openSetup()))}
></div>

<style>
	.backfill {
		display: flex;
		flex-direction: column;
		gap: 10px;
		margin: 4px 0 12px;
		padding: 12px 16px;
		border-radius: var(--radius-m);
		background: var(--background-secondary);
	}
	.bar {
		height: 4px;
		border-radius: 2px;
		overflow: hidden;
		background: var(--background-modifier-border);
	}
	.bar span {
		display: block;
		height: 100%;
		border-radius: 2px;
		background: var(--interactive-accent);
		transition: width 0.3s ease;
	}
	.row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}
	.line {
		color: var(--text-muted);
		font-size: var(--font-ui-small);
	}
	.updates {
		display: flex;
		flex-direction: column;
		gap: 8px;
		margin: 4px 0 12px;
		padding: 12px 16px;
		border-radius: var(--radius-m);
		background: var(--background-secondary);
	}
	.updates ul {
		margin: 0;
		padding-left: 18px;
		font-size: var(--font-ui-small);
	}
	.updates .muted {
		color: var(--text-muted);
	}
	.row.end {
		justify-content: flex-end;
	}
	button {
		flex: none;
	}
</style>
