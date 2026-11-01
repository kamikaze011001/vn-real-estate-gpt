# Usable Hanoi supply — approved 1 November 2026

The first checkpoint is **100 usable, provisionally unique ads across at least ten Hanoi projects**. The four-week working target is 29 November; review feasibility on 8 November. This is a coverage target, not an assertion of 100 available apartments or a representative market sample. No evidence currently establishes that the target can be reached within the operating budget.

Use two acquisition paths: bounded public-source discovery, and permissioned owner/agency submissions. The owner handles initial introductions (about one hour); the daily human exception budget is 15 minutes. [Supplier starter pack and unsent messages](supplier-starter-pack.md). Muaban remains disabled: the [assessment](../research/muaban-acquisition-assessment-2026-11-01.md) found readable pages but unresolved intended-use rights and service dates that cannot establish original publication freshness. Existing OTOFUN/VOZ source isolation and backoff remain.

## What counts

- A usable source ad has operator-reviewed evidence for a coherent Hanoi completed-resale apartment, identified project, positive total asking price and area. These are source-advertised facts, not independently verified inventory or proof of legal status.
- Its successful source check is within 72 hours, plus original publication/genuine edit within 30 calendar days, or an owner/authorized-agency reconfirmation within seven days. Retrieval, bumps and service renewal do not refresh publication dates. Failed checks never refresh successful-check time.
- Source-expired ads are archived even when the page opens. Other stale ads leave usable results. The existing fourteen-day retention still removes old stored metadata. Archive is temporary research access, not indefinite storage.
- Suspected reposts count as one provisional group; confirmed duplicates count once. Records, prices and evidence remain separate. Similar project/price/area creates only a suspicion; a reviewer can mark genuinely distinct apartments. Do not infer unit identity from an ad ID.
- Missing project/quantity/scope or genuine-date evidence stays unresolved. Unknown original dates do not prove old age. No conversion from source rate to total, invented dates, automatic approval, or canonical hard-constraint matching is introduced.

The public counters distinguish collected records, usable ad records, provisional groups, projects, unresolved records and archive. They cover the **minimal source-ad projection**, up to 500 retained rows, including the [Alonhadat adapter](alonhadat-acquisition.md) after activation. The permissioned supplier catalogue remains a separate publication path with its own review/permission checks; it is not silently added to the forum count. Reconcile cross-channel duplicates and report supplier yield separately at the feasibility review before claiming a combined 100. No supplier batch has been received yet.

## Daily worker

Discovery remains 06:17 Vietnam time: three index pages and twelve new opening posts per source, plus four oldest eligible refreshes. A refresh-only sweep runs at 02:17, 10:17 and 18:17: up to twelve existing candidates per source, no new discovery, no cursor advancement. Current usable assessments are prioritized, oldest first within each priority. Source-expired ads do not consume refresh quota. Existing source cooldowns, robots/access stops, two-minute source budgets and partial-success persistence apply to both modes.

Three sweeps provide nominal capacity for 36 checks/source/day plus discovery refreshes, not a successful-check guarantee. Backoff or runtime limits can reduce this; stale records automatically leave usable results. GitHub schedules can be delayed. Review oldest successful checks and capacity if supply grows.

```sh
npm run pipeline -- collect --apply --refresh-only --refresh-limit 12
npm run supply -- report
npm run supply -- report --save-baseline
npm run supply -- queue
```

These private commands load ignored deployment settings. Never paste their queue output or credentials into chat. The baseline is saved under ignored `private-data/` with mode 0600. A report sums actual submitted review seconds over seven days; `0` is explicitly untimed, not evidence of zero work. Dates are the approved working dates, not an adaptive forecast.

## Fifteen-minute review

