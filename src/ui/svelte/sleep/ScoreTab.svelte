<script lang="ts">
	import { LEVEL } from "../../../dashboard/sleep-charts";
	import type { OverlayId, SleepDayView, SleepFactorId } from "../../../dashboard/sleep-pages";
	import Segmented from "./Segmented.svelte";
	import SleepCard from "./SleepCard.svelte";
	import SleepChips from "./SleepChips.svelte";
	import SleepLegend, { type LegendEntry } from "./SleepLegend.svelte";
	import SleepStats from "./SleepStats.svelte";
	import StagesRing from "./StagesRing.svelte";
	import TimelineChart from "./TimelineChart.svelte";

	/**
	 * A night's Sleep Score: the score and its verdicts, the factors that made
	 * it, the night drawn as a timeline or a ring of stages, and the night's
	 * metrics. A pane puts the summary beside the chart.
	 */
	interface Props {
		view: SleepDayView;
		openFactor: (factor: SleepFactorId) => void;
	}

	let { view, openFactor }: Props = $props();

	let factorsOpen = $state(true);
	let chart = $state(0);
	let picked = $state<OverlayId | null>(null);

	let overlays = $derived(view.timeline?.overlays ?? []);
	/* Awake/Restlessness until another chip is picked, as the app opens. */
	let overlay = $derived(overlays.find((o) => o.id === picked) ?? overlays.find((o) => o.id === "awake") ?? overlays[0] ?? null);
	let look = $derived<"stages" | "awake" | "line">(!overlay ? "stages" : overlay.kind === "awake" ? "awake" : "line");
	let legend = $derived<LegendEntry[]>(
		!overlay
			? [
					{ kind: "dot", label: "Deep", color: "var(--gcs-deep)" },
					{ kind: "dot", label: "Light", color: "var(--gcs-light)" },
					{ kind: "dot", label: "REM", color: "var(--color-pink)" },
					{ kind: "dot", label: "Awake", color: "var(--color-pink)", faded: true },
				]
			: overlay.kind === "awake"
				? [
						{ kind: "dot", label: "Awake", color: "var(--color-pink)", faded: true },
						{ kind: "line", label: "Restless Moments" },
					]
				: [{ kind: "line", label: overlay.legend }],
	);
	let showTimeline = $derived(Boolean(view.timeline) && (chart === 0 || !view.stages));
</script>

