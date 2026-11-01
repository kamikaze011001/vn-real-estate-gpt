# Muaban acquisition assessment — 1 November 2026

Research-only assessment for the shared Hanoi completed-resale-apartment dataset. Uses the `mattpocock-skills:research` workflow, first-party policies and a bounded public-page inspection. No collector was activated, database changed, publisher contacted, login used, or browser opened. No ad bodies, contacts or images are retained here.

## Recommendation

**Keep Muaban disabled for scheduled acquisition and public ad projection pending clarification of the intended collection/display rights.** Its public pages are technically inspectable and expose useful ad identifiers and lifecycle fields. That is sufficient to continue a small human source-link assessment within the agreed scope; it does not establish permission to mirror listings or operate an unattended feed. Prefer original owner/agency intake with explicit rights and dated reconfirmation while any Muaban agreement remains unresolved.

This is an activation-readiness judgment, not a claim that every factual observation or source link is prohibited. The policy clauses below concern service copying/distribution and personal information; their exact application to a minimal facts-and-links service requires clarification. Do not convert an HTTP 200 or permissive robots directive into a publication license.

The working target is 100 usable unique ads across at least ten Hanoi projects in four weeks, with a seven-day feasibility review and a 15-minute daily exception budget. This three-ad, first-page sample cannot establish that yield or operating cost. None of the three is established as a usable permissioned inventory record: completion/resale scope, unit identity, permission, genuine publication/edit freshness and availability remain unverified.

## First-party policies and feed routes

