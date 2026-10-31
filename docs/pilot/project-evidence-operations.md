# Reviewing official and community evidence

Implemented 25 October 2026. This adds manually reviewed project context to the existing vanilla widget and data/render tools. A separate [public crawler](forum-crawl-operations.md) and [private triage workflow](forum-review-operations.md) now supply unverified candidates; they do not auto-publish evidence. No forum login or secured forum reuse arrangement is supplied. No real forum summary or official-market claim is supplied with the repository. The normal catalogue still has no real listings or published evidence.

## Source discovery and permission

```sh
npm run catalogue -- evidence-watchlist
```

The [internal watchlist](../../data/evidence-watchlist.json) contains three starting threads from the [forum research](../research/forum-real-estate-sources.md): VOZ's Northern-property index, OTOFUN Smart City, and OTOFUN Ocean Park. These are discovery references, not available apartments, verified project assessments, or publication approvals. Choose projects from the pilot users' actual searches first; a broad thread opening page is not evidence for a current building-specific claim.

Use the existing private source register. Publication requires:

- Source `kind: "forum"` for community material, or `kind: "official"` for official material.
- `permission: "granted"`, a private permission reference, and both `reference-display` and `summary` in `allowedUses`. These record a reviewed basis for the intended uses; filling a field does not obtain rights. Check contributor rights as well as any operator arrangement.
- A canonical source URL, with the evidence URL on the same publisher hostname. `www` aliases and OTOFUN `.net`/`.net.vn` are normalized. A different official attachment/CDN publisher needs its own reviewed source registration.
- A separate per-item `permissionReference` identifying the allowed source material and intended summary/reference use. Do not import images, profiles, personal contact details or private messages.

Pending references can be staged after the source is registered, but cannot be approved until the source and item checks pass. A reference-only publication mode without a summary is not implemented; unresolved sources remain internal discovery items. No account creation, supplier contact or forum outreach is performed by these commands.

## Prepare a source record

Copy the intentionally blank [JSON template](../../data/evidence-template.json) to `private-data/`. Complete it using the original source and private review evidence:

| Field | Meaning |
| --- | --- |
| `sourceId` | Existing official/forum source ID. |
| `sourceRecordId` | Stable opaque key for this specific claim/reference, scoped to the source. Letters, numbers, hyphens and underscores only; do not embed personal details. Updates with the same key preserve the public evidence ID. |
| `projectId`, `buildingId` | Canonical project and optional exact building. A building must belong to that project. A null building permits project-level applicability; choose it only when the source supports that scope. |
| `kind`, `topic` | `official` or `community`; topic is one of `parking`, `management`, `fees`, `noise`, `elevators`, `access`, `infrastructure`, `legal`, `market`, `other`. |
| `verification` | `documented`, `unverified`, or `disputed`. Community accounts cannot use `documented`. Official provenance is still not title certification or an independent check of every underlying claim. |
| `summary` | An appropriately permitted, narrowly scoped summary, at most 1,200 characters. Keep uncertainty, competing accounts and disclosed commercial interests. Do not turn an allegation into a factual building field. |
| `question` | A concrete question to ask during research/viewing, at most 400 characters. Avoid accusations about identifiable people. |
| `sourceScope` | The source's actual geographic/building/sample scope, distinct from the project to which the app attaches the reference. Citywide reports remain citywide context. |
| `reportingPeriod` | Reporting period if applicable; required for official `market` records. Separate from publication/retrieval dates. Otherwise null. |
| `sourceUrl`, `sourceLocator` | Public HTTP(S) URL without credentials, plus the exact post ID, report page, section or table. Identify a specific dated community post, not just the thread's opening/index page. |
| `sourcePublishedAt`, `sourceEditedAt` | Actual publication and optional known edit date. Never substitute thread creation or search-cache dates. |
| `checkedAt`, `reviewDueAt` | Actual operator check and next review deadline. Publication ≤ edit (if known) ≤ check ≤ deadline. Check cannot be future-dated; overdue references cannot be approved/served. Community references need review within seven days. |
| `permissionReference` | Internal evidence of permitted use for this item; never sent to the widget/model. |

