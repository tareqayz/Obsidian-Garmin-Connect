<script lang="ts">
	import type { ActivityMapRoute, Route } from "../../../dashboard/routes";
	import type { ActivityDetail, ActivityLoad } from "../../../sync/activity-detail";
	import type { TileSource } from "../../map/tile-source";
	import type { OpenSheet } from "../../sheet-modal";
	import PageBar from "../home/PageBar.svelte";
	import RouteMap from "./RouteMap.svelte";

	/**
	 * The full-screen map the Overview map opens: the route over the whole
	 * pane, to pan and pinch, with the Map Settings sheet behind the layers
	 * button. A page of its own on the stack, as on the phone, so Back returns
	 * to the activity where it was.
	 */
	interface Props {
		route: ActivityMapRoute;
		loadActivity: (id: number) => Promise<ActivityLoad>;
		cachedActivity: (id: number) => ActivityDetail | null;
		tiles: () => TileSource | null;
		openSheet: OpenSheet;
		onBack: () => void;
		swap: (route: Route) => void;
	}

	let { route, loadActivity, cachedActivity, tiles, onBack }: Props = $props();

	// svelte-ignore state_referenced_locally
	let detail = $state.raw<ActivityDetail | null>(cachedActivity(route.id));

	$effect(() => {
		const id = route.id;
		let live = true;
		void loadActivity(id).then((load) => {
			if (live && load.detail) detail = load.detail;
		});
		return () => {
			live = false;
		};
	});

	/* The map fills what the pane shows below the bar, whatever its padding. */
	let host = $state<HTMLElement | null>(null);
	let barHeight = $state(44);
	let height = $state(0);

	$effect(() => {
		const scroller = host?.closest<HTMLElement>(".view-content");
		if (!scroller) return;
		const measure = () => {
			const style = getComputedStyle(scroller);
			const padding = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
			height = Math.max(240, scroller.clientHeight - padding - barHeight);
		};
		const resize = new ResizeObserver(measure);
		resize.observe(scroller);
		measure();
		return () => resize.disconnect();
	});
</script>

<div class="activity-map-page" bind:this={host}>
	<div bind:clientHeight={barHeight}>
		<PageBar title={detail?.name || "Map"} {onBack} />
	</div>
	<div class="map" style:height="{height}px">
		{#if detail}
			<RouteMap {detail} tiles={tiles()} interactive overlay={route.overlay} laps={route.laps} />
		{/if}
	</div>
</div>

<style>
	.map {
		position: relative;
		width: 100%;
	}
</style>
