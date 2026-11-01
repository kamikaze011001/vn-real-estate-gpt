# Data pipeline audit — 1 November 2026

The user saw demo apartments on Vercel and asked where the collected data was. Live Supabase and GitHub checks confirm that collection storage exists, but the public property search is still configured for demo inventory. Daily candidate collection and public research publication are separate paths.

## Verified storage before the diagnostic rerun

| Location | Count | Meaning |
| --- | ---: | --- |
| Local `private-data/forum-crawl.sqlite`, `item` | 113 | Captured source identities, including excerpts/posts/discussions; not 113 apartments |
| Same local DB, `observation` | 138 | Historical captured content revisions |
| Supabase `sale_candidates` | 7 | Unexpired OTOFUN candidate records: 2 `sale-candidates`, 5 `needs-context` |
| Supabase `candidate_observations` | 7 | Minimal candidate revisions |
| Supabase `candidate_reviews` | 0 | No shared candidate decisions yet; local review decisions are separate |
| Supabase `research_sources` | 7 | Manually curated public research summaries, independently synchronized |
| Supabase `catalogue_listing_offer` | 0 | No approved real inventory |
| Supabase `catalogue_project` / `catalogue_building` | 0 / 0 | No registered canonical project/building records |

The seven daily candidates were checked on 1 November at approximately 02:49–02:50 Vietnam time and expire on 15 November at approximately the same time unless successfully refreshed. The raw local inbox and the minimal shared candidate inbox have different retention/projection rules; the shared count is not expected to equal the local raw count. CI uses an ephemeral raw inbox that is deleted after each run. No raw bodies, contacts, replies or photos are uploaded by the daily worker.

## Workflow and reproduction

- All three scheduling gates are enabled: repository variable `HANOI_DAILY_ENABLED=true`, both Supabase source switches, and the feed manifest flags.
- [Initial manual run](https://github.com/kamikaze011001/vn-real-estate-gpt/actions/runs/41236009948): completed, 20 requests, 7 candidates, zero source errors.
- [First scheduled run](https://github.com/kamikaze011001/vn-real-estate-gpt/actions/runs/41264232890): failed, 13 requests, 8 source errors, zero candidate updates. Started at 09:12 Vietnam time despite the 06:17 requested schedule; GitHub scheduling is best effort.
- Reproduction: `npm run pipeline -- status` returned the failed latest run with `stale: false`. The old status only measured age since an older successful/partial run; it did not mean the latest run was healthy.
- A bounded local probe using the existing robots-aware `Fetcher` returned HTTP 503 from OTOFUN's `robots.txt`, preventing collection. VOZ's robots/feed returned HTTP 200 and its feed parsed 20 entries. This establishes the current local access obstacle, not the exact historical cause on GitHub: the old run discarded error details when deleting its temporary inbox.

## Corrected diagnostics

The worker now retains only safe aggregate diagnostics per source: fixed error categories, HTTP status counts, bounded network exception categories and observed-record counts. Source states use that source's own errors and observations. `status` explicitly exposes `healthy` and `latest_outcome` separately from `stale`. Collection bounds, source access controls, publication decisions, retention and the public app mode are unchanged.

Regression tests first reproduced the cross-source reporting error and missing health indicator, then passed with the fixes. The full Python suite passes (47 tests); its preview-server check requires loopback permission locally.

## Serving gap

```text
VOZ / OTOFUN
  → ephemeral private crawler inbox
  → Supabase sale_candidates + candidate_observations
  → private, revision-bound review (no shared decisions yet)
  → no automatic public publication

Reviewed minimal source summaries
  → manual research:sync
  → Supabase research_sources
  → /research and ChatGPT research tools

Approved supplier catalogue (currently empty)
  → real-mode property search (not enabled)
Demo fixtures
  → current property search /demo
```

[Live deployment health](https://vn-real-estate-gpt.vercel.app/health) reports `mode: demo`; [public research](https://vn-real-estate-gpt.vercel.app/research) is a separate surface. Switching to real mode now would return an empty approved catalogue. Making reviewed real source leads the main buyer entry point remains an unfinished product integration, independent of fixing collection diagnostics.
