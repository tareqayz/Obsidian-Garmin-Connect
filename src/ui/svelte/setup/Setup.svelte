<script lang="ts">
	import { onMount } from "svelte";
	import type { MfaPrompt } from "../../../garmin/auth";
	import { ACTIVITY_DETAILS_RANGES, DAY_DETAILS_RANGES, type ActivityDetailsRange, type DayDetailsRange } from "../../../sync/datasets";
	import { formatBytes, formatDuration } from "../../../sync/estimate";
	import type { AccountScan, ScanResult, ScanStep } from "../../../sync/scan";
	import { SPEED_LABELS, type SyncSpeed } from "../../../sync/speed";
	import { afterScan, back, isRecommended, keptLabel, RECOMMENDED, startFlow, type Choices, type Prepared, type SetupFlow } from "../../setup-flow";
	import { lucide } from "../home/lucide";
	import LoginForm from "../LoginForm.svelte";
	import type { GarminDomain } from "../../../garmin/constants";

	interface Props {
		signedIn: boolean;
		initialEmail: string;
		initialDomain: GarminDomain;
		onDomainChange: (domain: GarminDomain) => Promise<void>;
		/** Resolves to an error message, or null once signed in. */
		onSignIn: (email: string, password: string, prompt: MfaPrompt) => Promise<string | null>;
		/** The scan, and the activity list after it. Null when it could not start. */
		onScan: (onStep: (step: ScanStep) => void) => Promise<ScanResult | null>;
		prepare: (scan: AccountScan) => Promise<Prepared>;
		/** What the vault keeps, for a setup run again; null on the first. */
		kept: Choices | null;
		initialSpeed: SyncSpeed;
		/** `downloads`: whether the choice leaves anything to fetch. */
		onStart: (choices: Choices, speed: SyncSpeed, downloads: boolean) => void;
		onCancel: () => void;
	}

	let { signedIn, initialEmail, initialDomain, onDomainChange, onSignIn, onScan, prepare, kept, initialSpeed, onStart, onCancel }: Props = $props();

	// svelte-ignore state_referenced_locally
	let flow = $state<SetupFlow>(startFlow(signedIn));
	// svelte-ignore state_referenced_locally
	let signed = $state(signedIn);
	// Advanced options start from what the vault keeps, or the recommendation.
	// svelte-ignore state_referenced_locally
	let dayDetails = $state<DayDetailsRange>((kept ?? RECOMMENDED).dayDetails);
	// svelte-ignore state_referenced_locally
	let activityDetails = $state<ActivityDetailsRange>((kept ?? RECOMMENDED).activityDetails);
	// svelte-ignore state_referenced_locally
	let speed = $state<SyncSpeed>(initialSpeed);

	let status = $state("");
	let scan = $state<AccountScan | null>(null);
	let prepared = $state<Prepared | null>(null);
	let scanError = $state("");

	let all = $derived(prepared ? prepared.estimate(RECOMMENDED, speed) : null);
	let chosen = $derived(prepared ? prepared.estimate({ dayDetails, activityDetails }, speed) : null);
	let days = $derived(chosen?.sets.find((s) => s.id === "day-details"));
	let details = $derived(chosen?.sets.find((s) => s.id === "activity-details"));

	const SPEEDS: SyncSpeed[] = ["gentle", "normal", "fast"];
	const dateFormat = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" });
	const count = new Intl.NumberFormat();

	function day(date: string | undefined): string {
		return date ? dateFormat.format(new Date(`${date}T12:00:00`)) : "";
	}

	function plural(n: number, one: string, many: string): string {
		return `${count.format(n)} ${n === 1 ? one : many}`;
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
		flow = { step: "scan", view: "scanning" };
		status = "Checking your watch’s last upload…";
		scanError = "";
		prepared = null;
		let listed = "";
		const result = await onScan((step) => {
			if (step.step === "upload") status = "Counting activities…";
			else if (step.step === "activities") {
				listed = plural(step.count, "activity", "activities");
				status = `${listed} · reading health data…`;
			} else status = `${listed} · reading health data from ${step.reached.slice(0, 4)}…`;
		});
		scan = result?.scan ?? null;
		if (result?.fatal) scanError = explainFatal(result.fatal);
		else if (!result) scanError = "The scan couldn’t start. Check that you’re signed in and online.";
		if (scan && !result?.fatal) {
			// The scanning view has no buttons: a failure here has to land somewhere with Try again.
			try {
				prepared = await prepare(scan);
			} catch (err) {
				scanError = err instanceof Error ? err.message : String(err);
				flow = { step: "scan", view: "error" };
				return;
			}
		}
		flow = afterScan(result);
	}

	function explainFatal(err: unknown): string {
		const name = (err as { name?: string } | null)?.name ?? "";
		if (/RateLimit/.test(name)) return "Garmin asked to slow down. Try again in a minute.";
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

	/** The recommendation's size and time; on a setup run again, what it adds to the vault. */
	function allMeta(): string {
		if (!all) return "";
		const size = `≈ ${formatBytes(all.bytes)} · ${formatDuration(all.seconds)}`;
		if (!kept) return `${size} while Obsidian is open`;
		const d = all.sets.find((s) => s.id === "day-details")?.units ?? 0;
		const a = all.sets.find((s) => s.id === "activity-details")?.units ?? 0;
		const adds = [d ? plural(d, "day", "days") : "", a ? plural(a, "activity", "activities") : ""].filter(Boolean);
		return adds.length ? `+ ${adds.join(" and ")} · ${size}` : size;
	}

	function daysMeta(): string {
		if (!days) return "";
		if (dayDetails === "new") return "Nothing to download now.";
		if (!days.units) return "All in this vault.";
		return `≈ ${formatBytes(days.bytes)} · ${formatDuration(days.seconds)}`;
	}

	function detailsMeta(): string {
		if (!details) return "";
		if (activityDetails === "opened") return "Each one downloads when you open it.";
		if (!details.units) return "All in this vault.";
		return `${plural(details.units, "activity", "activities")} · ≈ ${formatBytes(details.bytes)} · ${formatDuration(details.seconds)}`;
	}
</script>

{#snippet tip(icon: string, text: string, tone: "tip" | "error" = "tip")}
	<div class="tip {tone}">
		<span class="tip-icon" use:lucide={icon}></span>
		<span>{text}</span>
	</div>
{/snippet}

{#snippet line(icon: string, text: string)}
	<div class="line">
		<span class="line-icon" use:lucide={icon}></span>
		<span>{text}</span>
	</div>
{/snippet}

<div class="gch-setup-body">
	{#if flow.step === "signin"}
		<div class="intro">Sign in to bring your Garmin data into this vault.</div>
		<LoginForm {initialEmail} {initialDomain} {onDomainChange} onSubmit={signIn} {onCancel} embedded />
	{:else if flow.step === "scan"}
		{#if flow.view === "scanning"}
			<h3>Looking through your Garmin history…</h3>
			<div class="bar indeterminate" role="progressbar" aria-busy="true"><span></span></div>
			<div class="body" role="status">{status}</div>
		{:else if flow.view === "empty"}
			<h3>There’s no data on Garmin yet.</h3>
			<div class="body">Sync your watch with the Garmin Connect app. New days appear here automatically.</div>
			<div class="footer">
				<button class="mod-cta" onclick={() => onStart(RECOMMENDED, speed, false)}>Done</button>
			</div>
		{:else}
			{@render tip("circle-alert", scanError || "The scan stopped before it finished.", "error")}
			<div class="footer">
				<button onclick={onCancel}>Close</button>
				<button class="mod-cta" onclick={() => void runScan()}>Try again</button>
			</div>
		{/if}
	{:else if flow.step === "recommend" && scan && all}
		<div class="summary">
			<div class="kicker">Your Garmin history</div>
			<div class="headline">{scanRange(scan)}</div>
			<div class="sub">{plural(scan.days, "day", "days")} · {plural(scan.activities, "activity", "activities")}</div>
		</div>
		{#if kept && !isRecommended(kept)}
			{@render line("info", `You keep: ${keptLabel(kept)}.`)}
		{:else if !kept && prepared && (prepared.held.days || prepared.held.activities)}
			{@render line("info", `Already here: ${plural(prepared.held.days, "day", "days")} and ${plural(prepared.held.activities, "activity", "activities")}. Only the rest downloads.`)}
		{/if}
		{#if all.requests}
			<div class="recommend">
				<div class="recommend-title">
					<strong>Download all of it</strong>
					<span class="badge">Recommended</span>
				</div>
				<div>Every day and activity, with charts, maps and timelines.</div>
				<div class="meta">{allMeta()}</div>
			</div>
			<div class="sync-tip">
				<span class="line-icon" use:lucide={"refresh-cw"}></span>
				<span>Using Obsidian Sync? Turn on Sync all other types.</span>
			</div>
		{:else}
			{@render line("check", "Your history is already in this vault.")}
		{/if}
		<div class="footer split">
			<button onclick={() => (flow = { step: "advanced" })}>Advanced options</button>
			<button class="mod-cta" onclick={() => onStart(RECOMMENDED, speed, (all?.requests ?? 0) > 0)}>{all.requests ? "Download all history" : "Done"}</button>
		</div>
	{:else if flow.step === "advanced" && chosen}
		<h3>Advanced options</h3>
		<div class="sets">
			<div class="set">
				<div class="set-text">
					<div class="set-title">Day details</div>
					<div class="set-blurb">Each day’s timelines.</div>
					<div class="set-meta">{daysMeta()}</div>
				</div>
				<select class="dropdown" bind:value={dayDetails} aria-label="How far back Day details go">
					{#each DAY_DETAILS_RANGES as range}<option value={range.id}>{range.label}</option>{/each}
				</select>
			</div>
			<div class="set">
				<div class="set-text">
					<div class="set-title">Activity details</div>
					<div class="set-blurb">Maps, charts and laps.</div>
					<div class="set-meta">{detailsMeta()}</div>
				</div>
				<select class="dropdown" bind:value={activityDetails} aria-label="Which activities to download">
					{#each ACTIVITY_DETAILS_RANGES as range}<option value={range.id}>{range.label}</option>{/each}
				</select>
			</div>
		</div>
		<div class="speed">
			<div class="speed-text">
				<div class="set-title">Sync speed</div>
				<div class="set-meta">Normal suits most accounts. Gentle is easiest on Garmin.</div>
			</div>
			<div class="segmented" role="radiogroup" aria-label="Sync speed">
				{#each SPEEDS as id}
					<button role="radio" aria-checked={speed === id} class:selected={speed === id} onclick={() => (speed = id)}>{SPEED_LABELS[id]}</button>
				{/each}
			</div>
		</div>
		<div class="totals">
			<strong>{chosen.requests ? `≈ ${formatBytes(chosen.bytes)} · ${formatDuration(chosen.seconds)}` : "Nothing to download now"}</strong>
			<span>Charts cover all history</span>
		</div>
		<div class="footer">
			<button onclick={() => (flow = back(flow))}>Back</button>
			<button class="mod-cta" onclick={() => onStart({ dayDetails, activityDetails }, speed, (chosen?.requests ?? 0) > 0)}>{chosen.requests ? "Start download" : "Done"}</button>
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

	/* Recommendation */
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
	.recommend {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 14px 16px;
		border: 1.5px solid var(--interactive-accent);
		border-radius: var(--radius-m);
		font-size: var(--font-ui-small);
		line-height: 18px;
	}
	.recommend-title {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 8px;
		font-size: var(--font-ui-medium);
	}
	.badge {
		padding: 0 8px;
		border: 1px solid var(--interactive-accent);
		border-radius: 999px;
		color: var(--text-accent);
		font-size: 11px;
		font-weight: 600;
		line-height: 16px;
	}
	.meta {
		color: var(--text-muted);
	}
	.line,
	.sync-tip {
		display: flex;
		align-items: flex-start;
		gap: 8px;
		font-size: var(--font-ui-small);
		line-height: 18px;
	}
	.line {
		color: var(--text-normal);
	}
	.sync-tip {
		color: var(--text-muted);
		font-size: var(--font-ui-smaller);
	}
	.line-icon {
		display: inline-flex;
		flex: none;
		margin-top: 1px;
		color: var(--text-muted);
	}
	.line-icon :global(svg) {
		width: 16px;
		height: 16px;
	}

	/* Advanced options */
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

	.footer {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
		margin-top: 4px;
	}
	.footer.split {
		justify-content: space-between;
	}

	/* A phone's sheet: controls under their text, buttons full width at the end, the main one on top. */
	@container (max-width: 480px) {
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
		.footer.split {
			flex-direction: column-reverse;
			align-items: stretch;
		}
		.footer button {
			width: 100%;
		}
	}
</style>
