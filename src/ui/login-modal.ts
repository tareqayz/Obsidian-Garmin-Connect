import { App, Modal, Notice } from "obsidian";
import { mount, unmount } from "svelte";
import {
	GarminBlockedError,
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
				onSubmit: async (email: string, password: string) => {
					try {
						await this.plugin.garmin.login(email, password);
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
	if (err instanceof GarminMfaRequiredError) {
		return "This account uses multi-factor authentication, which is not supported yet. See TODO.md.";
	}
	if (err instanceof GarminRateLimitError) {
		return "Garmin is rate limiting this network. Wait 15–30 minutes before trying again.";
	}
	if (err instanceof GarminBlockedError) {
		return "Garmin's edge refused the request — a bot challenge, not your password. Run the probe's fingerprint check.";
	}
	return err instanceof Error ? err.message : String(err);
}
