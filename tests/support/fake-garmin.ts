import { buildUrl, type HttpClient, type HttpRequest, type HttpResponse } from "../../src/http";
import type { DetailCandidate } from "../../src/sync/backfill";
import type { DetailProfile } from "../../src/sync/cost";
import { toIsoDate } from "../../src/garmin/endpoints";
import { shiftDate } from "../../src/sync/day-index";
import { ASSUMED_HORIZON_DAYS } from "../../src/sync/horizons";
import type { VirtualClock } from "./virtual-clock";

/**
 * Garmin as a download meets it, on a virtual clock: every request answers
 * after `latency` ms. The account's activities are listed and counted, and
 * each one's summary says what its page goes on to ask, by its profile (a
 * track, power, a watch); every other route answers with nothing, which costs
 * the same requests and the same time as an answer would. Past Garmin's
 * horizon (`ASSUMED_HORIZON_DAYS`), a day's stress, heart rate, floors and
 * intensity answer with totals and no points, as Garmin's do.
 */
export class FakeGarmin implements HttpClient {
	/** Requests answered, by route, the token refresh left out. */
	readonly asked: string[] = [];
	private readonly byId: Map<number, DetailCandidate>;

	constructor(
		private readonly clock: VirtualClock,
		private readonly latency: number,
		private readonly activities: readonly DetailCandidate[],
	) {
		this.byId = new Map(activities.map((a) => [a.id, a]));
	}

	request(req: HttpRequest): Promise<HttpResponse> {
		const url = buildUrl(req.url, req.query);
		const body = this.answer(url, req.query ?? {});
		if (!url.includes("diauth")) this.asked.push(url);
		return new Promise((done) => this.clock.setTimeout(() => done({ status: 200, headers: { "content-type": "application/json" }, text: JSON.stringify(body) }), this.latency));
	}

	private answer(url: string, query: Record<string, string>): unknown {
		if (url.includes("diauth")) return { access_token: "access", refresh_token: "refresh", expires_in: 86_400 };
		if (url.includes("/socialProfile")) return { displayName: "sim-user", profileId: 4242 };
		if (url.includes("/user-settings")) return { userData: { measurementSystem: "metric", height: 180 } };
		if (url.includes("/activities/count")) return { totalCount: this.activities.length, multisportChildCount: 0 };
		if (url.includes("/activities/search/activities")) {
			const from = query.startDate;
			const to = query.endDate;
			const listed = this.activities.filter((a) => (!from || a.date >= from) && (!to || a.date <= to));
			const start = Number(query.start ?? 0);
			return listed.slice(start, start + Number(query.limit ?? 20)).map(listRow);
		}
		const old = (date: string | undefined) => !!date && date < shiftDate(toIsoDate(new Date(this.clock.now())), -ASSUMED_HORIZON_DAYS);
		const path = url.split("?")[0]!;
		const day = /\/wellness-service\/wellness\/(dailyStress|floorsChartData\/daily|daily\/im)\/(\d{4}-\d{2}-\d{2})$/.exec(path);
		if (day && old(day[2])) {
			if (day[1] === "dailyStress") return { calendarDate: day[2], avgStressLevel: 30, maxStressLevel: 90, stressValuesArray: [] };
			if (day[1] === "daily/im") return { calendarDate: day[2], startDayMinutes: 40, endDayMinutes: 70, imValuesArray: null };
			return { floorValuesArray: [] };
		}
		if (path.includes("/wellness-service/wellness/dailyHeartRate/") && old(query.date)) return { calendarDate: query.date, restingHeartRate: 52, maxHeartRate: 150, heartRateValues: null };
		const summary = /\/activity-service\/activity\/(\d+)$/.exec(path);
		if (summary) {
			const activity = this.byId.get(Number(summary[1]));
			return activity ? summaryOf(activity) : null;
		}
		return [];
	}
}

const TYPES: Record<DetailProfile, { typeKey: string; typeId: number; parentTypeId?: number }> = {
	run: { typeKey: "running", typeId: 1 },
	indoorRun: { typeKey: "treadmill_running", typeId: 18, parentTypeId: 1 },
	ride: { typeKey: "road_biking", typeId: 10, parentTypeId: 2 },
	gpsOther: { typeKey: "hiking", typeId: 3 },
	pool: { typeKey: "lap_swimming", typeId: 27, parentTypeId: 26 },
	gym: { typeKey: "strength_training", typeId: 13, parentTypeId: 29 },
	other: { typeKey: "other", typeId: 4 },
};

/** What each profile's page asks after the summary: the weather with a track, the power zones and a weigh-in with power. */
const RECORDS: Record<DetailProfile, { track: boolean; power: boolean }> = {
	run: { track: true, power: true },
	indoorRun: { track: false, power: true },
	ride: { track: true, power: true },
	gpsOther: { track: true, power: false },
	pool: { track: false, power: false },
	gym: { track: false, power: false },
	other: { track: false, power: true },
};

export function listRow(a: DetailCandidate): Record<string, unknown> {
	return {
		activityId: a.id,
		activityName: `Activity ${a.id}`,
		activityType: TYPES[a.profile],
		startTimeLocal: `${a.date} 07:00:00`,
		startTimeGMT: `${a.date} 05:00:00`,
		beginTimestamp: Date.parse(`${a.date}T05:00:00Z`),
		duration: 3_600,
		distance: 10_000,
	};
}

function summaryOf(a: DetailCandidate): Record<string, unknown> {
	const records = RECORDS[a.profile];
	return {
		activityId: a.id,
		activityName: `Activity ${a.id}`,
		activityTypeDTO: TYPES[a.profile],
		summaryDTO: { startTimeLocal: `${a.date}T07:00:00.0`, startTimeGMT: `${a.date}T05:00:00.0`, duration: 3_600, distance: 10_000, ...(records.power ? { averagePower: 250 } : {}) },
		metadataDTO: { hasPolyline: records.track, hasPowerTimeInZones: records.power, deviceMetaDataDTO: { deviceVersionPk: 1_234 } },
	};
}
