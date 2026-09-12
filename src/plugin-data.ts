import type { Plugin } from "obsidian";
import type { PersistedAuth, TokenStore } from "./garmin/tokens";
import { DEFAULT_SETTINGS, type GarminSettings } from "./settings";

interface Persisted {
	settings: GarminSettings;
	auth: PersistedAuth | null;
}

/**
 * Owns `data.json`.
 *
 * Settings and the session share one file, so both go through here — otherwise
 * saving settings would clobber a token written moments earlier.
 *
 * It is also the only `TokenStore` the plugin uses, and what it stores is
 * deliberately narrow: a refresh token and the DI client it belongs to. No
 * password, no access token.
 */
export class PluginData implements TokenStore {
	settings: GarminSettings = { ...DEFAULT_SETTINGS };

	private plugin: Plugin;
	private auth: PersistedAuth | null = null;
	/** True when a legacy password was found and removed on load. */
	migratedAwayFromStoredPassword = false;

	constructor(plugin: Plugin) {
		this.plugin = plugin;
	}

	async init(): Promise<void> {
		const raw = (await this.plugin.loadData()) as Record<string, unknown> | null;
		if (!raw) return;

		// Phase 0 wrote settings flat at the top level; anything with a `settings`
		// key is already the current shape.
		const legacy = !("settings" in raw);
		const source = (legacy ? raw : ((raw.settings ?? {}) as Record<string, unknown>));

		// Read by allowlist rather than spreading. Phase 0 could store the Garmin
		// password, and picking known keys means a stray secret cannot survive a
		// load no matter what is sitting in the file.
		this.settings = {
			email: typeof source.email === "string" ? source.email : DEFAULT_SETTINGS.email,
			domain: source.domain === "garmin.cn" ? "garmin.cn" : DEFAULT_SETTINGS.domain,
			logFolder:
				typeof source.logFolder === "string" && source.logFolder.trim()
					? source.logFolder
					: DEFAULT_SETTINGS.logFolder,
			autoSaveLog:
				typeof source.autoSaveLog === "boolean"
					? source.autoSaveLog
					: DEFAULT_SETTINGS.autoSaveLog,
		};
		this.migratedAwayFromStoredPassword = Boolean(source.password);

		const auth = raw.auth as PersistedAuth | null | undefined;
		this.auth = auth && typeof auth.refreshToken === "string" ? auth : null;

		if (legacy || this.migratedAwayFromStoredPassword) await this.flush();
	}

	/* TokenStore ----------------------------------------------------- */

	async load(): Promise<PersistedAuth | null> {
		return this.auth;
	}

	async save(auth: PersistedAuth): Promise<void> {
		this.auth = auth;
		await this.flush();
	}

	async clear(): Promise<void> {
		this.auth = null;
		await this.flush();
	}

	/* Settings ------------------------------------------------------- */

	async saveSettings(): Promise<void> {
		await this.flush();
	}

	get hasSession(): boolean {
		return this.auth !== null;
	}

	private async flush(): Promise<void> {
		const payload: Persisted = { settings: this.settings, auth: this.auth };
		await this.plugin.saveData(payload);
	}
}
