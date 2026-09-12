import { App, Modal, Notice, normalizePath } from "obsidian";
import { mount, unmount } from "svelte";
import type { ProbeLog } from "../log";
import type GarminPlugin from "../main";
import { ObsidianHttpClient } from "../obsidian-http";
import {
	reportPlatform,
	runFingerprintProbe,
	runGarminProbe,
	runFitnessProbe,
	runPersistenceProbe,
	type Verdict,
} from "../probe";
import ProbePanel from "./svelte/ProbePanel.svelte";

export class ProbeModal extends Modal {
	private plugin: GarminPlugin;
	private panel: ReturnType<typeof ProbePanel> | undefined;

	constructor(app: App, plugin: GarminPlugin) {
		super(app);
		this.plugin = plugin;
	}

	onOpen(): void {
		const settings = this.plugin.data.settings;
		this.contentEl.addClass("gcp-modal");

		this.panel = mount(ProbePanel, {
			target: this.contentEl,
			props: {
				initialEmail: settings.email,
				autoSaveLog: settings.autoSaveLog,
				platformReport: reportPlatform,
				onEmailChange: (email: string) => {
					settings.email = email;
					void this.plugin.data.saveSettings();
				},
				runFingerprint: (log: ProbeLog) => runFingerprintProbe(new ObsidianHttpClient(), log),
				runLogin: (
					log: ProbeLog,
					email: string,
					password: string,
					requestMfaCode: (method: string) => Promise<string | null>,
				) =>
					runGarminProbe(new ObsidianHttpClient(), log, {
						email,
						password,
						domain: settings.domain,
						requestMfaCode,
					}),
				runPersistence: (log: ProbeLog, email: string, password: string) =>
					runPersistenceProbe(this.plugin.garmin, log, { email, password }),
				runFitness: (log: ProbeLog) => runFitnessProbe(this.plugin.garmin, log),
				onFinished: (verdict: Verdict) => new Notice(`Garmin probe: ${verdict}`),
				onCopyLog: (text: string) => {
					navigator.clipboard
						.writeText(text)
						.then(() => new Notice("Probe log copied."))
						.catch(() => new Notice("Clipboard unavailable — use “Save to vault”."));
				},
				onSaveLog: (text: string, quiet: boolean) => this.saveLog(text, quiet),
				onClose: () => this.close(),
			},
		});
	}

	onClose(): void {
		if (this.panel) {
			unmount(this.panel);
			this.panel = undefined;
		}
		this.contentEl.empty();
	}

	/**
	 * Writes the log into the vault. On a phone this is the only reliable way to
	 * get the output off the device: the file syncs back to the desktop like any
	 * other note, and there is no console to read.
	 */
	private async saveLog(text: string, quiet: boolean): Promise<void> {
		const folder = normalizePath(this.plugin.data.settings.logFolder);
		const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
		const path = normalizePath(`${folder}/garmin-probe-${stamp}.md`);
		try {
			if (folder && !this.app.vault.getFolderByPath(folder)) {
				await this.app.vault.createFolder(folder);
			}
			await this.app.vault.create(path, ["```", text, "```", ""].join("\n"));
			if (!quiet) new Notice(`Saved ${path}`);
		} catch (err) {
			new Notice(`Could not save log: ${err instanceof Error ? err.message : String(err)}`);
		}
	}
}
