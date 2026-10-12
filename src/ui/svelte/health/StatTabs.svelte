<script lang="ts">
	import { statTabs, type StatRoute } from "../../../dashboard/routes";

	/**
	 * A stat page's underlined tabs (twin 442:1159), from its registry's
	 * `tabs` and `tabLabels`: the route's tab is on, or the first. A tab
	 * switches the page in place, keeping its range and period.
	 */
	interface Props {
		route: StatRoute;
		/** The props' `swap`. */
		swap: (route: StatRoute) => void;
		/** "equal": cells of (width − 16·(n − 1)) / n, 16 apart (FTP, Endurance Score, Load); "packed": cells round each label, centred (VO₂ Max). */
		layout?: "equal" | "packed";
		/** The bar's height, its labels centred in it: FTP 44, Endurance Score 55, Load 51, VO₂ Max 46. */
		height?: number;
	}

	let { route, swap, layout = "equal", height = 44 }: Props = $props();

	let tabs = $derived(statTabs(route));
</script>

<div class="stat-tabs" class:packed={layout === "packed"} style:height="{height}px" role="tablist">
	{#each tabs as tab (tab.id)}
		<button class="tab" class:on={tab.on} role="tab" aria-selected={tab.on} onclick={() => swap({ ...route, tab: tab.id })}>
			<span class="cell">{tab.label}</span>
		</button>
	{/each}
</div>

<style>
	.stat-tabs {
		display: flex;
		gap: 16px;
		box-sizing: border-box;
		border-top: 1px solid var(--background-modifier-border);
		border-bottom: 1px solid var(--background-modifier-border);
		background: var(--background-primary);
	}
	.packed {
		gap: 0;
		justify-content: center;
	}
	button {
		display: flex;
		justify-content: center;
		flex: 1 1 0;
		min-width: 0;
		height: 100%;
		margin: 0;
		padding: 0;
		border: none;
		border-radius: 0;
		box-shadow: none;
		background: none;
		font: inherit;
		color: inherit;
		cursor: pointer;
	}
	.packed button {
		flex: none;
	}
	/* A cell hugs its label; the underline runs along its foot, just over the divider. */
	.cell {
		position: relative;
		display: flex;
		align-items: center;
		min-width: 0;
		height: 100%;
		overflow: hidden;
		font-size: 16px;
		line-height: 20px;
		color: var(--text-muted);
		white-space: nowrap;
		text-overflow: ellipsis;
	}
	.packed .cell {
		padding: 0 16.5px;
	}
	.on .cell {
		font-weight: 600;
		color: var(--text-normal);
	}
	.on .cell::after {
		content: "";
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		height: 1px;
		background: var(--text-normal);
	}
	.packed .on .cell::after {
		height: 2px;
	}
</style>
