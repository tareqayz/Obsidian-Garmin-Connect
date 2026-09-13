<script lang="ts">
	interface Props {
		value: number;
		max: number;
		/** Names the meter for screen readers, e.g. "Steps against goal". */
		label: string;
		/** Visible text under the bar. Omit for a bare track. */
		caption?: string;
	}

	let { value, max, label, caption }: Props = $props();

	// Past the goal the bar stays full; the caption carries the overshoot.
	let fraction = $derived(max > 0 ? Math.min(1, Math.max(0, value / max)) : 0);
	let met = $derived(max > 0 && value >= max);
</script>

<!--
	A meter, not a progress bar: this is a measurement inside a known range, not
	a task advancing. `role="meter"` says so. Hand-rolled for the same reason as
	Progress — see the comment there.
-->
<div class="wrap">
	<div
		class="track"
		class:met
		role="meter"
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
		min-width: 0;
	}
	.track {
		height: 3px;
		border-radius: 999px;
		background: var(--gcd-raised);
		overflow: hidden;
	}
	.fill {
		height: 100%;
		background: var(--gcd-series);
		transition: width 180ms ease-out;
	}
	/* Hitting the goal is the whole point of showing it, so it changes colour
	   rather than just filling the track. */
	.track.met .fill {
		background: var(--gcd-good);
	}
	.caption {
		margin-top: 3px;
		color: var(--gcd-muted);
		font-size: var(--font-ui-smaller, 12px);
		white-space: nowrap;
	}
</style>
