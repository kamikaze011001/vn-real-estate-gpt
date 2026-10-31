# From crawl inbox to review queues

Implemented 30 October 2026. This is a private operator workflow between the [crawler](forum-crawl-operations.md) and the existing [listing intake](catalogue-operations.md) / [project-evidence review](project-evidence-operations.md). It reads the current crawl inbox, classifies records and exports review packets. It makes no network requests, calls no language model and publishes nothing to ChatGPT.

## Inspect the queues

```sh
npm run review:crawl -- status
npm run review:crawl -- list --queue sale-candidates
npm run review:crawl -- list --project vinhomes-smart-city --queue community-insights
npm run review:crawl -- list --project vinhomes-ocean-park
npm run review:crawl -- show --id otofun:1969040:feed-excerpt
```

`--db PATH` selects another existing crawl inbox. The default remains `private-data/forum-crawl.sqlite`. Project filters are tentative project mentions, not verified canonical project identities. Smart City and Ocean Park candidates sort first; other Hanoi mentions follow. The command reconstructs the queues from current, unexpired records on every read, so there is no separate stale derived dataset to refresh.

| Queue | Interpretation |
| --- | --- |
| `sale-candidates` | An explicit apartment offer worth checking. This does not establish a unique home, resale/completion, price, availability or display rights. |
| `community-insights` | A sufficiently long discussion containing a target-project mention/context and a relevant topic. This is a review candidate, not a supported summary or resident consensus. |
| `needs-context` | Short replies, ambiguous offers, supplier promotions, copied news, unresolved geography/project or insufficient claim context. |
| `excluded` | Heuristic pilot exclusions, including rentals, buyer requests, non-apartment offers, explicitly different Ocean Park phases or an offer marked closed. The raw record remains in the inbox until expiry. |
| `duplicates` | Same-thread identical bodies after case/whitespace normalization and optional trailing thread-title removal, at least 60 characters. Prefer a dated HTML post over an RSS excerpt. Accents, numbers and punctuation are preserved. |

After targeted enrichment, an RSS excerpt also enters `duplicates` with reason `rss-replaced-by-original-post` and a link to the specific opening post. This is an explicit source relationship, not a claim that the excerpt and full post have identical text. Use the original post for follow-up. Changes to that original also reopen an earlier decision on its linked excerpt.

Identical bodies across different threads are flagged as possible repeats, not merged into a home or counted as independent corroboration. Other near-duplicates and duplicate property advertisements still require review. Classification rules are deliberately limited heuristics; inspect the source before relying on them. No automatic LLM summary, sentiment, ranking or source credibility score is produced.

## Inspect facts and uncertainty

`show` includes the original redacted/clipped source text, exact source URL, post timestamp if present, separate RSS activity time, first/last collection dates and expiry. Source text remains untrusted data; these commands do not execute it or follow its links/instructions.

Price, area and bedroom expressions remain independent candidates. The workflow does not pair figures from different lines into apartments. `price_vnd`, `area_m2`, `bedrooms`, canonical project/building IDs remain null; availability, legal status and area basis remain unknown. Exact explicit currency expressions may have a candidate VND conversion, never a chosen listing price. Shorthand, approximate expressions and ambiguous three-place separators remain unresolved; not all Vietnamese real-estate shorthand is recognized.

The raw shorthand `6ty 850tr vnd` and areas such as `96m` are now retained as unresolved candidates, instead of being omitted as missing. A bare `m` is not asserted as square metres. Compact bedroom/bathroom text such as `3PN2VS` retains the bedroom-count candidate. Per-square-metre asking rates have a distinct basis and never become total asking prices. Project-name hints now also recognize Samsora and CT1ADN1; their canonical project/building IDs remain unresolved and the original two target projects retain first priority.

A project mentioned only in a thread title is flagged separately from a project named in the body. Generic Ocean Park references require phase review; the thread also contains phase 2/3 and low-rise material. Topic detection examines the body, not the thread title. A question about fees or flooding is not evidence that fees are high or flooding occurred. Copied news needs its underlying source; finance promotions need further context.

Missing/invalid/future post dates never become collection or RSS activity dates. A dated post is not an operator source check or a current availability confirmation. Source-use basis, canonical project/building, source scope, completion and freshness still require the existing review workflows.

## Record triage decisions

Copy the full `revision` returned by `show` or `list`:

