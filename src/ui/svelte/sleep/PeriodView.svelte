<script lang="ts">
	import type { PeriodOverlayId, SleepPeriodView } from "../../../dashboard/sleep-pages";
	import DurationChart from "./DurationChart.svelte";
	import HalfTabs from "./HalfTabs.svelte";
	import ScoreChart from "./ScoreChart.svelte";
	import SleepCard from "./SleepCard.svelte";
	import SleepChips from "./SleepChips.svelte";
	import SleepLegend, { type LegendEntry } from "./SleepLegend.svelte";
	import SleepStats from "./SleepStats.svelte";
	import TimesChart from "./TimesChart.svelte";

	/**
	 * A week, four weeks or a year of sleep: the score with an overlay, the
	 * averages, duration against need, bed and wake times, and the nights or
	 * weeks as cards. A pane puts the score beside the averages and runs the
	 * rest three across.
	 */
	interface Props {
		view: SleepPeriodView;
		openDay: (date: string) => void;
		openWeek: (weekEnd: string) => void;
	}

	let { view, openDay, openWeek }: Props = $props();

	let picked = $state<PeriodOverlayId | null>(null);
	let tab = $state(0);

	let overlay = $derived(view.score.overlays.find((o) => o.id === picked) ?? null);
	const TONE: Record<string, string> = {
		hr: "var(--color-cyan)",
		respiration: "var(--color-cyan)",
		rhr: "var(--color-blue)",
		bodyBattery: "var(--color-blue)",
		pulseOx: "var(--color-blue)",
		skin: "var(--color-pink)",
	};
	const STATUS: Record<string, string> = { BALANCED: "var(--color-green)", UNBALANCED: "var(--color-orange)", LOW: "var(--color-red)", POOR: "var(--color-red)" };
	let scoreLegend = $derived<LegendEntry[]>([
		// A year draws its weeks as a bare line, so its key is a line too.
		{ kind: view.score.dots ? "dot" : "line", label: "Score", color: "var(--color-purple)" },
		...(overlay
			? [
					overlay.kind === "dots"
						? { kind: "dot" as const, label: overlay.legend, color: STATUS[overlay.points.find((p) => p.status)?.status ?? ""] ?? "var(--color-green)" }
						: { kind: "square" as const, label: overlay.legend, color: TONE[overlay.id] ?? "var(--color-blue)" },
				]
			: []),
	]);
	let alignment = $derived(view.times.alignment && tab === 1);
	let timesLegend = $derived<LegendEntry[]>([
		{ kind: "dot", label: "Sleep Times", color: "var(--color-blue)" },
		{ kind: "line", label: "Avg Bedtime" },
		{ kind: "dashed", label: "Avg Wake Time" },
	]);
	let year = $derived(view.range === "1y");
</script>

