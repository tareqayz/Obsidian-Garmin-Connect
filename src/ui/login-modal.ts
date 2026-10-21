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
import type { GarminDomain } from "../garmin/constants";
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
				initialDomain: this.plugin.data.settings.domain,
				onDomainChange: (domain: GarminDomain) => this.plugin.setDomain(domain),
				onSubmit: async (email: string, password: string, onMfaRequired: MfaPrompt) => {
					try {
						// The form owns the code prompt and hands it over here, so the
						// whole sign-in stays one await and the SSO cookies survive it.
						await this.plugin.garmin.login(email, password, { onMfaRequired });
						// Saved once it signs in, so Settings names the account that did.
						this.plugin.data.settings.email = email;
						await this.plugin.data.saveSettings();
						new Notice("Signed in to Garmin Connect.");
						this.plugin.authChanged();
						this.onDone?.();
						this.close();
						return null;
					} catch (err) {
						return explainSignIn(err);
					}
				},
				onCancel: () => this.close(),
			},
		});
	}

	onClose(): void {
		if (this.form) {
			void unmount(this.form);
			this.form = undefined;
		}
		this.contentEl.empty();
	}
}

/** A failed sign-in, in words, for the sign-in form and the setup's. */
export function explainSignIn(err: unknown): string {
	if (err instanceof GarminMfaCancelledError) {
		return "Sign-in cancelled.";
	}
	if (err instanceof GarminMfaRequiredError) {
		// Only reachable if this modal ever stops passing a prompt down.
		return `Garmin asked for a verification code (${err.method}) this sign-in can't take.`;
	}
	if (err instanceof GarminRateLimitError) {
		return "Garmin is limiting this network. Try again in 15–30 minutes.";
	}
	if (err instanceof GarminBlockedError) {
		return "Garmin's bot check refused this sign-in. It's not your password. Try again in an hour.";
	}
	return err instanceof Error ? err.message : String(err);
}
