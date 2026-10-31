# Hanoi apartment discovery pilot

Help people buying an apartment to live in find and compare completed resale apartments in Hanoi through a Vietnamese-language ChatGPT app. Build a small working prototype first and observe the three available participants in ten-minute sessions. Use clearly labeled fictional inventory until directly permissioned listings are available.

The product direction below was approved in discussion. Buyer problems, suitable inventory, supplier cooperation, operating cost, and measurable usefulness still require evidence. Three available participants are not yet three confirmed active buyers.

## Approved scope

| Area | Decision |
| --- | --- |
| Audience | People buying a home for their own use |
| First market | Hanoi; later expansion across Northern Vietnam |
| First inventory | Completed apartments offered for resale |
| Acquisition | Aim for 15–30 relevant, original listings supplied with permission by owners or agencies |
| Interface | Vietnamese conversation, listing cards, an interactive map, comparisons, and optional shortlists |
| Accounts | Search, map exploration, and comparison require no separate account with us; persistent saves are optional |
| Matching | Distinguish must-have constraints from preferences and explain compromises |
| Commercial model | Free buyer pilot, no paid placement |
| Insights | Evidence relevant to a shortlist before a general market-news feed |
| Validation | Build first; observe three short task-based sessions, revise, and expand recruitment |

## User journey

1. Start with a search request or an existing property the user wants to discuss. Support entering directly at comparison when the app has enough information.
2. Clarify only missing information needed for the next useful result: budget ceiling, bedrooms, acceptable locations, and other must-haves. Separate preferences from exclusions.
3. Present matching listings with reasons for the match, asking prices, location precision, evidence dates, and important unknowns.
4. Let the user explore cards and an expanded map. Card and map selections refer to the same listing identifiers and remain understandable to ChatGPT.
5. Compare selected properties on the criteria that matter to this user. Show differences, unknowns, and the evidence supporting each statement.
6. Optionally save a shortlist or open the original source. A directly submitted listing may have no public URL; show its permitted source attribution and available next step without inventing a link.

When no listing meets all must-haves, explain the limiting constraints. Ask before relaxing them. A missing value cannot be treated as a confirmed match for a requirement that depends on it.

Users may bypass optional questions and move among search, map, details, and comparison without completing a rigid questionnaire. The interview process informs the product; it does not become mandatory onboarding.

### Source-link research before approved inventory

The user requested integration of the collected leads. An optional, explicitly labeled research view now supports browsing source links, inspecting dates and uncertain quantity expressions, selecting two or three sources, and asking ChatGPT what to verify. This is separate from the approved-inventory journey: these ads have not been confirmed available, completed, legally documented or suitable for the user's hard requirements. Preserve those requirements in conversation; never count an unknown as a match or convert a price rate into a confirmed total price.

The initial projection contains seven manually curated OTOFUN links with our own labels and minimal factual metadata. It excludes post bodies, images, contacts, author replies and operator notes. It grants no supplier/publication permission, creates no approved catalogue listing and produces no market-price statistic. Changed, removed or expired retained records leave the projection until reviewed again. No source coordinates are verified, so research uses a list rather than map pins. See [operating and verification details](chatgpt-research-integration.md). The existing demo/approved-inventory workflow and selection sessions remain independent.

## Map and comparison behavior

The approved visual direction is warm, approachable terracotta. Use restrained brand accents with ChatGPT's native surfaces and typography. Inline results should lead with compact property cards and visible requirements, with detailed filters behind an explicit action. Expand the map for spatial exploration while preserving the system composer and selected properties. Show the names and prices of selected homes so the user can tell what a conversational comparison refers to.

Use **Xem chi tiết** as the main action on each result card. The detail panel exposes evidence, missing information, **Thêm vào so sánh**, and an optional contextual ChatGPT question. Keep the named comparison tray accessible above results and sticky while scrolling in the expanded workspace. Details and comparisons remain inside the app alongside the system composer. Share the focused home separately from comparison selections so “căn đang xem” and “hai căn đã chọn” resolve correctly. Conversational refinements inherit the requirements last applied in the UI unless the user explicitly changes or clears them.

Show factual price and compatible-area differences in comparison, preserving ties and unknowns. A differences-only view retains missing evidence. Contextual questions capture the homes and requirements at the time of asking, show delivery state, and let users return to those homes after browsing elsewhere. Returning to a question preserves the current search requirements.

- Show property markers and asking prices linked to listing cards. Support selecting and comparing properties from either surface.
- Label whether a position represents a building, an approximate area, or an unknown location. An apartment's building position is not its exact unit location.
- Do not fabricate coordinates. Listings without usable locations remain accessible in the list with a clear explanation.
- Distinguish net usable area from gross or built area. Only compare price per square metre when the area basis is compatible; show the basis.
- Keep chat follow-ups working after map selections. A request such as “So sánh hai căn này” must resolve to the selected listings.
- Verify small-screen behavior, keyboard access, and a useful list view when the map cannot load.

