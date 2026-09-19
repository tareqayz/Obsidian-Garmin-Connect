<script lang="ts">
	import type { ElevationPoint, Sport } from "../../../dashboard/activity";

	interface Props {
		points: readonly ElevationPoint[];
		/** Distance unit, for the axis end label. */
		unit?: string;
		elevationUnit?: string;
		sport?: Sport;
		height?: number;
	}

	let { points, unit = "km", elevationUnit = "m", sport = "run", height = 132 }: Props = $props();

	const PAD = { left: 40, top: 10, right: 4, bottom: 22 };

	// Measured rather than guessed, like the v1 charts: the profile sizes itself
	// to the card it lands in and redraws on resize, with no second pass.
	let hostWidth = $state(0);
	let width = $derived(Math.max(240, hostWidth));
	let inner = $derived({
		w: Math.max(10, width - PAD.left - PAD.right),
		h: Math.max(10, height - PAD.top - PAD.bottom),
	});

	let xMin = $derived(points[0]?.distance ?? 0);
	let xMax = $derived(points[points.length - 1]?.distance ?? 1);
	let xSpan = $derived(xMax - xMin || 1);

	let elevations = $derived(points.map((p) => p.elevation));
	let low = $derived(elevations.length ? Math.min(...elevations) : 0);
	let high = $derived(elevations.length ? Math.max(...elevations) : 1);
	// A flat course still deserves a readable axis rather than a divide by zero.
	let yMin = $derived(low === high ? low - 1 : low);
	let yMax = $derived(low === high ? high + 1 : high);

	// The design's own ticks — low, midpoint, high — rather than nice round
	// numbers. A profile is read for its shape, and pinning the gridlines to the
	// range puts the top line on the summit instead of above it.
	let yTicks = $derived([yMin, (yMin + yMax) / 2, yMax]);

	let x = $derived((d: number) => ((d - xMin) / xSpan) * inner.w);
	let y = $derived((e: number) => inner.h - ((e - yMin) / (yMax - yMin)) * inner.h);

	let line = $derived(
		points.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.distance)},${y(p.elevation)}`).join(" "),
	);
	let area = $derived(
		points.length >= 2
			? `${line} L${x(xMax)},${inner.h} L${x(xMin)},${inner.h} Z`
			: "",
	);

	/** A step that puts roughly four labels under the plot. */
	let xTicks = $derived.by(() => {
		const raw = xSpan / 5;
		const magnitude = 10 ** Math.floor(Math.log10(raw));
		const step = [1, 2, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? magnitude * 10;
		const out: number[] = [];
		// Stops short of the end, so the total-distance label has room to itself.
		for (let v = xMin; v < xMax - xSpan * 0.08; v += step) out.push(v);
		return out;
	});

	function number(value: number): string {
		return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, "");
	}
</script>

<!-- Elevation against distance, which is what separates an activity chart from
     a dashboard trend: the x-axis is kilometres, not days. Filled in the sport
     accent so it reads as belonging to this session. -->
<div class="profile" bind:clientWidth={hostWidth}>
	{#if hostWidth > 0 && points.length >= 2}
		<svg {width} {height} viewBox="0 0 {width} {height}" role="img" aria-label="Elevation profile">
			<g transform="translate({PAD.left},{PAD.top})">
				{#each yTicks as tick (tick)}
					<line class="grid" x1="0" x2={inner.w} y1={y(tick)} y2={y(tick)} />
					<text class="tick" x="-8" y={y(tick) + 3} text-anchor="end">
						{Math.round(tick)} {elevationUnit}
					</text>
				{/each}

				<path class="area" d={area} style:fill="var(--v2-sport-{sport})" />
				<path class="line" d={line} style:stroke="var(--v2-sport-{sport})" />

				{#each xTicks as tick, i (tick)}
					<text
						class="tick"
						x={x(tick)}
						y={inner.h + 16}
						text-anchor={i === 0 ? "start" : "middle"}>{number(tick)}</text
					>
				{/each}
				<text class="tick" x={inner.w} y={inner.h + 16} text-anchor="end">
					{number(xMax)} {unit}
				</text>
			</g>
		</svg>
	{/if}
</div>

<style>
	.profile {
		width: 100%;
	}
	svg {
		display: block;
		max-width: 100%;
		overflow: visible;
	}
	.grid {
		stroke: var(--gcd-grid);
		stroke-width: 1;
	}
	.tick {
		fill: var(--v2-muted);
		font-size: 10px;
		font-variant-numeric: tabular-nums;
	}
	.area {
		fill-opacity: 0.14;
		stroke: none;
	}
	.line {
		fill: none;
		stroke-width: 1.5;
		stroke-linejoin: round;
		stroke-linecap: round;
	}
</style>
