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


### Source resilience — 1 November 2026

The user accepted intermittent OTOFUN availability and requested continued collection from healthy sources. The worker now isolates each publisher's transport, temporary inbox and exceptions, enforces a two-minute source budget, and saves healthy-source metadata during partial runs. An additive Supabase migration stores failure counts, cooldown deadlines and last full success; exponential backoff, access-block waits and HTTP `Retry-After` are respected. OTOFUN remains enabled. Partial/deferred runs produce CI warnings, while total source failure and shared persistence errors remain failures. Skipped sources keep their original observation and retry dates; recovery clears the cooldown only after a successful check. See [daily operations](daily-data-operations.md#daily-collection).

Local validation passes all 64 Python tests, covering source isolation, adapter crashes, source time budgets, cooldown/recovery and private-field exclusion, plus all 57 database assertions for persisted backoff and permissions. Both existing local hosted MCP/state integration cases also pass after a local-only database reset. A synthetic local HTTP/RPC check exercised successive partial, cooldown, recovery and deferred runs against the isolated Supabase stack and retained the healthy-source candidate. These checks make no public source requests. GitHub CI/deployment and a live bounded collection check remain pending at this revision. There are no MCP/resource/connection or UI changes, no new ChatGPT host test, and no new public inventory.


#### Merged production verification

