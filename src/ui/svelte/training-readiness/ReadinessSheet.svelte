<script lang="ts">
	import { legendRows, LEGEND_MARGIN } from "../../../dashboard/hrv-status-charts";
	import { PHONE } from "../../../dashboard/stat-charts";
	import { SERIES_COLOR } from "../../../dashboard/training-load-charts";
	import { ACUTE_SHEET_FRAME, SHEET_LAYOUT, SLEEP_SHEET, ringTone } from "../../../dashboard/training-readiness-charts";
	import type { ReadinessSheet } from "../../../dashboard/training-readiness-pages";
	import { NO_DATA } from "../../../dashboard/training-status-copy";
	import StatDial from "../health/StatDial.svelte";
	import StatEmpty from "../health/StatEmpty.svelte";
	import StatFigures from "../health/StatFigures.svelte";
	import StatLegend from "../health/StatLegend.svelte";
	import HrvAveragesChart from "../hrv-status/HrvAveragesChart.svelte";
	import HrvLegend, { legendItems } from "../hrv-status/HrvLegend.svelte";
	import SleepLegend from "../sleep/SleepLegend.svelte";
	import SleepTimeline from "../sleep/TimelineChart.svelte";
	import StressLineChart from "../stress/StressLineChart.svelte";
	import LoadTimeline from "../training-load/TimelineChart.svelte";
	import ScoresChart from "./ScoresChart.svelte";

	/**
	 * A factor's sheet (twin 654:195, 654:444, 654:564, 654:766, 654:1009,
	 * 654:1224; Recovered 654:1414; the pane's dialog 656:1688): the shared
	 * bottom sheet's body under its own header (the title and the close
	 * button are the modal's). The card's word in Medium 17/22, the copy on a
	 * 22 pt pitch, then the factor's own part, made of the other pages'
	 * pieces at the sheet's sizes:
	 *
	 * - Sleep Score: the night's score over "100" and "Score", Quality and
	 *   Duration, and the Sleep page's hypnogram (`TimelineChart`) at 48 pt a
	 *   level without its Deep line, with Sleep's key.
	 * - Recovery Time: "Updated @" over the word, and the hours in a full
	 *   ring in the card's dot colour (Stat Dial's recovery kind).
	 * - HRV Status: the HRV page's dial and its 7-day Averages with its key.
	 * - Acute Load: Load's 4-Week Timeline in the sheet's taller box
	 *   (`ACUTE_SHEET_FRAME`), the Optimal Band under the acute line, and
	 *   its key.
	 * - Recent Sleep Scores: Daily Scores (`ScoresChart`) and the two
	 *   relevant nights' figures.
	 * - Recent Stress: Stress's 7d line, title and all, and its average.
	 *
	 * The rhythm is `SHEET_LAYOUT`'s, in the twin's sheet-content box.
	 */
	interface Props {
		sheet: ReadinessSheet;
		onClose: () => void;
	}

	let { sheet }: Props = $props();

	const S = SHEET_LAYOUT;

	/** The Optimal Range's and the acute line's marks, as Load's tab keys them. */
	const ACUTE_KEY = { optimal: "rgba(var(--color-green-rgb), 0.35)", acute: SERIES_COLOR.acute } as const;

	/** The ring: the whole sweep in the card's dot colour. */
	let ring = $derived.by(() => {
		if (sheet.id !== "recovery") return null;
		const tone = ringTone(sheet.ring);
		return { value: sheet.value, label: sheet.label ?? "", segments: tone ? [{ from: 0, to: 1, tone }] : [] };
	});
</script>

<div
	class="readiness-sheet"
	style:--rs-status="{S.status}px"
	style:--rs-copy="{S.copy}px"
	style:--rs-copy-line="{S.copyLine}px"
	style:--rs-bottom="{S.bottom}px"
	style:--rs-updated="{S.recovery.updated}px"
	style:--rs-updated-status="{S.recovery.status}px"
