# ChatGPT app connections

Stable hosting and connection checked on 1 November 2026. Earlier development checks are retained below.

**Current status (1 November 2026):** **Nhà Hà Nội** is connected at **https://vn-real-estate-gpt.vercel.app/mcp**. Brave actual-host tests passed for seven-source research selection/comparison and demo map selection/comparison without typed IDs. The stable app uses Supabase-backed temporary sessions and does not require ngrok. Earlier tunnel results are historical.

## Endpoint and runtime

- Local preview: http://localhost:8787
- Local MCP: http://localhost:8787/mcp
- Stable public MCP: https://vn-real-estate-gpt.vercel.app/mcp
- Branded private plugin: https://chatgpt.com/plugins/Plugin_791fee034de48191a4ac5cfd580c5bd0
- Underlying MCP connection (retained dependency): https://chatgpt.com/plugins/plugin_asdk_app_6ae63a3ba2e8819188187ad247dcf9fe
- Historical development MCP: https://2c68-103-238-69-196.ngrok-free.app/mcp
- Historical public MCP (offline): https://3c83-103-238-69-197.ngrok-free.app/mcp
- Authentication: none; the running server exposes fictional demo inventory plus the separate minimal source-link research projection. App-only writes update temporary explorer/research context, not listing or account data.

The stable app runs independently of the operator machine. For a separate local development connection, run the local server and ngrok together; restarting ngrok may produce a different URL. If app settings have no endpoint editor, create and verify a replacement connection. Development tunnels are temporary. Stable hosting remains an unauthenticated pilot with demo inventory and unverified source links, not an approved real-inventory service.

## Historical development checks

### Observed status

The public endpoint successfully completed MCP initialization and tool discovery. A search for at least two bedrooms with a maximum asking price of 4 billion VND returned demo-05, demo-03, demo-01, and demo-08. The UI resource was readable as `text/html;profile=mcp-app`.

The user explicitly approved sharing relevant chats and enabled memories with this demo app. The final connection completed, and ChatGPT shows the installed app with a **Try in chat** action.

App details: https://chatgpt.com/plugins/plugin_asdk_app_6adda3b0ac188191ade4c7328eac73db

## Actual ChatGPT verification

Verified in the connected ChatGPT app on 25 October 2026:

- A Vietnamese request for Hanoi apartments with at least two bedrooms and a maximum asking price of 4 billion VND rendered the embedded explorer, property cards, and OpenStreetMap tiles. The four matches were demo-05, demo-03, demo-01, and demo-08.
- Selecting demo-05 and demo-03 displayed **2/3 căn đã chọn** in the widget.
- The follow-up “So sánh hai căn tôi vừa chọn trong ứng dụng. Nêu giá, diện tích, mã căn và thông tin còn thiếu.” correctly identified those exact IDs without putting them in the prompt. ChatGPT compared 2.8 billion VND / 65 m² against 3.2 billion VND / 68 m², listed missing legal, fee, availability, and provenance information, and explicitly described the properties as fictional.

Original integration conversation: https://chatgpt.com/c/6adda89a-deec-83ec-ab08-49adf695a596

### Terracotta UX revision

The terracotta revision used `ui://hanoi-home/explorer-v5.html`. After rebuilding and refreshing the connected app, a fresh hosted conversation verified:

- Compact horizontal result cards, collapsed filter editing, visible hard requirements, and no duplicate standalone brand header.
- Neutral host-themed surfaces with terracotta selections, buttons, and selected map pins. Light and dark primary-button text contrast calculations passed AA at 5.51:1 and 7.50:1 respectively. Actual hosted visual inspection used dark mode.
- Selecting demo-05 and demo-03 showed their areas and prices in the selection strip and then **ChatGPT đã nhận lựa chọn** after the server write completed.
- **Bản đồ** expanded the workspace and retained both selected cards and highlighted pins, with the ChatGPT composer available beside the explorer.
- A conversational request without IDs correctly compared demo-05 and demo-03 again: 2.8 / 3.2 billion VND and 65 / 68 m², with missing information and demo labeling.
- Narrowing the hosted workspace to 414 pixels placed the map above the cards and kept the controls usable without visible page overflow.
- Editing the area to Cầu Giấy through the narrow filter panel retained the maximum price of 4 billion VND and minimum of two bedrooms, returned only demo-01, and preserved the two previously selected homes for comparison.

Revision test conversation: https://chatgpt.com/c/6addaea5-abe4-83ec-8f3f-3f7dd4a09065

