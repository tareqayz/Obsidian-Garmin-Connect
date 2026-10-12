<script lang="ts">
	import { CURRENT_LAYOUT } from "../../../dashboard/running-tolerance-charts";
	import type { ToleranceFigure } from "../../../dashboard/running-tolerance-pages";

	/**
	 * Current's figures (twin Figure 692:139): each under a 1 pt rule, the
	 * number in Value L (22/26) with its unit in Body (15/20) on the same
	 * baseline 4.67 after it, the label in Label (13/16) muted under them;
	 * 177 pt wide, two to a row 16 apart, rows 67 apart. `StatFigures` takes
	 * the value as one string, so the unit could not be set smaller there.
	 */
	let { figures }: { figures: readonly ToleranceFigure[] } = $props();

	const L = CURRENT_LAYOUT;
</script>

<div class="rt-figures" style:--rt-figure-width="{L.figureWidth}px" style:--rt-figure-gap="{L.figureColumnGap}px" style:--rt-figure-row-gap="{L.figurePitch - 50}px">
	{#each figures as figure (figure.label)}
		<div class="rt-figure">
			<div class="rt-value">
				<span class="rt-number">{figure.value}</span>
				{#if figure.unit}<span class="rt-unit">{figure.unit}</span>{/if}
			</div>
			<div class="rt-label">{figure.label}</div>
		</div>
	{/each}
</div>

<style>
	.rt-figures {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, var(--rt-figure-width)));
		column-gap: var(--rt-figure-gap);
		row-gap: var(--rt-figure-row-gap);
	}
	/* 50 tall: the rule, the value 4.34 under it (its 26 pt line from 5.34), the label from 33.95. */
	.rt-figure {
		box-sizing: border-box;
		height: 50px;
		min-width: 0;
		padding-top: 4.34px;
		border-top: 1px solid var(--background-modifier-border);
	}
	.rt-value {
		display: flex;
		align-items: baseline;
		gap: 4.67px;
		height: 26px;
		color: var(--text-normal);
		white-space: nowrap;
	}
	.rt-number {
		font-size: 22px;
		line-height: 26px;
	}
	.rt-unit {
		font-size: 15px;
		line-height: 20px;
	}
	.rt-label {
		margin-top: 2.61px;
		font-size: 13px;
		line-height: 16px;
		color: var(--text-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
</style>
