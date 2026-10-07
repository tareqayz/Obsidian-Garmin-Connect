<script lang="ts">
	import { hmOfMinutes, type SleepDayView } from "../../../dashboard/sleep-pages";
	import AlignmentChart from "./AlignmentChart.svelte";
	import NeedChart from "./NeedChart.svelte";
	import SleepCard from "./SleepCard.svelte";
	import SleepLegend from "./SleepLegend.svelte";
	import SleepStats from "./SleepStats.svelte";

	/**
	 * A night's Sleep Coach: how much sleep the night called for and why, and
	 * how the night lined up with the internal rhythm. A pane puts the need on
	 * the left and the alignment beside it.
	 */
	interface Props {
		view: SleepDayView;
		/** Opens the Sleep History sheet, with the key it speaks to. */
		onHistory: (key: string | undefined) => void;
	}

	let { view, onHistory }: Props = $props();

	let coach = $derived(view.coach);
</script>

{#if coach}
	<div class="coach-tab">
		<section class="need">
			<div class="need-value">{coach.need}</div>
			<div class="need-label">Sleep Need</div>
			<div class="need-chart">
				<NeedChart {coach} baselineLabel={coach.baselineMinutes !== undefined ? `${hmOfMinutes(coach.baselineMinutes)} baseline` : undefined} />
			</div>
			<div class="need-legend"><SleepLegend items={[{ kind: "hatch", label: "Sleep Need", color: "var(--gcs-light)" }]} /></div>
			<div class="pad need-title">{coach.title}</div>
			<div class="pad need-text">{coach.text}</div>
			{#if coach.adjustments.length}
				<div class="pad adjustments">
					{#each coach.adjustments as a (a.id)}
						{@const detail = coach.delta ? `${a.detail} · ${coach.delta}` : a.detail}
						{#if a.id === "history"}
							<SleepCard title={a.title} {detail} chevron onclick={() => onHistory(coach.historyKey)} />
						{:else}
							<SleepCard title={a.title} {detail} />
						{/if}
					{/each}
				</div>
			{/if}
		</section>

		{#if coach.alignment}
			{@const a = coach.alignment}
			<section class="alignment">
				<h3 class="group">Sleep Alignment</h3>
				<div class="align-title">{a.title}</div>
				<div class="align-subtitle">{a.subtitle}</div>
				<div class="align-chart"><AlignmentChart alignment={a} /></div>
				<div class="align-legend">
					<SleepLegend
						items={[
							{ kind: "dot", label: "Last Sleep", color: "var(--gcs-light)" },
							{ kind: "dot", label: "Internal Rhythm", color: "var(--color-purple)" },
							{ kind: "tick", label: "Midpoint" },
							{ kind: "box", label: "Target Range" },
						]}
					/>
				</div>
				<div class="align-text">{a.text}</div>
				<div class="pad align-stats"><SleepStats stats={a.stats} /></div>
			</section>
		{/if}
	</div>
{:else}
	<div class="none">No Sleep Coach data for this night.</div>
{/if}

<style>
	.coach-tab {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		padding-bottom: 24px;
	}
	.pad {
		padding: 0 16px;
	}
	.need {
		min-width: 0;
	}
	.need-value {
		margin-top: 32.8px;
		font-size: 34px;
		line-height: 40px;
		text-align: center;
	}
	.need-label {
		margin-top: 1.2px;
		font-size: 16px;
		line-height: 21px;
		text-align: center;
		color: var(--text-muted);
	}
	.need-chart {
		height: 60px;
		margin-top: 24.7px;
	}
	.need-legend {
		margin-top: 15px;
	}
	.need-title {
		margin-top: 39.9px;
		font-size: 18px;
		line-height: 22px;
		font-weight: 500;
	}
	.need-text {
		margin-top: 14.9px;
		font-size: 16px;
		line-height: 22px;
	}
	.adjustments {
		display: flex;
		flex-direction: column;
		gap: 8px;
		margin-top: 14px;
	}
	.alignment {
		min-width: 0;
		margin-top: 16.2px;
	}
	.group {
		margin: 0;
		height: 38px;
		box-sizing: border-box;
		padding: 16px 16px 0;
		background: var(--background-secondary);
		font-size: 14px;
		line-height: 18px;
		font-weight: 400;
		text-transform: uppercase;
		color: var(--text-muted);
	}
	.align-title {
		margin-top: 24.3px;
		font-size: 31px;
		line-height: 38px;
		text-align: center;
	}
	.align-subtitle {
		margin-top: 15px;
		font-size: 16px;
		line-height: 21px;
		text-align: center;
		color: var(--text-muted);
	}
	.align-chart {
		margin-top: 7.7px;
	}
	.align-legend {
		margin-top: 31.3px;
	}
	.align-text {
		margin-top: 22.5px;
		padding: 0 16px 0 23px;
		font-size: 16px;
		line-height: 22px;
	}
	.align-stats {
		margin-top: 31.5px;
	}
	.none {
		padding: 48px 16px;
		text-align: center;
		color: var(--text-muted);
	}

	/* The 1190pt pane: the need in a 370pt column, the alignment beside it
	   with its four times in one row. */
	@container (min-width: 1000px) {
		.coach-tab {
			grid-template-columns: 370px minmax(0, 1fr);
			column-gap: 8px;
			align-items: start;
			max-width: 1126px;
			box-sizing: content-box;
			margin: 0 auto;
			padding: 0 32px 32px;
		}
		.pad {
			padding: 0;
		}
		.need-value {
			margin-top: 46px;
		}
		.alignment {
			margin-top: 24px;
		}
		.align-text {
			padding: 0;
		}
		.align-stats {
			--sleep-stat-columns: 4;
			--sleep-stat-gap: 13px;
			margin-top: 24px;
		}
	}
</style>