>
	{#if sheet.id === "recovery" && sheet.updated}<p class="updated">{sheet.updated}</p>{/if}
	{#if sheet.heading}<p class="status">{sheet.heading}</p>{/if}
	{#if sheet.copy}<p class="copy">{sheet.copy}</p>{/if}

	{#if sheet.id === "sleep"}
		<p class="score" style:margin-top="{S.sleep.score}px">{sheet.score}</p>
		<p class="out-of" style:margin-top="{S.sleep.outOf}px">{sheet.outOf}</p>
		<p class="score-label" style:margin-top="{S.sleep.label}px">{sheet.scoreLabel}</p>
		<div class="figures" style:margin-top="{S.sleep.figures}px"><StatFigures figures={sheet.figures} /></div>
		<p class="chart-title strong" style:margin-top="{S.sleep.title}px">{sheet.chartTitle}</p>
		<div class="sleep-timeline" style:margin-top="{S.sleep.chart}px">
			{#if sheet.timeline.state === "drawn" && sheet.timeline.timeline}
				<SleepTimeline timeline={sheet.timeline.timeline} overlay={null} look="stages" level={SLEEP_SHEET.level} lines={SLEEP_SHEET.lines} />
			{:else}
				<!-- The hypnogram's box, empty while the night loads; without its stages, the shared line. -->
				<div class="chart-box" style:height="{SLEEP_SHEET.top + 4 * SLEEP_SHEET.level + 36}px">
					{#if sheet.timeline.state === "empty"}<StatEmpty text={NO_DATA} />{/if}
				</div>
			{/if}
		</div>
		<div class="legend" style:margin-top="{S.sleep.legend}px">
			<SleepLegend
				items={[
					{ kind: "dot", label: "Deep", color: "var(--gcs-deep)" },
					{ kind: "dot", label: "Light", color: "var(--gcs-light)" },
					{ kind: "dot", label: "REM", color: "var(--color-pink)" },
					{ kind: "dot", label: "Awake", color: "var(--color-pink)", faded: true },
				]}
			/>
		</div>
	{:else if sheet.id === "recovery" && ring}
		<div class="ring" class:after-copy={!!sheet.copy} style:--rs-ring="{S.recovery.ring}px" style:--rs-ring-alone="{S.recovery.ringAfterStatus}px">
			<StatDial kind="recovery" gauge={ring} />
		</div>
	{:else if sheet.id === "hrv"}
		{#if sheet.dial}
			<div class="dial" style:margin-top="{S.hrv.dial}px"><StatDial kind="hrv" gauge={sheet.dial.gauge} unit={sheet.dial.unit} /></div>
		{/if}
		<div class="hrv-chart" style:margin-top="{S.hrv.chart}px"><HrvAveragesChart chart={sheet.chart} range="7d" pane={false} rows={1} /></div>
		{#if sheet.chart}
			<div class="legend" style:margin-top="{S.hrv.legend}px">
				<HrvLegend rows={legendRows(legendItems(sheet.chart.legend), PHONE - 2 * LEGEND_MARGIN)} />
			</div>
		{/if}
	{:else if sheet.id === "acute"}
		<p class="chart-title" style:margin-top="{S.acute.title}px">{sheet.chartTitle}</p>
		<div class="acute-chart" style:margin-top="{S.acute.chart}px">
			<LoadTimeline chart={sheet.chart} empty={NO_DATA} pane={false} frame={ACUTE_SHEET_FRAME} />
		</div>
		<div class="legend acute-legend" style:margin-top="{S.acute.legend}px">
			<StatLegend items={sheet.legend.map((item) => ({ label: item.label, shape: "circle" as const, color: item.key === "optimal" ? ACUTE_KEY.optimal : ACUTE_KEY.acute }))} />
		</div>
	{:else if sheet.id === "sleep-history"}
		<p class="chart-title strong" style:margin-top="{S.scores.title}px">{sheet.chartTitle}</p>
		<div class="scores-chart" style:margin-top="{S.scores.chart}px"><ScoresChart chart={sheet.chart} legend={sheet.legend} /></div>
		{#if sheet.figures.length}
			<div class="figures" style:margin-top="{S.scores.figures}px"><StatFigures figures={sheet.figures} /></div>
		{/if}
	{:else if sheet.id === "stress-history"}
		<div class="stress-chart" style:margin-top="{S.stress.chart}px">
			{#if sheet.chart}
				<StressLineChart view={sheet.chart} pane={false} />
			{:else}
				<p class="chart-title">{sheet.chartTitle}</p>
				<div class="chart-box stress-empty"><StatEmpty text={NO_DATA} /></div>
			{/if}
		</div>
		<div class="figures" style:margin-top="{S.stress.figure}px"><StatFigures figures={[sheet.figure]} /></div>
	{/if}
</div>

<style>
	/* The sheet's body: Sleep's stage colours for its hypnogram and key; 25 under the last box, and a phone's home indicator. */
	.readiness-sheet {
		--gcs-deep: color-mix(in srgb, var(--color-blue) 80%, #000);
		--gcs-light: color-mix(in srgb, var(--color-blue) 60%, #fff);
		display: flex;
		flex-direction: column;
		box-sizing: border-box;
		padding-bottom: calc(var(--rs-bottom) + var(--safe-area-inset-bottom, 0px));
		background: var(--background-primary);
		color: var(--text-normal);
	}
	p {
		margin: 0;
	}
	.updated {
		margin-top: var(--rs-updated);
		padding: 0 16px;
		font-size: 13px;
		line-height: 16px;
		color: var(--text-muted);
	}
	.status {
		margin-top: var(--rs-status);
		padding: 0 16px;
		font-size: 17px;
		line-height: 22px;
		font-weight: 500;
	}
	.updated + .status {
		margin-top: var(--rs-updated-status);
	}
	.copy {
		margin-top: var(--rs-copy);
		padding: 0 16px;
		font-size: 15px;
		line-height: var(--rs-copy-line);
	}
	/* Sleep Score's number: Display 35/42 over "100" (Body L, the text colour) and "Score" (Body, muted). */
	.score,
	.out-of,
	.score-label {
		text-align: center;
	}
	.score {
		font-size: 35px;
		line-height: 42px;
		font-variant-numeric: tabular-nums;
	}
	.out-of {
		font-size: 16px;
		line-height: 21px;
	}
	.score-label {
		font-size: 15px;
		line-height: 20px;
		color: var(--text-muted);
	}
	/* Two figures under their rules, 177 wide, 16 apart: the twin's Stat (Value L over Label). */
	.figures {
		padding: 0 16px;
		--stat-figure-gap: 16px;
	}
	.figures :global(.label) {
		font-size: 13px;
		line-height: 16px;
	}
	/* The charts' titles: Sleep Score's and Recent Sleep Scores' Semi Bold 18/22; Acute Load's List Item 17/22. */
	.chart-title {
		padding: 0 16px;
		font-size: 17px;
		line-height: 22px;
	}
	.chart-title.strong {
		font-size: 18px;
		font-weight: 600;
	}
	.chart-box {
		position: relative;
	}
	/* Sleep's hypnogram and the keys in the twin's Caption (11/14). */
	.sleep-timeline :global(svg .tick),
	.sleep-timeline :global(svg .time) {
		font-size: 11px;
	}
	.legend :global(.sleep-legend .label),
	.acute-legend :global(.stat-legend .item) {
		font-size: 11px;
		line-height: 14px;
	}
	.acute-legend :global(.stat-legend) {
		gap: 8px 15.67px;
	}
	.dial,
	.ring {
		display: flex;
		justify-content: center;
	}
	.ring {
		margin-top: var(--rs-ring-alone);
	}
	.ring.after-copy {
		margin-top: var(--rs-ring);
	}
	/* Stress's chart with the twin's title: List Item 17/22, 10.5 in. */
	.stress-chart {
		--stat-title-indent: 10.5px;
	}
	.stress-chart :global(figcaption) {
		font-size: 17px;
	}
	.stress-empty {
		height: 324.94px;
	}
</style>
