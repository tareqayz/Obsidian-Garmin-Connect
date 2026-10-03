<script lang="ts">
	import { Menu } from "obsidian";
	import { METRIC_TITLE, categoryView, type ActivitiesData, type MetricId, type RangeId } from "../../../dashboard/activities";
	import type { Route } from "../../../dashboard/routes";
	import type { HistoryProgress } from "../../../sync/runner";
	import PageBar from "../home/PageBar.svelte";
	import { lucide } from "../home/lucide";
	import GroupBand from "./GroupBand.svelte";
	import HistoryBanner from "./HistoryBanner.svelte";
	import ListCard from "./ListCard.svelte";
	import MenuRow from "./MenuRow.svelte";
	import SummaryStats from "./SummaryStats.svelte";
	import TotalsChart from "./TotalsChart.svelte";

	/**
	 * One sport's page: Running, Cycling, Gym & Fitness Equipment… The header,
	 * from the title down to the metric tabs, stays put while the rest scrolls,
	 * as it does in the app. A pane lays the controls out in one row and puts
	 * the stats beside the chart.
	 */
	type CategoryRoute = Extract<Route, { page: "category" }>;

	interface Props {
		route: CategoryRoute;
		data: ActivitiesData;
		today: string;
		history: HistoryProgress | null;
		canSync: boolean;
		onBack: () => void;
		/** Opens a page on top of this one. */
		go: (route: Route) => void;
		/** Changes this page's filters without adding a step to Back. */
		swap: (route: Route) => void;
		onSyncHistory: () => void;
	}

	let { route, data, today, history, canSync, onBack, go, swap, onSyncHistory }: Props = $props();

	let view = $derived(
		categoryView({
			rows: data.rows,
			category: route.category,
			sub: route.sub,
			range: route.range,
			offset: route.offset,
			metric: route.metric,
			today,
			units: data.units,
		}),
	);

	const RANGES: RangeId[] = ["7d", "4w", "1y"];

	function set(change: Partial<CategoryRoute>) {
		swap({ ...route, ...change });
	}

	/** Obsidian's own menu: a dropdown on a desktop, a sheet from the bottom on a phone. */
	function pick(e: MouseEvent) {
		const menu = new Menu();
		menu.addItem((item) => item.setTitle(view.category.title).setIsLabel(true));
		for (const option of view.options) {
			menu.addItem((item) =>
				item
					.setTitle(option.label)
					.setChecked(option.typeId === view.sub)
					.onClick(() => set({ sub: option.typeId, offset: 0 })),
			);
		}
		menu.showAtMouseEvent(e);
	}
</script>