The public MCP smoke check also verified refinement with unchanged requirements, selected-listing hydration across renders, and the v5 resource. A local browser check verified the named selection strip and comparison table. Map tiles load when the map is opened rather than during the initial card view.

### Detail-first flow and shared explorer context

The detail-first revision used `ui://hanoi-home/explorer-v9.html`. Cards use **Xem chi tiết** as their primary action. Details and comparison are app panels, and the named selection tray precedes the content and is sticky in fullscreen. Temporary server context now includes focused-property identity, selected/saved IDs, applied filters, current view, and revision. `get_explorer_context` lets ChatGPT read UI-edited requirements and distinguish an open home from homes selected for comparison. Both search and render tools inherit unchanged requirements when passed the session ID; `clearFilters` removes explicitly cleared fields.

Observed hosted checks during this iteration:

- In the v6 test, demo-05 and demo-03 were selected, then demo-01 was opened without adding it to comparison. Asking “Căn tôi đang xem trong ứng dụng có giá và diện tích bao nhiêu? Nêu mã căn và thông tin còn thiếu.” identified **demo-01, 3.6 billion VND, 72 m²**, with missing information and demo labeling. The answer also distinguished the two selected IDs from the focused property.
- A new conversation asking ChatGPT to open demo-01 directly rendered the detail panel with the existing 4-billion-VND and two-bedroom requirements. This verified chat-to-app detail navigation.
- Local checks verified detail actions, selecting two homes, in-app comparison, keyboard focus after selection, and Escape returning focus to the originating card.
- Public MCP checks verified focused-property context, selected/saved identity, inherited filters, explicit clearing, and model-driven detail/comparison view arguments. Ten automated tests cover those domain boundaries, session isolation, and read-only revision checks.

Focused-property test: https://chatgpt.com/c/6addc42e-0014-83ec-8c49-2318a739cef9

Chat-to-detail test: https://chatgpt.com/c/6addc58b-0d3c-83ec-83a3-a232587e0f58

#### Follow-up message behavior

Clicking **Hỏi ChatGPT về căn này** delivered the property-specific question and produced its analysis, but the tested host appended that analysis to the current assistant response without a new visible user-message bubble. After generation completed, a UI probe still found the original user-turn count and no visible authored prompt. Testing the optional `window.openai.sendFollowUpMessage` alias produced the same behavior, falsifying the hypothesis that switching APIs would create a new visible turn.

The final implementation keeps standard `ui/message`, awaits the shared-context write, disables duplicate sends while pending, and shows an in-app confirmation with the exact expandable question. The host controls conversation presentation. The actual-host UI probe is the regression seam for this behavior; a mocked bridge test cannot establish how ChatGPT presents the message. No temporary instrumentation was added.

The v8 hosted test verified this confirmation for comparison of demo-05 and demo-03, including expansion of the exact question. The comparison panel, selection controls, and confirmation were usable in a 414-pixel workspace. Editing the budget to 3 billion VND in the UI, then asking ChatGPT to show only Cầu Giấy while retaining UI-edited conditions, returned zero matches with **3 billion VND / at least two bedrooms** intact. Both selected homes remained available for comparison.

Comparison, handoff, and refinement test: https://chatgpt.com/c/6addc69e-252c-83ec-bf41-008439a4e480

#### Expanded-view continuity

The refinement test exposed a separate issue: ChatGPT's new inline result showed zero Cầu Giấy matches, while an already-open expanded explorer still showed the earlier one-match result without the area filter. Waiting for generation to finish did not update that separate widget instance.

The expanded explorer now checks the shared session revision every eight seconds while visible. It hydrates newer model-driven results without writing back, pauses during user edits and pending operations, and avoids combining snapshots with different filters. Inline history widgets do not poll. A visible area selector also lets users edit or clear an area selected through chat without resetting other requirements.

The v9 regression test repeated the exact sequence: search under 4 billion VND with at least two bedrooms, keep the explorer expanded, change the budget to 3 billion in the UI, then ask ChatGPT for Cầu Giấy while preserving the UI-edited requirements. After generation, both the new inline widget and the already-open expanded explorer showed **zero matches, Cầu Giấy, maximum 3 billion VND, and at least two bedrooms**. This replaced the earlier zero-versus-one mismatch. The area editor then showed Cầu Giấy as an editable value; clearing it and explicitly restoring 4 billion VND returned four matches. The restored map displayed all four demo pins.

