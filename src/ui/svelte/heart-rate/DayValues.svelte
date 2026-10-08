<script lang="ts">
	/** A card's two figures, stacked at its right: resting over High, "--" without one. */
	let { resting, high }: { resting: string; high: string } = $props();
	const bpm = (v: string) => (v === "--" ? v : `${v} bpm`);
</script>

<span class="hr-values"><span>{bpm(resting)}</span><span>{bpm(high)}</span></span>

<style>
	.hr-values {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		font-size: 15px;
		line-height: 20px;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}
</style>
