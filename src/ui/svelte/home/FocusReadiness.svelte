<script lang="ts">
	import type { ReadinessView } from "../../../dashboard/home";
	import Arc from "./Arc.svelte";
	import HomeCard from "./HomeCard.svelte";
	import Stat from "./Stat.svelte";

	let { readiness }: { readiness: ReadinessView | null } = $props();

	// Garmin's readiness bands: poor, low, moderate, high, prime.
	const BANDS = [
		{ from: 0, to: 25, color: "var(--color-red)" },
		{ from: 25, to: 50, color: "var(--color-orange)" },
		{ from: 50, to: 75, color: "var(--color-green)" },
		{ from: 75, to: 95, color: "var(--color-blue)" },
		{ from: 95, to: 100, color: "var(--color-purple)" },
	];
</script>

<HomeCard kind="focus" title="Training Readiness" icon="gauge" accent="var(--color-blue)" empty={!readiness}>
	{#if readiness}
		<div class="top">
			<Arc size={92} stroke={6} segments={BANDS} gap={3} marker={readiness.score} label={String(readiness.score)} />
			<div class="level">
				<div class="name">{readiness.level ?? ""}</div>
				{#if readiness.message}<div class="msg">{readiness.message}</div>{/if}
			</div>
		</div>
		<div class="factors">
			{#each readiness.factors as f}
				<Stat value={f.value} label={f.label} />
			{/each}
		</div>
	{/if}
</HomeCard>

<style>
	.top {
		display: flex;
		align-items: center;
		gap: 18px;
		margin-bottom: 18px;
	}
	.name {
		font-size: 22px;
		line-height: 26px;
	}
	.msg {
		font-size: 13px;
		line-height: 16px;
		margin-top: 4px;
	}
	.factors {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px 16px;
	}
</style>
