<script lang="ts">
	import { hillFrame } from "../../../dashboard/hill-score-charts";
	import { dayCardOpens, hillScoreView, stepMonthSub, type HillFactor, type HillPeriodView } from "../../../dashboard/hill-score-pages";
	import type { PeriodRange, PeriodRoute } from "../../../dashboard/periods";
	import type { DayRow } from "../../../dashboard/series";
	import { vo2Person } from "../../../dashboard/vo2-max-pages";
	import type { AccountInfo } from "../../../sync/account";
	import type { DayIndexMeta } from "../../../sync/day-index";
	import { HILL_SCORE_INDEX, type HillScoreRow } from "../../../sync/hill-score-index";
	import { VO2_MAX_INDEX, type Vo2MaxRow } from "../../../sync/vo2-max-index";
	import StatPageShell from "../health/StatPageShell.svelte";
	import StatPeriodLayout from "../health/StatPeriodLayout.svelte";
	import type { PerformanceStatPageProps } from "../performance/pages";
	import HillCards, { type HillCardItem } from "./HillCards.svelte";
	import HillChart from "./HillChart.svelte";
	import HillDay from "./HillDay.svelte";
	import HillSheet from "./HillSheet.svelte";
	import HillStats from "./HillStats.svelte";

	/**
	 * Garmin Connect's Hill Score page (Performance Stats). Twin: Figma page
	 * 430:6130 — phone 504:11 (1d), 505:51 / 505:169 / 505:284 (the factor
	 * sheets), 505:403 / 505:662 / 505:861 (4w / 12w / 1y), 505:1016 (a
	 * month); panes 507:95580 on. 1d is a day, stepped a day at a time; 4w
	 * and 12w list their days and 1y its months; a month card opens that
	 * month's page on top (`sub` "month:YYYY-MM"), which has no range
	 * control and steps a month at a time. Everything comes from the
	 * hill-score index, the VO₂ factor from the vo2-max index graded for the
	 * account's sex and the newest chronological age, so the page works
	 * offline.
	 */
	let { route, today, canSync, onBack, go, swap, readIndex, onSyncHistory, versions, history, openSheet, readDays, readAccount }: PerformanceStatPageProps =
		$props();

	const KIND = HILL_SCORE_INDEX.kind;
	const VO2_KIND = VO2_MAX_INDEX.kind;

	let rows = $state.raw<HillScoreRow[]>([]);
	let meta = $state.raw<DayIndexMeta | null>(null);
	$effect(() => {
		void versions[KIND];
		let live = true;
		readIndex<HillScoreRow>(KIND).then(
			(index) => {
				if (!live) return;
				rows = index.rows;
				meta = index.meta;
			},
			() => {},
		);
		return () => {
			live = false;
		};
	});

	/* The VO₂ Max factor: the vo2-max index's readings. */
	let vo2 = $state.raw<Vo2MaxRow[]>([]);
	$effect(() => {
		void versions[VO2_KIND];
		let live = true;
		readIndex<Vo2MaxRow>(VO2_KIND).then(
			(index) => {
				if (live) vo2 = index.rows;
			},
			() => {},
		);
		return () => {
			live = false;
		};
	});

	/* Who the VO₂ reading is graded for: the newest chronological age in the day files, and the account's sex. */
	let days = $state.raw<DayRow[]>([]);
	$effect(() => {
		void versions["#days"];
		let live = true;
		readDays().then(
			(read) => {
				if (live) days = read;
			},
			() => {},
		);
		return () => {
			live = false;
		};
	});
	let account = $state.raw<AccountInfo | null>(null);
	$effect(() => {
		void versions["#account"];
		let live = true;
		readAccount().then(
			(read) => {
				if (live) account = read;
			},
			() => {},
		);
		return () => {
			live = false;
		};
	});

	let complete = $derived(meta?.complete ?? false);
	let view = $derived(hillScoreView(route, rows, { today, complete, vo2, ...vo2Person(days, account, today) }));
	let monthPage = $derived(view.range === "month");

	/** The month page's "<" and ">": the month before or after, in place. */
	function stepMonth(by: number) {
		if (view.range === "month" && view.month) swap({ ...route, sub: stepMonthSub(view.month, by) });
	}

	function openFactor(factor: HillFactor) {
		if (factor.sheet) openSheet(factor.sheet.title, HillSheet, { sheet: factor.sheet });
	}

	/** The list: a month card opens its month page on top; a day card 1d on its day (`dayCardOpens`). */
	function cardsOf(period: HillPeriodView, move: (next: PeriodRoute<PeriodRange>) => void): HillCardItem[] {
		if (period.range === "1y") {
			return period.months.map((m) => ({ key: m.month, kind: "month", title: m.title, value: m.value, word: m.word, onclick: () => go(m.route) }));
		}
		return period.days.map((d) => ({
			key: d.date,
			kind: "day",
			title: d.weekday,
			detail: d.detail,
			value: d.value,
			word: d.word,
			onclick: () => {
				const opens = dayCardOpens(period.range, d);
				if ("go" in opens) go(opens.go);
				else move(opens.move);
			},
		}));
	}
</script>

<StatPageShell
	{route}
	{today}
	label={view.label}
	canGoBack={view.canGoBack}
	canGoForward={view.canGoForward}
	ranges={monthPage ? [] : undefined}
	step={monthPage ? stepMonth : undefined}
	{onBack}
	{swap}
	history={{ title: HILL_SCORE_INDEX.title, complete, walking: history[KIND], canSync, onSync: () => onSyncHistory(KIND) }}
>
	{#snippet children({ pane, move })}
		{#if view.range === "1d"}
			<HillDay {view} onFactor={openFactor} />
		{:else}
			{@const period = view}
			<div class="hill-period" style:--stat-figures-top-pane="{hillFrame(period.range).top - 0.5}px">
				<StatPeriodLayout>
					{#snippet chart()}<HillChart range={period.range} chart={period.chart} empty={period.empty} {pane} />{/snippet}
					{#snippet figures()}<HillStats figures={period.figures} />{/snippet}
					{#snippet list()}<HillCards items={cardsOf(period, move)} />{/snippet}
				</StatPeriodLayout>
			</div>
		{/if}
	{/snippet}
</StatPageShell>

<style>
	/*
	 * A period (505:403, pane 508:96997): the chart's box starts at the
	 * header's foot and ends on the Avg / Max row's rules; in a pane those
	 * rules are level with the top gridline, in the side column.
	 */
	.hill-period {
		--stat-chart-top: 0px;
		--stat-chart-top-pane: 0px;
	}
</style>
