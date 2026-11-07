<script lang="ts">
	import { COLUMN_BOTTOM, COLUMN_TOP, POINT_R, pulseOxPlot } from "../../../dashboard/pulse-ox-charts";
	import type { PulseOxPeriodView } from "../../../dashboard/pulse-ox-pages";
	import Spo2Chart from "./Spo2Chart.svelte";

	/** A week or four of daily averages: a column a day and a dot coloured by its band. Needs `SPO2_COLORS` around it. */
	let { view, pane }: { view: PulseOxPeriodView; pane: boolean } = $props();
</script>

<Spo2Chart {pane} empty={!view.points.length} plot={(width) => pulseOxPlot(view, width, pane)}>
	{#snippet marks(p)}
		{#each p.columns as x}<line class="column" x1={x} x2={x} y1={COLUMN_TOP} y2={COLUMN_BOTTOM} />{/each}
		{#each p.points as point}<circle class="point {point.band}" cx={point.x} cy={point.y} r={POINT_R} />{/each}
	{/snippet}
</Spo2Chart>

<style>
	.column {
		stroke: var(--background-modifier-border);
		stroke-width: 1;
	}
	.point.high {
		fill: var(--spo2-high);
	}
	.point.mid {
		fill: var(--spo2-mid);
	}
	.point.low {
		fill: var(--spo2-low);
	}
	.point.poor {
		fill: var(--spo2-poor);
	}
</style>
