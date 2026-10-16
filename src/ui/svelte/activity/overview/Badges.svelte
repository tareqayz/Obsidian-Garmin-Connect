<script lang="ts">
	import type { OverviewView } from "../../../../dashboard/activity-overview";
	import { sportIcon } from "../../../sport-icons";
	import { lucide } from "../../home/lucide";

	/**
	 * Badges: what the activity earned, as the twin's Badge Row (947:174805):
	 * 80 pt rows on the secondary background, edge to edge on a phone and a
	 * rounded list in a pane (as the Navigation rows), each with a Ø 44
	 * medallion holding a generic medal (the plugin loads no remote images, so
	 * no badge art), the name over the description ("Climber 1" over "Climb 500
	 * feet during a cycling activity."). No "See All", no chevron and no badge
	 * page: the plugin has neither.
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
	/* The list 9.4 pt under the heading, edge to edge on a phone, as the Navigation rows. */
	.gc-badges {
		margin: 9.4px -16px 0;
		overflow: hidden;
	}
	.gc-badge {
		display: flex;
		align-items: flex-start;
		box-sizing: border-box;
		height: 80px;
		padding: 18px 16px 0 17px;
		background: var(--background-secondary);
	}
	.gc-badge-medal {
		display: inline-flex;
		flex: none;
		align-items: center;
		justify-content: center;
		box-sizing: border-box;
		width: 44px;
		height: 44px;
		border: 1px solid var(--background-modifier-border);
		border-radius: 50%;
		background: var(--background-primary);
		color: var(--text-muted);
	}
	.gc-badge-medal :global(svg) {
		width: 24px;
		height: 24px;
	}
	/* The name 76 pt in, its line 1.86 under the medallion's top; the description 1.22 under it. */
	.gc-badge-text {
		min-width: 0;
		margin: 1.86px 0 0 15px;
	}
	.gc-badge-name {
		font-size: 17px;
		line-height: 22px;
		color: var(--text-normal);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.gc-badge-description {
		margin-top: 1.22px;
		font-size: 13px;
		line-height: 16px;
		color: var(--text-muted);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	/* 640 pt and up: a rounded list in its column. */
	@container (min-width: 640px) {
		.gc-badges {
			margin: 9.4px 0 0;
			border-radius: 8px;
		}
	}
</style>
