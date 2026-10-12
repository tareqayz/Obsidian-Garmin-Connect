<script lang="ts">
	import type { TrainingStatusCurrentView, TrainingStatusFactor } from "../../../dashboard/training-status-pages";
	import { PERFORMANCE_STATUS_COLOR } from "../health/performance-colors";
	import { lucide } from "../home/lucide";
	import StatusBadge from "./StatusBadge.svelte";

	/**
	 * Current (twin 561:10, pane 564:1979): the badge in the status's colour,
	 * the status, "Load Focus - …", "Since …", "Based on your Running VO₂ Max
	 * Trend" and the coaching copy, centred; then VO₂ Max, HRV Status, Load and
	 * Heat Acclimation as menu rows, each opening its page. In a pane the words
	 * stand centred in the 748 pt column and the rows make one rounded list in
	 * the 370 pt one. Without any row: No Status and the Help's "How to Get
	 * Training Status" where the copy would be (Inferred).
	 */
	interface Props {
		view: TrainingStatusCurrentView;
		/** A row's page, opened on top. */
		onOpen: (factor: TrainingStatusFactor) => void;
	}

	let { view, onOpen }: Props = $props();
</script>

<div class="ts-current">
	<div class="words">
		<StatusBadge color={PERFORMANCE_STATUS_COLOR[view.status]} />
		<div class="status">{view.word}</div>
		{#if view.focus}<div class="focus">{view.focus}</div>{/if}
		{#if view.since}<div class="since">{view.since}</div>{/if}
		{#if view.basedOn}<div class="based-on">{view.basedOn}</div>{/if}
		{#if view.copy}
			<p class="copy">{view.copy}</p>
		{:else if view.empty}
			<p class="copy"><strong>{view.empty.title}</strong><br />{view.empty.text}</p>
		{/if}
	</div>
	<div class="factors">
		{#each view.factors as factor (factor.id)}
			<button class="factor" onclick={() => onOpen(factor)}>
				<span class="text">
					<span class="title">{factor.title}</span>
					<span class="value">{factor.value}</span>
				</span>
				<span class="chevron" use:lucide={"chevron-right"}></span>
			</button>
		{/each}
	</div>
</div>

<style>
	/*
	 * The phone (561:10), each line where the twin sets its box under the
	 * header's foot (116.33): the badge 40 down (156.33), the status in Section
	 * Title 7.35 under it (223.68), Load Focus in Value M (250.19), Since and
	 * Based on in Body --text-muted (286.13, 304.13), and the copy in Paragraph
	 * on the app's 20.22 pt pitch from 346.33, in a 370 pt measure so its lines
	 * break as the app's do. The rows start at 452.33, 24.23 under the copy's
	 * last 20.22 pt line box.
	 */
	.ts-current {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
	}
	.words {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 40px 16px 0;
		text-align: center;
	}
	.status {
		margin-top: 7.35px;
		font-size: 22px;
		line-height: 28px;
		font-weight: 700;
	}
	.focus {
		margin-top: -1.49px;
		font-size: 17px;
		line-height: 22px;
	}
	.since,
	.based-on {
		font-size: 15px;
		line-height: 20px;
		color: var(--text-muted);
	}
	.since {
		margin-top: 13.94px;
	}
	.based-on {
		margin-top: -2px;
	}
	/* A 20.22 pt line box puts each line's middle where the twin's 22 pt boxes, 20.22 apart, put it: 0.89 lower to start. */
	.copy {
		max-width: 370px;
		margin: 23.09px 0 0;
		font-size: 16px;
		line-height: 20.22px;
	}
	.copy strong {
		font-weight: 600;
	}
	.factors {
		display: flex;
		flex-direction: column;
		margin-top: 24.23px;
	}
	/* A menu row (twin Factor Row 560:180): 72 tall, the title in List Item over the value in Label M, a 16 pt chevron at x 370. */
	.factor {
		display: flex;
		align-items: center;
		gap: 8px;
		box-sizing: border-box;
		width: 100%;
		height: 72px;
		margin: 0;
		padding: 0 16px;
		border: none;
		border-radius: 0;
		box-shadow: none;
		background: var(--background-secondary);
		color: var(--text-normal);
		font: inherit;
		text-align: left;
		cursor: pointer;
	}
	.factor:hover {
		background: var(--background-modifier-hover);
	}
	.text {
		display: flex;
		flex-direction: column;
		gap: 1px;
		flex: 1;
		min-width: 0;
	}
	.title,
	.value {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.title {
		font-size: 17px;
		line-height: 22px;
	}
	.value {
		font-size: 14px;
		line-height: 18px;
		color: var(--text-muted);
	}
	.chevron {
		display: inline-flex;
		flex: none;
		color: var(--text-faint);
	}
	.chevron :global(svg) {
		width: 16px;
		height: 16px;
	}

	/*
	 * The pane (564:1979): the badge 24 under the header's rule (140), the
	 * words centred on the 748 pt column; the rows one list in the 370 pt
	 * column beside it, level with the badge, rounded 8.
	 */
	@container (min-width: 1000px) {
		.ts-current {
			grid-template-columns: minmax(0, 1fr) 370px;
			column-gap: 8px;
			align-items: start;
		}
		.words {
			padding: 24px 0 0;
		}
		.factors {
			margin-top: 24px;
			border-radius: 8px;
			overflow: hidden;
		}
	}
</style>
