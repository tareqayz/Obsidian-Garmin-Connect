<script lang="ts">
	import { CATEGORIES } from "../../../dashboard/activities";
	import { categoryRoute, statsRoute, type Route } from "../../../dashboard/routes";
	import { STAT_IDS, STAT_TITLE } from "../../../dashboard/stats-pages";
	import PageBar from "../home/PageBar.svelte";
	import GroupBand from "./GroupBand.svelte";
	import MenuRow from "./MenuRow.svelte";

	/**
	 * Activities, in the app's order: the sports, All Activities, then Steps,
	 * Floors and Intensity Minutes in a group of their own. Create Manual
	 * Activity, Epics and Golf are left out until they are built.
	 */
	let { onBack, go }: { onBack: () => void; go: (route: Route) => void } = $props();
</script>

<PageBar title="Activities" {onBack} />

<div class="list">
	<GroupBand label="Activities" hub />
	<div class="rows">
		{#each CATEGORIES as category (category.id)}
			<MenuRow label={category.title} onclick={() => go(categoryRoute(category.id))} />
		{/each}
		<MenuRow label="All Activities" onclick={() => go({ page: "all" })} />
	</div>
	<div class="rows daily">
		{#each STAT_IDS as stat (stat)}
			<MenuRow label={STAT_TITLE[stat]} onclick={() => go(statsRoute(stat))} />
		{/each}
	</div>
</div>

<style>
	.rows {
		display: flex;
		flex-direction: column;
	}
	.daily {
		margin-top: 16px;
	}
	@container (min-width: 640px) {
		.list {
			max-width: 560px;
			margin: 0 auto;
			padding-top: 8px;
		}
	}
</style>
