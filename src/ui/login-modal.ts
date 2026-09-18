import { App, Modal, Notice } from "obsidian";
import { mount, unmount } from "svelte";
import type { MfaPrompt } from "../garmin/auth";
import {
	GarminBlockedError,
	GarminMfaCancelledError,
	GarminMfaRequiredError,
	GarminRateLimitError,
} from "../garmin/errors";
import type GarminPlugin from "../main";
import LoginForm from "./svelte/LoginForm.svelte";

/** Sign-in. The password lives in the component and nowhere else. */
export class LoginModal extends Modal {
	private plugin: GarminPlugin;
	private onDone?: () => void;
	private form: ReturnType<typeof LoginForm> | undefined;

	constructor(app: App, plugin: GarminPlugin, onDone?: () => void) {
		super(app);
		this.plugin = plugin;
		this.onDone = onDone;
	}

	onOpen(): void {
		this.form = mount(LoginForm, {
			target: this.contentEl,
			props: {
				initialEmail: this.plugin.data.settings.email,
				onEmailChange: (email: string) => {
					this.plugin.data.settings.email = email;
					void this.plugin.data.saveSettings();
				},
				onSubmit: async (email: string, password: string, onMfaRequired: MfaPrompt) => {
					try {
						// The form owns the code prompt and hands it over here, so the
						// whole sign-in stays one await and the SSO cookies survive it.
						await this.plugin.garmin.login(email, password, { onMfaRequired });
						new Notice("Signed in to Garmin Connect.");
						this.onDone?.();
						this.close();
						return null;
					} catch (err) {
						return explain(err);
					}
				},
				onCancel: () => this.close(),
			},
		});
	}

	onClose(): void {
		if (this.form) {
			unmount(this.form);
			this.form = undefined;
		}
		this.contentEl.empty();
	}
}

function explain(err: unknown): string {
	if (err instanceof GarminMfaCancelledError) {
		return "Sign-in cancelled at the verification code step.";
	}
	if (err instanceof GarminMfaRequiredError) {
		// Only reachable if this modal ever stops passing a prompt down.
		return `Garmin asked for a verification code (${err.method}) and nothing offered one.`;
	}
	if (err instanceof GarminRateLimitError) {
		return "Garmin is rate limiting this network. Wait 15–30 minutes before trying again.";
	}
	if (err instanceof GarminBlockedError) {
		return "Garmin's edge refused the request — a bot challenge, not your password. Run the probe's fingerprint check.";
	}
	return err instanceof Error ? err.message : String(err);
}
