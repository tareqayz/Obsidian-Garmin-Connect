<script lang="ts">
	import { hubStats } from "../../../dashboard/health-stats";
	import { healthStatRoute, type Route } from "../../../dashboard/routes";
	import GroupBand from "../activities/GroupBand.svelte";
	import MenuRow from "../activities/MenuRow.svelte";
	import PageBar from "../home/PageBar.svelte";
	import { HEALTH_PAGES } from "./pages";

	/**
	 * Health Stats, in the app's order: Sleep, then every stat whose page is
	 * registered in `HEALTH_PAGES`. A stat stays off the list until its page
	 * lands, as Activities leaves out what is not built yet.
	 */
	interface Props {
		onBack: () => void;
		go: (route: Route) => void;
		/** Sleep opens on the newest night, which only Home knows. */
		openSleep: () => void;
	}

	let { onBack, go, openSleep }: Props = $props();

	const stats = hubStats(Object.keys(HEALTH_PAGES));
</script>

<PageBar title="Health Stats" {onBack} />

<div class="list">
	<GroupBand label="Health" hub />
	<div class="rows">
		{#each stats as stat (stat.id)}
			{@const id = stat.id}
			<MenuRow label={stat.title} onclick={() => (id === "sleep" ? openSleep() : go(healthStatRoute(id)))} />
		{/each}
	</div>
</div>

<style>
	.rows {
		display: flex;
		flex-direction: column;
	}
	@container (min-width: 640px) {
		.list {
			max-width: 560px;
			margin: 0 auto;
			padding-top: 8px;
		}
	}
</style>
