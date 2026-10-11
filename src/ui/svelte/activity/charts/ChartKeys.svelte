<script lang="ts">
	import { CHART_COLOURS, type ChartKey } from "../../../../dashboard/activity-chart-pages";

	/**
	 * A chart's key under its axis (Stamina, Run/Walk), centred on the card at
	 * the row `y` its geometry gives: a 10 pt dot in the series' colour, or
	 * Potential's short line in text-normal.
	 */
	let { keys, y }: { keys: ChartKey[]; y: number } = $props();
</script>

<div class="chart-keys" style:top="{y - 8}px">
	{#each keys as key (key.label)}
		<span class="key">
			<span class="mark" class:dash={key.kind === "dash"} style:background-color={key.kind === "dot" ? CHART_COLOURS[key.colour] : null}></span>
			{key.label}
		</span>
	{/each}
</div>

<style>
	.chart-keys {
		position: absolute;
		left: 0;
		right: 0;
		display: flex;
		justify-content: center;
		gap: 19px;
		font-size: 12px;
		line-height: 16px;
		color: var(--text-muted);
		white-space: nowrap;
	}
	.key {
		display: inline-flex;
		align-items: center;
		gap: 5.4px;
	}
	.mark {
		flex: none;
		width: 10px;
		height: 10px;
		border-radius: 50%;
	}
	.mark.dash {
		width: 9px;
		height: 2px;
		border-radius: 0;
		background-color: var(--text-normal);
	}
</style>