Dates use valid `YYYY-MM-DD`. The template deliberately fails validation until filled. Keep historical opinions visibly historical. If the exact project, building, claim date, source location or use basis is unknown, resolve it before publication. Human review, not the schema, determines whether a statement is supported, corroborated, defamatory, private or overbroad.

For contrasting accounts, create separate sourced items and label uncertainty/disputes; there is no sentiment vote, credibility score, resident consensus or project ranking. Copied news and repeated quotations are one underlying source. Official reports retain their period/geography; asking prices, transactions, completed projects and planned infrastructure remain distinct in the wording.

## Stage, review and withdraw

```sh
npm run catalogue -- evidence-stage private-data/evidence.json operator-name
npm run catalogue -- evidence-reviews
npm run catalogue -- evidence-approve REVIEW_ID reviewer-name "Exact source, permitted use, wording, dates and scope checked"
npm run catalogue -- evidence-reject REVIEW_ID reviewer-name "Reason for rejection"
npm run catalogue -- evidence-published
npm run catalogue -- evidence-withdraw EVIDENCE_ID operator-name "Source removed or permission withdrawn"
```

Staging validates structure and records a pending item. `evidence-reviews` recalculates permission/date/scope errors against the current registry. Identical normalized JSON returns the existing review; it never duplicates publication or reverses a decision. Corrected or freshly checked input creates a new review revision. Only approval replaces a published revision. Older publication/check/edit dates cannot roll back a newer approved revision. Prior review payloads and decisions remain private audit records.

Expired review deadlines or source permissions remove items from serving. Source revocation/restriction unpublishes affected items; restoring the grant does not silently republish. Withdrawal also rejects already queued pending revisions for that evidence ID. A new review is needed to publish again. Project/building registry changes unpublish affected evidence for another applicability review.

The operator must notice edits, removals and corrections during source review; the app does not monitor remote pages. An unavailable source is not proof of a sale or a resolved concern. Withdrawal suppresses serving, not permanent erasure of private reviews/backups. Apply the retention/deletion arrangements in [catalogue operations](catalogue-operations.md).

Schema version 2 adds evidence tables alongside existing listing/source records. This is an additive local migration; newer unsupported versions are rejected. Stop app/operator commands and take a private backup before changing a nonempty supplier database.

## App and ChatGPT behavior

Details show **Thông tin dự án** and **Góc nhìn cộng đồng**, with topic, source link/locator, publication/edit/check/review dates, verification label, source scope and viewing question. The matching project/building is labeled separately from the source's geography. Comparison offers a collapsible source section per selected home. Missing approved material is explicit; no forum concern or official fact is invented for demo homes.

`get_project_evidence({ listingId })` is a read-only data tool with a declared output schema. Resolve “this home” through explorer context and cite evidence URLs/dates/scope. Community text is not a verified fact. Property lookup, comparison and focused/selected explorer context carry the same projections. Selection writes return context so opening a card does not need another UI or a document-search workflow.

**Cần xác minh gì?** requests current project sources for the captured homes, with links, dates and uncertainty, preserving the homes and requirements at the time of asking. The prompt contains no copied external text. Source text is untrusted data; the importer never executes it or follows embedded instructions.

Permission references, operator identities/notes, fingerprints and raw reviews are excluded from public results. There are no model-callable evidence approval, withdrawal, source-register or watchlist actions. Active expanded explorers notice evidence changes/removals through context revision polling; inactive/history widgets and conversation text remain snapshots.

The architecture follows current [OpenAI tool-result guidance](https://developers.openai.com/plugins/build/mcp-server), [tool responsibilities](https://developers.openai.com/plugins/plan/tools), and the [MCP Apps UI bridge](https://developers.openai.com/plugins/build/chatgpt-ui). The new tool's [output schema](https://developers.openai.com/plugins/reference) describes its public projection. UI resource v12 carries the panels.

## Validation

Run `npm run build`, `npm run check`, then `npm test`. All 31 tests passed on 25 October 2026. Coverage includes permission gates, exact building scope, source domain/type, date order/review expiry, source geography/reporting period, revocation/withdrawal, idempotent staging, unsafe-markup escaping and real-mode HTTP/MCP hydration/removal with temporary synthetic fixtures. No real forum material is used in those fixtures. Browser and ChatGPT results/limits are recorded separately in the [connection record](chatgpt-connection.md).
