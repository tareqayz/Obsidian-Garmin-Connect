<script lang="ts">
	import { TEMPLATES } from "../../../dashboard/layouts";
	import type { LayoutSeed } from "../../../dashboard/layout-edit";

	interface Props {
		mode: "new" | "rename";
		initialName: string;
		/** Name of the layout on screen, offered as a starting point. */
		currentName: string;
		compact: boolean;
		onSubmit: (name: string, seed: LayoutSeed) => void;
		onClose: () => void;
	}

	let { mode, initialName, currentName, compact, onSubmit, onClose }: Props = $props();

	// svelte-ignore state_referenced_locally
	let name = $state(initialName);
	let seed = $state<LayoutSeed>("current");

	let valid = $derived(name.trim().length > 0);

	function submit(event: Event) {
		event.preventDefault();
		if (!valid) return;
		onSubmit(name, seed);
	}

	function pickTemplate(id: string) {
		seed = { template: id };
		const template = TEMPLATES.find((t) => t.id === id);
		// Only overwrite a name the person has not already made their own.
		if (template && (!name.trim() || TEMPLATES.some((t) => t.name === name))) name = template.name;
	}

	let chosenTemplate = $derived(typeof seed === "object" ? seed.template : null);
</script>

<svelte:window onkeydown={(e) => e.key === "Escape" && onClose()} />

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="scrim" onclick={onClose}></div>

<form class="dialog" class:sheet={compact} onsubmit={submit}>
	<div class="heading">
		<div class="name">{mode === "new" ? "New layout" : "Rename layout"}</div>
		{#if mode === "new"}
			<div class="sub">
				Layouts are saved with the plugin, so they follow your vault to every device.
			</div>
		{/if}
	</div>

	<!-- svelte-ignore a11y_autofocus -->
	<input
		class="field"
		type="text"
		bind:value={name}
		placeholder="Layout name"
		aria-label="Layout name"
		autofocus
	/>

	{#if mode === "new"}
		<div class="group">
			<span class="label">START FROM</span>
			<label class="choice">
				<input type="radio" checked={seed === "current"} onchange={() => (seed = "current")} />
				<span>A copy of “{currentName}”</span>
			</label>
			<label class="choice">
				<input type="radio" checked={seed === "shipped"} onchange={() => (seed = "shipped")} />
				<span>The shipped default</span>
			</label>
			<label class="choice">
				<input type="radio" checked={seed === "empty"} onchange={() => (seed = "empty")} />
				<span>Empty</span>
			</label>
		</div>

		<div class="group">
			<span class="label">OR START FROM A TEMPLATE</span>
			<div class="templates">
				{#each TEMPLATES as template (template.id)}
					<button
						type="button"
						class="chip"
						class:on={chosenTemplate === template.id}
						onclick={() => pickTemplate(template.id)}>{template.name}</button
					>
				{/each}
			</div>
		</div>
	{/if}

	<div class="actions">
		<button type="button" class="chip" onclick={onClose}>Cancel</button>
		<button type="submit" class="chip primary" disabled={!valid}>
			{mode === "new" ? "Create layout" : "Rename"}
		</button>
	</div>
</form>

<style>
	.scrim {
		position: fixed;
		inset: 0;
		z-index: 50;
		background: rgba(10, 10, 10, 0.42);
	}
	.dialog {
		position: fixed;
		z-index: 51;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		width: min(380px, calc(100vw - 48px));
		display: flex;
		flex-direction: column;
		gap: 14px;
		padding: 16px 18px;
		border-radius: 12px;
		background: var(--v2-surface-card);
		box-shadow: 0 16px 48px rgba(0, 0, 0, 0.28);
	}
	.dialog.sheet {
		top: auto;
		left: 0;
		right: 0;
		bottom: 0;
		transform: none;
		width: auto;
		border-radius: 12px 12px 0 0;
		padding-bottom: calc(16px + env(safe-area-inset-bottom, 12px));
	}
	.name {
		font-weight: 600;
		font-size: 15px;
		color: var(--gcd-text);
	}
	.sub {
		margin-top: 2px;
		font-size: var(--font-ui-smaller, 12px);
		line-height: 1.45;
		color: var(--v2-muted);
	}
	.field {
		width: 100%;
		font-size: var(--font-ui-small, 13px);
	}
	.group {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.label {
		font-size: var(--font-ui-smaller, 12px);
		font-weight: 600;
		letter-spacing: 0.02em;
		color: var(--v2-muted);
	}
	.choice {
		display: flex;
		align-items: center;
		gap: 10px;
		font-size: var(--font-ui-small, 13px);
		color: var(--gcd-text);
		cursor: pointer;
	}
	.templates {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.chip {
		padding: 5px 12px;
		border: 1px solid var(--gcd-border);
		border-radius: 999px;
		background: transparent;
		color: var(--gcd-text);
		font-size: 12px;
		line-height: 1.25;
		height: auto;
		box-shadow: none;
		cursor: pointer;
	}
	.chip.on {
		border-color: var(--v2-accent);
		background: var(--v2-accent-tint);
		color: var(--v2-accent);
		font-weight: 500;
	}
	.chip.primary {
		border-color: var(--v2-accent);
		color: var(--v2-accent);
		font-weight: 600;
	}
	.chip:disabled {
		opacity: 0.5;
		cursor: default;
	}
	.actions {
		display: flex;
		justify-content: flex-end;
		gap: 6px;
	}
</style>
