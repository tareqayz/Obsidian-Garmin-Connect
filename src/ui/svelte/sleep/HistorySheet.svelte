<script lang="ts">
	import type { HistoryView, SleepPeriodView } from "../../../dashboard/sleep-pages";
	import DurationChart from "./DurationChart.svelte";
	import SleepLegend from "./SleepLegend.svelte";
	import SleepStats from "./SleepStats.svelte";

	/**
	 * The Sleep History sheet: what recent sleep did to the night's need, and
	 * the week's duration against need behind it. It draws its own header, the
	 * Figma sheet's band and round close button, in place of the modal's.
	 */
	let { view, onClose }: { view: HistoryView; onClose: () => void } = $props();

	/* The duration chart draws from a period view; the sheet only has the week's duration. */
	let period = $derived({ range: "7d", duration: view.bars } as unknown as SleepPeriodView);
</script>

<div class="history-sheet sleep-colors">
	<header class="sheet-header">
		<h2>Sleep History</h2>
		<button class="close" aria-label="Close" onclick={onClose}>
			<svg width="8" height="8" viewBox="0 0 8 8" aria-hidden="true"><path d="M1 1 L7 7 M7 1 L1 7" /></svg>
		</button>
	</header>
	<div class="body">
		<div class="feedback">{view.message}</div>
		<h3 class="chart-title">Sleep Duration vs. Sleep Need</h3>
		<div class="subtitle">Daily Totals • 7d</div>
		<div class="chart"><DurationChart view={period} /></div>
		<div class="legend">
			<SleepLegend
				items={[
					{ kind: "dot", label: "Sleep Duration", color: "var(--color-blue)" },
					{ kind: "dot", label: "Sleep Need", color: "var(--background-modifier-border)" },
					{ kind: "dot", label: "Sleep Need Met", color: "var(--color-green)" },
				]}
			/>
		</div>
		<div class="stats"><SleepStats stats={view.bars.stats} /></div>
	</div>
</div>

<style>
	.sleep-colors {
		--gcs-deep: color-mix(in srgb, var(--color-blue) 80%, #000);
		--gcs-light: color-mix(in srgb, var(--color-blue) 60%, #fff);
	}
	.history-sheet {
		container-type: inline-size;
		color: var(--text-normal);
	}
	.sheet-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		height: 54px;
		padding: 0 14px 0 16px;
		background: var(--background-secondary);
	}
	h2 {
		margin: 0;
		font-size: 20px;
		line-height: 24px;
		font-weight: 700;
	}
	.close {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		margin: 0;
		padding: 0;
		border: none;
		border-radius: 50%;
		box-shadow: none;
		background: var(--background-modifier-border);
		cursor: pointer;
	}
	.close path {
		fill: none;
		stroke: var(--text-normal);
		stroke-width: 2;
		stroke-linecap: round;
	}
	.body {
		padding: 18.5px 16px 33px;
	}
	.feedback {
		font-size: 16px;
		line-height: 22px;
	}
	.chart-title {
		margin: 14.8px 0 0;
		font-size: 18px;
		line-height: 22px;
		font-weight: 700;
	}
	.subtitle {
		margin-top: 8px;
		font-size: 16px;
		line-height: 21px;
		color: var(--text-muted);
	}
	.chart {
		margin: 72.5px -16px 0;
	}
	.legend {
		margin: 17.6px -16px 0;
	}
	.stats {
		margin-top: 33px;
	}
</style>
