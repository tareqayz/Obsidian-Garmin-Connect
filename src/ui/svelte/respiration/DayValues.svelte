<script lang="ts">
	/** A day card's two figures: "13 brpm · 13 brpm" over "Sleep · Awake". */
	let { sleep, awake }: { sleep: string; awake: string } = $props();
</script>

<span class="resp-values">
	<span class="v">{sleep}</span><span class="v">{awake}</span>
	<span class="k">Sleep</span><span class="k">Awake</span>
</span>

<style>
	.resp-values {
		display: grid;
		grid-template-columns: auto auto;
		column-gap: 8px;
		justify-items: end;
		font-size: 15px;
		line-height: 20px;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}
	.k {
		color: var(--text-muted);
	}
</style>
