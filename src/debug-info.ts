import { Platform, TFile, TFolder, apiVersion, normalizePath, type App } from "obsidian";
import { describe as describeRequests } from "./garmin/request-stats";
import { scrub } from "./log";
import type GarminPlugin from "./main";
import { seenConflictCopies, VaultSeriesStore } from "./sync/series-store";

/**
 * What a bug report needs, as text to paste: the plugin's and Obsidian's
 * versions, the platform, the settings without the email, whether this device
 * holds a session, the history download, the last sync this session with its
 * warnings, the requests made, and what the data folder holds. Nothing goes
 * over the network, nothing signs in, and the text is scrubbed of emails,
 * tokens and IP addresses on the way out, with the account's names swapped
 * for placeholders.
 */
export async function debugInfo(plugin: GarminPlugin, opts: { error?: unknown } = {}): Promise<string> {
	const app = plugin.app;
	const s = plugin.data.settings;
	const lines: string[] = ["Garmin Connect debug info", ""];
	const add = (key: string, value: string | number | boolean | null | undefined) => lines.push(`- ${key}: ${value === undefined || value === null || value === "" ? "—" : String(value)}`);

	add("Plugin", plugin.manifest.version);
	add("Obsidian", apiVersion);
	add("Platform", platformName());
	add("When", new Date().toISOString());

	lines.push("", "Settings");
	add("Region", s.domain);
	add("Units", s.units);
	add("Metric groups", s.groups.join(", "));
	add("Data folder", s.dataFolder);
	add("Sync speed", s.syncSpeed);
	add("Sync on startup", s.syncOnStartup);
	add("Map tiles", s.mapTiles);
	add("Stop after empty days", s.stopAfterEmptyDays);
	add("Set up", s.setup ? `${s.setup.completedAt}${s.setup.migrated ? " (migrated)" : ""}` : "no");
	add("Day details", s.data.dayDetails);
	add("Activity details", s.data.activityDetails);
	add("Agreed to", s.data.accepted.join(", "));
	add("Put off", s.data.deferred.join(", "));

	lines.push("", "Session");
	add("Signed in on this device", plugin.garmin.isAuthenticated ? "yes" : "no");
	const session = plugin.garmin.session;
	if (session) add("Session saved", new Date(session.savedAt).toISOString());
	add("Keychain available", (app as { secretStorage?: unknown }).secretStorage ? "yes" : "no");

	const store = new VaultSeriesStore(app, s.dataFolder);
	lines.push("", "History download");
	const progress = plugin.sync.backfillProgress;
	add("State", progress ? [progress.status, progress.reason, progress.task, progress.until && `until ${progress.until}`].filter(Boolean).join(" · ") : "idle");
	if (progress) add("Requests", `${progress.done} done, about ${progress.remaining} left`);
	try {
		const state = await store.readBackfill();
		if (state.paused) add("backfill.json paused", `${state.paused.reason}${state.paused.until ? ` until ${state.paused.until}` : ""}`);
		if (state.lease) add("backfill.json lease", `${state.lease.label}, heartbeat ${state.lease.heartbeat}`);
	} catch (err) {
		add("backfill.json", `unreadable: ${message(err)}`);
	}

	lines.push("", "Last sync this session");
	const last = plugin.sync.lastSync;
	if (!last) add("Sync", "none yet");
	else {
		const r = last.report;
		add("Range", `${last.from} → ${last.to}, started ${last.at}`);
		add("Days", `${r.written} written, ${r.unchanged} unchanged, ${r.skipped} skipped, ${r.failed} failed`);
		add("Requests", r.requests);
		if (r.stoppedEarly) add("Stopped", r.stoppedEarly);
		for (const day of r.days.filter((d) => d.status === "failed").slice(0, 10)) add(`Failed ${day.date}`, day.error);
		for (const warning of r.warnings.slice(0, 15)) lines.push(`  - ${warning}`);
		if (r.warnings.length > 15) lines.push(`  - …and ${r.warnings.length - 15} more`);
	}

	lines.push("", "Requests this session");
	add("Summary", describeRequests(plugin.garmin.stats.summary()));

	lines.push("", "Data folder");
	const usage = store.diskUsage();
	add("Files", `${usage.files}, ${megabytes(usage.total)} (charts ${megabytes(usage.charts)}, day details ${megabytes(usage.days)}, activity details ${megabytes(usage.details)})`);
	const copies = seenConflictCopies();
	add("Conflict copies seen", copies.length ? copies.join(", ") : "none");
	const aside = setAside(app, s.dataFolder);
	add("Files set aside", aside.length ? aside.join(", ") : "none");

	if (opts.error !== undefined) {
		lines.push("", "Error");
		const err = opts.error;
		lines.push(err instanceof Error ? `${err.name}: ${err.message}` : message(err));
		const stack = err instanceof Error ? err.stack?.split("\n").slice(1, 9) : undefined;
		if (stack) lines.push(...stack.map((line) => `  ${line.trim()}`));
	}

	let text = scrub(lines.join("\n"));
	for (const [value, as] of [
		[plugin.garmin.name, "[full name]"],
		[plugin.garmin.profile?.displayName, "[display name]"],
		[s.email, "[email]"],
	] as const) {
		if (typeof value === "string" && value.length >= 3) text = text.split(value).join(as);
	}
	return text;
}

/**
 * Copies the debug info to the clipboard, or — where there is no clipboard —
 * saves it as a note in the log folder, which the vault syncs to a computer.
 */
export async function copyDebugInfo(plugin: GarminPlugin, opts: { error?: unknown } = {}): Promise<string> {
	const text = await debugInfo(plugin, opts);
	try {
		await navigator.clipboard.writeText(text);
		return "Garmin debug info copied. Paste it into your bug report.";
	} catch {
		const folder = normalizePath(plugin.data.settings.logFolder);
		const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
		const path = normalizePath(`${folder}/garmin-debug-${stamp}.md`);
		if (folder && !plugin.app.vault.getFolderByPath(folder)) await plugin.app.vault.createFolder(folder);
		const fence = "`".repeat(Math.max(3, ...[...text.matchAll(/`+/g)].map((m) => m[0].length + 1)));
		await plugin.app.vault.create(path, [fence, text, fence, ""].join("\n"));
		return `No clipboard here: the debug info is in ${path}.`;
	}
}

function platformName(): string {
	if (Platform.isIosApp) return Platform.isTablet ? "iPad" : "iPhone";
	if (Platform.isAndroidApp) return Platform.isTablet ? "Android tablet" : "Android";
	if (Platform.isMacOS) return "macOS";
	if (Platform.isWin) return "Windows";
	if (Platform.isLinux) return "Linux";
	return "unknown";
}

/** The files the store set aside in the data folder (see `file-health.ts`). */
function setAside(app: App, dataFolder: string): string[] {
	const out: string[] = [];
	const walk = (folder: TFolder) => {
		for (const child of folder.children) {
			if (child instanceof TFolder) walk(child);
			else if (child instanceof TFile && child.name.includes(".unreadable-")) out.push(child.path);
		}
	};
	const root = app.vault.getFolderByPath(normalizePath(dataFolder));
	if (root) walk(root);
	return out;
}

function megabytes(bytes: number): string {
	return `${(bytes / 1_000_000).toFixed(1)} MB`;
}

function message(err: unknown): string {
	return err instanceof Error ? err.message : String(err);
}