Continuity regression conversation: https://chatgpt.com/c/6addc8fd-6a60-83ec-bc35-e3da5c9431d1

### Selection-context fix

The initial hosted test rendered correctly but failed conversational comparison: ChatGPT said it had not received the selected IDs. Standard model-context updates and optional widget-state compatibility alone did not resolve this in the tested host.

The current implementation also writes selections and explorer context to a temporary server-side session. The visual tool returns its session ID to the model, and context tools let ChatGPT read the current state before responding. Session writes are serialized in the widget. The repeated hosted tests above passed after this change. Sessions expire after one hour without context updates. The original local-memory implementation lost sessions on restart; the current hosted Supabase implementation survives Vercel instance replacement.

### Comparison and contextual-question enhancement

This comparison enhancement used `ui://hanoi-home/explorer-v10.html`. Comparison includes exact asking-price and net-area differences, plus **Chỉ xem điểm khác biệt**. Equal known attributes can be hidden; missing availability, legal/fee evidence, and provenance remain visible. Price/area highlights stay unavailable when data is missing or area bases are incompatible, and ties preserve every tied ID.

Detail questions cover fit against requirements and facts to verify. Comparison questions cover tradeoffs and verification. Each question captures its original homes and filter values in the prompt. The delivery panel tracks pending/sent/failed status, exposes the exact question, supports returning to the original homes, and retries the same captured question on failure. Returning changes the displayed home or comparison selection while retaining current search requirements. If requirements have changed since asking, the panel states that difference.

Build, syntax checks, and 13 automated tests passed. Public MCP checks confirmed a 400-million-VND asking-price spread and 3-m² net-area spread for demo-05/demo-03, null highlights for incomplete demo-09 comparisons, and the v10 resource. Tests also cover ties and incompatible area bases.

The refreshed app was verified in ChatGPT:

- The demo-05/demo-03 comparison displayed **Chênh 400 triệu** and **Chênh 3 m²**, identifying the lower asking price and larger net area without a recommendation label.
- **Chỉ xem điểm khác biệt** hid the equal two-bedroom row and retained unknown availability plus legal/fee evidence.
- **Cần xác minh gì?** sent a question containing the original two IDs and the captured maximum 4-billion-VND / two-bedroom requirements. Its panel showed delivery status and the original scope. ChatGPT answered about demo-05 and demo-03.
- After opening demo-01, **Xem lại 2 căn đã hỏi** restored the original demo-05/demo-03 comparison and its correct highlights. The question panel stayed attached to the original targets.
- At the host's minimum 320-pixel workspace width, highlights stacked vertically, question metadata and return actions remained readable, and the table used its own horizontal scrolling. The normal conversation view was restored afterward.

Enhancement test conversation: https://chatgpt.com/c/6addd83b-9a20-83ec-aa77-0f70bab879cd

### Reviewed catalogue foundation

This catalogue foundation used `ui://hanoi-home/explorer-v11.html`, checked on 25 October 2026. The connected app remains in **demo mode**. An optional real mode now reads the reviewed local catalogue, and tool descriptions/results identify the active mode. Widget labels adapt to each record's source, area basis, building-location precision, price confirmation and availability confirmation. Import/permission/review/history operations are private CLI commands, absent from the public MCP/HTTP surface. See [catalogue operations](catalogue-operations.md).

Local build and syntax checks passed. All **23 tests** passed, including an isolated HTTP/MCP test using temporary synthetic fixtures. That protocol test verified empty real-mode results without demo fallback, strict net-area filtering, stable identities, focused/selected context, comparison, approved price updates, revision changes, withdrawal cleanup, permission revocation, private-field exclusion, and the v11 UI resource. These synthetic fixtures never entered the normal operator catalogue, which contains seven pending source candidates and zero real listings.

After refreshing the existing ChatGPT connection, a fresh hosted regression verified:

- A maximum 4-billion-VND/two-bedroom search rendered four demo cards and the map controls/pins, with explicit fictional-data notice.
- A card opened demo-05; its details exposed source, area basis and separate missing price/availability confirmation dates.
- Selecting demo-05, then opening demo-03 through its 3.2-billion-VND map pin and selecting it, produced **ChatGPT đã nhận lựa chọn** for those two IDs.
- In-app comparison showed **400 million VND** asking-price difference and **3 m²** net-area difference, with date/source rows retained. A screenshot confirmed readable stacked highlights and controls in the host's 320-pixel dark-mode workspace; the comparison table retained its own horizontal scrolling layout.
- A composer question referring only to “hai căn tôi vừa chọn” correctly compared **demo-05 and demo-03**, gave the same differences, listed missing evidence and retained the fictional-data qualification.

