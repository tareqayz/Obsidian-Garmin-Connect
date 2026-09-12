<script lang="ts">
	import { SLEEP_STAGES, TILES } from "../../dashboard/metrics";
	import {
		availableKeys,
		inRange,
		seriesOf,
		statsFor,
		type DayRow,
	} from "../../dashboard/series";
	import BandChart from "./BandChart.svelte";
	import Card from "./Card.svelte";
	import ColumnChart from "./ColumnChart.svelte";
	import DataTable from "./DataTable.svelte";
	import FilterBar from "./FilterBar.svelte";
	import Legend from "./Legend.svelte";
	import LineChart from "./LineChart.svelte";
	import StackedChart from "./StackedChart.svelte";
	import StatTile from "./StatTile.svelte";
	import SyncStatus from "./SyncStatus.svelte";

	interface Props {
		initialRows: readonly DayRow[];
		today: string;
		/** Whether a session exists — sync is pointless without one. */
		canSync: boolean;
		/** Resolves with a one-line summary of what the run did, or null. */
		onSync: () => Promise<string | null>;
		onBackfill: () => void;
	}

	let { initialRows, today, canSync, onSync, onBackfill }: Props = $props();

	// Held as state and replaced through the exported setter rather than taken
	// from a prop, so a sync can refresh the data without remounting — which
	// would throw away the selected range and the table toggle.
	// Capturing the initial value is the whole point — refreshes come through
	// setRows(), not through the prop.
	// svelte-ignore state_referenced_locally
	let rows = $state(initialRows);

	export function setRows(next: readonly DayRow[]) {
		rows = next;
	}

	let rangeDays = $state(30);
	let showTable = $state(false);
	let syncing = $state(false);
	let syncMessage = $state<string | null>(null);

	let latest = $derived(rows.length > 0 ? rows[rows.length - 1]!.date : null);

	async function sync() {
		if (syncing) return;
		syncing = true;
		syncMessage = null;
		try {
			syncMessage = await onSync();
		} catch (err) {
			syncMessage = err instanceof Error ? err.message : String(err);
		} finally {
			syncing = false;
		}
	}

	let visible = $derived(inRange(rows, rangeDays, today));
	let tiles = $derived(
		TILES.filter((t) => availableKeys(visible, [t.key]).length > 0).map((tile) => ({
			tile,
			stats: statsFor(seriesOf(visible, tile.key)),
		})),
	);

	let steps = $derived(seriesOf(visible, "steps"));
	let stepGoal = $derived(
		[...visible].reverse().find((r) => typeof r.values.steps_goal === "number")?.values.steps_goal,
	);

	let stages = $derived(SLEEP_STAGES.filter((s) => availableKeys(visible, [s.key]).length > 0));

	let restingHr = $derived(seriesOf(visible, "resting_hr"));
	let hrv = $derived(seriesOf(visible, "hrv_avg"));
	let readiness = $derived(seriesOf(visible, "training_readiness"));
	let battery = $derived(
		visible
			.filter(
				(r) =>
					typeof r.values.body_battery_low === "number" &&
					typeof r.values.body_battery_high === "number",
			)
			.map((r) => ({
				date: r.date,
				low: r.values.body_battery_low!,
				high: r.values.body_battery_high!,
			})),
	);

	// Wide enough for two columns of small multiples? The grid decides; this only
	// picks the taller chart height for the roomier layout.
	let width = $state(0);
	let wide = $derived(width > 560);
</script>

<!-- `gcd-root` is global on purpose: it is where styles.css hangs the design
     tokens that every child component reads. -->
<div class="gcd-root root" bind:clientWidth={width}>
	<FilterBar
		{rangeDays}
		{showTable}
		{syncing}
		{canSync}
		onRange={(days) => (rangeDays = days)}
		onToggleTable={() => (showTable = !showTable)}
		onSync={sync}
		{onBackfill}
	/>

	<SyncStatus {latest} total={rows.length} {syncing} {canSync} message={syncMessage} />

	{#if visible.length === 0}
		<div class="empty">
			<div class="empty-title">
				{rows.length > 0 ? "Nothing in this range" : "No Garmin data yet"}
			</div>
			<div>
				{rows.length > 0
					? "Try a longer range, or sync more days."
					: "Run “Sync recent days” from the command palette, then come back."}
			</div>
		</div>
	{:else if showTable}
		<Card title="All values" subtitle="{visible.length} days">
			<DataTable rows={visible} />
		</Card>
	{:else}
		{#if tiles.length > 0}
			<div class="tiles">
				{#each tiles as { tile, stats } (tile.key)}
					<StatTile
						label={tile.label}
						{stats}
						unit={tile.unit}
						format={tile.format}
						goodDirection={tile.goodDirection}
					/>
				{/each}
			</div>
		{/if}

		{#if steps.length > 0}
			<div class="stack">
				<Card
					title="Steps"
					subtitle={stepGoal
						? `Daily total · goal ${stepGoal.toLocaleString()} (dashed)`
						: "Daily total"}
				>
					<ColumnChart points={steps} height={wide ? 200 : 170} label="Steps" goal={stepGoal} />
				</Card>
			</div>
		{/if}

		{#if stages.length > 0}
			<div class="stack">
				<Card title="Sleep" subtitle="Hours by stage">
					<StackedChart
						rows={visible}
						{stages}
						height={wide ? 200 : 170}
						format={(v) => `${Math.round(v * 100) / 100}h`}
					/>
					<Legend {stages} />
				</Card>
			</div>
		{/if}

		<div class="multiples">
			{#if restingHr.length > 0}
				<Card title="Resting heart rate" subtitle="bpm">
					<LineChart points={restingHr} height={150} label="Resting HR" unit=" bpm" />
				</Card>
			{/if}
			{#if hrv.length > 0}
				<Card title="HRV" subtitle="Overnight average, ms">
					<LineChart points={hrv} height={150} label="HRV" unit=" ms" />
				</Card>
			{/if}
			{#if battery.length > 0}
				<Card title="Body Battery" subtitle="Daily low to high">
					<BandChart rows={battery} height={150} lowLabel="Low" highLabel="High" />
				</Card>
			{/if}
			{#if readiness.length > 0}
				<Card title="Training readiness" subtitle="Score out of 100">
					<LineChart points={readiness} height={150} label="Readiness" />
				</Card>
			{/if}
		</div>
	{/if}
</div>

<style>
	.root {
		padding: 12px 16px 32px;
		font-size: var(--font-ui-small, 13px);
		color: var(--gcd-text);
	}
	.tiles {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(148px, 1fr));
		gap: 10px;
		margin-bottom: 18px;
	}
	.stack {
		margin-bottom: 14px;
	}
	.multiples {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: 14px;
	}
	.empty {
		padding: 40px 8px;
		text-align: center;
		color: var(--gcd-muted);
	}
	.empty-title {
		font-weight: 600;
		color: var(--gcd-text);
		margin-bottom: 4px;
	}
</style>
