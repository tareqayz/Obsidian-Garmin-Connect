import { App, Modal, Notice } from "obsidian";
import type { GarminDomain } from "../garmin/constants";
import { mount, unmount } from "svelte";
import { toIsoDate } from "../garmin/endpoints";
import type GarminPlugin from "../main";
import { ACTIVITY_DETAILS_VERSION, DAY_DETAILS_VERSION, type ConsentKey } from "../sync/datasets";
import { estimate } from "../sync/estimate";
import type { MfaPrompt } from "../garmin/auth";
import type { AccountScan, ScanStep } from "../sync/scan";
import { VaultSeriesStore } from "../sync/series-store";
import { explainSignIn } from "./login-modal";
import { agreement, type Choices, type Prepared } from "./setup-flow";
import Setup from "./svelte/setup/Setup.svelte";

/**
 * The setup wizard: sign in, scan the account, then download all of it or
 * choose under Advanced options. Opens on the first enable, from Home's card,
 * the command and Settings → History. On a phone it is a sheet on the bottom
 * edge.
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
				initialDomain: settings.domain,
				onDomainChange: (domain: GarminDomain) => this.plugin.setDomain(domain),
				onSignIn: async (email: string, password: string, prompt: MfaPrompt) => {
					try {
						await this.plugin.garmin.login(email, password, { onMfaRequired: prompt });
						// Saved once it signs in, so Settings names the account that did.
						settings.email = email;
						await this.plugin.data.saveSettings();
						this.plugin.authChanged();
						return null;
					} catch (err) {
						return explainSignIn(err);
					}
				},
				onScan: async (onStep: (step: ScanStep) => void) => {
					const got = await this.plugin.sync.scan({ onStep });
					if (got && !got.fatal) {
						// The activity list, for Activity details' count: the first of the charts' walks anyway.
						await this.plugin.sync.syncActivityHistory({ auto: true });
						// The few indexes that show which days a route is empty on, for the estimate.
						await this.plugin.sync.prepareHistory();
						// Today and the days since the last sync while the user chooses, so Home has them.
						void this.plugin.sync.syncRecent("setup");
					}
					return got;
				},
				prepare: (scan: AccountScan) => this.prepare(scan),
				kept: settings.setup ? { dayDetails: settings.data.dayDetails, activityDetails: settings.data.activityDetails } : null,
				onStart: (choices: Choices, downloads: boolean) => void this.finish(choices, agreement(settings.groups), downloads),
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
		const [index, coverage, detailFiles, charts] = await Promise.all([
			store.readActivities(),
			store.readDayCoverage(settings.groups.includes("intraday")),
			store.readDetailCoverage(),
			store.readChartMetas(),
		]);
		const activities = index.rows.map((row) => this.plugin.candidateOf(row));
		const masks = await store.readMasks(settings.groups, charts, scan);
		let days = 0;
		for (const [from, to, version] of coverage.spans) {
			if (version !== DAY_DETAILS_VERSION) continue;
			days += Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
		}
		const held = { days, activities: [...detailFiles.values()].filter((v) => v === ACTIVITY_DETAILS_VERSION).length, bytes: store.diskUsage().total };
		const today = toIsoDate();
		const sizes = store.sizesFor(masks, activities, today);
		return {
			held,
			// What starting would download: the plan with what the setup agrees to.
			estimate: (choices: Choices) =>
				estimate({
					today,
					groups: settings.groups,
					accepted: [...new Set([...settings.data.accepted, ...agreement(settings.groups).accepted])],
					...choices,
					scan,
					daySpans: coverage.spans,
					charts,
					activities,
					detailFiles,
					masks,
					sizes,
					since: settings.setup?.completedAt.slice(0, 10) ?? today,
				}),
		};
	}

	/** Saves the choices and what they agree to, and starts the download in the background. */
	private async finish(choices: Choices, keys: { accepted: ConsentKey[]; deferred: ConsentKey[] }, downloads: boolean): Promise<void> {
		const settings = this.plugin.data.settings;
		const accepted = [...new Set([...settings.data.accepted, ...keys.accepted])];
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
		new Notice(downloads ? "Garmin Connect is set up. Your history is downloading." : "Garmin Connect is set up.");
	}
}
