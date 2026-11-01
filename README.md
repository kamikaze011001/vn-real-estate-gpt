# Nhà Hà Nội

A ChatGPT MCP Apps prototype for discovering and comparing Hanoi apartments. The same component runs in a local browser for quick usability sessions. The default demo has nine fictional properties, labeled in the UI and tool results. An optional real-data mode reads only individually approved catalogue records; no real inventory or market-price evidence is supplied with the repo.

## Run locally

Requires Node.js 22 (22.13 or newer) and npm. Real-data mode uses Node's built-in experimental SQLite module.

```sh
npm install
npm run dev
```

Open **http://localhost:8787** for the landing page, or **http://localhost:8787/demo** for the standalone explorer. The dev command builds the self-contained widget and starts the server. After changing frontend files, run `npm run build` and refresh the browser. Server-file changes restart automatically.

Results start as compact cards with **Xem chi tiết** as the main action. Open a property to inspect its facts and missing evidence, add it to comparison, or ask ChatGPT about that home. Details and comparison are app panels that leave the ChatGPT composer usable. **Khám phá** opens the larger workspace; **Bản đồ** reveals linked pins. Both use fullscreen when supported and remain usable inline otherwise.

Open **Điều kiện** to edit area/name, maximum price, minimum bedrooms, or minimum area. Applied requirements stay visible. Select two or three homes through their details; the named comparison tray appears before the results and stays at the top while scrolling in fullscreen. The **So sánh** view works directly in the app, with an optional ChatGPT action for interpretation. Hearts save a temporary shortlist in the explorer session. Missing prices, areas, and locations remain unknown. The local preview uses structured filters; natural-language conversation is provided by ChatGPT when connected.

Comparison starts with exact asking-price and net-area differences. **Chỉ xem điểm khác biệt** hides equal known attributes while retaining missing availability, legal/fee, and source information. Price or area highlights remain unavailable when evidence is missing or area bases differ; tied homes remain ties.

Property details offer **Phù hợp nhu cầu của tôi?** and **Cần xác minh gì?**. Comparison offers tradeoff and verification questions. Each question captures the specific homes and the requirements at the time of asking. Its delivery panel shows pending/sent/failed status, the exact prompt, and a return action for the original home or comparison. Returning restores the relevant homes without changing current requirements. A failed send can retry the same captured question, rather than accidentally asking about a newly opened home.

The visual direction uses terracotta accents (`#B44432` in light mode, a lighter terracotta in dark mode) on neutral host surfaces. Typography and surface colors use host design tokens when provided. The embedded app omits the standalone brand header because ChatGPT already identifies the app. Fullscreen layouts reserve space for the composer and apply host safe-area insets.

