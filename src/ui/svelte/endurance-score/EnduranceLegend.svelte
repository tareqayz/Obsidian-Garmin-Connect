<script lang="ts">
	import { LEGEND, categoryColor } from "../../../dashboard/endurance-score-charts";
	import type { EnduranceLegendItem } from "../../../dashboard/endurance-score-pages";

	/**
	 * The categories' key (twin Legend Item 576:1209): a Ø 12 dot in each
	 * category's colour, 6 pt, its name in Caption (11/14); items 16 apart in
	 * the rows `legendRows` breaks them into, 21.33 apart. Centred under the
	 * ring or the bars on a phone; a pane's period legend starts at the side
	 * column's edge.
	 */
	interface Props {
		rows: ReadonlyArray<readonly EnduranceLegendItem[]>;
		align?: "center" | "start";
	}

	let { rows, align = "center" }: Props = $props();
</script>

<div class="es-legend" class:es-start={align === "start"} style:row-gap="{LEGEND.pitch - LEGEND.row}px">
	{#each rows as row, i (i)}
		<div class="row" style:column-gap="{LEGEND.gap}px">
			{#each row as item (item.category)}
				<span class="es-item"><span class="es-dot" style:background={categoryColor(item.category)}></span>{item.title}</span>
			{/each}
		</div>
	{/each}
</div>

<style>
	.es-legend {
		display: flex;
		flex-direction: column;
		align-items: center;
	}
	.es-start {
		align-items: flex-start;
	}
	.row {
		display: flex;
		height: 14px;
	}
	.es-item {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: 11px;
		line-height: 14px;
		color: var(--text-muted);
		white-space: nowrap;
	}
	.es-dot {
		flex: none;
		width: 12px;
		height: 12px;
		border-radius: 50%;
	}
</style>
