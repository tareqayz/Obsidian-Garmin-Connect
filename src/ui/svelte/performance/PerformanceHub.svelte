<script lang="ts">
	import { PERFORMANCE_REGISTRY } from "../../../dashboard/performance-stats";
	import { performanceStatRoute, type Route } from "../../../dashboard/routes";
	import MenuRow from "../activities/MenuRow.svelte";
	import PageBar from "../home/PageBar.svelte";
	import { PERFORMANCE_PAGES } from "./pages";

	/**
	 * Performance Stats, in the app's order: every stat whose page is
	 * registered in `PERFORMANCE_PAGES`, as Health Stats lists its own. The
	 * app's list has no group band; Cycling Ability and the pages Training
	 * Status opens (Load, Heat Acclimation) are never listed.
	 */
	interface Props {
		onBack: () => void;
		go: (route: Route) => void;
	}

	let { onBack, go }: Props = $props();

	const stats = PERFORMANCE_REGISTRY.hubStats(Object.keys(PERFORMANCE_PAGES));
</script>

<PageBar title="Performance Stats" {onBack} />

<div class="list">
	<div class="rows">
		{#each stats as stat (stat.id)}
			<MenuRow label={stat.title} onclick={() => go(performanceStatRoute(stat.id))} />
		{/each}
	</div>
</div>

<style>
	/* The app's list has a plain strip where Health Stats has its group band. */
	.list {
		padding-top: 16px;
	}
	.rows {
		display: flex;
		flex-direction: column;
	}
	@container (min-width: 640px) {
		.list {
			max-width: 560px;
			margin: 0 auto;
		}
	}
</style>
