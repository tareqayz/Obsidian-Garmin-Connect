<script lang="ts">
	import type { Ring } from "../../../dashboard/stats-pages";

	/**
	 * The ring at the top of a day of steps or floors, or a week of intensity
	 * minutes: the arc runs clockwise from the top towards the goal, and turns
	 * into a green circle with a check once it is met.
	 */
	type Variant = "steps" | "floors" | "week";
	let { ring, variant }: { ring: Ring; variant: Variant } = $props();

	/* Measured off the app: the ring's size and stroke, where the number and
	   the goal sit about its centre, and the check under them. */
	const LOOK: Record<Variant, { size: number; stroke: number; value: number; goal: number; big: boolean; check: string; checkWidth: number }> = {
		steps: { size: 175.6, stroke: 7.6, value: -10, goal: 20.2, big: false, check: "M-9.2 51.1 L-2.8 57.5 L9.2 45.5", checkWidth: 3 },
		floors: { size: 176, stroke: 7.6, value: -8.6, goal: 20.9, big: true, check: "M-9.2 49.7 L-2.8 56.1 L9.2 44.1", checkWidth: 3 },
		week: { size: 192, stroke: 8.5, value: -9, goal: 20.5, big: true, check: "M-10 56.2 L-3 63.2 L10.5 49.7", checkWidth: 3.2 },
	};

	let look = $derived(LOOK[variant]);
	let c = $derived(look.size / 2);
	let r = $derived((look.size - look.stroke) / 2);
	let arc = $derived.by(() => {
		const f = Math.max(0, Math.min(1, ring.fraction));
		if (f <= 0 || f >= 0.9999) return "";
		const angle = -Math.PI / 2 + f * 2 * Math.PI;
		const x = c + r * Math.cos(angle);
		const y = c + r * Math.sin(angle);
		return `M${c} ${c - r} A${r} ${r} 0 ${f > 0.5 ? 1 : 0} 1 ${x.toFixed(2)} ${y.toFixed(2)}`;
	});
</script>

<div class="big-ring" style:width="{look.size}px" style:height="{look.size}px">
	<svg width={look.size} height={look.size} aria-hidden="true">
		{#if ring.complete}
			<circle class="met" cx={c} cy={c} {r} stroke-width={look.stroke} />
			<path class="check" d={look.check} transform="translate({c} {c})" stroke-width={look.checkWidth} />
		{:else}
			<circle class="track" cx={c} cy={c} {r} stroke-width={look.stroke} />
			{#if ring.fraction >= 0.9999}
				<circle class="arc" cx={c} cy={c} {r} stroke-width={look.stroke} />
			{:else if arc}
				<path class="arc" d={arc} stroke-width={look.stroke} />
			{/if}
		{/if}
	</svg>
	<span class="value" class:big={look.big} style:top="{c + look.value}px">{ring.value}</span>
	{#if ring.goal}<span class="goal" style:top="{c + look.goal}px">{ring.goal}</span>{/if}
</div>

<style>
	.big-ring {
		position: relative;
		flex: none;
	}
	svg {
		display: block;
	}
	circle,
	path {
		fill: none;
	}
	.track {
		stroke: var(--background-modifier-border);
	}
	.arc {
		stroke: var(--color-blue);
	}
	.met,
	.check {
		stroke: var(--color-green);
	}
	.check {
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.value,
	.goal {
		position: absolute;
		left: 0;
		right: 0;
		transform: translateY(-50%);
		text-align: center;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}
	.value {
		font-size: 31px;
		line-height: 38px;
		color: var(--text-normal);
	}
	.value.big {
		font-size: 34px;
		line-height: 40px;
	}
	.goal {
		font-size: 15px;
		line-height: 20px;
		color: var(--text-muted);
	}
</style>
