<script lang="ts">
	import type { Route } from "../../../dashboard/routes";
	import { LEVEL } from "../../../dashboard/sleep-charts";
	import { FACTOR_TITLE, factorView, type SleepData, type SleepFactorId } from "../../../dashboard/sleep-pages";
	import type { DaySeries } from "../../../sync/intraday";
	import PageBar from "../home/PageBar.svelte";
	import RangeBar from "./RangeBar.svelte";
	import SleepLegend, { type LegendEntry } from "./SleepLegend.svelte";
	import SleepStats from "./SleepStats.svelte";
	import StressChart from "./StressChart.svelte";
	import TimelineChart from "./TimelineChart.svelte";

	/**
	 * One sleep score factor for one night: the figures behind its verdict and
	 * the guidance the app gives. Garmin's articles and links are left out.
	 */
	type FactorRoute = Extract<Route, { page: "sleep-factor" }>;

	interface Props {
		route: FactorRoute;
		data: SleepData;
		onBack: () => void;
		readSeries: (days: string[]) => Promise<Map<string, DaySeries | null>>;
	}

	let { route, data, onBack, readSeries }: Props = $props();

	let series = $state<DaySeries | null | undefined>(undefined);
	$effect(() => {
		const day = route.date;
		let live = true;
		readSeries([day]).then(
			(map) => {
				if (live) series = map.get(day) ?? null;
			},
			() => {
				if (live) series = null;
			},
		);
		return () => {
			live = false;
		};
	});

	let detail = $derived(series?.sleep ?? null);
	let view = $derived(detail ? factorView(route.factor, detail, series?.sleepLevels ?? [], data.units) : null);

	const STAGE_LEGEND: Partial<Record<SleepFactorId, LegendEntry>> = {
		deep: { kind: "dot", label: "Deep Sleep", color: "var(--gcs-deep)" },
		light: { kind: "dot", label: "Light Sleep", color: "var(--gcs-light)" },
		rem: { kind: "dot", label: "REM Sleep", color: "var(--color-pink)" },
	};
	const STAGES: LegendEntry[] = [
		{ kind: "dot", label: "Deep", color: "var(--gcs-deep)" },
		{ kind: "dot", label: "Light", color: "var(--gcs-light)" },
		{ kind: "dot", label: "REM", color: "var(--color-pink)" },
		{ kind: "dot", label: "Awake", color: "var(--color-pink)", faded: true },
	];
	const AWAKE: LegendEntry[] = [
		{ kind: "dot", label: "Awake", color: "var(--color-pink)", faded: true },
		{ kind: "line", label: "Restless Moments" },
	];
	const STRESS: LegendEntry[] = [
		{ kind: "dot", label: "Rest", color: "var(--color-blue)" },
		{ kind: "dot", label: "Stress", color: "var(--color-orange)" },
		{ kind: "dot", label: "Active", color: "var(--text-faint)" },
		{ kind: "ring", label: "Unmeasurable" },
	];

	let awakeOverlay = $derived(view?.timeline?.overlays.find((o) => o.id === "awake") ?? null);
</script>

<div class="factor-page sleep-colors">
	<PageBar title={view?.title ?? FACTOR_TITLE[route.factor]} {onBack} />
	{#if view}
		<div class="body">
			<h3 class="about">{view.about}</h3>

			{#if view.total !== undefined}
				<div class="total-title">Your Total</div>
				<div class="total">{view.total}</div>
				{#if view.range}
					<div class="range"><RangeBar range={view.range} /></div>
					<div class="range-legend">
						<SleepLegend items={[STAGE_LEGEND[route.factor] ?? STAGES[0]!, { kind: "ring", label: "Optimal Range" }]} />
					</div>
				{/if}
			{/if}

			{#if view.chart === "stages" && view.timeline}
				<div class="chart"><TimelineChart timeline={view.timeline} overlay={null} look="stages" level={LEVEL.factor} /></div>
				<div class="legend"><SleepLegend items={STAGES} /></div>
			{:else if view.chart === "awake" && view.timeline}
				<div class="chart"><TimelineChart timeline={view.timeline} overlay={awakeOverlay} look="awake" level={LEVEL.factor} /></div>
				<div class="legend"><SleepLegend items={AWAKE} /></div>
			{:else if view.chart === "stress" && view.stress}
				<div class="chart stress"><StressChart points={view.stress.points} hours={view.stress.hours} startLabel={view.stress.startLabel} endLabel={view.stress.endLabel} /></div>
				<div class="legend stress-legend"><SleepLegend items={STRESS} /></div>
			{/if}

			<div class="stats"><SleepStats stats={view.stats} /></div>

			{#if route.factor === "awake" && view.guidance.length > 1}
				<div class="guidance">{view.guidance[0]}</div>
				<ul class="indicators">
					{#each view.guidance.slice(1, -1) as line}<li>{line}</li>{/each}
				</ul>
				<div class="guidance natural">{view.guidance.at(-1)}</div>
			{:else}
				{#each view.guidance as line}<div class="guidance">{line}</div>{/each}
			{/if}
		</div>
	{:else if series === null}
		<div class="none">No sleep details were synced for this night.</div>
	{/if}
</div>

<style>
	.sleep-colors {
		--gcs-deep: color-mix(in srgb, var(--color-blue) 80%, #000);
		--gcs-light: color-mix(in srgb, var(--color-blue) 60%, #fff);
	}
	.body {
		padding-bottom: 24px;
	}
	.about {
		margin: 15.2px 0 0;
		padding: 0 16px;
		font-size: 17px;
		line-height: 22px;
		font-weight: 700;
	}
	.total-title {
		margin-top: 18.3px;
		padding: 0 16px;
		font-size: 17px;
		line-height: 22px;
		font-weight: 700;
	}
	.total {
		padding: 0 16px;
		font-size: 16px;
		line-height: 21px;
	}
	.range {
		margin-top: 25.4px;
		display: flex;
		justify-content: center;
	}
	.range-legend {
		margin-top: 7.3px;
	}
	.chart {
		margin-top: 36.9px;
	}
	.chart.stress {
		margin-top: 22.1px;
	}
	.legend {
		margin-top: 13.8px;
	}
	.stress-legend {
		margin-top: 22.2px;
	}
	.stats {
		margin-top: 16.3px;
		padding: 0 16px;
	}
	.guidance {
		margin-top: 24.4px;
		padding: 0 16px;
		font-size: 13px;
		line-height: 15px;
	}
	.indicators {
		margin: 5.7px 0 0;
		padding: 0 16px 0 48.7px;
		font-size: 13px;
		line-height: 15px;
	}
	.indicators li + li {
		margin-top: 5.5px;
	}
	.indicators li::marker {
		color: var(--text-normal);
	}
	.guidance.natural {
		margin-top: 16px;
	}
	.none {
		padding: 48px 16px;
		text-align: center;
		color: var(--text-muted);
	}
	@container (min-width: 640px) {
		.body {
			max-width: 560px;
			margin: 0 auto;
		}
	}
</style>