Commute estimates, amenity layers, and market overlays remain later candidates requiring suitable data. They are not pilot commitments.

## Listing evidence and lifecycle

Use the [submission template](listing-submission-template.md) as the initial intake record. Keep source attribution, source date, check date, confirmation method, and permission record distinct.

| Availability | Meaning |
| --- | --- |
| Advertised | A supplier advertises the property; current availability has not been independently established |
| Availability confirmed | A named owner or authorized supplier explicitly confirmed availability at the recorded time; identify the confirmation source |
| Sold or unavailable | A supplier or other documented source reported that the property is no longer offered; record the reason if known |
| Unknown | The evidence does not support a current availability claim |

Opening a source page does not reconfirm availability. Asking-price confirmation, availability confirmation, completion status, and reported legal documentation are separate facts. A seller-confirmed asking price remains an asking price. Document claims retain their source and review status; the app does not certify title or legal compliance.

Record price changes as dated observations of the same identifiable listing. Do not claim a price change by comparing unrelated units or duplicate advertisements. Withdraw unavailable or permission-revoked listings from active recommendations while preserving only records allowed by the applicable agreement.

The freshness window and the person responsible for review must be decided before buyer testing. After that window, do not continue presenting an old confirmation as current. Show its date and downgrade the current availability claim until reconfirmed. A missing or withdrawn source must not silently look verified.

## Insights

Prioritize asking-price comparisons, observed listing changes, and dated project or area developments relevant to the user's decision. Attach source, reporting period, geography, and material limitations.

Listing samples describe the collected inventory, not the entire Hanoi market. Separate asking-price statistics from completed-transaction evidence and primary-market reports from resale comparisons. Do not infer future returns or property-specific availability from market news.

Existing source research: [data acquisition](../research/hanoi-data-acquisition.md), [data options](../research/hanoi-pilot-data-options.md).

## Validation and decision evidence

Use the [ten-minute session guide](interview-guide.md) to observe participants finding, comparing, and saving properties. Ask brief questions about recent searches and actions just observed. Fictional inventory tests interaction and comprehension; it does not establish inventory quality or buyer conversion. During prototype observation, record task completion, misunderstandings, missing data, unnecessary questions, and the next step the participant actually takes.

Before a pilot session, check these observable behaviors:

- A hard budget or bedroom constraint is respected; relaxing it requires the user's agreement.
- Listing identity, price, selection, and comparison stay consistent across chat, cards, and map.
- Missing area, location, or evidence is visible and never replaced with an invented value.
- A sold or withdrawn listing leaves active results; an old confirmation loses its current-confirmed claim under the agreed freshness rule.
- Users can reach search and comparison without a separate account, and map failure leaves a usable list.
- Tool checks, local UI checks, and checks inside ChatGPT are recorded separately. Local rendering alone does not establish correct conversational tool selection.

Report outcomes per participant. Three sessions can reveal problems and learning opportunities; they cannot establish market demand or justify a representative conversion rate. Set further success criteria after observing the participants' actual tasks.

## Shared data coverage

Approved 1 November 2026: build one shared Hanoi dataset across areas and budgets for future public use. Buyer-specific preferred areas and maximum budget are search inputs, not global collection constraints. Daily bounded discovery enriches a private review inbox; new/changed candidates do not bypass listing permission, identity, scope or freshness checks. See [daily operations](daily-data-operations.md). The completed-resale-apartment scope and demo/research/inventory distinctions remain.

## Technical direction and open decisions

Use the installed `chatgpt-apps` skill with `openai-docs` when implementation begins. Keep server-backed data and operations useful without custom UI; use the current MCP Apps bridge for the embedded component. Current guidance: [define tools](https://developers.openai.com/plugins/plan/tools), [UI integration](https://developers.openai.com/plugins/build/chatgpt-ui), and [connection testing](https://developers.openai.com/plugins/deploy/connect-chatgpt).

Framework, hosting, map provider, operating budget, persistent-save behavior, and pilot distribution remain open. Confirm intended testers can access the connected app before scheduling usability sessions. No platform or supplier subscription is assumed.

## Next work

1. Build and check the prototype, then run three short observed sessions.
2. Revise the journey and define the real-inventory request from observed needs.
3. Fill the [supplier inquiry](supplier-inquiry.md) for selected recipients; contacting them requires a separate instruction.
4. Agree display permission, update responsibility, location precision, and withdrawal handling; collect the initial inventory.
5. Replace demo fixtures with permissioned inventory and repeat affected checks and participant tasks.
