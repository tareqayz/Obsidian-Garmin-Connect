<script lang="ts">
	import type { SetupCardKind } from "../../setup-flow";
	import { lucide } from "./lucide";

	/** Plugin-only: what stands between this vault and its data, above everything else on Home. */
	interface Props {
		kind: SetupCardKind;
		onSetUp: () => void;
		onSignIn: () => void;
		/** "Not now" on the this-device card: put it away on this device. */
		onHide: () => void;
	}

	let { kind, onSetUp, onSignIn, onHide }: Props = $props();

	const COPY: Record<SetupCardKind, { icon: string; title: string; body: string; action: string }> = {
		finish: { icon: "history", title: "Finish setting up", body: "Choose how much of your history to keep in this vault.", action: "Set up" },
		"signed-out": { icon: "lock", title: "Sign in to Garmin Connect", body: "Sign in to sync your health data and activities.", action: "Sign in" },
		"this-device": {
			icon: "monitor-smartphone",
			title: "Not signed in on this device",
			body: "Your Garmin data reaches this device through your vault sync. Sign in here as well to sync from this device too.",
			action: "Sign in",
		},
		"no-data": {
			icon: "folder-x",
			title: "No Garmin data on this device",
			body: "Your settings are here, but the data folder is empty. If you use Obsidian Sync, turn on Sync all other types — or download your history on this device.",
			action: "Set up",
		},
	};

	let copy = $derived(COPY[kind]);
</script>

<div class="setup-card" role="region" aria-label={copy.title}>
	<span class="icon" use:lucide={copy.icon}></span>
	<div class="text">
		<strong>{copy.title}</strong>
		<span>{copy.body}</span>
		<div class="actions">
			<button class="mod-cta" onclick={kind === "signed-out" || kind === "this-device" ? onSignIn : onSetUp}>{copy.action}</button>
			{#if kind === "this-device"}
				<button onclick={onHide}>Not now</button>
			{/if}
		</div>
	</div>
</div>

<style>
	.setup-card {
		display: flex;
		align-items: flex-start;
		gap: 12px;
		padding: 16px;
		border-radius: 8px;
		background: var(--background-secondary);
	}
	.icon {
		display: inline-flex;
		flex: none;
		margin-top: 1px;
		color: var(--text-muted);
	}
	.icon :global(svg) {
		width: 18px;
		height: 18px;
	}
	.text {
		display: flex;
		flex-direction: column;
		gap: 6px;
		min-width: 0;
	}
	strong {
		font-size: 15px;
		line-height: 20px;
		font-weight: 600;
	}
	span {
		font-size: 13px;
		line-height: 17px;
		color: var(--text-muted);
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-top: 6px;
	}
</style>
