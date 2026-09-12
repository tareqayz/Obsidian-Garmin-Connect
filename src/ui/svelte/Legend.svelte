<script lang="ts">
	import type { Stage } from "../../dashboard/metrics";

	let { stages }: { stages: readonly Stage[] } = $props();
</script>

<!-- Two or more series always carry a legend: identity is never colour alone. -->
<div class="legend">
	{#each stages as stage (stage.key)}
		<span class="item">
			<span class="swatch" style:background="var(--gcd-stage-{stage.step})"></span>
			{stage.label}
		</span>
	{/each}
</div>

<style>
	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 14px;
		margin-top: 8px;
		color: var(--gcd-muted);
		font-size: var(--font-ui-smaller, 12px);
	}
	.item {
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}
	.swatch {
		width: 10px;
		height: 10px;
		border-radius: 2px;
		display: inline-block;
	}
</style>
