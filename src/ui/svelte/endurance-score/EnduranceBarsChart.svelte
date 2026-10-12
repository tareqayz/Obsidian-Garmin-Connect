<script lang="ts">
	import { barsPlot } from "../../../dashboard/endurance-score-charts";
	import type { EnduranceBars } from "../../../dashboard/endurance-score-pages";
	import { PANE_COLUMN, PHONE } from "../../../dashboard/stat-charts";
	import StatEmpty from "../health/StatEmpty.svelte";
	import StatStackedBars from "../health/StatStackedBars.svelte";

	/**
	 * The Top Contributors tab's chart on 12w and 1y (twin 582:108111 /
	 * 582:108663, the two-row 582:109643; panes 585:110153 / 585:110533): five
	 * gridlines from 0, a bar a week or month centred on its start, stacked
	 * from Miscellaneous up to its largest category with the page showing
	 * between segments and a pill on top, an 8 pt dot under each and its
	 * Monday or month on end. The box shortens for each extra row of the
	 * phone's legend under it (`rows`). Geometry is `barsPlot`'s.
	 */
	interface Props {
		bars: EnduranceBars | null;
		range: "12w" | "1y";
		/** The legend's rows under the chart on a phone; a pane passes its range's (`paneRows`). */
		rows: number;
		/** The line in place of the plot when `bars` is null. */
		empty?: string;
		pane: boolean;
	}

	let { bars, range, rows, empty, pane }: Props = $props();

	let measured = $state(0);
	let width = $derived(measured || (pane ? PANE_COLUMN : PHONE));
	let p = $derived(barsPlot(bars, range, width, rows));
</script>

<div class="es-bars" bind:clientWidth={measured} style:height="{p.height}px">
	{#if bars}
		<!-- The list under the chart gives each period's shares. -->
		<svg width={p.width} height={p.height} aria-hidden="true">
			{#each p.grid as g, i (i)}
				<line class="grid" x1={g.x1} x2={g.x2} y1={g.y} y2={g.y} />
				<text class="tick" x={p.labelRight} y={g.y} text-anchor="end" dominant-baseline="central">{g.label}</text>
			{/each}
			<StatStackedBars bars={p.bars} />
			{#each p.dots as dot, i (i)}<circle class="axis-dot" cx={dot.x} cy={dot.y} r={dot.r} />{/each}
			{#each p.labels as label, i (i)}
				<text class="axis" x={label.x} y={label.y} text-anchor="middle" dominant-baseline="central" transform="rotate(-90 {label.x} {label.y})">{label.text}</text>
			{/each}
		</svg>
	{:else if empty}
		<div class="es-empty" style:top="{p.top}px" style:height="{p.baseline - p.top}px"><StatEmpty text={empty} /></div>
	{/if}
</div>

<style>
	.es-bars {
		position: relative;
		min-width: 0;
	}
	svg {
		display: block;
		overflow: visible;
	}
	.grid {
		stroke: var(--background-modifier-border);
		stroke-width: 1;
	}
	.tick,
	.axis {
		fill: var(--text-muted);
		font-size: 11px;
	}
	.axis-dot {
		fill: var(--text-faint);
	}
	.es-empty {
		position: absolute;
		left: 0;
		right: 0;
	}
	.es-empty :global(.stat-empty) {
		font-size: 15px;
		line-height: 20px;
	}
</style>
