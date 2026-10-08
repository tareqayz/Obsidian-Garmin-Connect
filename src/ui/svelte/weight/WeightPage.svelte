<script lang="ts">
	import { dayCardRoute, type PeriodRoute } from "../../../dashboard/periods";
	import { weightDayView, weightPeriodView, type WeightFigure, type WeightPageData, type WeightSeries } from "../../../dashboard/weight-pages";
	import type { DayIndexMeta } from "../../../sync/day-index";
	import { WEIGHT_INDEX, type WeightRow } from "../../../sync/weight-index";
	import { lucide } from "../home/lucide";
	import type { HealthStatPageProps } from "../health/pages";
	import StatCardList from "../health/StatCardList.svelte";
	import StatFigures from "../health/StatFigures.svelte";
	import StatPageShell from "../health/StatPageShell.svelte";
	import WeightChart from "./WeightChart.svelte";

	/**
	 * Garmin Connect's Weight page in the shared shell: a day's weigh-ins under
	 * its mean, or a span's chart (Weight or BMI) with its figures and a card
	 * per day with a weigh-in (7d, 4w) or per week (1y). A card switches the
	 * page in place.
	 */
	let { route, today, units, canSync, onBack, swap, readIndex, onSyncHistory, versions, history }: HealthStatPageProps = $props();

	const KIND = WEIGHT_INDEX.kind;

	let rows = $state<WeightRow[]>([]);
	let meta = $state<DayIndexMeta | null>(null);
	$effect(() => {
		void versions[KIND];
		let live = true;
		readIndex<WeightRow>(KIND).then(
			(index) => {
				if (!live) return;
				rows = index.rows;
				meta = index.meta;
			},
			() => {},
		);
		return () => {
			live = false;
		};
	});

	let series = $state<WeightSeries>("weight");
	let pageRoute: PeriodRoute = $derived(route.date ? { range: route.range, offset: route.offset, date: route.date } : { range: route.range, offset: route.offset });
	let data: WeightPageData = $derived({ rows, complete: meta?.complete ?? false });
	let dayView = $derived(pageRoute.range === "1d" ? weightDayView({ data, route: pageRoute, today, units }) : null);
	let periodView = $derived(pageRoute.range === "1d" ? null : weightPeriodView({ data, route: pageRoute, today, units, series }));

	const figure = (f: WeightFigure) => ({ value: f.unit ? `${f.value} ${f.unit}` : f.value, label: f.label });
</script>

<StatPageShell
	{route}
	{today}
	label={dayView?.label ?? periodView?.label ?? ""}
	canGoBack={dayView?.canGoBack ?? periodView?.canGoBack ?? false}
	{onBack}
	{swap}
	history={{ title: WEIGHT_INDEX.title, windowDays: WEIGHT_INDEX.windowDays, complete: meta?.complete ?? false, walking: history[KIND], canSync, onSync: () => onSyncHistory(KIND) }}
>
	{#snippet children({ pane, move })}
		<div class="weight">
			{#if dayView}
				<div class="day">
					<div class="hero">
						<span class="glyph" use:lucide={"weight"}></span>
						<span class="figure">{dayView.hero}{#if dayView.hero !== "--"}<small>{dayView.unit}</small>{/if}</span>
					</div>
					<div class="weigh-ins">
						{#if !dayView.weighIns.length}
							<p class="none">No data available.</p>
						{/if}
						{#each dayView.weighIns as w, i (i)}
							<section class="weigh-in">
								<h3>{w.time}</h3>
								<dl>
									<dt>Weight</dt><dd>{w.weight}</dd>
									<dt>BMI</dt><dd>{w.bmi}</dd>
								</dl>
							</section>
						{/each}
					</div>
				</div>
			{:else if periodView}
				<div class="overview">
					<div class="chart">
						<WeightChart view={periodView} {pane} />
						<div class="pills">
							<button class="pill" class:on={series === "weight"} aria-pressed={series === "weight"} onclick={() => (series = "weight")}>Weight</button>
							<button class="pill" class:on={series === "bmi"} aria-pressed={series === "bmi"} onclick={() => (series = "bmi")}>BMI</button>
						</div>
					</div>
					<div class="figures">
						<h3 class="averages">Averages</h3>
						<StatFigures figures={periodView.figures.map(figure)} />
					</div>
				</div>
				{#if periodView.cards.length}
					<StatCardList items={periodView.cards.map((c) => ({ ...c, onclick: () => move(c.kind === "day" ? dayCardRoute(c.key, today) : c.target) }))}>
						{#snippet visual(card)}<span class="change">{card.change}</span>{/snippet}
					</StatCardList>
				{/if}
			{/if}
		</div>
	{/snippet}
</StatPageShell>

<style>
	/* The twin's weight/* aliases. */
	.weight {
		--weight-line: var(--color-blue);
		--weight-bmi: var(--color-yellow);
		--weight-high-low: var(--background-modifier-border-hover);
	}
	.hero {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		padding-top: 62px;
	}
	.glyph {
		color: var(--color-blue);
	}
	.glyph :global(svg) {
		width: 28px;
		height: 28px;
	}
	.figure {
		font-size: 40px;
		line-height: 48px;
		font-variant-numeric: tabular-nums;
	}
	.figure small {
		margin-left: 4px;
		font-size: 17px;
	}
	.weigh-ins {
		padding: 120px 16px 16px;
	}
	.none {
		margin: 0;
		text-align: center;
		color: var(--text-muted);
		font-size: 13px;
	}
	.weigh-in h3 {
		margin: 0 0 12px;
		font-size: 16px;
		line-height: 21px;
		font-weight: 600;
	}
	.weigh-in + .weigh-in {
		margin-top: 24px;
	}
	dl {
		display: grid;
		grid-template-columns: 196px 1fr;
		row-gap: 18px;
		margin: 0;
		font-size: 16px;
		line-height: 21px;
	}
	dt {
		color: var(--text-muted);
	}
	dd {
		margin: 0;
	}
	.overview {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
	}
	.chart {
		min-width: 0;
	}
	.pills {
		display: flex;
		gap: 8px;
		padding: 16px 16px 0;
	}
	.pill {
		height: 36px;
		margin: 0;
		padding: 0 14px;
		border: 1px solid var(--background-modifier-border);
		border-radius: 18px;
		box-shadow: none;
		background: transparent;
		color: var(--text-normal);
		font: inherit;
		font-size: 16px;
		cursor: pointer;
	}
	.pill.on {
		border-color: var(--interactive-accent);
		background: var(--interactive-accent);
		color: var(--text-on-accent);
	}
	.figures {
		min-width: 0;
		padding: 40px 16px 0;
	}
	.averages {
		margin: 0 0 8px;
		font-size: 18px;
		line-height: 22px;
		font-weight: 600;
	}
	.change {
		position: absolute;
		right: 16px;
		bottom: 12px;
		font-size: 12px;
		color: var(--text-muted);
	}
	.weight :global(.stat-card) {
		position: relative;
	}
	.weight :global(.stat-card.week .value) {
		align-self: flex-start;
		font-size: 14px;
	}

	@container (min-width: 1000px) {
		.day {
			display: grid;
			grid-template-columns: minmax(0, 1fr) 370px;
			column-gap: 8px;
		}
		.weigh-ins {
			padding: 62px 0 16px;
		}
		.overview {
			grid-template-columns: minmax(0, 1fr) 370px;
			column-gap: 8px;
			align-items: start;
			--stat-figure-gap: 16px;
		}
		.pills {
			padding-left: 0;
		}
		.figures {
			padding: 32px 0 0;
		}
	}
</style>
