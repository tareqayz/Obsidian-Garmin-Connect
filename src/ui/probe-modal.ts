import { App, Modal, Notice, Setting, normalizePath } from "obsidian";
import { ObsidianHttpClient } from "../obsidian-http";
import { ProbeLog } from "../log";
import {
	reportPlatform,
	runFingerprintProbe,
	runGarminProbe,
	runPersistenceProbe,
	type Verdict,
} from "../probe";
import type GarminPlugin from "../main";

export class ProbeModal extends Modal {
	private plugin: GarminPlugin;
	/** Held for this modal only, never written anywhere. */
	private password = "";
	private logEl!: HTMLElement;
	private mfaHost!: HTMLElement;
	private buttons: HTMLButtonElement[] = [];
	private log = new ProbeLog();
	private running = false;

	constructor(app: App, plugin: GarminPlugin) {
		super(app);
		this.plugin = plugin;
	}

	onOpen(): void {
		const { contentEl } = this;
		const settings = this.plugin.data.settings;
		contentEl.addClass("gcp-modal");
		contentEl.createEl("h2", { text: "Garmin Connect — diagnostics" });

		contentEl.createDiv({ cls: "gcp-caution" }, (el) => {
			el.createEl("strong", { text: "Before you run this. " });
			el.appendText(
				"Garmin rate-limits login attempts per IP and can lock an account after " +
					"repeated failures. Run these deliberately, not in a loop, and leave " +
					"15-30 minutes between attempts if you see a 429.",
			);
		});

		new Setting(contentEl)
			.setName("Email")
			.addText((t) =>
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
			.setDesc("Used for this sign-in only. Never written to disk.")
			.addText((t) => {
				t.inputEl.type = "password";
				t.onChange((v) => (this.password = v));
			});

		const actions = contentEl.createDiv({ cls: "gcp-actions" });
		this.addButton(actions, "1. Network fingerprint", () => this.run(() => this.fingerprint()));
		this.addButton(actions, "2. Test login", () => this.run(() => this.login()));
		this.addButton(actions, "3. Test session persistence", () => this.run(() => this.persist()), true);

		this.mfaHost = contentEl.createDiv();
		this.logEl = contentEl.createEl("pre", { cls: "gcp-log" });

		const footer = contentEl.createDiv({ cls: "gcp-actions gcp-footer" });
		this.addButton(footer, "Copy log", () => this.copyLog());
		this.addButton(footer, "Save to vault", () => void this.saveLog());
		this.addButton(footer, "Close", () => this.close());

		this.log = new ProbeLog(() => this.render());
		reportPlatform(this.log);
		this.render();
	}

	onClose(): void {
		this.password = "";
		this.contentEl.empty();
	}

	/* -------------------------------------------------------------- */

	private render(): void {
		this.logEl.setText(this.log.render());
		this.logEl.scrollTop = this.logEl.scrollHeight;
	}

	private addButton(parent: HTMLElement, text: string, onClick: () => void, cta = false): void {
		const btn = parent.createEl("button", { text });
		if (cta) btn.addClass("mod-cta");
		btn.onclick = onClick;
		this.buttons.push(btn);
	}

	private async run(task: () => Promise<Verdict | void>): Promise<void> {
		if (this.running) return;
		this.running = true;
		for (const b of this.buttons) b.disabled = true;
		let verdict: Verdict | void;
		try {
			verdict = await task();
		} catch (err) {
			this.log.fail(`probe threw: ${err instanceof Error ? err.message : String(err)}`);
			verdict = "failed";
		} finally {
			this.running = false;
			for (const b of this.buttons) b.disabled = false;
		}
		if (verdict) {
			new Notice(`Garmin probe: ${verdict}`);
			if (this.plugin.data.settings.autoSaveLog) await this.saveLog(true);
		}
	}

	private fingerprint(): Promise<void> {
		return runFingerprintProbe(new ObsidianHttpClient(), this.log);
	}

	private async login(): Promise<Verdict> {
		const settings = this.plugin.data.settings;
		if (!settings.email || !this.password) {
			new Notice("Enter an email and password first.");
			return "cancelled";
		}
		return runGarminProbe(new ObsidianHttpClient(), this.log, {
			email: settings.email,
			password: this.password,
			domain: settings.domain,
			requestMfaCode: (method) => this.promptForMfa(method),
		});
	}

	private persist(): Promise<Verdict> {
		return runPersistenceProbe(this.plugin.garmin, this.log, {
			email: this.plugin.data.settings.email,
			password: this.password,
		});
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
		const folder = normalizePath(this.plugin.data.settings.logFolder);
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