| Evidence checked on 1 November | Source fact | Consequence for this project — assessment |
| --- | --- | --- |
| [Operating rules](https://muaban.net/wiki/quy-che-hoat-dong-muabannet/), displayed update 4 January 2023, VI(iii), X member obligations items (xv)/(xxv), XI(a) | The rules restrict copying/distribution/provision of the site's service to third parties without consent. They also prohibit collecting personal information without Muaban consent. The applicability section covers individuals and organizations using the service. | Do not harvest contacts or assume an outbound-reuse grant. Clarify the exact minimal fields, storage, automated checks and public display with the platform before activation. |
| [Terms](https://muaban.net/wiki/dieu-khoan-su-dung-muabannet/), displayed update 7 July 2025, display/edit and responsibility sections | Free ads have a stated maximum display period. Expired-service ads are hidden from lists and editing is disabled. Content comes from users and accuracy is not guaranteed. Service start is linked to payment. | Expiry is distinct from sale status. A service start date alone cannot prove original publication or a genuine content edit. Preserve claims as advertiser-sourced evidence. |
| [Bump service](https://muaban.net/wiki/dich-vu-day-tin-muabannet/), displayed update 1 April 2026 | Paid immediate/scheduled bumping moves ads within their purchased service class; bumps cannot extend beyond service expiry. | Ranking and apparent activity are unsuitable substitutes for a genuine edit date or independent recency. |
| [Official partner program](https://muaban.net/wiki/dang-ky-lam-doi-tac-cua-mua-ban/), displayed update 26 October 2023 | The described agency partnership supports advertising and management of subordinate accounts. | This page does not document an outbound listing API, licensed CSV, delta feed or redistribution entitlement. |

Domain-restricted searches for Muaban API/feed/data-partner documentation found no verified first-party public outbound listing feed. This is a bounded search result, not proof that a private commercial arrangement is unavailable. A future inquiry should request field/content rights, attributable provenance, request limits, retention, deletion/withdrawal signals, update semantics, samples and cost. No inquiry was sent.

## Access observations

Policies above were readable through the research web tool. That tool could not retrieve robots. A read-only Python `requests` session in the repository's existing `.venv-crawl`, with ambient proxy/netrc credentials disabled, inspected the public source directly. Sandbox DNS was unavailable; the bounded network check then ran outside that restriction. No new dependency was installed, authentication supplied, headers disguised, challenge bypassed or blocked request retried.

At **09:09 UTC / 16:09 Vietnam time on 1 November 2026**, [robots.txt](https://muaban.net/robots.txt) returned 200, 109 bytes:

```text
User-agent: *
Allow: /
Disallow: /dashboard/
Disallow: /8zr2/
Sitemap: https://muaban.net/sitemaps/index.xml
```

The inspected category and detail routes are allowed by these wildcard directives; no crawl delay was declared. The sitemap was not downloaded. There were two network robots requests because the first response-print operation used an incorrect local response attribute; that programming error was corrected. It was not an access denial.

One [Hanoi apartment category](https://muaban.net/bat-dong-san/ban-can-ho-chung-cu-ha-noi) returned 200, 170,169 bytes at 09:09:13 UTC. Three linked opening details were then inspected sequentially with two-second spacing. All returned 200; no access restriction occurred, so no alternative transport or browser fallback was needed. Responses were inspected in memory and discarded. This is a one-run access observation, not worker-environment or scheduled-reliability validation.

## Bounded detail sample

Only ad identifiers, date labels and limited identity observations are recorded. Project/building names below are source claims, not a verified project registry. A whole-page regex can include related-ad cards; presence in that text must not be promoted into the selected ad's unit identity.

| First-party detail | Observed lifecycle fields | What this establishes and leaves unresolved |
| --- | --- | --- |
| [Ad 71315878 — Bạch Mai](https://muaban.net/bat-dong-san/ban-can-ho-chung-cu-quan-hai-ba-trung-ha-noi/ban-can-ho-cao-cap-tang-trung-dien-tich-132-m2-phuong-bach-mai-id71315878) | Start 28 October; expiry 27 November 2026; 200, 106,481 bytes; no observed expired banner. | Ad-level ID and service dates readable. Building/project and unit identity were not established by the scoped facts recorded in this probe. |
| [Ad 71315683 — Athena Ngọc Hồi](https://muaban.net/bat-dong-san/ban-can-ho-chung-cu-quan-hoang-mai-ha-noi/ban-can-ho-chung-cu-cao-cap-athena-ngoc-hoi-hoang-mai-ha-noi-id71315683) | Start 28 October; expiry 7 November 2026; 200, 140,737 bytes; no observed expired banner. | Named-project intent in the ad route. Exact building/unit and completion evidence remain unresolved. The page includes related offers, making whole-page identity parsing unsafe. |
| [Ad 71245910 — Trung Hòa Nhân Chính](https://muaban.net/bat-dong-san/ban-can-ho-chung-cu-du-an-khu-do-thi-trung-hoa-nhan-chinh-quan-cau-giay-ha-noi/can-ban-can-ho-chung-cu-cao-cap-khu-do-thi-trung-hoa-nhan-chinh-id71245910) | Start 22 October; expiry 6 November 2026; 200, 113,637 bytes; no observed expired banner. | Project-level identity is visible in the route. A building token was detectable in page text but not independently established as a scoped identity fact. Exact unit remains unknown. |

The probe did not establish a genuine-edit timestamp, original publication date, independently checked price/area pair, current availability, completed-resale status or documentary validity for these ads. The “start” labels fall within 30 days, but their original-publication semantics are unverified. Therefore they do not yet satisfy that freshness limb by themselves.

Earlier same-day [source research](hanoi-free-data-and-insights-2026-11-01.md#small-listing-quality-sample) recorded expired Muaban details despite fresh-looking category labels and a title/structured-area disagreement. Those are prior observations, not fresh retests in this sample. They support retaining expiry and conflicting-field gates; they do not establish a source-wide error rate.

## Proposed field mapping and gates

This is a design recommendation for a future permitted adapter, not an implemented schema or reuse grant.

| Local evidence concept | Muaban input / treatment |
| --- | --- |
| `source`, `sourceAdId`, `sourceUrl` | Muaban host plus numeric `-id…` identifier; canonical public detail URL. This identifies an advertisement, not a physical unit. Reject unexpected host/path/redirect. |
| `checkedAt`, `sourceState` | Our successful bounded detail observation; separate `active-ad`, `source-expired`, `removed`, `blocked`, `unreachable` and `unknown`. A failed check must not refresh the success date. |
| `sourceStartedAt`, `sourceExpiresAt` | Preserve separate displayed date labels and their service-date semantics. Never alias start to original publication. Expired source is archived from active results even if its body remains readable. |
| `publishedAt`, `genuinelyEditedAt`, `supplierReconfirmedAt` | Unknown unless supported by the exact relevant source or permissioned supplier evidence. Bump/order/relative category activity and retrieval time do not populate these fields. |
| `project`, `building`, `unitIdentity` | Parse only the selected detail container; keep source claims and reviewed canonical identities separate. Unknown project/building/unit stays unknown. Stable ad ID alone cannot deduplicate two ads into one apartment. |
| `askingPrice`, `area`, `areaBasis`, `bedrooms` | Capture only permitted factual fields with raw-expression provenance and source-field names. Preserve total/rate/range distinctions, area conflicts and unknown net/gross basis. Never select a conflicting area silently or infer a total from an ambiguous rate. This probe does not validate a production extractor. |
| `availability`, `completionEvidence`, `legalClaims` | Public ad means advertised at most. Reopening the page does not reconfirm availability, prove completion or validate documents. Supplier confirmation and official/project evidence remain distinct. |
| `permissionRecord`, `displayEligible` | Record permitted operations/content, grantor, scope/date and withdrawal rules independently of technical access. Missing/unclear permission prevents approved publication. No copied bodies, contacts or images in a facts/link adapter by default. |

Apply the agreed freshness policy: successful source check within **72 hours**, plus either independently supportable ad publication/genuine edit within **30 days** or supplier reconfirmation within **seven days**. Source expiry overrides apparent card freshness and triggers archive. A future source recheck cannot revive an expired record without a reviewed current source state. Retain only archive metadata permitted by the source/supplier agreement.

## Validation fixtures and seven-day review

Use synthetic HTML and invented ads for regression fixtures; do not commit Muaban body text, contact details, photos or full response snapshots. Cover: scoped detail versus related-card bleed; stable ad IDs versus uncertain unit identity; service-start date versus publication; bump labels; expiry despite HTTP 200; removal/redirect; conflicting title/structured area; total versus rate asking prices; missing area basis; project bundle versus one apartment; unknown completion; and an unverified legal claim. Include 403/429/challenge, unavailable robots and oversized/malformed responses with stop behavior. Test that successful retrieval never creates permission or availability confirmation.

Before any scheduled run, resolve the permitted facts/link operations and prove the actual worker's bounded access without bypasses. A permitted seven-day trial should measure unique usable ads and reviewed projects after all gates, duplicates, expired/unknown dates, parser conflicts, source failures and actual human exception minutes. Separate raw ads from unique apartments and permissioned inventory. Review whether those measured rates support the four-week 100-ad/ten-project target within 15 minutes/day; this sample cannot supply that forecast. If permission or identity/freshness evidence remains insufficient, continue supplier intake instead of expanding collection volume.

Unresolved: outbound permission/feed terms; original-publication and genuine-edit semantics; robust scoped field selectors; actual worker reliability; unique-unit deduplication; project completion evidence; supplier availability reconfirmation; achievable project coverage and daily review cost. No hosted UI/protocol behavior changed, so ChatGPT-host testing is outside this research result.
