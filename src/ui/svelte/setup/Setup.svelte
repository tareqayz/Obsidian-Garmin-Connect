<script lang="ts">
	import { onMount } from "svelte";
	import type { MfaPrompt } from "../../../garmin/auth";
	import { ACTIVITY_DETAILS_RANGES, DAY_DETAILS_RANGES, type ActivityDetailsRange, type DayDetailsRange } from "../../../sync/datasets";
	import { formatBytes, formatDuration } from "../../../sync/estimate";
	import type { AccountScan, ScanResult, ScanStep } from "../../../sync/scan";
	import { SPEED_LABELS, type SyncSpeed } from "../../../sync/speed";
	import { afterScan, back, next, SETUP_STEPS, startFlow, stepState, type Choices, type Prepared, type SetupFlow } from "../../setup-flow";
	import { lucide } from "../home/lucide";
	import LoginForm from "../LoginForm.svelte";

	interface Props {
		signedIn: boolean;
		initialEmail: string;
		onEmailChange: (email: string) => void;
		/** Resolves to an error message, or null once signed in. */
		onSignIn: (email: string, password: string, prompt: MfaPrompt) => Promise<string | null>;
		/** The scan, and the activity list after it. Null when it could not start. */
		onScan: (onStep: (step: ScanStep) => void) => Promise<ScanResult | null>;
		prepare: (scan: AccountScan) => Promise<Prepared>;
		initialChoices: Choices;
		initialSpeed: SyncSpeed;
		today: string;
		onStart: (choices: Choices, speed: SyncSpeed) => void;
		/** "Keep new days only": no history. */
		onNewDaysOnly: (speed: SyncSpeed) => void;
		onCancel: () => void;
	}

	let { signedIn, initialEmail, onEmailChange, onSignIn, onScan, prepare, initialChoices, initialSpeed, today, onStart, onNewDaysOnly, onCancel }: Props = $props();

	// svelte-ignore state_referenced_locally
	let flow = $state<SetupFlow>(startFlow(signedIn));
	// svelte-ignore state_referenced_locally
	let signed = $state(signedIn);
	// svelte-ignore state_referenced_locally
	let dayDetails = $state<DayDetailsRange>(initialChoices.dayDetails);
	// svelte-ignore state_referenced_locally
	let activityDetails = $state<ActivityDetailsRange>(initialChoices.activityDetails);
	// svelte-ignore state_referenced_locally
	let speed = $state<SyncSpeed>(initialSpeed);

	let upload = $state<{ done: boolean; at?: string }>({ done: false });
	let listed = $state<{ done: boolean; count: number; first?: string }>({ done: false, count: 0 });
	let health = $state<{ done: boolean; reached?: string; days: number }>({ done: false, days: 0 });
	let scan = $state<AccountScan | null>(null);
	let prepared = $state<Prepared | null>(null);
	let scanError = $state("");

	let estimate = $derived(prepared ? prepared.estimate({ dayDetails, activityDetails }, speed) : null);
	let charts = $derived(estimate?.sets.find((s) => s.id === "charts"));
	let days = $derived(estimate?.sets.find((s) => s.id === "day-details"));
	let details = $derived(estimate?.sets.find((s) => s.id === "activity-details"));

	const SPEEDS: SyncSpeed[] = ["gentle", "normal", "fast"];
	const dateFormat = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" });
	const timeFormat = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
	const count = new Intl.NumberFormat();

	function day(date: string | undefined): string {
		return date ? dateFormat.format(new Date(`${date}T12:00:00`)) : "";
	}

	function uploadLabel(at: string | undefined): string {
		if (!at) return "Last watch upload: not found";
		const when = new Date(at);
		const local = `${when.getFullYear()}-${String(when.getMonth() + 1).padStart(2, "0")}-${String(when.getDate()).padStart(2, "0")}`;
		return `Last watch upload: ${local === today ? "today" : day(local)}, ${timeFormat.format(when)}`;
	}

	/** One scan at a time: Try again while one runs does nothing. */
	let scanning = false;

	async function runScan() {
		if (scanning) return;
		scanning = true;
		try {
			await scanOnce();
		} finally {
			scanning = false;
		}
	}

	async function scanOnce() {
		flow = { step: "scan", scan: "scanning" };
		upload = { done: false };
		listed = { done: false, count: 0 };
		health = { done: false, days: 0 };
		scanError = "";
		prepared = null;
		const result = await onScan((step) => {
			if (step.step === "upload") upload = { done: true, ...(step.lastUpload ? { at: step.lastUpload } : {}) };
			else if (step.step === "activities") listed = { done: true, count: step.count, ...(step.first ? { first: step.first } : {}) };
			else health = { done: false, reached: step.reached, days: step.days };
		});
		health = { ...health, done: true };
		scan = result?.scan ?? null;
		if (result?.fatal) scanError = explainFatal(result.fatal);
		else if (!result) scanError = "The scan couldn’t start. Check that you’re signed in and online.";
		if (scan && !result?.fatal) prepared = await prepare(scan);
		flow = afterScan(result);
	}

	function explainFatal(err: unknown): string {
		const name = (err as { name?: string } | null)?.name ?? "";
		if (/RateLimit/.test(name)) return "Garmin asked us to slow down (HTTP 429). Try again in a minute.";
		if (/Auth/.test(name)) return "Your Garmin session ended. Sign in again, then try again.";
		return err instanceof Error ? err.message : String(err);
	}

	onMount(() => {
		if (signed) void runScan();
	});

	async function signIn(email: string, password: string, prompt: MfaPrompt): Promise<string | null> {
		const error = await onSignIn(email, password, prompt);
		if (!error) {
			signed = true;
			void runScan();
		}
		return error;
	}

	function scanRange(s: AccountScan): string {
		const first = [s.firstDay, s.firstActivity].filter((d): d is string => !!d).sort()[0];
		return first ? `${day(first)} → today` : "Nothing yet";
	}

	function rangeLabel<T extends string>(list: ReadonlyArray<{ id: T; label: string }>, id: T): string {
		return list.find((r) => r.id === id)?.label.toLowerCase() ?? id;
	}

	function daysMeta(): string {
		if (!days) return "";
		const grows = `grows ≈ ${formatBytes(days.bytesPerYear)} a year`;
		if (dayDetails === "new") return `Nothing to download now · ${grows}`;
		if (!days.units) return `Already in this vault · ${grows}`;
		return `≈ ${formatBytes(days.bytes)} · ${formatDuration(days.seconds)} · ${grows}`;
	}

	function detailsMeta(): string {
		if (!details) return "";
		if (activityDetails === "opened") return "Downloaded when you open an activity · ≈ 150 KB each";
		if (!details.units) return "Every activity is in this vault already";
		return `${count.format(details.units)} ${details.units === 1 ? "activity" : "activities"} · ≈ ${formatBytes(details.bytes)} · ${formatDuration(details.seconds)}`;
	}

	function daysSummary(): string {
		if (dayDetails === "new") return "new days only";
		const units = days?.units ?? 0;
		return `${rangeLabel(DAY_DETAILS_RANGES, dayDetails)} (${units ? `${count.format(units)} ${units === 1 ? "day" : "days"}` : "all in this vault already"})`;
	}

	function detailsSummary(): string {
		if (activityDetails === "opened") return "when you open an activity";
		const units = details?.units ?? 0;
		return `${rangeLabel(ACTIVITY_DETAILS_RANGES, activityDetails)} (${units ? `${count.format(units)} ${units === 1 ? "activity" : "activities"}` : "all in this vault already"})`;
	}

	/** "≈ 5.1 MB now · about 2 minutes", or that there is nothing to fetch. */
	function totalLine(): string {
		if (!estimate?.requests) return "Nothing to download now";
		return `Total ≈ ${formatBytes(estimate.bytes)} now · ${formatDuration(estimate.seconds)}`;
	}
