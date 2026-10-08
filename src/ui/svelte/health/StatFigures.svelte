<script lang="ts" module>
	/** A figure over its label: "25 / Avg Stress Level", "10h 57m / Rest". */
	export interface StatFigure {
		value: string;
		label: string;
		/** A CSS colour for a dot before the label: a category's. */
		color?: string;
	}
</script>

<script lang="ts">
	/**
	 * Figures two to a row, each under a rule: a stat's "Avg …" block (one
	 * figure, which takes the first column alone) or a day's tiles. The gap
	 * between the columns is the phone's 15.5pt; a pane's layout sets
	 * `--stat-figure-gap`.
	 */
	let { figures }: { figures: StatFigure[] } = $props();
</script>

<div class="stat-figures">
	{#each figures as figure (figure.label)}
		<div class="figure">
			<span class="value">{figure.value}</span>
			<span class="label">
				{#if figure.color}<span class="dot" style:background={figure.color}></span>{/if}
				{figure.label}
			</span>
		</div>
	{/each}
</div>

<style>
	.stat-figures {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		column-gap: var(--stat-figure-gap, 15.5px);
	}
	.figure {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
		height: 67px;
		box-sizing: border-box;
		padding-top: 5px;
		border-top: 1px solid var(--background-modifier-border);
	}
	.value {
		font-size: 22px;
		line-height: 26px;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}
	.label {
		display: flex;
		align-items: center;
		gap: 9px;
		font-size: 14px;
		line-height: 18px;
		color: var(--text-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.dot {
		flex: none;
		width: 8px;
		height: 8px;
		border-radius: 50%;
	}
</style>
