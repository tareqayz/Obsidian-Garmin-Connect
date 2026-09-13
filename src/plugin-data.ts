import type { Plugin } from "obsidian";
import type { PersistedAuth, TokenStore } from "./garmin/tokens";
import { DEFAULT_SETTINGS, type GarminSettings } from "./settings";
import { ALL_GROUPS, type MetricGroup } from "./sync/metrics";

/* Readers that accept only what they recognise, so nothing unexpected survives
   a load — neither a stale secret nor a value that would break a slider. */

const text = (v: unknown, fallback: string) => (typeof v === "string" ? v : fallback);

const nonEmpty = (v: unknown, fallback: string) =>
	typeof v === "string" && v.trim() ? v : fallback;

const bool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);

const int = (v: unknown, fallback: number, min: number, max: number) =>
	typeof v === "number" && Number.isFinite(v)
		? Math.min(max, Math.max(min, Math.round(v)))
		: fallback;

function groups(v: unknown, fallback: MetricGroup[]): MetricGroup[] {
	if (!Array.isArray(v)) return fallback;
	const valid = v.filter((g): g is MetricGroup => ALL_GROUPS.includes(g as MetricGroup));
	// An empty list is a legitimate choice; a malformed one is not.
	return valid.length === v.length ? valid : fallback;
}

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
		const d = DEFAULT_SETTINGS;
		this.settings = {
			email: text(source.email, d.email),
			domain: source.domain === "garmin.cn" ? "garmin.cn" : d.domain,

			syncDays: int(source.syncDays, d.syncDays, 1, 30),
			groups: groups(source.groups, d.groups),
			units:
				source.units === "metric" || source.units === "imperial" || source.units === "auto"
					? source.units
					: d.units,
			storageMode:
				source.storageMode === "dailyNotes" || source.storageMode === "both"
					? source.storageMode
					: d.storageMode,
			dataFolder: nonEmpty(source.dataFolder, d.dataFolder),
			dataFolderPrefix: text(source.dataFolderPrefix, d.dataFolderPrefix),
			createBasesView: bool(source.createBasesView, d.createBasesView),
			basesFolder: nonEmpty(source.basesFolder, d.basesFolder),

			linkToBase: bool(source.linkToBase, d.linkToBase),
			linkProperty: nonEmpty(source.linkProperty, d.linkProperty),

			prefix: text(source.prefix, d.prefix),
			dailyNoteFolder: text(source.dailyNoteFolder, d.dailyNoteFolder),
			dailyNoteFormat: text(source.dailyNoteFormat, d.dailyNoteFormat),
			createMissingNotes: bool(source.createMissingNotes, d.createMissingNotes),
			syncOnStartup: bool(source.syncOnStartup, d.syncOnStartup),
			pauseBetweenDays: int(source.pauseBetweenDays, d.pauseBetweenDays, 0, 5000),
			stopAfterEmptyDays: int(source.stopAfterEmptyDays, d.stopAfterEmptyDays, 0, 365),

			logFolder: nonEmpty(source.logFolder, d.logFolder),
			autoSaveLog: bool(source.autoSaveLog, d.autoSaveLog),
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
