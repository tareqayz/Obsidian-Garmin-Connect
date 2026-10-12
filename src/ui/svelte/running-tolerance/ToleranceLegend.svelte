<script lang="ts">
	import { LEGEND, legendColor } from "../../../dashboard/running-tolerance-charts";
	import type { ToleranceLegendItem } from "../../../dashboard/running-tolerance-pages";

	/**
	 * The chart's key (twin Legend Item 692:97): a 12 pt marker 5.33 before
	 * each name in Caption (11/14) muted, items 16 apart, rows 14 tall and
	 * 21.33 apart, as the view breaks them (Tolerance · Impact Load, then
	 * At/Above Tolerance; one row with the chip on). The tolerance's marker is
	 * a 12 × 2 line, the loads' a Ø 12 dot, 12w's Actual Distance a line
	 * through a Ø 6 dot and 1y's the line alone. Centred under the chart on a
	 * phone; from the side column's edge in a pane.
	 */
	interface Props {
		rows: ReadonlyArray<readonly ToleranceLegendItem[]>;
		align?: "center" | "start";
	}

	let { rows, align = "center" }: Props = $props();
</script>

<div
	class="rt-legend"
	class:rt-start={align === "start"}
	style:--rt-row-gap="{LEGEND.pitch - LEGEND.row}px"
	style:--rt-item-gap="{LEGEND.itemGap}px"
	style:--rt-marker-gap="{LEGEND.gap}px"
>
	{#each rows as row, i (i)}
		<div class="rt-row">
			{#each row as item (item.id)}
				<span class="rt-item"><span class="rt-marker rt-{item.mark}" style:--rt-color={legendColor(item)}></span>{item.label}</span>
			{/each}
		</div>
	{/each}
</div>

<style>
	.rt-legend {
		display: flex;
		flex-direction: column;
		align-items: center;
		row-gap: var(--rt-row-gap);
	}
	.rt-start {
		align-items: flex-start;
	}
	.rt-row {
		display: flex;
		column-gap: var(--rt-item-gap);
		height: 14px;
	}
	.rt-item {
		display: inline-flex;
		align-items: center;
		gap: var(--rt-marker-gap);
		font-size: 11px;
		line-height: 14px;
		color: var(--text-muted);
		white-space: nowrap;
	}
	.rt-marker {
		position: relative;
		flex: none;
		width: 12px;
		height: 12px;
	}
	.rt-dot {
		border-radius: 50%;
		background: var(--rt-color);
	}
	.rt-line::before,
	.rt-line-dot::before {
		content: "";
		position: absolute;
		left: 0;
		right: 0;
		top: 5px;
		height: 2px;
		background: var(--rt-color);
	}
	.rt-line-dot::after {
		content: "";
		position: absolute;
		left: 3px;
		top: 3px;
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--rt-color);
	}
</style>
