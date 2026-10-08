<script lang="ts">
	import { gaugeArcs } from "../../../dashboard/pulse-ox-charts";
	import type { Spo2Band } from "../../../dashboard/pulse-ox-pages";

	/**
	 * The open 270° gauge: four band arcs, coloured once there is a value
	 * (Inferred: the twin only has the empty grey one), the value and its
	 * label in the middle when `label` is given.
	 */
	let { value, size = 180, stroke = 8, label }: { value?: number; size?: number; stroke?: number; label?: string } = $props();

	let arcs = $derived(gaugeArcs(size, stroke));
	const colour = (band: Spo2Band) => `var(--spo2-${band})`;
</script>

<span class="spo2-gauge" style:width="{size}px" style:height="{size}px">
	<svg width={size} height={size} aria-hidden="true">
		{#each arcs as a (a.band)}
			<path d={a.d} fill="none" stroke-width={stroke} stroke={value === undefined ? "var(--spo2-none)" : colour(a.band)} />
		{/each}
	</svg>
	{#if label}
		<span class="centre">
			<span class="value">{value === undefined ? "--" : value}</span>
			<span class="label">{label}</span>
		</span>
	{/if}
</span>

<style>
	.spo2-gauge {
		position: relative;
		display: inline-block;
		flex: none;
	}
	svg {
		display: block;
	}
	.centre {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 4px;
	}
	.value {
		font-size: 34px;
		line-height: 40px;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}
	.label {
		font-size: 13px;
		color: var(--text-muted);
	}
</style>
