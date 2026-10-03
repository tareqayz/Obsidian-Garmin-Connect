<script lang="ts">
	import type { Stat } from "../../../dashboard/activities";

	/** Total and the averages under the chart, two to a row; stacked beside it in a pane. */
	let { stats }: { stats: Stat[] } = $props();
</script>

<div class="stats">
	{#each stats as stat (stat.label)}
		<div class="stat">
			<span class="value">{stat.value}</span>
			<span class="label">{stat.label}</span>
		</div>
	{/each}
</div>

<style>
	.stats {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		column-gap: 15.4px;
		padding: 0 15px;
	}
	.stat {
		display: flex;
		flex-direction: column;
		min-height: 63px;
		box-sizing: border-box;
		padding-top: 6px;
		border-top: 1px solid var(--background-modifier-border);
	}
	.value {
		font-size: 22px;
		line-height: 26px;
		font-variant-numeric: tabular-nums;
	}
	.label {
		margin-top: -1px;
		font-size: 14px;
		line-height: 18px;
		color: var(--text-muted);
	}

	@container (min-width: 640px) {
		.stats {
			grid-template-columns: repeat(3, minmax(0, 1fr));
			padding: 0;
		}
	}
	@container (min-width: 1000px) {
		.stats {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
