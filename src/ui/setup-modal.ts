import { App, Modal, Notice } from "obsidian";
import { mount, unmount } from "svelte";
import { toIsoDate } from "../garmin/endpoints";
import type GarminPlugin from "../main";
import { DAY_DETAILS_VERSION, RUN_DETAILS_VERSION, type ConsentKey } from "../sync/datasets";
import { estimate } from "../sync/estimate";
import type { MfaPrompt } from "../garmin/auth";
import type { AccountScan, ScanStep } from "../sync/scan";
import { VaultSeriesStore } from "../sync/series-store";
import type { SyncSpeed } from "../sync/speed";
import { explainSignIn } from "./login-modal";
import { agreement, newDaysOnly, type Choices, type Prepared } from "./setup-flow";
import Setup from "./svelte/setup/Setup.svelte";

/**
 * The setup wizard: sign in, scan the account, choose what to keep, start
 * the download. Opens on the first enable, from Home's card, the command and
 * Settings → Data. On a phone it is a sheet on the bottom edge.
 */
export class SetupModal extends Modal {
	private body: ReturnType<typeof mount> | undefined;

	constructor(
		app: App,
		private readonly plugin: GarminPlugin,
	) {
		super(app);
	}

	onOpen(): void {
		this.containerEl.addClass("gch-sheet-container");
		this.modalEl.addClass("gch-setup");
		this.setTitle("Set up Garmin Connect");
		const settings = this.plugin.data.settings;
		this.body = mount(Setup, {
			target: this.contentEl,
			props: {
				signedIn: this.plugin.garmin.isAuthenticated,
				initialEmail: settings.email,
				onEmailChange: (email: string) => {
					settings.email = email;
					void this.plugin.data.saveSettings();
				},
				onSignIn: async (email: string, password: string, prompt: MfaPrompt) => {
					try {
						await this.plugin.garmin.login(email, password, { onMfaRequired: prompt });
						this.plugin.authChanged();
						return null;
					} catch (err) {
						return explainSignIn(err);
					}
				},
				onScan: async (onStep: (step: ScanStep) => void) => {
					const got = await this.plugin.sync.scan({ onStep });
					if (got && !got.fatal) {
						// The activity list, for the runs' count: the first of the charts' walks anyway.
						await this.plugin.sync.syncActivityHistory({ auto: true });
						// Today and the days since the last sync while the user chooses, so Home has them.
						void this.plugin.sync.syncRecent();
					}
					return got;
				},
				prepare: (scan: AccountScan) => this.prepare(scan),
				initialChoices: { dayDetails: settings.data.dayDetails, runDetails: settings.data.runDetails },
				initialSpeed: settings.syncSpeed,
				today: toIsoDate(),
				onStart: (choices: Choices, speed: SyncSpeed) => void this.finish(choices, speed, agreement(settings.groups)),
				onNewDaysOnly: (speed: SyncSpeed) => {
					const only = newDaysOnly(settings.groups);
					void this.finish(only.choices, speed, only);
				},
				onCancel: () => this.close(),
			},
		});
	}

	onClose(): void {
		if (this.body) {
			void unmount(this.body);
			this.body = undefined;
		}
		this.contentEl.empty();
	}

	/** What the vault holds, and the estimates over it, for the Scan and Choose steps. */
	private async prepare(scan: AccountScan): Promise<Prepared> {
		const settings = this.plugin.data.settings;
		const store = new VaultSeriesStore(this.app, settings.dataFolder);
		const [index, coverage, runFiles, charts] = await Promise.all([
			store.readActivities(),
			store.readDayCoverage(settings.groups.includes("intraday")),
			store.readRunCoverage(),
			store.readChartMetas(),
		]);
		const runs = index.rows.filter((row) => this.plugin.isRun(row)).map((row) => ({ id: row.id, date: row.start.slice(0, 10) }));
		let days = 0;
		for (const [from, to, version] of coverage.spans) {
			if (version !== DAY_DETAILS_VERSION) continue;
			days += Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
		}
		const held = { days, runs: [...runFiles.values()].filter((v) => v === RUN_DETAILS_VERSION).length, bytes: store.diskUsage().total };
		const today = toIsoDate();
		const heldCharts = new Map([...charts].filter((entry): entry is [string, { complete: boolean; from?: string }] => entry[1] !== null));
		return {
			held,
			runs: runs.length,
			estimate: (choices: Choices, speed: SyncSpeed) =>
				estimate({
					today,
					groups: settings.groups,
					speed,
					scan,
					...choices,
					runs,
					held: { daySpans: coverage.spans, runs: runFiles, charts: heldCharts },
				}),
		};
	}

	/** Saves the choices and what they agree to, and starts the download in the background. */
	private async finish(choices: Choices, speed: SyncSpeed, keys: { accepted: ConsentKey[]; deferred: ConsentKey[] }): Promise<void> {
		const settings = this.plugin.data.settings;
		const accepted = [...new Set([...settings.data.accepted, ...keys.accepted])];
		settings.syncSpeed = speed;
		settings.data = {
			...settings.data,
			...choices,
			accepted,
			deferred: [...new Set([...settings.data.deferred, ...keys.deferred])].filter((key) => !accepted.includes(key)),
		};
		settings.setup = { completedAt: new Date().toISOString() };
		await this.plugin.data.saveSettings();
		this.plugin.setupChanged();
		this.plugin.sync.kickBackfill();
		this.close();
		new Notice("Garmin Connect is set up. Your history downloads in the background.");
	}
}
