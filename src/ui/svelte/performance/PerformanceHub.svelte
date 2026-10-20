<script lang="ts">
	import { DIVIDER, type AreaEntry } from "../../../dashboard/areas";
	import type { Route } from "../../../dashboard/routes";
	import MenuRow from "../activities/MenuRow.svelte";

	/**
	 * Performance Stats, in the app's order: every stat whose page is
	 * registered in `PERFORMANCE_PAGES`, as Health Stats lists its own —
	 * `areaItems`, which the rail lists too. The app's list has no group band;
	 * Cycling Ability and the pages Training Status opens (Load, Heat
	 * Acclimation) are never listed.
	 */
	let { items, go }: { items: AreaEntry[]; go: (route: Route) => void } = $props();
</script>

<div class="list">
	<div class="rows">
		{#each items as item (item === DIVIDER ? DIVIDER : item.key)}
			{#if item !== DIVIDER}<MenuRow label={item.label} onclick={() => go(item.route)} />{/if}
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