<div class="category">
	<div class="sticky">
		<PageBar title={view.category.title} {onBack} backLabel="Back to Activities" />
		<div class="filters">
			<button class="sub-type" onclick={pick}>
				<span>{view.title}</span>
				<span class="updown" use:lucide={"chevrons-up-down"}></span>
			</button>
			<div class="range">
				{#each RANGES as range (range)}
					<button class:on={range === view.period.range} aria-pressed={range === view.period.range} onclick={() => set({ range, offset: 0 })}>{range}</button>
				{/each}
			</div>
			<div class="period">
				<button class="step" aria-label="Previous period" disabled={!view.canGoBack} onclick={() => set({ offset: view.period.offset - 1 })}>
					<span use:lucide={"chevron-left"}></span>
				</button>
				<strong>{view.period.label}</strong>
				<button class="step" class:hidden={view.period.offset === 0} aria-label="Next period" disabled={view.period.offset === 0} onclick={() => set({ offset: view.period.offset + 1 })}>
					<span use:lucide={"chevron-right"}></span>
				</button>
			</div>
		</div>
		<div class="metrics">
			{#each view.category.metrics as metric (metric)}
				<button class:on={metric === view.metric} aria-pressed={metric === view.metric} onclick={() => set({ metric: metric as MetricId })}>{METRIC_TITLE[metric]}</button>
			{/each}
		</div>
	</div>

	<div class="body">
		{#if history || !data.complete}
			<div class="banner"><HistoryBanner progress={history} total={data.total} {canSync} onSync={onSyncHistory} /></div>
		{/if}

		<div class="overview">
			<div class="chart"><TotalsChart title="{METRIC_TITLE[view.metric]} Totals" chart={view.chart} /></div>
			<div class="side">
				<SummaryStats stats={view.stats} />
				{#if view.category.records}
					{@const tab = view.category.records}
					<div class="records"><MenuRow kind="link" label="View Personal Records" onclick={() => go({ page: "records", tab })} /></div>
				{/if}
			</div>
		</div>

		<section class="list">
			<GroupBand label={view.listTitle} />
			<div class="grid">
				{#each view.activities as item (item.id)}
					<ListCard title={item.name} detail={item.when} value={item.value} />
				{/each}
				{#each view.months as month (month.month)}
					<ListCard
						title={month.title}
						detail={month.count}
						value={month.value}
						muted
						onclick={() => go({ page: "month", category: route.category, sub: view.sub, month: month.month, metric: view.metric })}
					/>
				{/each}
			</div>
			{#if !view.activities.length && !view.months.length}
				<p class="empty">No activities in this period.</p>
			{/if}
		</section>
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
	.filters {
		display: flex;
		flex-direction: column;
	}
	.sub-type {
		align-self: flex-start;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		margin: 6.3px 0 0 27px;
		padding: 0;
		font-size: 22px;
		line-height: 28px;
		font-weight: 700;
		color: var(--text-normal);
	}
	.updown {
		display: inline-flex;
		color: var(--text-muted);
	}
	.updown :global(svg) {
		width: 16px;
		height: 16px;
	}
	.range {
		align-self: center;
		display: flex;
		align-items: center;
		justify-content: space-between;
		box-sizing: border-box;
		width: 255px;
		height: 34px;
		margin-top: 26.4px;
		padding: 0 31px 0 29px;
		border-radius: 4px;
		background: var(--background-modifier-border);
	}
	.range button {
		padding: 7px 0;
		font-size: 15px;
		line-height: 20px;
		color: var(--text-muted);
	}
	.range button.on {
		font-weight: 600;
		color: var(--text-normal);
	}
	.period {
		display: grid;
		grid-template-columns: 20px minmax(0, 1fr) 20px;
		align-items: center;
		margin: 25.2px 16px 0;
	}
	.period strong {
		font-size: 17px;
		line-height: 22px;
		text-align: center;
		white-space: nowrap;
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
	.metrics {
		display: flex;
		margin-top: 24.8px;
		padding: 0 0 0 8px;
		border-top: 1px solid var(--background-modifier-border);
		border-bottom: 1px solid var(--background-modifier-border);
		overflow-x: auto;
		scrollbar-width: none;
	}
	.metrics::-webkit-scrollbar {
		display: none;
	}
	.metrics button {
		position: relative;
		flex: none;
		height: 58px;
		padding: 0 15px 0 25px;
		font-size: 16px;
		line-height: 20px;
		color: var(--text-muted);
	}
	.metrics button.on {
		font-weight: 600;
		color: var(--text-normal);
	}
	.metrics button.on::after {
		content: "";
		position: absolute;
		left: 25px;
		right: 15px;
		bottom: 0;
		height: 1px;
		background: var(--text-normal);
	}

	.banner {
		padding: 12.3px 16px 12px;
	}
	.overview {
		display: flex;
		flex-direction: column;
	}
	.side {
		display: flex;
		flex-direction: column;
		margin-top: 12.3px;
	}
	.records {
		margin-top: 1px;
	}
	.list {
		padding: 25px 8px 8px;
	}
	.grid {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 16px 8px;
		margin-top: 16px;
	}
	.empty {
		margin: 0;
		padding: 0 9px;
		font-size: 15px;
		line-height: 20px;
		color: var(--text-muted);
	}

	/* The phone's tab strip is 390pt wide; a narrower pane tightens the tabs. */
	@container (max-width: 400px) {
		.metrics button {
			padding: 0 11px 0 19px;
		}
		.metrics button.on::after {
			left: 19px;
			right: 11px;
		}
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
			padding: 16px 0 4px;
		}
		.chart {
			margin-left: -16px;
		}
		.records {
			margin-top: 12px;
		}
		.records :global(.row) {
			border-radius: 8px;
		}
		.list {
			padding: 25px 0 0;
		}
		.grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	@container (min-width: 1000px) {
		/* One row of controls: the sport, the range in the middle, the period. */
		.filters {
			display: grid;
			grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
			align-items: center;
			height: 72px;
			padding: 0 32px;
		}
		.sub-type {
			margin: 0;
			justify-self: start;
		}
		.range {
			margin: 0;
		}
		.period {
			justify-self: end;
			display: flex;
			gap: 12px;
			margin: 0;
		}
		.period .step.hidden {
			display: none;
		}
		.metrics {
			margin-top: 0;
			padding-left: 7px;
		}
		.overview {
			display: grid;
			grid-template-columns: minmax(0, 1fr) 370px;
			column-gap: 14px;
		}
		.side {
			margin-top: 0;
			padding-top: 40px;
		}
		.list {
			padding-top: 5px;
		}
		.grid {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}
</style>
