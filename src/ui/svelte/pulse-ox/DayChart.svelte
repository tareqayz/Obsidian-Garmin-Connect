<script lang="ts">
	import { BAR_WIDTH, spo2DayPlot } from "../../../dashboard/pulse-ox-charts";
	import type { PulseOxDayView } from "../../../dashboard/pulse-ox-pages";
	import Spo2Chart from "./Spo2Chart.svelte";

	/** A day's hourly averages: a rounded bar an hour, coloured by its band. Needs `SPO2_COLORS` around it. */
	let { view, pane }: { view: PulseOxDayView; pane: boolean } = $props();
</script>

<Spo2Chart {pane} empty={false} plot={(width) => spo2DayPlot(view, width, pane)}>
	{#snippet marks(p)}
		{#each p.bars as bar}<line class="bar {bar.band}" x1={bar.x} x2={bar.x} y1={bar.top} y2={bar.bottom} stroke-width={BAR_WIDTH} />{/each}
	{/snippet}
</Spo2Chart>

<style>
	.bar {
		stroke-linecap: round;
	}
	.bar.high {
		stroke: var(--spo2-high);
	}
	.bar.mid {
		stroke: var(--spo2-mid);
	}
	.bar.low {
		stroke: var(--spo2-low);
	}
	.bar.poor {
		stroke: var(--spo2-poor);
	}
</style>