Regression conversation: https://chatgpt.com/c/6addeda5-41e8-83ec-b9fe-8c86eb832138

This verifies the existing ChatGPT demo after the repository change. Real-mode listings were verified through isolated HTTP/MCP tests, **not** a connected ChatGPT real-inventory pilot; there are no permitted supplier samples yet. Real-mode source-link interactions and freshness labels have not been visually exercised with supplier data. Forum ingestion/community summaries, photo ingestion, automated reconfirmation, permanent erasure/retention jobs, shared hosting and multi-instance operation are not implemented.

### Official and community evidence workflow

The current resource is **`ui://hanoi-home/explorer-v12.html`**. The [project-evidence workflow](project-evidence-operations.md) adds manual staging/review, source/item permission gates, exact project/building matching, dates and reporting periods, review expiry and withdrawal. `get_project_evidence` returns a read-only public projection with an output schema. Details and per-home comparison sections show official material separately from unverified/disputed community accounts. No real forum content or official claim has been published; the normal store has zero real listings and zero evidence items.

Build/syntax checks and **31 automated tests** passed. The real-mode HTTP/MCP test verifies scoped evidence through direct retrieval, property lookup, comparison and explorer context, evidence-driven revisions, private-field exclusion and withdrawal. Tests also preserve citywide source scope/reporting periods independently of the matching project and reject community accounts labeled as documented facts.

A temporary localhost-only catalogue with clearly labeled synthetic records was checked in Brave. Opening each home hydrated the official/community panels, including source links/locators, dates, applicability, actual source scope, verification labels and viewing questions. Comparing the two homes retained their identities, displayed the 300-million-VND/8-m² fixture differences, and exposed separate collapsible evidence sections. A dark-mode screenshot showed the populated layout. The temporary server/database/launcher were removed after checking; its synthetic records never entered the regular catalogue or public tunnel. The example-domain source URLs were inspected as UI links, not opened as real publications.

The existing ChatGPT demo connection was refreshed after the user explicitly approved operating its Chrome test tab. A new hosted conversation checked:

- A maximum 4-billion-VND/two-bedroom search rendered the same four demo homes and map controls/pins.
- A card opened demo-05; a map pin opened demo-03. Both could be selected with the original requirements retained.
- After context hydration, details displayed the two evidence sections with explicit missing-approved-source states and the qualification that fictional homes are not attached to real projects.
- In-app comparison retained demo-05/demo-03 and their 400-million-VND/3-m² differences. Per-home source disclosures rendered at the host's 320-pixel workspace width, with the composer available and the table using its own scrolling area.
- A composer question without typed property IDs correctly compared the selected homes. The prompt explicitly requested `get_project_evidence`; the answer stated that both homes lacked approved project sources and did not invent an assessment. This verifies the visible response; the inspected host raw-call panel exposed a generic activity summary rather than a structured evidence payload. The HTTP/MCP test is the direct verification of the tool's request/response contract. Natural-language routing to that new tool without naming it remains unverified.
- Clicking comparison **Cần xác minh gì?** delivered the natural-language verification prompt for the captured demo-05/demo-03 comparison and maximum-4-billion-VND/two-bedroom requirements. Its panel showed **Đã gửi đến ChatGPT** with the return action. The answer retained both identities, said there were no approved official/community sources to cite, and produced verification questions without inventing source links or publication dates. The host appended the answer to the existing response, consistent with the previously recorded message behavior.

Hosted conversation: https://chatgpt.com/c/6addf851-2b38-83ec-90df-2153216f573a

This is a demo/fixture validation, not a live supplier or forum-data pilot. Public source navigation, populated evidence in ChatGPT with permitted real material, physical mobile/light-mode behavior and forced evidence retrieval failures remain unverified. The current implementation supports reviewed summaries; scheduled collection, supplier/ forum access agreements, media, retention/purge automation and shared production hosting remain outstanding.

### Source-link research integration (1 November 2026)

The optional source-link research surface is implemented with `RESEARCH_LINKS_ENABLED=1`, alongside the unchanged v12 property explorer. It uses **`ui://hanoi-home/research-v1.html`** and five separate research tools; the read-only projection currently contains seven manually curated OTOFUN source links, not approved listings. Full post bodies, author replies, contacts and operator records are excluded. See [the integration record](chatgpt-research-integration.md) for the tool/data boundary, startup and curation details.