1. Check run health and report (about two minutes). A source outage must not stop a healthy source. Do not clear cooldown or bypass access restrictions to meet the target.
2. Review a small oldest/high-value exception batch (about ten minutes), recording actual time. Open the original source; scope each quantity to the selected apartment. Verify project and completed/resale/Hanoi context. Resolve conflicting facts or keep unresolved. Do not treat legal claims as verified documents.
3. Record duplicates, withdrawals and requests for missing evidence (remaining time). Stop at the budget and report backlog rather than silently scaling manual work.

Copy [the blank assessment JSON](../../data/candidate-assessment-template.json) into `private-data/`; replace candidate ID and exact fingerprint from the private queue. The blank template intentionally cannot submit. `needs-context` with `{}` records an unresolved decision. For `usable`, `facts` must include `projectId`, `projectLabel`, `hanoi:true`, `completedResale:true`, `totalAskingPriceVnd` and `areaM2`. Project IDs use lowercase letters/digits/hyphens. Preserve privately where each fact came from in `evidenceRef`; never put contacts, full bodies or documents in facts.

Optional genuine dates are `sourcePublishedAt`/`sourceEditedAt` in YYYY-MM-DD. Only override an extracted date with exact evidence. Optional supplier confirmation uses `supplierConfirmedAt` with timezone and `supplierRole` of `owner` or `authorized-agency`; it requires actual evidence, not a page check. `duplicateStatus` is `unchecked`, `distinct`, `suspected` or `confirmed`; suspected/confirmed require the same UUID `duplicateGroup` for linked records. Reviewer/evidence references remain private. `reviewSeconds` records actual review duration (0–3600).

```sh
npm run supply -- assess private-data/assessment.json
```

The service-only RPC locks the current unexpired revision and writes the assessment and time event atomically. A changed fingerprint invalidates the previous assessment. It does not publish inventory. Public clients cannot review, change permissions or read operator evidence. The queue focuses on fresh unresolved ads; archive can be inspected separately for supplier-led reconfirmation, never revived automatically.

## Seven-day decision and four-week sequence

| Period | Work and evidence |
| --- | --- |
| Day 0–1 | Record actual baseline; send introductions manually; ask for a small permissioned supplier batch; deploy counting/quality gates. |
| Days 2–7 | Measure source success, unique usable yield, project coverage, duplicate rate, source-date failures, supplier responses and actual review minutes. Review a bounded sample, not fabricated conversions. |
| 8 November | Compare usable growth and remaining gap against observed acquisition/review capacity. Check retention and stale-source losses. Narrow scope, add a permitted source or revise the date if 100/10 cannot fit 15 minutes/day. |
| Weeks 2–4 | Expand only productive permitted channels; grow project coverage; keep rechecks, removals and duplicate reconciliation current. Report counts and unknowns separately. |

Record per-channel received/usable/duplicate/archive counts and projects; do not sum forum groups plus supplier offers without cross-channel review. Market insights require an adequate, attributable sample. This release supports coverage/freshness/quality diagnostics; it does not compute Hanoi price trends from fourteen ads.

## App design and validation

The existing interactive-decoupled integration is retained: server tools own authoritative data and shared selection sessions; the MCP Apps bridge renders compact results and sends selected context to ChatGPT. No new public review/write tool is exposed. Counts are global while source results paginate in pages of twenty. Empty usable supply has an explicit route to unresolved research and archive. The widget resource is `ui://hanoi-home/research-v3.html`; refresh tools/resources and test a fresh conversation after deployment.

Design decisions follow OpenAI's [structured MCP output and resources](https://developers.openai.com/plugins/build/mcp-server), [ChatGPT UI bridge](https://developers.openai.com/plugins/build/chatgpt-ui), and [tool responsibilities](https://developers.openai.com/plugins/plan/tools). Local fixtures test freshness boundaries, duplicates, pagination and revision invalidation; SQL tests exercise role denial and atomic assessments; hosted tests verify real HTTP/MCP projection. Actual Brave/ChatGPT results belong in the [connection record](chatgpt-connection.md), separately from protocol results.
