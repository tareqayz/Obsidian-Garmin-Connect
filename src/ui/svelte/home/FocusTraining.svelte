<script lang="ts">
	import type { TrainingStatusView } from "../../../dashboard/home";
	import HomeCard from "./HomeCard.svelte";
	import Stat from "./Stat.svelte";
	import { lucide } from "./lucide";
	import { STATUS_TONE as TONE } from "./tones";

	let { status }: { status: TrainingStatusView | null } = $props();
</script>

<HomeCard kind="focus" title="Training Status" icon="trending-up" accent="var(--color-purple)" empty={!status}>
	{#if status}
		<div class="body">
			<div class="main">
				<span class="badge" style:background={TONE[status.tone]} use:lucide={"trending-up"}></span>
				<div class="status">{status.status}</div>
				{#if status.loadFocus}<div class="sub">Load Focus - {status.loadFocus}</div>{/if}
				{#if status.heat !== undefined}
					<div class="heat"><span class="sun" use:lucide={"sun"}></span>{status.heat}%</div>
				{/if}
			</div>
			<div class="side">
				{#each status.side as s}<Stat value={s.value} label={s.label} />{/each}
			</div>
		</div>
		<div class="history">
			{#each status.history as h}
				<span style:flex-grow={h.days} style:background={TONE[h.tone]}></span>
			{/each}
		</div>
		<div class="axis">
			<span>Last 4w</span>
			{#if status.since}<span>Since {status.since}</span>{/if}
		</div>
	{/if}
</HomeCard>

<style>
	.body {
		flex: 1;
		display: grid;
		grid-template-columns: 1.3fr 1fr;
		gap: 12px;
	}
	.badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		border-radius: 50%;
		color: var(--text-on-accent);
		margin-bottom: 14px;
	}
	.badge :global(svg) {
		width: 22px;
		height: 22px;
	}
	.status {
		font-size: 22px;
		line-height: 26px;
		font-weight: 700;
	}
	.sub {
		font-size: 15px;
		line-height: 20px;
		margin-top: 4px;
	}
	.heat {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 13px;
		margin-top: 12px;
	}
	.sun {
		display: inline-flex;
	}
	.sun :global(svg) {
		width: 14px;
		height: 14px;
	}
	.side {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.history {
		display: flex;
		gap: 2px;
		height: 12px;
		margin-top: 14px;
		padding-top: 14px;
		border-top: 1px solid var(--background-modifier-border);
		box-sizing: content-box;
	}
	.history span {
		flex-basis: 0;
		border-radius: 6px;
	}
	.axis {
		display: flex;
		justify-content: space-between;
		color: var(--text-muted);
		font-size: 11px;
		padding-top: 8px;
	}
</style>
