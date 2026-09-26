<script lang="ts">
	import type { Snippet } from "svelte";
	import HomeCard from "./HomeCard.svelte";
	import { lucide } from "./lucide";

	/**
	 * The full-width list card Garmin uses for Today's Activity, Sleep Coach and
	 * Events: an optional line on top, a round coloured icon, a bold headline and
	 * a muted line under it.
	 */
	interface Props {
		kicker?: string;
		/** Drawn as a grey chip instead of plain text, like an event's countdown. */
		chip?: boolean;
		icon: string;
		color: string;
		headline: string;
		detail?: string;
		extra?: Snippet;
	}

	let { kicker, chip = false, icon, color, headline, detail, extra }: Props = $props();
</script>

<HomeCard>
	{#if kicker}<div class="kicker" class:chip>{kicker}</div>{/if}
	<div class="row">
		<span class="badge" style:background={color} use:lucide={icon}></span>
		<div class="text">
			<div class="headline">{headline}</div>
			{#if detail}<div class="detail">{detail}</div>{/if}
			{#if extra}{@render extra()}{/if}
		</div>
	</div>
</HomeCard>

<style>
	.kicker {
		font-size: 15px;
		line-height: 20px;
		margin-bottom: 8px;
	}
	.chip {
		align-self: flex-start;
		font-size: 11px;
		line-height: 14px;
		font-weight: 500;
		letter-spacing: 0.02em;
		padding: 5px 8px;
		border-radius: 4px;
		background: var(--background-modifier-border);
	}
	.row {
		display: flex;
		align-items: center;
		gap: 12px;
	}
	.badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex: none;
		width: 40px;
		height: 40px;
		border-radius: 50%;
		color: var(--text-on-accent);
	}
	.badge :global(svg) {
		width: 20px;
		height: 20px;
	}
	.text {
		min-width: 0;
	}
	.headline {
		font-size: 20px;
		line-height: 24px;
		font-weight: 700;
	}
	.detail {
		color: var(--text-muted);
		font-size: 13px;
		line-height: 16px;
		margin-top: 4px;
	}
</style>
