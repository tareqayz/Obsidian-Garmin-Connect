<script lang="ts">
	import { onDestroy } from "svelte";
	import {
		MFA_MAX_ATTEMPTS,
		mfaCodeSource,
		type MfaChallenge,
		type MfaPrompt,
	} from "../../garmin/auth";

	interface Props {
		initialEmail: string;
		/**
		 * Resolves to an error message, or null when the sign-in succeeded.
		 *
		 * `requestMfaCode` is handed *out* rather than the caller reaching in: the
		 * sign-in is one awaited call, and the code prompt has to happen partway
		 * through it, so the caller passes this straight to `login()`.
		 */
		onSubmit: (
			email: string,
			password: string,
			requestMfaCode: MfaPrompt,
		) => Promise<string | null>;
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

	// The code prompt is a conditional block plus a parked resolver, rather than
	// DOM built and torn down inside a promise.
	let challenge = $state<MfaChallenge | null>(null);
	let code = $state("");
	/** The code is with Garmin and we are waiting on the answer. */
	let verifying = $state(false);
	let codeInput: HTMLInputElement | null = $state(null);
	let resolveCode: ((code: string | null) => void) | null = null;

	let ready = $derived(email.trim().length > 0 && password.length > 0);

	function requestMfaCode(next: MfaChallenge): Promise<string | null> {
		challenge = next;
		code = "";
		verifying = false;
		status = "";
		return new Promise((resolve) => (resolveCode = resolve));
	}

	function answer(value: string | null) {
		if (!resolveCode) return;
		const resolve = resolveCode;
		resolveCode = null;
		// Stay on this step while Garmin checks the code: flipping back to the
		// password fields mid-check reads as though the code was thrown away.
		// Whatever the answer is, submit()'s finally clears the step afterwards.
		verifying = value !== null;
		if (verifying) status = "Checking the code…";
		resolve(value);
	}

	$effect(() => {
		// Focus on each fresh ask, not just the first: disabling the field during a
		// check blurs it, so a refused code would otherwise leave nowhere to type.
		if (challenge && !verifying) codeInput?.focus();
	});

	onDestroy(() => {
		// The modal can be closed while Garmin is waiting for a code. Settling the
		// parked promise turns that into a clean cancel instead of a sign-in that
		// never finishes.
		resolveCode?.(null);
		resolveCode = null;
	});

	async function submit() {
		if (!ready || busy) return;
		busy = true;
		status = "Signing in…";
		try {
			status = (await onSubmit(email.trim(), password, requestMfaCode)) ?? "";
		} finally {
			busy = false;
			// The password is spent at the login POST; the MFA leg runs on cookies.
			password = "";
			// One code prompt belongs to one sign-in attempt. However this ended,
			// the next try starts from the credentials again.
			challenge = null;
			verifying = false;
		}
	}
</script>

<h2>Sign in to Garmin Connect</h2>

{#if challenge}
	<div class="field">
		<label for="gc-mfa">Verification code</label>
		<input
			id="gc-mfa"
			type="text"
			inputmode="numeric"
			autocomplete="one-time-code"
			disabled={verifying}
			bind:value={code}
			bind:this={codeInput}
			onkeydown={(e) => e.key === "Enter" && code.trim() && answer(code.trim())}
		/>
		<div class="hint">
			This account has multi-factor authentication switched on. Enter the code from
			{mfaCodeSource(challenge.method)}.
		</div>
	</div>

	{#if challenge.error}
		<div class="error" role="alert">
			{challenge.error} Attempt {challenge.attempt} of {MFA_MAX_ATTEMPTS}.
		</div>
	{/if}

	<div class="status" role="status">{status}</div>

	<div class="actions">
		<button
			class="mod-cta"
			disabled={verifying || !code.trim()}
			onclick={() => answer(code.trim())}
		>
			{verifying ? "Checking…" : "Verify"}
		</button>
		<button disabled={verifying} onclick={() => answer(null)}>Cancel</button>
	</div>
{:else}
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
{/if}

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
	.error {
		color: var(--text-error);
		font-size: var(--font-ui-small, 13px);
		margin: 8px 0;
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
