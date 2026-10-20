<script lang="ts">
	import { DIVIDER, type AreaEntry, type AreaItem } from "../../../dashboard/areas";
	import type { Route } from "../../../dashboard/routes";
	import GroupBand from "./GroupBand.svelte";
	import MenuRow from "./MenuRow.svelte";

	/**
	 * Activities, in the app's order: the sports, All Activities, then Steps,
	 * Floors and Intensity Minutes in a group of their own — `areaItems`, which
	 * the rail lists too. Create Manual Activity, Epics and Golf are left out
	 * until they are built.
	 */
	let { items, go }: { items: AreaEntry[]; go: (route: Route) => void } = $props();

	/** The rows, cut into groups where the list draws its line. */
	let groups = $derived(
		items.reduce<AreaItem[][]>((all, entry) => (entry === DIVIDER ? [...all, []] : [...all.slice(0, -1), [...all[all.length - 1]!, entry]]), [[]]),
	);
</script>

<div class="list">
	<GroupBand label="Activities" hub />
	{#each groups as group, i (i)}
		<div class="rows" class:daily={i > 0}>
			{#each group as item (item.key)}
				<MenuRow label={item.label} onclick={() => go(item.route)} />
			{/each}
		</div>
	{/each}
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
