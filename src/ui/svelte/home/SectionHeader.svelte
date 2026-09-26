<script lang="ts">
	interface Props {
		title: string;
		action?: string;
		onAction?: () => void;
	}

	let { title, action, onAction }: Props = $props();
</script>

<div class="section-header">
	<h2>{title}</h2>
	{#if action}<button class="link clickable-icon" onclick={onAction}>{action}</button>{/if}
</div>

<style>
	.section-header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 12px;
		margin: 0 0 18px;
	}
	h2 {
		margin: 0;
		font-size: 22px;
		line-height: 28px;
		font-weight: 700;
	}
	.link {
		color: var(--text-accent);
		font-size: 15px;
		background: none;
		box-shadow: none;
		padding: 0;
		height: auto;
		width: auto;
	}
</style>
