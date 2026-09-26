<script lang="ts">
	import type { Snippet } from "svelte";
	import { lucide } from "./lucide";

	interface Props {
		title?: string;
		icon?: string;
		/** The icon's colour, as a CSS colour. */
		accent?: string;
		/** `focus` is the tall In Focus card, `glance` the At a Glance stat card. */
		kind?: "plain" | "focus" | "glance";
		/** Shown instead of the body when there is nothing synced for this card. */
		empty?: boolean;
		/** What the empty state says; not every card's data is per day. */
		emptyText?: string;
		children?: Snippet;
		aside?: Snippet;
	}

	let { title, icon, accent, kind = "plain", empty = false, emptyText = "No data synced for today yet.", children, aside }: Props =
		$props();
</script>

<article class="gch-card {kind}">
	{#if title}
		<header>
			{#if icon}<span class="icon" style:color={accent} use:lucide={icon}></span>{/if}
			<span class="title">{title}</span>
			{#if aside}<span class="aside">{@render aside()}</span>{/if}
		</header>
	{/if}
	{#if empty}
		<div class="none">{emptyText}</div>
	{:else if children}
		{@render children()}
	{/if}
</article>

<style>
	/* Not ".card": Obsidian styles that class globally, with a 10px side
	   margin that widened the grid's column gap past its row gap, and a border
	   the Figma cards do not have. */
	.gch-card {
		background: var(--background-secondary);
		border-radius: var(--radius-m, 8px);
		padding: 16px;
		margin: 0;
		display: flex;
		flex-direction: column;
		min-width: 0;
		box-sizing: border-box;
		color: var(--text-normal);
	}
	.focus {
		min-height: 318px;
	}
	.glance {
		min-height: 281px;
		padding: 16px 12px 12px;
		border-radius: 6px;
	}
	header {
		display: flex;
		align-items: flex-start;
		gap: 10px;
		font-size: 14px;
		line-height: 18px;
		margin-bottom: 12px;
	}
	.glance header {
		font-size: 13px;
		line-height: 16px;
	}
	.icon {
		display: inline-flex;
		flex: none;
		width: 20px;
		height: 20px;
	}
	.icon :global(svg) {
		width: 20px;
		height: 20px;
	}
	.title {
		flex: 1;
		min-width: 0;
		padding-top: 1px;
	}
	.aside {
		flex: none;
	}
	.none {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--text-faint);
		font-size: 13px;
		text-align: center;
	}
</style>
