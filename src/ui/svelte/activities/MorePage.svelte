<script lang="ts">
	import { PERFORMANCE_REGISTRY } from "../../../dashboard/performance-stats";
	import type { Route } from "../../../dashboard/routes";
	import PageBar from "../home/PageBar.svelte";
	import { PERFORMANCE_PAGES } from "../performance/pages";
	import MenuRow from "./MenuRow.svelte";

	/**
	 * The app's More tab: Activities, Health Stats, and Performance Stats once
	 * one of its hub's pages is built. The rest join them as theirs are.
	 */
	let { onBack, go }: { onBack: () => void; go: (route: Route) => void } = $props();

	const performance = PERFORMANCE_REGISTRY.hubStats(Object.keys(PERFORMANCE_PAGES)).length > 0;
</script>

<PageBar title="More" {onBack} backLabel="Back to Home" />

<div class="list">
	<MenuRow kind="more" icon="activity" label="Activities" onclick={() => go({ page: "activities" })} />
	<MenuRow kind="more" icon="heart-pulse" label="Health Stats" onclick={() => go({ page: "health" })} />
	{#if performance}
		<MenuRow kind="more" icon="chart-column" label="Performance Stats" onclick={() => go({ page: "performance" })} />
	{/if}
</div>

<style>
	.list {
		padding-top: 16px;
	}
	@container (min-width: 640px) {
		.list {
			max-width: 560px;
			margin: 0 auto;
		}
	}
</style>
