import type { Plugin } from "obsidian";
import { readGlance, type GlanceId } from "./dashboard/glance";
import { DEFAULT_PRESET, isPresetId, type MoreId, type PresetId } from "./dashboard/home";
import type { SecretTokenStore } from "./garmin/secret-token-store";
import type { PersistedAuth } from "./garmin/tokens";
import { DEFAULT_SETTINGS, defaultData, SETTINGS_VERSION, type DataChoices, type GarminSettings, type SetupState } from "./settings-data";
import { chartKeys, isActivityDetailsRange, isDayDetailsRange, LEGACY_RUNS_KEY, parseConsentKey } from "./sync/datasets";
import type { LegacyNotes } from "./sync/import-notes";
import { ALL_GROUPS, type MetricGroup } from "./sync/metrics";
import { isSyncSpeed, speedFromPause } from "./sync/speed";

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

function setupOf(v: unknown): SetupState | null {
	const raw = v as Partial<SetupState> | null | undefined;
	if (!raw || typeof raw !== "object" || typeof raw.completedAt !== "string" || Number.isNaN(Date.parse(raw.completedAt))) return null;
	return { completedAt: raw.completedAt, ...(raw.migrated === true ? { migrated: true } : {}) };
}

const keys = (v: unknown): string[] => (Array.isArray(v) ? [...new Set(v.filter((k): k is string => typeof k === "string" && parseConsentKey(k) !== null))] : []);

function dataOf(v: unknown): DataChoices {
	const raw = (v ?? {}) as Record<string, unknown>;
	const d = defaultData();
	return {
		dayDetails: isDayDetailsRange(raw.dayDetails) ? raw.dayDetails : d.dayDetails,
		// `runDetails` is the same choice from when only runs had a page.
		activityDetails: isActivityDetailsRange(raw.activityDetails) ? raw.activityDetails : isActivityDetailsRange(raw.runDetails) ? raw.runDetails : d.activityDetails,
		accepted: keys(raw.accepted),
		deferred: keys(raw.deferred),
	};
}

interface Persisted {
	settings: GarminSettings;
	home: HomeState;
}

