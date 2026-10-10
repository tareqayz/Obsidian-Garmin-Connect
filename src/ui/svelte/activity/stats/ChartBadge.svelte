<script lang="ts">
	/**
	 * The Chart Badge (Figma 402:33): Garmin's waveform badge, a ring round a
	 * pulse. The paths are the Figma asset's; its strokes are bound to
	 * text-accent there and take the accent here through currentColor, so the
	 * badge follows the theme. The button that holds it sets the colour.
	 */
</script>

<svg class="chart-badge" width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
	<path
		d="M10 18.6C14.7496 18.6 18.6 14.7496 18.6 10C18.6 5.25035 14.7496 1.4 10 1.4C5.25035 1.4 1.4 5.25035 1.4 10C1.4 14.7496 5.25035 18.6 10 18.6Z"
		stroke="currentColor"
		stroke-width="1.3"
	/>
	<path d="M15 10H13L11.5 14.2L8.5 5.8L7 10H5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
</svg>

<style>
	.chart-badge {
		display: block;
		flex: none;
	}
</style>
