# Garmin API catalogue

Garmin Connect's API is private. There is no specification, no version, and no
deprecation notice — a field is there one morning and gone the next, and the
first anyone hears about it is a user asking why a property stopped appearing.

This directory is the answer to that: a written-down description of the API, and
a job that checks it against the live one every day.

| File | What it is |
| --- | --- |
| [`endpoints.json`](endpoints.json) | Every endpoint, its request shape, and what this plugin does with it. |
| [`schema/`](schema/) | The response shape actually observed, one file per checked endpoint. |

## endpoints.json

135 endpoints. The request half is **generated** from
[`cyberjunky/python-garminconnect`](https://github.com/cyberjunky/python-garminconnect)
by `scripts/api/extract-endpoints.py`, which reads that library's AST and folds
its URL expressions back into path templates. That library is the closest thing
Garmin has to a spec, because it is kept current by people who notice when it
breaks.

```jsonc
{
  "id": "user-summary",
  "method": "GET",
  "path": "/usersummary-service/usersummary/daily/{displayName}",
  "service": "usersummary-service",
  "tier": "connectapi",
  "pathParams": ["displayName"],
  "query": ["calendarDate"],
  "requestBody": false,
  "returns": "json",
  "upstream": { "method": "get_user_summary", "summary": "…", "args": ["cdate"], "line": 963 },

  // Everything below here is hand-written and survives regeneration.
  "plugin": "GarminApi.dailySummary",
  "groups": ["activity", "heart", "stress"],
  "cadence": "day",
  "check": true,
  "critical": ["calendarDate", "totalSteps", "…"],
  "schema": "schema/user-summary.json",
  "notes": "Serves three metric groups from one request."
}
```

Two lists say what the plugin does with the response. `[]` descends into array
items, so `[].generic.vo2MaxPreciseValue` reaches into each day of a range
response.

- **`critical`** — paths the plugin depends on. Losing one fails the daily check.
- **`reads`** — paths it reads but tolerates missing: a property that will not
  appear rather than a sync that breaks. Reported, never fatal. It is also where
  a field name taken from documentation rather than observed belongs, until a
  live recording has confirmed it.

Losing anything outside both lists is a warning at most.

### Regenerating

```bash
GARMINCONNECT_SRC=~/Dev/python-garminconnect npm run api:extract
npm run api:extract:check   # exits 1 if the catalogue has drifted from upstream
```

`--check` is what CI runs daily against a fresh clone of upstream. It is
advisory — upstream adding an endpoint does not break this plugin — but it is
the earliest warning we get that Garmin moved something.

An endpoint that disappears upstream is kept and marked `"status":
"gone-upstream"` rather than dropped, because a path Garmin retired is exactly
the news this file exists to carry.

## The daily check

`.github/workflows/api-contract.yml`, every morning at 06:17 UTC.

It drives the plugin's own `GarminApi` — not a parallel HTTP client — so a path,
header or parameter that stops working here is one that stops working in the
plugin. Sixteen endpoints and about 115 response paths, sampling the last three
complete days and a fourteen-day range.

Each endpoint comes back with one verdict:

| | Verdict | Meaning |
| --- | --- | --- |
| `✓` | `ok` | Today's response fits the recorded shape. |
| `!` | `warn` | Something changed, but not on a path the plugin reads. |
| `✗` | `fail` | A `critical` path is gone, or changed into something incompatible. |
| `·` | `no-data` | Every sample came back empty. A rest day, not a change. |
| `+` | `new` | Nothing recorded yet. Run `npm run api:record`. |
| `✗` | `error` | The request itself failed. |

A failure opens — or comments on — a single issue labelled `garmin-api`.

### Why it stays quiet

A recorded shape is a **union over time**, not a snapshot, and the comparison is
deliberately one-directional. A field that is merely absent today, or a
`number | null` that happens to be a number today, is not news. A field the
recording says is *always* there and is now gone, or a type never seen before,
is. Without that asymmetry the check would fire every time the account had a
quiet day, and everyone would learn to ignore it.

`critical` paths get a third status beyond present/absent: **present but always
null**. A property that is there and forever empty is the signature of reading the
right endpoint with the wrong field name, which from inside a note looks exactly
like a metric with no data.

## Setting it up

The check needs a Garmin session. Mint one locally — the password never leaves
your machine and is never written down:

```bash
npm run api:token                       # prompts, handles MFA
gh secret set GARMIN_TOKENS < .garmin-token.json
```

`.garmin-token.json` is written `0600` and is gitignored. It holds a refresh
token, not a password.

Optionally also set `GH_SECRETS_TOKEN` to a fine-grained PAT with **Secrets:
write** on this repository. Garmin may hand back a new refresh token when the
old one is used; with that PAT the workflow returns it to the secret, and
without it a rotation strands the next run on a token Garmin has already
retired. Re-run `npm run api:token` if that happens.

Email and password work too — `GARMIN_EMAIL` and `GARMIN_PASSWORD` — but a
non-interactive run cannot answer an MFA challenge, and repeated sign-ins are
what Garmin rate-limits and locks accounts over. Prefer the token.

With no secret at all the live job skips rather than fails, so a fork stays
green.

## Running it yourself

```bash
npm run api:check                  # verify; exit 1 if a contract broke
npm run api:record                 # fold today's answer into schema/
npm run api:check -- --rerecord    # throw the history away and start from today
npm run api:check -- --days 7 --range 90
npm run api:check -- --strict      # exit 1 on any change, not just a broken one
```

Credentials come from the same environment variables; `.garmin-token.json` is
not read automatically, so pass it explicitly:

```bash
GARMIN_TOKENS="$(cat .garmin-token.json)" npm run api:check
```

## Accepting a change

When Garmin changes something and the change is fine:

1. Read the report on the issue or in the run summary.
2. If the plugin needs to follow the change, fix `src/` first.
3. Re-run the workflow with the **record** input ticked. It folds today's shapes
   into `api/schema/` and opens a pull request, so the new baseline is reviewed
   rather than assumed.

If a `critical` path turns out to have been wrong all along — the plugin reading
a key Garmin never sent — correct `critical` in `endpoints.json` to what is
really there. `tests/api-catalogue.test.ts` checks every `critical` path against
the recorded shape, so a typo there fails offline, on the pull request, without
an account.

## Adding an endpoint to the check

1. Add the wrapper to `src/garmin/endpoints.ts`.
2. In `endpoints.json`, set `plugin`, `check: true`, `critical` and `schema` on
   its entry.
3. Add a probe to `scripts/api/probes.ts` under the same id.
4. `npm run api:record` once to lay down the baseline.

Steps 2 and 3 have to agree: `tests/api-catalogue.test.ts` fails if an endpoint
is marked `check: true` with no probe, or the other way round. The failure it
prevents is silent — an endpoint that is never actually fetched.
