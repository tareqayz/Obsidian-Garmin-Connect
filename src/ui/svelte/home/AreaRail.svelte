<script lang="ts">
	import { DIVIDER, type Area, type AreaEntry, type AreaId, type RailFocus } from "../../../dashboard/areas";
	import type { Route } from "../../../dashboard/routes";
	import { slide } from "svelte/transition";
	import { lucide } from "./lucide";

	/**
	 * A wide pane's navigation, down its left side: Home and the three areas,
	 * the one you are in opened to its pages with the page you are on lit.
	 * Collapsed it is a column of icons, named by Obsidian's tooltips. It stays
	 * put while the page scrolls, edge to edge in the pane. Sync is at the top
	 * right of each page instead. Collapsing and opening an area move, the
	 * labels kept in place and clipped, so the icons never jump.
	 */
	interface Props {
		areas: Area[];
		items: Record<AreaId, AreaEntry[]>;
		focus: RailFocus;
		/** On Home or an area's own page: that area's row is the one lit. */
		atRoot: boolean;
		collapsed: boolean;
		/** See All's editor is open: nothing here may leave it unsaved. */
		locked: boolean;
		onArea: (area: AreaId) => void;
		onItem: (route: Route) => void;
		onToggle: () => void;
	}

	let { areas, items, focus, atRoot, collapsed, locked, onArea, onItem, onToggle }: Props = $props();

	const calm = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	/** An area's pages unfold under it, as long as the rail takes to widen. */
	const unfold = () => ({ duration: calm() ? 0 : 200 });

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
		<span class="rail-title" aria-hidden={collapsed}>
			<span class="rail-icon" use:lucide={"watch"}></span>
			<strong>Garmin Connect</strong>
		</span>
		<button class="clickable-icon rail-toggle" aria-label={collapsed ? "Expand the sidebar" : "Collapse the sidebar"} onclick={onToggle}>
			<span class="toggle-icon" use:lucide={"chevrons-left"}></span>
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
				<span class="rail-label">{area.title}</span>
				{#if pages.length}<span class="rail-chev" class:open use:lucide={"chevron-right"}></span>{/if}
			</button>
			{#if open}
				<div class="rail-pages" transition:slide={unfold()}>
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
		/* Its rows start where the page does, below the view's padding, so the brand lines up with the page's title. */
		padding-top: var(--rail-pad-top);
		/* No background of its own: the view's shows through, as it does behind the page. */
		border-right: 1px solid var(--background-modifier-border);
		color: var(--text-normal);
		/* The labels stay in the row while it narrows: clipped, not wrapped. */
		overflow: hidden;
		--rail-move: 200ms cubic-bezier(0.2, 0, 0, 1);
		transition: width var(--rail-move);
	}
	.collapsed {
		width: 56px;
	}
	button {
		display: flex;
		align-items: center;
		/* Obsidian centres a button's content; a collapsed row's clipped label would then pull the icon off its place. */
		justify-content: flex-start;
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
	/* As tall as the page header beside it, so the two titles line up. */
	.rail-brand {
		display: flex;
		align-items: center;
		box-sizing: border-box;
		min-height: 49px;
		padding: 0 10px 0 18px;
		transition: padding var(--rail-move);
	}
	/* The toggle alone, centred: (56 − 30) / 2 each side. */
	.collapsed .rail-brand {
		padding: 0 13px;
	}
	.rail-title {
		display: flex;
		align-items: center;
		gap: 10px;
		flex: 1;
		min-width: 0;
		margin-right: 10px;
		overflow: hidden;
	}
	.collapsed .rail-title {
		margin-right: 0;
	}
	.rail-toggle {
		flex: none;
		box-sizing: border-box;
		width: 30px;
		justify-content: center;
	}
	.toggle-icon {
		display: inline-flex;
		transition: transform var(--rail-move);
	}
	.collapsed .toggle-icon {
		transform: rotate(180deg);
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
		overflow-x: hidden;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 4px 10px 8px;
		transition: gap var(--rail-move);
	}
	.collapsed .rail-areas {
		gap: 4px;
	}
	.rail-area {
		gap: 10px;
		width: 100%;
		padding: 8px 10px;
		border-radius: 6px;
		font-size: 15px;
		line-height: 20px;
		overflow: hidden;
		transition:
			padding var(--rail-move),
			border-radius var(--rail-move);
	}
	/* A 36 pt square around the icon, which stays where it was. */
	.collapsed .rail-area {
		padding: 8px 9px;
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
		flex: none;
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
	/* Words fade in once the rail has nearly widened, and out at once as it narrows. */
	.rail-title {
		transition:
			opacity 120ms ease 80ms,
			margin var(--rail-move);
	}
	.rail-label {
		transition: opacity 120ms ease 80ms;
	}
	.rail-chev {
		display: inline-flex;
		flex: none;
		color: var(--text-faint);
		transition:
			opacity 120ms ease 80ms,
			transform var(--rail-move);
	}
	.collapsed .rail-title,
	.collapsed .rail-label,
	.collapsed .rail-chev {
		opacity: 0;
	}
	.collapsed .rail-title {
		transition:
			opacity 80ms ease,
			margin var(--rail-move);
	}
	.collapsed .rail-label {
		transition: opacity 80ms ease;
	}
	.collapsed .rail-chev {
		transition:
			opacity 80ms ease,
			transform var(--rail-move);
	}
	.rail-chev.open {
		transform: rotate(90deg);
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
	@media (prefers-reduced-motion: reduce) {
		.gch-rail,
		.rail-brand,
		.rail-title,
		.toggle-icon,
		.rail-areas,
		.rail-area,
		.rail-label,
		.rail-chev,
		.collapsed .rail-title,
		.collapsed .rail-label,
		.collapsed .rail-chev {
			transition: none;
		}
	}
</style>
