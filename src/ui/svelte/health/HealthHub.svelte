<script lang="ts">
	import { DIVIDER, type AreaEntry } from "../../../dashboard/areas";
	import type { Route } from "../../../dashboard/routes";
	import GroupBand from "../activities/GroupBand.svelte";
	import MenuRow from "../activities/MenuRow.svelte";

	/**
	 * Health Stats, in the app's order: Sleep, on the newest night, then every
	 * stat whose page is registered in `HEALTH_PAGES` — `areaItems`, which the
	 * rail lists too. A stat stays off the list until its page lands, as
	 * Activities leaves out what is not built yet.
	 */
	let { items, go }: { items: AreaEntry[]; go: (route: Route) => void } = $props();
</script>

<div class="list">
	<GroupBand label="Health" hub />
	<div class="rows">
		{#each items as item (item === DIVIDER ? DIVIDER : item.key)}
			{#if item !== DIVIDER}<MenuRow label={item.label} onclick={() => go(item.route)} />{/if}
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
