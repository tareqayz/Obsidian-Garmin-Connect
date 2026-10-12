<script lang="ts" module>
	import type { HrvLegendItem } from "../../../dashboard/hrv-status-pages";
	import { toneColor } from "../home/tones";

	/** A legend's mark: a status's shape, the band's circle, the overnight dash, the timeline's line. */
	export type LegendMark = "circle" | "square" | "triangle" | "dash" | "line";

	export interface LegendEntry {
		label: string;
		mark: LegendMark;
		/** The shape's fill; the dash and the line take the text colour. */
		color?: string;
	}

	/** The 7-day Averages legend as entries: the statuses in their colours, the band, the overnight dash. */
	export function legendItems(items: readonly HrvLegendItem[]): LegendEntry[] {
		return items.map((item) => {
			if (item.kind === "status" && item.look) return { label: item.label, mark: item.look.shape, color: toneColor(item.look.tone) };
			if (item.kind === "baseline") return { label: item.label, mark: "circle", color: "var(--background-modifier-border)" };
			return { label: item.label, mark: "dash" };
		});
	}
</script>

<script lang="ts">
	import ShapeMarker from "../health/ShapeMarker.svelte";

	/**
	 * HRV Status's legend (twin Legend Item 507:46): a 16 pt mark and its
	 * Caption, 8 apart (the line 5), items 15.33 apart, rows 37.34 apart.
	 * The rows are the page's (`legendRows`), so the chart knows when the
	 * phone's legend takes a second one. Centred under a chart; from the
	 * left in a pane's side column.
	 */
	let { rows, align = "center" }: { rows: ReadonlyArray<readonly LegendEntry[]>; align?: "center" | "start" } = $props();
</script>

<div class="hrv-legend" class:start={align === "start"}>
	{#each rows as row, i (i)}
		<div class="row">
			{#each row as item (item.label)}
				<span class="item" class:line={item.mark === "line"}>
					{#if item.mark === "dash"}
						<svg class="icon" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
							<rect x="0" y="7" width="2.67" height="2" />
							<rect x="5.33" y="7" width="5.33" height="2" />
							<rect x="13.33" y="7" width="2.67" height="2" />
						</svg>
					{:else if item.mark === "line"}
						<svg class="icon" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><rect x="0" y="7" width="16" height="2" /></svg>
					{:else}
						<ShapeMarker shape={item.mark} color={item.color ?? "var(--text-faint)"} />
					{/if}
					{item.label}
				</span>
			{/each}
		</div>
	{/each}
</div>

<style>
	.hrv-legend {
		display: flex;
		flex-direction: column;
		gap: 21.34px;
	}
	.row {
		display: flex;
		justify-content: center;
		gap: 15.33px;
	}
	.start .row {
		justify-content: flex-start;
	}
	.item {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		height: 16px;
		font-size: 11px;
		line-height: 14px;
		color: var(--text-muted);
		white-space: nowrap;
	}
	.item.line {
		gap: 5px;
	}
	.icon {
		display: block;
		flex: none;
	}
	.icon rect {
		fill: var(--text-normal);
	}
</style>
