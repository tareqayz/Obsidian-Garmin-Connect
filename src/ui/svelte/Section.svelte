<script lang="ts">
	import type { Snippet } from "svelte";

	interface Props {
		title: string;
		/** How many cards are inside, shown while collapsed. */
		count: number;
		open: boolean;
		onToggle: () => void;
		children: Snippet;
	}

	let { title, count, open, onToggle, children }: Props = $props();
</script>

<!-- With thirty metrics on one pane, sections are what make it a dashboard
     rather than a wall. Collapsed state is per-view and deliberately not saved:
     it is a reading aid, not a preference. -->
<section class="section">
	<button class="header" aria-expanded={open} onclick={onToggle}>
		<span class="chevron" class:open>›</span>
		<span class="title">{title}</span>
		<span class="count">{count}</span>
	</button>
	{#if open}
		<div class="content">{@render children()}</div>
	{/if}
</section>

<style>
	.section {
		margin-bottom: 18px;
	}
	.header {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		padding: 4px 0 8px;
		background: transparent;
		border: none;
		border-bottom: 1px solid var(--gcd-border);
		color: var(--gcd-text);
		cursor: pointer;
		box-shadow: none;
		text-align: left;
		margin-bottom: 12px;
	}
	.header:hover .title {
		color: var(--gcd-series);
	}
	.chevron {
		display: inline-block;
		color: var(--gcd-muted);
		transition: transform 120ms ease;
		font-size: 15px;
		line-height: 1;
	}
	.chevron.open {
		transform: rotate(90deg);
	}
	.title {
		font-weight: 600;
		font-size: var(--font-ui-small, 13px);
		letter-spacing: 0.02em;
		text-transform: uppercase;
	}
	.count {
		margin-left: auto;
		color: var(--gcd-muted);
		font-size: var(--font-ui-smaller, 12px);
		font-variant-numeric: tabular-nums;
	}
	.content {
		display: grid;
		gap: 14px;
	}
</style>
