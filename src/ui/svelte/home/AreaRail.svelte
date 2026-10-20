<script lang="ts">
	import { DIVIDER, type Area, type AreaEntry, type AreaId, type RailFocus } from "../../../dashboard/areas";
	import type { Route } from "../../../dashboard/routes";
	import { lucide } from "./lucide";

	/**
	 * A wide pane's navigation, down its left side: Home and the three areas,
	 * the one you are in opened to its pages with the page you are on lit, and
	 * Sync in the footer. Collapsed it is a column of icons, named by Obsidian's
	 * tooltips. It stays put while the page scrolls, edge to edge in the pane.
	 */
	interface Props {
		areas: Area[];
		items: Record<AreaId, AreaEntry[]>;
		focus: RailFocus;
		/** On Home or an area's own page: that area's row is the one lit. */
		atRoot: boolean;
		collapsed: boolean;
		canSync: boolean;
		syncing: boolean;
		syncMessage: string | null;
		/** See All's editor is open: nothing here may leave it unsaved. */
		locked: boolean;
		onArea: (area: AreaId) => void;
		onItem: (route: Route) => void;
		onToggle: () => void;
		onSync: () => void;
	}

	let { areas, items, focus, atRoot, collapsed, canSync, syncing, syncMessage, locked, onArea, onItem, onToggle, onSync }: Props = $props();

	/* The rail fills the pane's height and reaches through the view's padding to
	   its edges: the scroller's own size and padding, measured. */
	let host = $state<HTMLElement | null>(null);
	let height = $state(0);
	let pad = $state({ top: 0, bottom: 0, left: 0 });

	$effect(() => {
		const scroller = host?.closest<HTMLElement>(".view-content");
		if (!scroller) return;
		const measure = () => {
			const style = getComputedStyle(scroller);
			pad = { top: parseFloat(style.paddingTop) || 0, bottom: parseFloat(style.paddingBottom) || 0, left: parseFloat(style.paddingLeft) || 0 };
			height = scroller.clientHeight;
		};
		// A frame later: a size set inside the observer's own callback is a layout loop.
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
</script>

<nav
	class="gch-rail"
	class:collapsed
	bind:this={host}
	inert={locked}
	style:--rail-height="{height}px"
	style:--rail-pad-top="{pad.top}px"
	style:--rail-pad-bottom="{pad.bottom}px"
	style:--rail-pad-left="{pad.left}px"
>
	<div class="rail-brand">
		{#if !collapsed}
			<span class="rail-icon" use:lucide={"watch"}></span>
			<strong>Garmin Connect</strong>
		{/if}
		<button class="clickable-icon rail-toggle" aria-label={collapsed ? "Expand the sidebar" : "Collapse the sidebar"} onclick={onToggle}>
			<span use:lucide={collapsed ? "chevrons-right" : "chevrons-left"}></span>
		</button>
	</div>

	<div class="rail-areas">
		{#each areas as area (area.id)}
			{@const pages = items[area.id]}
			{@const here = area.id === focus.area}
			{@const open = !collapsed && here && pages.length > 0}
			<button
				class="rail-area"
				class:here
				class:current={here && atRoot}
				aria-current={here ? (atRoot ? "page" : "true") : undefined}
				aria-expanded={!collapsed && pages.length ? open : undefined}
				aria-label={collapsed ? area.title : undefined}
				onclick={() => onArea(area.id)}
			>
				<span class="rail-icon" use:lucide={area.icon}></span>
				{#if !collapsed}
					<span class="rail-label">{area.title}</span>
					{#if pages.length}<span class="rail-chev" use:lucide={open ? "chevron-down" : "chevron-right"}></span>{/if}
				{/if}
			</button>
			{#if open}
				<div class="rail-pages">
					{#each pages as entry, i (entry === DIVIDER ? `${DIVIDER}-${i}` : entry.key)}
						{#if entry === DIVIDER}
							<div class="rail-divider"></div>
						{:else}
							{@const lit = entry.key === focus.item}
							<button class="rail-page" class:current={lit} aria-current={lit ? "page" : undefined} onclick={() => onItem(entry.route)}>{entry.label}</button>
						{/if}
					{/each}
				</div>
			{/if}
		{/each}
	</div>

	<div class="rail-foot">
		{#if !collapsed}<span class="rail-status">{syncMessage ?? ""}</span>{/if}
		<button class="clickable-icon" aria-label={syncMessage ?? "Sync recent days"} disabled={!canSync || syncing} onclick={onSync}>
			<span class:spin={syncing} use:lucide={"refresh-cw"}></span>
		</button>
	</div>
</nav>

<style>
	.gch-rail {
		position: sticky;
		top: calc(-1 * var(--rail-pad-top));
		z-index: 3;
		align-self: flex-start;
		flex: none;
		display: flex;
		flex-direction: column;
		box-sizing: border-box;
		width: 240px;
		height: var(--rail-height);
		/* Through the view's padding to the pane's edges, adding nothing to the scroll. */
		margin: calc(-1 * var(--rail-pad-top)) 0 calc(-1 * var(--rail-pad-bottom)) calc(-1 * var(--rail-pad-left));
		background: var(--background-secondary);
		border-right: 1px solid var(--background-modifier-border);
		color: var(--text-normal);
	}
	.collapsed {
		width: 56px;
		align-items: center;
	}
	button {
		display: flex;
		align-items: center;
		margin: 0;
		height: auto;
		border: none;
		box-shadow: none;
		background: none;
		font: inherit;
		color: inherit;
		text-align: left;
		cursor: pointer;
	}
	button:focus-visible {
		outline: 2px solid var(--interactive-accent);
		outline-offset: -2px;
	}
	.rail-brand {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 14px 10px 12px 18px;
	}
	.collapsed .rail-brand {
		padding: 12px 0 8px;
	}
	.rail-brand strong {
		flex: 1;
		min-width: 0;
		font-size: 15px;
		font-weight: 600;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.rail-areas {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 0 10px 8px;
	}
	.collapsed .rail-areas {
		gap: 4px;
		align-items: center;
	}
	.rail-area {
		gap: 10px;
		width: 100%;
		padding: 8px 10px;
		border-radius: 6px;
		font-size: 15px;
		line-height: 20px;
	}
	.collapsed .rail-area {
		width: auto;
		padding: 9px;
		border-radius: 8px;
	}
	.rail-area:hover,
	.rail-page:hover {
		background: var(--background-modifier-hover);
	}
	.rail-page:hover:not(.current),
	.rail-area:hover:not(.here) .rail-icon {
		color: var(--text-normal);
	}
	.rail-icon {
		display: inline-flex;
		color: var(--text-muted);
	}
	.rail-icon :global(svg) {
		width: 18px;
		height: 18px;
	}
	.here .rail-icon {
		color: var(--text-accent);
	}
	.here .rail-label {
		font-weight: 600;
	}
	.rail-area.current,
	.collapsed .rail-area.here {
		background: var(--background-modifier-hover);
		color: var(--text-accent);
	}
	.rail-label {
		flex: 1;
		min-width: 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.rail-chev {
		display: inline-flex;
		color: var(--text-faint);
	}
	.rail-chev :global(svg) {
		width: 14px;
		height: 14px;
	}
	.rail-pages {
		display: flex;
		flex-direction: column;
		padding: 0 0 6px 28px;
	}
	.rail-page {
		display: block;
		width: 100%;
		padding: 5px 10px;
		border-radius: 6px;
		font-size: 14px;
		line-height: 20px;
		color: var(--text-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.rail-page.current {
		background: var(--background-modifier-hover);
		color: var(--text-accent);
	}
	.rail-divider {
		height: 1px;
		margin: 4px 0 4px 10px;
		background: var(--background-modifier-border);
	}
	.rail-foot {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 10px 8px 18px;
		border-top: 1px solid var(--background-modifier-border);
	}
	.collapsed .rail-foot {
		padding: 8px 0;
		border-top: none;
	}
	.rail-status {
		flex: 1;
		min-width: 0;
		font-size: 11px;
		color: var(--text-faint);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.spin {
		display: inline-flex;
		animation: rail-spin 1s linear infinite;
	}
	@keyframes rail-spin {
		to {
			transform: rotate(360deg);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.spin {
			animation: none;
		}
	}
</style>