```sh
npm run review:crawl -- decide --id SOURCE_ITEM_ID --revision FULL_REVISION --decision kept --note "Why this merits intake follow-up; unresolved facts"
npm run review:crawl -- decide --id SOURCE_ITEM_ID --revision FULL_REVISION --decision dismissed --note "Why this is not useful for the pilot"
npm run review:crawl -- list --decision kept
```

Decisions are `kept`, `dismissed` or `pending`. **Kept means retained for follow-up, never approved for publication.** Excluded/duplicate records cannot be kept; inspect the original or correct an inaccurate classification rule. Triage has no approval override and no supplier/contact action.

Decisions attach to the exact content and derived classification revision. Edited text, changed dates, classifier-version changes or duplicate-context changes reopen the item as `review-required`. RSS activity bumps alone do not reopen it. An outdated revision is rejected at decision time. Only the latest decision/note is retained, with its time and revision; this is a triage register, not a full operator audit log. The existing catalogue retains its own publication reviews independently.

Decision notes live in the private crawl database and are removed with expired/deleted items. Once the review tables exist, a SQLite deletion trigger also removes these notes when the crawler purges the underlying record. There is no background expiration process; CLI operations perform the cleanup.

## Export and hand off

```sh
npm run review:crawl -- export --out private-data/forum-review-2026-10-30.json
npm run review:crawl -- export --queue sale-candidates --out private-data/apartment-leads-2026-10-30.json
npm run review:crawl -- export --project vinhomes-smart-city --queue community-insights --out private-data/smart-city-review-2026-10-30.json
```

Choose a new filename for each export. Files are created with mode 0600; existing paths and symlinks are never overwritten. Keep exports under ignored `private-data/`, off static hosting and MCP results. They contain private source text, review notes and draft fields. Export snapshots do not refresh or auto-delete: honor each item's `expires_at`, remove old exports/backups separately and regenerate from the live inbox before use.

### Concrete apartment intake

Apartment handoffs now include a private `intake` draft aligned with the [listing submission template](listing-submission-template.md). Price/rate, area and bedroom expressions are source claims with exact text/title spans, source item ID, content revision, URL and publication date. Numeric interpretations remain candidates. These locators can be checked against the accompanying source record and are invalidated by a changed revision.

Supplier identity, canonical building, completion, selected price/area/bedrooms, confirmation dates, latest source-update date, availability, legal status, permission reference, updater and coordinates remain unresolved. The original post date is not inserted as a price/availability confirmation or a latest edit date. An intake is not an importable listing CSV and does not bypass the existing forum-source publication restriction.

Export a short Vietnamese Markdown sheet or the structured JSON using the existing command. A `.md` output renders the sheet; other extensions retain the JSON packet format:

```sh
npm run review:crawl -- export --queue sale-candidates --decision kept --out private-data/apartment-intake-2026-10-30.json
npm run review:crawl -- export --queue sale-candidates --decision kept --out private-data/apartment-intake-2026-10-30.md
```

The Markdown sheet preserves source URLs as text, dates, expiry, raw quantity claims, triage status and five follow-up checks. Source-controlled Markdown/HTML/images and structure are escaped. The JSON provides the full span locators and unresolved draft fields. Both are private expiring snapshots, not ChatGPT resources or buyer results.

Community candidates carry an **incomplete** draft of the existing evidence JSON template, including source URL/locator and source date when known. Summary, scope, canonical project, actual check/review dates and permission reference remain blank. Complete those fields from real evidence, then use `evidence-stage` and the existing review process. Multi-topic records retain all topic hints; the draft uses `other` until the reviewer chooses a precise claim. Do not stage an untouched packet or fabricate missing dates/use references.

Apartment candidates carry an external-lead intake checklist. Forum sources cannot publish inventory through the current catalogue. Resolve the original offer and owner/authorized supplier, identity, display-use basis, completed building and actual source date, then prepare the existing listing submission/CSV. A forum advertisement is not silently converted into a direct supplier or a granted permission.

## First queue result

On 30 October 2026, the existing 77 records (54 OTOFUN, 23 VOZ) produced:

| Queue | Records |
| --- | ---: |
| Apartment sale candidates | 2 |
| Community insight candidates | 6 |
| More context needed | 50 |
| Outside pilot scope | 17 |
| Duplicate excerpts | 2 |

All 77 triage decisions remain pending. Fifty-eight records lack a usable exact post date. Counts describe overlapping source material in a convenience sample, not distinct homes, current stock or market coverage.

