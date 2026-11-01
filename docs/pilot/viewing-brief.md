# Chuẩn bị trước khi xem nhà

Approved 1 November 2026 after the feature discussion. Turn one to three selected **research source ads**, plus must-haves already stated in ChatGPT, into a useful next step before arranging a viewing. Return a partial brief immediately. No account, intake questionnaire, custom chat composer or new model API is required.

## Behavior

The selection tray has one primary action, **Chuẩn bị trước khi xem nhà**. A detail page can prepare its focused source without replacing comparison selections. Each compact result shows a next step, one sourced finding, its conditional applicability and the biggest evidence gap. Expand for checks, original sources and at most three prioritized seller questions with reasons. No question is sent to a seller automatically.

| Next step | Evidence required |
| --- | --- |
| Hỏi rõ trước | Default for missing, stale or conflicting evidence that does not establish a hard-constraint violation. |
| Có thể cân nhắc đi xem | Reviewed exact building, building-scoped completion/use evidence, answers for all recorded must-haves, a fresh source read and owner/authorized-supplier availability confirmation within seven days, without blocking source contradictions. This is not legal certification. |
| Tạm gác | A fresh, coherent, reviewed source quantity clearly violates a recorded hard constraint. Missing values never cause rejection. |

Current source reviews support coherent asking-price/area observations but do not review net/gross area basis, bedrooms, acceptable-area membership or arbitrary must-haves. Those checks remain unknown. Raw expressions never establish matches or conflicts. Price remains asking price; a source read never reconfirms availability.

## Context and identity

[Reviewed seeds](../research/viewing-brief-seed-review-2026-11-01.md) provide eight short, original paraphrases with attribution, source date (or null), effective period (or null), scope, locator, check date, review deadline and limitations. CT36 parking/occupancy descriptions are historical, the OCT3A operator term is an announcement, and TTX's completed-category classification has no established completion date. **No current household fee schedule is verified.**

The initial three ads have only **tentative project-family associations**. Their current retained identity fields were reviewed; no exact tower is independently established. Building-specific OCT3A operating/parking notes are withheld until a separately reviewed exact-building match exists. A label, model-supplied slug or similar price cannot create a join. CT36 Tower at Lê Trọng Tấn is separate from Metropolitan at Định Công; TTX project evidence does not prove CT1C handover.

`candidate_context_reviews` is service-only and bound to candidate ID plus current fingerprint. The review stores project/building scope, a seven-day initial deadline and private provenance. Source changes, withdrawal, retention expiry or overdue review remove applicability. The server regenerates brief items and advances the session revision when evidence changes; the UI never relies on model context alone. Context review neither clears quantity risks nor promotes usable supply or inventory.

This factual research bundle is distinct from the permissioned catalogue evidence system. It displays minimal own factual notes and original reference links under the user's authorized source-research scope; it claims no publisher licence or supplier permission. It includes no copied description, photos, contacts, replies or legal documents. Existing `project-evidence.mjs` permission gates are unchanged. No context is attached to fictional demo homes.

## Tools and state

Retain the existing **interactive-decoupled** app, server/research-web layout, MCP Apps bridge, system composer and one-hour server-backed research session.

- `get_viewing_brief`: data-only, reads current selections/focus and inherited requirements.
- `show_viewing_brief`: same resource as the source explorer; changes only temporary brief subjects, requirements and view. Accurate `readOnlyHint:false`; no inventory write.
- `show_research_explorer`: may carry explicit conversation must-haves as brief context, never numeric source filters.
- `get_research_context`: first read for conversational references; returns saved requirements and active brief.

Requirements merge field by field; clearing requires explicit `clearRequirements`. Brief subjects are captured separately from comparison selections. The UI cannot inspect the conversation. If no requirements have reached the server, the primary action still opens a partial brief and uses a user-initiated bridge message to ask ChatGPT to attach requirements already stated. Failed delivery leaves the partial brief usable with a retry action. Standalone browsing honestly shows that chat requirements are absent.

The changed widget is `ui://hanoi-home/research-v5.html`. No new CSP domains, iframe, external script or browser-side publisher calls are introduced. Current official guidance supports [separate data/render tools](https://developers.openai.com/plugins/plan/tools), [structured results and resource registration](https://developers.openai.com/plugins/build/mcp-server), [bridge/host integration](https://developers.openai.com/plugins/build/chatgpt-ui), [compact host-aligned UI](https://developers.openai.com/plugins/concepts/ui-guidelines) and [refreshing/testing the connection](https://developers.openai.com/plugins/deploy/connect-chatgpt). Existing local code, checked against [official examples](https://developers.openai.com/plugins/build/examples) and the [reference](https://developers.openai.com/plugins/reference), remains the starting point.

## Review operation

Ordinary daily discovery remains independent and bounded. It never auto-renews context identity reviews. During the existing 15-minute daily exception budget, check changed/expired reference ads; weekly, reopen the small primary-source bundle, retain original dates and revise notes or withdraw them. Do not substitute check dates for publication dates, infer current fees from old tenders, or renew merely because the URL still loads.

`npm run context:review -- PRIVATE_JSON_FILE` applies reviewed records through a service-only, revision-checked RPC. The ignored private file contains an array of `candidateId`, `fingerprint`, `projectId`, nullable `buildingId`, `matchLevel` (`tentative-project`, `project`, `building`), `reviewer`, `evidenceRef` and `reviewDueAt`. Inspect current identity fields and evidence before preparing it; a changed fingerprint requires a new review. The CLI validates project/building membership and never prints private input. The initial file is local-only, not a public seed or automatic deployment step.

## Five-minute observed task

Run separately with the three available participants using real source references, explicitly unverified. Do not coach or turn it into a long interview.

1. **0:00–1:30:** “Chọn một tin bạn muốn tìm hiểu thêm trước khi hẹn xem.” Observe selection and the primary action.
2. **1:30–3:00:** “Điều gì ở đây có nguồn hỗ trợ? Điều gì bạn vẫn chưa biết?” Observe whether they distinguish project context, historical information and the advertised apartment.
3. **3:00–4:30:** “Bạn sẽ hỏi người bán điều gì trước?” Observe use of one question and its reason.
4. **4:30–5:00:** Ask what they would actually do next and what got in the way. Record their words and observed action; do not ask whether they like the concept or would hypothetically use it.

For each participant record task completion/help needed, one correctly explained sourced finding, biggest uncertainty, whether they confused a project note with apartment verification, question used and next actual action. Capture failures and change the feature accordingly. Three sessions reveal usability issues; they do not establish representative demand. **Participant observations remain pending until the people perform these tasks.**

Local, protocol, deployment and actual-ChatGPT verification are recorded separately in [the connection record](chatgpt-connection.md).
