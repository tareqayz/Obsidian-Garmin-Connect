<script lang="ts">
	import {
		CARDS,
		COMPOSITIONS,
		GOALS,
		HEATMAP_METRICS,
		SECTIONS,
		SLEEP_STAGES,
		TILES,
		type CardDef,
		type SectionId,
	} from "../../dashboard/metrics";
	import {
		availableKeys,
		between,
		compact,
		daysBetween,
		duration,
		inRange,
		seriesOf,
		statsFor,
		workoutsIn,
		type DayRow,
		type Point,
		type Stats,
		type WorkoutEntry,
	} from "../../dashboard/series";
	import BandChart, { type BandRow } from "./BandChart.svelte";
	import BaselineChart, { type BaselinePoint } from "./BaselineChart.svelte";
	import CalendarHeatmap from "./CalendarHeatmap.svelte";
	import Card from "./Card.svelte";
	import ColumnChart from "./ColumnChart.svelte";
	import CompositionBar, { type Segment } from "./CompositionBar.svelte";
	import DataTable from "./DataTable.svelte";
	import DetailStats from "./DetailStats.svelte";
	import FilterBar from "./FilterBar.svelte";
	import GoalRing from "./GoalRing.svelte";
	import Legend from "./Legend.svelte";
	import LineChart from "./LineChart.svelte";
	import MultiLineChart, { type LineSeries } from "./MultiLineChart.svelte";
	import Section from "./Section.svelte";
	import StackedChart from "./StackedChart.svelte";
	import StatTile from "./StatTile.svelte";
	import SyncStatus from "./SyncStatus.svelte";
	import WorkoutList from "./WorkoutList.svelte";

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
	let collapsed = $state(new Set<SectionId>());
	let heatKey = $state<string | null>(null);

	let latest = $derived(rows.length > 0 ? rows[rows.length - 1]!.date : null);
	let visible = $derived(custom ? between(rows, from, to) : inRange(rows, rangeDays, today));
	let window = $derived({
		from: visible[0]?.date ?? today,
		to: visible[visible.length - 1]?.date ?? today,
	});
	let latestRow = $derived(visible[visible.length - 1]);

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

	function toggleSection(id: SectionId) {
		const next = new Set(collapsed);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		collapsed = next;
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
		| { kind: "baseline"; points: BaselinePoint[]; bandLabel: string }
		| { kind: "multiline"; series: LineSeries[]; dates: string[] }
		| { kind: "stacked" }
		| { kind: "heatmap" }
		| { kind: "composition"; segments: Segment[]; caption: string }
		| { kind: "workouts"; entries: WorkoutEntry[] };

	interface CardView {
		def: CardDef;
		plot: Plot;
		/** Label and unit for the tooltip. */
		label: string;
		unit: string;
		format?: (value: number) => string;
		stats?: Stats;
		/** Full-width cards lead their section; the rest go in the grid below it. */
		wideRow?: boolean;
	}

	function lineCard(
		id: string,
		key: string,
		unit = "",
		format?: (v: number) => string,
	): CardView | null {
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

	function columnCard(
		id: string,
		key: string,
		unit = "",
		goalKey?: string,
		format?: (v: number) => string,
	): CardView | null {
		const points = seriesOf(visible, key);
		if (points.length === 0) return null;
		const goal = goalKey
			? [...visible].reverse().find((r) => typeof r.values[goalKey] === "number")?.values[goalKey]
			: undefined;
		return {
			def: {
				...CARDS[id]!,
				subtitle: goal
					? `${CARDS[id]!.subtitle} · goal ${compact(goal)} (dashed)`
					: CARDS[id]!.subtitle,
			},
			plot: { kind: "columns", points, goal },
			label: CARDS[id]!.title,
			unit,
			format,
			stats: statsFor(points),
		};
	}

	/** Which distance/weight key this vault was synced with. */
	function unitKey(metric: string, imperial: string): string | null {
		if (availableKeys(visible, [metric]).length > 0) return metric;
		if (availableKeys(visible, [imperial]).length > 0) return imperial;
		return null;
	}

	let stages = $derived(SLEEP_STAGES.filter((s) => availableKeys(visible, [s.key]).length > 0));

	let cards = $derived.by(() => {
		const out: CardView[] = [];
		const push = (card: CardView | null, wideRow = false) => {
			if (card) out.push(wideRow ? { ...card, wideRow: true } : card);
		};

		/* Activity ---------------------------------------------------- */
		push(columnCard("steps", "steps", "", "steps_goal"), true);

		// Under two months the grid is five columns of squares, which says less
		// than the column chart above it and takes more ink to say it. The
		// calendar earns its place over a quarter or a year.
		if (heatMetric && daysBetween(window.from, window.to) >= 56) {
			out.push({
				def: {
					...CARDS.calendar!,
					subtitle: `${heatMetric.label} · one square per day, darker for more`,
				},
				plot: { kind: "heatmap" },
				label: heatMetric.label,
				unit: heatMetric.unit ?? "",
				format: heatMetric.format,
				wideRow: true,
			});
		}

		const distanceKey = unitKey("distance_km", "distance_mi");
		if (distanceKey) {
			push(columnCard("distance", distanceKey, distanceKey === "distance_km" ? " km" : " mi"));
		}
		push(columnCard("calories", "calories_active", "", undefined, compact));
		push(columnCard("intensity", "intensity_minutes", " min", "intensity_goal"));
		push(columnCard("floors", "floors", "", "floors_goal"));

		/* Sleep ------------------------------------------------------- */
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
		push(lineCard("sleep_score", "sleep_score"));
		push(lineCard("sleep_respiration", "sleep_respiration", " br/min"));
		push(lineCard("sleep_spo2", "sleep_spo2", "%"));
		push(lineCard("sleep_battery", "sleep_body_battery_change"));
		push(lineCard("sleep_restless", "sleep_restless_moments"));

		/* Recovery ---------------------------------------------------- */
		push(hrvCard(), true);
		push(lineCard("resting_hr", "resting_hr", " bpm"));
		push(lineCard("readiness", "training_readiness"));
		push(batteryCard());
		push(lineCard("stress", "stress_avg"));
		push(lineCard("recovery_time", "recovery_time_hours", " h"));
		push(lineCard("respiration", "respiration_avg", " br/min"));
		push(lineCard("spo2", "spo2_avg", "%"));

		/* Fitness ----------------------------------------------------- */
		push(trainingLoadCard(), true);
		push(loadRatioCard());
		push(lineCard("vo2max", "vo2max"));
		push(lineCard("fitness_age", "fitness_age", " yrs"));
		push(lineCard("endurance", "endurance_score"));
		push(lineCard("race_5k", "race_5k", "", duration));
		push(lineCard("race_10k", "race_10k", "", duration));
		push(lineCard("race_half", "race_half", "", duration));
		push(lineCard("race_marathon", "race_marathon", "", duration));

		/* Body -------------------------------------------------------- */
		const weightKey = unitKey("weight_kg", "weight_lb");
		if (weightKey) push(lineCard("weight", weightKey, weightKey === "weight_kg" ? " kg" : " lb"));
		push(lineCard("body_fat", "body_fat_pct", "%"));
		push(lineCard("bmi", "bmi"));

		/* Compositions ------------------------------------------------ */
		for (const def of COMPOSITIONS) {
			const source = [...visible]
				.reverse()
				.find((row) => def.parts.some((p) => typeof row.values[p.key] === "number"));
			if (!source) continue;
			const segments = def.parts
				.filter((p) => typeof source.values[p.key] === "number")
				.map((p) => ({ key: p.key, label: p.label, value: source.values[p.key]!, step: p.step }));
			out.push({
				def,
				plot: { kind: "composition", segments, caption: shortDateOf(source.date) },
				label: def.title,
				unit: def.unit,
			});
		}

		/* Activities -------------------------------------------------- */
		const entries = workoutsIn(visible);
		if (entries.length > 0) {
			out.push({
				def: { ...CARDS.workouts!, subtitle: `${entries.length} in this range` },
				plot: { kind: "workouts", entries },
				label: "Activities",
				unit: "",
				wideRow: true,
			});
		}

		return out;
	});

	/** HRV against the personal range Garmin judges it by, when that range synced. */
	function hrvCard(): CardView | null {
		const points = seriesOf(visible, "hrv_avg");
		if (points.length === 0) return null;
		const byDate = new Map(visible.map((r) => [r.date, r.values]));
		const withBand: BaselinePoint[] = points.map((p) => {
			const values = byDate.get(p.date);
			const low = values?.hrv_baseline_low;
			const high = values?.hrv_baseline_high;
			return {
				...p,
				...(typeof low === "number" && typeof high === "number" ? { low, high } : {}),
			};
		});
		const banded = withBand.some((p) => p.low !== undefined);
		return {
			def: {
				...CARDS.hrv!,
				subtitle: banded ? "Overnight average against your baseline, ms" : CARDS.hrv!.subtitle,
			},
			plot: banded
				? { kind: "baseline", points: withBand, bandLabel: "Baseline" }
				: { kind: "line", points },
			label: "HRV",
			unit: " ms",
			stats: statsFor(points),
		};
	}

	function batteryCard(): CardView | null {
		const bands = visible
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
		if (bands.length === 0) return null;
		return {
			def: CARDS.battery!,
			plot: { kind: "band", rows: bands },
			label: "Body Battery",
			unit: "",
			stats: statsFor(seriesOf(visible, "body_battery_high")),
		};
	}

	function trainingLoadCard(): CardView | null {
		const acute = seriesOf(visible, "training_load_acute");
		const chronic = seriesOf(visible, "training_load_chronic");
		if (acute.length === 0 && chronic.length === 0) return null;
		const series: LineSeries[] = [];
		if (acute.length) series.push({ key: "acute", label: "Acute (7d)", step: 2, points: acute });
		if (chronic.length) {
			series.push({ key: "chronic", label: "Chronic (28d)", step: 4, points: chronic, dashed: true });
		}
		return {
			def: CARDS.training_load!,
			plot: { kind: "multiline", series, dates: visible.map((r) => r.date) },
			label: "Training load",
			unit: "",
			stats: statsFor(acute.length ? acute : chronic),
		};
	}

	/** The productive band is a constant, which a baseline chart draws for free. */
	function loadRatioCard(): CardView | null {
		const points = seriesOf(visible, "training_load_ratio");
		if (points.length === 0) return null;
		return {
			def: CARDS.load_ratio!,
			plot: {
				kind: "baseline",
				points: points.map((p) => ({ ...p, low: 0.8, high: 1.3 })),
				bandLabel: "Productive range",
			},
			label: "Load ratio",
			unit: "",
			stats: statsFor(points),
		};
	}

	function shortDateOf(iso: string): string {
		return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
			day: "numeric",
			month: "short",
		});
	}

	/* -------------------------------------------------------------- */
	/*  Headline                                                       */
	/* -------------------------------------------------------------- */

	let tiles = $derived(
		TILES.filter((t) => availableKeys(visible, [t.key]).length > 0).map((tile) => ({
			tile,
			stats: statsFor(seriesOf(visible, tile.key)),
		})),
	);

	let rings = $derived(
		GOALS.map((goal) => {
			// The most recent day that has both the measure and its target — a goal
			// ring for a day Garmin never reported a goal for would be a fiction.
			const row = [...visible]
				.reverse()
				.find(
					(r) =>
						typeof r.values[goal.key] === "number" &&
						typeof r.values[goal.goalKey] === "number" &&
						r.values[goal.goalKey]! > 0,
				);
			return row ? { ...goal, value: row.values[goal.key]!, goal: row.values[goal.goalKey]! } : null;
		}).filter((r): r is NonNullable<typeof r> => r !== null),
	);

	let heatChoices = $derived(
		HEATMAP_METRICS.filter((m) => availableKeys(visible, [m.key]).length > 0),
	);
	let heatMetric = $derived(heatChoices.find((m) => m.key === heatKey) ?? heatChoices[0]);

	let openCard = $derived(cards.find((c) => c.def.id === expanded) ?? null);
	let sections = $derived(
		SECTIONS.map((section) => ({
			...section,
			cards: cards.filter((c) => c.def.section === section.id),
		})).filter((section) => section.cards.length > 0),
	);

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
	{:else if card.plot.kind === "baseline"}
		<BaselineChart
			points={card.plot.points}
			{height}
			label={card.label}
			unit={card.unit}
			bandLabel={card.plot.bandLabel}
		/>
	{:else if card.plot.kind === "multiline"}
		<MultiLineChart
			series={card.plot.series}
			dates={card.plot.dates}
			{height}
			unit={card.unit}
			format={card.format}
		/>
		<Legend
			stages={card.plot.series.map((s) => ({ key: s.key, label: s.label, step: s.step }))}
		/>
	{:else if card.plot.kind === "band"}
		<BandChart rows={card.plot.rows} {height} lowLabel="Low" highLabel="High" />
	{:else if card.plot.kind === "heatmap"}
		<CalendarHeatmap
			rows={visible}
			metricKey={heatMetric?.key ?? ""}
			from={window.from}
			to={window.to}
			label={card.label}
			unit={card.unit}
			format={card.format}
		/>
	{:else if card.plot.kind === "composition"}
		<CompositionBar segments={card.plot.segments} unit={card.unit} caption={card.plot.caption} />
	{:else if card.plot.kind === "workouts"}
		<WorkoutList workouts={card.plot.entries} limit={height > 200 ? 40 : 8} />
	{:else}
		<StackedChart rows={visible} {stages} {height} format={card.format} />
		<Legend {stages} />
	{/if}
{/snippet}

