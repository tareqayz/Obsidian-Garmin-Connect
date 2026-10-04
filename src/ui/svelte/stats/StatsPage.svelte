<script lang="ts">
	import type { Route } from "../../../dashboard/routes";
	import { seriesDays, statsView, type StatsData, type StatsView } from "../../../dashboard/stats-pages";
	import type { DaySeries } from "../../../sync/intraday";
	import type { StatsHistoryProgress } from "../../../sync/runner";
	import HistoryBanner from "../activities/HistoryBanner.svelte";
	import MenuRow from "../activities/MenuRow.svelte";
	import PageBar from "../home/PageBar.svelte";
	import { lucide } from "../home/lucide";
	import BigRing from "./BigRing.svelte";
	import DayCard from "./DayCard.svelte";
	import Legend from "./Legend.svelte";
	import RangeControl from "./RangeControl.svelte";
	import StatGrid from "./StatGrid.svelte";
	import StatsPlot from "./StatsPlot.svelte";
	import TotalsToggle from "./TotalsToggle.svelte";

	/**
	 * Steps, Floors or Intensity Minutes, a day, a week, four weeks or a year
	 * at a time. The bar with the range and the period stays put while the
	 * rest scrolls, as in the app. A pane puts the chart on the left and the
	 * ring and figures beside it, and lays the days out three across.
	 */
	type StatsRoute = Extract<Route, { page: "stats" }>;

	interface Props {
		route: StatsRoute;
		data: StatsData;
		today: string;
		history: StatsHistoryProgress | null;
		canSync: boolean;
		onBack: () => void;
		go: (route: Route) => void;
		swap: (route: Route) => void;
		onSyncHistory: () => void;
		/** The series files for some days, read when a page needs them. */
		readSeries: (days: string[]) => Promise<Map<string, DaySeries | null>>;
	}

	let { route, data, today, history, canSync, onBack, go, swap, onSyncHistory, readSeries }: Props = $props();

	/* A day's chart and Intensity Minutes' week draw from series files, read
	   as the page asks for them and again after a sync changes the index. */
	let days = $derived(seriesDays(route, today, data.weekStart));
	let series = $state<Map<string, DaySeries | null>>(new Map());
	$effect(() => {
		const wanted = days;
		void data;
		let live = true;
		if (!wanted.length) series = new Map();
		else
			readSeries(wanted).then(
				(map) => {
					if (live) series = map;
				},
				() => {},
			);
		return () => {
			live = false;
		};
	});

	let view: StatsView = $derived(statsView({ data, route, today, series }));
	let layout = $derived(!view.ring ? "plain" : view.stat === "intensity" ? "week" : "day");

	/* Measured off the app, page by page: the gaps between the blocks. */
	const SPACING: Record<string, Record<string, number>> = {
		"steps-1d": { "ring-top": 19.7, "caption-gap": 11, "stats-top": 16.4, "chart-top": 21.3 },
		"steps-7d": { "chart-top": 23, "stats-top": 0, "link-top": 2.4, "list-top": 33.3 },
		"steps-4w": { "chart-top": 8.3, "stats-top": 0, "link-top": 2.3, "list-top": 33.3 },
		"steps-1y": { "chart-top": 35.4, "stats-top": 0, "link-top": 2.3, "list-top": 17.4 },
		"floors-1d": { "ring-top": 31.3, "caption-gap": 17, "stats-top": 10.4, "chart-top": 29.3 },
		"floors-7d": { "chart-top": 31.3, "stats-top": 17, "list-top": 21.3 },
		"floors-4w": { "chart-top": 31.3, "stats-top": 16, "list-top": 21.3 },
		"floors-1y": { "chart-top": 31.3, "stats-top": 16, "list-top": 21.3, "card-gap": 14.8 },
		"intensity-1d": { "chart-top": 16.3, "stats-top": 15.4 },
		"intensity-7d": { "ring-top": 7.3, "caption-gap": 18, "message-gap": 23.1, "chart-top": 30.6, "stats-top": 15.4, "list-top": 20.3 },
		"intensity-4w": { "chart-top": 16.3, "stats-top": 15.4, "list-top": 20.3 },
		"intensity-1y": { "chart-top": 16.3, "stats-top": 0, "list-top": 20.3, "card-gap": 16.4 },
	};
	const LOOK: Record<StatsView["stat"], Record<string, number>> = {
		steps: { "plot-indent": 11.3, "stat-gutter": 15, "stat-gap": 15.4, "stat-row-gap": 0 },
		floors: { "plot-indent": 7.3, "stat-gutter": 16, "stat-gap": 16, "stat-row-gap": 4 },
		intensity: { "plot-indent": 17.3, "stat-gutter": 15, "stat-gap": 15, "stat-row-gap": 7 },
	};
	let style = $derived(
		Object.entries({ ...LOOK[view.stat], ...SPACING[`${view.stat}-${view.range}`] })
			.map(([k, v]) => `--${k}: ${v}px`)
			.join("; "),
	);

	function set(change: Partial<StatsRoute>) {
		swap({ ...route, ...change });
	}

	/** A day in a list opens on its own page, and Back comes back to the list. */
	function openDay(day: string) {
		const offset = Math.round((Date.parse(`${day}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
		go({ page: "stats", stat: route.stat, range: "1d", offset: Math.min(0, offset), totals: route.totals });
	}

	let banner = $derived.by(() => {
		if (history) {
			const reached = history.reached
				? new Date(`${history.reached.slice(0, 7)}-15T12:00:00Z`).toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" })
				: null;
			return { title: "Fetching step, floor and intensity history…", detail: reached ? `Back to ${reached}` : "Starting…" };
		}
		return {
			title: "Step, floor and intensity history isn’t synced",
			detail: "Charts cover only what’s synced. A year of history takes about 40 requests.",
		};
	});
</script>

<div class="stats-page" {style}>
	<div class="sticky">
		<PageBar title={view.title} {onBack} />
		<div class="controls">
			<RangeControl value={view.range} onChange={(range) => set({ range, offset: 0 })} />
			<div class="period">
				<button class="step" aria-label="Previous period" disabled={!view.canGoBack} onclick={() => set({ offset: view.offset - 1 })}>
					<span use:lucide={"chevron-left"}></span>
				</button>
				<strong>{view.label}</strong>
				<button class="step" class:hidden={view.offset === 0} aria-label="Next period" disabled={view.offset === 0} onclick={() => set({ offset: view.offset + 1 })}>
					<span use:lucide={"chevron-right"}></span>
				</button>
			</div>
		</div>
	</div>

	<div class="body">
		{#if history || !data.complete}
			<div class="banner"><HistoryBanner title={banner.title} detail={banner.detail} busy={history !== null} {canSync} onSync={onSyncHistory} /></div>
		{/if}

		{#if view.stat === "steps" && view.range === "1y"}
			<div class="toggle"><TotalsToggle value={view.totals} onChange={(totals) => set({ totals, offset: 0 })} /></div>
		{/if}

		<div class="overview layout-{layout}">
			{#if view.ring}
				<div class="ring-block">
					<BigRing ring={view.ring} variant={view.stat === "steps" ? "steps" : view.stat === "floors" ? "floors" : "week"} />
					{#if view.ring.caption}<span class="caption">{view.ring.caption}</span>{/if}
					<!-- Not a <p>, nor class "message": Obsidian pads both. A week short of
					     its goal keeps the line, empty, so the chart stays put. -->
					{#if view.stat === "intensity"}<div class="goal-message">{view.message ?? ""}</div>{/if}
				</div>
			{/if}
			<div class="chart-block">
				<StatsPlot spec={view.chart} />
				{#if view.chart.legend}<Legend keys={view.chart.legend} />{/if}
			</div>
			<div class="stats-block">
				<StatGrid stats={view.stats} />
				{#if view.records}
					<div class="records"><MenuRow kind="link" label="View Personal Records" onclick={() => go({ page: "records", tab: "steps" })} /></div>
				{/if}
			</div>
		</div>

		{#if view.cards.length}
			<div class="cards">
				{#each view.cards as card (card.key)}
					{@const day = card.day}
					<DayCard {card} onclick={day ? () => openDay(day) : undefined} />
				{/each}
			</div>
		{/if}

		{#if view.rows.length}
			<div class="rows">
				{#each view.rows as row (row.key)}
					<div class="totals-row"><span class="label">{row.label}</span><span class="value">{row.value}</span></div>
				{/each}
			</div>
		{/if}
	</div>
</div>

<style>
	.sticky {
		position: sticky;
		top: 0;
		z-index: 2;
		background: var(--background-primary);
	}
	/* The pane's scroller has top padding that the header sticks below, so
	   without a cover the list scrolls through that strip above it. */
	.sticky::before {
		content: "";
		position: absolute;
		left: 0;
		right: 0;
		bottom: 100%;
		height: 48px;
		background: var(--background-primary);
	}
	button {
		font: inherit;
		color: inherit;
		margin: 0;
		height: auto;
		border: none;
		box-shadow: none;
		background: none;
		cursor: pointer;
	}
	.controls {
		display: flex;
		flex-direction: column;
		align-items: center;
		box-sizing: border-box;
		height: 121px;
		padding-top: 22.3px;
	}
	.period {
		display: grid;
		grid-template-columns: 20px minmax(0, 1fr) 20px;
		align-items: center;
		box-sizing: border-box;
		width: 100%;
		margin-top: 25.9px;
		padding: 0 16px;
	}
	.period strong {
		font-size: 17px;
		line-height: 22px;
		font-weight: 700;
		text-align: center;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.step {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 20px;
		height: 20px;
		padding: 0;
		border-radius: 50%;
		background: var(--background-modifier-border);
		color: var(--text-normal);
	}
	.step :global(svg) {
		width: 14px;
		height: 14px;
	}
	.step:disabled {
		opacity: 0.4;
		cursor: default;
	}
	.step.hidden {
		visibility: hidden;
	}

	.banner {
		padding: 12.3px 16px 0;
	}
	.toggle {
		display: flex;
		justify-content: center;
		margin-top: 7.3px;
		padding: 0 16px;
	}

	.overview {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
	}
	.layout-day {
		grid-template-areas: "ring" "stats" "chart";
	}
	.layout-week {
		grid-template-areas: "ring" "chart" "stats";
	}
	.layout-plain {
		grid-template-areas: "chart" "stats";
	}
	.ring-block {
		grid-area: ring;
		display: flex;
		flex-direction: column;
		align-items: center;
		margin-top: var(--ring-top, 16px);
	}
	.caption {
		margin-top: var(--caption-gap, 12px);
		font-size: 14px;
		line-height: 18px;
		color: var(--text-muted);
	}
	.goal-message {
		max-width: 370px;
		min-height: 22px;
		margin: var(--message-gap, 20px) 16px 0;
		font-size: 17px;
		line-height: 22px;
		text-align: center;
		color: var(--text-normal);
	}
	.chart-block {
		grid-area: chart;
		min-width: 0;
		margin-top: var(--chart-top, 16px);
	}
	.stats-block {
		grid-area: stats;
		min-width: 0;
		margin-top: var(--stats-top, 16px);
	}
	.records {
		margin-top: var(--link-top, 2px);
	}

	.cards {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--card-gap, 16px) 8px;
		margin-top: var(--list-top, 20px);
		padding: 0 16px 16px;
	}
	.rows {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		margin-top: var(--list-top, 17px);
		background: var(--background-secondary);
	}
	.totals-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		height: 54px;
		padding: 0 17px;
		background: var(--background-secondary);
		font-size: 15px;
		line-height: 20px;
	}
	.totals-row .label {
		color: var(--text-muted);
	}
	.totals-row .value {
		font-variant-numeric: tabular-nums;
	}

	@container (min-width: 640px) {
		/* Content-box: Obsidian makes everything border-box, which would take the padding out of the 1126. */
		.body {
			box-sizing: content-box;
			max-width: 1126px;
			margin: 0 auto;
			padding: 0 32px 32px;
		}
		.banner {
			padding: 16px 0 0;
		}
		.cards {
			grid-template-columns: repeat(2, minmax(0, 1fr));
			padding: 0;
		}
		.rows {
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: 8px;
			background: none;
		}
		.totals-row {
			border-radius: 8px;
		}
		.records :global(.row) {
			border-radius: 8px;
		}
	}

	@container (min-width: 1000px) {
		/* One row of controls: the range on the left, the period on the right. */
		.controls {
			flex-direction: row;
			justify-content: space-between;
			height: 72px;
			padding: 0 32px;
			border-bottom: 1px solid var(--background-modifier-border);
		}
		.period {
			display: flex;
			gap: 12px;
			width: auto;
			margin: 0;
			padding: 0;
		}
		.period .step.hidden {
			display: none;
		}
		.toggle {
			justify-content: flex-start;
			margin-top: 24px;
			padding: 0;
		}
		.overview {
			grid-template-columns: minmax(0, 1fr) 370px;
			column-gap: 8px;
			align-items: start;
			--plot-indent: 0px;
			--stat-gutter: 0px;
			--stat-gap: 14px;
		}
		.layout-day,
		.layout-week {
			grid-template-areas: "chart ring" "chart stats";
			grid-template-rows: auto 1fr;
		}
		.layout-plain {
			grid-template-areas: "chart stats";
		}
		.chart-block {
			margin-top: 32px;
		}
		.ring-block {
			margin-top: 23px;
		}
		.stats-block {
			margin-top: 16px;
		}
		.layout-plain .stats-block {
			margin-top: 23px;
		}
		.cards {
			grid-template-columns: repeat(3, minmax(0, 1fr));
			margin-top: 36px;
		}
		.rows {
			grid-template-columns: repeat(3, minmax(0, 1fr));
			margin-top: 36px;
		}
	}
</style>
