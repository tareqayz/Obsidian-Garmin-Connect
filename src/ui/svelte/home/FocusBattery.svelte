<script lang="ts">
	import type { BatteryView } from "../../../dashboard/home";
	import { clock, scaleX } from "./geometry";
	import TimelineMarker from "../health/TimelineMarker.svelte";
	import HomeCard from "./HomeCard.svelte";
	import Headline from "./Headline.svelte";

	let { battery, emptyText }: { battery: BatteryView | null; emptyText?: string } = $props();

	/** One gradient per card: a note can hold several, and url(#id) finds the first in the page. */
	const uid = $props.id();
	const gradient = `gch-bb-${uid}`;

	const W = 1000;
	const H = 100;

	/**
	 * The curve as the phone draws it: a step line, each level held until the
	 * next reading, a gap breaking it; the area under it; its peak, labelled;
	 * and where it ends, the newest level, a dot.
	 */
	let line = $derived.by(() => {
		type Point = { x: number; y: number; v: number };
		const none = { path: "", area: "", peak: undefined as Point | undefined, end: undefined as Point | undefined };
		if (!battery) return none;
		let path = "";
		let area = "";
		let run: Point[] = [];
		let peak: Point | undefined;
		let end: Point | undefined;
		const flush = () => {
			if (!run.length) return;
			let d = `M${run[0].x.toFixed(1)} ${run[0].y}`;
			for (let i = 1; i < run.length; i++) d += `H${run[i].x.toFixed(1)}V${run[i].y}`;
			path += d;
			area += `${d}V${H}H${run[0].x.toFixed(1)}Z`;
			run = [];
		};
		for (const [t, v] of battery.points) {
			if (v === null) {
				flush();
				continue;
			}
			const p = { x: scaleX(t, battery.from, battery.to, W), y: H - v, v };
			run.push(p);
			end = p;
			if (!peak || v > peak.v) peak = p;
		}
		flush();
		return { path, area, peak, end };
	});

	// Garmin draws the day's stress under the battery line: blue while at rest,
	// orange once it counts as stress.
	let bars = $derived(
		(battery?.stress ?? [])
			.filter((p): p is [number, number] => p[1] !== null && p[1] > 0)
			.map(([t, v]) => ({ x: scaleX(t, battery!.from, battery!.to, W), v, rest: v <= 25 })),
	);
</script>

<HomeCard kind="focus" title="Body Battery" icon="battery-charging" accent="var(--color-blue)" empty={!battery} {emptyText}>
	{#if battery}
		<Headline
			value={battery.latest}
			stats={[
				{ value: battery.charged !== undefined ? `+${battery.charged}` : undefined, label: "Charged" },
				{ value: battery.drained !== undefined ? `-${battery.drained}` : undefined, label: "Drained" },
			]}
		/>
		<div class="plot">
			{#if line.peak}
				<span class="peak" style:left="{(line.peak.x / W) * 100}%">{line.peak.v}</span>
			{/if}
			<div class="canvas">
				<svg class="chart" viewBox="0 0 {W} {H}" preserveAspectRatio="none" aria-hidden="true">
					<defs>
						<linearGradient id={gradient} x1="0" x2="0" y1="0" y2="1">
							<stop offset="0" stop-color="var(--text-muted)" stop-opacity="0.9" />
							<stop offset="1" stop-color="var(--text-muted)" stop-opacity="0.05" />
						</linearGradient>
					</defs>
					{#each bars as b}
						<line class:rest={b.rest} class="stress" x1={b.x} x2={b.x} y1={H} y2={H - b.v * 0.9} />
					{/each}
					<path class="area" d={line.area} fill="url(#{gradient})" />
					<path class="line" d={line.path} />
				</svg>
				{#if line.end}
					<span class="end" style:left="{(line.end.x / W) * 100}%" style:top="{(line.end.y / H) * 100}%"></span>
				{/if}
				{#each battery.markers as m}
					<svg class="marker" style:left="{m.x * 100}%" width="22" height="22" viewBox="-11 -11 22 22" aria-hidden="true">
						<TimelineMarker kind={m.kind} x={0} y={0} glyph={m.glyph} />
					</svg>
				{/each}
			</div>
		</div>
		<div class="axis">
			<span>12 AM</span>
			{#if battery.wake}<span class="wake" style:left="{(scaleX(battery.wake, battery.from, battery.to, W) / W) * 100}%">{clock(battery.wake)}</span>{/if}
			<span>12 AM</span>
		</div>
	{/if}
</HomeCard>

<style>
	.plot {
		position: relative;
		flex: 1;
		min-height: 150px;
		padding-top: 18px;
		border-bottom: 1px solid var(--background-modifier-border);
	}
	.chart {
		display: block;
		width: 100%;
		height: 100%;
		min-height: 132px;
	}
	.canvas {
		position: relative;
		height: 100%;
		min-height: 132px;
	}
	/* The peak's figure in a pill, as the phone labels it. */
	.peak {
		position: absolute;
		top: -2px;
		transform: translateX(-50%);
		padding: 0 5px;
		border-radius: 8px;
		background: var(--background-secondary-alt, var(--background-primary));
		font-size: 13px;
		line-height: 18px;
	}
	.end {
		position: absolute;
		width: 9px;
		height: 9px;
		border-radius: 50%;
		background: var(--text-normal);
		transform: translate(-50%, -50%);
	}
	/* A disc centred on the baseline, ringed in the card's own colour. */
	.marker {
		position: absolute;
		bottom: -11px;
		transform: translateX(-50%);
		overflow: visible;
		--gch-marker-ring: var(--background-secondary);
	}
	.area {
		opacity: 0.55;
	}
	.line {
		fill: none;
		stroke: var(--text-normal);
		stroke-width: 1.5;
		vector-effect: non-scaling-stroke;
	}
	.stress {
		stroke: var(--color-orange);
		stroke-width: 1;
		vector-effect: non-scaling-stroke;
	}
	.stress.rest {
		stroke: var(--color-blue);
	}
	.axis {
		position: relative;
		display: flex;
		justify-content: space-between;
		color: var(--text-muted);
		font-size: 11px;
		line-height: 14px;
		padding-top: 6px;
	}
	/* The wake time under its alarm clock, as the phone labels it. */
	.wake {
		position: absolute;
		top: 6px;
		transform: translateX(-50%);
	}
</style>