The map uses Leaflet and OpenStreetMap tiles with visible attribution and a usable list fallback. Review the [tile policy](https://operations.osmfoundation.org/policies/tiles/) and choose a suitable tile service before broader use. Demo pins are illustrative, not verified building positions.

## Website, icon and user guide

The public root is the Vietnamese landing page with a three-step guide, copyable prompts and data-status FAQ. The browser explorer is at `/demo`; source research remains at `/research`. The [branding record](docs/pilot/plugin-branding.md) links the SVG/PNG icon and canonical description/starter-prompt copy. MCP initialization advertises the website and icon; refresh the existing ChatGPT app after metadata changes.

## Connect to ChatGPT

Use the hosted [Nhà Hà Nội app](https://chatgpt.com/plugins/Plugin_791fee034de48191a4ac5cfd580c5bd0) or the [browser demo](https://vn-real-estate-gpt.vercel.app/demo). Stable MCP endpoint: **https://vn-real-estate-gpt.vercel.app/mcp**. The hosted pilot uses Supabase and runs independently of the local server/tunnel. Inventory is still fictional; research links are unverified.

The following steps are for a separate local development connection.

Streamable HTTP endpoint: **http://localhost:8787/mcp**. No OpenAI API key is needed: ChatGPT provides the conversational model and calls the tools.

1. Run the server. For local testing, run `ngrok http http://localhost:8787` in another terminal and append `/mcp` to the generated HTTPS URL. Keep both processes running. A tunnel is temporary and is not a production deployment.
2. In ChatGPT Plugins, choose **Add custom MCP server** and use `https://YOUR-HOST/mcp`. Custom-server access depends on workspace permissions.
3. Install the resulting plugin and select it with an `@` mention in a new conversation.
4. Try: “Tìm căn hộ mẫu ở Hà Nội, ít nhất 2 phòng ngủ, giá không quá 4 tỷ. Hiển thị trên bản đồ.” Select properties and ask to compare them.
5. Refresh the custom connection after tool or resource metadata changes.

| Tool | Behavior |
| --- | --- |
| `search_properties` | Data-only search with hard filters; never silently relaxes them |
| `get_property` | Data-only details for a stable demo ID |
| `get_explorer_context` | Read the open property, current UI-edited requirements, selected homes, and temporary saved IDs |
| `get_selected_properties` | Read the selected IDs for the explorer session returned by the visual tool |
| `set_selected_properties` | Widget-only update of temporary selections and explorer context; changes no listing or account data |
| `compare_properties` | Compare two or three distinct IDs; preserve unknown values |
| `show_property_explorer` | Render matching data in the interactive widget using the same filters |

The component uses the MCP Apps bridge for tool calls, context, and follow-up messages, with optional ChatGPT widget-state compatibility. A send-to-chat action shows an in-app confirmation and an expandable copy of its exact question. The tested ChatGPT host adds the answer to the current assistant response instead of displaying a new user-message bubble; testing its optional `sendFollowUpMessage` alias produced the same behavior, so the standard bridge remains the primary path. Selected/saved IDs, the open property, applied filters, and the active view are also recorded in a temporary explorer session. ChatGPT reads `get_explorer_context` before answering “căn đang xem” or refining a UI-edited search. `get_selected_properties` remains available for comparison. Both search and render tools accept the existing `explorerSessionId` and inherit unchanged filters; `clearFilters` explicitly removes requirements. The render tool can request `view: "details"` with `focusedListingId`, or `view: "comparison"`, so chat can lead back into the relevant UI.

Sessions expire after one hour without context updates. Local memory sessions disappear on restart; hosted Supabase sessions survive Vercel instance replacement. They are separate from account storage and contain no chats or memories. Widgets restore presentation preferences from compatible widget state and hydrate property identities from the server snapshot. UI writes are serialized, and send-to-chat actions await the latest context write. Scripts and styles are embedded in the resource; its CSP permits map tile images from `https://tile.openstreetmap.org`. Data-only calls do not attach a new widget.

An active fullscreen explorer checks its session revision every eight seconds and refreshes after chat changes. This keeps an existing expanded view aligned when ChatGPT renders a new inline result. Passive refreshes never write back, and they pause during filter editing, pending writes, searches, and message sending. The area filter is directly editable, including areas selected through chat. Inline history widgets do not poll.

The stable hosted app is connected in ChatGPT and has passed source-card and demo-map selection/comparison checks in Brave. Earlier demo-host checks are retained as historical evidence. See [the ChatGPT connection record](docs/pilot/chatgpt-connection.md) for the app link, endpoint status, evidence, and validation limits.

## Crawled source-link research

The optional research view exposes seven manually curated source links from the retained OTOFUN crawl. It presents our project/area labels, source dates, raw quantity expressions and questions to verify. Availability, completion, legal status and requirement matches remain unknown. It exposes no post bodies, images, contacts, author replies or operator notes. It does not add these ads to approved property inventory. VOZ is supported by the source adapter, but no VOZ item is in this seven-link manifest.

The existing private manifest is ignored by Git. After building, enable the view with:

```sh
RESEARCH_LINKS_ENABLED=1 HOST=127.0.0.1 npm start
```

Open **http://127.0.0.1:8787/research**. `npm run build` builds both embedded widgets. For ChatGPT, enable the flag before starting the server and refresh tools on a reachable connection, then start a fresh conversation. Try: “Mở các nguồn tin rao đã thu thập. Tôi muốn chọn hai nguồn để đối chiếu, giữ rõ điều gì chưa xác minh.”

Research tools are `search_research_leads`, `get_research_context`, `compare_research_leads`, widget-only `set_research_selection`, and `show_research_explorer` (resource `ui://hanoi-home/research-v1.html`). The research session preserves selected/focused source identities so comparisons can use the session without typed IDs. Research IDs never work as property IDs. Numeric matching and a research map are unavailable because the source expressions and coordinates have not been verified.

The research integration has passed local UI, public MCP and actual ChatGPT checks: source cards render, widget selections reach ChatGPT, and a comparison request without typed IDs identifies the selected sources with original links, dates and unknowns. Use the stable [Nhà Hà Nội app](https://chatgpt.com/plugins/Plugin_791fee034de48191a4ac5cfd580c5bd0). Its Vercel endpoint uses Supabase; no development tunnel is required. See [research integration and operating limits](docs/pilot/chatgpt-research-integration.md) and the connection record for evidence and remaining checks.

## Daily Hanoi data pipeline

The landing page previews real collected source links, and `/research` reads the latest minimal candidate projections directly from Supabase. A successful daily run updates these views without a manual snapshot sync. Source links remain unverified; `/demo` still contains fictional apartments.

The shared catalogue and private daily candidate inbox are documented in [daily data operations](docs/pilot/daily-data-operations.md). Collection covers Hanoi across budgets; each buyer's filters apply at search time. New/changed ads require review and never become confirmed inventory automatically.

Install the pinned Python dependencies once in an ignored project environment:

```sh
python3 -m venv .venv-crawl
.venv-crawl/bin/python -m pip install -r requirements-crawl.txt
```

The npm crawler commands use that environment when present, otherwise `python3` (CI installs the same requirements). `CRAWL_PYTHON` explicitly selects a different interpreter. OTOFUN uses a normal Requests session with its fixed Python identity; VOZ retains its previous urllib client/profile. BeautifulSoup cross-checks opening-post identity in the read-only thread probe.

```sh
npm run catalogue:migrate                  # one-time reviewed-catalogue migration plan
CATALOGUE_BACKEND=supabase npm run catalogue -- reviews
npm run pipeline -- collect               # dry-run plan
npm run pipeline -- collect --apply --pages 5 --threads 20 # bounded backfill
npm run pipeline -- status
npm run pipeline -- candidates
npm run pipeline:probe -- --source otofun # read-only, no credentials/shared writes
npm run pipeline:probe -- --source otofun --thread https://www.otofun.net.vn/threads/can-ho-chung-cu-ecopark-onsen.1968309/
```

The daily workflow uses a bounded Python worker plus Supabase metadata/history/review tables. OTOFUN discovery resumes saved backfill progress and pending links; up to four oldest eligible candidates per source refresh separately from the new-opening quota. Manual runs can choose five index pages and twenty new openings; scheduled discovery keeps three/twelve defaults. Three additional refresh-only sweeps check up to twelve existing candidates per source each. The [Alonhadat adapter](docs/pilot/alonhadat-acquisition.md) adds bounded factual-reference acquisition after its separate activation check. The public page distinguishes usable source-ad groups, unresolved records and temporary archives; the approved supplier catalogue remains separate from research and demo inventory. See [usable-supply policy, private review and the 100-ad/ten-project checkpoint](docs/pilot/usable-supply-operations.md) and the [Vietnamese supplier starter pack](docs/pilot/supplier-starter-pack.md).

For source outages and the additional-source shortlist, see the [OTOFUN diagnosis](docs/pilot/otofun-diagnosis-2026-11-01.md) and [Hanoi source expansion research](docs/research/hanoi-source-expansion-2026-11-01.md), and [free-first sources and insight quality](docs/research/hanoi-free-data-and-insights-2026-11-01.md). Each source has an isolated worker boundary and a two-minute runtime limit. Failures persist a backoff in Supabase (15 minutes doubling to 24 hours, at least 24 hours for access blocks, or longer when requested by `Retry-After`). Other enabled sources continue and their candidate metadata is saved. Partial runs and all-source cooldown deferrals exit successfully with CI warnings; total failure remains nonzero. Recovery is attempted on the first run after the deadline, without changing identity or clearing an access restriction. See [daily operations](docs/pilot/daily-data-operations.md#daily-collection) for outcome and status semantics.

## Vercel, Supabase and CI/CD

The official Vercel and Supabase CLIs are pinned in this project's development dependencies. Run `npm run vercel -- <command>` and `npm run supabase -- <command>`; these wrappers read the setup wizard's ignored local deployment settings. Browser steps use Brave.

For the initial account/project setup, run:

```sh
npm run setup:deploy
```

The five-stage wizard renews GitHub access, creates/links a Vercel project, guides creation of a separate Supabase project, configures the server-only Supabase key in Vercel and saves six deployment secrets, the ingestion-only Supabase key, and public repository settings. Daily collection starts disabled until its live probe passes. Its credential prompts are hidden and its local `.env.deployment` file is mode 0600 and ignored. It applies no migrations, uploads no crawl files and performs no deployment or git push.

The hosted app uses the same Express/MCP tools and embedded widgets through `api/index.mjs`. `SESSION_BACKEND=supabase` persists temporary comparison/context state across Vercel instances. Supabase stores only that state and the minimal research projection; private crawl databases remain local. The cloud runtime reads real inventory only through the shared reviewed Supabase catalogue; the private SQLite file is never deployed. Demo homes and unverified research links remain distinct.

GitHub Actions checks app syntax/build, Node/Python tests, local Supabase migrations/permissions and multi-instance MCP persistence. Passing `main` revisions apply schema migrations, build/deploy Vercel and run a health/MCP/selection smoke test. Pull requests run checks without production credentials or deployment; automatic Vercel Git deployments are disabled to avoid bypassing these checks. The workflow is active. Production smoke testing targets the public `APP_BASE_URL` variable; CLI output format and protected per-deployment URLs do not determine the test target.

Local database verification:

```sh
npm run db:start
npm run db:test
npm run test:hosted
```

After the first hosted migration, `npm run research:sync -- --apply` publishes only the currently validated minimal source projection to Supabase. It replaces the previous batch, including withdrawals; no raw post bodies, contacts or replies are uploaded. Cloud records are a snapshot with expiry. Local crawl changes reach the cloud on the next explicit sync, not automatically. See [deployment operations](docs/pilot/deployment.md) for the exact settings, first deployment, rollback and verification boundaries.

## Check

```sh
npm run build
npm run check
npm test
```

Tests cover hard constraints, missing values, Vietnamese area matching, unavailable inventory, comparison identity, focused-property context, requirement inheritance/clearing, invalid IDs, and session isolation. Browser checks should exercise filters, details, map selection, saving, comparison, send-to-chat actions, empty results, and a narrow viewport. `GET /health` reports runtime status.

## Project notes

- [Pilot specification](docs/pilot/specification.md)
- [Ten-minute feedback session](docs/pilot/interview-guide.md)
- [Inventory acquisition research](docs/research/hanoi-data-acquisition.md)
- [Real-data integration plan](docs/pilot/real-data-integration-plan.md)
- [Catalogue import, review, updates and real-data mode](docs/pilot/catalogue-operations.md)
- [Official and community evidence review](docs/pilot/project-evidence-operations.md)
- [Direct VOZ/OTOFUN crawler and first collected records](docs/pilot/forum-crawl-operations.md)
- [Crawl classification, review queues and private export](docs/pilot/forum-review-operations.md)
- [Private local preview: search, inspect and compare retained leads](docs/pilot/private-lead-preview.md)
- [ChatGPT source-link research integration](docs/pilot/chatgpt-research-integration.md)
- [Samsora and CT1ADN1 project-identity evidence and remaining gaps](docs/research/two-candidate-project-verification.md)
- [Five additional leads: project identity and operations evidence](docs/research/five-lead-project-verification.md)
- [VOZ and OTOFUN source research](docs/research/forum-real-estate-sources.md)
- [Verified forum RSS access](docs/research/forum-feed-access-check.md)
- [Unsent supplier and forum access requests](docs/pilot/source-access-requests.md)
- [Supplier inquiry](docs/pilot/supplier-inquiry.md)
- [Real-listing submission template](docs/pilot/listing-submission-template.md)

This implementation adapts the transport and registration pattern from OpenAI's [MCP server and UI quickstart](https://developers.openai.com/plugins/build/app-quickstart), using the [current MCP Apps bridge](https://developers.openai.com/plugins/build/chatgpt-ui). The [official examples](https://github.com/openai/openai-apps-sdk-examples) were reviewed; the small vanilla baseline avoids copying a full showcase or requiring a map-provider key for the first prototype. The installed `chatgpt-apps` skill guides this workflow.
