<script lang="ts">
	import type { Snippet } from "svelte";
	import { lucide } from "../../home/lucide";

	/**
	 * One of the Filters sheet's sections: a 54-tall row, its title and a
	 * chevron (down closed, up open), and below it, while open, the section.
	 * Each opens and closes on its own; several may be open at once.
	 */
	interface Props {
		title: string;
		open: boolean;
		onToggle: () => void;
		children: Snippet;
	}

	let { title, open, onToggle, children }: Props = $props();
</script>

<section class="section">
	<button class="head" aria-expanded={open} onclick={onToggle}>
		<span class="title">{title}</span>
		<span class="chev" use:lucide={open ? "chevron-up" : "chevron-down"}></span>
	</button>
	{#if open}<div class="content">{@render children()}</div>{/if}
</section>

<style>
	.section {
		background: var(--background-primary);
	}
	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		box-sizing: border-box;
		width: 100%;
		height: 54px;
		margin: 0;
		padding: 0 16px;
		border: none;
		border-radius: 0;
		box-shadow: none;
		background: none;
		color: var(--text-normal);
		font: inherit;
		text-align: left;
		cursor: pointer;
	}
	.title {
		font-size: 17px;
		line-height: 22px;
	}
	.chev {
		display: inline-flex;
		color: var(--text-muted);
	}
	.chev :global(svg) {
		width: 18px;
		height: 18px;
	}
	.content {
		padding-bottom: 16px;
	}
</style>