Validation for this revision:

- **Local checks:** both widgets rebuilt, expanded syntax checks passed, and all **36 Node tests** passed (31 existing plus 5 new research/domain/protocol cases). The Python crawler was unchanged and its suite was not rerun for this integration.
- **Local browser:** the standalone research view displayed seven sources. Selecting Samsora and CT1A-ĐN1/Mỹ Đình rapidly, then comparing, retained exactly those identities. Comparison showed `78 triệu /m²` as a rate, preserved uncertain expressions and unknowns, and computed no price difference. At a 390-pixel viewport the comparison table scrolled inside its own 354-pixel container, with no page overflow. Light and dark rendering, visible source disclaimers, loading/empty results and offline failure recovery were checked. A light-mode screenshot confirmed readable controls/cards. These are browser emulations, not a physical mobile device or complete assistive-technology pass.
- **Public MCP:** initialization, discovery of all five research tools, seven-source search and the v1 resource succeeded at `https://cc57-103-238-69-196.ngrok-free.app/mcp` during the temporary test. The response excluded private post bodies. That tunnel is now stopped; this is historical protocol evidence, not a currently reachable app URL.
- **Actual ChatGPT host:** the new app connected at `https://2c68-103-238-69-196.ngrok-free.app/mcp`. In a fresh conversation, a natural-language request for collected source leads rendered all seven sources, with three expired-source labels and no demo homes.

The user explicitly authorized a replacement public endpoint and approved creating/connecting **Nhà Hà Nội · Nguồn & Demo**, including relevant chat content and enabled-memory sharing with their local server at the new URL. The earlier automatic-review block was resolved by that authorization. The old app remains installed: its URL is offline and its settings had no endpoint editor; reclaiming it failed with ngrok's free-plan restriction `ERR_NGROK_313`.

Initialization, all five research tools and seven-source search passed through the replacement URL. The new app details show **Try in chat**. App: https://chatgpt.com/plugins/plugin_asdk_app_6ae622f726fc8191929b62853ccd1773 . Keep the server and tunnel alive; this is still a temporary, unauthenticated development connection.

Observed hosted flow:

- Selecting Samsora and CT1A-ĐN1/Mỹ Đình through the widget reached **ChatGPT đã nhận lựa chọn**. In-app comparison retained exactly those sources, their distinct price expressions and unknown availability/completion/legal status, with the composer accessible.
- Asking to compare “hai nguồn tôi vừa chọn” without IDs correctly returned Samsora and CT1A-ĐN1/Mỹ Đình. The answer linked each original OTOFUN post, gave publication dates 6 October and 22 October 2026, distinguished `78 triệu /m²` from an unconfirmed total price, and declined to compute a total-price difference or claim a requirement match.
- **Nhờ ChatGPT nêu điểm cần xác minh** displayed **Đã gửi câu hỏi…** for the captured pair. ChatGPT produced another source-linked verification answer for the same pair, preserving dates, rate basis and unknowns. In this host session the contextual prompt appeared as a visible user turn; older demo-host message presentation above remains historical behavior.
- Expanding the workspace retained the comparison and composer. Returning to the list and opening Samsora showed separate source-publication, edit and collection dates, uncertainty notes and the original link. **Mở bài gốc trên diễn đàn** invoked ChatGPT's ordinary external-link confirmation and then opened the correct public OTOFUN post in a new task tab.
- Manual curation removed amenity areas and duplicate tokens from source summaries, combined Xuân Mai's `4 tỷ 550 triệu` expression, distinguished its three bedrooms from two naturally lit bedrooms, and excluded Học Viện Hậu Cần's proposed extra bedroom from the current-room summary. A direct projection check retained seven sources and all unknown/eligibility boundaries.

Host rendering and behavior were inspected through accessibility state. The new research view was not visually certified at the host's minimum workspace width or on a physical mobile device. Local 390-pixel light/dark checks, a light-mode screenshot and overflow measurements provide separate layout evidence. Hosted forced failures/retry, a complete keyboard/screen-reader pass, broader routing prompts and multi-user production behavior remain unverified. These links are unverified research leads, not approved real inventory or a market-price feed.

Research-host test conversation: https://chatgpt.com/c/6ae6233b-edb4-83ec-89e3-74bd11d56c91

### Stable Vercel/Supabase hosting (1 November 2026)