[PR #10](https://github.com/kamikaze011001/vn-real-estate-gpt/pull/10) merged as `11ca50eb9c087a3ebcd133327b064dea1c7750e8`. [The release workflow](https://github.com/kamikaze011001/vn-real-estate-gpt/actions/runs/41286384211) passed app/database checks, applied the additive migration, deployed Vercel and passed health/MCP/resource/persisted-selection smoke checks.

One [bounded collection check](https://github.com/kamikaze011001/vn-real-estate-gpt/actions/runs/41286572368) on that revision completed on 1 November 2026 at 07:54:34 UTC (14:54 Vietnam time), with zero source errors. OTOFUN recovered: 23 HTTP 200 responses and 12 source records observed; VOZ returned four HTTP 200 responses and three records observed. Seven candidate records were processed; seven unexpired candidates remain stored. Both sources stay scheduled, report `ok`, have failure counts zero and null retry deadlines, and share the successful check timestamp. No raw bodies were uploaded and no listings were published; the approved catalogue remains empty.

This live run verifies recovery after an earlier failure. It did not encounter an outage, so partial-success/cooldown-skip/time-budget behavior remains verified by the 64 Python tests, 57 database assertions and synthetic local HTTP/RPC integration rather than a live outage on this revision. No artificial production failure or extra collection rerun was introduced. No new actual-ChatGPT UI test is claimed.


### Live source-link page — 1 November 2026

The website and hosted research tools now read the daily Supabase candidate projection instead of using the manual research snapshot as the source of membership and check dates. The landing page previews up to six of the latest 100 retained records and links to `/research`, where exact source details, selection and comparison remain available. Old curated names and caveats are retained only for matching source identities; new records use known project labels or a generic publisher/thread label. Unknowns, rate basis, source-expired labels and source-read dates remain explicit. No raw posts, contacts, review notes or approved listings are published. [Design and operations](daily-data-operations.md#live-source-link-serving) retain the official OpenAI references and data contract.

The research resource changes to `ui://hanoi-home/research-v2.html`; standard bridge/server selections are preserved. Local Brave shows seven actual Supabase source records, correct landing-card deep links, source details, keyboard search, empty results and the compact single-column layout at 250% browser zoom. The local check used the OS dark theme for the explorer and the established light landing page. This is not a physical-mobile or new actual-ChatGPT host result. Local verification passes syntax/build checks, 49 app tests (plus two separately run hosted cases), all 57 database assertions, and the multi-run source resilience HTTP/RPC check. The actual local Supabase integration also verifies that the public preview creates no session, uses current candidate dates, omits private fields and removes withdrawn source selections across cold starts. Production deployment, live protocol and host verification remain pending at this revision.


#### Live-source release verification

[PR #11](https://github.com/kamikaze011001/vn-real-estate-gpt/pull/11) merged as `b17aee84d3dd181e182c926d5e865fd4a188bd57`. [Production release](https://github.com/kamikaze011001/vn-real-estate-gpt/actions/runs/41287776143) passed app/database checks, Vercel artifact checks and public health/MCP/resource/selection smoke checks. The public `GET /api/research/leads` returned all seven current source records on 1 November 2026 at 08:14 UTC, with `Cache-Control: no-store`, no new selection session, null canonical prices and no approved-inventory claim. The root previews six cards and links to all seven at `/research`; these reflect the 14:54 Vietnam-time source reads from the successful crawler run.

**Actual website:** Brave visibly rendered the deployed landing preview with seven-source count, read dates, rate/month distinctions and source-expired labels. The local Brave test also exercised a preview-to-Samsora detail link, selection/comparison, keyboard search, empty results and the compact layout at 250% browser zoom.

**Actual ChatGPT host:** refreshed tools on the existing stable Vercel app, then started a fresh conversation from the installed plugin's source starter. The new research widget rendered seven live records and current read timestamps. The expanded narrow side pane retained the system composer. Selecting OTOFUN #1969024 and the 360 Giải Phóng source produced “ChatGPT đã nhận lựa chọn”. The natural-language prompt asking to compare the two selected sources, with no IDs, returned that exact pair with original links and source dates. It preserved unknown price/area/availability/legal evidence and made no numerical price or area comparison. This verifies the new hosted research data path and existing selection mechanism; it does not establish a supplier-verified inventory, physical-mobile or complete screen-reader pilot.


### Persistent discovery — 1 November 2026

The user requested continuing data expansion and opening the data page. Brave opened the deployed `/research` view with its current seven-source count. A regression reproduced the collection bottleneck: a refreshed known post consumed a new-opening slot and hid a novel post. The fix separates a four-candidate refresh budget per source from OTOFUN discovery, rotates historical index pages and persists unfetched links in a private Supabase frontier. Candidate, source-health and progress changes finalize atomically. Existing source permissions, robots policy, outage cooldowns, retention, public projection and unknown inventory facts remain. No new source adapter, tool/resource metadata or widget change is made.

Local validation passes 67 Python tests and 77 database assertions. Both existing actual local Supabase/MCP integration cases pass, and the synthetic HTTP/RPC check proves that two independent workers add different queued candidates and advance saved pages without refetching the known candidate. No external forum requests occur in these fixtures. GitHub CI, additive cloud migration and one bounded live backfill remain pending at this revision. The actual ChatGPT selection/comparison result from the preceding live-source release is unchanged; no new host test is claimed for this worker-only change. See [discovery operations](daily-data-operations.md#persistent-discovery-and-bounded-backfill).


#### Live discovery growth verification

[PR #12](https://github.com/kamikaze011001/vn-real-estate-gpt/pull/12) merged as `4c7be05d6776cd19b5bfe7570ef5319734228aa7`; [release and additive migration](https://github.com/kamikaze011001/vn-real-estate-gpt/actions/runs/41289672631) passed all checks. One [bounded five-page/twenty-opening backfill](https://github.com/kamikaze011001/vn-real-estate-gpt/actions/runs/41289880711) completed without source errors at 08:41:59 UTC (15:41 Vietnam time). OTOFUN read five index pages containing 150 thread titles, attempted twelve eligible new openings, refreshed four existing records and projected eleven candidate snapshots, seven of them newly discovered. The classified OTOFUN observations were four excluded, ten needing context and two apartment-offer candidates. VOZ read three discussion records and added no candidates. These are processing counts, not counts of verified available homes.

The public source dataset grew from seven to fourteen stable records, with seven new public IDs and all prior IDs retained. Source progress persisted at backfill page eight; fifteen private frontier identities are retained. Both sources remain scheduled with `ok` status, zero failure counts and no cooldown. Raw bodies were not uploaded and no approved listings were published. Brave opened a fresh `/research` tab and visibly confirmed fourteen sources with the 15:41 read timestamp, leaving the user's Google search tab untouched. This worker-only change reuses the previously tested source explorer and its selection bridge; no new actual-ChatGPT conversational test is claimed.


### Usable-supply expansion — 1 November 2026

The approved checkpoint is 100 usable provisional ad groups across ten Hanoi projects, with a seven-day feasibility review and a 15-minute daily exception budget. The source reader now separates usable, unresolved research and temporary archives; source/ad/supplier freshness and revision-bound private assessments govern membership. It preserves unknown canonical prices/availability and separate evidence for suspected duplicates. Public responses paginate twenty rows and expose global coverage counters. The research resource changes to `ui://hanoi-home/research-v3.html`; refresh tools/resources and start a fresh conversation after deployment. No new public write/review tool is added.

The private worker gains refresh-only sweeps, twelve checks per source three times/day, with current usable reviews prioritized and existing source cooldown/budgets retained. The supplier pack uses the existing permissioned catalogue; it is not silently added to forum counters. Muaban remains disabled pending intended-use clarification; no supplier contacts or messages were sent. [Operating plan and official API references](usable-supply-operations.md).

Local validation: app build/syntax, 54 app tests (plus two separately run hosted cases), 69 Python tests, freshness/duplicate/pagination regressions, 91 database assertions and both local hosted MCP cases pass. The local HTTP/RPC source resilience check also passes. Brave renders the zero-usable state, all/archive cards, keyboard-operated filters and two-source comparison with disposable TEST ONLY fixtures in dark theme, including the responsive filter/selection layout and horizontally scrollable comparison at 200% browser zoom. Production and actual-host verification are pending at this revision; these local results do not establish live usable supply or supplier availability.


#### Usable-supply live release and worker check

The user merged [PR #13](https://github.com/kamikaze011001/vn-real-estate-gpt/pull/13) as `9e35953cfca45249f709013d9a17bab350281c7f`. [Release](https://github.com/kamikaze011001/vn-real-estate-gpt/actions/runs/41293635495) passed app/database checks, applied the additive assessment migration, deployed Vercel and passed public MCP/resource/selection smoke verification. At 09:36 UTC / 16:36 Vietnam time, the private baseline and public GET agreed: fourteen collected records, zero usable ad groups/projects, five needing context and nine archived. All four GET scopes returned 200 with no-store and canonical price/area/availability unknowns preserved. The ignored baseline file is mode 0600; no review events exist yet, so operating effort/yield remain unmeasured.

One [refresh-only worker check](https://github.com/kamikaze011001/vn-real-estate-gpt/actions/runs/41293857311) failed honestly: OTOFUN robots returned 503 on the first request; VOZ was idle because it has no existing eligible candidate. The source failure count became one with retry-after 09:51:44 UTC (15-minute cooldown). No new source read or availability was asserted, all fourteen records survived, and the discovery cursors stayed at OTOFUN page eight / VOZ page two. No retry, alternate transport or policy bypass followed. This verifies preservation/backoff on a live outage, not a successful live refresh or freshness guarantee. Local synthetic tests separately verify healthy-source progress alongside a failed source.

Brave visibly confirmed the deployed landing counts and its link to five unresolved records. After refreshing the existing ChatGPT app, a fresh [host conversation](https://chatgpt.com/c/6ae7085f-47e0-83ec-9cd6-17e566178f91) rendered research-v3 and the same counts. The usable-only filter showed zero with a working route back to unresolved research. In the expanded narrow side pane, selecting Xuân Mai Spark and CT1A-ĐN1 / Mỹ Đình II synchronized both records; the system composer remained visible. The natural-language no-ID comparison returned that exact pair with original source links and 5/22 October dates. It kept “4 tỷ” and “550 triệu” ambiguous, retained the Mỹ Đình price rate and missing total, noted conflicting room counts, and distinguished the 1 November collection date from availability confirmation. It made no total-price difference or hard-constraint-match claim. This passes the deployed selection/composer regression; physical-mobile, full screen-reader and a supplier-verified inventory pilot remain unverified.


#### Unchanged count follow-up — 1 November, 16:52 Vietnam time

The user reported that search still showed fourteen. A read-only production comparison reproduced the symptom: public all-scope total and retained Supabase candidate count both fourteen, with no-store responses. The previous release had added quality/refresh operations, not a new acquisition source or supplier batch; its only post-release collection had been refresh-only and failed on OTOFUN 503. Therefore the unchanged count reflected the actual dataset, not a newly observed search-cap defect. No code fix or synthetic green growth assertion was appropriate.

After the saved cooldown expired, one [bounded discovery run](https://github.com/kamikaze011001/vn-real-estate-gpt/actions/runs/41294957871) used five-page/twenty-opening limits. It completed partially at 09:52:26 UTC: OTOFUN timed out before any source records were observed; VOZ completed four HTTP 200 requests and observed three discussion records, none eligible as a public sale candidate. Zero candidates were added, the public count remained fourteen, discovery progress remained page eight/two, and OTOFUN backoff increased to thirty minutes (retry-after 10:22:26 UTC). Healthy-source progress was retained beside the failed source. No further retry or source-access bypass was performed. The larger dataset remains an acquisition deliverable, not an achieved result of the pipeline release.


### Alonhadat acquisition implementation — 1 November 2026

The user requested a working new source and actual imports beyond fourteen. [Research](../research/additional-source-acquisition-2026-11-01.md) established ordinary Requests access to the Hanoi category/details and documented copying/date uncertainties. The separate [facts-and-links adapter](alonhadat-acquisition.md) uses the existing robots-aware transport with exact ad-ID binding, numeric VND/m² validation, private persistent pending links and independent progress/backoff. No descriptions, titles, contacts, photos or approved inventory are copied. A migration registers the source disabled until deployment/activation verification.

A bounded real parser check read one index and three details, all HTTP 200, producing three minimal candidate projections. It separately retained the displayed portal date; original publication/genuine-edit times remain unknown. Local source/RPC tests pass, including persistence of parsed Alonhadat facts while OTOFUN fails, pending-link continuation, same-ID renamed URLs, private-field exclusion and mixed-source MCP selection/comparison. Local validation includes 55 app tests plus two separately run hosted cases, 75 Python tests, 101 database assertions, syntax and widget build. The app retains the existing interactive-decoupled bridge/selections and changes the research resource to `ui://hanoi-home/research-v4.html`. Live migration/activation, GitHub-worker import, public growth and actual ChatGPT checks are pending at this revision; no new live inventory is claimed.


#### Alonhadat release and first import

[PR #14](https://github.com/kamikaze011001/vn-real-estate-gpt/pull/14) merged as `8f3612377ed9f8257c2c387bc1c8a54d2663a9ea`. [Production release](https://github.com/kamikaze011001/vn-real-estate-gpt/actions/runs/41300318902) passed migration, Vercel and MCP/resource smoke. Alonhadat was then activated. The [first GitHub discovery](https://github.com/kamikaze011001/vn-real-estate-gpt/actions/runs/41300601270) completed partially at 11:10 UTC: Alonhadat robots200/category429, zero portal observations and blocked cooldown; OTOFUN recovered with five new candidates and four refreshes; VOZ produced no eligible sale candidates. Public count grew14→19, all prior IDs retained. This is not a successful GitHub Alonhadat collection.

The three earlier local successful parser samples were imported separately from their pre-existing minimal output. No new publisher request followed the429. `checked_at` uses the original successful probe batch completion (10:58:27 UTC, output file modification time; not an exact per-page timestamp), and retention ends fourteen days after that observation, not after import. No raw bodies, contacts or photos were present. Source block/retry deadline stayed identical, and the import was labelled partial to retain degraded health reporting. These are research-only references; current availability, completion and original/genuine dates remain unknown. Further worker access must be proven through the read-only preflight rather than inferred from local access.


### Worker-verified Rongbay fallback

The public dataset reached 22 records after the three earlier local Alonhadat observations were imported without new source requests. Original publication remained null, displayed dates were separated, and all eight unresolved/fourteen archived records stayed outside usable supply. In a fresh [ChatGPT conversation](https://chatgpt.com/c/6ae71fef-2b4c-83ec-b377-6d0e3a9f6d23), research-v4 rendered 22 collected records and publisher-name search found exactly the three Alonhadat references. Selecting Thông Tấn Xã and 25 Tân Mai synchronized; no-ID comparison was submitted, and ChatGPT returned that exact pair with original links, displayed 28 October dates separated from unknown original publication, area uncertainties and unverified availability/legal status.

[PR15](https://github.com/kamikaze011001/vn-real-estate-gpt/pull/15) added read-only worker preflight and failed-opening quota enforcement. The [actual Rongbay preflight](https://github.com/kamikaze011001/vn-real-estate-gpt/actions/runs/41301365157) passed robots/category/two details with HTTP 200 and 47 discovered links. Its local scoped parser then observed three detail pages and produced one qualifying research reference, skipping unrelated advertisements. Rongbay adapter/migration validation passes 56 app tests plus two hosted cases, 82 Python tests and 111 database assertions. Actual import/deployment and host selection remain pending at this revision; a successful preflight is not an ongoing source SLA or proof of apartment availability.


#### Live Rongbay import and actual growth

[PR16](https://github.com/kamikaze011001/vn-real-estate-gpt/pull/16) merged as `d67793bab72b00740603525d3feb99c26475cc6c`; [release](https://github.com/kamikaze011001/vn-real-estate-gpt/actions/runs/41302123586) passed migration, Vercel and public protocol/resource/selection smoke. Rongbay was activated only after that release. The [bounded live import](https://github.com/kamikaze011001/vn-real-estate-gpt/actions/runs/41304705785) completed at 12:06:29 UTC / 19:06 Vietnam time, growing public 22→44: nine Rongbay additions and thirteen OTOFUN additions, plus four OTOFUN refreshes. Rongbay read five index pages and twenty detail openings (twenty-six HTTP 200 responses, zero errors), projected nine eligible research references and saved its cursor at page six. OTOFUN saved page sixteen; VOZ added no eligible sale references.

Alonhadat was skipped under its unchanged 24-hour cooldown, with zero publisher requests; other sources completed and their records persisted. The run correctly reports partial because one source is cooling down, not because a healthy-source import failed. All prior 22 IDs were retained across three public result pages. Verified public distribution: 32 OTOFUN, 9 Rongbay, 3 Alonhadat; 17 unresolved and 27 archived; zero usable groups and zero approved inventory. Canonical quantities/availability remain unknown. No descriptions, contacts, photos or raw bodies were uploaded. These are 44 source-ad references, not 44 available apartments or a market-wide sample. Regular discovery/refresh schedules and per-source guards remain active; this initial success does not establish an ongoing SLA.


**Actual Rongbay host check:** refreshed tool metadata on the existing stable connection and started a fresh [ChatGPT conversation](https://chatgpt.com/c/6ae73087-7fe0-83ec-ba94-62cdfd3ba587). The widget showed 44 collected, 17 unresolved and 27 archived; a publisher-name search returned all nine imported Rongbay references. Expanded display retained the system composer. Selecting OCT3A Resco Cổ Nhuế (#32830013) and CT36 Định Công (#34423215) synchronized both records; the natural-language no-ID comparison was submitted. ChatGPT returned exactly OCT3A Resco and CT36 with original links, source quantities kept as unverified expressions, displayed 1 November dates separated from unknown original/genuine-edit dates, and an explicit Resco area discrepancy. It declined price-per-area/difference or suitability conclusions without better evidence. The narrow expanded pane and system composer remained usable. This passes actual live-source search/selection/comparison; physical mobile and a complete screen-reader pass remain unverified.


### Viewing preparation implementation — 1 November 2026

Approved feature and operating rules: [viewing brief](viewing-brief.md). Research resource advances to `ui://hanoi-home/research-v5.html`; data-only `get_viewing_brief` and render `show_viewing_brief` preserve comparison selections and explicitly inherited requirements. Reviewed factual context remains conditional on current source-revision identity review; exact-building notes require an exact match. Source changes/deadlines regenerate the brief without carrying old applicability forward. No current fee schedule, tower identity or approved inventory is fabricated.

Local validation: syntax/widget build; 64 app tests pass (two hosted cases tested separately), 121 SQL assertions and both local Supabase/independent-instance integrations pass, including stale identity revision invalidation and private-field exclusion. The existing source HTTP/RPC resilience integration also passes. Brave dark/narrow inspection found a sticky-tray obstruction; the tray now hides only while viewing the brief, preserving its selections for return. Live release, tool refresh and actual-ChatGPT verification are pending at this entry. Human pilot tasks remain pending.


### Viewing brief live release and handoff polish — 1 November 2026

[PR17](https://github.com/kamikaze011001/vn-real-estate-gpt/pull/17) merged at `10d0e1572765fbabe5441591d012e9f0966057a1`. [Production migration/deployment/smoke](https://github.com/kamikaze011001/vn-real-estate-gpt/actions/runs/41314447765) passed. Three service-only reviews were applied to the existing source revisions, all **tentative-project**, none exact-building or inventory approval. Live MCP confirmed OCT3A exposes one project identity note, CT36 three historical project notes, TTX two project notes; building-specific OCT3A operating/parking notes stay withheld. The dataset remains 44 source references, 17 needs-context, 27 archive, zero usable groups and zero approved inventory.

In a fresh [ChatGPT conversation in Brave](https://chatgpt.com/c/6ae7482c-dee0-83ec-a233-6a946dcfe3f6), refreshed tools opened nine Rongbay references, retained the explicit five-billion-VND/two-bedroom requirements, synchronized OCT3A+CT36 selections and opened both briefs. Full sources, unknown current fees, unknown exact-building completion and three reasoned questions were visible. A bridge handoff then called the new render tool and preserved both subjects and requirements. The normal composer remained available in the expanded workspace. Separate local Brave checks covered light/dark, narrow layout, keyboard disclosure, missing-source error and recovery to an empty search.

The first live handoff exposed tool/session/research IDs in its visible user message. The follow-up replaces that text with source names and a plain request, captures `briefLeadIds` server-side across browsing, and directs the model to that context. It versions the changed resource to `research-v6`, requiring another tool refresh and fresh-conversation handoff check after release. The hosted test also respects intentionally expiring bundle dates, while always checking that a changed fingerprint removes the identity association. Local syntax/build and 64 app tests pass; both isolated hosted cases and resilience integration pass. Human participant tasks are still pending.


### Readable handoff production verification — 1 November 2026

[PR18](https://github.com/kamikaze011001/vn-real-estate-gpt/pull/18) merged at `3c12d829adb1559300f8040887c60a76a6165f12`; [production checks/deployment/smoke](https://github.com/kamikaze011001/vn-real-estate-gpt/actions/runs/41315648009) passed with `research-v6`. The v5 conversation above also passed a normal-composer request to compare “hai nguồn tôi đã chọn”: ChatGPT resolved the original OCT3A+CT36 pair, retained five-billion/two-bedroom requirements, cited original links and kept raw quantities, area discrepancies, availability, completion and legal claims unverified.

The v6 app tools were refreshed in Brave and the fresh-conversation readable-handoff/captured-subject check passed as recorded below. No Chrome interaction occurred; the task's local preview process was stopped.


Fresh [v6 ChatGPT conversation in Brave](https://chatgpt.com/c/6ae74b70-8834-83ec-97c2-c4a02e273f21): opened nine Rongbay references, saved five-billion/two-bedroom requirements, selected OCT3A and CT36, then opened CT36 details and prepared only that focused ad. The brief retained both comparison selections server-side. Its conversation action visibly sent source names and an ordinary request, without tool names, session UUIDs or research IDs. ChatGPT read the context and rendered exactly one CT36 brief with the same requirements and conditional/historical evidence. A subsequent normal-composer request, “So sánh hai nguồn tôi đã chọn”, resolved **both OCT3A and CT36**, retained the five-billion/two-bedroom requirements, linked the two original ads and preserved uncertain quantities, availability, handover and legal status. Preparing one focused ad did not replace the two comparison selections. Local, protocol, production and actual-host checks have passed; the three human pilot observations remain pending.


### Small-group personal-account distribution and icon revision — 1 November 2026

The user chose a small pilot on separate personal accounts before public-directory publication. The existing private plugin's profile is not a public installer. [Pilot distribution](private-pilot-distribution.md) documents individual custom-MCP setup, account-policy limits, a website fallback and the publicly reachable endpoint boundary. The landing page now leads to `/pilot`, with copyable setup information and a short observed task, rather than promising access through the operator's private plugin URL.

Version0.2.0 packages carry the refined terracotta vector/512px icon and updated viewing-brief onboarding. The private-update ZIP retains the original registered connection; the portable pilot ZIP uses root MCP configuration with the stable endpoint and no operator-specific app dependency. Local schema/package/skill checks, syntax/build, 66 app tests and Brave normal/narrow guide/copy checks passed. The embedded widget binaries and server-backed selection design are unchanged. Live publication of the guide, private-plugin icon update and host metadata verification remain to be recorded after deployment. No public-directory submission was made.
