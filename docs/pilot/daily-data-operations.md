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

Workflow: `.github/workflows/data-enrichment.yml`. Proposed execution is **06:17 Vietnam time** (`17 23 * * *` UTC), with manual dispatch for missed runs. It uses the checked default branch, a 12-minute job timeout, GitHub concurrency and a 15-minute database lease to prevent overlapping workers. Source/request caps remain bounded: default three OTOFUN index pages / twelve opening posts, ten oldest candidate refreshes, and four VOZ thread samples / two posts. Discovery does not apply a buyer budget or a single preferred area. Hanoi geography remains a candidate until reviewed; these samples do not establish complete Hanoi coverage.

Recurring schedule enablement requires all three controls: `HANOI_DAILY_ENABLED=true` repository variable, source `scheduled=true` in Supabase, and `scheduledCollectionEnabled=true` in the feed manifest. Manual dispatch on checked `main` can run a one-off probe while the recurring schedule remains disabled. A DB source toggle is an immediate collection stop. `SUPABASE_URL` is a public repository variable and `SUPABASE_SECRET_KEY` a GitHub Actions secret. The existing private setup file can supply them to local commands; no new manual credential wizard is required.

```sh
npm run pipeline -- collect                 # dry-run plan; no requests/writes
npm run pipeline -- collect --apply         # bounded collection into private inbox
npm run pipeline -- status                  # recent runs; stale after 30 hours
npm run pipeline -- candidates              # first 100 current candidate snapshots
npm run pipeline -- review CANDIDATE_ID FINGERPRINT keep OPERATOR 'Source reviewed; prepare intake'
```

Review decisions are `keep`, `reject`, or `needs-context`, bound to the exact current fingerprint. Changed or expired candidates reject an old review; a new source revision appears pending. Unchanged fetches preserve identity and history rather than generating another price change. The existing parser preserves total-price versus per-m²/monthly expressions and unknown canonical fields. Similar apartments are not automatically merged into one unit. Original posts replace same-thread RSS candidates after exact-post resolution; thread activity never becomes a publication or confirmation date.

An access stop is shared across run phases. No cookies, browser identities, alternate hosts, challenge bypass or immediate retries are introduced. Source failures keep previous observations until their expiry and produce a partial/failed run; a missing page does not mark a home sold. Failed/partial runs exit nonzero for CI visibility. A crashed worker's lease expires; the next run marks it interrupted. Retrigger after investigating the source state; never clear an access block to force collection.

Minimal candidate snapshots and observations expire after fourteen days; purge occurs on the next run claim, with read-time expiry filtering. Operational run records expire after sixty days. Candidate history is a source-observation history, not verified supplier price history. The separate seven-source public research snapshot still requires its existing manual reviewed sync; daily collection does not overwrite it.

GitHub scheduling is best-effort and public-repository schedules can stop after sixty inactive days. The status command reports `healthy` (latest run completed and recent), `latest_outcome`, and `stale` (no completed/partial run within thirty hours). A recent older success can mean `stale: false` while `healthy: false`; freshness alone does not establish pipeline health. This is not an independent alerting service. Inspect per-source `source_states` and `source_diagnostics`: counts of observed records, errors by fixed category, HTTP statuses and network exception categories. Diagnostics exclude URLs, raw error strings, headers and content. A failing source no longer marks a successful source partial. Missing historical diagnostics cannot be reconstructed from the aggregate old summary. No automatic external notifications, contacts with suppliers, paid services or market-wide statistics are introduced.

See [the 1 November pipeline audit](data-pipeline-audit-2026-11-01.md) for the verified storage locations, failed scheduled run and remaining publication gap.

## Validation

Use `npm run check`, `npm run build`, `npm test`, `npm run test:crawl`, `npm run db:test` and `npm run test:hosted`. Database tests cover browser denial, snapshot conflict/rollback, ingestion leases and revision-bound decisions. Actual local Supabase integration exercises shared operator publication, two cold-start real-mode MCP instances, private-field projection, candidate/history separation, stale decisions and withdrawal cleanup. These fixtures stay in the isolated local stack and never enter cloud inventory.

Record live deployment, scheduled-worker and ChatGPT results separately in [the connection record](chatgpt-connection.md). A live worker source-access probe is required before assuming that GitHub-hosted IPs can reach the forums. The app's existing source-selection/map-comparison host checks do not verify a permissioned real-inventory pilot.

## Sources

[Research and scheduler/runtime references](../research/hanoi-daily-data-enrichment.md). The data/read-tool separation retains [OpenAI tool responsibilities](https://developers.openai.com/plugins/plan/tools) and [MCP structured-result guidance](https://developers.openai.com/plugins/build/mcp-server); the existing [MCP Apps bridge](https://developers.openai.com/plugins/build/chatgpt-ui) is unchanged. Review/publication operations remain outside the model's tool surface.
