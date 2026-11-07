<script lang="ts">
	import type { ChartCardView } from "../../../embeds/view";
	import { lucide } from "../home/lucide";
	import { toneColor } from "../home/tones";

	/**
	 * A trend as a small card (`size: small`; Figma 1319:2, F · Card's
	 * Trends row): the stat, the period's figure, a line, bars or dots of its
	 * days, and the period under them. An At a Glance card's size and chrome,
	 * four to a row on a desktop.
	 */
	let { card }: { card: ChartCardView } = $props();

	let width = $state(0);
	const HEIGHT = 40;
	const PAD = 4;

	let trend = $derived(card.trend);
	let shape = $derived.by(() => {
		if (!trend || width <= 0) return null;
		const known = trend.values.filter((v): v is number => v !== null);
		if (!known.length) return null;
		const min = trend.kind === "bars" ? 0 : Math.min(...known);
		const max = Math.max(...known);
		const span = max - min || 1;
		const n = trend.values.length;
		const y = (v: number) => PAD + (HEIGHT - 2 * PAD) * (1 - (v - min) / span);
		if (trend.kind === "bars") {
			const step = width / n;
			const w = Math.max(1, step - Math.min(6, step * 0.35));
			return {
				bars: trend.values.flatMap((v, i) => (v === null ? [] : [{ x: i * step + (step - w) / 2, y: y(v), w, h: HEIGHT - PAD - y(v) + PAD }])),
				line: "",
				dots: [],
			};
		}
		const x = (i: number) => (n === 1 ? width / 2 : PAD + ((width - 2 * PAD) * i) / (n - 1));
		const points = trend.values.flatMap((v, i) => (v === null ? [] : [{ x: x(i), y: y(v) }]));
		if (trend.kind === "dots") return { bars: [], line: "", dots: points };
		// Broken where a day has nothing, as the page's own lines are.
		let line = "";
		let open = false;
		trend.values.forEach((v, i) => {
			if (v === null) open = false;
			else {
				line += `${open ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)} `;
				open = true;
			}
		});
		return { bars: [], line, dots: points.length === 1 ? points : [] };
	});
</script>

<article class="gcc-small">
	<header>
		<span class="icon" style:color={toneColor(card.tone)} use:lucide={card.icon}></span>
		<span class="title">{card.title}</span>
	</header>
	<div class="value">{trend?.value ?? "—"}</div>
	<div class="label">{trend?.label ?? ""}</div>
	<div class="spark" bind:clientWidth={width} style:color={trend?.color}>
		{#if shape}
			<svg width={width} height={HEIGHT} aria-hidden="true">
				{#each shape.bars as bar}<rect x={bar.x} y={bar.y} width={bar.w} height={bar.h} rx="1.5" />{/each}
				{#if shape.line}<path d={shape.line} />{/if}
				{#each shape.dots as dot}<circle cx={dot.x} cy={dot.y} r="2" />{/each}
			</svg>
		{:else}
			<div class="none">{card.body.kind === "none" ? card.body.text : ""}</div>
		{/if}
	</div>
	{#if card.period}<div class="period">{card.period}</div>{/if}
</article>

<style>
	/* An At a Glance card (HomeCard's `glance`), as tall as its content. */
	.gcc-small {
		display: flex;
		flex-direction: column;
		min-width: 0;
		box-sizing: border-box;
		padding: 16px 12px 12px;
		border-radius: 6px;
		background: var(--background-secondary);
		color: var(--text-normal);
	}
	header {
		display: flex;
		align-items: flex-start;
		gap: 8px;
		margin-bottom: 10px;
		font-size: 13px;
		line-height: 16px;
	}
	.icon {
		display: inline-flex;
		flex: none;
		width: 16px;
		height: 16px;
	}
	.icon :global(svg) {
		width: 16px;
		height: 16px;
	}
	.title {
		flex: 1;
		min-width: 0;
	}
	.value {
		font-size: 22px;
		line-height: 26px;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.label {
		min-height: 16px;
		font-size: 12px;
		line-height: 16px;
		color: var(--text-muted);
	}
	.spark {
		height: 40px;
		margin-top: 10px;
	}
	svg {
		display: block;
		overflow: visible;
	}
	rect,
	circle {
		fill: currentColor;
	}
	path {
		fill: none;
		stroke: currentColor;
		stroke-width: 2;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.none {
		display: flex;
		align-items: center;
		height: 100%;
		font-size: 12px;
		color: var(--text-faint);
	}
	.period {
		margin-top: 8px;
		font-size: 11px;
		line-height: 14px;
		color: var(--text-muted);
	}
</style>
