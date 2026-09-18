# Architecture

How the plugin is put together, why it is shaped that way, and where to change
things. For the user-facing behaviour it produces, see the
[README](../README.md).

## The two seams

Everything else follows from these.

**1. HTTP is injected.** Nothing in the Garmin logic imports Obsidian. It talks
to an `HttpClient` interface (`src/http.ts`), and the implementation is chosen at
the edge:

| Adapter | Used by | File |
| --- | --- | --- |
| `requestUrl` | the plugin, desktop and mobile | `src/obsidian-http.ts` |
| `fetch` | the Node harness | `src/fetch-http.ts` |
| fixtures | tests | `src/testing/fixture-http.ts` |

So the same auth and API code runs unchanged on a phone, in Node, and against
recorded responses.

**2. The note target is injected.** The sync engine talks to a `NoteTarget`:

```ts
interface NoteTarget {
	exists(date: string): boolean;
	write(date: string, properties: Properties): Promise<WriteOutcome>;
}
```

That is the whole contract. It keeps the engine — dates, budgets, back-off,
partial failures — pure and testable with no Obsidian at all. Adding the
data-folder mode required **no engine change**: it is one more `NoteTarget`, and
"both" is `MultiTarget` wrapping two.

The reason "build `node-garminconnect` first, then consume it" fails is not that
libraries are wrong. It is that a Node library bakes in Node assumptions
(`https`, `tough-cookie`, `axios`) you then cannot remove for a mobile WebView.
Starting transport-agnostic gets you both.

## Module map

```
src/http.ts              HttpClient, CookieJar                — imports nothing
src/log.ts               the Log interface + probe renderer
src/garmin/
  constants.ts           endpoints, client IDs, native headers
  errors.ts              typed failures (Auth / Blocked / RateLimit / Api / Network)
  auth.ts                sign-in: login, MFA, ticket exchange
  tokens.ts              TokenStore, expiry, refresh
  client.ts              authenticated transport: refresh, 401 retry
  endpoints.ts           typed API wrappers (extends client)
src/sync/
  metrics.ts             Garmin payloads → properties     — pure
  diff.ts                the dirty check                  — pure
  bases-view.ts          generates the Bases table view   — pure
  link.ts                the graph hub link               — pure
  engine.ts              orchestration, MultiTarget       — pure
  daily-note.ts          NoteTarget: your daily notes
  data-folder.ts         NoteTarget: one note per day
  frontmatter.ts         shared dirty-checked write
  runner.ts              settings → a run, and reporting
src/dashboard/
  series.ts              rows → series, stats, formatting  — pure
  scales.ts              chart geometry, ticks, paths      — pure
  metrics.ts             what is shown and how it behaves  — pure
  collect.ts             reads days back out of the vault
  view.ts                the Obsidian ItemView, mounts Svelte
src/ui/svelte/           components; none import Obsidian except via an action
src/obsidian-http.ts     requestUrl adapter  — the only Obsidian import in the auth path
src/probe.ts             the four diagnostic probes
src/main.ts              plugin entry, commands, ribbon
```

Modules marked **pure** have no Obsidian import, no network and no clock beyond
what is passed in. That is what makes them directly testable, and it is worth
preserving when adding to them.

## Request flow for one sync

```
runner.ts        reads settings → builds SyncOptions, picks the NoteTarget(s)
   │
engine.ts        walks the range NEWEST → OLDEST
   │               ├─ target.exists(date)?  no, and not creating → skip, no request
   │               ├─ endpointsFor(groups) → only the calls this config needs
   │               ├─ per-day calls: summary, sleep, hrv, readiness, endurance
   │               └─ range calls (once for the whole window): maxMetrics,
   │                  racePredictions, activities
   │
metrics.ts       mapDay(payloads) → canonical properties     (pure)
   │
link.ts          withLink() adds the graph hub property      (pure)
   │
frontmatter.ts   diff against existing frontmatter
   │               └─ nothing would change → "unchanged", file untouched
   │
target.write()   data-folder note, daily note, or both
```

Two details in there carry real weight:

- **`exists()` is consulted before any request.** A day with nowhere to go costs
  nothing, which is what makes a sparse daily-notes range cheap.
- **Range endpoints are called once for the window, not once per day.**
  `maxMetrics`, `racePredictions` and the activity list all take a range or page,
  so the request budget is roughly *groups needed × days with notes*, plus a
  small constant.

## Error taxonomy

