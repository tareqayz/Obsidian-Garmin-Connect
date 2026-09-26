<script lang="ts">
	import HomeCard from "./HomeCard.svelte";
	import { lucide } from "./lucide";

	/**
	 * Garmin's prompt card for a stat with nothing to show yet: a round grey
	 * icon, the stat's name, what to do about it, and sometimes a link.
	 */
	interface Props {
		icon: string;
		/** The icon's colour, as a CSS colour. */
		color?: string;
		title: string;
		body: string;
		link?: { label: string; href: string };
	}

	let { icon, color, title, body, link }: Props = $props();
</script>

<HomeCard kind="glance">
	<div class="prompt-body">
		<span class="circle" style:color use:lucide={icon}></span>
		<div class="title">{title}</div>
		<div class="body">{body}</div>
		{#if link}<a class="link" href={link.href}>{link.label}</a>{/if}
	</div>
</HomeCard>

<style>
	/* Not ".prompt": that is Obsidian's command palette. */
	.prompt-body {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-align: center;
		/* The app sits the block a little above centre. */
		padding-bottom: 40px;
	}
	.circle {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 47px;
		height: 47px;
		border-radius: 50%;
		background: var(--background-modifier-border);
		color: var(--text-normal);
	}
	.circle :global(svg) {
		width: 24px;
		height: 24px;
	}
	.title {
		font-size: 15px;
		line-height: 20px;
		margin-top: 16px;
	}
	.body {
		color: var(--text-muted);
		font-size: 15px;
		line-height: 20px;
		margin-top: 2px;
	}
	.link {
		color: var(--text-accent);
		font-size: 15px;
		line-height: 20px;
		margin-top: 8px;
		text-decoration: none;
	}
</style>