<div class="period-view range-{view.range}">
	<section class="score">
		<h3 class="title">Sleep Score</h3>
		<div class="chart score-chart"><ScoreChart {view} {overlay} /></div>
		<div class="legend score-legend"><SleepLegend items={scoreLegend} /></div>
	</section>

	{#if view.score.overlays.length}
		<section class="chips">
			<SleepChips
				chips={view.score.overlays.map((o) => ({ id: o.id, label: o.chip }))}
				selected={overlay?.id ?? null}
				gap={12}
				onSelect={(id) => (picked = picked === id ? null : (id as PeriodOverlayId))}
			/>
		</section>
	{/if}

	<section class="averages">
		{#if year}
			<div class="pad year-stats"><SleepStats stats={view.scoreStats} /></div>
		{:else}
			<h3 class="title averages-title">Sleep Metric Averages</h3>
			<div class="pad avg-stats"><SleepStats stats={view.averages} /></div>
		{/if}
	</section>

	<section class="duration">
		<h3 class="title">Sleep Duration vs. Sleep Need</h3>
		<div class="chart"><DurationChart {view} /></div>
		<div class="legend">
			<SleepLegend
				items={[
					{ kind: "dot", label: "Sleep Duration", color: "var(--color-blue)" },
					{ kind: "dot", label: "Sleep Need", color: "var(--background-modifier-border)" },
					{ kind: "dot", label: "Sleep Need Met", color: "var(--color-green)" },
				]}
			/>
		</div>
		<div class="pad stats"><SleepStats stats={view.duration.stats} /></div>
	</section>

	<section class="times">
		{#if view.times.alignment}
			<div class="pad tabs"><HalfTabs options={["Sleep Consistency", "Sleep Alignment"]} value={tab} onChange={(i) => (tab = i)} /></div>
		{:else}
			<h3 class="title">Sleep Consistency</h3>
		{/if}
		<div class="chart times-chart"><TimesChart {view} {alignment} /></div>
		<div class="legend"><SleepLegend items={timesLegend} /></div>
		{#if alignment}
			<div class="legend second"><SleepLegend items={[{ kind: "dot", label: "Internal Rhythm Aligned", color: "var(--color-green)" }]} /></div>
		{/if}
		<div class="pad stats"><SleepStats stats={view.times.stats} /></div>
	</section>

	{#if view.cards.length}
		<section class="cards">
			{#each view.cards as card (card.key)}
				{@const day = card.day}
				{@const week = card.weekEnd}
				<SleepCard
					title={card.title}
					detail={card.detail}
					values={[
						{ value: card.score, label: year ? "Avg Score" : "Score" },
						{ value: card.duration, label: year ? "Avg Duration" : "Duration" },
					]}
					onclick={day ? () => openDay(day) : week ? () => openWeek(week) : undefined}
				/>
			{/each}
		</section>
	{/if}
</div>

<style>
	.period-view {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		grid-template-areas: "score" "chips" "averages" "duration" "times" "cards";
		padding-bottom: 16px;
	}
	section {
		min-width: 0;
	}
	.pad {
		padding: 0 16px;
	}
	.title {
		margin: 0;
		padding: 0 16px;
		font-size: 18px;
		line-height: 22px;
		font-weight: 700;
	}
	.score {
		grid-area: score;
		border-top: 16px solid var(--background-secondary);
		padding-top: 17.3px;
	}
	.chart {
		margin-top: 40.9px;
	}
	.legend {
		margin-top: 18px;
	}
	.legend.second {
		margin-top: 5px;
	}
	.range-1y .legend {
		margin-top: 13px;
	}
	.chips {
		grid-area: chips;
		margin-top: 38.4px;
	}
	.averages {
		grid-area: averages;
		margin-top: 24px;
		border-top: 8px solid var(--background-secondary);
	}
	.range-1y .averages {
		margin-top: 63.2px;
		border-top: none;
	}
	.averages-title {
		margin-top: 15.2px;
	}
	.avg-stats {
		margin-top: 17.1px;
	}
	.duration {
		grid-area: duration;
		border-top: 16px solid var(--background-secondary);
		padding-top: 16.9px;
	}
	.duration .stats,
	.times .stats {
		margin-top: 33px;
	}
	.times {
		grid-area: times;
		border-top: 16px solid var(--background-secondary);
	}
	.times .title {
		margin-top: 16.9px;
	}
	.times .tabs + .chart {
		margin-top: 64.8px;
	}
	.cards {
		grid-area: cards;
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 8.3px 8px;
		margin-top: 12px;
		padding: 0 16px;
	}

	@container (min-width: 640px) {
		.cards {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	/* The 1190pt pane: the score beside its averages, then duration, times
	   and the cards three across. */
	@container (min-width: 1000px) {
		.period-view {
			grid-template-columns: repeat(3, minmax(0, 1fr));
			grid-template-areas: "score score averages" "chips chips chips" "duration times cards";
			column-gap: 8px;
			align-items: start;
			max-width: 1126px;
			box-sizing: content-box;
			margin: 0 auto;
			padding: 0 32px 32px;
		}
		.pad,
		.title {
			padding: 0;
		}
		.score {
			border-top: none;
			padding-top: 28px;
		}
		.chart {
			margin-top: 24px;
		}
		.chips {
			margin-top: 20px;
			padding-bottom: 32px;
		}
		.averages {
			margin-top: 0;
			padding-top: 28px;
			border-top: none;
		}
		.range-1y .averages {
			margin-top: 0;
			padding-top: 72px;
		}
		.duration,
		.times,
		.cards {
			margin-top: 0;
			border-top: none;
			padding-top: 28px;
		}
		.duration {
			position: relative;
		}
		/* The band between the two rows runs the pane's full width. */
		.duration::before {
			content: "";
			position: absolute;
			top: -16px;
			left: -32px;
			width: calc(300% + 16px + 64px);
			height: 16px;
			background: var(--background-secondary);
		}
		.times .title {
			margin-top: 0;
		}
		.times .tabs + .chart {
			margin-top: 24px;
		}
		.cards {
			grid-template-columns: minmax(0, 1fr);
			padding: 28px 0 0;
		}
		.duration,
		.times,
		.cards {
			margin-top: 16px;
		}
	}
</style>
