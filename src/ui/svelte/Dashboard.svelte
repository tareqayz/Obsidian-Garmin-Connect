<script lang="ts">
	import { CARDS, SLEEP_STAGES, TILES, type CardDef } from "../../dashboard/metrics";
	import {
		availableKeys,
		between,
		duration,
		inRange,
		seriesOf,
		statsFor,
		type DayRow,
		type Point,
		type Stats,
	} from "../../dashboard/series";
	import BandChart, { type BandRow } from "./BandChart.svelte";
	import Card from "./Card.svelte";
	import ColumnChart from "./ColumnChart.svelte";
	import DataTable from "./DataTable.svelte";
	import DetailStats from "./DetailStats.svelte";
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

	// Capturing the initial value is the whole point — refreshes come through
	// setRows(), not through the prop.
	// svelte-ignore state_referenced_locally
	let rows = $state(initialRows);

	export function setRows(next: readonly DayRow[]) {
		rows = next;
	}

	let rangeDays = $state(30);
	let custom = $state(false);
	let from = $state("");
	// Seeded once; the pickers own it from then on.
	// svelte-ignore state_referenced_locally
	let to = $state(today);
	let showTable = $state(false);
	let expanded = $state<string | null>(null);
	let syncing = $state(false);
	let syncMessage = $state<string | null>(null);

	let latest = $derived(rows.length > 0 ? rows[rows.length - 1]!.date : null);
	let visible = $derived(
		custom ? between(rows, from, to) : inRange(rows, rangeDays, today),
	);

	function startCustom() {
		if (!custom) {
			// Seed from whatever preset was showing, so the pickers open on a
			// sensible window instead of an empty one.
			const seeded = inRange(rows, rangeDays, today);
			from = seeded[0]?.date ?? today;
			to = seeded[seeded.length - 1]?.date ?? today;
		}
		custom = true;
	}

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

	/* -------------------------------------------------------------- */
	/*  Cards                                                          */
	/* -------------------------------------------------------------- */

	type Plot =
		| { kind: "columns"; points: Point[]; goal?: number }
		| { kind: "line"; points: Point[] }
		| { kind: "band"; rows: BandRow[] }
		| { kind: "stacked" };

	interface CardView {
		def: CardDef;
		plot: Plot;
		/** Label and unit for the tooltip. */
		label: string;
		unit: string;
		format?: (value: number) => string;
		stats?: Stats;
		/** Full-width cards lead; the rest go in the small-multiples grid. */
		wideRow?: boolean;
	}

	function lineCard(id: string, key: string, unit = "", format?: (v: number) => string): CardView | null {
		const points = seriesOf(visible, key);
		if (points.length === 0) return null;
		return {
			def: CARDS[id]!,
			plot: { kind: "line", points },
			label: CARDS[id]!.title,
			unit,
			format,
			stats: statsFor(points),
		};
	}

	let cards = $derived.by(() => {
		const out: CardView[] = [];

		const steps = seriesOf(visible, "steps");
		if (steps.length > 0) {
			const goal = [...visible].reverse().find((r) => typeof r.values.steps_goal === "number")
				?.values.steps_goal;
			out.push({
				def: {
					...CARDS.steps!,
					subtitle: goal
						? `Daily total · goal ${goal.toLocaleString()} (dashed)`
						: "Daily total",
				},
				plot: { kind: "columns", points: steps, goal },
				label: "Steps",
				unit: "",
				stats: statsFor(steps),
				wideRow: true,
			});
		}

		if (stages.length > 0) {
			out.push({
				def: CARDS.sleep!,
				plot: { kind: "stacked" },
				label: "Sleep",
				unit: "",
				format: (v) => `${Math.round(v * 100) / 100}h`,
				stats: statsFor(seriesOf(visible, "sleep_hours")),
				wideRow: true,
			});
		}

		for (const card of [
			lineCard("resting_hr", "resting_hr", " bpm"),
			lineCard("hrv", "hrv_avg", " ms"),
		]) {
			if (card) out.push(card);
		}

		const battery = visible
			.filter(
				(r) =>
					typeof r.values.body_battery_low === "number" &&
					typeof r.values.body_battery_high === "number",
			)
			.map((r) => ({
				date: r.date,
				low: r.values.body_battery_low!,
				high: r.values.body_battery_high!,
			}));
		if (battery.length > 0) {
			out.push({
				def: CARDS.battery!,
				plot: { kind: "band", rows: battery },
				label: "Body Battery",
				unit: "",
				stats: statsFor(seriesOf(visible, "body_battery_high")),
			});
		}

		for (const card of [
			lineCard("readiness", "training_readiness"),
			lineCard("vo2max", "vo2max"),
			lineCard("endurance", "endurance_score"),
			lineCard("race_5k", "race_5k", "", duration),
			lineCard("race_10k", "race_10k", "", duration),
			lineCard("race_half", "race_half", "", duration),
			lineCard("race_marathon", "race_marathon", "", duration),
		]) {
			if (card) out.push(card);
		}

		return out;
	});

	let tiles = $derived(
		TILES.filter((t) => availableKeys(visible, [t.key]).length > 0).map((tile) => ({
			tile,
			stats: statsFor(seriesOf(visible, tile.key)),
		})),
	);
	let stages = $derived(SLEEP_STAGES.filter((s) => availableKeys(visible, [s.key]).length > 0));
	let openCard = $derived(cards.find((c) => c.def.id === expanded) ?? null);

	let width = $state(0);
	let wide = $derived(width > 560);
