# Direct public-forum crawl

Implemented and run **25 October 2026** after the user clarified that the intended acquisition method is crawling VOZ and OTOFUN directly. The previous outreach drafts remain unsent and are not a prerequisite for this bounded private collection. The crawler does not change publication permissions or put advertisements into the active property catalogue.

## Run and inspect

Requires Python 3 and its standard library; there are no new packages, API keys or forum accounts.

```sh
npm run crawl -- run --max-threads 6 --max-posts 5 --delay 2
npm run crawl -- status
npm run crawl -- review
npm run crawl -- enrich --id otofun:1969040:feed-excerpt --id otofun:1969885:feed-excerpt
npm run crawl -- marketplace --pages 5 --max-threads 20 --delay 2
npm run test:crawl
```

The private inbox is `private-data/forum-crawl.sqlite`, excluded from Git and served by neither HTTP nor MCP. `review` prints up to 100 current records, including redacted source text and extracted candidates. It is an operator command, not a buyer-facing result or verified inventory.

Optional filters: `--sources voz` or `--sources otofun`; repeat `--keyword` to replace the default Hanoi/project matching terms. For example:

```sh
npm run crawl -- run --sources otofun --keyword "Smart City" --keyword "Hà Đông" --max-threads 4
```

The explicit pilot watchlist is also sampled when that source is enabled. Keyword matching is a discovery heuristic, not proof of geography. The sources include non-Hanoi and non-apartment material. Review its project/area before using it.

`marketplace` is a separate bounded acquisition path for apartment ads. It reads 1–5 pages of the configured OTOFUN property-marketplace index and fetches at most 1–20 matching thread opening posts. Index parsing reads only thread-title containers; it ignores profiles, action links and off-source links. Title filtering removes obvious rentals, buyer requests and several non-Hanoi destinations, while retaining geographically unresolved apartment titles for source-body review. It does not assert Hanoi location or apartment availability from a title. No discussion watchlist, latest replies or thread pagination are fetched in this path. Other public/robots/response/rate-limit restrictions remain the same. The summary reports index/title/post counts separately, so observations cannot be mistaken for distinct homes.

## What is collected

The crawler reads the three advertised property-category RSS feeds, filters candidate threads using Hanoi/Northern/project terms, then samples the [pilot watchlist](../../data/evidence-watchlist.json) and feed discoveries. It fetches at most the requested number of HTML threads, with at most an opening page and the latest navigation page per thread. It stores up to the requested number of sampled posts from the final successfully read page. This is a small recent-post sample, not a complete thread archive or a resident survey.

Public RSS `content:encoded` is supported; it contains an excerpt/body even when the `description` tag is absent. Feed records retain **feed activity time** separately and leave the exact post date unknown. HTML records retain the specific post's source date when present, source URL/fragment and stable post ID. Fetch time never becomes a claim date or availability confirmation.

Targeted enrichment accepts one to ten existing, unexpired `--id` values. For RSS candidates it reads the opening thread page and stores only the opening post; for existing HTML posts it reads the recorded page and requires that exact post ID. It never substitutes the latest reply, follows pagination, or infers a withdrawal from a missing page. Requests use the same enabled-source checks, robots policy, rate limits, host/response restrictions and access-stop behavior as the crawler. Successful RSS-to-post links are private provenance and expire with either underlying item. The review queue replaces the excerpt with that linked original instead of creating another apparent apartment lead.

On 30 October, diagnosis reproduced missing OTOFUN dates against actual public listing pages. The cause was literal `HH:MM DD/MM/YYYY` text in `.message-attribution-main`, while the parser only read `<time datetime>`. A minimized attribution-only fixture failed before the fix and passed afterward. The parser now supports that exact date format, preserving `posted_at` as a date and local clock time separately with an unknown source time zone. It never assigns an invented offset and ignores time elements inside post bodies/quotes. Unsupported or invalid date markup stays unknown. Existing records are not silently rewritten: enrich the relevant IDs or collect them again to obtain new dated observations.

Stored text is limited to 4,000 characters per record. Phone/email patterns and user/profile/contact links are redacted; scripts, quotes, signatures and image content are omitted. Author names/accounts and raw HTML/XML are not stored. Pattern redaction is not comprehensive anonymization: human review is still required for incidental personal information and allegations in prose. Each record marks source text as untrusted data.

Extracted asking-price expressions, areas and bedroom counts are **candidates**, with the original text retained. Ambiguous prices stay unknown; numeric interpretations do not establish a total sale price, a specific apartment or a transaction. Sale, rental, mixed sale/rent and buyer requests are distinguished heuristically. Legal status and availability remain unknown. Nothing is auto-published or promoted to the existing reviewed catalogue.

Stable source/thread/post identities prevent duplicate rows. Changed content adds a private observation; a changed RSS activity timestamp alone does not create a content-change event. Quoted material is omitted rather than counted as independent corroboration.

## Access and limits

- Honest user-agent: `NhaHaNoiBot/0.1`, identifying public property-reference research. No browser cookies, credentials, proxies or alternative bot identities.
- HTTPS forum-host allowlist, public thread route checks, bounded responses, redirect validation and same-site navigation discovery.
- Fetch and evaluate each host's current robots rules, merging repeated matching groups and applying specific agent groups/longest path rules. Honor crawl delays; delays beyond the run budget stop collection.
- Default two seconds between requests on a host; CLI delay cannot be less than one second. The crawler does not schedule itself or run in the background after the command completes.
- Stop that host on HTTP 401/403/429 or a detected challenge. Do not bypass, solve challenges or automatically retry access failures. Other accessible sources continue, with errors recorded.
- [Feed candidates](../../data/forum-feed-candidates.json) now enable the user-requested collection; scheduled collection remains disabled. Disabling all feed entries for a source also disables its watchlist sampling. Publication permission remains pending independently of collection.

