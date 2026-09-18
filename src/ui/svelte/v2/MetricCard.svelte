<script lang="ts">
	import type { Snippet } from "svelte";

	interface Props {
		title: string;
		subtitle?: string;
		/**
		 * The headline number, promoted into the header. In v1 you had to read
		 * the latest value off the end of the line.
		 */
		readout?: string;
		readoutUnit?: string;
		children: Snippet;
	}

	let { title, subtitle, readout, readoutUnit, children }: Props = $props();
</script>

<section class="card">
	<header>
		<div class="heading">
			<div class="title">{title}</div>
			{#if subtitle}<div class="sub">{subtitle}</div>{/if}
		</div>
		{#if readout}
			<div class="readout">
				<span class="value">{readout}</span>
				{#if readoutUnit}<span class="unit">{readoutUnit}</span>{/if}
			</div>
		{/if}
	</header>

	<div class="body">{@render children()}</div>
</section>

<style>
	/* Elevation replaces v1's hairline border. A shadow needs a surface to be
	   raised from, which is why the v2 views set --v2-surface-app behind this. */
	.card {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 14px 16px;
		border-radius: 12px;
		background: var(--v2-surface-card);
		box-shadow: var(--v2-shadow-1);
		min-width: 0;
	}
	header {
		display: flex;
		align-items: flex-start;
		gap: 12px;
	}
	.heading {
		display: flex;
		flex-direction: column;
		gap: 1px;
		flex: 1;
		min-width: 0;
	}
	.title {
		font-size: 15px;
		font-weight: 600;
		line-height: 1.4;
		color: var(--gcd-text);
	}
	.sub {
		font-size: 12px;
		color: var(--v2-muted);
	}
	.readout {
		display: flex;
		align-items: baseline;
		gap: 4px;
		flex: none;
	}
	.readout .value {
		font-size: 24px;
		font-weight: 600;
		line-height: 1.15;
		color: var(--gcd-text);
	}
	.readout .unit {
		font-size: 12px;
		color: var(--v2-muted);
	}
	.body {
		min-width: 0;
	}
</style>
