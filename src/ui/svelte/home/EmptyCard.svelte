<script lang="ts">
	import HomeCard from "./HomeCard.svelte";
	import { lucide } from "./lucide";

	/** Garmin's centred empty state: grey circle icon, title, line, buttons. */
	interface Props {
		icon: string;
		title: string;
		body: string;
		actions: Array<{ label: string; primary?: boolean; href: string }>;
	}

	let { icon, title, body, actions }: Props = $props();
</script>

<HomeCard>
	<div class="empty">
		<span class="circle" use:lucide={icon}></span>
		<div class="title">{title}</div>
		<div class="body">{body}</div>
		{#each actions as a}
			<a class="button" class:mod-cta={a.primary} href={a.href}>{a.label}</a>
		{/each}
	</div>
</HomeCard>

<style>
	.empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: 12px;
	}
	.circle {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 48px;
		height: 48px;
		border-radius: 50%;
		background: var(--background-modifier-border);
		color: var(--text-normal);
	}
	.title {
		font-size: 15px;
		line-height: 20px;
		font-weight: 600;
		margin-top: 4px;
	}
	.body {
		color: var(--text-muted);
		font-size: 14px;
		line-height: 18px;
	}
	.button {
		display: inline-block;
		padding: 7px 20px;
		border-radius: var(--radius-s, 4px);
		background: var(--interactive-normal);
		border: 1px solid var(--background-modifier-border);
		color: var(--text-normal);
		font-size: 14px;
		line-height: 18px;
		text-decoration: none;
	}
	.button.mod-cta {
		background: var(--interactive-accent);
		border-color: var(--interactive-accent);
		color: var(--text-on-accent);
	}
</style>
