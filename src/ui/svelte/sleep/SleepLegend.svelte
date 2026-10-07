<script lang="ts" module>
	export interface LegendEntry {
		kind: "dot" | "square" | "line" | "dashed" | "hatch" | "tick" | "box" | "ring";
		label: string;
		/** A CSS colour for the swatch; text colour when absent. */
		color?: string;
		faded?: boolean;
	}
</script>

<script lang="ts">
	/** A chart's key, centred under it: a swatch and a word for each mark. */
	let { items }: { items: LegendEntry[] } = $props();
</script>

<div class="sleep-legend">
	{#each items as item (item.label)}
		<span class="entry">
			<svg class="swatch" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" style:color={item.color ?? "var(--text-normal)"} style:opacity={item.faded ? 0.7 : 1}>
				{#if item.kind === "dot"}<circle cx="8" cy="8" r="8" fill="currentColor" />
				{:else if item.kind === "square"}<rect x="1" y="1" width="14" height="14" fill="currentColor" />
				{:else if item.kind === "line"}<rect x="0" y="7" width="16" height="2" fill="currentColor" />
				{:else if item.kind === "dashed"}<path d="M0 8 H16" stroke="currentColor" stroke-width="2" stroke-dasharray="3 3" />
				{:else if item.kind === "hatch"}<path d="M0.5 15.5 L15.5 0.5 M0.5 9.5 L9.5 0.5 M6.5 15.5 L15.5 6.5 M0.5 3.5 L3.5 0.5 M12.5 15.5 L15.5 12.5" stroke="currentColor" stroke-width="1.6" fill="none" />
				{:else if item.kind === "tick"}<rect x="7" y="0" width="2" height="16" fill="currentColor" />
				{:else if item.kind === "box"}<rect x="0.75" y="0.75" width="14.5" height="14.5" fill="none" stroke="currentColor" stroke-width="1.5" />
				{:else}<circle cx="8" cy="8" r="7.25" fill="none" stroke="currentColor" stroke-width="1.5" />{/if}
			</svg>
			<span class="label">{item.label}</span>
		</span>
	{/each}
</div>

<style>
	.sleep-legend {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 16px;
		padding: 0 16px;
	}
	.entry {
		display: inline-flex;
		align-items: center;
		gap: 9px;
	}
	.swatch {
		flex: none;
		display: block;
	}
	.label {
		font-size: 12px;
		line-height: 16px;
		color: var(--text-muted);
		white-space: nowrap;
	}
	/* A pane's 370pt columns fit a three-item key on one line without the phone's gutter. */
	@container (min-width: 1000px) {
		.sleep-legend {
			padding: 0;
		}
	}
</style>