{#snippet cardBody(card: CardView, height: number)}
	{#if card.def.id === "calendar" && heatChoices.length > 1}
		<!-- One switchable calendar rather than ten: a year of squares is a lot of
		     ink, and repeating it per metric would drown everything else. -->
		<label class="picker">
			<span class="sr">Calendar metric</span>
			<select
				value={heatMetric?.key}
				onchange={(e) => (heatKey = e.currentTarget.value)}
			>
				{#each heatChoices as choice (choice.key)}
					<option value={choice.key}>{choice.label}</option>
				{/each}
			</select>
		</label>
	{/if}
	{@render plot(card, height)}
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
			{@render cardBody(openCard, wide ? 380 : 260)}
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
		{#if rings.length > 0}
			<div class="rings">
				{#each rings as ring (ring.key)}
					<GoalRing
						label={ring.label}
						value={ring.value}
						goal={ring.goal}
						format={ring.key === "steps" ? compact : undefined}
					/>
				{/each}
				{#if latestRow}
					<p class="ring-note">
						Goals as of {shortDateOf(latestRow.date)}, the most recent day with data.
					</p>
				{/if}
			</div>
		{/if}

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

		{#each sections as section (section.id)}
			<Section
				title={section.title}
				count={section.cards.length}
				open={!collapsed.has(section.id)}
				onToggle={() => toggleSection(section.id)}
			>
				{#each section.cards.filter((c) => c.wideRow) as card (card.def.id)}
					<Card
						title={card.def.title}
						subtitle={card.def.subtitle}
						info={card.def.info}
						onExpand={() => (expanded = card.def.id)}
					>
						{@render cardBody(card, wide ? 200 : 170)}
					</Card>
				{/each}

				{#if section.cards.some((c) => !c.wideRow)}
					<div class="multiples">
						{#each section.cards.filter((c) => !c.wideRow) as card (card.def.id)}
							<Card
								title={card.def.title}
								subtitle={card.def.subtitle}
								info={card.def.info}
								onExpand={card.plot.kind === "composition"
									? undefined
									: () => (expanded = card.def.id)}
							>
								{@render cardBody(card, 150)}
							</Card>
						{/each}
					</div>
				{/if}
			</Section>
		{/each}
	{/if}
</div>

<style>
	.root {
		padding: 12px 16px 32px;
		font-size: var(--font-ui-small, 13px);
		color: var(--gcd-text);
	}
	.rings {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		gap: 18px 26px;
		padding: 14px 16px;
		margin-bottom: 14px;
		border: 1px solid var(--gcd-border);
		border-radius: 8px;
		background: var(--gcd-surface);
	}
	.ring-note {
		flex: 1 1 160px;
		align-self: center;
		margin: 0;
		color: var(--gcd-muted);
		font-size: var(--font-ui-smaller, 12px);
	}
	.tiles {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(148px, 1fr));
		gap: 10px;
		margin-bottom: 22px;
	}
	.multiples {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: 14px;
	}
	.picker {
		display: block;
		margin-bottom: 8px;
	}
	.picker select {
		font-size: var(--font-ui-smaller, 12px);
		padding: 2px 6px;
	}
	.sr {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
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
