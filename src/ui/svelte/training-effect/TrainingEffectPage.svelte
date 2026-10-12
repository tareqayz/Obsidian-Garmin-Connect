<script lang="ts">
	import { trainingEffectView } from "../../../dashboard/training-effect-pages";
	import StatPageShell from "../health/StatPageShell.svelte";
	import type { PerformanceStatPageProps } from "../performance/pages";
	import TeDetail from "./TeDetail.svelte";
	import TePeriod from "./TePeriod.svelte";

	/**
	 * Garmin Connect's Training Effect page (Performance Stats). Twin: Figma
	 * page 430:6116 — phones 684:33 (7d), 684:118544 (4w), 684:119241 (a week
	 * with several a day), 684:119391 (4w before), 684:119826 (empty), the
	 * detail 684:118813 / 684:118933 (runs) and 684:119704 (a swim); panes
	 * 686:1120, 686:1218, 686:119854.
	 *
	 * 7d and 4w step through rolling periods under the wide range control,
	 * the period in Nav Title (`navTitle`). A card opens the activity's
	 * Training Effect page on top — the route's `sub` — which has neither the
	 * range control nor the period. Everything comes from the activity index,
	 * so the page works offline; it calls nothing on view.
	 */
	let { route, today, onBack, go, swap, activities }: PerformanceStatPageProps = $props();

	let view = $derived(trainingEffectView(route, activities.rows, { today, complete: activities.complete }));
</script>

{#if view.kind === "detail"}
	<StatPageShell {route} {today} label={null} ranges={[]} {onBack} {swap}>
		{#snippet children()}
			<TeDetail {view} open={go} />
		{/snippet}
	</StatPageShell>
{:else}
	<StatPageShell {route} {today} label={view.label} canGoBack={view.canGoBack} canGoForward={view.canGoForward} navTitle {onBack} {swap}>
		{#snippet children({ pane })}
			<TePeriod {view} {pane} open={go} />
		{/snippet}
	</StatPageShell>
{/if}
