<script lang="ts">
	import type { MapLegend } from "../../../../dashboard/activity-map";

	/**
	 * The pill that says what the route's colours mean: "Slower" over Garmin's
	 * ten-slot ramp to "Faster" for pace ("Less Power" over a ride's seven power
	 * zones to "More Power"), or a swatch per colour for Run/Walk.
	 * One style on every map, from the Obsidian theme (the twin's Pace Legend);
	 * only the ramp keeps Garmin's colours, which are the data.
	 */
	let { legend }: { legend: MapLegend } = $props();

	/** Each colour of the ramp is 8 pt wide: the run's ten make 80, a ride's seven power zones 56. */
	const SLOT = 8;
</script>

<div class="gc-legend">
	{#if legend.kind === "ramp"}
		<span>{legend.low}</span>
		<span class="ramp" style:width="{legend.colors.length * SLOT}px">
			{#each legend.colors as color, i (i)}<span style:background={color}></span>{/each}
		</span>
		<span>{legend.high}</span>
	{:else}
		{#each legend.keys as key (key.label)}
			<span class="key"><span class="swatch" style:background={key.color}></span>{key.label}</span>
		{/each}
	{/if}
</div>

<style>
	.gc-legend {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		box-sizing: border-box;
		height: 26px;
		padding: 0 10px;
		border: 1px solid var(--background-modifier-border);
		border-radius: 13px;
		background: var(--background-primary);
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.12);
		color: var(--text-normal);
		font-size: 11px;
		line-height: 14px;
		white-space: nowrap;
	}
	.ramp {
		display: flex;
		height: 8px;
	}
	.ramp > span {
		flex: 1 1 0;
	}
	.key {
		display: inline-flex;
		align-items: center;
		gap: 4px;
	}
	.key + .key {
		margin-left: 4px;
	}
	.swatch {
		width: 8px;
		height: 8px;
		border-radius: 50%;
	}
</style>
