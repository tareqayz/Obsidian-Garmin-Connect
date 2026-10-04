<script lang="ts">
	import type { LegendKey } from "../../../dashboard/stats-charts";

	/** The key under a chart: climbed, descended, and the dashed goal. */
	let { keys }: { keys: LegendKey[] } = $props();

	const LABEL: Record<LegendKey, string> = {
		climbed: "Climbed",
		descended: "Descended",
		goal: "Goal",
		"weekly-goal": "Weekly Goal",
	};
</script>

<div class="legend">
	{#each keys as key (key)}
		<span class="item">
			{#if key === "climbed" || key === "descended"}
				<span class="swatch" class:faded={key === "descended"}></span>
			{:else}
				<svg class="dash" width="12" height="2" aria-hidden="true"><rect x="0" width="2" height="2" /><rect x="4" width="4" height="2" /><rect x="10" width="2" height="2" /></svg>
			{/if}
			<span class="label">{LABEL[key]}</span>
		</span>
	{/each}
</div>

<style>
	.legend {
		display: flex;
		justify-content: center;
		align-items: center;
		gap: 10px;
		height: 16px;
	}
	.item {
		display: inline-flex;
		align-items: center;
		gap: 5.7px;
	}
	.swatch {
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background: var(--color-blue);
	}
	.swatch.faded {
		opacity: 0.4;
	}
	.dash {
		display: block;
		fill: var(--text-normal);
	}
	.label {
		font-size: 12px;
		line-height: 16px;
		color: var(--text-muted);
	}
</style>
