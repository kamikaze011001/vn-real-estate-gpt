# VOZ and OTOFUN: direct RSS access check

Checked **25 October 2026, 16:14–16:18 UTC** (23:14–23:18 Vietnam time). This completes the technical feed-discovery spike from the [real-data plan](../pilot/real-data-integration-plan.md). It does not establish an ingestion/reuse agreement or change source permissions.

## Result

Both forums returned public RSS XML. The root feeds mix property and unrelated subjects. More useful **category-specific feeds are advertised in the property pages' HTML heads** and also returned RSS successfully. Their existence was discovered from the actual `rel="alternate"` links, not assumed from XenForo URL conventions.

| Source page / role | Advertised feed | Direct observation |
| --- | --- | --- |
| [VOZ Bất động sản](https://voz.vn/f/bat-dong-san.79/) | [Property-category RSS](https://voz.vn/f/bat-dong-san.79/index.rss) | HTTP 200, `application/rss+xml`, channel “Bất động sản”, 20 items in this response. Sample URLs included HCM and Southern-property threads, so this is not a Northern/Hanoi-only feed. |
| [OTOFUN Xây dựng–Bất động sản](https://www.otofun.net.vn/forums/xay-dung-bat-dong-san.284/) | [Discussion-category RSS](https://www.otofun.net.vn/forums/xay-dung-bat-dong-san.284/index.rss) | HTTP 200, RSS XML, channel “Xây dựng - Bất động sản”, 30 items. Sample URLs included Hanoi apartment-price discussion and a policy discussion. This is project/community discovery, not available inventory. |
| [OTOFUN Chợ Bất Động Sản](https://www.otofun.net.vn/forums/cho-bat-dong-san.423/) | [Marketplace-category RSS](https://www.otofun.net.vn/forums/cho-bat-dong-san.423/index.rss) | HTTP 200, RSS XML, channel “Chợ Bất Động Sản”, 30 items. One sampled URL explicitly concerned sale or rental. Separate offers, requests, sale/rent and pilot scope before any listing consideration. |

The [VOZ root feed](https://voz.vn/f/-/index.rss) returned 20 items and the [OTOFUN root feed](https://www.otofun.net.vn/forums/-/index.rss) returned 30. Their sampled URLs included unrelated household, wedding, football and language-learning topics. Prefer an agreed category/watchlist scope over those sitewide feeds.

Counts, dates and access are one-response observations, not guaranteed page sizes, completeness, availability, update cadence or service commitments. No category-feed pagination, backfill, removal notification, per-post identifier semantics or freshness guarantee was established. A thread activity timestamp/feed `pubDate` is not a seller availability confirmation or necessarily the date of a specific factual claim. The root feeds' `Last-Modified` values matched response-generation time and cannot substantiate property freshness.

The check extracted technical metadata, a few feed dates and sample URLs in memory. It did not retain descriptions, article/post text, authors, contacts or raw feed files. Absence of a literal `description` element was observed in the category feeds; namespaced content fields were not characterized, so this is **not a finding that the feeds contain metadata only**. Do not copy their payload wholesale into the catalogue.

## Robots and intended use

Both [VOZ robots.txt](https://voz.vn/robots.txt) and [OTOFUN robots.txt](https://www.otofun.net.vn/robots.txt) returned HTTP 200. The first summary was incomplete, so a second robots-only read inspected the full directive text.

VOZ declares `Content-Signal: search=yes,ai-train=no,use=reference`, names several agents including GPTBot with `Disallow: /`, and includes general restrictions on account/login/admin, user/profile, search/misc routes and some thread-action routes. OTOFUN's general rules restrict account/login/admin, attachments, redirects and certain utility routes, alongside a general allow and sitemap. These observations are not a comprehensive legal interpretation or a production crawler approval. Different/repeated user-agent groups and nonstandard content signals need proper handling; a generic parser's allow result must not be treated as authority to collect or reuse content.

Do not impersonate another bot, bypass challenges or use mirrors to evade restrictions. The current app has no scheduled collector. Agree the access identity, exact feed/thread scope, intended reference/summary use, rate, caching/retention, contributor rights and removal process with the relevant operator before automating. An accessible feed, robots allow directive or source attribution does not establish those terms. See the inspected [VOZ terms](https://voz.vn/help/terms/) and [OTOFUN agreement](https://www.otofun.net.vn/threads/thoa-thuan-cung-cap-va-su-dung-dich-vu-mang-xa-hoi-otofun.1962611/).

## Acquisition decision

1. Keep the category URLs in the [feed candidate manifest](../../data/forum-feed-candidates.json), with collection disabled and permission pending. No runtime fetcher consumes that file.
2. Ask VOZ and OTV about this narrow scope using the [prepared access requests](../pilot/source-access-requests.md), including allowed reference/summary operations and whether contributor permission is needed separately.
3. If cleared, implement a bounded feed adapter for **discovery/review candidates**, keyed to canonical thread/post identities and relevant pilot projects. Feed entries do not auto-publish evidence or listings; operator review remains the serving gate.
4. Obtain the first five original listing samples from a supplier in parallel. Use the [existing importer](../pilot/catalogue-operations.md); forum feeds cannot establish authority, current availability, exact unit identity or transaction prices.

No providers were contacted, paid services accepted, accounts created or permissions granted by this check. No app/widget/MCP behavior changed; the verified v12 app remains the current implementation.