The user requested new Vercel/Supabase projects and CI/CD. The repo now has pinned CLIs, a serverless entry point, Vercel routing/artifact exclusions, service-only Supabase schema and compare-and-set session persistence, a reviewed minimal research sync, and a checks-before-production GitHub Actions workflow. See [deployment operations](deployment.md) and `npm run setup:deploy` for the account/secret steps. Browser setup uses Brave; Chrome is reserved for the user's personal use.

Local validation for this hosting change: both widgets rebuild, syntax checks pass, 43 regular Node tests pass (the real-Supabase case is skipped in the default suite and run separately), all 39 Python tests pass, all 12 PostgreSQL tests pass, and the separate real Supabase HTTP/MCP test passes. That integration test used synthetic sources in an isolated local stack and three independent Node processes; selections, focus and hard requirements survived a process replacement, research comparison resolved through the session without IDs, and a withdrawn source left the stored selection. Test shutdown was corrected to recognize signal-terminated children, and temporary debug instrumentation was removed.

Vercel configuration was checked against the current official schema after normalizing three unrelated vendor-schema keywords from newer draft syntax to the schema's declared Draft 4. Workflow YAML parses; shell syntax checks pass. ShellCheck passes the authored code with SC1087/SC2329 excluded for the unchanged wizard library's prompt-string/unused-helper diagnostics. Runtime dependency audit has zero reported vulnerabilities. The current Vercel CLI dependency tree still has development-only advisory findings; the lockfile overrides its affected `tar` dependency to 7.5.22. No forced downgrade or unrelated runtime dependency replacement was applied.

Both cloud projects are linked, six GitHub CI secret names are configured, and the public `APP_BASE_URL` repository variable targets the canonical Vercel URL. The user corrected the scoped Supabase token and database password; cloud migrations and the seven-source minimal sync completed. No private source body, contact, reply, manifest or SQLite database was uploaded. The user connected their GitHub identity to Vercel for commit-author verification and manually bootstrapped `main` as required by the global pre-push guard. No guard was disabled or bypassed by the agent. Subsequent changes use checked feature-branch pull requests.

