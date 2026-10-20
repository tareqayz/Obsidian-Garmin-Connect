<script lang="ts">
	import type { Area, AreaId } from "../../../dashboard/areas";
	import { lucide } from "./lucide";

	/**
	 * A phone's navigation: the areas across the top of Home and of each area's
	 * own page, in the rail's style, the current one on its pill. Deeper pages
	 * keep only their back and title. A phone has no room for a bar at the
	 * bottom: Obsidian's floating navigation sits there.
	 */
	interface Props {
		areas: Area[];
		current: AreaId;
		/** See All's editor is open: nothing here may leave it unsaved. */
		locked: boolean;
		onArea: (area: AreaId) => void;
	}

	let { areas, current, locked, onArea }: Props = $props();
</script>

<!-- Scrolls sideways only if the labels outgrow a narrow pane; Obsidian's sidebar swipe must not take that. -->
<nav class="gch-area-tabs" inert={locked} data-ignore-swipe="true">
	{#each areas as area (area.id)}
		{@const on = area.id === current}
		<button class="area-tab" class:current={on} aria-current={on ? "page" : undefined} onclick={() => onArea(area.id)}>
			<span class="tab-icon" use:lucide={area.icon}></span>
			<span>{area.short}</span>
		</button>
	{/each}
</nav>

<style>
	.gch-area-tabs {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 4px;
		min-height: 48px;
		padding: 0 8px;
		overflow-x: auto;
		scrollbar-width: none;
		border-bottom: 1px solid var(--background-modifier-border);
		background: var(--background-primary);
	}
	.gch-area-tabs::-webkit-scrollbar {
		display: none;
	}
	.area-tab {
		display: flex;
		align-items: center;
		gap: 6px;
		flex: none;
		margin: 0;
		height: auto;
		padding: 7px 8px;
		border: none;
		border-radius: 8px;
		box-shadow: none;
		background: none;
		font: inherit;
		font-size: 13px;
		line-height: 16px;
		color: var(--text-muted);
		white-space: nowrap;
		cursor: pointer;
	}
	.area-tab:hover {
		background: var(--background-modifier-hover);
	}
	.area-tab:hover:not(.current) {
		color: var(--text-normal);
	}
	.area-tab:focus-visible {
		outline: 2px solid var(--interactive-accent);
		outline-offset: -2px;
	}
	.current {
		background: var(--background-modifier-hover);
		color: var(--text-accent);
		font-weight: 700;
	}
	.tab-icon {
		display: inline-flex;
	}
	.tab-icon :global(svg) {
		width: 16px;
		height: 16px;
	}
</style>