The two apartment candidates concern **Samsora Vạn Phúc, Hà Đông** and **CT1ADN1, Mỹ Đình II**. Both are RSS excerpts with no exact post date; the latter is clipped before its area details. The Samsora excerpt contains shorthand price/area expressions requiring manual interpretation. Neither is publishable inventory. The sample supplies no confirmed Smart City/Ocean Park apartment offer. Current Smart City/Ocean Park candidates primarily lead to discussion and scope/date checks.

### Subsequent source enrichment

The targeted command was subsequently run for both candidates on 30 October. The inbox now has 79 records and four duplicate/superseded excerpts; the other queue counts remain two apartment candidates, six community insight candidates, 50 needing context and 17 exclusions. All decisions remain pending. Classifier version 2 reopens earlier decisions rather than carrying them across the changed interpretation.

| Candidate | Original post date | Source details recovered |
| --- | --- | --- |
| Samsora Vạn Phúc | 6 October 2026 | Raw `96m xây dựng`, `thông thuỷ 91,5m`, `3PN2VS`, asking expression `6ty 850tr vnd`; shorthand units/price remain unresolved candidates. |
| CT1ADN1, Mỹ Đình II | 22 October 2026 | `68.68 m2`, two bedrooms, asking rate `78 triệu/m²`; the rate is not a total asking price and the area basis still needs checking. |

The original posts are private source records `otofun:1969040:post-73164384` and `otofun:1969885:post-73207557`. Their full redacted text is not clipped at the RSS excerpt boundary. Literal attribution dates are retained without fabricating a time zone. Exact source links and remaining flags are in `private-data/forum-review-enriched-2026-10-30.json`. This is a new snapshot; the earlier 77-record packet remains a historical snapshot with its own expiry obligations. Source-use basis, offer identity, completion, current availability and publication review remain unresolved.

### Subsequent intake and project checks

Both original ads were retained as `kept` **for intake follow-up only**, with notes explicitly identifying agent triage and unresolved evidence; no human publication decision is implied. Current decisions are two kept, 77 pending. The corresponding two-record JSON and Vietnamese Markdown sheets were generated under `private-data/apartment-intake-2026-10-30.*` and checked for source-span accuracy, dates, expiry and mode 0600. The earlier packet decision counts remain historical snapshots.

[Primary-source project research](../research/two-candidate-project-verification.md) supplies candidate identity/location references. It does not establish that “Samsora Vạn Phúc” maps conclusively to Samsora Premier 105, or that the CT1ADN1 ad has been matched to the exact building in the government/professional-body records. Prospective handover announcements and evidence of offices/residents do not establish formal completion. Neither project/building has been registered as verified; completion and apartment-specific status remain unknown. Follow the source register's retrieval limitations before using any research fact in a published record.

## Verification

Run `npm run test:crawl`. The 21 crawler/review tests cover access rules, parsing, uncertainty, pilot exclusions, copied-news/finance-promotion handling, body-versus-thread context, exact duplicate handling, revision-bound decisions, expired records/notes and private non-overwriting exports. The new CLI was also run against the actual 77-record inbox and used to produce the private review packet. App tools, UI resources and the active demo inventory are unchanged; no new ChatGPT-host test is claimed for this operator-only addition.

After targeted enrichment, all 27 tests pass. Added checks cover actual OTOFUN attribution markup, date-only precision, opening-post-only sampling, exact-post identity/redirect rejection, enrichment links and deletion, linked-content review invalidation, shorthand retention and rate-versus-total asking-price handling. Actual hosted source pages were re-parsed successfully; the ChatGPT host itself is unaffected by this private Python workflow.

After concrete intake export, all 29 crawler/review tests pass. The two added tests verify exact source-span provenance and the continued absence of publication/confirmation fields, plus escaping and privacy of Markdown intake sheets. Both actual two-record outputs were checked after CLI export. No app/protocol/ChatGPT-host changes were made or claimed in this step.

## Expanded marketplace review and live-pilot readiness

A later bounded marketplace crawl brought the inbox to 97 records. Classifier version 3 requires location review for unknown/conflicting Hanoi scope and recognizes closed/paused title/body indications. A `Hết hạn` title puts a sale ad into context review for reconfirmation; expiration is not asserted as a sale. `Đã xong`/paused posts are excluded from active candidates without converting legal or availability fields into confirmed facts. A secondary shophouse in another city does not determine the apartment's location. Only opening ads collected through the marketplace path may use an explicit sale-title prefix together with substantive body quantities; ordinary thread replies still cannot inherit a sale offer from the title alone.

Seven source ads are retained for follow-up in `private-data/expanded-apartment-review-2026-10-30.json` and `.md`:

