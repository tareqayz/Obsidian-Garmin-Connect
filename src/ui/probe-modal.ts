import { App, Modal, Notice, Setting, normalizePath } from "obsidian";
import { ObsidianHttpClient } from "../obsidian-http";
import { ProbeLog } from "../log";
import { reportPlatform, runFingerprintProbe, runGarminProbe, type Verdict } from "../probe";
import type { ProbeSettings } from "../settings";

export class ProbeModal extends Modal {
	private settings: ProbeSettings;
	private password: string;
	private logEl!: HTMLElement;
	private mfaHost!: HTMLElement;
	private buttons: HTMLButtonElement[] = [];
	private log = new ProbeLog();
	private running = false;

	constructor(app: App, settings: ProbeSettings) {
		super(app);
		this.settings = settings;
		this.password = settings.rememberPassword ? settings.password : "";
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.addClass("gcp-modal");
		contentEl.createEl("h2", { text: "Garmin Connect — phase 0 probe" });

		contentEl.createDiv({ cls: "gcp-caution" }, (el) => {
			el.createEl("strong", { text: "Before you run this. " });
			el.appendText(
				"Garmin rate-limits login attempts per IP and can lock an account after " +
					"repeated failures. Run the probe deliberately, not in a loop, and leave " +
					"15-30 minutes between attempts if you see a 429.",
			);
		});

		new Setting(contentEl)
			.setName("Email")
			.addText((t) =>
				t
					.setPlaceholder("you@example.com")
					.setValue(this.settings.email)
					.onChange((v) => (this.settings.email = v.trim())),
			);

		new Setting(contentEl)
			.setName("Password")
			.setDesc(this.settings.rememberPassword ? "Loaded from settings." : "Not stored.")
			.addText((t) => {
				t.inputEl.type = "password";
				t.setValue(this.password).onChange((v) => (this.password = v));
			});

		const actions = contentEl.createDiv({ cls: "gcp-actions" });
		this.addButton(actions, "1. Check network fingerprint", () => this.doFingerprint());
		this.addButton(actions, "2. Test Garmin login", () => this.doLogin(), true);

		this.mfaHost = contentEl.createDiv();
		this.logEl = contentEl.createEl("pre", { cls: "gcp-log" });

		const footer = contentEl.createDiv({ cls: "gcp-actions gcp-footer" });
		this.addButton(footer, "Copy log", () => this.copyLog());
		this.addButton(footer, "Save to vault", () => void this.saveLog());
		this.addButton(footer, "Close", () => this.close());

		this.log = this.newLog();
		reportPlatform(this.log);
		this.render();
	}

	onClose(): void {
		this.contentEl.empty();
	}

	/* -------------------------------------------------------------- */

	private newLog(): ProbeLog {
		return new ProbeLog(() => this.render());
	}

	private render(): void {
		this.logEl.setText(this.log.render());
		this.logEl.scrollTop = this.logEl.scrollHeight;
	}

	private addButton(
		parent: HTMLElement,
		text: string,
		onClick: () => void,
		cta = false,
	): void {
		const btn = parent.createEl("button", { text });
		if (cta) btn.addClass("mod-cta");
		btn.onclick = onClick;
		this.buttons.push(btn);
	}

	private setBusy(busy: boolean): void {
		this.running = busy;
		for (const b of this.buttons) b.disabled = busy;
	}

	/* -------------------------------------------------------------- */

	private async doFingerprint(): Promise<void> {
		if (this.running) return;
		this.setBusy(true);
		try {
			await runFingerprintProbe(new ObsidianHttpClient(), this.log);
		} catch (err) {
			this.log.fail(`probe threw: ${err instanceof Error ? err.message : String(err)}`);
		} finally {
			this.setBusy(false);
		}
	}

	private async doLogin(): Promise<void> {
		if (this.running) return;
		if (!this.settings.email || !this.password) {
			new Notice("Enter an email and password first.");
			return;
		}
		this.setBusy(true);
		let verdict: Verdict = "failed";
		try {
			verdict = await runGarminProbe(new ObsidianHttpClient(), this.log, {
				email: this.settings.email,
				password: this.password,
				domain: this.settings.domain,
				requestMfaCode: (method) => this.promptForMfa(method),
			});
		} catch (err) {
			this.log.fail(`probe threw: ${err instanceof Error ? err.message : String(err)}`);
		} finally {
			this.setBusy(false);
		}
		new Notice(`Garmin probe: ${verdict}`);
		if (this.settings.autoSaveLog) await this.saveLog(true);
	}

	/** Renders an inline code field and resolves when the user submits or cancels. */
	private promptForMfa(method: string): Promise<string | null> {
		return new Promise((resolve) => {
			this.mfaHost.empty();
			const row = this.mfaHost.createDiv({ cls: "gcp-mfa" });
			row.createEl("label", { text: `MFA code (sent via ${method})` });

			const input = row.createEl("input", { type: "text", attr: { inputmode: "numeric" } });
			const submit = row.createEl("button", { text: "Submit", cls: "mod-cta" });
			const cancel = row.createEl("button", { text: "Cancel" });

			const finish = (value: string | null) => {
				this.mfaHost.empty();
				resolve(value);
			};
			submit.onclick = () => finish(input.value.trim() || null);
			cancel.onclick = () => finish(null);
			input.onkeydown = (e) => {
				if (e.key === "Enter") finish(input.value.trim() || null);
			};
			input.focus();
		});
	}

	/* -------------------------------------------------------------- */

	private copyLog(): void {
		navigator.clipboard
			.writeText(this.log.render())
			.then(() => new Notice("Probe log copied."))
			.catch(() => new Notice("Clipboard unavailable — use “Save to vault”."));
	}

	/**
	 * Writes the log into the vault. On a phone this is the only reliable way to
	 * get the output off the device: the file syncs back to the desktop like any
	 * other note, and there is no console to read.
	 */
	private async saveLog(quiet = false): Promise<void> {
		const folder = normalizePath(this.settings.logFolder);
		const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
		const path = normalizePath(`${folder}/garmin-probe-${stamp}.md`);
		try {
			if (folder && !this.app.vault.getFolderByPath(folder)) {
				await this.app.vault.createFolder(folder);
			}
			await this.app.vault.create(path, ["```", this.log.render(), "```", ""].join("\n"));
			if (!quiet) new Notice(`Saved ${path}`);
		} catch (err) {
			new Notice(`Could not save log: ${err instanceof Error ? err.message : String(err)}`);
		}
	}
}