</script>

{#snippet plot(card: CardView, height: number)}
	{#if card.plot.kind === "columns"}
		<ColumnChart
			points={card.plot.points}
			{height}
			label={card.label}
			unit={card.unit}
			goal={card.plot.goal}
		/>
	{:else if card.plot.kind === "line"}
		<LineChart
			points={card.plot.points}
			{height}
			label={card.label}
			unit={card.unit}
			format={card.format}
		/>
	{:else if card.plot.kind === "band"}
		<BandChart rows={card.plot.rows} {height} lowLabel="Low" highLabel="High" />
	{:else}
		<StackedChart rows={visible} {stages} {height} format={card.format} />
		<Legend {stages} />
	{/if}
{/snippet}

<!-- `gcd-root` is global on purpose: it is where styles.css hangs the design
     tokens that every child component reads. -->
<div class="gcd-root root" bind:clientWidth={width}>
	<FilterBar
		{rangeDays}
		{custom}
		{from}
		{to}
		{today}
		{showTable}
		{syncing}
		{canSync}
		onRange={(days) => {
			rangeDays = days;
			custom = false;
		}}
		onCustom={startCustom}
		onFrom={(d) => (from = d)}
		onTo={(d) => (to = d)}
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
					: "Press Sync above, or run “Sync recent days” from the command palette."}
			</div>
		</div>
	{:else if showTable}
		<Card title="All values" subtitle="{visible.length} days">
			<DataTable rows={visible} />
		</Card>
	{:else if openCard}
		<!-- Expanded: one card, the full pane, and the numbers a hover would carry. -->
		<Card
			title={openCard.def.title}
			subtitle={openCard.def.subtitle}
			info={openCard.def.info}
			expanded
			onCollapse={() => (expanded = null)}
		>
			{@render plot(openCard, wide ? 380 : 260)}
			{#snippet detail()}
				{#if openCard?.stats}
					<DetailStats
						stats={openCard.stats}
						format={openCard.format ?? ((v: number) => String(Math.round(v * 100) / 100))}
						unit={openCard.unit}
					/>
				{/if}
			{/snippet}
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
						info={tile.info}
					/>
				{/each}
			</div>
		{/if}

		{#each cards.filter((c) => c.wideRow) as card (card.def.id)}
			<div class="stack">
				<Card
					title={card.def.title}
					subtitle={card.def.subtitle}
					info={card.def.info}
					onExpand={() => (expanded = card.def.id)}
				>
					{@render plot(card, wide ? 200 : 170)}
				</Card>
			</div>
		{/each}

		<div class="multiples">
			{#each cards.filter((c) => !c.wideRow) as card (card.def.id)}
				<Card
					title={card.def.title}
					subtitle={card.def.subtitle}
					info={card.def.info}
					onExpand={() => (expanded = card.def.id)}
				>
					{@render plot(card, 150)}
				</Card>
			{/each}
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
