# Shared Hanoi catalogue and daily enrichment

Implemented 1 November 2026 following approval of Hanoi-wide collection across budgets. The serving app remains an interactive-decoupled ChatGPT app. Collection/review operations are private commands, never public MCP tools. Existing demo inventory and seven reviewed minimal research links remain separate from the new private candidate inbox. No candidate becomes an available, approved apartment merely by being crawled or marked `keep`.

## Storage

Supabase has two separate responsibilities:

- `catalogue_*`: source permissions, canonical projects/buildings, staged supplier imports/reviews, offers, price/status observations, evidence and audit events. The existing `Catalogue` and `ProjectEvidence` domain logic is reused through the shared adapter.
- `collection_sources`, `ingestion_runs`, `sale_candidates`, `candidate_observations`, `candidate_reviews`: daily discovery, minimal extracted observations, revision-bound review and operational history.

All tables/functions are service-only with RLS and no anon/authenticated access. No admin routes were added to the unauthenticated app. The worker uploads no titles, post bodies, contacts, author names, replies or photos. Its temporary local SQLite inbox is deleted at the end of the run and never uploaded as a CI artifact. Public CI logs show counts and source access states only. Restricted credentials stay in the service secret stores and ignored local deployment settings.

The reviewed catalogue uses a versioned, atomic snapshot transaction to preserve the current domain rules. Source revocation, building changes, publication decisions, history and withdrawals commit together; stale writers fail and require a reload. Initial limits are 5 MB per snapshot and 10,000 rows per table. This is a bounded first shared implementation, not a citywide-scale database benchmark. Daily candidates use incremental upserts separately. Replace the catalogue snapshot adapter with incremental transactions before these bounds or measured latency become limiting; do not remove bounds silently.

## One-time migration and shared review

```sh
npm run catalogue:migrate
npm run catalogue:migrate -- --apply
CATALOGUE_BACKEND=supabase npm run catalogue -- registry
CATALOGUE_BACKEND=supabase npm run catalogue -- reviews
CATALOGUE_BACKEND=supabase npm run catalogue -- published
```

Migration is dry-run by default and applies only to an empty shared catalogue. It reads the reviewed catalogue, never the forum inbox. It preserves existing IDs, permissions, review decisions and observations. Keep `CATALOGUE_BACKEND` explicit; omitting it retains the local operator workflow. All existing source/project/building/import/approve/reject/withdraw/evidence commands work against the shared store. See [catalogue operations](catalogue-operations.md) for the required evidence and inputs. A shared `keep` decision is only a lead-intake decision; original permitted supplier records still use the reviewed import path.

Hosted real mode is available with `SESSION_BACKEND=supabase INVENTORY_MODE=real`. It reads the shared catalogue per operation, enforces existing source permissions and seven-day confirmation freshness, and never falls back to demo data. The deployed pilot stays in demo mode until qualifying real inventory exists and its separate hosted flow is checked. No new UI resources or tool descriptions are introduced by the data pipeline. Source and area labels do not certify present administrative boundaries, formal completion, title or current availability.

## Daily collection

Workflow: `.github/workflows/data-enrichment.yml`. Scheduled execution is **06:17 Vietnam time** (`17 23 * * *` UTC), with manual dispatch for missed runs. It uses the checked default branch, a 12-minute job timeout, GitHub concurrency and a 15-minute database lease to prevent overlapping workers. Source/request caps remain bounded: default three OTOFUN index pages / twelve opening posts, ten oldest candidate refreshes, and four VOZ thread samples / two posts. Discovery does not apply a buyer budget or a single preferred area. Hanoi geography remains a candidate until reviewed; these samples do not establish complete Hanoi coverage.

Recurring schedule enablement requires all three controls: `HANOI_DAILY_ENABLED=true` repository variable, source `scheduled=true` in Supabase, and `scheduledCollectionEnabled=true` in the feed manifest. Manual dispatch on checked `main` can run a one-off probe while the recurring schedule remains disabled. A DB source toggle is an immediate collection stop. `SUPABASE_URL` is a public repository variable and `SUPABASE_SECRET_KEY` a GitHub Actions secret. The existing private setup file can supply them to local commands; no new manual credential wizard is required.

```sh
npm run pipeline -- collect                 # dry-run plan; no requests/writes
npm run pipeline -- collect --apply         # bounded collection into private inbox
npm run pipeline -- status                  # recent runs; stale after 30 hours
npm run pipeline -- candidates              # first 100 current candidate snapshots
npm run pipeline -- review CANDIDATE_ID FINGERPRINT keep OPERATOR 'Source reviewed; prepare intake'
```