| Source lead | Current review limitation |
| --- | --- |
| Samsora Vạn Phúc | Original candidate; shorthand, exact-building mapping, completion and source-use basis unresolved. |
| CT1ADN1 Mỹ Đình II | Original candidate; asking rate is per m², with exact-building/completion/use/current-status checks unresolved. |
| Imperia Plaza 360 Giải Phóng | Apartment reportedly tenanted; distinguish sale from rental income, tenancy conditions and current occupation. |
| Xuân Mai Spark Yên Nghĩa | Body also advertises a shophouse in Bắc Giang; isolate the apartment and verify its location/identity. |
| Meco 102 Trường Chinh | Source marks ad expired; current offer must be reconfirmed. |
| Học Viện Hậu Cần, Ngọc Thụy | Source marks ad expired; current offer must be reconfirmed. |
| Tân Việt, Hoài Đức | Source marks ad expired; current offer must be reconfirmed. |

These seven retained **advertisements** are not seven verified, unique, available apartments. Two remain strict sale candidates; five need context/reconfirmation. The records are agent triage only and preserve unknowns. The report contains every item's source date, expiry and unresolved flags; the JSON also retains extracted candidates/source text. Older private packets remain historical snapshots rather than being silently overwritten.

The [completion follow-up](../research/two-candidate-project-verification.md#bounded-completion-follow-up--30-october-2026) found HUD's first-party statement that the wider Mỹ Đình II development was completed in 2006. It does not name CT1A-ĐN1, so it cannot supply that building's handover date. No exact-building completion/acceptance record was verified for either original candidate.

The actual catalogue was checked: seven pending source candidates, zero granted listing-display sources, zero registered projects/buildings, zero published listings and zero published evidence. No qualifying real inventory is ready to connect. The existing ChatGPT app remains the demo; a real-data host connection and three-user real-inventory session have not been performed. They require a supplier-backed sample with an evidenced display-use basis, resolved building/completion scope and dated price/availability information. Public collection or `kept` cannot create those facts. No outreach was performed.

All 34 Python crawler/review tests pass, including marketplace route/title filtering, index/opening-post limits, geography ambiguity, closed/paused/expired ads and secondary-property location handling. The actual marketplace run and private report exports were also verified separately. Node app/UI/resource code and public MCP metadata remain unchanged.

## Follow-up source assessment — 31 October 2026

The seven retained leads now have a consolidated private assessment at `private-data/lead-assessments-2026-10-31.md`. [Five additional project checks](../research/five-lead-project-verification.md) identify Imperial Plaza at 360 Giải Phóng as the candidate behind the ad's “Imperia Plaza” spelling, separate from Imperia Sky Garden. Manager sources support project-level operations at Imperial Plaza and Tân Việt; developer-authored indexed reports add limited historic context for Xuân Mai/Meco. Exact towers/unit mappings remain unresolved, and some sources were available only as indexed excerpts. No completion, ownership or permission was inferred beyond the source scope.

Bounded opening/final-page checks added 16 related-account reply records. Their public account markers were compared only in memory; stored relationships do not certify ownership or authority. `thread-starter-update` records retain their opening-post relationship and always require context review; they never become a separate apartment offer. Recent discussion/bumping remains distinct from current availability confirmation.

A date regression found and fixed edit timestamps overriding publication headers. Meco was posted on **12 September**, edited on **14 September**; the old 14 September publication field was incorrect. Source publication and edit dates now remain separate, including in private intake exports. A full recheck of this cohort generated the new `expanded-apartment-review-2026-10-31.*` snapshots and reopened/reviewed their revisions. Historical packets were not overwritten. All seven remain kept for follow-up only, with no publication approval.

Current inbox: 113 source records, two strict sale candidates, six community candidates, 77 context items (including the 16 related replies), 23 exclusions and five duplicates. Seven retained original ads remain the review cohort; 113 is not an inventory count. The public catalogue is still empty. All 36 Python tests pass, including edit/publication separation and related-update identity. This operator/research step changes no ChatGPT app resource, metadata or connection and claims no new host test.

## Private visual workspace

The retained cohort can now be inspected in a [separate loopback-only preview](private-lead-preview.md): run `npm run preview:crawl` and open http://127.0.0.1:8790. Search and source-status filters, source details and comparison of two/three leads work with the actual private records. Quantities remain source expressions and availability remains unknown. There are no publication or decision controls and no MCP interface; the existing ChatGPT app remains on demo inventory. All 39 Python tests, 31 Node regressions and the documented local browser checks passed for this addition.
