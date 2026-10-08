<script lang="ts">
	import { tick } from "svelte";
	import type { ActivitiesData } from "../../../dashboard/activities";
	import { HOME_GLANCE, type GlanceId } from "../../../dashboard/glance";
	import { glanceStat, healthStat } from "../../../dashboard/health-stats";
	import { presetFor, type FocusId, type HomeModel, type MoreId, type PresetId } from "../../../dashboard/home";
	import { healthStatRoute, pop, push, replace, sleepRoute, statsRoute, top, type Route } from "../../../dashboard/routes";
	import { latestNightOffset, type HistoryView, type SleepData } from "../../../dashboard/sleep-pages";
	import type { StatsData } from "../../../dashboard/stats-pages";
	import type { IndexHistoryProgress, ReadIndex } from "../../../sync/day-index";
	import type { DaySeries } from "../../../sync/intraday";
	import type { IntradayLoad } from "../../../sync/intraday-registry";
	import type { HistoryProgress, SleepHistoryProgress, StatsHistoryProgress } from "../../../sync/runner";
	import ActivitiesHub from "../activities/ActivitiesHub.svelte";
	import AllActivitiesPage from "../activities/AllActivitiesPage.svelte";
	import CategoryPage from "../activities/CategoryPage.svelte";
	import MonthPage from "../activities/MonthPage.svelte";
	import MorePage from "../activities/MorePage.svelte";
	import RecordsPage from "../activities/RecordsPage.svelte";
	import HealthHub from "../health/HealthHub.svelte";
	import { HEALTH_PAGES } from "../health/pages";
	import FactorPage from "../sleep/FactorPage.svelte";
	import SleepPage from "../sleep/SleepPage.svelte";
	import StatsPage from "../stats/StatsPage.svelte";
	import EmptyCard from "./EmptyCard.svelte";
	import FocusActivities from "./FocusActivities.svelte";
	import FocusBattery from "./FocusBattery.svelte";
	import FocusReadiness from "./FocusReadiness.svelte";
	import FocusSleep from "./FocusSleep.svelte";
	import FocusSteps from "./FocusSteps.svelte";
	import FocusTraining from "./FocusTraining.svelte";
	import Glance from "./Glance.svelte";
	import HomeCard from "./HomeCard.svelte";
	import PageBar from "./PageBar.svelte";
	import PresetSheet from "./PresetSheet.svelte";
	import RowCard from "./RowCard.svelte";
	import SectionHeader from "./SectionHeader.svelte";
	import SeeAll from "./SeeAll.svelte";
	import { lucide } from "./lucide";

	/**
	 * Garmin Connect's Home, rebuilt section for section so the two can be read
	 * side by side. Narrow panes get the phone layout; wider ones unfold the
	 * In Focus carousel into a row and run At a Glance several cards across.
	 * Which layout is decided by the pane's own width (a container query), not
	 * the device, since an Obsidian leaf can be narrow on a desktop.
	 *
	 * The other pages — See All, More, Activities, Steps, Floors, Intensity
	 * Minutes, Health Stats, Sleep and every stat registered in `HEALTH_PAGES`
	 * — open on top of Home inside the same view, as a stack that Back walks
	 * down.
	 */
	interface Props {
		initialModel: HomeModel;
		initialActivities: ActivitiesData;
		initialStats: StatsData;
		initialSleep: SleepData;
		/** Home at the bottom, then whatever was open when the view was last saved. */
		initialStack: Route[];
		initialHistory: HistoryProgress | null;
		initialStatsHistory: StatsHistoryProgress | null;
		initialSleepHistory: SleepHistoryProgress | null;
		/** The registered day indexes' history walks in progress, by kind. */
		initialIndexHistory: Record<string, IndexHistoryProgress>;
		initialPreset: PresetId;
		initialHidden: MoreId[];
		/** The At a Glance list once it has been edited; absent means the preset's. */
		initialGlance?: GlanceId[];
		/** The real today; the model may show an earlier day when today is not synced yet. */
		today: string;
		canSync: boolean;
		onSync: () => Promise<string | null>;
		onChange: (preset: PresetId, hidden: MoreId[], glance: GlanceId[] | undefined) => void;
		/** Add a Stat, from See All's edit mode. */
		onPick: (current: GlanceId[]) => Promise<GlanceId | null>;
		/** Every page change, so the view can save where it is. */
		onRoute: (stack: Route[]) => void;
		onSyncHistory: () => void;
		onSyncStatsHistory: () => void;
		onSyncSleepHistory: () => void;
		/** Starts a registered day index's history walk. */
		onSyncIndexHistory: (kind: string) => void;
		/** Opens the Sleep Coach's Sleep History sheet. */
		onSleepHistory: (view: HistoryView) => void;
		/** Series files for the day charts and a night's Sleep page. */
		readSeries: (days: string[]) => Promise<Map<string, DaySeries | null>>;
		/** A day index's rows and meta, for the Health Stats pages. */
		readIndex: ReadIndex;
		/** A day's intraday blocks, fetched on view when its series file lacks them. */
		loadIntraday: (date: string, keys: readonly string[]) => Promise<IntradayLoad>;
	}

	let {
		initialModel,
		initialActivities,
		initialStats,
		initialSleep,
		initialStack,
		initialHistory,
		initialStatsHistory,
		initialSleepHistory,
		initialIndexHistory,
		initialPreset,
		initialHidden,
		initialGlance,
		today: initialToday,
		canSync,
		onSync,
		onChange,
		onPick,
		onRoute,
		onSyncHistory,
		onSyncStatsHistory,
		onSyncSleepHistory,
		onSyncIndexHistory,
		onSleepHistory,
		readSeries,
		readIndex,
		loadIntraday,
	}: Props = $props();

	// Seeded once; refreshes come through the exported setters.
	// svelte-ignore state_referenced_locally
	let model = $state(initialModel);
	// svelte-ignore state_referenced_locally
	let presetId = $state(initialPreset);
	// svelte-ignore state_referenced_locally
	let hidden = $state<MoreId[]>(initialHidden);
	// svelte-ignore state_referenced_locally
	let glance = $state<GlanceId[] | undefined>(initialGlance);
	// svelte-ignore state_referenced_locally
	let today = $state(initialToday);
	// svelte-ignore state_referenced_locally
	let activities = $state(initialActivities);
	// svelte-ignore state_referenced_locally
	let history = $state<HistoryProgress | null>(initialHistory);
	// svelte-ignore state_referenced_locally
	let stats = $state(initialStats);
	// svelte-ignore state_referenced_locally
	let statsHistory = $state<StatsHistoryProgress | null>(initialStatsHistory);
	// svelte-ignore state_referenced_locally
	let sleep = $state(initialSleep);
	// svelte-ignore state_referenced_locally
	let sleepHistory = $state<SleepHistoryProgress | null>(initialSleepHistory);
	// svelte-ignore state_referenced_locally
	let indexHistory = $state<Record<string, IndexHistoryProgress>>({ ...initialIndexHistory });
	/** By index kind, and one for the series files: a Health Stats page re-reads what it shows when its number moves. */
	let indexVersions = $state<Record<string, number>>({});
	let seriesVersion = $state(0);

	/** A view left open past midnight moves on to the new day with its next refresh. */
	export function setModel(next: HomeModel, nextToday?: string) {
		model = next;
		if (nextToday) today = nextToday;
	}

	export function setActivities(next: ActivitiesData) {
		activities = next;
	}

	export function setHistory(next: HistoryProgress | null) {
		history = next;
	}

	export function setStats(next: StatsData) {
		stats = next;
	}

	export function setStatsHistory(next: StatsHistoryProgress | null) {
		statsHistory = next;
	}

	export function setSleep(next: SleepData) {
		sleep = next;
	}

	export function setSleepHistory(next: SleepHistoryProgress | null) {
		sleepHistory = next;
	}

	export function setIndexHistory(kind: string, next: IndexHistoryProgress | null) {
		if (next) indexHistory[kind] = next;
		else delete indexHistory[kind];
	}

	/** A file in a day index's folder changed. */
	export function setIndexVersion(kind: string, version: number) {
		indexVersions[kind] = version;
	}

	/** A day's series file changed. */
	export function setSeriesVersion(version: number) {
		seriesVersion = version;
	}

	/** Opens a stack of pages from outside, as a command does. */
	export function navigate(next: Route[]) {
		void show(next, false);
	}

	let preset = $derived(presetFor(presetId));
	let more = $derived(preset.more.filter((m) => !hidden.includes(m)));
	/** Everything See All holds; Home shows the first eight. */
	let glanceList = $derived(glance ?? preset.glance);

	let sheet = $state(false);
	let syncing = $state(false);
	let syncMessage = $state<string | null>(null);

	function choose(id: PresetId) {
		presetId = id;
		// Resetting Home brings hidden sections back and puts At a Glance back to
		// the preset's cards, as it does in the app.
		hidden = [];
		glance = undefined;
		sheet = false;
		onChange(presetId, hidden, glance);
	}

	function hide(id: MoreId) {
		hidden = [...hidden, id];
		onChange(presetId, hidden, glance);
	}

	function saveGlance(next: GlanceId[]) {
		glance = next;
		onChange(presetId, hidden, glance);
	}

	/* Pages open on top of Home and Back returns to where each one was
	   scrolled; a new page starts at the top. */
	// svelte-ignore state_referenced_locally
	let stack = $state<Route[]>(initialStack);
	let current = $derived(top(stack));
	let root = $state<HTMLElement | null>(null);
	const scrolls: number[] = [];

	async function show(next: Route[], restore: boolean) {
		const scroller = root?.closest<HTMLElement>(".view-content");
		stack = next;
		onRoute(next);
		await tick();
		if (scroller) scroller.scrollTop = restore ? (scrolls[next.length - 1] ?? 0) : 0;
	}

	function go(route: Route) {
		scrolls[stack.length - 1] = root?.closest<HTMLElement>(".view-content")?.scrollTop ?? 0;
		void show(push(stack, route), false);
	}

	function back() {
		void show(pop(stack), true);
	}

	/** A filter or a tab: the same page with other settings, staying where it is scrolled. */
	function swap(route: Route) {
		stack = replace(stack, route);
		onRoute(stack);
	}

	/** A card that opens a page, by click or by Enter / Space. */
	function opener(route: Route) {
		return (e: KeyboardEvent | MouseEvent) => {
			if (e instanceof KeyboardEvent) {
				if (e.key !== "Enter" && e.key !== " ") return;
				e.preventDefault();
			}
			go(route);
		};
	}
	const openAll = opener({ page: "all" });

	/** The night Home shows, as days back from today: its sleep cards open that night. */
	let nightOffset = $derived(Math.min(0, Math.round((Date.parse(`${model.date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000)));

	const healthPages = Object.keys(HEALTH_PAGES);

	/** At a Glance cards with a page behind them, as in the app. */
	function glancePage(id: GlanceId): Route | null {
		if (id === "steps" || id === "floors" || id === "intensity") return statsRoute(id);
		if (id === "sleep") return sleepRoute(nightOffset);
		const stat = glanceStat(id, healthPages);
		// A day's page opens on the day Home shows, as Sleep's card opens its night.
		return stat ? healthStatRoute(stat.id, stat.defaultRange === "1d" ? { offset: nightOffset } : {}) : null;
	}

	async function sync() {
		if (syncing) return;
		syncing = true;
		syncMessage = "Syncing…";
		try {
			syncMessage = (await onSync()) ?? null;
		} catch (e) {
			syncMessage = e instanceof Error ? e.message : String(e);
		} finally {
			syncing = false;
		}
	}

	let dateLabel = $derived(
		new Date(`${model.date}T12:00`).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" }),
	);

	/* The narrow layout's carousel and its dots. */
	let carousel = $state<HTMLElement | null>(null);
	let slide = $state(0);
	function onScroll() {
		if (!carousel) return;
		const first = carousel.firstElementChild as HTMLElement | null;
		const step = (first?.offsetWidth ?? carousel.clientWidth) + 8;
		slide = Math.round(carousel.scrollLeft / step);
	}
	function goTo(i: number) {
		const el = carousel?.children[i] as HTMLElement | undefined;
		el?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" });
	}

	const MORE_TITLE: Record<MoreId, string> = {
		events: "Events",
		coachPlans: "Garmin Coach Plans",
		challenges: "Challenges",
	};
</script>

{#snippet focus(id: FocusId)}
	{#if id === "sleep"}
		{@const open = opener(sleepRoute(nightOffset))}
		<div class="tap" role="button" tabindex="0" onclick={open} onkeydown={open}><FocusSleep sleep={model.sleep} /></div>
	{:else if id === "bodyBattery"}<FocusBattery battery={model.battery} />
	{:else if id === "steps"}
		{@const open = opener(statsRoute("steps"))}
		<div class="tap" role="button" tabindex="0" onclick={open} onkeydown={open}><FocusSteps steps={model.steps} /></div>
	{:else if id === "activities"}
		<div class="tap" role="button" tabindex="0" onclick={openAll} onkeydown={openAll}><FocusActivities activities={model.activities} /></div>
	{:else if id === "readiness"}<FocusReadiness readiness={model.readiness} />
	{:else if id === "trainingStatus"}<FocusTraining status={model.trainingStatus} />
	{/if}
{/snippet}

{#snippet coach()}
	{#if model.sleepCoach}
		{@const open = opener({ page: "sleep", range: "1d", offset: nightOffset, tab: "coach" })}
		<div class="tap" role="button" tabindex="0" onclick={open} onkeydown={open}>
			<RowCard kicker="Sleep Coach" icon="alarm-clock" color="var(--color-blue)" headline="{model.sleepCoach.hours} recommended" detail={model.sleepCoach.message} />
		</div>
	{/if}
{/snippet}

<div class="gch-root" bind:this={root}>
	{#if current.page === "glance"}
		<SeeAll {model} list={glanceList} onBack={back} onSave={saveGlance} {onPick} />
	{:else if current.page === "more"}
		<MorePage onBack={back} {go} />
	{:else if current.page === "activities"}
		<ActivitiesHub onBack={back} {go} />
	{:else if current.page === "category"}
		<CategoryPage route={current} data={activities} {today} {history} {canSync} onBack={back} {go} {swap} {onSyncHistory} />
	{:else if current.page === "month"}
		<MonthPage route={current} data={activities} onBack={back} />
	{:else if current.page === "records"}
		<RecordsPage route={current} data={activities} onBack={back} {swap} />
	{:else if current.page === "all"}
		<AllActivitiesPage data={activities} onBack={back} />
	{:else if current.page === "health"}
		<HealthHub onBack={back} {go} openSleep={() => go(sleepRoute(latestNightOffset(sleep, today)))} />
	{:else if current.page === "health-stat"}
		{@const Page = HEALTH_PAGES[current.stat]}
		{#if Page}
			<Page
				route={current}
				{today}
				units={activities.units}
				{canSync}
				onBack={back}
				{go}
				{swap}
				{readSeries}
				{readIndex}
				{loadIntraday}
				onSyncHistory={onSyncIndexHistory}
				versions={indexVersions}
				{seriesVersion}
				history={indexHistory}
			/>
		{:else}
			<!-- A route saved by a version that had this page. -->
			<PageBar title={healthStat(current.stat)?.title ?? "Health Stats"} onBack={back} />
			<div class="unbuilt">This page isn’t in this version of the plugin.</div>
		{/if}
	{:else if current.page === "sleep"}
		<SleepPage
			route={current}
			data={sleep}
			{today}
			history={sleepHistory}
			{canSync}
			onBack={back}
			{go}
			{swap}
			onSyncHistory={onSyncSleepHistory}
			onHistory={onSleepHistory}
			{readSeries}
		/>
	{:else if current.page === "sleep-factor"}
		<FactorPage route={current} data={sleep} onBack={back} {readSeries} />
	{:else if current.page === "stats"}
		<StatsPage
			route={current}
			data={stats}
			{today}
			history={statsHistory}
			{canSync}
			onBack={back}
			{go}
			{swap}
			onSyncHistory={onSyncStatsHistory}
			{readSeries}
		/>
	{:else}
		<header class="pane-header">
			<div class="title">
				<span class="watch" use:lucide={"watch"}></span>
				<strong>Garmin Connect</strong>
				<span class="muted">Home · {dateLabel}</span>
			</div>
			<div class="actions">
				{#if syncMessage}<span class="faint">{syncMessage}</span>{/if}
				<button class="preset" onclick={() => (sheet = !sheet)} aria-label="Change the Home layout">
					Layout: {preset.name}
					<span class="chev" use:lucide={"chevron-down"}></span>
				</button>
				<button class="clickable-icon" aria-label="Sync recent days" disabled={!canSync || syncing} onclick={sync}>
					<span class:spin={syncing} use:lucide={"refresh-cw"}></span>
				</button>
				<button class="clickable-icon" aria-label="More" onclick={() => go({ page: "more" })}>
					<span use:lucide={"ellipsis"}></span>
				</button>
			</div>
		</header>

		{#if sheet}
			<div class="content">
				<PresetSheet current={presetId} onPick={choose} onCancel={() => (sheet = false)} />
			</div>
		{:else}
			<div class="content">
				{#if model.date !== today}
					<div class="stale">Today isn’t synced yet. Showing {dateLabel}.</div>
				{/if}

				<div class="top-row">
					<section>
						<SectionHeader title="Today’s Activity" />
						<div class="stack">
							{#each model.today as item}
								{#if item.kind === "snapshot"}
									<RowCard
										kicker={item.title}
										icon="clipboard-plus"
										color="var(--color-red)"
										headline={item.hr !== undefined ? `${item.hr} bpm Avg HR` : "Health Snapshot"}
										detail={[
											item.spo2 !== undefined ? `${item.spo2}% Avg SpO₂` : "",
											item.respiration !== undefined ? `${Math.round(item.respiration)} brpm Avg Resp` : "",
										]
											.filter(Boolean)
											.join(" • ")}
									/>
								{:else}
									<RowCard
										kicker={item.name}
										icon="activity"
										color="var(--color-blue)"
										headline={[item.distance, item.minutes !== undefined ? `${Math.round(item.minutes)} min` : ""].filter(Boolean).join(" · ") || item.name}
										detail={item.calories !== undefined ? `${item.calories} kcal` : undefined}
									/>
								{/if}
							{:else}
								<HomeCard><div class="quiet">No activities or Health Snapshots yet today.</div></HomeCard>
							{/each}
						</div>
					</section>
					{#if model.sleepCoach}
						{@const open = opener({ page: "sleep", range: "1d", offset: nightOffset, tab: "coach" })}
						<section class="wide-only">
							<SectionHeader title="Sleep Coach" />
							<div class="tap" role="button" tabindex="0" onclick={open} onkeydown={open}>
								<RowCard icon="alarm-clock" color="var(--color-blue)" headline="{model.sleepCoach.hours} recommended" detail={model.sleepCoach.message} />
							</div>
						</section>
					{/if}
				</div>

				<section>
					<SectionHeader title="In Focus" />
					<div class="focus" bind:this={carousel} onscroll={onScroll}>
						{#each preset.inFocus as id (id)}
							<div class="slide">{@render focus(id)}</div>
						{/each}
					</div>
					{#if preset.inFocus.length > 1}
						<div class="dots narrow-only">
							{#each preset.inFocus as id, i (id)}
								<button class:on={slide === i} aria-label="Card {i + 1}" onclick={() => goTo(i)}></button>
							{/each}
						</div>
					{/if}
				</section>

				<div class="narrow-only">{@render coach()}</div>

				<section>
					<SectionHeader title="At a Glance" action="See All" onAction={() => go({ page: "glance" })} />
					<div class="glance">
						{#each glanceList.slice(0, HOME_GLANCE) as id (id)}
							{@const page = glancePage(id)}
							{#if page}
								{@const open = opener(page)}
								<div class="tap" role="button" tabindex="0" onclick={open} onkeydown={open}><Glance {id} {model} /></div>
							{:else}<Glance {id} {model} />{/if}
						{:else}
							<div class="glance-none">
								<HomeCard><div class="quiet">No stats here yet. Choose See All, then Edit, to add some.</div></HomeCard>
							</div>
						{/each}
					</div>
				</section>

				{#if more.length}
					<div class="more">
						{#each more as id (id)}
							<section>
								<SectionHeader title={MORE_TITLE[id]} action={id === "events" ? undefined : "Hide"} onAction={() => hide(id)} />
								<div class="stack">
									{#if id === "events"}
										{#each model.events as e}
											<RowCard kicker={e.countdown} chip icon="flag" color="var(--color-red)" headline={e.name} detail={e.when} />
										{:else}
											<HomeCard><div class="quiet">No upcoming events.</div></HomeCard>
										{/each}
									{:else if id === "coachPlans"}
										{#each model.plans as p}
											<RowCard icon="calendar-check" color="var(--color-blue)" headline={p.name} detail={p.detail} />
										{:else}
											<EmptyCard
												icon="calendar-check"
												title="Let’s start training"
												body="Choose one of our training plans to get started."
												actions={[{ label: "Find a Plan", primary: true, href: "https://connect.garmin.com/modern/training-plans" }]}
											/>
										{/each}
									{:else}
										<EmptyCard
											icon="trophy"
											title="Ready for a challenge?"
											body="Join an existing challenge or create your own."
											actions={[
												{ label: "Find a Challenge", primary: true, href: "https://connect.garmin.com/modern/challenges" },
												{ label: "Create a Challenge", href: "https://connect.garmin.com/modern/challenges" },
											]}
										/>
									{/if}
								</div>
							</section>
						{/each}
					</div>
				{/if}

				<div class="footer">
					<button onclick={() => (sheet = true)}>Reset Home</button>
				</div>
			</div>
		{/if}
	{/if}
</div>

<style>
	.gch-root {
		container-type: inline-size;
		color: var(--text-normal);
		font-family: var(--font-interface);
		--gch-gap: 8px;
	}
	.pane-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 8px 16px;
		padding: 10px 16px;
		border-bottom: 1px solid var(--background-modifier-border);
	}
	.title,
	.actions {
		display: flex;
		align-items: center;
		gap: 10px;
		min-width: 0;
	}
	.title strong {
		font-size: 17px;
	}
	.watch {
		display: inline-flex;
		color: var(--text-muted);
	}
	.muted {
		color: var(--text-muted);
		font-size: 14px;
	}
	.faint {
		color: var(--text-faint);
		font-size: 11px;
	}
	.preset {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: 13px;
	}
	.chev {
		display: inline-flex;
		color: var(--text-muted);
	}
	.chev :global(svg) {
		width: 14px;
		height: 14px;
	}
	.spin {
		display: inline-flex;
		animation: gch-spin 1s linear infinite;
	}
	@keyframes gch-spin {
		to {
			transform: rotate(360deg);
		}
	}
	.content {
		display: flex;
		flex-direction: column;
		gap: 24px;
		padding: 16px 16px 32px;
		max-width: 1126px;
		margin: 0 auto;
		box-sizing: content-box;
	}
	/* Not ".notice": Obsidian styles that class as its toast. */
	.stale {
		color: var(--text-muted);
		font-size: 13px;
	}
	.quiet {
		color: var(--text-faint);
		font-size: 13px;
	}
	.unbuilt {
		padding: 48px 16px;
		text-align: center;
		color: var(--text-muted);
	}
	section {
		min-width: 0;
	}
	.stack {
		display: flex;
		flex-direction: column;
		gap: var(--gch-gap);
	}
	.top-row,
	.more {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 24px var(--gch-gap);
		align-items: start;
	}
	.wide-only {
		display: none;
	}

	/* Narrow: In Focus is a swipeable carousel with a peek of the next card. */
	.focus {
		display: grid;
		grid-auto-flow: column;
		grid-auto-columns: calc(100% - 8px);
		gap: var(--gch-gap);
		overflow-x: auto;
		scroll-snap-type: x mandatory;
		scrollbar-width: none;
	}
	.focus::-webkit-scrollbar {
		display: none;
	}
	.slide {
		scroll-snap-align: start;
		display: flex;
		flex-direction: column;
	}
	.slide > :global(*) {
		flex: 1;
	}
	/* The All Activities card opens All Activities, the Steps, Floors and
	   Intensity Minutes cards their pages, and the sleep cards the night's
	   Sleep page, as they do in the app. */
	.tap {
		display: flex;
		flex-direction: column;
		cursor: pointer;
		border-radius: var(--radius-m, 8px);
	}
	.tap > :global(*) {
		flex: 1;
	}
	.tap:focus-visible {
		outline: 2px solid var(--interactive-accent);
		outline-offset: 2px;
	}
	.dots {
		display: flex;
		justify-content: center;
		gap: 8px;
		margin-top: 17px;
	}
	.dots button {
		width: 6px;
		height: 6px;
		padding: 0;
		border-radius: 50%;
		background: var(--text-faint);
		box-shadow: none;
		border: none;
	}
	.dots button.on {
		width: 8px;
		height: 8px;
		background: var(--text-normal);
	}
	.glance {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--gch-gap);
	}
	.glance-none {
		grid-column: 1 / -1;
	}
	.footer {
		display: flex;
		justify-content: center;
	}

	@container (min-width: 640px) {
		/* Side by side, section titles and their Hide links need more air
		   between columns than the phone's 8pt. A container query cannot
		   restyle the container itself, so the variable is set a level down. */
		.content {
			--gch-gap: 16px;
			padding: 16px 32px 32px;
		}
		.pane-header {
			padding: 10px 24px 10px 32px;
		}
		.top-row,
		.more {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
		.wide-only {
			display: block;
		}
		.narrow-only {
			display: none;
		}
		.focus {
			grid-auto-flow: row;
			grid-template-columns: repeat(2, minmax(0, 1fr));
			grid-auto-columns: auto;
			overflow: visible;
		}
		.glance {
			grid-template-columns: repeat(4, minmax(0, 1fr));
		}
	}

	@container (min-width: 1000px) {
		.top-row,
		.more,
		.focus {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
		.glance {
			grid-template-columns: repeat(6, minmax(0, 1fr));
		}
	}
</style>
