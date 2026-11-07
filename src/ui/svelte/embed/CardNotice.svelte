<script lang="ts">
	import type { CardNotice } from "../../../embeds/status";
	import type { NoticeAction } from "../../../embeds/view";
	import { lucide } from "../home/lucide";

	/** One line in place of a block's cards: why there are none, and what to do about it. */
	interface Props {
		notice: CardNotice;
		act: (kind: NoticeAction) => void;
	}

	let { notice, act }: Props = $props();

	/** In Live Preview a press would also put the cursor into the block's source. */
	const keep = (e: Event) => e.stopPropagation();
</script>

<div class="gce-notice" class:muted={notice.tone === "muted"} class:error={notice.tone === "error"}>
	<span class="icon" use:lucide={notice.icon}></span>
	<div class="text">
		<div class="line">{notice.text}</div>
		{#if notice.hint}<div class="hint">{notice.hint}</div>{/if}
	</div>
	{#if notice.action}
		{@const action = notice.action}
		<button
			class:mod-cta={action.primary}
			onmousedown={keep}
			onpointerdown={keep}
			onclick={(e) => {
				e.stopPropagation();
				act(action.kind);
			}}>{action.label}</button
		>
	{/if}
</div>

<style>
	/* Not ".notice" or ".message": Obsidian styles those globally. */
	.gce-notice {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px 16px;
		border-radius: var(--radius-m, 8px);
		background: var(--background-secondary);
		color: var(--text-normal);
	}
	.icon {
		display: inline-flex;
		flex: none;
		color: var(--text-muted);
	}
	.icon :global(svg) {
		width: 20px;
		height: 20px;
	}
	.text {
		flex: 1;
		min-width: 0;
	}
	.line {
		font-size: 15px;
		line-height: 20px;
	}
	.hint {
		margin-top: 2px;
		font-size: 12px;
		line-height: 16px;
		color: var(--text-muted);
	}
	.muted .line {
		color: var(--text-muted);
	}
	.muted .icon {
		color: var(--text-faint);
	}
	.error .line,
	.error .icon {
		color: var(--text-error);
	}
	button {
		flex: none;
	}
</style>
