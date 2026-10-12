<script lang="ts">
	import { NO_DATA } from "../../../dashboard/hrv-status-copy";
	import { MARK, averagesFrame, averagesPlot } from "../../../dashboard/hrv-status-charts";
	import { SEVEN_DAY_AVERAGES, type HrvAverages } from "../../../dashboard/hrv-status-pages";
	import { PANE_COLUMN, PHONE } from "../../../dashboard/stat-charts";
	import { toneColor } from "../home/tones";

	/**
	 * "7-day Averages" (twin 508:96058 / 508:96408, panes 512:2159 /
	 * 512:2295): 1 pt gridlines labelled with their floor, the baseline band
	 * over them, the overnight averages dashed while the chip is on, a mark a
	 * night shaped and coloured by its status, and the day axis. The box is
	 * the twin's at any width; on the phone it gives a second legend row its
	 * room (`rows`). A period without a night keeps the box and says so.
	 */
	interface Props {
		chart: HrvAverages | null;
		range: "7d" | "4w";
		pane: boolean;
		/** The phone legend's rows under the chart; a pane's legend is beside it. */
		rows: number;
	}

	let { chart, range, pane, rows }: Props = $props();

	let measured = $state(0);
	let width = $derived(measured || (pane ? PANE_COLUMN : PHONE));
	let taken = $derived(pane ? 1 : rows);
	let p = $derived(averagesPlot(chart, range, width, taken));
	let frame = $derived(averagesFrame(range, taken));
</script>

<figure class="hrv-averages">
	<figcaption>{SEVEN_DAY_AVERAGES}</figcaption>
	<div class="canvas" bind:clientWidth={measured} style:height="{p.height}px">
		{#if chart}
			<!-- The cards under the chart carry every night's figures. -->
			<svg width={p.width} height={p.height} aria-hidden="true">
				{#each p.grid as line, i (i)}
					<line class="grid" x1={line.x1} x2={line.x2} y1={line.y} y2={line.y} />
					<text class="tick" x={p.labelRight} y={line.y} text-anchor="end" dominant-baseline="central">{line.label}</text>
				{/each}
				{#each p.band as d, i (i)}<path class="band" {d} />{/each}
				{#if p.overnight}<path class="overnight" d={p.overnight} />{/if}
				{#each p.dots as dot, i (i)}<circle class="axis-dot" cx={dot.x} cy={dot.y} r={dot.r} />{/each}
				{#each p.labels as label (label.text)}
					<text class="axis" x={label.x} y={label.y} text-anchor="middle" dominant-baseline="central">{label.text}</text>
				{/each}
				{#each p.points as point (point.date)}
					{#if point.shape === "circle"}
						<circle cx={point.x} cy={point.y} r={MARK.radius} fill={toneColor(point.tone)} />
					{:else}
						<path d={point.d} fill={toneColor(point.tone)} />
					{/if}
				{/each}
			</svg>
		{:else}
			<div class="empty" style:top="{frame.top}px" style:height="{frame.bottom - frame.top}px">
				<strong>{NO_DATA.title}</strong>
				<span>{NO_DATA.text}</span>
			</div>
		{/if}
	</div>
</figure>

<style>
	.hrv-averages {
		margin: 0;
		min-width: 0;
	}
	/* The twin's chart title: 20/24, 41.49 over the box. */
	figcaption {
		margin-bottom: 41.49px;
		padding-left: 16px;
		font-size: 20px;
		line-height: 24px;
		color: var(--text-normal);
	}
	.canvas {
		position: relative;
	}
	svg {
		display: block;
		overflow: visible;
	}
	.grid {
		stroke: var(--background-modifier-border);
		stroke-width: 1;
	}
	.tick,
	.axis {
		fill: var(--text-muted);
		font-size: 10px;
	}
	/* The band hides the gridlines it crosses, as the app's does. */
	.band {
		fill: var(--background-modifier-border);
	}
	.overnight {
		fill: none;
		stroke: var(--text-normal);
		stroke-width: 1.5;
		stroke-dasharray: 3 2.5;
	}
	.axis-dot {
		fill: var(--text-faint);
	}
	.empty {
		position: absolute;
		left: 0;
		right: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 2px;
		padding: 0 16px;
		font-size: 15px;
		line-height: 20px;
		color: var(--text-muted);
		text-align: center;
	}
	.empty strong {
		font-weight: 600;
		color: var(--text-normal);
	}

	@container (min-width: 1000px) {
		figcaption {
			padding-left: 0;
		}
	}
</style>
