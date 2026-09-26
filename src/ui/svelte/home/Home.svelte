<script lang="ts">
	import { tick } from "svelte";
	import { HOME_GLANCE, type GlanceId } from "../../../dashboard/glance";
	import { presetFor, type FocusId, type HomeModel, type MoreId, type PresetId } from "../../../dashboard/home";
	import EmptyCard from "./EmptyCard.svelte";
	import FocusActivities from "./FocusActivities.svelte";
	import FocusBattery from "./FocusBattery.svelte";
	import FocusReadiness from "./FocusReadiness.svelte";
	import FocusSleep from "./FocusSleep.svelte";
	import FocusSteps from "./FocusSteps.svelte";
	import FocusTraining from "./FocusTraining.svelte";
	import Glance from "./Glance.svelte";
	import HomeCard from "./HomeCard.svelte";
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
	 */
	interface Props {
		initialModel: HomeModel;
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
	}

	let { initialModel, initialPreset, initialHidden, initialGlance, today, canSync, onSync, onChange, onPick }: Props = $props();

	// Seeded once; refreshes come through the exported setters.
	// svelte-ignore state_referenced_locally
	let model = $state(initialModel);
	// svelte-ignore state_referenced_locally
	let presetId = $state(initialPreset);
	// svelte-ignore state_referenced_locally
	let hidden = $state<MoreId[]>(initialHidden);
	// svelte-ignore state_referenced_locally
	let glance = $state<GlanceId[] | undefined>(initialGlance);

	export function setModel(next: HomeModel) {
		model = next;
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

	/* See All is a page of its own inside the view; Home's scroll position is
	   kept for the way back. */
	let page = $state<"home" | "glance">("home");
	let root = $state<HTMLElement | null>(null);
	let homeScroll = 0;

	async function openPage(next: "home" | "glance") {
		const scroller = root?.closest<HTMLElement>(".view-content");
		if (next === "glance") homeScroll = scroller?.scrollTop ?? 0;
		page = next;
		await tick();
		if (scroller) scroller.scrollTop = next === "home" ? homeScroll : 0;
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
	{#if id === "sleep"}<FocusSleep sleep={model.sleep} />
	{:else if id === "bodyBattery"}<FocusBattery battery={model.battery} />
	{:else if id === "steps"}<FocusSteps steps={model.steps} />
	{:else if id === "activities"}<FocusActivities activities={model.activities} />
	{:else if id === "readiness"}<FocusReadiness readiness={model.readiness} />
	{:else if id === "trainingStatus"}<FocusTraining status={model.trainingStatus} />
	{/if}
{/snippet}

{#snippet coach()}
	{#if model.sleepCoach}
		<RowCard kicker="Sleep Coach" icon="alarm-clock" color="var(--color-blue)" headline="{model.sleepCoach.hours} recommended" detail={model.sleepCoach.message} />
	{/if}
{/snippet}

<div class="gch-root" bind:this={root}>
	{#if page === "glance"}
		<SeeAll {model} list={glanceList} onBack={() => void openPage("home")} onSave={saveGlance} {onPick} />
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
			</div>
		</header>

		{#if sheet}
			<div class="content">
				<PresetSheet current={presetId} onPick={choose} onCancel={() => (sheet = false)} />
			</div>
		{:else}
			<div class="content">
				{#if model.date !== today}
					<div class="notice">Today isn’t synced yet. Showing {dateLabel}.</div>
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
						<section class="wide-only">
							<SectionHeader title="Sleep Coach" />
							<RowCard icon="alarm-clock" color="var(--color-blue)" headline="{model.sleepCoach.hours} recommended" detail={model.sleepCoach.message} />
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
					<SectionHeader title="At a Glance" action="See All" onAction={() => void openPage("glance")} />
					<div class="glance">
						{#each glanceList.slice(0, HOME_GLANCE) as id (id)}<Glance {id} {model} />{:else}
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
	.notice {
		color: var(--text-muted);
		font-size: 13px;
	}
	.quiet {
		color: var(--text-faint);
		font-size: 13px;
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