Review decisions are `keep`, `reject`, or `needs-context`, bound to the exact current fingerprint. Changed or expired candidates reject an old review; a new source revision appears pending. Unchanged fetches preserve identity and history rather than generating another price change. The existing parser preserves total-price versus per-m²/monthly expressions and unknown canonical fields. Similar apartments are not automatically merged into one unit. Original posts replace same-thread RSS candidates after exact-post resolution; thread activity never becomes a publication or confirmation date.

An access stop is shared across run phases. HTTP 5xx or a transport failure also stops the publisher for the current run, including both OTOFUN aliases: later candidate refreshes and discovery phases skip that source. Access restrictions and temporary outages remain separate states. Each publisher has an isolated temporary inbox and exception boundary, with a 120-second total runtime budget; healthy sources run first. A slow or broken source cannot abort the remaining sources. Redirects cannot move a source worker to another publisher. Safe transport categories distinguish timeout, DNS, TLS, connection reset/refusal and unreachable-network failures from an unknown network failure. OTOFUN uses a fixed normal Requests Python identity, verified TLS, an 8-second connect/20-second read timeout and bounded decompressed bodies. VOZ retains its previous urllib transport/profile and 20-second timeout. Both validate redirects manually; neither switches profile or retries after an access stop. Environment proxy/netrc credentials are disabled. Source-issued anonymous cookies stay in memory for the run; no browser identities/cookies, authenticated sessions, alternate-host retries, challenge bypass or immediate retries are introduced. Source failures keep previous observations until their expiry and produce a partial/failed run; a missing page does not mark a home sold. Outcome and exit semantics are described below. A crashed worker's lease expires; the next run marks it interrupted. Retry only when the persisted cooldown permits it; never clear an access block to force collection.

Source recovery state lives in Supabase `collection_sources`: `failure_count`, `retry_after`, and `last_success_at`. A failed or partially failed attempt backs off for 15 minutes, then 30 minutes, one hour, doubling to a 24-hour cap. Access blocks wait at least 24 hours; a longer valid HTTP `Retry-After` takes precedence. Runs skip sources before their retry deadline without moving that deadline or increasing the failure count. The first subsequent scheduled/manual run after the deadline makes one bounded recovery attempt; full success clears the failure count and cooldown. There is no separate retry scheduler or immediate retry loop. OTOFUN stays enabled, and VOZ continues while it is unavailable.

| Run outcome | Meaning | CLI / GitHub |
| --- | --- | --- |
| `completed` | All enabled sources succeeded, even if no ads qualified | Exit 0 |
| `partial` | At least one source supplied a usable check; another failed, was blocked, or is cooling down | Exit 0 with a CI warning |
| `deferred` | Every enabled source is cooling down; no source requests made | Exit 0 with a CI warning; remains degraded |
| `failed` | No attempted source was usable, or shared credentials/storage/lease handling failed | Exit nonzero |

A successfully parsed discussion with zero qualifying apartments is still a usable source check. Healthy-source candidate metadata is committed even when another source fails. Existing observations retain their original check/expiry dates during an outage; they are not refreshed or relabelled as available. A source that exceeds its runtime budget loses that attempt's unfinished temporary batch, while previous shared observations and other sources' batches survive. The database finalization remains atomic: shared persistence failures stay fatal.

Use `npm run pipeline:probe -- --source otofun` (or `voz`) for a bounded, read-only access/parser check without credentials or shared writes. It follows the same robots policy, transport, access stops and parser as collection; output contains status/counts/categories, never content or contacts. A nonzero exit means the source could not produce a usable discovery response; do not mask it as healthy. See [the OTOFUN diagnosis](otofun-diagnosis-2026-11-01.md) for external outage evidence and worker-side mitigation.

Install `requirements-crawl.txt` as described in the README; the CI/daily workflows install the same pinned packages. For an exact-page check, add `--thread https://www.otofun.net.vn/threads/can-ho-chung-cu-ecopark-onsen.1968309/`; both the existing extraction logic and BeautifulSoup must agree on the opening-post identity. An expired heading remains expired regardless of a successful fetch. The server-backed app and website expose only the bounded source-link projection described below, not raw inbox records or approved inventory.

Minimal candidate snapshots and observations expire after fourteen days; purge occurs on the next run claim, with read-time expiry filtering. Operational run records expire after sixty days. Candidate history is a source-observation history, not verified supplier price history. The hosted source-link view now reads the latest unexpired daily candidates through a server-only projection. The old reviewed research snapshot supplies historical labels and conservative caveats only; it cannot supply membership, current dates or numeric expressions, or resurrect removed candidates. Manual `research:sync` is optional label maintenance, not the daily publication step. No candidate is converted into approved inventory.

