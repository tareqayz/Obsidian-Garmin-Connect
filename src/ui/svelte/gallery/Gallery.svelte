<script lang="ts">
	import { BitsConfig } from "bits-ui";
	import { onDestroy } from "svelte";
	import { RANGES, TILES } from "../../../dashboard/metrics";
	import { compact, shiftDate, shortDate } from "../../../dashboard/series";
	import Accordion from "../ui/Accordion.svelte";
	import Checkbox from "../ui/Checkbox.svelte";
	import DateRange from "../ui/DateRange.svelte";
	import Dialog from "../ui/Dialog.svelte";
	import Menu, { type Entry } from "../ui/Menu.svelte";
	import Meter from "../ui/Meter.svelte";
	import Popover from "../ui/Popover.svelte";
	import Progress from "../ui/Progress.svelte";
	import { portalHost } from "../ui/portal";
	import Segmented from "../ui/Segmented.svelte";
	import Select from "../ui/Select.svelte";
	import Slider from "../ui/Slider.svelte";
	import Switch from "../ui/Switch.svelte";
	import Tabs from "../ui/Tabs.svelte";
	import Tip from "../ui/Tip.svelte";
	import Demo from "./Demo.svelte";

	interface Props {
		today: string;
		/** Only the browser preview owns the theme; inside Obsidian the app does. */
		showThemeToggle?: boolean;
	}

	let { today, showThemeToggle = false }: Props = $props();

	// Every portalled layer lands in this host so it keeps the --gcd-* tokens.
	// One call, inherited by every bits-ui component below it.
	const host = portalHost();

	/* ---------------------------------------------------------------- */
	/*  A shared log, so a demo that only fires a callback still shows    */
	/*  that it fired. Newest first, capped — this is a page people leave */
	/*  open while they poke at it.                                       */
	/* ---------------------------------------------------------------- */

	let log = $state<string[]>([]);
	function note(message: string) {
		const stamp = new Date().toLocaleTimeString(undefined, { hour12: false });
		log = [`${stamp}  ${message}`, ...log].slice(0, 8);
	}

	/* ---------------------------------------------------------------- */
	/*  Demo state                                                       */
	/* ---------------------------------------------------------------- */

	let range = $state("30");
	let legacyRange = $state(30);

	let metric = $state("steps");
	const metricOptions = TILES.map((tile) => ({ value: tile.key, label: tile.label }));

	let page = $state("overview");
	const pages = [
		{ value: "overview", label: "Overview" },
		{ value: "sleep", label: "Sleep" },
		{ value: "training", label: "Training" },
	];

	let syncOnStartup = $state(true);
	let writeDailyNote = $state(false);
	let syncDays = $state(5);

	const GROUPS = ["Activity", "Sleep", "Fitness"] as const;
	let groups = $state<string[]>(["Activity", "Sleep"]);
	let allGroups = $derived(groups.length === GROUPS.length);
	let someGroups = $derived(groups.length > 0 && !allGroups);

	function toggleGroup(name: string, on: boolean) {
		groups = on ? [...groups, name] : groups.filter((g) => g !== name);
		note(`groups → ${groups.join(", ") || "none"}`);
	}

	let series = $state<string[]>(["Deep", "REM"]);
	function toggleSeries(name: string, on: boolean) {
		series = on ? [...series, name] : series.filter((s) => s !== name);
		note(`series → ${series.join(", ") || "none"}`);
	}

	/* A stand-in backfill. The real one ticks once per day fetched, through
	   SyncRunner.watchProgress — see src/sync/runner.ts. */
	const BACKFILL_DAYS = 60;
	let backfill = $state<{ done: number; total: number; date: string } | null>(null);
	let timer: ReturnType<typeof setInterval> | undefined;

	function runBackfill() {
		if (timer) return;
		let done = 0;
		backfill = { done, total: BACKFILL_DAYS, date: shiftDate(today, -BACKFILL_DAYS) };
		timer = setInterval(() => {
			done += 1;
			if (done > BACKFILL_DAYS) {
				clearInterval(timer);
				timer = undefined;
				backfill = null;
				note("backfill finished");
				return;
			}
			backfill = {
				done,
				total: BACKFILL_DAYS,
				date: shiftDate(today, -(BACKFILL_DAYS - done)),
			};
		}, 70);
	}

	onDestroy(() => {
		if (timer) clearInterval(timer);
	});

	const STEP_GOAL = 10000;
	let stepsToday = $state(8432);

	let confirmOpen = $state(false);
	let openPanels = $state<string[]>([]);

	// Seeded once from `today`; the pickers own the window from then on.
	// svelte-ignore state_referenced_locally
	let from = $state(shiftDate(today, -13));
	// svelte-ignore state_referenced_locally
	let to = $state(today);
	// svelte-ignore state_referenced_locally
	let legacyFrom = $state(shiftDate(today, -13));
	// svelte-ignore state_referenced_locally
	let legacyTo = $state(today);
	const EARLIEST = "2010-01-01";

	// Mirrors the estimate SyncRangeForm shows; the point of picking a range.
	let spanDays = $derived(
		from && to ? Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1 : 0,
	);

	let cardMenu = $derived<Entry[]>([
		{ kind: "item", label: "Expand", onSelect: () => note("card → expand") },
		{ kind: "item", label: "Show explanation", onSelect: () => note("card → info") },
		{ kind: "separator" },
		{ kind: "heading", label: "Series" },
		...["Deep", "REM", "Light", "Awake"].map(
			(name): Entry => ({
				kind: "check",
				label: name,
				checked: series.includes(name),
				onCheckedChange: (on) => toggleSeries(name, on),
			}),
		),
		{ kind: "separator" },
		{
			kind: "item",
			label: "Remove from layout",
			danger: true,
			onSelect: () => (confirmOpen = true),
		},
	]);

	// Real copy from dashboard/metrics.ts — the strings behind today's "i" buttons.
	const infoPanels = TILES.slice(0, 4).map((tile) => ({
		value: tile.key,
		title: tile.label,
		text: tile.info,
	}));

	/* ---------------------------------------------------------------- */

	const SECTIONS = [
		["segmented", "Segmented"],
		["select", "Select"],
		["menu", "Menu"],
		["tabs", "Tabs"],
		["calendar", "Date range"],
		["popover", "Popover"],
		["dialog", "Dialog"],
		["tooltip", "Tooltip"],
		["switch", "Switch"],
		["checkbox", "Checkbox"],
		["slider", "Slider"],
		["progress", "Progress"],
		["meter", "Meter"],
		["accordion", "Accordion"],
	] as const;

	let dark = $state(false);
	function toggleTheme() {
		dark = !dark;
		document.body.classList.toggle("theme-dark", dark);
		document.body.classList.toggle("theme-light", !dark);
	}
