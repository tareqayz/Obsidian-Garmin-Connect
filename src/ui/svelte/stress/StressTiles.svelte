<script lang="ts">
	import type { StressStat } from "../../../dashboard/stress-pages";

	/**
	 * Figures two to a row, each under a rule: the 1d page's Rest, Low,
	 * Medium and High with their category's dot, or a period's Avg Stress
	 * Level, which takes the first column alone.
	 */
	let { stats }: { stats: StressStat[] } = $props();
</script>

<div class="stress-tiles">
	{#each stats as stat (stat.label)}
		<div class="tile">
			<span class="value">{stat.value}</span>
			<span class="label">
				{#if stat.part}<span class="dot part-{stat.part}"></span>{/if}
				{stat.label}
			</span>
		</div>
	{/each}
</div>

<style>
	.stress-tiles {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		column-gap: var(--stress-tile-gap, 15.5px);
	}
	.tile {
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
	.part-rest {
		background: var(--stress-rest);
	}
	.part-low {
		background: var(--stress-low);
	}
	.part-medium {
		background: var(--stress-medium);
	}
	.part-high {
		background: var(--stress-high);
	}
</style>
