<script lang="ts">
	import { expandedChartView } from "../../../dashboard/activity-chart-pages";
	import { expandedPlot } from "../../../dashboard/activity-charts";
	import { toIsoDate } from "../../../garmin/endpoints";
	import PageBar from "../home/PageBar.svelte";
	import { lucide } from "../home/lucide";
	import ChartChips from "./charts/ChartChips.svelte";
	import ExpandedPlot from "./charts/ExpandedPlot.svelte";
	import type { ActivityTabProps } from "./types";

	/**
	 * The landscape chart, as a page state inside the view (the twin's 411:1340,
	 * 416:86199): Close, the "A & B" title and the swap button in the bar; the
	 * chart sized to what the view shows under it; the overlay chips below.
	 * Opened from a chart badge (`route.sub = "chart:<metric>[:<overlay>[:swap]]"`);
	 * a chip or the swap button replaces the route's `sub`. The chips are the
	 * sport's charts (its profile's `charts.chips`).
	 */
	let { detail, route, units, profile, rows, swap, onClose }: ActivityTabProps & { onClose: () => void } = $props();

	let view = $derived(expandedChartView(detail, route, units, profile.charts, { rows, today: toIsoDate() }));

	/* The chart fills what the pane shows below the bar, whatever its padding (as ActivityMapPage). */
	let host = $state<HTMLElement | null>(null);
	let barHeight = $state(44);
	let room = $state(0);
	let width = $state(0);

	$effect(() => {
		const scroller = host?.closest<HTMLElement>(".view-content");
		if (!scroller) return;
		const measure = () => {
			const style = getComputedStyle(scroller);
			const padding = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
			room = Math.max(0, scroller.clientHeight - padding - barHeight);
		};
		// A frame later: a height set inside the observer's own callback is a layout loop.
		let frame = 0;
		const resize = new ResizeObserver(() => {
			cancelAnimationFrame(frame);
			frame = requestAnimationFrame(measure);
		});
		resize.observe(scroller);
		measure();
		return () => {
			cancelAnimationFrame(frame);
			resize.disconnect();
		};
	});

	let plot = $derived(view && width > 0 && room > 0 ? expandedPlot(view, width, room) : null);
	let chips = $derived((view?.chips ?? []).map((chip) => ({ id: chip.metric, label: chip.label })));

	function open(sub: string | null | undefined) {
		if (sub) swap({ ...route, sub });
	}
</script>

<div class="expanded-chart" bind:this={host}>
	<div bind:clientHeight={barHeight}>
		<PageBar title={view?.title ?? "Chart"}>
			{#snippet left()}
				<button class="close-chart" onclick={onClose}>Close</button>
			{/snippet}
			{#snippet right()}
				{#if view?.swap}
					<button class="clickable-icon swap" aria-label="Swap the axes" onclick={() => open(view?.swap)}><span use:lucide={"arrow-left-right"}></span></button>
				{:else}
					<span></span>
				{/if}
			{/snippet}
		</PageBar>
	</div>
	<div class="body" bind:clientWidth={width}>
		{#if view && plot}
			<ExpandedPlot {view} {plot} />
			{#if chips.length}
				<div class="chips" style:margin-top="{plot.chipsTop - plot.height}px">
					<ChartChips {chips} selected={view.ref.overlay} onSelect={(id) => open(view?.chips.find((chip) => chip.metric === id)?.sub)} />
				</div>
			{/if}
		{:else if !view}
			<p class="empty">This chart isn’t available for this activity.</p>
		{/if}
	</div>
</div>

<style>
	/* The bar's grid stretches what a snippet puts in it: Close keeps to the left, the swap button to the right. */
	button.close-chart {
		justify-self: start;
		margin: 0;
		height: auto;
		padding: 0;
		border: none;
		box-shadow: none;
		background: none;
		color: var(--text-accent);
		font: inherit;
		font-size: 15px;
		line-height: 20px;
		cursor: pointer;
	}
	.swap {
		justify-self: end;
		color: var(--text-accent);
	}
	.swap :global(svg) {
		width: 20px;
		height: 20px;
	}
	.empty {
		margin: 0;
		padding: 16px;
		font-size: 14px;
		color: var(--text-muted);
	}

</style>