GitHub scheduling is best-effort and public-repository schedules can stop after sixty inactive days. The status command reports `healthy` (latest run completed and recent), `operational` (latest completed/partial and recent), `degraded` (latest is not completed), `latest_outcome`, and `stale` (no completed/partial run within thirty hours). The last usable run is queried independently of the five displayed runs, so repeated failures do not hide it. Run freshness does not establish candidate freshness or present availability. A recent older success can mean `stale: false` while `healthy: false`; freshness alone does not establish pipeline health. This is not an independent alerting service. Inspect per-source `source_states` and `source_diagnostics`: counts of observed records, errors by fixed category, HTTP statuses and network exception categories. Diagnostics exclude URLs, raw error strings, headers and content. A failing source no longer marks a successful source partial. Missing historical diagnostics cannot be reconstructed from the aggregate old summary. No automatic external notifications, contacts with suppliers, paid services or market-wide statistics are introduced.

See [the 1 November pipeline audit](data-pipeline-audit-2026-11-01.md) for the verified storage locations, failed scheduled run and remaining publication gap.

## Validation

Use `npm run check`, `npm run build`, `npm test`, `npm run test:crawl`, `npm run db:test` and `npm run test:hosted`. Database tests cover browser denial, snapshot conflict/rollback, ingestion leases and revision-bound decisions. The synthetic multi-run local HTTP/RPC resilience check verifies healthy-source persistence beside a 503, cooldown skips without deadline drift, recovery reset and all-source deferral without external requests. Actual local Supabase integration also exercises shared operator publication, two cold-start real-mode MCP instances, private-field projection, candidate/history separation, stale decisions and withdrawal cleanup. These fixtures stay in the isolated local stack and never enter cloud inventory.

Record live deployment, scheduled-worker and ChatGPT results separately in [the connection record](chatgpt-connection.md). A live worker source-access probe is required before assuming that GitHub-hosted IPs can reach the forums. The app's existing source-selection/map-comparison host checks do not verify a permissioned real-inventory pilot.

## Sources

[Research and scheduler/runtime references](../research/hanoi-daily-data-enrichment.md). The data/read-tool separation retains [OpenAI tool responsibilities](https://developers.openai.com/plugins/plan/tools) and [MCP structured-result guidance](https://developers.openai.com/plugins/build/mcp-server); the existing [MCP Apps bridge](https://developers.openai.com/plugins/build/chatgpt-ui) is unchanged. Review/publication operations remain outside the model's tool surface.


## Live source-link serving

User instruction on 1 November 2026: push the real collected data to the page. The existing `interactive-decoupled` app now uses one server-side research reader for the landing preview (`GET /api/research/leads`), `/research` and the ChatGPT research tools. Up to 100 latest unexpired candidates are considered; the homepage previews six, with source-expired ads after unverified ads. This is a bounded discovery sample, not complete Hanoi supply. The GET creates no selection session and returns `Cache-Control: no-store`.

Only opening posts with exact allowlisted publisher/thread/post identity and a current fourteen-day retention window enter this projection. Closed/excluded rows and matching rejected revisions are omitted. A new revision may re-enter as unverified. Malformed records are omitted individually. Retained source-expired ads remain explicitly labelled; expired storage records disappear. Missing project labels use a generic publisher/thread label, without inventing a location. Historical labels do not certify the current project identity.

The response is assembled field by field: stable research ID, our label, public original URL, source dates, last read date, bounded numeric expressions and fixed uncertainty flags. No payload spread, numeric canonicalization, post body, image, contact, author, review note, fingerprint or private key reaches a browser/model. Price rates, monthly rates and unspecified totals stay distinct. Quantities may refer to amenities or multiple units, so the UI retains context warnings and numeric matching is unsupported. Service keys stay server-only; browser RLS is unchanged. Database errors show an error, never a static/demo fallback.

The research widget is versioned to `ui://hanoi-home/research-v2.html`. Refresh the ChatGPT app tools/resources and use a fresh conversation after deployment. Standard MCP Apps bridge calls and temporary server-backed selections are retained. The approved catalogue remains empty until its separate intake/permission checks pass.

Design references: [MCP server structured output and stable IDs](https://developers.openai.com/plugins/build/mcp-server), [decoupled data/render integration](https://developers.openai.com/plugins/build/chatgpt-ui), [tool boundaries and annotations](https://developers.openai.com/plugins/plan/tools). The existing split app was extended rather than scaffolded anew; no new model API or OpenAI API key is needed.