/** The session a build before SecretStorage kept in data.json, by its three fields. */
function legacyAuth(v: unknown): PersistedAuth | null {
	const raw = v as Partial<PersistedAuth> | null | undefined;
	if (!raw || typeof raw !== "object" || typeof raw.refreshToken !== "string" || !raw.refreshToken || typeof raw.diClientId !== "string") return null;
	return { refreshToken: raw.refreshToken, diClientId: raw.diClientId, savedAt: typeof raw.savedAt === "number" ? raw.savedAt : 0 };
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
 * Owns `data.json`: settings and Home's state, which both go through here so
 * one save cannot clobber the other.
 *
 * The session is not in it. It lives in this device's keychain
 * (`SecretTokenStore`), so the refresh token never travels with the vault. A
 * session an older build left in `data.json` moves there on load, and the next
 * save leaves it out.
 */
export class PluginData {
	settings: GarminSettings = { ...DEFAULT_SETTINGS, data: defaultData() };
	/**
	 * The Home screen's own state. Kept beside settings rather than inside them:
	 * settings say what to sync, this says how Home shows it, and the settings
	 * tab never touches it.
	 */
	home: HomeState = { preset: DEFAULT_PRESET, hidden: [] };

	/**
	 * Where a build before JSON-only storage wrote day notes, read once from
	 * what it saved, for the import (`import-notes.ts`). Never saved again.
	 */
	legacyNotes: LegacyNotes = { dataFolder: DEFAULT_SETTINGS.dataFolder, dataFolderPrefix: "", prefix: "garmin_" };

	private plugin: Plugin;
	private tokens: Pick<SecretTokenStore, "read" | "save">;

	constructor(plugin: Plugin, tokens: Pick<SecretTokenStore, "read" | "save">) {
		this.plugin = plugin;
		this.tokens = tokens;
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

			groups: groups(source.groups, d.groups),
			units:
				source.units === "metric" || source.units === "imperial" || source.units === "auto"
					? source.units
					: d.units,
			dataFolder: nonEmpty(source.dataFolder, d.dataFolder),
			syncOnStartup: bool(source.syncOnStartup, d.syncOnStartup),
			setup: setupOf(source.setup),
			data: dataOf(source.data),
			mapTiles: bool(source.mapTiles, d.mapTiles),
			// An older build saved a pause in ms; the speed nearest it stands in.
			syncSpeed: isSyncSpeed(source.syncSpeed) ? source.syncSpeed : speedFromPause(source.pauseBetweenDays),
			stopAfterEmptyDays: int(source.stopAfterEmptyDays, d.stopAfterEmptyDays, 0, 365),

			logFolder: nonEmpty(source.logFolder, d.logFolder),
			autoSaveLog: bool(source.autoSaveLog, d.autoSaveLog),
		};
		// An older build kept the session here. It moves to this device's keychain
		// unless this device already has one, and the save below leaves it out.
		const legacy = legacyAuth(raw.auth);
		if (legacy && !this.tokens.read()) await this.tokens.save(legacy);

		const migrated = this.migrate(source.downloadRuns === true, legacy !== null || this.hasSession);
		this.legacyNotes = {
			dataFolder: this.settings.dataFolder,
			dataFolderPrefix: text(source.dataFolderPrefix, ""),
			prefix: text(source.prefix, "garmin_"),
		};

		// Same allowlist treatment as settings: a card or section this build does
		// not know is dropped rather than drawn.
		const home = (raw.home ?? {}) as Record<string, unknown>;
		const glance = readGlance(home.glance);
		this.home = {
			preset: isPresetId(home.preset) ? home.preset : DEFAULT_PRESET,
			hidden: Array.isArray(home.hidden)
				? MORE_IDS.filter((id) => (home.hidden as unknown[]).includes(id))
				: [],
			...(glance ? { glance } : {}),
		};

		if (migrated || raw.auth !== undefined) await this.flush();
	}

	/**
	 * The setup and the data choices again from `data.json`, after another
	 * device changed them (`onExternalSettingsChange`). Nothing else: Home and
	 * the other settings stay as this device has them.
	 */
	async reloadChoices(): Promise<void> {
		const raw = (await this.plugin.loadData()) as Record<string, unknown> | null;
		const source = (raw?.settings ?? {}) as Record<string, unknown>;
		if (int(source.settingsVersion, 1, 1, SETTINGS_VERSION) < SETTINGS_VERSION) return;
		this.settings.setup = setupOf(source.setup);
		this.settings.data = dataOf(source.data);
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
	private migrate(downloadRuns: boolean, signedIn: boolean): boolean {
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
		if (this.settings.settingsVersion < 5) {
			// "Download runs" became the Run details range, now Activity details'.
			this.settings.data = { ...defaultData(), activityDetails: downloadRuns ? "all" : "opened" };
			// A vault that was already syncing is set up: no wizard. Its charts
			// were walked already; its runs were if Download runs was on. Its day
			// details are left for the first update dialog, which offers the
			// recent days an older build saved without timelines.
			if (signedIn) {
				this.settings.setup = { completedAt: new Date().toISOString(), migrated: true };
				this.settings.data.dayDetails = "30d";
				// Download runs agreed to runs: the legacy key keeps them coming, and the other sports are asked about.
				this.settings.data.accepted = [...chartKeys(this.settings.groups), ...(downloadRuns ? [LEGACY_RUNS_KEY] : [])];
			}
		}
		this.settings.settingsVersion = SETTINGS_VERSION;
		return true;
	}

	/* Settings ------------------------------------------------------- */

	async saveSettings(): Promise<void> {
		await this.flush();
	}

	/* Home ----------------------------------------------------------- */

	async saveHome(next: HomeState): Promise<void> {
		this.home = next;
		await this.flush();
	}

	/** Whether this device holds a Garmin session. */
	get hasSession(): boolean {
		return this.tokens.read() !== null;
	}

	private async flush(): Promise<void> {
		const payload: Persisted = {
			settings: this.settings,
			home: this.home,
		};
		await this.plugin.saveData(payload);
	}
}
