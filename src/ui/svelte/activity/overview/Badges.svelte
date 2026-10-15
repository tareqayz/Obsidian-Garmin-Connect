<script lang="ts">
	import type { OverviewView } from "../../../../dashboard/activity-overview";
	import { sportIcon } from "../../../sport-icons";
	import { lucide } from "../../home/lucide";

	/**
	 * Badges: what the activity earned, each a generic medal (the plugin loads
	 * no remote images, so no badge art) with its name over its description, as
	 * the ride's Overview lists "Climber 1" over "Climb 500 feet during a
	 * cycling activity." No "See All" and no badge page: the plugin has neither.
	 * Shown only when the activity earned one; builder B refines it 1:1.
	 */
	let { badges }: { badges: NonNullable<OverviewView["badges"]> } = $props();
</script>

<h3 class="gc-ov-heading">Badges</h3>
<div class="gc-badges">
	{#each badges as badge, i (i)}
		<div class="gc-badge">
			<span class="gc-badge-medal" use:lucide={sportIcon("medal")}></span>
			<div class="gc-badge-text">
				<div class="gc-badge-name">{badge.name}</div>
				{#if badge.description}<div class="gc-badge-description">{badge.description}</div>{/if}
			</div>
		</div>
	{/each}
</div>

<style>
	.gc-badges {
		display: flex;
		flex-direction: column;
		gap: 16px;
		margin-top: 16px;
	}
	.gc-badge {
		display: flex;
		align-items: center;
		gap: 16px;
		min-width: 0;
	}
	.gc-badge-medal {
		display: inline-flex;
		flex: none;
		align-items: center;
		justify-content: center;
		width: 48px;
		height: 48px;
		border-radius: 50%;
		background: var(--background-secondary);
		color: var(--text-muted);
	}
	.gc-badge-medal :global(svg) {
		width: 28px;
		height: 28px;
	}
	.gc-badge-text {
		min-width: 0;
	}
	.gc-badge-name {
		font-size: 17px;
		line-height: 22px;
		color: var(--text-normal);
	}
	.gc-badge-description {
		margin-top: 2px;
		font-size: 13px;
		line-height: 16px;
		color: var(--text-muted);
	}
</style>
