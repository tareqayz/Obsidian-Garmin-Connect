<script lang="ts">
	import type { Route } from "../../../dashboard/routes";
	import PageBar from "../home/PageBar.svelte";
	import MenuRow from "./MenuRow.svelte";

	/**
	 * The app's More tab. Only Activities for now; Health Stats, Performance
	 * Stats and the rest join it as their pages are built.
	 */
	let { onBack, go }: { onBack: () => void; go: (route: Route) => void } = $props();
</script>

<PageBar title="More" {onBack} backLabel="Back to Home" />

<div class="list">
	<MenuRow kind="more" icon="activity" label="Activities" onclick={() => go({ page: "activities" })} />
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
