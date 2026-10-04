<script lang="ts">
	import { STAT_RANGES, type StatRange } from "../../../dashboard/stats-pages";

	/** 1d · 7d · 4w · 1y, as the app's segmented control. */
	let { value, onChange }: { value: StatRange; onChange: (range: StatRange) => void } = $props();
</script>

<div class="range-control">
	{#each STAT_RANGES as range (range)}
		<button class:on={range === value} aria-pressed={range === value} onclick={() => onChange(range)}>{range}</button>
	{/each}
</div>

<style>
	.range-control {
		display: flex;
		align-items: center;
		justify-content: space-between;
		box-sizing: border-box;
		width: 338px;
		max-width: 100%;
		height: 34px;
		padding: 0 29.3px;
		border-radius: 4px;
		background: var(--background-modifier-border);
	}
	button {
		margin: 0;
		height: auto;
		padding: 7px 0;
		border: none;
		box-shadow: none;
		background: none;
		font: inherit;
		font-size: 15px;
		line-height: 20px;
		color: var(--text-muted);
		cursor: pointer;
	}
	button.on {
		font-weight: 600;
		color: var(--text-normal);
	}
</style>
