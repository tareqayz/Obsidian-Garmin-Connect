#!/usr/bin/env node
/**
 * Turns a web capture into an endpoint inventory for one stat.
 *
 *   node scripts/garmin-web/summarize.mjs --export <capture.jsonl> --out <dir>
 *        [--gql <graphql.json>] [--title "<Stat>"]
 *
 * <capture.jsonl> is `scripts/dev/b.sh network --export` output (one response
 * per line, from `network --capture --filter gc-api`). <graphql.json> is
 * graphql-dump.js output. Writes <dir>/endpoints.md and one sanitised body per
 * distinct endpoint under <dir>/bodies/: response headers are dropped, auth,
 * token and profile URLs are skipped, and the account's display name is
 * replaced by {displayName}. Each endpoint is matched against
 * api/endpoints.json: a catalogue id (with its GarminApi method, or "no
 * wrapper"), or NEW.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const argv = process.argv.slice(2);
const opt = (name) => {
	const i = argv.indexOf(`--${name}`);
	return i >= 0 ? argv[i + 1] : undefined;
};
const exportFile = opt("export");
const outDir = opt("out");
if (!exportFile || !outDir) {
	console.error("usage: summarize.mjs --export <capture.jsonl> --out <dir> [--gql <graphql.json>] [--title <Stat>]");
	process.exit(2);
}
const root = fileURLToPath(new URL("../..", import.meta.url));
const catalogue = JSON.parse(readFileSync(join(root, "api/endpoints.json"), "utf8")).endpoints;

// App-shell calls every page makes (preferences, devices, consent, inbox …):
// listed apart from the page's own data so the inventory stays readable.
const SHELL = /userpreference-service|gdprconsent-service|device-service|deviceregistration|info-service|web-gateway\/(inbox|snapshot|device-info)|myfitnesspal|nutrition-service\/user|connection-service|newsfeed|system-service|trainingplan-service|userprofile-service|activity-service\/activity\/activityTypes|activitylist-service\/activities\/fordailysummary|wellnessactivity-service|sleep-service\/sleep\/naps|dailyEvents/i;
const SKIP = /oauth|\/token|\/sso\/|socialProfile|personal-information|userprofile-service\/userprofile\/(user-settings|personal)|\/login|\/logout|messaging|notification/i;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const lines = readFileSync(exportFile, "utf8").split("\n").filter(Boolean);
const responses = lines.map((l) => JSON.parse(l));

// The account's display name: a UUID-shaped path segment, or the segment after
// a service that is always keyed by it. Scrubbed from paths and bodies.
const displayNames = new Set();
const KEYED = /\/(?:dailySleepData|dailyHeartRate|usersummary\/daily|fordailysummary|dailyEvents|personalrecord\/prs|pagination)\/([^/?]+)/i;
for (const r of responses) {
	const path = String(r.url).split("?")[0];
	for (const seg of path.split("/")) if (UUID.test(decodeURIComponent(seg))) displayNames.add(decodeURIComponent(seg));
	const m = path.match(KEYED);
	if (m && !DATE.test(m[1]) && !/^\d+$/.test(m[1]) && m[1].length >= 6) displayNames.add(decodeURIComponent(m[1]));
}

const scrub = (text) => {
	let t = text;
	for (const name of displayNames) t = t.split(name).join("{displayName}");
	return t;
};

function split(url) {
	const u = new URL(url);
	let path = u.pathname.replace(/^\/gc-api/, "").replace(/^\/proxy/, "");
	const query = [...u.searchParams.entries()];
	return { path, query };
}

function template(path) {
	return path
		.split("/")
		.map((seg) => {
			const s = decodeURIComponent(seg);
			if (displayNames.has(s) || UUID.test(s)) return "{displayName}";
			if (DATE.test(s)) return "{date}";
			if (/^\d{6,}$/.test(s)) return "{id}";
			return seg;
		})
		.join("/");
}

const catalogueRegex = catalogue.map((e) => ({
	entry: e,
	re: new RegExp("^" + e.path.split("?")[0].replace(/[.*+?^$()|[\]\\]/g, "\\$&").replace(/\{[^}]+\}/g, "[^/]+") + "$"),
}));

function match(path) {
	const hit = catalogueRegex.find(({ re }) => re.test(path));
	if (!hit) return { id: "NEW", plugin: "" };
	return { id: hit.entry.id, plugin: hit.entry.plugin ?? "no wrapper" };
}

function shapeOf(value, depth = 0) {
	if (value === null) return "null";
	if (Array.isArray(value)) return value.length ? `[${value.length}× ${depth > 1 ? "…" : shapeOf(value[0], depth + 1)}]` : "[]";
	if (typeof value === "object") {
		const keys = Object.keys(value);
		if (depth > 1) return `{${keys.length} keys}`;
		return "{" + keys.slice(0, 18).map((k) => `${k}: ${shapeOf(value[k], depth + 1)}`).join(", ") + (keys.length > 18 ? ", …" : "") + "}";
	}
	return typeof value;
}

const groups = new Map();
let skipped = 0;
for (const r of responses) {
	const { path, query } = split(r.url);
	if (SKIP.test(path)) {
		skipped++;
		continue;
	}
	const key = template(path);
	const g = groups.get(key) ?? { key, raw: path, queries: new Map(), statuses: new Set(), count: 0, sample: null, sizes: [] };
	g.count++;
	g.statuses.add(r.status);
	g.sizes.push(r.size);
	for (const [k, v] of query) {
		if (k === "_") continue;
		g.queries.set(k, DATE.test(v) ? "{date}" : /^\d{4}-\d{2}-\d{2}T/.test(v) ? "{timestamp}" : scrub(v));
	}
	if (!g.sample && r.body && /json/i.test(r.contentType || "") && !r.bodyTruncated) {
		try {
			g.sample = JSON.parse(r.body);
		} catch {}
	}
	groups.set(key, g);
}

const gql = opt("gql") ? JSON.parse(readFileSync(opt("gql"), "utf8")) : [];
mkdirSync(join(outDir, "bodies"), { recursive: true });

const rows = [];
const shellRows = [];
let n = 0;
for (const g of [...groups.values()].sort((a, b) => a.key.localeCompare(b.key))) {
	n++;
	const m = match(g.raw);
	const slug = g.key.replace(/[{}]/g, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
	let shape = "(no JSON body)";
	if (g.sample !== null) {
		shape = shapeOf(g.sample);
		writeFileSync(join(outDir, "bodies", `${String(n).padStart(2, "0")}-${slug}.json`), scrub(JSON.stringify(g.sample, null, 1)));
	}
	const q = [...g.queries.entries()].map(([k, v]) => `${k}=${v}`).join("&");
	const line = `| ${n} | \`${g.key}\`${q ? `<br>\`?${q}\`` : ""} | ${[...g.statuses].join(", ")} | ${g.count} | ${m.id} | ${m.plugin || "—"} | ${shape.replace(/\|/g, "\\|").slice(0, 400)} |`;
	(SHELL.test(g.raw) ? shellRows : rows).push(line);
}

const ops = new Map();
for (const op of gql) {
	const name = op.operationName || (op.query ? op.query.trim().split(/\s+/).slice(0, 2).join(" ") : "raw");
	const o = ops.get(name) ?? { name, count: 0, query: op.query, variables: new Set() };
	o.count++;
	for (const k of Object.keys(op.variables || {})) o.variables.add(k);
	ops.set(name, o);
}

const title = opt("title") ?? "Web capture";
const md = [
	`# ${title} — web endpoints`,
	"",
	`Generated by scripts/garmin-web/summarize.mjs from ${lines.length} captured responses (${skipped} auth/profile responses skipped). Bodies: \`bodies/\`.`,
	"",
	"| # | Path (templated) | Status | Calls | Catalogue | GarminApi | Response shape |",
	"|---|---|---|---|---|---|---|",
	...rows,
	"",
	"## GraphQL operations sent",
	"",
	ops.size ? "| Operation | Calls | Variables |\n|---|---|---|" : "None recorded.",
	...[...ops.values()].map((o) => `| ${o.name} | ${o.count} | ${[...o.variables].join(", ") || "—"} |`),
	"",
	...[...ops.values()].filter((o) => o.query).map((o) => `### ${o.name}\n\n\`\`\`graphql\n${scrub(o.query.trim())}\n\`\`\`\n`),
	"",
	"## App-shell calls (every page)",
	"",
	shellRows.length ? "| # | Path (templated) | Status | Calls | Catalogue | GarminApi | Response shape |\n|---|---|---|---|---|---|---|" : "None.",
	...shellRows,
];
writeFileSync(join(outDir, "endpoints.md"), md.join("\n"));
console.log(`${rows.length} page endpoints (${rows.filter((r) => r.includes("| NEW |")).length} NEW), ${shellRows.length} shell, ${ops.size} GraphQL operations → ${join(outDir, "endpoints.md")}`);
