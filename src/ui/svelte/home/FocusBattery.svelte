<script lang="ts">
	import type { BatteryView } from "../../../dashboard/home";
	import { clock, scaleX } from "./geometry";
	import HomeCard from "./HomeCard.svelte";
	import Headline from "./Headline.svelte";

	let { battery }: { battery: BatteryView | null } = $props();

	const W = 1000;
	const H = 100;

	let line = $derived.by(() => {
		if (!battery) return { path: "", area: "", peak: undefined as undefined | { x: number; y: number; v: number } };
		let path = "";
		let area = "";
		let first: number | undefined;
		let lastX = 0;
		let peak: { x: number; y: number; v: number } | undefined;
		for (const [t, v] of battery.points) {
			if (v === null) continue;
			const x = scaleX(t, battery.from, battery.to, W);
			const y = H - v;
			path += `${path ? "L" : "M"}${x.toFixed(1)} ${y}`;
			if (first === undefined) first = x;
			lastX = x;
			if (!peak || v > peak.v) peak = { x, y, v };
		}
		if (first !== undefined) area = `${path}L${lastX.toFixed(1)} ${H}L${first.toFixed(1)} ${H}Z`;
		return { path, area, peak };
	});

	// Garmin draws the day's stress under the battery line: blue while at rest,
	// orange once it counts as stress.
	let bars = $derived(
		(battery?.stress ?? [])
			.filter((p): p is [number, number] => p[1] !== null && p[1] > 0)
			.map(([t, v]) => ({ x: scaleX(t, battery!.from, battery!.to, W), v, rest: v <= 25 })),
	);
</script>

<HomeCard kind="focus" title="Body Battery" icon="battery-charging" accent="var(--color-blue)" empty={!battery}>
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
			<svg viewBox="0 0 {W} {H}" preserveAspectRatio="none" aria-hidden="true">
				<defs>
					<linearGradient id="gch-bb" x1="0" x2="0" y1="0" y2="1">
						<stop offset="0" stop-color="var(--text-muted)" stop-opacity="0.9" />
						<stop offset="1" stop-color="var(--text-muted)" stop-opacity="0.05" />
					</linearGradient>
				</defs>
				{#each bars as b}
					<line class:rest={b.rest} class="stress" x1={b.x} x2={b.x} y1={H} y2={H - b.v * 0.9} />
				{/each}
				<path class="area" d={line.area} />
				<path class="line" d={line.path} />
			</svg>
		</div>
		<div class="axis">
			<span>12 AM</span>
			{#if battery.wake}<span>{clock(battery.wake)}</span>{/if}
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
	svg {
		display: block;
		width: 100%;
		height: 100%;
		min-height: 132px;
	}
	.peak {
		position: absolute;
		top: 0;
		transform: translateX(-50%);
		font-size: 13px;
		line-height: 16px;
	}
	.area {
		fill: url(#gch-bb);
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
		display: flex;
		justify-content: space-between;
		color: var(--text-muted);
		font-size: 11px;
		line-height: 14px;
		padding-top: 6px;
	}
</style>