</script>

{#snippet steps()}
	<ol class="steps">
		{#each SETUP_STEPS as { step, label }, i}
			{@const state = stepState(flow, step)}
			{#if i > 0}<li class="rail" class:done={state !== "todo"} aria-hidden="true"></li>{/if}
			<li class="step {state}">
				<span class="disc">
					{#if state === "done"}<span use:lucide={"check"}></span>{:else}{i + 1}{/if}
				</span>
				<span class="label">{label}</span>
			</li>
		{/each}
	</ol>
{/snippet}

{#snippet tip(icon: string, text: string, tone: "tip" | "error" = "tip")}
	<div class="tip {tone}">
		<span class="tip-icon" use:lucide={icon}></span>
		<span>{text}</span>
	</div>
{/snippet}

<div class="gch-setup-body">
	{@render steps()}

	{#if flow.step === "signin"}
		<div class="intro">Connect your Garmin account. Your data stays in this vault as JSON files.</div>
		<LoginForm {initialEmail} {onEmailChange} onSubmit={signIn} {onCancel} embedded />
	{:else if flow.step === "scan"}
		{#if flow.scan === "scanning"}
			<h3>Looking through your Garmin history…</h3>
			<div class="bar indeterminate" role="progressbar" aria-busy="true"><span></span></div>
			<ul class="checklist">
				<li class:done={upload.done}>
					<span class="mark" use:lucide={upload.done ? "check" : "loader-circle"}></span>
					{upload.done ? uploadLabel(upload.at) : "Checking your watch’s last upload…"}
				</li>
				<li class:done={listed.done} class:todo={!upload.done}>
					<span class="mark" use:lucide={listed.done ? "check" : upload.done ? "loader-circle" : "circle-dashed"}></span>
					{listed.done
						? `${count.format(listed.count)} ${listed.count === 1 ? "activity" : "activities"}${listed.first ? `, the first on ${day(listed.first)}` : ""}`
						: "Counting activities…"}
				</li>
				<li class:done={health.done} class:todo={!listed.done}>
					<span class="mark" use:lucide={health.done ? "check" : listed.done ? "loader-circle" : "circle-dashed"}></span>
					{health.reached ? `Health data: reading ${health.reached.slice(0, 4)}…` : "Health data…"}
				</li>
			</ul>
			<div class="footer">
				<button disabled>Back</button>
				<button class="mod-cta" disabled>Continue</button>
			</div>
		{:else if flow.scan === "result" && scan}
			<div class="summary">
				<div class="kicker">Your Garmin history</div>
				<div class="headline">{scanRange(scan)}</div>
				<div class="sub">
					{count.format(scan.days)} days with health data · {count.format(scan.activities)}
					{scan.activities === 1 ? "activity" : "activities"}
				</div>
			</div>
			{#if prepared && (prepared.held.days || prepared.held.activities)}
				{@render tip(
					"info",
					`Already in this vault: ${count.format(prepared.held.days)} days of details and ${count.format(prepared.held.activities)} ${prepared.held.activities === 1 ? "activity" : "activities"} (${formatBytes(prepared.held.bytes)}). Only what’s missing will be downloaded.`,
				)}
			{/if}
			<div class="footer">
				<button disabled>Back</button>
				<button class="mod-cta" onclick={() => (flow = next(flow))}>Continue</button>
			</div>
		{:else if flow.scan === "empty"}
			<h3>There’s no data on Garmin yet.</h3>
			<div class="body">Wear your watch and sync it with the Garmin Connect app. New days appear here automatically.</div>
			<div class="footer">
				<button class="mod-cta" onclick={() => onStart({ dayDetails, activityDetails }, speed)}>Done</button>
			</div>
		{:else}
			{@render tip("circle-alert", scanError || "The scan stopped before it finished.", "error")}
			<div class="footer">
				<button onclick={onCancel}>Close</button>
				<button class="mod-cta" onclick={() => void runScan()}>Try again</button>
			</div>
		{/if}
	{:else if flow.step === "choose"}
		<h3>Choose what to keep</h3>
		<div class="sets">
			<div class="set">
				<div class="set-text">
					<div class="set-title">Charts &amp; trends</div>
					<div class="set-blurb">Every stat’s 7-day, 4-week and 1-year charts, your activity list and sleep scores.</div>
					<div class="set-meta">
						{charts?.requests ? `≈ ${formatBytes(charts.bytes)} · ${formatDuration(charts.seconds)}` : "Already in this vault"}
					</div>
				</div>
				<span class="pill">All history</span>
			</div>
			<div class="set">
				<div class="set-text">
					<div class="set-title">Day details</div>
					<div class="set-blurb">Open any past day: heart rate, stress, Body Battery, steps, floors and sleep stages through the day.</div>
					<div class="set-meta">{daysMeta()}</div>
				</div>
				<select class="dropdown" bind:value={dayDetails} aria-label="How far back Day details go">
					{#each DAY_DETAILS_RANGES as range}<option value={range.id}>{range.label}</option>{/each}
				</select>
			</div>
			<div class="set">
				<div class="set-text">
					<div class="set-title">Activity details</div>
					<div class="set-blurb">Map, charts, laps and stats for each activity: runs, rides, swims and every other sport.</div>
					<div class="set-meta">{detailsMeta()}</div>
				</div>
				<select class="dropdown" bind:value={activityDetails} aria-label="Which activities to download">
					{#each ACTIVITY_DETAILS_RANGES as range}<option value={range.id}>{range.label}</option>{/each}
				</select>
			</div>
		</div>
		{#if estimate}
			<div class="totals">
				<strong>{totalLine()}</strong>
				<span>grows ≈ {formatBytes(estimate.bytesPerYear)} a year</span>
			</div>
		{/if}
		<div class="speed">
			<div class="speed-text">
				<div class="set-title">Sync speed</div>
				<div class="set-meta">Faster finishes sooner; Gentle is easiest on Garmin.</div>
			</div>
			<div class="segmented" role="radiogroup" aria-label="Sync speed">
				{#each SPEEDS as id}
					<button role="radio" aria-checked={speed === id} class:selected={speed === id} onclick={() => (speed = id)}>{SPEED_LABELS[id]}</button>
				{/each}
			</div>
		</div>
		{@render tip("smartphone", "On a phone, the backfill pauses while Obsidian is in the background and picks up where it left off.")}
		{@render tip("refresh-cw", "Using Obsidian Sync? Turn on Sync all other types so this data reaches your other devices.")}
		<div class="footer">
			<button onclick={() => (flow = back(flow, signed))}>Back</button>
			<button class="mod-cta" onclick={() => (flow = next(flow))}>Continue</button>
		</div>
	{:else}
		<h3>Ready to download</h3>
		<ul class="plan">
			<li><span class="plan-icon" use:lucide={"chart-line"}></span><span>Charts &amp; trends <span class="muted">— all history</span></span></li>
			<li><span class="plan-icon" use:lucide={"calendar"}></span><span>Day details <span class="muted">— {daysSummary()}</span></span></li>
			<li><span class="plan-icon" use:lucide={"route"}></span><span>Activity details <span class="muted">— {detailsSummary()}</span></span></li>
		</ul>
		{#if estimate}
			<div class="totals single">
				<strong>{estimate.requests ? `≈ ${formatBytes(estimate.bytes)} · ${formatDuration(estimate.seconds)} · ${count.format(estimate.requests)} requests` : "Nothing to download now"}</strong>
			</div>
		{/if}
		<div class="body">You can keep using Obsidian. Progress shows on Home and in Settings → Data, and it carries on after a restart.</div>
		<div class="footer split">
			<button onclick={() => onNewDaysOnly(speed)}>Keep new days only</button>
			<div class="footer-end">
				<button onclick={() => (flow = back(flow, signed))}>Back</button>
				<button class="mod-cta" onclick={() => onStart({ dayDetails, activityDetails }, speed)}>Start download</button>
			</div>
		</div>
	{/if}
</div>

<style>
	.gch-setup-body {
		container-type: inline-size;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	h3 {
		margin: 4px 0 0;
		font-size: 17px;
		line-height: 22px;
		font-weight: 600;
	}
	.intro,
	.body {
		color: var(--text-muted);
		font-size: var(--font-ui-small);
		line-height: 20px;
	}

	/* Steps */
	.steps {
		display: flex;
		align-items: center;
		gap: 8px;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.step {
		display: flex;
		align-items: center;
		gap: 6px;
		flex: none;
		color: var(--text-muted);
		font-size: var(--font-ui-small);
	}
	.step.current {
		color: var(--text-normal);
		font-weight: 600;
	}
	.disc {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 20px;
		height: 20px;
		border-radius: 50%;
		border: 1px solid var(--background-modifier-border);
		font-size: 11px;
		font-weight: 600;
	}
	.step.current .disc,
	.step.done .disc {
		border-color: var(--interactive-accent);
		background: var(--interactive-accent);
		color: var(--text-on-accent);
	}
	.disc :global(svg) {
		width: 12px;
		height: 12px;
		stroke-width: 3;
	}
	.rail {
		flex: 1;
		min-width: 8px;
		height: 2px;
		border-radius: 1px;
		background: var(--background-modifier-border);
	}
	.rail.done {
		background: var(--interactive-accent);
	}

	/* Scan */
	.bar {
		position: relative;
		height: 4px;
		border-radius: 2px;
		overflow: hidden;
		background: var(--background-modifier-border);
	}
	.bar span {
		position: absolute;
		inset: 0 auto 0 0;
		width: 30%;
		border-radius: 2px;
		background: var(--interactive-accent);
	}
	.bar.indeterminate span {
		animation: gch-setup-slide 1.4s ease-in-out infinite;
	}
	@keyframes gch-setup-slide {
		from {
			left: -30%;
		}
		to {
			left: 100%;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.bar.indeterminate span {
			animation: none;
			left: 35%;
		}
	}
	.checklist {
		display: flex;
		flex-direction: column;
		gap: 10px;
		margin: 0;
		padding: 0;
		list-style: none;
		font-size: var(--font-ui-small);
	}
	.checklist li {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.checklist li.todo {
		color: var(--text-faint);
	}
	.mark {
		display: inline-flex;
		color: var(--interactive-accent);
	}
	.checklist li.done .mark {
		color: var(--text-success);
	}
	.mark :global(svg) {
		width: 16px;
		height: 16px;
	}
	.summary {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 14px 16px;
		border-radius: var(--radius-m);
		background: var(--background-secondary);
	}
	.kicker {
		color: var(--text-muted);
		font-size: var(--font-ui-smaller);
	}
	.headline {
		font-size: 22px;
		line-height: 28px;
		font-weight: 700;
	}
	.sub {
		color: var(--text-muted);
		font-size: var(--font-ui-small);
	}

	/* Choose */
	.sets {
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-m);
	}
	.set {
		display: flex;
		align-items: flex-start;
		gap: 12px;
		padding: 12px 16px;
	}
	.set + .set {
		border-top: 1px solid var(--background-modifier-border);
	}
	.set-text {
		display: flex;
		flex-direction: column;
		gap: 2px;
		flex: 1;
		min-width: 0;
	}
	.set-title {
		font-size: var(--font-ui-medium);
		font-weight: 600;
	}
	.set-blurb {
		font-size: var(--font-ui-small);
		line-height: 18px;
	}
	.set-meta {
		color: var(--text-muted);
		font-size: var(--font-ui-smaller);
	}
	.pill {
		flex: none;
		padding: 2px 10px;
		border: 1px solid var(--background-modifier-border);
		border-radius: 999px;
		color: var(--text-muted);
		font-size: var(--font-ui-smaller);
		line-height: 20px;
	}
	select.dropdown {
		flex: none;
	}
	.totals {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 4px 12px;
		padding: 10px 16px;
		border-radius: var(--radius-m);
		background: var(--background-secondary);
	}
	.totals strong {
		font-size: var(--font-ui-medium);
	}
	.totals span {
		color: var(--text-muted);
		font-size: var(--font-ui-smaller);
	}
	.speed {
		display: flex;
		align-items: center;
		gap: 12px;
	}
	.speed-text {
		flex: 1;
		min-width: 0;
	}
	/* A raised segment, as Obsidian's own segmented controls draw the one chosen. */
	.segmented {
		display: inline-flex;
		flex: none;
		gap: 2px;
		padding: 2px;
		border-radius: var(--radius-s);
		background: var(--background-modifier-border);
	}
	.segmented button {
		height: auto;
		padding: 4px 12px;
		border: 1px solid transparent;
		border-radius: calc(var(--radius-s) - 2px);
		background: transparent;
		box-shadow: none;
		color: var(--text-muted);
		font-size: var(--font-ui-small);
		font-weight: 500;
	}
	.segmented button.selected {
		border-color: var(--background-modifier-border);
		background: var(--background-primary);
		box-shadow: var(--shadow-s);
		color: var(--text-normal);
	}
	/* In dark the page is darker than any track: a lighter segment on a darker track still reads as raised. */
	:global(.theme-dark) .segmented {
		background: var(--background-secondary);
	}
	:global(.theme-dark) .segmented button.selected {
		border-color: var(--background-modifier-border-hover);
		background: var(--background-modifier-border-hover);
	}
	.tip {
		display: flex;
		align-items: flex-start;
		gap: 10px;
		padding: 10px 12px;
		border-radius: var(--radius-m);
		background: var(--background-secondary);
		color: var(--text-muted);
		font-size: var(--font-ui-small);
		line-height: 18px;
	}
	.tip.error {
		color: var(--text-error);
		background: rgba(var(--color-red-rgb), 0.1);
	}
	.tip-icon {
		display: inline-flex;
		flex: none;
		margin-top: 1px;
	}
	.tip-icon :global(svg) {
		width: 16px;
		height: 16px;
	}

	/* Start */
	.plan {
		display: flex;
		flex-direction: column;
		gap: 8px;
		margin: 0;
		padding: 0;
		list-style: none;
		font-size: var(--font-ui-medium);
	}
	.plan li {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.plan-icon {
		display: inline-flex;
		color: var(--text-muted);
	}
	.plan-icon :global(svg) {
		width: 16px;
		height: 16px;
	}
	.muted {
		color: var(--text-muted);
	}

	.footer {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
		margin-top: 4px;
	}
	.footer.split {
		justify-content: space-between;
	}
	.footer-end {
		display: flex;
		gap: 8px;
	}

	/* A phone's sheet: controls under their text, buttons full width at the end. */
	@container (max-width: 480px) {
		.steps .label {
			display: none;
		}
		.step.current .label {
			display: inline;
		}
		.set {
			flex-direction: column;
		}
		.speed {
			flex-direction: column;
			align-items: stretch;
		}
		.segmented {
			display: flex;
		}
		.segmented button {
			flex: 1;
		}
		.footer,
		.footer.split,
		.footer-end {
			flex-direction: column-reverse;
			align-items: stretch;
		}
		.footer button {
			width: 100%;
		}
	}
</style>
