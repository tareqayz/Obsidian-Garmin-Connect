<script lang="ts">
	import type { Route } from "../../../dashboard/routes";
	import PageBar from "../home/PageBar.svelte";
	import MenuRow from "./MenuRow.svelte";

	/**
	 * The app's More tab. Activities and Health Stats for now; Performance
	 * Stats and the rest join them as their pages are built.
	 */
	let { onBack, go }: { onBack: () => void; go: (route: Route) => void } = $props();
</script>

<PageBar title="More" {onBack} backLabel="Back to Home" />

<div class="list">
	<MenuRow kind="more" icon="activity" label="Activities" onclick={() => go({ page: "activities" })} />
	<MenuRow kind="more" icon="heart-pulse" label="Health Stats" onclick={() => go({ page: "health" })} />
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
