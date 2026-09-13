<script lang="ts">
	import type { Snippet } from "svelte";

	interface Props {
		id: string;
		title: string;
		/** The bits-ui primitive behind it, e.g. "ToggleGroup". */
		primitive: string;
		/** Where this would land in the plugin. The reason the demo exists. */
		use: string;
		/** What the keyboard/screen-reader behaviour buys, in one line. */
		gains: string;
		children: Snippet;
		/** The hand-rolled control it would replace, for a like-for-like look. */
		current?: Snippet;
		/** True for controls that own a full row — a settings toggle, a slider. */
		fill?: boolean;
		/** What the left pane is showing today. */
		currentLabel?: string;
		/** What the right pane is proposing. Not every demo is a bits-ui swap. */
		nextLabel?: string;
	}

	let {
		id,
		title,
		primitive,
		use,
		gains,
		children,
		current,
		fill = false,
		currentLabel = "Today — hand-rolled",
		nextLabel = "With bits-ui",
	}: Props = $props();
</script>

<section {id}>
	<header>
		<h3>{title}</h3>
		<code>{primitive}</code>
	</header>
	<p class="use">{use}</p>

	<div class="stage" class:split={current}>
		{#if current}
			<div class="pane">
				<div class="tag">{currentLabel}</div>
				<div class="live" class:fill>{@render current()}</div>
			</div>
		{/if}
		<div class="pane">
			{#if current}<div class="tag accent">{nextLabel}</div>{/if}
			<div class="live" class:fill>{@render children()}</div>
		</div>
	</div>

	<p class="gains"><span aria-hidden="true">↳</span> {gains}</p>
</section>

<style>
	section {
		border: 1px solid var(--gcd-border);
		border-radius: var(--gcd-radius, 8px);
		background: var(--gcd-surface);
		padding: 14px 16px 12px;
		scroll-margin-top: 12px;
	}
	header {
		display: flex;
		align-items: baseline;
		gap: 8px;
		flex-wrap: wrap;
	}
	h3 {
		margin: 0;
		font-size: var(--font-ui-medium, 15px);
		font-weight: 600;
	}
	code {
		margin-left: auto;
		padding: 1px 6px;
		border-radius: 4px;
		background: var(--gcd-raised);
		color: var(--gcd-muted);
		font-size: 11px;
	}
	.use {
		margin: 4px 0 12px;
		color: var(--gcd-muted);
		font-size: var(--font-ui-smaller, 12px);
		line-height: 1.5;
	}
	.stage.split {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
		gap: 12px;
	}
	.pane {
		min-width: 0;
	}
	.tag {
		margin-bottom: 6px;
		color: var(--gcd-muted);
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	.tag.accent {
		color: var(--gcd-series);
	}
	.live {
		padding: 12px;
		border-radius: 6px;
		background: var(--gcd-raised);
		min-height: 44px;
		display: flex;
		flex-direction: column;
		justify-content: center;
		/* Inline controls keep their natural width; a button stretched across
		   the pane would not look like the button that ships. */
		align-items: flex-start;
	}
	.live.fill {
		align-items: stretch;
	}
	.live.fill > :global(*) {
		min-width: 0;
	}
	.gains {
		margin: 12px 0 0;
		color: var(--gcd-muted);
		font-size: 11px;
		line-height: 1.5;
	}
	.gains span {
		color: var(--gcd-series);
	}
</style>
