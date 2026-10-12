<script lang="ts">
	import type { ActivityRoute } from "../../../dashboard/routes";
	import type { ExerciseRow } from "../../../dashboard/training-load-pages";
	import { lucide } from "../home/lucide";

	/**
	 * Exercise Load's activities (twin Activity Row 602:229; pane 609:1551):
	 * the date over its subtitle, the three parts set apart by spaced
	 * bullets, on the secondary background without dividers, 57 pt a row; a
	 * run carries a chevron and opens its page, other sports neither yet
	 * (Inferred). Edge to edge on the phone; from 640 pt cards with radius
	 * 8, two a row, three in a pane, 8 apart and 16 between rows.
	 */
	let { rows, open }: { rows: readonly ExerciseRow[]; open: (route: ActivityRoute) => void } = $props();
</script>

{#snippet content(row: ExerciseRow)}
	<span class="date">{row.date}</span>
	<span class="subtitle">
		{#each row.parts as part, i (i)}
			{#if i > 0}<span class="bullet" aria-hidden="true">•</span>{/if}<span>{part}</span>
		{/each}
	</span>
{/snippet}

<ul class="load-activities">
	{#each rows as row (row.id)}
		<li>
			{#if row.route}
				{@const route = row.route}
				<button class="activity" onclick={() => open(route)}>
					{@render content(row)}
					<span class="chev" use:lucide={"chevron-right"}></span>
				</button>
			{:else}
				<div class="activity">{@render content(row)}</div>
			{/if}
		</li>
	{/each}
</ul>

<style>
	.load-activities {
		margin: 0;
		padding: 0;
		list-style: none;
		background: var(--background-secondary);
	}
	li {
		margin: 0;
	}
	.activity {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		justify-content: flex-start;
		box-sizing: border-box;
		width: 100%;
		height: 57px;
		margin: 0;
		padding: 7.52px 40px 0 16px;
		border: none;
		border-radius: 0;
		box-shadow: none;
		background: var(--background-secondary);
		color: var(--text-normal);
		font: inherit;
		text-align: left;
		white-space: nowrap;
		overflow: hidden;
	}
	button.activity {
		cursor: pointer;
	}
	button.activity:hover {
		background: var(--background-modifier-hover);
	}
	.date {
		font-size: 17px;
		line-height: 22px;
	}
	/* The twin's Label row, its parts 6.8 apart: ~10 pt of ink either side of each bullet. */
	.subtitle {
		display: flex;
		align-items: center;
		gap: 6.8px;
		max-width: 100%;
		margin-top: 1.55px;
		overflow: hidden;
		font-size: 13px;
		line-height: 16px;
		color: var(--text-muted);
	}
	.chev {
		position: absolute;
		top: 50%;
		right: 16px;
		display: inline-flex;
		transform: translateY(-50%);
		color: var(--text-faint);
	}
	.chev :global(svg) {
		width: 16px;
		height: 16px;
	}

	@container (min-width: 640px) {
		.load-activities {
			display: grid;
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: 16px 8px;
			background: none;
		}
		.activity {
			border-radius: var(--radius-m, 8px);
		}
	}

	@container (min-width: 1000px) {
		.load-activities {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}
</style>
