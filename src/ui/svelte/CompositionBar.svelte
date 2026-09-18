<script lang="ts">
	import { compact } from "../../dashboard/series";

	export interface Segment {
		key: string;
		label: string;
		value: number;
		/** 1-4, the ordinal blue ramp. Composition parts are ordered, not unrelated. */
		step: number;
	}

	interface Props {
		segments: readonly Segment[];
		unit?: string;
		/** Rendered under the bar; omit and the total is used. */
		caption?: string;
	}

	let { segments, unit = "", caption }: Props = $props();

	let present = $derived(segments.filter((s) => s.value > 0));
	let total = $derived(present.reduce((sum, s) => sum + s.value, 0));
	let hovered = $state<string | null>(null);

	function share(value: number): number {
		return total > 0 ? (value / total) * 100 : 0;
	}
</script>

<!-- One whole split into ordered parts, so it is a single bar rather than a
     column chart: the question is proportion, not comparison across days. -->
<div class="composition">
	{#if present.length > 0}
		<!-- The legend below says the same thing in words, so the bar itself only
		     needs each part to name what it is. -->
		<div class="bar">
			{#each present as segment (segment.key)}
				<span
					class="part"
					class:dim={hovered !== null && hovered !== segment.key}
					style:width="{share(segment.value)}%"
					style:background="var(--gcd-stage-{segment.step})"
					role="img"
					aria-label="{segment.label} — {compact(segment.value)}{unit}"
					title="{segment.label} — {compact(segment.value)}{unit}"
					onmouseenter={() => (hovered = segment.key)}
					onmouseleave={() => (hovered = null)}
				></span>
			{/each}
		</div>

		<div class="legend">
			{#each present as segment (segment.key)}
				<span class="item" class:dim={hovered !== null && hovered !== segment.key}>
					<span class="swatch" style:background="var(--gcd-stage-{segment.step})"></span>
					<span class="label">{segment.label}</span>
					<span class="value">{compact(segment.value)}{unit}</span>
					<span class="pct">{Math.round(share(segment.value))}%</span>
				</span>
			{/each}
		</div>

		{#if caption}<p class="caption">{caption}</p>{/if}
	{:else}
		<p class="caption">No breakdown for this day.</p>
	{/if}
</div>

<style>
	.bar {
		display: flex;
		width: 100%;
		height: 14px;
		border-radius: 3px;
		overflow: hidden;
		/* The gap between parts is the surface showing through, never a stroke. */
		gap: 2px;
		background: var(--gcd-grid);
	}
	.part {
		display: block;
		height: 100%;
		min-width: 2px;
		transition: opacity 120ms ease;
	}
	.dim {
		opacity: 0.4;
	}
	.legend {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
		gap: 2px 14px;
		margin-top: 10px;
		font-size: var(--font-ui-smaller, 12px);
	}
	.item {
		display: inline-flex;
		align-items: baseline;
		gap: 6px;
		min-width: 0;
		transition: opacity 120ms ease;
	}
	.swatch {
		width: 9px;
		height: 9px;
		border-radius: 2px;
		flex: none;
		transform: translateY(-1px);
	}
	.label {
		color: var(--gcd-muted);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.value {
		margin-left: auto;
		font-variant-numeric: tabular-nums;
		font-weight: 600;
	}
	.pct {
		color: var(--gcd-muted);
		font-variant-numeric: tabular-nums;
		min-width: 30px;
		text-align: right;
	}
	.caption {
		margin: 8px 0 0;
		color: var(--gcd-muted);
		font-size: var(--font-ui-smaller, 12px);
	}
</style>
