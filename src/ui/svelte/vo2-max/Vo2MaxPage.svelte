<script lang="ts">
	import type { DayRow } from "../../../dashboard/series";
	import { vo2MaxView, vo2Person } from "../../../dashboard/vo2-max-pages";
	import type { AccountInfo } from "../../../sync/account";
	import type { DayIndexMeta } from "../../../sync/day-index";
	import { VO2_MAX_INDEX, type Vo2MaxRow } from "../../../sync/vo2-max-index";
	import StatDial from "../health/StatDial.svelte";
	import StatEmpty from "../health/StatEmpty.svelte";
	import StatPageShell from "../health/StatPageShell.svelte";
	import StatTabs from "../health/StatTabs.svelte";
	import type { PerformanceStatPageProps } from "../performance/pages";
	import Vo2Chart from "./Vo2Chart.svelte";

	/**
	 * Garmin Connect's VO₂ Max page (Performance Stats). Twin: Figma page
	 * 430:6112 — phone 471:9 (Current), 472:42 (Cycling), 472:131 / 472:316 /
	 * 472:472 (4w / 12w / 6m), 472:857… (Cycling's empty ranges); panes 473:847
	 * on. The tabs sit in the body, under the period on a range; Current has
	 * no period row, its reading's day goes over the dial instead. The copy
	 * and the link follow the dial or the chart on a phone and stand beside
	 * them in a pane.
	 */
	let { route, today, canSync, onBack, go, swap, readIndex, onSyncHistory, versions, history, readDays, readAccount }: PerformanceStatPageProps = $props();

	const KIND = VO2_MAX_INDEX.kind;

	let rows = $state.raw<Vo2MaxRow[]>([]);
	let meta = $state.raw<DayIndexMeta | null>(null);
	$effect(() => {
		void versions[KIND];
		let live = true;
		readIndex<Vo2MaxRow>(KIND).then(
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

	/* Who the reading is graded for: the newest chronological age in the day files, and the account's sex. */
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
	let view = $derived(vo2MaxView(route, rows, { today, complete, ...vo2Person(days, account, today) }));
	let current = $derived(route.range === "1d");
</script>

<StatPageShell
	{route}
	{today}
	label={view.label}
	canGoBack={view.canGoBack}
	steppers={!current}
	{onBack}
	{swap}
	history={{ title: VO2_MAX_INDEX.title, complete, walking: history[KIND], canSync, onSync: () => onSyncHistory(KIND) }}
>
	{#snippet children({ pane })}
		<div class="vo2-tabs"><StatTabs {route} {swap} layout="packed" height={46} /></div>
		<div class="vo2-body" class:current>
			<div class="vo2-main">
				{#if current}
					{#if view.dial}
						<p class="vo2-date">{view.dial.label}</p>
						<div class="vo2-dial"><StatDial kind="vo2" gauge={view.dial.gauge} /></div>
					{:else}
						<div class="vo2-none"><StatEmpty text={view.empty ?? ""} /></div>
					{/if}
				{:else}
					<Vo2Chart chart={view.chart} empty={view.empty} {pane} />
				{/if}
			</div>
			<div class="vo2-side">
				{#if view.copy}<p class="vo2-copy">{view.copy}</p>{/if}
				<button class="vo2-link" onclick={() => go(view.link.route)}>{view.link.text}</button>
			</div>
		</div>
	{/snippet}
</StatPageShell>

<style>
	/*
	 * The phone (twin 471:9, 472:131): the tabs, then on Current the day
	 * 15.57 under them and the dial 1.94 under that; on a range the chart's
	 * 304 pt box from the tabs' foot. The copy is one paragraph, centred, its
	 * lines 22 apart: 29.03 under the dial or 23.54 under the chart, the link
	 * 40.03 or 24.03 under it.
	 */
	.vo2-body {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		padding-bottom: 24px;
	}
	.vo2-date {
		margin: 15.57px 0 0;
		font-size: 15px;
		line-height: 20px;
		color: var(--text-muted);
		text-align: center;
	}
	.vo2-dial {
		display: flex;
		justify-content: center;
		margin-top: 1.94px;
	}
	/* Current without a reading: the line where the day and the dial would be. */
	.vo2-none {
		position: relative;
		height: 217.94px;
		margin-top: 15.57px;
	}
	.vo2-none :global(.stat-empty) {
		font-size: 15px;
		line-height: 20px;
	}
	.vo2-side {
		padding: 0 16px;
		text-align: center;
	}
	/* Garmin breaks it as iOS does, never leaving a word alone: "…for your age" / "and gender." */
	.vo2-copy {
		margin: 22.54px 0 0;
		font-size: 15px;
		line-height: 22px;
		color: var(--text-muted);
		text-wrap: pretty;
	}
	.current .vo2-copy {
		margin-top: 28.03px;
	}
	.vo2-link {
		display: block;
		width: fit-content;
		height: auto;
		margin: 23.03px auto 0;
		padding: 0;
		border: none;
		box-shadow: none;
		background: none;
		font: inherit;
		font-size: 15px;
		line-height: 20px;
		font-weight: 600;
		color: var(--text-accent);
		cursor: pointer;
	}
	.current .vo2-link {
		margin-top: 39.03px;
	}
	.vo2-link:hover {
		color: var(--text-accent-hover);
	}

	/*
	 * The twins' panes (473:847, 473:889): the dial or the chart in the 748 pt
	 * column, the copy and the link left-aligned in a 370 pt one beside it,
	 * the copy's first line level with the ring's top (46.97 under the tabs)
	 * or the top gridline (99.46), the link 40.03 or 24.03 under it. The tabs
	 * start on the header's rule.
	 */
	@container (min-width: 1000px) {
		.vo2-tabs {
			margin-top: -1px;
		}
		.vo2-body {
			grid-template-columns: minmax(0, 1fr) 370px;
			column-gap: 8px;
			align-items: start;
		}
		.vo2-side {
			padding: 0;
			text-align: left;
		}
		.vo2-copy {
			margin-top: 99.46px;
			line-height: 20px;
			text-wrap: wrap;
		}
		.current .vo2-copy {
			margin-top: 46.97px;
		}
		.vo2-link {
			margin: 24.03px 0 0;
		}
		.current .vo2-link {
			margin-top: 40.03px;
		}
	}
</style>
