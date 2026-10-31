# Private visual review of crawled leads

Implemented and browser-checked 31 October 2026. This turns the retained private review cohort into a local visual workspace. It is an operator preview, not approved inventory or an additional ChatGPT connection.

## Run

```sh
npm run preview:crawl
```

Open **http://127.0.0.1:8790**. The server binds only to `127.0.0.1`; no host override is provided. Use `--port 8791` if that port is occupied or `--db PATH` for another existing private crawl inbox. Stop with Ctrl+C. No packages, API keys, models or external services are required.

The current run shows the seven original ads retained for follow-up. Search by project/content, including Vietnamese text without accents. Filter source-expired ads separately. Open **Xem chi tiết nguồn** to inspect dates, original source link, unresolved evidence, stored plain source text and related-account replies. Select two or three leads for **So sánh nguồn**. Selections are temporary client state and do not update the published app or operator decisions.

## Data and experience

The server reconstructs the current review cohort from the private SQLite inbox. Kept original posts remain visible; a previously kept record whose content changed remains visible as needing review. Related replies do not become separate property cards. Expired storage records disappear instead of falling back to demo fixtures. Manual refresh and a visible-page 30-second refresh update the view; selected IDs that leave the dataset are removed.

The UI presents extracted source expressions, not selected/verified listing facts. Price rates retain `/m²` or `/tháng`; they never become total asking prices. Multiple expressions remain separate, including possible renovation layouts or amenity dimensions. Read the original context before interpreting them. There are no hard budget/bedroom match claims, cheapest-home highlights, estimated transaction prices, invented map coordinates or property-availability confirmations. A native comparison table preserves unknowns and has its own horizontal scrolling on narrow screens.

Publication and source edit dates remain separate, including the corrected Meco dates (12/09 and 14/09). Current availability and legal-document status stay unknown. The preview exposes no operator notes, permission references, author identifiers or publication/decision endpoints. Source strings use text nodes rather than HTML rendering, and the data response is explicitly marked private review only.

This adds a separate vanilla review view under `review-web/`, with `scripts/forum_preview.py` and a small `/api/leads` projection. The existing ChatGPT app retains its **interactive-decoupled** architecture, tools, MCP bridge, selection mechanism and v12 UI resource. There is no new MCP tool or resource, so no connected-app refresh is needed for this addition.

Visual decisions reuse the existing system fonts, neutral surfaces and terracotta accents, following [official UI guidance](https://developers.openai.com/plugins/concepts/ui-guidelines). Compact cards lead to detail and comparison rather than adding a chat composer. The existing public integration remains consistent with [the MCP Apps bridge/data-render separation](https://developers.openai.com/plugins/build/chatgpt-ui); unreviewed private records are not attached to tool results.

## Local access boundary

Only `/`, `/review.js`, `/review.css`, `/api/leads` and an empty favicon response are served. Database paths, arbitrary files and `/mcp` return 404; POST returns 405. The server validates Host/Origin against the actual loopback port, sends no CORS permission, blocks framing and uses a same-origin-only content policy. Responses use `no-store` and `no-referrer`. The read-only UI has no source ingestion, reviewer decision, permission grant, contact or publication action. Opening the inbox still performs the existing expiry housekeeping.

The public app server remains on port 8787; its build contains no private-preview assets, routes or data. Keep this review server outside development tunnels and public hosting. Loopback access is a local workstation boundary, not a production authentication system. Rendering a retained ad locally does not grant its display rights or make it eligible for the buyer pilot.

## Verification

- **Python:** all 39 crawler/review/preview tests passed. New tests cover narrow projection/no operator-note leakage, related-reply separation, changed-content review, expiry removal, empty inbox behavior, Host/Origin checks, non-writable routes and private-file/MCP route rejection. The HTTP test needs permission to bind an ephemeral loopback port in restricted sandboxes.
- **Build/app regression:** widget build, syntax checks and 31 existing Node tests passed, including isolated real-mode HTTP/MCP fixtures. The resulting embedded widget was checked for absence of private-preview routes/labels.
- **Actual local browser:** seven real retained records rendered; accent-insensitive search and three-expired-ad filter passed. Two-source comparison retained identities and `/m²`, unknowns and missing evidence. Three-source maximum, detail/source links, separate Meco dates, keyboard Enter/Escape and return focus passed. At 390 px, light/dark layouts had no page overflow and comparison scrolled within its table. Injected frontend empty/error/expiry/hostile-title responses exercised recovery and safe text rendering without changing the database. No unexpected browser console errors remained.
- **ChatGPT host:** not retested for this separate local view. The connected ChatGPT app continues serving demo inventory; no real listings, evidence or private source text were published. The real-data pilot still depends on the supplier/building/use evidence recorded in [review readiness](forum-review-operations.md#expanded-marketplace-review-and-live-pilot-readiness).
