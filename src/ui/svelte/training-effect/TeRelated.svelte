<script lang="ts">
	import type { Route } from "../../../dashboard/routes";
	import { TE_DETAIL, discColour } from "../../../dashboard/training-effect-charts";
	import type { TeRelated } from "../../../dashboard/training-effect-pages";
	import { sportIcon } from "../../sport-icons";
	import { lucide } from "../home/lucide";

	/**
	 * RELATED ACTIVITY (twin 683:319): the sport's disc with the plugin's
	 * sport figure, the activity's name, when it started and the card's
	 * subtitle, no chevron. On a phone a bordered card 16 pt in under the
	 * header band; from 640 pt the section's own card frames it. It opens
	 * the activity's page.
	 */
	let { related, open }: { related: TeRelated; open: (route: Route) => void } = $props();

	const D = TE_DETAIL;

	let disc = $derived(discColour(related.category));
</script>

{#snippet content()}
	<span class="disc" style:background={disc.fill} style:color={disc.glyph}>
		<span class="glyph" use:lucide={sportIcon(related.glyph)}></span>
	</span>
	<span class="text">
		<span class="name">{related.name}</span>
		<span class="when">{related.when}</span>
		<span class="subtitle">{related.subtitle}</span>
	</span>
{/snippet}

<div
	class="te-related-wrap"
	style:--te-related="{D.related}px"
	style:--te-related-inset="{D.relatedInset}px"
	style:--te-disc-left="{D.disc.left - 1}px"
	style:--te-disc-top="{D.disc.top - 1}px"
	style:--te-disc="{D.disc.size}px"
	style:--te-glyph="{D.disc.glyph}px"
	style:--te-text-left="{D.text.left - 1}px"
	style:--te-name-top="{D.text.name - 1}px"
	style:--te-when-gap="{D.text.when - D.text.name - 20}px"
	style:--te-subtitle-gap="{D.text.subtitle - D.text.when - 16}px"
>
	{#if related.route}
		{@const route = related.route}
		<button class="te-related" onclick={() => open(route)}>{@render content()}</button>
	{:else}
		<div class="te-related">{@render content()}</div>
	{/if}
</div>

<style>
	/* The card (683:292): 370 × 91.33, a 1 pt outline, radius 8; its disc 16 in and 25.67 down, the text 68.25 in, from the outline's outer edge. */
	.te-related-wrap {
		padding: 0 var(--te-related-inset);
	}
	.te-related {
		position: relative;
		display: block;
		box-sizing: border-box;
		width: 100%;
		height: var(--te-related);
		margin: 0;
		padding: 0;
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-m, 8px);
		box-shadow: none;
		background: var(--background-primary);
		color: var(--text-normal);
		font: inherit;
		text-align: left;
		white-space: nowrap;
	}
	button.te-related {
		cursor: pointer;
	}
	button.te-related:hover {
		background: var(--background-modifier-hover);
	}
	.disc {
		position: absolute;
		left: var(--te-disc-left);
		top: var(--te-disc-top);
		display: flex;
		align-items: center;
		justify-content: center;
		width: var(--te-disc);
		height: var(--te-disc);
		border-radius: 50%;
	}
	.glyph {
		display: flex;
	}
	.glyph :global(svg) {
		width: var(--te-glyph);
		height: var(--te-glyph);
	}
	.text {
		position: absolute;
		left: var(--te-text-left);
		right: 16px;
		top: var(--te-name-top);
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}
	.name {
		font-size: 15px;
		line-height: 20px;
		font-weight: 600;
	}
	.when,
	.subtitle {
		font-size: 13px;
		line-height: 16px;
		color: var(--text-muted);
	}
	.when {
		margin-top: var(--te-when-gap);
	}
	.subtitle {
		margin-top: var(--te-subtitle-gap);
	}
	.name,
	.when,
	.subtitle {
		overflow: hidden;
		text-overflow: ellipsis;
	}

	/* In a section card (686:119937): the section's outline frames it, so its own is clear and it fills the card. */
	@container (min-width: 640px) {
		.te-related-wrap {
			padding: 0;
		}
		.te-related {
			border-color: transparent;
			border-radius: 0;
		}
	}
</style>
