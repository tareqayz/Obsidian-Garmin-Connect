<script lang="ts">
	import { onDestroy } from "svelte";
	import {
		MFA_MAX_ATTEMPTS,
		mfaCodeSource,
		type MfaChallenge,
		type MfaPrompt,
	} from "../../garmin/auth";
	import { ProbeLog } from "../../log";
	import type { Verdict } from "../../probe";

	interface Props {
		initialEmail: string;
		onEmailChange: (email: string) => void;
		/** Each runner is handed the log and the MFA prompt it may need. */
		runFingerprint: (log: ProbeLog) => Promise<void>;
		runLogin: (
			log: ProbeLog,
			email: string,
			password: string,
			requestMfaCode: MfaPrompt,
		) => Promise<Verdict>;
		runPersistence: (
			log: ProbeLog,
			email: string,
			password: string,
			requestMfaCode: MfaPrompt,
		) => Promise<Verdict>;
		runFitness: (log: ProbeLog) => Promise<Verdict>;
		onSaveLog: (text: string, quiet: boolean) => Promise<void>;
		onCopyLog: (text: string) => void;
		onFinished: (verdict: Verdict) => void;
		autoSaveLog: boolean;
		platformReport: (log: ProbeLog) => void;
		onClose: () => void;
	}

	let {
		initialEmail,
		onEmailChange,
		runFingerprint,
		runLogin,
		runPersistence,
		runFitness,
		onSaveLog,
		onCopyLog,
		onFinished,
		autoSaveLog,
		platformReport,
		onClose,
	}: Props = $props();

	// svelte-ignore state_referenced_locally
	let email = $state(initialEmail);
	let password = $state("");
	let text = $state("");
	let busy = $state(false);

	// The MFA prompt is a conditional block plus a parked resolver, rather than
	// DOM built and torn down inside a promise.
	let challenge = $state<MfaChallenge | null>(null);
	let mfaCode = $state("");
	let resolveMfa: ((code: string | null) => void) | null = null;

	const log = new ProbeLog(() => (text = log.render()));
	// Runs once, at construction: the platform does not change mid-modal.
	// svelte-ignore state_referenced_locally
	platformReport(log);

	function requestMfaCode(next: MfaChallenge): Promise<string | null> {
		challenge = next;
		mfaCode = "";
		return new Promise((resolve) => (resolveMfa = resolve));
	}

	function answerMfa(code: string | null) {
		challenge = null;
		resolveMfa?.(code);
		resolveMfa = null;
	}

	onDestroy(() => {
		// Closing the modal mid-prompt must settle the parked promise, or the probe
		// it belongs to never finishes.
		resolveMfa?.(null);
		resolveMfa = null;
	});

	async function run(task: () => Promise<Verdict | void>) {
		if (busy) return;
		busy = true;
		try {
			const verdict = await task();
			if (verdict) {
				onFinished(verdict);
				if (autoSaveLog) await onSaveLog(log.render(), true);
			}
		} catch (err) {
			log.fail(`probe threw: ${err instanceof Error ? err.message : String(err)}`);
		} finally {
			busy = false;
		}
	}

	let credentialsReady = $derived(email.trim().length > 0 && password.length > 0);
</script>

<h2>Garmin Connect — diagnostics</h2>

<div class="caution">
	<strong>Before you run this.</strong> Garmin rate-limits login attempts per IP and can lock an
	account after repeated failures. Run these deliberately, not in a loop, and leave 15-30 minutes
	between attempts if you see a 429.
</div>

<div class="field">
	<label for="gcp-email">Email</label>
	<input
		id="gcp-email"
		type="email"
		bind:value={email}
		oninput={() => onEmailChange(email.trim())}
	/>
</div>
<div class="field">
	<label for="gcp-password">Password</label>
	<input id="gcp-password" type="password" bind:value={password} />
	<div class="hint">Used for this sign-in only. Never written to disk.</div>
</div>

<div class="actions">
	<button disabled={busy} onclick={() => run(() => runFingerprint(log))}>
		1. Network fingerprint
	</button>
	<button
		disabled={busy || !credentialsReady}
		onclick={() => run(() => runLogin(log, email.trim(), password, requestMfaCode))}
	>
		2. Test login
	</button>
	<button
		class="mod-cta"
		disabled={busy}
		onclick={() => run(() => runPersistence(log, email.trim(), password, requestMfaCode))}
	>
		3. Test session persistence
	</button>
	<button disabled={busy} onclick={() => run(() => runFitness(log))}>
		4. Inspect fitness endpoints
	</button>
</div>

{#if challenge}
	<div class="mfa">
		<label for="gcp-mfa">
			MFA code {challenge.attempt} of {MFA_MAX_ATTEMPTS} — from {mfaCodeSource(
				challenge.method,
			)}
		</label>
		<input
			id="gcp-mfa"
			type="text"
			inputmode="numeric"
			autocomplete="one-time-code"
			bind:value={mfaCode}
			onkeydown={(e) => e.key === "Enter" && answerMfa(mfaCode.trim() || null)}
		/>
		<button class="mod-cta" onclick={() => answerMfa(mfaCode.trim() || null)}>Submit</button>
		<button onclick={() => answerMfa(null)}>Cancel</button>
		{#if challenge.error}
			<div class="mfa-error" role="alert">{challenge.error}</div>
		{/if}
	</div>
{/if}

<pre class="log">{text}</pre>

<div class="actions">
	<button onclick={() => onCopyLog(log.render())}>Copy log</button>
	<button onclick={() => onSaveLog(log.render(), false)}>Save to vault</button>
	<button onclick={onClose}>Close</button>
</div>

<style>
	h2 {
		margin-top: 0;
	}
	.caution {
		border-left: 3px solid var(--text-warning);
		background: var(--background-secondary);
		padding: 0.6em 0.8em;
		margin-bottom: 1em;
		font-size: var(--font-ui-small, 13px);
		line-height: 1.45;
	}
	.field {
		margin-bottom: 10px;
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
	.actions {
		display: flex;
		gap: 0.5em;
		flex-wrap: wrap;
		margin: 0.75em 0;
	}
	.mfa {
		display: flex;
		gap: 0.5em;
		align-items: center;
		flex-wrap: wrap;
		background: var(--background-secondary);
		padding: 0.6em 0.8em;
		border-radius: var(--radius-s, 4px);
		margin-bottom: 0.5em;
	}
	.mfa input {
		flex: 1 1 8rem;
		min-width: 6rem;
	}
	.mfa-error {
		flex: 1 0 100%;
		color: var(--text-error);
		font-size: var(--font-ui-smaller, 12px);
	}
	.log {
		background: var(--background-primary-alt);
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-s, 4px);
		padding: 0.75em;
		max-height: 22rem;
		overflow: auto;
		font-family: var(--font-monospace);
		font-size: 0.78em;
		line-height: 1.5;
		white-space: pre;
	}
</style>
