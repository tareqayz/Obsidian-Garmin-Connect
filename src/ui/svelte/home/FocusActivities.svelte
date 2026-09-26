<script lang="ts">
	import type { ActivitiesView } from "../../../dashboard/home";
	import HomeCard from "./HomeCard.svelte";

	let { activities }: { activities: ActivitiesView } = $props();

	let most = $derived(Math.max(1, ...activities.days.map((d) => d.minutes)));
</script>

<HomeCard kind="focus" title="All Activities · {activities.range}" icon="activity" accent="var(--color-red)">
	<div class="big">{activities.total}</div>
	<div class="bars">
		{#each activities.days as d}
			<div class="day">
				<div class="track">
					{#if d.minutes > 0}<div class="bar" style:height="{(d.minutes / most) * 100}%"></div>{/if}
				</div>
				<span>{d.label}</span>
			</div>
		{/each}
	</div>
	<div class="month" aria-label="Days with an activity, last four weeks">
		{#each activities.month as on}<span class:on></span>{/each}
	</div>
	<div class="foot">Last 4w</div>
</HomeCard>

<style>
	.big {
		font-size: 35px;
		line-height: 42px;
		font-variant-numeric: tabular-nums;
		margin-bottom: 8px;
	}
	.bars {
		flex: 1;
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		gap: 8px;
		min-height: 120px;
	}
	.day {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		color: var(--text-muted);
		font-size: 11px;
	}
	.track {
		flex: 1;
		width: 100%;
		display: flex;
		align-items: flex-end;
		justify-content: center;
	}
	.bar {
		width: 22px;
		min-height: 6px;
		border-radius: 11px 11px 0 0;
		background: var(--color-blue);
	}
	.month {
		display: flex;
		justify-content: space-between;
		padding: 12px 0 6px;
		border-top: 1px solid var(--background-modifier-border);
		margin-top: 10px;
	}
	.month span {
		width: 5px;
		height: 5px;
		border-radius: 50%;
		background: var(--background-modifier-border);
	}
	.month span.on {
		background: var(--text-muted);
	}
	.foot {
		color: var(--text-muted);
		font-size: 11px;
	}
</style>
