<script lang="ts">
	import type { StatItem } from "../../../dashboard/stats-pages";

	/**
	 * The figures under or beside a chart, two to a row. Vigorous minutes
	 * carry the app's "x2": they count double towards the total.
	 */
	let { stats }: { stats: StatItem[] } = $props();
</script>

<div class="stat-grid">
	{#each stats as stat (stat.label)}
		<div class="stat">
			<span class="value">{stat.value}{#if stat.badge}<span class="badge">x2</span>{/if}</span>
			<span class="label">{stat.label}</span>
		</div>
	{/each}
</div>

<style>
	/* The page sets the gutters: the app's differ by a point or so between pages. */
	.stat-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--stat-row-gap, 0px) var(--stat-gap, 15.4px);
		padding: 0 var(--stat-gutter, 15px);
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
		display: flex;
		align-items: center;
		font-size: 22px;
		line-height: 26px;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}
	.badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex: none;
		width: 20px;
		height: 20px;
		margin-left: 12px;
		border-radius: 50%;
		background: var(--text-normal);
		color: var(--background-primary);
		font-size: 11px;
		line-height: 13px;
		font-weight: 700;
	}
	.label {
		margin-top: -1px;
		font-size: 14px;
		line-height: 18px;
		color: var(--text-muted);
	}
</style>
