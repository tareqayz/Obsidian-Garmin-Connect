<script lang="ts">
	import type { Card } from "../../../dashboard/stats-pages";

	/**
	 * A day or a week in a Steps, Floors or Intensity Minutes list: its name,
	 * a line under it, the figure, and for steps and floors a small goal ring.
	 * A day opens on its own 1d page.
	 */
	let { card, onclick }: { card: Card; onclick?: () => void } = $props();

	const R = 12;
	let arc = $derived.by(() => {
		const f = Math.max(0, Math.min(1, card.ring?.fraction ?? 0));
		if (f <= 0 || f >= 0.9999) return "";
		const angle = -Math.PI / 2 + f * 2 * Math.PI;
		return `M13 1 A${R} ${R} 0 ${f > 0.5 ? 1 : 0} 1 ${(13 + R * Math.cos(angle)).toFixed(2)} ${(13 + R * Math.sin(angle)).toFixed(2)}`;
	});
</script>

{#snippet body()}
	<span class="text">
		<span class="title">{card.title}</span>
		{#if card.detail}<span class="detail">{card.detail}</span>{/if}
	</span>
	<span class="value">{card.value}</span>
	{#if card.ring}
		<svg class="ring" width="26" height="26" aria-hidden="true">
			{#if card.ring.complete}
				<circle class="met" cx="13" cy="13" r={R} />
				<path class="check" d="M8.4 13.2 L11.5 16.2 L17.6 10" />
			{:else}
				<circle class="track" cx="13" cy="13" r={R} />
				{#if card.ring.fraction >= 0.9999}<circle class="arc" cx="13" cy="13" r={R} />{:else if arc}<path class="arc" d={arc} />{/if}
			{/if}
		</svg>
	{/if}
{/snippet}

{#if onclick}
	<button class="day-card" class:one-line={!card.detail} {onclick}>{@render body()}</button>
{:else}
	<div class="day-card" class:one-line={!card.detail}>{@render body()}</div>
{/if}

<style>
	.day-card {
		display: flex;
		align-items: center;
		gap: 16.7px;
		box-sizing: border-box;
		width: 100%;
		min-height: 73.6px;
		height: auto;
		margin: 0;
		padding: 16.3px 16px 16.9px 16.7px;
		border: none;
		border-radius: 8px;
		box-shadow: none;
		background: var(--background-secondary);
		color: var(--text-normal);
		font: inherit;
		text-align: left;
		white-space: normal;
	}
	.one-line {
		min-height: 55.2px;
	}
	button.day-card {
		cursor: pointer;
	}
	button.day-card:hover {
		background: var(--background-modifier-hover);
	}
	.text {
		display: flex;
		flex-direction: column;
		gap: 1.4px;
		flex: 1;
		min-width: 0;
	}
	.title {
		font-size: 16px;
		line-height: 21px;
		font-weight: 600;
	}
	.detail {
		font-size: 14px;
		line-height: 18px;
		color: var(--text-muted);
	}
	.title,
	.detail {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.value {
		flex: none;
		font-size: 17px;
		line-height: 22px;
		font-variant-numeric: tabular-nums;
	}
	.ring {
		flex: none;
		display: block;
	}
	.ring circle,
	.ring path {
		fill: none;
		stroke-width: 2;
	}
	.track {
		stroke: var(--background-modifier-border);
	}
	.arc {
		stroke: var(--color-blue);
	}
	.met {
		stroke: var(--color-green);
	}
	.ring .check {
		stroke: var(--color-green);
		stroke-width: 1.6;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
</style>
