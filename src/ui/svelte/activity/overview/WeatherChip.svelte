<script lang="ts">
	import type { WeatherChip } from "../../../../dashboard/activity-overview";
	import { lucide } from "../../home/lucide";

	/**
	 * The weather over the Overview map: the temperature, the sky's glyph and
	 * the wind dial — its speed in the ring and a pointer on the ring where the
	 * wind came from, pointing in. The pill is the theme's; the sun keeps its
	 * orange.
	 */
	let { chip }: { chip: WeatherChip } = $props();

	const ICONS: Record<WeatherChip["icon"], string> = { sun: "sun", moon: "moon", cloud: "cloud", rain: "cloud-rain" };
</script>

<div class="gc-weather" class:no-dial={chip.wind === undefined}>
	<span class="temp">{chip.temp}</span>
	<span class="sky is-{chip.icon}" use:lucide={ICONS[chip.icon]}></span>
	{#if chip.wind !== undefined}
		<svg class="dial" width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
			<circle class="ring" cx="13" cy="13" r="10.375" />
			<text class="speed" x="13" y="13.5" text-anchor="middle" dominant-baseline="middle">{chip.wind}</text>
			{#if chip.windFrom !== undefined}
				<!-- Drawn at north, base on the ring and tip inward, then turned to the bearing. -->
				<path class="pointer" d="M10.2 0.6 L15.8 0.6 L13 4.8 Z" transform="rotate({chip.windFrom} 13 13)" />
			{/if}
		</svg>
	{/if}
</div>

<style>
	.gc-weather {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		box-sizing: border-box;
		height: 32px;
		padding: 0 3px 0 10px;
		border: 1px solid var(--background-modifier-border);
		border-radius: 16px;
		background: var(--background-primary);
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.12);
		color: var(--text-normal);
	}
	.gc-weather.no-dial {
		padding-right: 10px;
	}
	.temp {
		font-size: 17px;
		line-height: 22px;
		font-variant-numeric: tabular-nums;
	}
	.sky {
		display: inline-flex;
		color: var(--text-muted);
	}
	.sky.is-sun {
		color: var(--color-orange);
	}
	.sky.is-rain {
		color: var(--color-blue);
	}
	.sky :global(svg) {
		width: 20px;
		height: 20px;
	}
	.dial {
		flex: none;
		overflow: visible;
	}
	.ring {
		fill: none;
		stroke: var(--text-muted);
		stroke-width: 1.25;
	}
	.speed {
		fill: var(--text-normal);
		font-size: 11px;
		font-weight: 500;
	}
	.pointer {
		fill: var(--text-normal);
		stroke: var(--text-normal);
		stroke-width: 1;
		stroke-linejoin: round;
	}
</style>
