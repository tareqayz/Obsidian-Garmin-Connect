import type { Plugin } from "obsidian";
import { readGlance, type GlanceId } from "./dashboard/glance";
import { DEFAULT_PRESET, isPresetId, type MoreId, type PresetId } from "./dashboard/home";
import { DEFAULT_LAYOUTS, readLayouts, type LayoutsState } from "./dashboard/layouts";
import type { PersistedAuth, TokenStore } from "./garmin/tokens";
import { DEFAULT_SETTINGS, SETTINGS_VERSION, type GarminSettings } from "./settings-data";
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
	layouts: LayoutsState;
	home: HomeState;
}

export interface HomeState {
	/** Which of Garmin's three Home presets is on screen. */
	preset: PresetId;
	/** Sections hidden with their Hide link; Reset Home brings them back. */
	hidden: MoreId[];
	/**
	 * The At a Glance cards, in order, once they have been edited on See All.
	 * Absent means the preset's own list; Reset Home goes back to that.
	 */
	glance?: GlanceId[];
}

const MORE_IDS: readonly MoreId[] = ["events", "coachPlans", "challenges"];

/**
 * Owns `data.json`.
 *
 * Settings, the session and the dashboard layouts share one file, so all three
 * go through here — otherwise saving settings would clobber a token written
 * moments earlier.
 *
 * It is also the only `TokenStore` the plugin uses, and what it stores is
 * deliberately narrow: a refresh token and the DI client it belongs to. No
 * password, no access token.
 */
export class PluginData implements TokenStore {
	settings: GarminSettings = { ...DEFAULT_SETTINGS };
	/**
	 * Dashboard layouts. Kept beside settings rather than inside them because
	 * they are a different kind of thing: settings say what to sync, a layout
	 * says how to read it, and the settings tab never touches these.
	 */
	layouts: LayoutsState = { ...DEFAULT_LAYOUTS };
	/** The Home screen's own state, kept apart from the classic dashboard's layouts. */
	home: HomeState = { preset: DEFAULT_PRESET, hidden: [] };

	private plugin: Plugin;
	private auth: PersistedAuth | null = null;

	constructor(plugin: Plugin) {
		this.plugin = plugin;
	}

	async init(): Promise<void> {
		const raw = (await this.plugin.loadData()) as Record<string, unknown> | null;
		if (!raw) return;

		const source = (raw.settings ?? {}) as Record<string, unknown>;

		// Read by allowlist rather than spreading: picking known keys means a stray
		// value — a secret, or something a later build wrote — never survives into
		// the next save, whatever is sitting in the file.
		const d = DEFAULT_SETTINGS;
		this.settings = {
			settingsVersion: int(source.settingsVersion, 1, 1, SETTINGS_VERSION),
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
		const migrated = this.migrate();

		// Same allowlist treatment as settings: a block this build cannot draw is
		// dropped rather than rendered. See `readLayouts`.
		this.layouts = readLayouts(raw.layouts);
		const home = (raw.home ?? {}) as Record<string, unknown>;
		const glance = readGlance(home.glance);
		this.home = {
			preset: isPresetId(home.preset) ? home.preset : DEFAULT_PRESET,
			hidden: Array.isArray(home.hidden)
				? MORE_IDS.filter((id) => (home.hidden as unknown[]).includes(id))
				: [],
			...(glance ? { glance } : {}),
		};

		const auth = raw.auth as PersistedAuth | null | undefined;
		this.auth = auth && typeof auth.refreshToken === "string" ? auth : null;

		if (migrated) await this.flush();
	}

	/**
	 * Switch on metric groups a release added.
	 *
	 * A vault that saved its settings before a group existed has no opinion about
	 * it, and leaving it off would mean the new metrics never appear until
	 * someone goes looking in settings for a toggle they do not know about.
	 * Versioned rather than "add anything missing", so a group you deliberately
	 * turned off stays off.
	 */
	private migrate(): boolean {
		if (this.settings.settingsVersion >= SETTINGS_VERSION) return false;
		if (this.settings.groups.length > 0) {
			const from = this.settings.settingsVersion;
			const added: MetricGroup[] = [
				...(from < 2 ? (["respiration", "spo2", "body", "training"] as const) : []),
				...(from < 3 ? (["intraday"] as const) : []),
				...(from < 4 ? (["health", "profile"] as const) : []),
			];
			this.settings.groups = [
				...ALL_GROUPS.filter(
					(g) => this.settings.groups.includes(g) || added.includes(g),
				),
			];
		}
		this.settings.settingsVersion = SETTINGS_VERSION;
		return true;
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

	/* Layouts -------------------------------------------------------- */

	async saveLayouts(next: LayoutsState): Promise<void> {
		this.layouts = next;
		await this.flush();
	}

	/* Home ----------------------------------------------------------- */

	async saveHome(next: HomeState): Promise<void> {
		this.home = next;
		await this.flush();
	}

	get hasSession(): boolean {
		return this.auth !== null;
	}

	private async flush(): Promise<void> {
		const payload: Persisted = {
			settings: this.settings,
			auth: this.auth,
			layouts: this.layouts,
			home: this.home,
		};
		await this.plugin.saveData(payload);
	}
}
