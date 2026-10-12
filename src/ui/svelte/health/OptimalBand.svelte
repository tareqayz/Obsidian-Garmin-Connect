<svelte:options namespace="svg" />

<script lang="ts">
	/**
	 * The optimal band inside a chart's SVG (twin Optimal Band 443:481):
	 * Garmin's green gradient as the theme's green at 35 % layer opacity,
	 * or, muted, the flat border grey the gridlines use. The outline is the
	 * stat's: Load's Acute Load draws a per-day area through 0.8× and 1.5×
	 * the chronic load, Load Ratio a 0.8–1.5 rectangle; Training Readiness'
	 * Acute Load sheet draws the acute one too. Drawn over the gridlines.
	 */
	interface Props {
		/** The band's outline, one or more closed subpaths; nothing is drawn for an empty one. */
		d: string;
		/** The Chronic Load chip is on: the band steps back. */
		muted?: boolean;
	}

	let { d, muted = false }: Props = $props();
</script>

{#if d}
	<path class="optimal-band" class:muted {d} />
{/if}

<style>
	.optimal-band {
		fill: var(--color-green);
		opacity: 0.35;
	}
	.muted {
		fill: var(--background-modifier-border);
		opacity: 1;
	}
</style>
