<script lang="ts">
	import Stat from "./Stat.svelte";

	/** The In Focus top row: a big number, then two stats beside it. */
	interface Props {
		value: string | number | undefined;
		stats: Array<{ value: string | number | undefined; label: string }>;
	}

	let { value, stats }: Props = $props();
</script>

<div class="headline">
	<div class="big">{value ?? "—"}</div>
	{#each stats as s}
		<Stat value={s.value} label={s.label} />
	{/each}
</div>

<style>
	.headline {
		display: grid;
		grid-template-columns: 1.1fr 1fr 1fr;
		gap: 8px;
		align-items: start;
		margin-bottom: 12px;
	}
	.big {
		font-size: 35px;
		line-height: 42px;
		font-variant-numeric: tabular-nums;
	}
</style>
