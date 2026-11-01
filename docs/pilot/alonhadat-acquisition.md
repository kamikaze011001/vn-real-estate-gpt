# Alonhadat facts-and-links acquisition

Adds a second apartment-ad publisher to reduce dependence on OTOFUN. The user's 1 November instruction authorizes actual additional research records. [First-party research and access observations](../research/additional-source-acquisition-2026-11-01.md) distinguish factual references from copying content; the publisher's copying notice is not represented as an outbound licence. The adapter stores numeric facts, short source project/area associations, an uncertain displayed date and original URLs. It stores no marketing title, description, contact, author, photo or legal-document claim. No supplier outreach/agreement is created.

## Source and quality boundary

- Only the [Hanoi category](https://alonhadat.com.vn/can-ban-can-ho-chung-cu/ha-noi) and `/trang-N` pages discover ads. Exact-host numeric `/slug-ID.html` URLs and the hidden detail ID must agree. Stable identity is `alonhadat:ID:ad-ID`, independent of title/slug. Different ads are not automatically different physical apartments.
- Parse only `article.property`; related cards never supply selected-ad facts. Require the source's Hanoi region, sale demand and apartment type. Skip unknown/zero totals, non-VND currency, non-square-metre area, rate/range/monthly prices and obvious collective/mini/bundle/social-housing titles. Completed/resale eligibility, unit, availability and legal status remain unverified.
- Project names are source associations, not canonical joins. Our labels say “theo nguồn”. Flag conflicting areas/building codes and retain quantity/identity uncertainties. No coordinates or market averages are generated.
- `displayedAt` preserves the visible date. `publishedAt` and `editedAt` stay unknown because original publication/genuine-edit semantics are unproven. Displayed dates do not satisfy usable-ad freshness. Fresh unresolved ads remain research; expired, stale or proven-old ads enter archive. Missing evidence alone does not prove old age.
- Records remain `inventoryEligible:false`, canonical quantities null and availability unknown. Operator evidence/freshness gates still govern usable groups. No automatic assessment or supplier publication occurs.

## Collection and activation

The normal Requests transport adds only the exact Alonhadat host. Robots, two-second spacing, TLS verification, no ambient proxy/netrc, response caps, same-publisher redirects, denial/challenge stops and the two-minute source budget apply. No browser fallback is used. Source failure/backoff is isolated from OTOFUN/VOZ.

Daily discovery uses page one plus two rotating backfill pages and twelve new detail openings; manual checks allow five/twenty. Four existing ads refresh separately. Pending URLs, attempted IDs and cursor persist in the private frontier independently per publisher. Known IDs do not consume new slots. Existing seven-day recheck and fourteen-day retention rules apply. Refresh-only sweeps use the established twelve-ad quota and never advance discovery.

The migration registers `alonhadat` **disabled**. Activation requires both `data/listing-source-candidates.json` and `collection_sources.scheduled=true`. After validation/deployment, PATCH `collection_sources?id=eq.alonhadat` with `{ "scheduled": true }` through the existing private service client. Run one bounded GitHub discovery and record actual worker access/import counts. To pause acquisition, set the flag false; retained references follow normal quality/retention. Local HTTP 200 does not guarantee worker reliability.

```sh
# Read-only source/parser check: one index, at most three details; no upload.
node scripts/crawl-python.mjs scripts/alonhadat_source.py
# Existing private collection path, after deployment and activation.
npm run pipeline -- collect --apply --pages 5 --threads 20
```

Probe output is limited to safe diagnostics and minimal sample facts/links. Operational status includes all three sources. Never put credentials or private review references into chat or public CI logs.

## App and validation

Extend the existing interactive-decoupled app: ALONHADAT becomes an additional read-result source with optional displayed date; IDs and server-backed selections remain authoritative. No new public review or write tools. Resource `ui://hanoi-home/research-v4.html` versions the changed widget. Bridge/CSP architecture is unchanged; browsers never call the publisher. Refresh ChatGPT tools and test a fresh source selection/comparison after release.

Design references: OpenAI's [structured results/resources](https://developers.openai.com/plugins/build/mcp-server), [MCP Apps bridge and resource cache](https://developers.openai.com/plugins/build/chatgpt-ui), [tool responsibilities](https://developers.openai.com/plugins/plan/tools), and [result schema reference](https://developers.openai.com/plugins/reference).

Invented fixtures cover scoped quantities, units, unknown dates, identities, renamed URLs, pending discovery, refresh-only mode and outages. SQL covers activation, URLs and atomic candidate/frontier persistence. Actual local Supabase/MCP tests cover mixed-source comparison; synthetic HTTP/RPC saves parsed Alonhadat data beside a failed forum. Production access, public growth and actual ChatGPT results belong separately in [the connection record](chatgpt-connection.md).


## Actual worker access finding

The first GitHub import on 1 November received robots 200 then category 429 from Alonhadat; it stopped and retained the existing 24-hour blocked-source cooldown. Local Requests access was insufficient to establish worker readiness. Three pre-existing successful local observations were imported separately without new source requests, using their original probe-batch completion time and expiry; the worker block was preserved. This supplies attributable research references, not a reliable daily Alonhadat feed. [Read-only listing-source preflight](../../.github/workflows/listing-source-preflight.yml) tests the researched Rongbay fallback from GitHub without database credentials/imports before any further adapter is activated.

A follow-up regression ensures every new detail opening consumes quota even when parsing fails. Failed parsing remains pending, but cannot cause extra source requests beyond the configured cap.


## Rongbay fallback

A [GitHub preflight](https://github.com/kamikaze011001/vn-real-estate-gpt/actions/runs/41301365157) returned four HTTP 200 responses (robots, category, two details) and 47 discoverable source links with no uploads. Rongbay now has a separate parser over the same bounded worker. It requires exact Hanoi/property-sale URL/ad-container identity, apartment wording and coherent price/area expressions; it skips unrelated VIP ads, rental/mini/bundle/social-housing titles and rates/ranges/unknown quantities. Source project labels and displayed dates remain unverified; no copied descriptions, contacts, photos or availability/legal claims are included.

The additive migration registers Rongbay disabled. Activate its private scheduled flag only after deployment, then run one bounded import and record actual yield. Both adapters share quota, robots, timeout, redirect, frontier and backoff logic while keeping independent publisher states. Alonhadat remains under its existing GitHub block; Rongbay is a separate source, not an alternate transport for Alonhadat. No widget-code change is needed for the additional source enum; refresh tools for the output metadata and retain research-v4. A fresh host comparison should exercise Rongbay records after actual import.
