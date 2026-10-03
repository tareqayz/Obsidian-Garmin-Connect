<script lang="ts">
	import { monthView, type ActivitiesData } from "../../../dashboard/activities";
	import type { Route } from "../../../dashboard/routes";
	import PageBar from "../home/PageBar.svelte";
	import GroupBand from "./GroupBand.svelte";
	import ListCard from "./ListCard.svelte";

	/** A month of one sport, opened from a year's list. */
	interface Props {
		route: Extract<Route, { page: "month" }>;
		data: ActivitiesData;
		onBack: () => void;
	}

	let { route, data, onBack }: Props = $props();

	let view = $derived(
		monthView({ rows: data.rows, category: route.category, sub: route.sub, month: route.month, metric: route.metric, units: data.units }),
	);
</script>

<PageBar title={view.title} {onBack} />

<section class="list">
	<GroupBand label={view.summary} />
	<div class="grid">
		{#each view.activities as item (item.id)}
			<ListCard title={item.name} detail={item.when} value={item.value} />
		{/each}
	</div>
</section>

<style>
	.list {
		padding: 7.7px 8px 32px;
	}
	.grid {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 16px 8px;
		margin-top: 16px;
	}

	@container (min-width: 640px) {
		.list {
			box-sizing: content-box;
			max-width: 1126px;
			margin: 0 auto;
			padding: 16px 32px 32px;
		}
		.grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
	@container (min-width: 1000px) {
		.grid {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}
</style>
