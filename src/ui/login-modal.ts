import { App, Modal, Notice, Setting } from "obsidian";
import {
	GarminBlockedError,
	GarminMfaRequiredError,
	GarminRateLimitError,
} from "../garmin/errors";
import type GarminPlugin from "../main";

/** Sign-in. The password lives in this modal and nowhere else. */
export class LoginModal extends Modal {
	private plugin: GarminPlugin;
	private onDone?: () => void;
	private password = "";
	private statusEl!: HTMLElement;
	private submitEl!: HTMLButtonElement;

	constructor(app: App, plugin: GarminPlugin, onDone?: () => void) {
		super(app);
		this.plugin = plugin;
		this.onDone = onDone;
	}

	onOpen(): void {
		const { contentEl } = this;
		const settings = this.plugin.data.settings;
		contentEl.addClass("gcp-modal");
		contentEl.createEl("h2", { text: "Sign in to Garmin Connect" });

		new Setting(contentEl).setName("Email").addText((t) =>
			t
				.setPlaceholder("you@example.com")
				.setValue(settings.email)
				.onChange(async (v) => {
					settings.email = v.trim();
					await this.plugin.data.saveSettings();
				}),
		);

		new Setting(contentEl)
			.setName("Password")
			.setDesc("Used for this sign-in only. Only a refresh token is saved.")
			.addText((t) => {
				t.inputEl.type = "password";
				t.onChange((v) => (this.password = v));
				t.inputEl.onkeydown = (e) => {
					if (e.key === "Enter") void this.submit();
				};
			});

		this.statusEl = contentEl.createDiv({ cls: "gcp-status" });

		const actions = contentEl.createDiv({ cls: "gcp-actions" });
		this.submitEl = actions.createEl("button", { text: "Sign in", cls: "mod-cta" });
		this.submitEl.onclick = () => void this.submit();
		actions.createEl("button", { text: "Cancel" }).onclick = () => this.close();
	}

	onClose(): void {
		this.password = "";
		this.contentEl.empty();
	}

	private async submit(): Promise<void> {
		const email = this.plugin.data.settings.email;
		if (!email || !this.password) {
			this.statusEl.setText("Enter an email and password.");
			return;
		}

		this.submitEl.disabled = true;
		this.statusEl.setText("Signing in…");
		try {
			await this.plugin.garmin.login(email, this.password);
			new Notice("Signed in to Garmin Connect.");
			this.onDone?.();
			this.close();
		} catch (err) {
			this.statusEl.setText(explain(err));
		} finally {
			this.submitEl.disabled = false;
		}
	}
}

function explain(err: unknown): string {
	if (err instanceof GarminMfaRequiredError) {
		return (
			"This account uses multi-factor authentication, which is not supported yet. " +
			"See TODO.md."
		);
	}
	if (err instanceof GarminRateLimitError) {
		return "Garmin is rate limiting this network. Wait 15–30 minutes before trying again.";
	}
	if (err instanceof GarminBlockedError) {
		return "Garmin's edge refused the request — a bot challenge, not your password. Run the probe's fingerprint check.";
	}
	return err instanceof Error ? err.message : String(err);
}
