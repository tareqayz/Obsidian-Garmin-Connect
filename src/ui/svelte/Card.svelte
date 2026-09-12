<script lang="ts">
	import type { Snippet } from "svelte";

	interface Props {
		title: string;
		subtitle?: string;
		/** Shown behind the "i" button. Omit and no button appears. */
		info?: string;
		expanded?: boolean;
		onExpand?: () => void;
		onCollapse?: () => void;
		children: Snippet;
		/** Extra content shown only while expanded, e.g. summary statistics. */
		detail?: Snippet;
	}

	let { title, subtitle, info, expanded = false, onExpand, onCollapse, children, detail }: Props =
		$props();

	let showInfo = $state(false);
</script>

<section class="card" class:expanded>
	<header>
		<div class="heading">
			<div class="title">{title}</div>
			{#if subtitle}<div class="sub">{subtitle}</div>{/if}
		</div>

		<div class="tools">
			{#if info}
				<button
					class="icon"
					class:on={showInfo}
					aria-expanded={showInfo}
					aria-label="About {title}"
					title="About {title}"
					onclick={() => (showInfo = !showInfo)}>i</button
				>
			{/if}
			{#if expanded && onCollapse}
				<button class="icon" aria-label="Back to all charts" title="Back" onclick={onCollapse}>
					↩
				</button>
			{:else if onExpand}
				<button class="icon" aria-label="Expand {title}" title="Expand" onclick={onExpand}>⤢</button>
			{/if}
		</div>
	</header>

	{#if showInfo && info}
		<p class="info">{info}</p>
	{/if}

	<div class="body">{@render children()}</div>

	{#if expanded && detail}
		{@render detail()}
	{/if}
</section>

<style>
	.card {
		border: 1px solid var(--gcd-border);
		border-radius: 8px;
		background: var(--gcd-surface);
		padding: 12px 14px 8px;
		min-width: 0;
	}
	header {
		display: flex;
		align-items: flex-start;
		gap: 8px;
		margin-bottom: 6px;
	}
	.heading {
		min-width: 0;
	}
	.title {
		font-weight: 600;
	}
	.sub {
		color: var(--gcd-muted);
		font-size: var(--font-ui-smaller, 12px);
	}
	.tools {
		margin-left: auto;
		display: flex;
		gap: 4px;
		flex: none;
	}
	.icon {
		width: 22px;
		height: 22px;
		padding: 0;
		border-radius: 50%;
		border: 1px solid var(--gcd-border);
		background: transparent;
		color: var(--gcd-muted);
		font-size: 11px;
		line-height: 1;
		cursor: pointer;
		box-shadow: none;
	}
	.icon:hover,
	.icon.on {
		background: var(--gcd-raised);
		color: var(--gcd-text);
	}
	.info {
		margin: 0 0 10px;
		padding: 8px 10px;
		background: var(--gcd-raised);
		border-radius: 6px;
		color: var(--gcd-muted);
		font-size: var(--font-ui-smaller, 12px);
		line-height: 1.5;
	}
	.body {
		position: relative;
	}
</style>
