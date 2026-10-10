<script lang="ts">
	import { CHART_COLOURS, type ChartFigure } from "../../../../dashboard/activity-chart-pages";

	/**
	 * A card's figures, two to a row: the twin's Stat (403:14), a 1 pt rule,
	 * the value at 22 pt with its unit at 15, the label under it at 13 in
	 * text-muted, after a dot for Training Effect.
	 */
	let { figures }: { figures: ChartFigure[] } = $props();
</script>

<div class="chart-figures">
	{#each figures as figure (figure.label)}
		<div class="figure">
			<div class="value-row">
				<span class="value">{figure.value}</span>
				{#if figure.unit}<span class="unit">{figure.unit}</span>{/if}
			</div>
			<div class="label">
				{#if figure.dot}<span class="dot" style:background-color={CHART_COLOURS[figure.dot]}></span>{/if}
				<span class="text">{figure.label}</span>
			</div>
		</div>
	{/each}
</div>

<style>
	.chart-figures {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		column-gap: 16px;
		margin-top: 17.04px;
		padding: 0 16px;
	}
	.figure {
		height: 52px;
		min-width: 0;
		border-top: 1px solid var(--background-modifier-border);
	}
	.value-row {
		display: flex;
		align-items: baseline;
		gap: 4px;
		margin-top: 4.51px;
		white-space: nowrap;
		overflow: hidden;
	}
	.value {
		font-size: 22px;
		line-height: 26px;
		color: var(--text-normal);
	}
	.unit {
		font-size: 15px;
		line-height: 19px;
		color: var(--text-normal);
	}
	.label {
		display: flex;
		align-items: center;
		gap: 8.35px;
		margin-top: 2.47px;
		font-size: 13px;
		line-height: 16px;
		color: var(--text-muted);
		white-space: nowrap;
	}
	.text {
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.dot {
		flex: none;
		width: 8px;
		height: 8px;
		border-radius: 50%;
	}
	/* In a pane's bordered card, 15 pt inside the border: 16 from the card's edge, as on the phone. */
	@container (min-width: 640px) {
		.chart-figures {
			padding: 0 15px;
		}
	}
</style>
