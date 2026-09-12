<script lang="ts">
	interface Props {
		initialEmail: string;
		/** Resolves to an error message, or null when the sign-in succeeded. */
		onSubmit: (email: string, password: string) => Promise<string | null>;
		onEmailChange: (email: string) => void;
		onCancel: () => void;
	}

	let { initialEmail, onSubmit, onEmailChange, onCancel }: Props = $props();

	// svelte-ignore state_referenced_locally
	let email = $state(initialEmail);
	// Never leaves this component except as an argument to onSubmit.
	let password = $state("");
	let status = $state("");
	let busy = $state(false);

	let ready = $derived(email.trim().length > 0 && password.length > 0);

	async function submit() {
		if (!ready || busy) return;
		busy = true;
		status = "Signing in…";
		try {
			status = (await onSubmit(email.trim(), password)) ?? "";
		} finally {
			busy = false;
			password = "";
		}
	}
</script>

<h2>Sign in to Garmin Connect</h2>

<div class="field">
	<label for="gc-email">Email</label>
	<input
		id="gc-email"
		type="email"
		autocomplete="username"
		placeholder="you@example.com"
		bind:value={email}
		oninput={() => onEmailChange(email.trim())}
	/>
</div>

<div class="field">
	<label for="gc-password">Password</label>
	<input
		id="gc-password"
		type="password"
		autocomplete="current-password"
		bind:value={password}
		onkeydown={(e) => e.key === "Enter" && submit()}
	/>
	<div class="hint">Used for this sign-in only. Only a refresh token is saved.</div>
</div>

<div class="status" role="status">{status}</div>

<div class="actions">
	<button class="mod-cta" disabled={!ready || busy} onclick={submit}>
		{busy ? "Signing in…" : "Sign in"}
	</button>
	<button onclick={onCancel}>Cancel</button>
</div>

<style>
	h2 {
		margin-top: 0;
	}
	.field {
		margin-bottom: 12px;
	}
	label {
		display: block;
		margin-bottom: 4px;
		font-size: var(--font-ui-small, 13px);
	}
	input {
		width: 100%;
	}
	.hint {
		color: var(--text-muted);
		font-size: var(--font-ui-smaller, 12px);
		margin-top: 4px;
	}
	.status {
		min-height: 1.4em;
		color: var(--text-muted);
		font-size: var(--font-ui-small, 13px);
		margin: 8px 0;
	}
	.actions {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
	}
</style>
