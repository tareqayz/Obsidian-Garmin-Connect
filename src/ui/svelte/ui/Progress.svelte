<script lang="ts">
	interface Props {
		value: number;
		max: number;
		/** Names the bar for screen readers, e.g. "Garmin sync". */
		label: string;
		/** Visible text beside the bar. Omit for a bare track. */
		caption?: string;
	}

	let { value, max, label, caption }: Props = $props();

	let fraction = $derived(max > 0 ? Math.min(1, Math.max(0, value / max)) : 0);
</script>

<!--
	Hand-rolled rather than bits-ui: Progress and Meter together cost ~30 KB of
	bits-ui's shared internals, and neither needs the focus management, floating
	positioning or presence tracking that weight buys. The floating components in
	this folder do. See the UI gallery section of the README.
-->
<div class="wrap">
	<div
		class="track"
		role="progressbar"
		aria-label={label}
		aria-valuemin={0}
		aria-valuemax={max}
		aria-valuenow={value}
	>
		<div class="fill" style:width="{fraction * 100}%"></div>
	</div>
	{#if caption}<div class="caption">{caption}</div>{/if}
</div>

<style>
	.wrap {
		display: flex;
		align-items: center;
		gap: 8px;
		min-width: 0;
	}
	.track {
		flex: 1 1 auto;
		min-width: 60px;
		height: 4px;
		border-radius: 999px;
		background: var(--gcd-raised);
		border: 1px solid var(--gcd-border);
		overflow: hidden;
	}
	.fill {
		height: 100%;
		background: var(--gcd-series);
		/* Long backfills tick once per day fetched; easing the width stops the
		   bar from strobing on a fast range. */
		transition: width 180ms ease-out;
	}
	.caption {
		flex: none;
		color: var(--gcd-muted);
		font-size: var(--font-ui-smaller, 12px);
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}
</style>