`src/garmin/errors.ts`. The distinction that matters most is **Blocked vs Auth**:
Garmin's edge can refuse a request outright, and burying that under a generic
"sync failed" sends users hunting for a password problem they do not have.

| Error | Means | Engine response |
| --- | --- | --- |
| `GarminAuthError` | Bad credentials, or a session past refreshing | Abandon the range |
| `GarminBlockedError` | The edge refused the client (bot challenge) | Abandon the range |
| `GarminRateLimitError` | HTTP 429, carries `retryAfter` | Abandon the range |
| `GarminApiError` | An ordinary non-2xx from the API tier | Warn, keep the day |
| `GarminNetworkError` | Never completed: offline, DNS, TLS | Warn, keep the day |
| `GarminMfaRequiredError` | MFA demanded, and the caller passed no prompt | Sign-in only |
| `GarminMfaCancelledError` | The person closed the code prompt | Sign-in only |

The rule: a failure that would repeat identically on every later request
abandons the whole range. A single endpoint failing for a single day is a
warning, and the rest of that day still gets written.

**403 is triaged.** A JSON 403 is the API declining; a non-JSON 403 is the edge
declining. Different problems, different errors.

## What the client does for you

`src/garmin/client.ts`:

- **Refreshes ahead of expiry** with a five-minute margin, reading `expires_in`
  from the response rather than assuming a lifetime. Observed values have ranged
  from 66,341 s to 97,344 s, so assuming is not safe.
- **One refresh for concurrent callers.** A day touching four endpoints at once
  triggers a single token exchange, not four.
- **401 → refresh once → retry once**, then give up. If a concurrent request
  already refreshed past the token that failed, the retry uses theirs.
- **Persists rotation.** Garmin may hand back a new refresh token on use;
  dropping it strands the session days later for no visible reason.
- **A failed re-login leaves a working session alone.** A 429 while signing in
  again should not sign you out of the session you had.

## Two things a port must get right

- **`requestUrl` throws on status ≥ 400** unless you pass `throw: false` — and a
  403 body is exactly what you need when diagnosing a challenge.
- **`requestUrl` keeps no cookie jar**, and its `headers` is
  `Record<string, string>`, so multiple `Set-Cookie` values arrive comma-joined.
  Cookie expiry dates contain commas too, so `splitSetCookie` splits only on a
  comma followed by a `token=`.

## Extending

### Add a metric

1. Add the field to the payload interface in `src/garmin/endpoints.ts`.
2. Map it in `mapDay` in `src/sync/metrics.ts`, using `metric()` so negative
   sentinels are dropped.
3. Add the key to `byGroup` in `keysFor`, in display order.
4. Add a label to `METRIC_LABELS`, or the column header falls back to the raw key.
5. If the value is a duration in seconds, add it to `DURATION_KEYS`.
6. Add a test in `tests/metrics.test.ts`.
7. Update [docs/properties.md](properties.md).

### Add a metric group

As above, plus a new member of `MetricGroup` and `ALL_GROUPS`, and an entry in
`endpointsFor()` so the request is only made when the group is on.

### Add a storage target

Implement `NoteTarget` — two methods — and wire it in `runner.ts`. The engine
needs no change. `src/sync/data-folder.ts` is the smaller of the two existing
examples.

### Add a chart

The dashboard components import nothing from Obsidian, which is what lets
`npm run preview:dashboard` mount the real `Dashboard.svelte` in a plain browser
with synthetic data. Charts are hand-drawn SVG — no chart library, because a
plugin cannot load external scripts and a bundled library would be dead weight
on a phone.

Conventions worth keeping: no dual-axis charts (two scales get two charts);
colour never carries meaning alone; ordered scales get an ordinal ramp of one
hue rather than categorical colours; deltas know which direction is good.

## Testing

Tests bundle with esbuild and run on Node's built-in runner — no network, no
Obsidian. `FixtureHttpClient` replays canned responses in order, which is how
sequences like "401, then refresh, then success" and "first DI client ID
rejected, second accepted" are expressed.

Nothing of ours is mocked. The fixtures sit at the **transport** seam and the
engine's doubles sit at the **note-target** seam, so what is under test is the
real code. That is the payoff from the two seams.

```bash
npm test                   # the suite, no network
npm run build              # typecheck → svelte-check → tests → bundle → mobile check
npm run preview:dashboard  # real Dashboard.svelte in a browser, synthetic data
npm run probe:node         # the real auth module under Node, step 0 only
```

`npm run build` fails if a node or electron require reaches the bundle. Keep
that in CI — it is what backs `isDesktopOnly: false`.