<div class="score-tab">
	<section class="summary">
		<div class="score-block">
			<span class="score">{view.score ?? "--"}</span>
			<span class="of">100</span>
			<span class="score-label">Score</span>
		</div>
		<div class="pad stats"><SleepStats stats={view.stats} /></div>
		{#if view.insight}
			<div class="pad insight">
				{#if view.insight.title}<div class="insight-title">{view.insight.title}</div>{/if}
				{#each view.insight.lines as line}<div class="insight-line">{line}</div>{/each}
			</div>
		{/if}
	</section>

	{#if view.factors.length}
		<section class="factors">
			<button class="collapse" aria-expanded={factorsOpen} onclick={() => (factorsOpen = !factorsOpen)}>
				<span>Sleep Score Factors</span>
				<svg class="chev" class:closed={!factorsOpen} width="17" height="9" viewBox="0 0 17 9" aria-hidden="true"><path d="M1 8 L8.5 1 L16 8" /></svg>
			</button>
			{#if factorsOpen}
				<div class="cards">
					{#each view.factors as f (f.id)}
						<SleepCard title={f.title} detail={f.detail} rating={f.rating} onclick={() => openFactor(f.id)} />
					{/each}
				</div>
			{/if}
		</section>
	{/if}

	{#if view.timeline || view.stages}
		<section class="chart" class:stages-on={!showTimeline}>
			{#if view.timeline && view.stages}
				<div class="pad toggle"><Segmented options={["Timeline", "Stages"]} value={chart} onChange={(i) => (chart = i)} /></div>
			{/if}
			{#if showTimeline && view.timeline}
				<div class="timeline"><TimelineChart timeline={view.timeline} {overlay} {look} level={LEVEL.score} /></div>
				<div class="legend"><SleepLegend items={legend} /></div>
				{#if overlays.length}
					<div class="chips">
						<SleepChips chips={overlays.map((o) => ({ id: o.id, label: o.chip }))} selected={overlay?.id ?? null} onSelect={(id) => (picked = id as OverlayId)} />
					</div>
				{/if}
			{:else if view.stages}
				<div class="ring"><StagesRing stages={view.stages} /></div>
				<div class="pad stage-stats"><SleepStats stats={view.stages.stats} /></div>
			{/if}
		</section>
	{/if}

	<section class="metrics">
		<h3 class="pad metrics-title">Sleep Metrics</h3>
		<div class="pad metric-grid"><SleepStats stats={view.metrics} /></div>
	</section>
</div>

<style>
	.score-tab {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		grid-template-areas: "summary" "factors" "chart" "metrics";
	}
	.pad {
		padding: 0 16px;
	}
	button {
		font: inherit;
		color: inherit;
		margin: 0;
		height: auto;
		border: none;
		border-radius: 0;
		box-shadow: none;
		background: none;
		cursor: pointer;
	}
	.summary {
		grid-area: summary;
		min-width: 0;
	}
	.score-block {
		display: flex;
		flex-direction: column;
		align-items: center;
		margin-top: 17.5px;
	}
	.score {
		font-size: 35px;
		line-height: 42px;
	}
	.of {
		margin-top: 1px;
		font-size: 14px;
		line-height: 18px;
	}
	.score-label {
		margin-top: 7.2px;
		font-size: 16px;
		line-height: 21px;
		color: var(--text-muted);
	}
	.stats {
		margin-top: 24.3px;
	}
	.insight {
		margin-top: 23.3px;
	}
	.insight-title {
		margin-bottom: 15.5px;
		font-size: 18px;
		line-height: 22px;
		font-weight: 500;
	}
	.insight-line {
		font-size: 16px;
		line-height: 22px;
	}
	.insight-line + .insight-line {
		margin-top: 14px;
	}

	.factors {
		grid-area: factors;
		margin-top: 15.6px;
	}
	.collapse {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		height: 56px;
		padding: 0 16px;
		background: var(--background-secondary);
		font-size: 17px;
		line-height: 22px;
		text-align: left;
	}
	.chev {
		display: block;
		flex: none;
	}
	.chev path {
		fill: none;
		stroke: var(--text-muted);
		stroke-width: 2;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.chev.closed {
		transform: rotate(180deg);
	}
	.cards {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 8.3px 8px;
		margin-top: 28.6px;
		padding: 0 16px;
	}

	.chart {
		grid-area: chart;
		min-width: 0;
		margin-top: 33.3px;
	}
	.toggle {
		display: flex;
	}
	.timeline {
		margin-top: 85.7px;
	}
	.toggle + .ring,
	.chart > .ring:first-child {
		margin-top: 54.7px;
	}
	.legend {
		margin-top: 13.8px;
	}
	.chips {
		margin-top: 33px;
	}
	.ring {
		display: flex;
		justify-content: center;
	}
	.stage-stats {
		margin-top: 36.3px;
	}

	.metrics {
		grid-area: metrics;
		margin-top: 32.4px;
	}
	.stages-on ~ .metrics {
		margin-top: 1px;
	}
	.metrics {
		padding-bottom: 16.4px;
		border-top: 16px solid var(--background-secondary);
	}
	.metrics-title {
		margin: 23.2px 0 0;
		font-size: 18px;
		line-height: 22px;
		font-weight: 700;
	}
	.metric-grid {
		margin-top: 29.4px;
	}

	@container (min-width: 640px) {
		.cards {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
		.metric-grid {
			--sleep-stat-columns: 3;
		}
	}

	/* Measured off the 1190pt Figma pane: the summary in a 370pt column, the
	   chart beside it, the factors three across and the metrics six. */
	@container (min-width: 1000px) {
		.score-tab {
			grid-template-columns: 370px minmax(0, 1fr);
			grid-template-areas: "summary chart" "factors factors" "metrics metrics";
			column-gap: 8px;
			max-width: 1126px;
			box-sizing: content-box;
			margin: 0 auto;
			padding: 0 32px;
		}
		.pad {
			padding: 0;
		}
		.score-block {
			margin-top: 31.5px;
		}
		.chart {
			margin-top: 24px;
		}
		.timeline {
			margin-top: 18px;
		}
		.chips {
			margin-top: 30px;
		}
		.factors,
		.metrics {
			margin-left: -32px;
			margin-right: -32px;
		}
		.factors {
			margin-top: 40px;
		}
		.collapse {
			padding: 0 24px 0 16px;
		}
		.cards {
			grid-template-columns: repeat(3, minmax(0, 1fr));
			margin-top: 16px;
			padding: 0 32px;
		}
		.metrics {
			margin-top: 24px;
			padding: 0 32px 16px;
		}
		.metric-grid {
			--sleep-stat-columns: 6;
			--sleep-stat-gap: 13px;
		}
	}
</style>
