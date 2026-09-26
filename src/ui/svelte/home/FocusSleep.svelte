<script lang="ts">
	import type { SleepView } from "../../../dashboard/home";
	import { clock } from "./geometry";
	import HomeCard from "./HomeCard.svelte";
	import Headline from "./Headline.svelte";
	import Hypnogram from "./Hypnogram.svelte";

	let { sleep }: { sleep: SleepView | null } = $props();
</script>

<HomeCard kind="focus" title="Sleep Score" icon="moon-star" accent="var(--color-blue)" empty={!sleep}>
	{#if sleep}
		<Headline
			value={sleep.score}
			stats={[
				{ value: sleep.quality, label: "Quality" },
				{ value: sleep.duration, label: "Duration" },
			]}
		/>
		<div class="plot">
			{#if sleep.levels.length}
				<Hypnogram levels={sleep.levels} height={150} />
			{:else}
				<div class="none">No sleep stages recorded.</div>
			{/if}
		</div>
		<div class="axis">
			<span>{clock(sleep.start)}</span>
			<span>{clock(sleep.end)}</span>
		</div>
	{/if}
</HomeCard>

<style>
	.plot {
		flex: 1;
		display: flex;
		align-items: flex-end;
		border-bottom: 1px solid var(--background-modifier-border);
	}
	.none {
		color: var(--text-faint);
		font-size: 13px;
		margin: auto;
	}
	.axis {
		display: flex;
		justify-content: space-between;
		color: var(--text-muted);
		font-size: 11px;
		line-height: 14px;
		padding-top: 6px;
	}
</style>
