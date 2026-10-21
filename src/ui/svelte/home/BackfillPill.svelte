<script lang="ts">
	import type { BackfillProgress } from "../../../sync/runner";
	import { lucide } from "./lucide";

	/**
	 * Plugin-only: the history download, under Home's title. Running, paused
	 * (by you, or after a 429), on another device, waiting for a sign-in, and a
	 * moment of "up to date" once done.
	 */
	interface Props {
		progress: BackfillProgress | null;
		onPause: () => void;
		onResume: () => void;
		onSignIn: () => void;
	}

	let { progress, onPause, onResume, onSignIn }: Props = $props();

	const month = new Intl.DateTimeFormat(undefined, { month: "short", year: "numeric" });
	const time = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });

	/** Shown once the download ends, then gone. */
	let done = $state(false);
	let last: BackfillProgress | null = null;
	$effect(() => {
		const now = progress;
		const finished = !now && last?.status === "running";
		last = now;
		if (now) done = false;
		if (!finished) return undefined;
		done = true;
		const timer = window.setTimeout(() => (done = false), 4000);
		return () => window.clearTimeout(timer);
	});

	let percent = $derived(progress && progress.done + progress.remaining > 0 ? Math.min(99, Math.round((progress.done / (progress.done + progress.remaining)) * 100)) : 0);
	let reached = $derived(progress?.reached ? month.format(new Date(`${progress.reached}T12:00:00`)) : "");
	let until = $derived(progress?.until ? time.format(new Date(progress.until)) : "");
</script>

{#if progress?.status === "running"}
	<div class="pill" role="status">
		<svg class="ring" viewBox="0 0 16 16" aria-hidden="true">
			<circle cx="8" cy="8" r="6" />
			<circle class="arc" cx="8" cy="8" r="6" style:stroke-dasharray="{(percent / 100) * 37.7} 37.7" />
		</svg>
		<span>Downloading history{percent ? ` · ${percent}%` : ""}{reached ? ` · ${reached}` : ""}</span>
		<button class="clickable-icon" aria-label="Pause the download" onclick={onPause}><span use:lucide={"pause"}></span></button>
	</div>
{:else if progress?.status === "paused" && progress.reason === "sign-in"}
	<button class="pill warn" onclick={onSignIn}><span class="icon" use:lucide={"circle-alert"}></span>Sign in to keep downloading</button>
{:else if progress?.status === "paused" && progress.reason === "update"}
	<div class="pill warn plain" role="status"><span class="icon" use:lucide={"circle-alert"}></span>Update the plugin to keep downloading</div>
{:else if progress?.status === "paused" && progress.reason === "user"}
	<div class="pill" role="status">
		<span class="icon" use:lucide={"pause"}></span>
		<span>Download paused</span>
		<button class="link" onclick={onResume}>Resume</button>
	</div>
{:else if progress?.status === "paused"}
	<div class="pill plain" role="status">
		<span class="icon" use:lucide={"clock"}></span>
		<span>{progress.reason === "rate-limit" ? "Garmin asked for a pause" : progress.reason === "blocked" ? "Refused by Garmin's bot check" : "Download paused"}{until ? ` · resumes ${until}` : ""}</span>
	</div>
{:else if progress?.status === "elsewhere"}
	<div class="pill plain" role="status">
		<span class="icon" use:lucide={"monitor-smartphone"}></span>
		<span>Downloading history on {progress.device ?? "another device"}</span>
	</div>
{:else if done}
	<div class="pill done" role="status"><span class="icon" use:lucide={"check"}></span>History up to date</div>
{/if}

<style>
	.pill {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		max-width: 100%;
		height: 32px;
		padding: 0 6px 0 12px;
		border: 1px solid var(--background-modifier-border);
		border-radius: 999px;
		background: var(--background-primary);
		color: var(--text-muted);
		font-size: 13px;
		line-height: 16px;
		white-space: nowrap;
	}
	.pill > span:not(.icon) {
		overflow: hidden;
		text-overflow: ellipsis;
	}
	button.pill {
		cursor: pointer;
		box-shadow: none;
		padding-right: 12px;
	}
	.pill.warn {
		color: var(--text-warning);
	}
	/* Ending in text rather than an icon button: even padding, as Figma draws the set. */
	.pill.plain {
		padding-right: 12px;
	}
	.pill.done {
		padding-right: 12px;
		animation: gch-pill-fade 4s ease-in forwards;
	}
	@keyframes gch-pill-fade {
		75% {
			opacity: 1;
		}
		to {
			opacity: 0;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.pill.done {
			animation: none;
		}
	}
	.icon {
		display: inline-flex;
		flex: none;
	}
	.icon :global(svg),
	.clickable-icon :global(svg) {
		width: 14px;
		height: 14px;
	}
	.pill.done .icon {
		color: var(--text-success);
	}
	.ring {
		flex: none;
		width: 16px;
		height: 16px;
		transform: rotate(-90deg);
	}
	.ring circle {
		fill: none;
		stroke: var(--background-modifier-border);
		stroke-width: 2.5;
	}
	.ring .arc {
		stroke: var(--interactive-accent);
		stroke-linecap: round;
	}
	.clickable-icon {
		flex: none;
		width: 24px;
		height: 24px;
		padding: 0;
		border-radius: 50%;
		background: var(--background-secondary);
	}
	.link {
		height: auto;
		padding: 0 6px 0 0;
		border: none;
		background: none;
		box-shadow: none;
		color: var(--interactive-accent);
		font-size: 13px;
		font-weight: 600;
		cursor: pointer;
	}
</style>
