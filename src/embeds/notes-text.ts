import { CARDS, CATEGORIES } from "./catalog";
import { CHARTS, rangesInWords } from "./charts";

/**
 * The text of the two notes the plugin writes when asked: the daily note
 * template and the card guide. Pure.
 */

export const TEMPLATE_NAME = "Garmin daily note";
export const GUIDE_NAME = "Garmin cards";

/** A `garmin` block. */
function block(...lines: string[]): string {
	return ["```garmin", ...lines, "```"].join("\n");
}

/**
 * Home's cards for the note's own day. No dates inside: a daily note's name
 * gives the day, so the template works as it is with any template plugin.
 */
export function dailyTemplate(): string {
	return [
		"## Sleep and Body Battery",
		block("show: sleep, body-battery"),
		"",
		"## Activities",
		block("show: activities"),
		"",
		"## At a glance",
		block("show: heart-rate, stress, hrv-status, intensity-minutes"),
		"",
		"## Notes",
		"",
		"",
	].join("\n");
}

/**
 * Every card and chart, with what it shows and a live example of it, and the
 * activity block. The examples carry no date, so the guide shows today.
 */
export function cardGuide(version: string): string {
	const out: string[] = [
		`Written by Garmin Connect ${version}. **Rebuild card guide** refreshes it.`,
		"",
		"Add a Garmin card to any note with a `garmin` code block. Run **Insert card…** from the command palette, right-click → **Insert** → **Garmin card…**, or type it:",
		"",
		"````markdown",
		block("show: sleep"),
		"````",
		"",
		"## Which day a card shows",
		"",
		"- In a daily note, the note’s own day.",
		"- Anywhere else, add `date: 2026-10-28`, `date: today` or `date: yesterday`.",
		"- With no date at all, today.",
		"",
		"## Several cards in one block",
		"",
		"Name them in one line: `show: sleep, body-battery`. Big cards sit side by side, two to a row; small ones four to a row. A phone stacks them.",
		"",
		"Sleep, Body Battery, Steps, Training Readiness and Training Status are big cards. Add `size: small` for their small versions.",
		"",
		block("show: steps, heart-rate, stress", "size: small"),
	];
	for (const category of CATEGORIES) {
		out.push("", `## ${category.title}`);
		for (const card of CARDS.filter((c) => c.category === category.id)) {
			out.push("", `### ${card.title} \`show: ${card.id}\``, "", card.description, "", block(`show: ${card.id}`));
		}
	}
	out.push(
		"",
		"## Charts",
		"",
		"A chart is its stat page’s own: the day’s, or the 7 days, 4 weeks or year ending on it.",
		"",
		"````markdown",
		block("chart: stress", "range: 7d"),
		"````",
		"",
		"- `range` takes `1d` (the default), `7d`, `4w` or `1y`, ending on the block’s day.",
		"- Name several to stack them: `chart: sleep, stress`.",
		"- `size: small` draws trends as small cards, four to a row.",
		"- Respiration and Pulse Ox keep a day’s readings once you open their page on that day.",
	);
	for (const chart of CHARTS) {
		out.push("", `### ${chart.title} \`chart: ${chart.id}\``, "", `${chart.description} ${rangesInWords(chart.ranges)}.`, "", block(`chart: ${chart.id}`));
	}
	out.push(
		"",
		"### Trends as small cards",
		"",
		block("chart: steps, heart-rate, hrv-status, weight", "range: 4w", "size: small"),
		"",
		"## Activities",
		"",
		"One activity with its route map and figures, as its Overview shows them.",
		"",
		"- `activity: latest`: the day’s most recent.",
		"- `activity: all`: each of the day’s, newest first.",
		"- `activity: 20612345678`: one activity, whatever the note’s day. **Insert card…** lists yours.",
		"",
		"The map comes with the activity’s page: open an activity once and its card shows it. It loads OpenStreetMap’s tiles, as the page does; with Map tiles off, the route draws alone.",
		"",
		block("activity: latest"),
		"",
	);
	return out.join("\n");
}
