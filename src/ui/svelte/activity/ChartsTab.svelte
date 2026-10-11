<script lang="ts">
	import { Menu, Platform } from "obsidian";
	import { chartsTabView, type ChartPicker } from "../../../dashboard/activity-chart-pages";
	import { PANE_WIDTH, type ChartLayout } from "../../../dashboard/activity-charts";
	import type { ActivityAxis, HeartChart, PaceChart, PowerChart } from "../../../dashboard/routes";
	import AxisSwitch from "./charts/AxisSwitch.svelte";
	import ChartSection from "./charts/ChartSection.svelte";
	import type { ActivityTabProps } from "./types";

	/**
	 * Charts: the Time | Distance control, sticky under the page's tabs, then
	 * every chart the activity has, in the phone's order (`chartsTabView`). On
	 * a phone the charts stack under 14 pt bands; in a pane they are bordered
	 * cards, two to a row from 640 pt and three from 1000 (the twin's 415:3254).
	 * A picker is Obsidian's menu: a dropdown on a desktop, a sheet on a phone.
	 */
	let { detail, route, units, swap }: ActivityTabProps = $props();

	let view = $derived(chartsTabView(detail, route, units));

	let width = $state(0);
	let layout: ChartLayout = $derived(width >= PANE_WIDTH ? "pane" : "phone");

	function setAxis(axis: ActivityAxis) {
		if (axis !== route.axis) swap({ ...route, axis });
	}

	/** The sheet's title on a phone (the twin's 409:2244); the desktop menu has none. */
	const PICKER_TITLES: Record<ChartPicker["key"], string> = { pace: "Pace", heart: "Heart Rate", power: "Power" };

	function choose(key: ChartPicker["key"], value: string) {
		if (key === "pace") swap({ ...route, pace: value as PaceChart });
		else if (key === "heart") swap({ ...route, heart: value as HeartChart });
		else swap({ ...route, power: value as PowerChart });
	}

	function pick(picker: ChartPicker | undefined, e: MouseEvent) {
		if (!picker) return;
		const menu = new Menu();
		if (Platform.isPhone) menu.addItem((item) => item.setTitle(PICKER_TITLES[picker.key]).setIsLabel(true));
		for (const option of picker.options) {
			menu.addItem((item) =>
				item
					.setTitle(option.label)
					.setChecked(option.value === picker.chosen)
					.onClick(() => {
						if (option.value !== picker.chosen) choose(picker.key, option.value);
					}),
			);
		}
		menu.showAtMouseEvent(e);
	}
</script>

<div class="charts-tab" bind:clientWidth={width}>
	<div class="axis-bar">
		<div class="axis-inner"><AxisSwitch value={route.axis} onChange={setAxis} /></div>
	</div>
	{#if view.cards.length}
		<div class="chart-list">
			{#each view.cards as card (card.id)}
				<ChartSection {card} {layout} onPick={(e) => pick(card.picker, e)} />
			{/each}
		</div>
	{:else}
		<p class="empty">This activity has no samples to chart.</p>
	{/if}
</div>

<style>
	/* The twin's sticky header under the tabs: the control 16 pt down, 22.7 pt above the first band.
	   It sticks under the page's own bar and tabs, whose height the page sets. */
	.axis-bar {
		position: sticky;
		top: var(--activity-bar-height, 0px);
		z-index: 1;
		padding: 16px 16px 22.7px;
		background: var(--background-primary);
	}
	.chart-list {
		display: flex;
		flex-direction: column;
	}
	.empty {
		margin: 0;
		padding: 0 16px 16px;
		font-size: 14px;
		color: var(--text-muted);
	}

	/* A pane (415:3254): content 1126 pt wide, the control 24 pt under the tabs and 24 above the cards. */
	@container (min-width: 640px) {
		.axis-bar {
			padding: 24px 32px;
		}
		.axis-inner,
		.chart-list,
		.empty {
			box-sizing: content-box;
			max-width: 1126px;
			margin: 0 auto;
		}
		.chart-list {
			display: grid;
			grid-template-columns: repeat(2, minmax(0, 1fr));
			align-items: start;
			gap: 8px;
			padding: 0 32px 32px;
		}
		.empty {
			padding: 0 32px 32px;
		}
	}

	@container (min-width: 1000px) {
		.chart-list {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}
</style>
