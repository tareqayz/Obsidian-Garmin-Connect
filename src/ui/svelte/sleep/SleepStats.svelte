<script lang="ts">
	import type { SleepStat } from "../../../dashboard/sleep-pages";

	/**
	 * The figures under a line, two to a row on a phone: "50 bpm / Avg
	 * Overnight Heart Rate". A stage's figure carries its colour beside the
	 * label. A pane can run more to a row through `--sleep-stat-columns`.
	 */
	let { stats }: { stats: SleepStat[] } = $props();
</script>

<div class="sleep-stats">
	{#each stats as stat (stat.label)}
		<div class="stat">
			<span class="value">{stat.value}{#if stat.unit}<span class="unit">{stat.unit}</span>{/if}</span>
			<span class="label">
				{#if stat.stage}<span class="dot stage-{stat.stage}"></span>{/if}
				{stat.label}
			</span>
		</div>
	{/each}
</div>

<style>
	.sleep-stats {
		display: grid;
		grid-template-columns: repeat(var(--sleep-stat-columns, 2), minmax(0, 1fr));
		column-gap: var(--sleep-stat-gap, 16px);
	}
	.stat {
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
		display: flex;
		align-items: baseline;
		gap: 4px;
		font-size: 22px;
		line-height: 26px;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}
	.unit {
		font-size: 16px;
		line-height: 21px;
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
	.stage-deep {
		background: var(--gcs-deep);
	}
	.stage-light {
		background: var(--gcs-light);
	}
	.stage-rem {
		background: var(--color-pink);
	}
	.stage-awake {
		background: var(--color-pink);
		opacity: 0.7;
	}
</style>