The first inspection returned a VOZ thread HTTP 403. A later explicit bounded run using the same honest agent received HTTP 200 for its requested pages; no blocked request was retried inside the run and no alternate access identity was used.

Bodies/observations have a rolling 14-day expiry. Expired rows are purged when the database is next opened by the CLI; there is no always-running deletion job. The database file is mode 0600 and its default directory is private. Separately made exports/backups require their own handling. Source removals are not inferred from a failed fetch; remote deletion monitoring is not implemented.

## First live result

The first bounded run sampled six HTML thread candidates after discovering 29 relevant threads. It stored **53 source records**, not 53 homes:

| Measure | Observed |
| --- | ---: |
| VOZ records | 16 |
| OTOFUN records | 37 |
| RSS excerpt records | 29 |
| HTML post records | 24 |
| Community-classified records | 39 |
| Sale-lead hints | 10 |
| Mixed sale/rent hints | 2 |
| Unknown intent | 2 |
| Records containing price candidates | 14 |
| Records containing area candidates | 13 |
| Fetches / HTTP errors in this run | 15 / 0 |

The sampled HTML post dates ranged from 30 September to 24 October 2026. These dates and counts describe this collected convenience sample only. Every record is pending review; there are zero newly published listings or evidence items. RSS/thread records may overlap and are not a count of independent claims or distinct apartments.

Nine crawler tests cover robots matching, route restrictions, access-block handling, redirect validation, HTML/quoted-content parsing, contacts, namespaced RSS, ambiguous prices, deduplication and expiry. The live run additionally verified actual forum structure and retrieval. The ChatGPT app code/UI/resource remain at the previously verified v12; no hosted regression was needed for this private CLI addition.

The later two-item enrichment completed without errors, storing original posts `otofun:1969040:post-73164384` (6 October 2026) and `otofun:1969885:post-73207557` (22 October 2026). The inbox now contains 79 source records, with the two superseded RSS candidates linked to their originals. These are source publication dates, not renewed availability checks. All 27 crawler/review tests passed after the enrichment changes, and both actual pages were successfully parsed by the new command. No raw HTML was retained; the temporary minimized date-reproduction file was removed.

The subsequent marketplace run read five index pages, observed 150 thread-title entries (including possible sticky repeats), selected 21 apartment-title candidates and fetched the first 20 opening posts. All 26 requests, including robots, returned HTTP 200. Twenty observations were added, of which two revised already-known originals with explicit collection-role metadata; the inbox increased by 18 identities to 97 records. It did not produce 20 current Hanoi homes: the source includes expired ads, closed/paused posts, rentals, non-Hanoi projects and ambiguous mixed-property material. Seven ads were retained for follow-up, including the original two, three marked expired, and two requiring tenancy/property/location separation. No listing or evidence was published. All 34 crawler/review tests pass after these changes.

## Publication/edit-date correction and bounded follow-up

Overnight 30–31 October 2026 (Vietnam time), a one-off source check sampled the opening and available final navigation page of each of the seven retained threads: ten public thread pages per pass. In memory, public `data-author` markers were compared to the opening post to select at most three replies by the same visible account. No author marker/name/ID, credentials, profile or raw HTML was stored. The resulting 16 reply records carry `post_role: "thread-starter-update"`, their opening-post key and the limited matching basis. This is not proof of owner identity/authority and is not independent corroboration or 16 new apartments. The review module always routes such updates to context review rather than a separate offer. This was a bounded operator check, not a new scheduled monitoring feature; its temporary script was deleted.

The check exposed a second date defect: Meco's plain attribution header says **12 September 2026**, but the old fallback selected `<time>` from `.message-lastEdit` and reported **14 September** as publication. The minimized real-markup reproduction failed before the fix. Removing only the edit element made the date correct, distinguishing timestamp priority from locale parsing and missing-header hypotheses. The parser now prioritizes publication attribution, excludes edit elements from publication fallback and stores `source_edited_at` separately. Edited content does not supply a price/availability confirmation date. The original reproduction and regression test pass after the fix.

All seven originals and 16 sampled replies were re-fetched/re-parsed after the correction; the inbox now has 113 source identities. Both source-check passes succeeded without errors. Current private snapshots are `lead-source-updates-2026-10-31.json`, `expanded-apartment-review-2026-10-31.json` / `.md` and `lead-assessments-2026-10-31.md`. Older snapshots may contain the Meco publication/edit-date error and remain historical records, not current truth. Other pre-fix records are not automatically repaired; re-fetch relevant IDs before relying on their dates. No text on a reachable source page or thread bump reconfirms availability.

Meco's poster said the apartment was rented in a dated September reply. Recent Samsora/Mỹ Đình replies were activity/discussion, without explicit current availability confirmation. No availability field, source permission, registered building or published listing was upgraded. All 36 crawler/review tests pass. The temporary date reproduction and source-check script were removed; app/UI/ChatGPT configuration was unchanged.

The [crawl-to-review workflow](forum-review-operations.md) now classifies current records into apartment leads, community insight candidates, context checks, exclusions and duplicate excerpts. Start with `npm run review:crawl -- status`. Resolve the actual project/building and price/unit meaning, then selectively prepare records for the existing [listing](catalogue-operations.md) or [project-evidence](project-evidence-operations.md) review workflow. A crawled advertisement or account is not an independently verified listing or official fact.
