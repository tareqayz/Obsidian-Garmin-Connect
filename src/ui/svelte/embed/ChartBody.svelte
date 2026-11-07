<script lang="ts">
	import { LEVEL } from "../../../dashboard/sleep-charts";
	import type { ChartModel } from "../../../embeds/chart-models";
	import { BATTERY_COLORS } from "../body-battery/colors";
	import DailyValues from "../body-battery/DailyValues.svelte";
	import BatteryTimeline from "../body-battery/Timeline.svelte";
	import HeartRateColors from "../heart-rate/HeartRateColors.svelte";
	import HeartRateCurve from "../heart-rate/HeartRateCurve.svelte";
	import HeartRateReadings from "../heart-rate/HeartRateReadings.svelte";
	import HrvAveragesChart from "../hrv-status/HrvAveragesChart.svelte";
	import HrvTimeline from "../hrv-status/HrvTimeline.svelte";
	import { SPO2_COLORS } from "../pulse-ox/colors";
	import Spo2DayChart from "../pulse-ox/DayChart.svelte";
	import Spo2PeriodChart from "../pulse-ox/PeriodChart.svelte";
	import { RESPIRATION_COLORS } from "../respiration/colors";
	import RespirationAverages from "../respiration/RespirationAverages.svelte";
	import RespirationTimeline from "../respiration/RespirationTimeline.svelte";
	import ScoreChart from "../sleep/ScoreChart.svelte";
	import SleepLegend, { type LegendEntry } from "../sleep/SleepLegend.svelte";
	import TimelineChart from "../sleep/TimelineChart.svelte";
	import Legend from "../stats/Legend.svelte";
	import StatsPlot from "../stats/StatsPlot.svelte";
	import { STRESS_COLORS } from "../stress/colors";
	import StressLineChart from "../stress/StressLineChart.svelte";
	import StressTimeline from "../stress/StressTimeline.svelte";
	import { WEIGHT_COLORS } from "../weight/colors";
	import WeightChart from "../weight/WeightChart.svelte";

	/**
	 * A stat page's chart as its page draws it, with the colours its page sets
	 * around it: the same components, fed the page's own view. What a page
	 * puts around a chart to change it (chips, toggles, the list under it)
	 * stays on the page.
	 */
	let { chart, pane }: { chart: ChartModel; pane: boolean } = $props();

	/** Sleep's stages, as the Score tab keys them with no chip picked. */
	const STAGES: LegendEntry[] = [
		{ kind: "dot", label: "Deep", color: "var(--gcs-deep)" },
		{ kind: "dot", label: "Light", color: "var(--gcs-light)" },
		{ kind: "dot", label: "REM", color: "var(--color-pink)" },
		{ kind: "dot", label: "Awake", color: "var(--color-pink)", faded: true },
	];
</script>

{#if chart.chart === "sleep-day" && chart.view.timeline}
	<div class="sleep">
		<TimelineChart timeline={chart.view.timeline} overlay={null} look="stages" level={LEVEL.score} />
		<div class="legend"><SleepLegend items={STAGES} /></div>
	</div>
{:else if chart.chart === "sleep-period"}
	<div class="sleep">
		<ScoreChart view={chart.view} overlay={null} />
		<div class="legend"><SleepLegend items={[{ kind: chart.view.score.dots ? "dot" : "line", label: "Score", color: "var(--color-purple)" }]} /></div>
	</div>
{:else if chart.chart === "stats"}
	<StatsPlot spec={chart.view.chart} />
	{#if chart.view.chart.legend}<Legend keys={chart.view.chart.legend} />{/if}
{:else if chart.chart === "stress-day"}
	<div style={STRESS_COLORS}><StressTimeline timeline={chart.view.timeline} {pane} /></div>
{:else if chart.chart === "stress-period"}
	<div style={STRESS_COLORS}><StressLineChart view={chart.view} {pane} /></div>
{:else if chart.chart === "battery-day"}
	<div style={BATTERY_COLORS}><BatteryTimeline timeline={chart.view.timeline} {pane} chips={false} /></div>
{:else if chart.chart === "battery-period"}
	<div style={BATTERY_COLORS}><DailyValues view={chart.view} {pane} /></div>
{:else if chart.chart === "heart-day"}
	<HeartRateColors><HeartRateCurve timeline={chart.view.timeline} {pane} today={chart.today} /></HeartRateColors>
{:else if chart.chart === "heart-period"}
	<HeartRateColors><HeartRateReadings view={chart.view} {pane} /></HeartRateColors>
{:else if chart.chart === "respiration-day"}
	<div style={RESPIRATION_COLORS}><RespirationTimeline timeline={chart.view.timeline} {pane} highLow={true} /></div>
{:else if chart.chart === "respiration-period"}
	<div style={RESPIRATION_COLORS}><RespirationAverages view={chart.view} {pane} /></div>
{:else if chart.chart === "spo2-day"}
	<div style={SPO2_COLORS}><Spo2DayChart view={chart.view} {pane} /></div>
{:else if chart.chart === "spo2-period"}
	<div style={SPO2_COLORS}><Spo2PeriodChart view={chart.view} {pane} /></div>
{:else if chart.chart === "hrv-day" && chart.view.timeline}
	<HrvTimeline timeline={chart.view.timeline} {pane} />
{:else if chart.chart === "hrv-period"}
	<HrvAveragesChart chart={chart.view.chart} range={chart.view.range} {pane} rows={1} />
{:else if chart.chart === "weight-day"}
	<!-- A day has no chart on its page: its weigh-ins, as the page lists them. -->
	<dl class="weigh-ins">
		{#each chart.view.weighIns as w, i (i)}
			<div class="weigh-in">
				<dt>{w.time}</dt>
				<dd>{w.weight}</dd>
				<dd class="bmi">BMI {w.bmi}</dd>
			</div>
		{/each}
	</dl>
{:else if chart.chart === "weight-period"}
	<!-- The page's chart sits under a band its header fills; a card has no header. -->
	<div class="weight" style={WEIGHT_COLORS}><WeightChart view={chart.view} {pane} /></div>
{/if}

<style>
	/* The Sleep page's stage colours (SleepPage.svelte), which its charts and key read. */
	.sleep {
		--gcs-deep: color-mix(in srgb, var(--color-blue) 80%, #000);
		--gcs-light: color-mix(in srgb, var(--color-blue) 60%, #fff);
	}
	.legend {
		margin-top: 8px;
	}
	.weight {
		margin-top: -44px;
	}
	.weigh-ins {
		margin: 0;
	}
	.weigh-in {
		display: grid;
		grid-template-columns: 1fr auto auto;
		gap: 16px;
		align-items: baseline;
		padding: 10px 0;
		border-top: 1px solid var(--background-modifier-border);
		font-size: 15px;
		line-height: 20px;
	}
	.weigh-in:first-child {
		border-top: none;
		padding-top: 0;
	}
	dt {
		color: var(--text-muted);
	}
	dd {
		margin: 0;
		font-variant-numeric: tabular-nums;
	}
	.bmi {
		min-width: 72px;
		text-align: right;
		color: var(--text-muted);
	}
</style>
