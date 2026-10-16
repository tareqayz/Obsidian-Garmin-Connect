import type { App, SecretStorage } from "obsidian";
import type { PersistedAuth, TokenStore } from "./tokens";

/** The SecretStorage id the Garmin session is kept under (Settings → Keychain). */
export const SESSION_SECRET = "garmin-connect-session";

/** Set in this device's local storage once a session was saved here: signed out since, not never signed in. */
export const HAD_SESSION_KEY = "garmin-connect-had-session";

/**
 * The Garmin session in Obsidian's SecretStorage instead of `data.json`.
 *
 * SecretStorage lives in this device's local storage, keyed to the vault, so
 * the refresh token never travels with the vault: a backup, a shared folder or
 * a public repository of the vault holds none. Each device signs in once and
 * refreshes its own token, so two devices never present the same one, which
 * Garmin retires once it has been swapped for a new one.
 *
 * Without SecretStorage (an Obsidian older than 1.11.4) the session lasts until
 * the plugin reloads.
 */
export class SecretTokenStore implements TokenStore {
	private memory: string | null = null;

	constructor(private readonly app: App) {}

	/** The session on this device, read now: SecretStorage answers at once. */
	read(): PersistedAuth | null {
		const raw = this.secrets ? this.secrets.getSecret(SESSION_SECRET) : this.memory;
		return raw ? parseSession(raw) : null;
	}

	async load(): Promise<PersistedAuth | null> {
		return this.read();
	}

	async save(auth: PersistedAuth): Promise<void> {
		const raw = JSON.stringify({ refreshToken: auth.refreshToken, diClientId: auth.diClientId, savedAt: auth.savedAt });
		if (this.secrets) this.secrets.setSecret(SESSION_SECRET, raw);
		else this.memory = raw;
		this.app.saveLocalStorage?.(HAD_SESSION_KEY, "1");
	}

	/** Whether this device has held a session before: one that ended here, rather than a device that only reads. */
	get hadSessionHere(): boolean {
		return this.app.loadLocalStorage?.(HAD_SESSION_KEY) === "1";
	}

	/** SecretStorage has no delete: an empty secret reads as no session. */
	async clear(): Promise<void> {
		if (this.secrets) this.secrets.setSecret(SESSION_SECRET, "");
		this.memory = null;
	}

	private get secrets(): SecretStorage | undefined {
		return (this.app as { secretStorage?: SecretStorage }).secretStorage;
	}
}

/** A stored session by its three fields; anything else in the secret is dropped. */
export function parseSession(raw: string): PersistedAuth | null {
	try {
		const value = JSON.parse(raw) as Record<string, unknown> | null;
		if (!value || typeof value !== "object") return null;
		if (typeof value.refreshToken !== "string" || !value.refreshToken || typeof value.diClientId !== "string") return null;
		return { refreshToken: value.refreshToken, diClientId: value.diClientId, savedAt: typeof value.savedAt === "number" ? value.savedAt : 0 };
	} catch {
		return null;
	}
}