</script>

<BitsConfig defaultPortalTo={host}>
	<div class="gcd-root gallery">
		<header class="top">
			<div>
				<h2>UI component gallery</h2>
				<p class="lede">
					bits-ui primitives styled with this plugin's own tokens — no Tailwind, no
					shadcn theme layer. Everything below is live: keyboard-navigate it, resize the
					pane to phone width, and switch the Obsidian theme to check both.
				</p>
			</div>
			{#if showThemeToggle}
				<button class="theme" onclick={toggleTheme}>{dark ? "Light" : "Dark"}</button>
			{/if}
		</header>

		<nav aria-label="Sections">
			{#each SECTIONS as [id, label] (id)}
				<a href="#{id}">{label}</a>
			{/each}
		</nav>

		<div class="grid">
			<Demo
				id="segmented"
				title="Segmented control"
				primitive="ToggleGroup"
				use="The range chips in FilterBar.svelte, and any future widget-level toggle."
				gains="One tab stop for the whole group; ← → moves between segments. The hand-rolled version makes every chip its own tab stop."
			>
				{#snippet current()}
					<div class="chips">
						{#each RANGES as r (r.days)}
							<button
								class="chip"
								class:selected={legacyRange === r.days}
								aria-pressed={legacyRange === r.days}
								onclick={() => (legacyRange = r.days)}>{r.label}</button
							>
						{/each}
					</div>
				{/snippet}
				<Segmented
					label="Date range"
					value={range}
					items={RANGES.map((r) => ({ value: String(r.days), label: r.label }))}
					onValueChange={(v) => {
						range = v;
						note(`range → ${v} days`);
					}}
				/>
			</Demo>

			<Demo
				id="select"
				title="Select"
				primitive="Select"
				use="Choosing which metric a widget plots — the per-widget setting TODO.md asks for."
				gains="Typeahead, arrow keys, flips above the trigger near the bottom of a pane, and caps its own height to the space available."
			>
				<Select
					label="Metric"
					value={metric}
					options={metricOptions}
					onValueChange={(v) => {
						metric = v;
						note(`metric → ${v}`);
					}}
				/>
			</Demo>

			<Demo
				id="menu"
				title="Overflow menu"
				primitive="DropdownMenu"
				use="Per-card actions on a dashboard widget: expand, pick series, remove."
				gains="Focus returns to the trigger on close, Esc dismisses, typeahead jumps to an item, and the checkbox rows keep the menu open."
			>
				{#snippet current()}
					<div class="chips">
						<button class="icon" title="About" aria-label="About">i</button>
						<button class="icon" title="Expand" aria-label="Expand">⤢</button>
					</div>
				{/snippet}
				<Menu label="Sleep card options" entries={cardMenu} />
			</Demo>

			<Demo
				id="tabs"
				fill
				title="Tabs"
				primitive="Tabs"
				use="The 'multiple dashboard pages' item at the bottom of TODO.md."
				gains="Arrow keys move between pages, each panel is bound to its tab by aria, and unselected panels leave the accessibility tree."
			>
				<Tabs
					value={page}
					tabs={pages}
					onValueChange={(v) => {
						page = v;
						note(`page → ${v}`);
					}}
				>
					{#snippet panel(value)}
						<div class="panel">
							{#if value === "overview"}
								Steps, resting HR, Body Battery — the default layout.
							{:else if value === "sleep"}
								Stages, score and duration, stacked.
							{:else}
								VO2 Max, endurance score, race predictions.
							{/if}
						</div>
					{/snippet}
				</Tabs>
			</Demo>

			<Demo
				id="calendar"
				title="Date range"
				primitive="RangeCalendar"
				use="The two date fields in SyncRangeForm.svelte, where you judge how big a backfill is."
				gains="One control shows the span as a shape. The native inputs render differently on every platform and can never show both ends at once."
			>
				{#snippet current()}
					<div class="dates">
						<label for="legacy-from">From</label>
						<input
							id="legacy-from"
							type="date"
							min={EARLIEST}
							max={today}
							bind:value={legacyFrom}
						/>
						<label for="legacy-to">To</label>
						<input id="legacy-to" type="date" min={EARLIEST} max={today} bind:value={legacyTo} />
					</div>
				{/snippet}
				<div class="cal">
					<DateRange
						{from}
						{to}
						min={EARLIEST}
						max={today}
						months={2}
						onChange={(a, b) => {
							from = a;
							to = b;
							if (a && b) note(`range → ${a} … ${b}`);
						}}
					/>
					<p class="estimate" role="status">
						{#if spanDays > 0}
							{spanDays} day{spanDays === 1 ? "" : "s"} · roughly {(
								spanDays * 4
							).toLocaleString()} requests
						{:else}
							Pick an end date.
						{/if}
					</p>
				</div>
			</Demo>

			<Demo
				id="popover"
				title="Popover"
				primitive="Popover"
				use="The custom window in FilterBar, which currently pushes a second row into the layout."
				gains="Holds the calendar without reflowing the page, traps focus while open, and closes on Esc or an outside click."
			>
				<Popover label="Custom date window">
					{#snippet trigger()}Custom…{/snippet}
					{#snippet children(close)}
						<div class="popbody">
							<div class="popheading">Custom window</div>
							<DateRange
								{from}
								{to}
								min={EARLIEST}
								max={today}
								onChange={(a, b) => {
									from = a;
									to = b;
								}}
							/>
							<button
								class="cta"
								onclick={() => {
									note(`applied ${from} … ${to}`);
									close();
								}}>Apply</button
							>
						</div>
					{/snippet}
				</Popover>
			</Demo>

			<Demo
				id="dialog"
				title="Dialog"
				primitive="Dialog"
				use="A confirm that belongs inside the view. Obsidian's own Modal stays right for whole tasks like sign-in."
				gains="Focus trap, scroll lock, Esc, and focus restored to whatever opened it — the parts a hand-rolled overlay always misses."
			>
				<button class="cta" onclick={() => (confirmOpen = true)}>Remove widget…</button>
				<Dialog
					open={confirmOpen}
					title="Remove this widget?"
					description="It comes back from the layout menu. Nothing synced is deleted."
					onOpenChange={(v) => (confirmOpen = v)}
				>
					The Sleep card would be removed from the Overview layout.
					{#snippet actions(close)}
						<button onclick={close}>Cancel</button>
						<button
							class="cta danger"
							onclick={() => {
								note("widget removed");
								close();
							}}>Remove</button
						>
					{/snippet}
				</Dialog>
			</Demo>

			<Demo
				id="tooltip"
				title="Tooltip"
				primitive="Tooltip"
				use="The 'i' buttons on StatTile and Card, which today toggle a paragraph and reflow the tile."
				gains="Opens on focus as well as hover, flips when it would run off the pane, and does not change the tile's height."
			>
				{#snippet current()}
					<div class="chips">
						<span class="tilelabel">Resting HR</span>
						<button class="icon" aria-label="About Resting HR">i</button>
					</div>
				{/snippet}
				<div class="chips">
					<span class="tilelabel">Resting HR</span>
					<Tip text={TILES[2]?.info ?? ""}>
						{#snippet trigger()}<span class="icon" role="img" aria-label="About Resting HR">i</span
							>{/snippet}
					</Tip>
				</div>
			</Demo>

			<Demo
				id="switch"
				fill
				title="Switch"
				primitive="Switch"
				use="Settings that take effect immediately — the boolean rows in SettingsPanel."
				gains="A real button with role=switch and aria-checked, driven by Space or Enter."
			>
				<Switch
					label="Sync on startup"
					hint="Waits 5s for the metadata cache before it runs."
					checked={syncOnStartup}
					onCheckedChange={(v) => {
						syncOnStartup = v;
						note(`syncOnStartup → ${v}`);
					}}
				/>
				<Switch
					label="Write into the daily note"
					hint="Off means one note per day in the Garmin folder."
					checked={writeDailyNote}
					onCheckedChange={(v) => {
						writeDailyNote = v;
						note(`writeDailyNote → ${v}`);
					}}
				/>
			</Demo>

			<Demo
				id="checkbox"
				fill
				title="Checkbox"
				primitive="Checkbox"
				use="Which metric groups a sync fetches — the setting that drives the request estimate."
				gains="A tri-state parent that reports aria-checked=mixed, which a plain input cannot do without scripting."
			>
				<Checkbox
					label="All metric groups"
					checked={allGroups}
					indeterminate={someGroups}
					onCheckedChange={(on) => {
						groups = on ? [...GROUPS] : [];
						note(`groups → ${groups.join(", ") || "none"}`);
					}}
				/>
				<div class="nested">
					{#each GROUPS as name (name)}
						<Checkbox
							label={name}
							checked={groups.includes(name)}
							onCheckedChange={(on) => toggleGroup(name, on)}
						/>
					{/each}
				</div>
			</Demo>

			<Demo
				id="slider"
				fill
				title="Slider"
				primitive="Slider"
				use="How many recent days a routine sync covers. Garmin finalises a night hours late, so this is never 1."
				gains="Arrow keys step, Home/End jump, and the whole track is a drag target on a phone."
			>
				<Slider
					label="Days per sync"
					display="{syncDays} day{syncDays === 1 ? '' : 's'}"
					value={syncDays}
					min={1}
					max={30}
					onValueChange={(v) => {
						syncDays = v;
						note(`syncDays → ${v}`);
					}}
				/>
			</Demo>

			<Demo
				id="progress"
				title="Progress"
				primitive="hand-rolled"
				use="A running sync or backfill. SyncRunner.watchProgress already emits done/total/date — this is the dashboard end of it."
				gains="A year-long backfill is thousands of requests. The bar plus the day it is on is the difference between 'working' and 'hung'."
				fill
				currentLabel="Today — Notice text"
				nextLabel="Proposed"
			>
				{#snippet current()}
					<div class="noticeline">Garmin sync: 27/60 (2026-08-17)</div>
				{/snippet}
				<div class="progressdemo">
					{#if backfill}
						<div class="bar">
							<Progress
								value={backfill.done}
								max={backfill.total}
								label="Garmin sync"
								caption="{backfill.done} / {backfill.total} · {shortDate(backfill.date)}"
							/>
						</div>
					{:else}
						<button class="cta" onclick={runBackfill}>Run a {BACKFILL_DAYS}-day backfill</button>
					{/if}
				</div>
			</Demo>

			<Demo
				id="meter"
				title="Meter"
				primitive="hand-rolled"
				use="Steps against the day's goal. `steps_goal` is already synced and already draws the dashed line on the chart — the tile ignored it."
				gains="role=meter, not progressbar: this is a measurement in a known range, not a task advancing. Hitting the goal changes colour."
				fill
			>
				<Meter
					value={stepsToday}
					max={STEP_GOAL}
					label="Steps against goal"
					caption="{Math.round((stepsToday / STEP_GOAL) * 100)}% of {compact(STEP_GOAL)}"
				/>
				<div class="metercontrol">
					<Slider
						label="Steps today"
						display={compact(stepsToday)}
						value={stepsToday}
						min={0}
						max={14000}
						step={100}
						onValueChange={(v) => (stepsToday = v)}
					/>
				</div>
			</Demo>

			<Demo
				id="accordion"
				fill
				title="Accordion"
				primitive="Accordion"
				use="The metric explanations — the text below is the real `info` copy from dashboard/metrics.ts."
				gains="Proper heading + region semantics, so the explanations are reachable by heading navigation rather than being anonymous divs."
			>
				<Accordion
					panels={infoPanels}
					value={openPanels}
					onValueChange={(v) => (openPanels = v)}
				/>
			</Demo>
		</div>

		<section class="log" aria-label="Callback log">
			<h3>Callbacks</h3>
			<p class="lede">Proof the wiring reaches your code, not just the DOM.</p>
			{#if log.length === 0}
				<p class="empty">Nothing yet — change something above.</p>
			{:else}
				<ul>
					{#each log as line (line)}
						<li>{line}</li>
					{/each}
				</ul>
			{/if}
		</section>
	</div>
</BitsConfig>

<style>
	.gallery {
		padding: 16px;
		max-width: 1100px;
		margin: 0 auto;
		color: var(--gcd-text);
		background: var(--gcd-surface);
	}
	.top {
		display: flex;
		align-items: flex-start;
		gap: 12px;
		flex-wrap: wrap;
	}
	h2 {
		margin: 0 0 4px;
		font-size: var(--font-ui-large, 17px);
	}
	.lede {
		margin: 0;
		max-width: 62ch;
		color: var(--gcd-muted);
		font-size: var(--font-ui-smaller, 12px);
		line-height: 1.55;
	}
	.theme {
		margin-left: auto;
		flex: none;
		padding: 4px 12px;
		border-radius: 999px;
		border: 1px solid var(--gcd-border);
		background: transparent;
		color: var(--gcd-muted);
		font-size: var(--font-ui-smaller, 12px);
		cursor: pointer;
		box-shadow: none;
	}

	nav {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
		margin: 14px 0 16px;
		padding-bottom: 14px;
		border-bottom: 1px solid var(--gcd-border);
	}
	nav a {
		padding: 3px 10px;
		border-radius: 999px;
		border: 1px solid var(--gcd-border);
		color: var(--gcd-muted);
		font-size: 11px;
		text-decoration: none;
	}
	nav a:hover {
		background: var(--gcd-raised);
		color: var(--gcd-text);
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
		gap: 14px;
		align-items: start;
	}

	/* Stand-ins for the current hand-rolled controls, copied from FilterBar
	   and Card so the comparison is like-for-like rather than flattering. */
	.chips {
		display: flex;
		gap: 6px;
		align-items: center;
		flex-wrap: wrap;
	}
	.chip {
		padding: 4px 12px;
		border-radius: 999px;
		border: 1px solid var(--gcd-border);
		background: transparent;
		color: var(--gcd-muted);
		font-size: var(--font-ui-smaller, 12px);
		cursor: pointer;
		box-shadow: none;
	}
	.chip.selected {
		background: var(--gcd-raised);
		border-color: var(--gcd-series);
		color: var(--gcd-text);
		font-weight: 600;
	}
	.icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 22px;
		height: 22px;
		padding: 0;
		border-radius: 50%;
		border: 1px solid var(--gcd-border);
		background: transparent;
		color: var(--gcd-muted);
		font-size: 11px;
		line-height: 1;
		cursor: pointer;
		box-shadow: none;
	}
	.tilelabel {
		color: var(--gcd-muted);
		font-size: var(--font-ui-smaller, 12px);
	}
	.dates {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-wrap: wrap;
		font-size: var(--font-ui-smaller, 12px);
		color: var(--gcd-muted);
	}
	.dates input {
		font-size: var(--font-ui-smaller, 12px);
		padding: 2px 6px;
		min-width: 0;
	}

	.cal {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 8px;
	}
	.estimate {
		margin: 0;
		color: var(--gcd-muted);
		font-size: var(--font-ui-smaller, 12px);
	}
	.panel {
		color: var(--gcd-muted);
		font-size: var(--font-ui-smaller, 12px);
		line-height: 1.5;
	}
	.nested {
		margin: 8px 0 0 22px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.noticeline {
		color: var(--gcd-muted);
		font-size: var(--font-ui-smaller, 12px);
		font-variant-numeric: tabular-nums;
	}
	.progressdemo {
		min-height: 24px;
		display: flex;
		align-items: center;
	}
	/* The bar takes the row; the button that starts it keeps its own width. */
	.bar {
		flex: 1 1 auto;
		min-width: 0;
	}
	.metercontrol {
		margin-top: 10px;
	}
	.popbody {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 10px;
	}
	.popheading {
		font-size: var(--font-ui-small, 13px);
		font-weight: 600;
	}
	.cta {
		padding: 4px 14px;
		border-radius: 6px;
		border: 1px solid var(--gcd-series);
		background: var(--gcd-series);
		color: #ffffff;
		font-size: var(--font-ui-smaller, 12px);
		cursor: pointer;
		box-shadow: none;
	}
	.cta.danger {
		border-color: var(--gcd-bad);
		background: var(--gcd-bad);
	}

	.log {
		margin-top: 16px;
		padding: 14px 16px;
		border: 1px solid var(--gcd-border);
		border-radius: var(--gcd-radius, 8px);
		background: var(--gcd-surface);
	}
	.log h3 {
		margin: 0 0 2px;
		font-size: var(--font-ui-medium, 15px);
	}
	.log ul {
		margin: 10px 0 0;
		padding: 0;
		list-style: none;
	}
	.log li {
		padding: 3px 0;
		border-bottom: 1px solid var(--gcd-border);
		color: var(--gcd-muted);
		font-family: var(--font-monospace, ui-monospace, monospace);
		font-size: 11px;
	}
	.log li:last-child {
		border-bottom: none;
	}
	.empty {
		margin: 10px 0 0;
		color: var(--gcd-muted);
		font-size: 11px;
	}
</style>