The first production run exposed a prebuilt-upload exclusion of the widget HTML. [PR #1](https://github.com/kamikaze011001/vn-real-estate-gpt/pull/1) corrected packaging. [The next main run](https://github.com/kamikaze011001/vn-real-estate-gpt/actions/runs/41232118572) successfully applied migrations and deployed/promoted Vercel, but failed afterward because its readiness parser expected the local native CLI's JSON envelope rather than Linux's output. The follow-up removes that parser: the CLI exit status gates the deployment step, and the existing protocol smoke checks the public canonical `APP_BASE_URL`. Protected per-deployment URLs are not used for public checks. The [workflow](https://github.com/kamikaze011001/vn-real-estate-gpt/actions/workflows/ci.yml) is the release verification record; a deployed URL alone does not establish a passing release.

Stable-endpoint verification is separate from the earlier local and tunnel evidence:

- **Local/database:** the build, 43 regular Node tests, 39 Python tests, 12 PostgreSQL checks and separate three-process hosted-state test described above passed.
- **Public protocol:** `EXPECT_HOSTED=1 npm run deploy:smoke -- https://vn-real-estate-gpt.vercel.app` passed with `sessionBackend: supabase`, seven sources, both embedded resources, demo selection/comparison and research comparison resolved from session IDs.
- **Actual ChatGPT host in Brave:** the user approved creating/connecting **Nhà Hà Nội**, including relevant-chat/enabled-memory sharing with the stable endpoint. A fresh conversation rendered all seven sources with expired/unverified labels. Selecting Samsora Vạn Phúc and CT1A-ĐN1/Mỹ Đình II showed **ChatGPT đã nhận lựa chọn**. A composer request without source IDs identified that pair, linked original OTOFUN posts and publication dates, and preserved unknown availability, completion and legal status. The answer distinguished the `78 triệu /m²` rate from an unconfirmed total; it also calculated a clearly conditional reference total, not a confirmed asking price or requirement match.
- **Demo map-to-chat:** in the same conversation, a maximum-4-billion-VND / at-least-two-bedroom demo search returned four fictional homes. Selecting demo-05 through its 2.8-billion map pin and demo-03 through its 3.2-billion pin synchronized successfully. In-app comparison showed 400 million VND / 3 m² differences. A composer request without IDs identified those exact two demo homes, retained the requirements and fictional labels, and did not reuse the research selections. Expanded comparison and the system composer remained accessible.

Stable-host conversation: https://chatgpt.com/c/6ae63a8e-20cc-83ec-940e-eb80f5f1fd94

These hosted checks used accessibility state. Minimum-width visual inspection, physical mobile safe areas, forced send failures/retries, a complete keyboard/screen-reader pass and multi-user load were not repeated for the stable deployment. Earlier local layout evidence remains separate. The cloud source snapshot updates only after a reviewed manual sync; expiry is checked on each operation. This is stable pilot hosting, not verified listings or an automatic market feed.

### Shared Hanoi enrichment (1 November 2026)

The approved dataset strategy now covers Hanoi areas and budgets, with buyer-specific filters applied at search time. [Daily operations](daily-data-operations.md) records the shared Supabase catalogue, candidate inbox, revision-bound review and bounded scheduled Python worker. Collection/review/publishing commands remain private; the MCP tools, resource URIs and widget bridge are unchanged. The deployed app retains fictional inventory and the separate seven-source reviewed research snapshot; daily candidates are not auto-published there.

Local validation adds a catalogue snapshot round-trip, minimal candidate-projection/access-stop tests, database permission/lease/CAS checks and an actual local Supabase real-mode regression with two independent MCP instances. The real-mode fixtures stay in the isolated local stack. Cloud deployment and daily worker outcomes are recorded by the [deployment workflow](https://github.com/kamikaze011001/vn-real-estate-gpt/actions/workflows/ci.yml) and [daily workflow](https://github.com/kamikaze011001/vn-real-estate-gpt/actions/workflows/data-enrichment.yml); scheduled fetches do not confirm availability or source reuse rights.

### Brand and onboarding update (1 November 2026)

[Branding and user guidance](plugin-branding.md) adds an original terracotta apartment/conversation icon and a Vietnamese landing page at the canonical website. The standalone explorer moves to `/demo`; embedded resources and source/property selection flows retain their existing IDs. MCP identity now supplies `title`, `description`, `websiteUrl` and a square PNG icon. These fields need an app refresh; their protocol availability is separate from whether ChatGPT displays them. Current source links remain unverified and inventory remains fictional.

The landing page includes three copyable prompts, the select-then-compare journey, source-versus-demo labels and FAQ. The metadata source is `data/plugin-profile.json`. Local HTTP/MCP and production smoke checks cover the landing page, demo route and icon packaging. Hosted metadata display and a fresh conversational regression must be checked separately in Brave after deployment.

### Earlier demo verification limits

A separate [private lead-review preview](private-lead-preview.md) is available only on `http://127.0.0.1:8790`. It renders retained unverified forum ads for local operator inspection and has no `/mcp`, publication actions or tunnel. This is not a second ChatGPT connection and does not change this connection's demo inventory, v12 resource or selection mechanism. Its local browser and regression results are recorded separately; they do not establish a real-inventory ChatGPT-host pilot.

Earlier demo build/syntax checks and 31 automated tests passed; the earlier 36-test research revision is recorded above. Earlier local browser checks covered saving, empty search results, and a 390-pixel viewport; those demo cases have not all been repeated for the latest research revision. Hosted light mode, physical mobile-device safe areas, forced send failures/retry, and a complete keyboard/screen-reader pass remain unverified. This verifies the prototype and source-link research flow, not approved live inventory, real market insights, multi-user production operation, or a production-ready public market service.

Current official setup: [Connect and test your plugin](https://developers.openai.com/plugins/deploy/connect-chatgpt).

UI decisions follow [OpenAI UI guidelines](https://developers.openai.com/plugins/concepts/ui-guidelines); host styles and display modes use the [MCP Apps UI bridge](https://developers.openai.com/plugins/build/chatgpt-ui).

### Branded private package installation (1 November 2026)

After explicit approval, the private package was uploaded and installed as [Nhà Hà Nội](https://chatgpt.com/plugins/Plugin_791fee034de48191a4ac5cfd580c5bd0). The actual ChatGPT profile displays the original terracotta icon, short/long descriptions, three starter prompts, one linked MCP app, the setup skill and a Website link pointing to `https://vn-real-estate-gpt.vercel.app/`. The existing `asdk_app_6ae63a3ba2e8819188187ad247dcf9fe` connection is retained; the package adds presentation and onboarding rather than registering another endpoint. No public-directory submission occurred.

The archive uploader first exposed a stale selected-file error, resolved by rebuilding before selecting the ZIP, then required the underlying App ID rather than the browser wrapper ID. The package builder now validates that mapping. The supported package mechanism follows the official [registered MCP plugin workflow](https://developers.openai.com/plugins/build/plugins#create-and-test-a-plugin-locally-with-an-mcp-server).

The installed package's **Set up Nhà Hà Nội** action invoked its bundled setup skill in a new ChatGPT conversation and opened the existing seven-source explorer. Selecting Samsora Vạn Phúc and CT1A-ĐN1/Mỹ Đình II produced **ChatGPT đã nhận lựa chọn**. The exact starter prompt “So sánh hai nguồn tôi vừa chọn. Dẫn link gốc và nêu những gì cần xác minh.” returned that pair without typed IDs, cited both original OTOFUN posts and dates, retained unknown availability/completion/legal claims, and distinguished the per-m² rate from an unconfirmed total. The answer computed no price difference. The expanded source comparison and composer remained available.

Private package setup/comparison conversation: https://chatgpt.com/c/6ae6b6a9-db90-83ec-a047-0067a060029f . Actual-host inspection used Brave accessibility state plus a screenshot confirming the profile icon and Website row; this does not replace physical mobile or a complete screen-reader test.

### Data visibility and worker audit (1 November 2026)

After the user reported seeing demo inventory, a [pipeline audit](data-pipeline-audit-2026-11-01.md) confirmed seven minimal shared candidates, seven independently curated public source summaries, zero shared candidate decisions and an empty approved catalogue. The local retained raw inbox contains 113 source identities, not 113 apartments. The deployed health endpoint still reports demo mode. This records an unfinished serving/publication integration; it does not claim that daily candidates appear in property search.

The first scheduled worker failed after the earlier successful probe. A new bounded local access check received HTTP 503 from OTOFUN robots policy and successfully parsed the VOZ feed. Historical runner causes were not retained in the old aggregate summary. Worker diagnostics now retain safe per-source counts and separate latest-run health from freshness; the [daily workflow history](https://github.com/kamikaze011001/vn-real-estate-gpt/actions/workflows/data-enrichment.yml) is the actual runner verification record. Local regression validation passes 47 Python tests. No MCP tool/resource/connection or UI changes are made, and no new actual-ChatGPT test is claimed for this worker-only change.

Follow-up [OTOFUN diagnosis](otofun-diagnosis-2026-11-01.md) records the detailed GitHub failure (VOZ `ok`, OTOFUN `failed`), a matching local/curl 503 server-unavailable response, and a worker mitigation that stops a publisher for the current run after network/5xx failure. All 51 local Python tests pass. A bounded local worker using the cloud inbox reduced the OTOFUN attempt to two requests (robots 200, page 503), one error, while VOZ continued successfully; this does not claim the external failure is repaired or that the changed code has passed a new GitHub-runner probe. [Additional source research](../research/hanoi-source-expansion-2026-11-01.md) covers portals/agencies, Facebook and official context without activating collection or publishing inventory. Public tools/resources and the ChatGPT connection remain unchanged.

The user then prioritized free-first sources and useful insights. [Transport and quality research](../research/hanoi-free-data-and-insights-2026-11-01.md) records five readable portal categories, one 403 stop, working CafeF/Báo Xây dựng RSS, a stale CafeF project channel, and a Ministry TLS failure. A four-ad quality sample found lifecycle, quantity and building-identity conflicts; no source was activated as a new daily collector and no new inventory/insight was published. Native Brave verified the agency-linked public Tan Long Land Facebook Page after dismissing a login suggestion, without signing in. This establishes a human-visible source, not an authorized Facebook automation route.

### Normal Python fetcher follow-up

The user requested normal Python crawling after a Requests/BeautifulSoup prototype obtained HTTP 200 for the exact OTOFUN thread and both parsers found the same opening-post identity. The branch now provides a pinned Requests fetcher for OTOFUN, a read-only BeautifulSoup identity cross-check, project Python environment selection and CI dependency installation. VOZ keeps its previous urllib/profile after the initial blanket migration encountered a VOZ 403; there is no automatic profile fallback. All 55 local Python tests pass. The first integrated OTOFUN probe and bounded local pipeline run still failed with timeout; the earlier successful prototype does not establish reliable scheduled access. These are local worker results, not a successful GitHub probe or a ChatGPT UI change. See the [updated diagnosis](otofun-diagnosis-2026-11-01.md).
