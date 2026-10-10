<script lang="ts">
	import { effortColor, type Effort, type PrimaryBenefit } from "../../../../dashboard/activity-labels";
	import { lucide } from "../../home/lucide";

	/**
	 * Evaluation: the Primary Benefit, with the "?" that opens This Activity's
	 * Benefit, then Feel and Perceived Effort. Read-only: the phone opens the
	 * Self Evaluation sheet from here, the plugin only shows what was saved.
	 */
	interface Props {
		benefit: PrimaryBenefit | null;
		feel: string | null;
		effort: Effort | null;
		onBenefit: () => void;
	}

	let { benefit, feel, effort, onBenefit }: Props = $props();

	/** The Self Evaluation sheet's five faces; Normal is the one seen (the rest Inferred). */
	const FACES: Record<string, string> = {
		"Very Weak": "frown",
		Weak: "annoyed",
		Normal: "meh",
		Strong: "smile",
		"Very Strong": "laugh",
	};
</script>

<h3 class="gc-ov-heading">Evaluation</h3>
{#if benefit}
	<div class="box">
		<div class="row">
			<div class="text">
				<div class="title">
					<span>{benefit.label}</span>
					<button class="help" aria-label="About the primary benefit" onclick={onBenefit}><span use:lucide={"circle-help"}></span></button>
				</div>
				<div class="sub">Primary Benefit</div>
			</div>
		</div>
	</div>
{/if}
{#if feel || effort}
	<div class="box">
		{#if feel}
			<div class="row">
				<div class="text">
					<div class="title">{feel}</div>
					<div class="sub">Feel</div>
				</div>
				<span class="face" use:lucide={FACES[feel] ?? "meh"}></span>
			</div>
		{/if}
		{#if effort}
			<div class="row">
				<div class="text">
					<div class="title">{effort.label}</div>
					<div class="sub">Perceived Effort</div>
				</div>
				<span class="score">{effort.score}</span>
				<span class="dot" style:background={effortColor(effort.value)}></span>
			</div>
		{/if}
	</div>
{/if}

<style>
	.box {
		margin-top: 8.8px;
		border-radius: 8px;
		background: var(--background-secondary);
	}
	.box + .box {
		margin-top: 16px;
	}
	.row {
		display: flex;
		align-items: center;
		gap: 7px;
		box-sizing: border-box;
		min-height: 74px;
		padding: 15.4px 16px 16.6px 16px;
	}
	.text {
		flex: 1;
		min-width: 0;
	}
	.title {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 16px;
		line-height: 21px;
		font-weight: 600;
	}
	.sub {
		margin-top: 5px;
		font-size: 13px;
		line-height: 16px;
		color: var(--text-muted);
	}
	.help {
		display: inline-flex;
		flex: none;
		width: auto;
		height: auto;
		margin: 0;
		padding: 0;
		border: none;
		border-radius: 50%;
		box-shadow: none;
		background: none;
		color: var(--text-muted);
		cursor: pointer;
	}
	.help:hover {
		color: var(--text-normal);
	}
	.help :global(svg) {
		width: 15px;
		height: 15px;
	}
	.face {
		display: inline-flex;
		color: var(--text-muted);
	}
	.face :global(svg) {
		width: 22px;
		height: 22px;
	}
	.score {
		font-size: 18px;
		line-height: 22px;
		font-variant-numeric: tabular-nums;
	}
	.dot {
		flex: none;
		width: 24px;
		height: 24px;
		border-radius: 50%;
	}
</style>
