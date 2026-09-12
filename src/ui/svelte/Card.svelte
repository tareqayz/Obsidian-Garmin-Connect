<script lang="ts">
	import type { Snippet } from "svelte";

	interface Props {
		title: string;
		subtitle?: string;
		children: Snippet;
	}

	let { title, subtitle, children }: Props = $props();
</script>

<section class="card">
	<header>
		<div class="title">{title}</div>
		{#if subtitle}<div class="sub">{subtitle}</div>{/if}
	</header>
	<div class="body">{@render children()}</div>
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
		margin-bottom: 6px;
	}
	.title {
		font-weight: 600;
	}
	.sub {
		color: var(--gcd-muted);
		font-size: var(--font-ui-smaller, 12px);
	}
	.body {
		position: relative;
	}
</style>
