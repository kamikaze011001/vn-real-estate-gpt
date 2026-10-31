# ChatGPT source-link research integration

The user requested integration of the collected leads. This adds a minimal, manually curated research surface alongside the existing property explorer. It does not approve real inventory or re-publish the retained forum posts. Seven OTOFUN original-ad links are curated locally; the adapter also understands VOZ, but this batch has no VOZ links. Source/publication permissions in the regular catalogue remain pending; there are still no approved real listings or evidence items.

## Data boundary

`server/research-links.mjs` opens the crawl SQLite database read-only and validates `private-data/research-links.json` against a strict schema. The ignored manifest includes an own-authored label, source identity, exact SHA-256 content fingerprint, bounded quantity expressions, risk enums and a review expiry. It is a deliberate whitelist, not an automatic export of every crawl row.

The public projection contains a stable research ID, label, original source URL, separate publication/edit/collection dates, expiry, source status and curated expressions. Confirmed total price, area and bedroom fields are null; availability, completion and legal status are unknown. `inventoryEligible` and `requirementsVerified` are false. Numeric hard filters are rejected, and research IDs are not property IDs. Price per m² and rent per month remain rates, not total purchase prices. An expired ad is not proof that a home sold.

Post bodies, original titles, images, contacts, author replies, private source identities, content hashes, operator notes and permission records are excluded. Only own-authored labels and short factual quantity expressions are curated; arbitrary source text must not be pasted into those fields. The manifest and database are not served as static files. This does not certify source accuracy or create display permission for full posts.

Manual curation also excludes irrelevant amenity dimensions and duplicate quantity tokens. For this batch, the 360 Giải Phóng summary omits the 1,000 m² supermarket/gym dimensions; Xuân Mai retains the three-bedroom expression rather than treating two naturally lit bedrooms as a two-bedroom total, and keeps `4 tỷ 550 triệu` together. Học Viện Hậu Cần retains the current two-bedroom expression, with the possible three-bedroom conversion left as a layout risk. These remain unverified source expressions, not approved property facts.

In local SQLite mode, every read rechecks the manifest expiry, source row expiry, exact content fingerprint, original-post role, date-extraction version and allowlisted HTTPS source URL. A changed/missing/expired record leaves results and temporary selections. Re-crawling may change its fingerprint; that requires deliberate review before inclusion again. A manifest/schema/database failure returns a generic error with no demo fallback or private path. Stop the research feature by setting `RESEARCH_LINKS_ENABLED=0` and restarting; remove an entry from the manifest to withdraw a source. Retention/purge remains the crawler's job, not a background job introduced by this feature.

The prepared Vercel/Supabase mode uses a strict minimal snapshot, uploaded by `npm run research:sync -- --apply`. Expiry and source withdrawal from that hosted snapshot are checked on each operation; local raw-source or manifest changes take effect remotely on the next sync. Hosted sessions persist across server instances and keep the same one-hour inactivity limit. See [deployment operations](deployment.md). No raw crawl data or manifest is uploaded, and the new cloud projects/deployment are still awaiting account setup and live verification.

## App flow and tools

The existing app remains an interactive-decoupled app. The new source view follows the same data/render separation:

| Tool | Purpose |
| --- | --- |
| `search_research_leads` | Data-only text/source-status search; no numeric requirement matching |
| `get_research_context` | Current focused/selected sources and inherited query/status scope |
| `compare_research_leads` | Two or three sources, resolving widget selections through the session |
| `set_research_selection` | App-only temporary selection/context write; no source or listing mutation |
| `show_research_explorer` | Render `ui://hanoi-home/research-v1.html`, optionally at detail/comparison |

The component uses the standard MCP Apps bridge for tool calls, context updates, messages, source navigation and display mode. Model-context updates supplement the temporary server session rather than replacing it. Widget writes are serialized and follow-up messaging waits for the latest write. Focused sources are distinct from selected comparison sources. Sources remain in context if hidden by a new text query. Sessions expire after one hour without updates and disappear on restart; they are not account storage. The expanded host view checks for newer session revisions every eight seconds while visible and idle.

Inline results are compact source cards. Details and comparison stay in panels beside the system composer; fullscreen reserves bottom space and host safe-area insets. Host theme/tokens provide surfaces and typography, with restrained terracotta accents. The research view has no map because no source coordinates are verified. External links open through the bridge in ChatGPT. The self-contained resource has empty network/resource CSP domain lists.

Official guidance used: [tool design](https://developers.openai.com/plugins/plan/tools) supports focused tool responsibilities and clear inputs/outputs; [MCP server integration](https://developers.openai.com/plugins/build/mcp-server) and [the reference](https://developers.openai.com/plugins/reference) cover structured results, output schemas, resource metadata and annotations. [ChatGPT UI integration](https://developers.openai.com/plugins/build/chatgpt-ui) documents the bridge, theme and display context. [UI guidelines](https://developers.openai.com/plugins/concepts/ui-guidelines) inform compact inline results and progressive expansion. [Connection testing](https://developers.openai.com/plugins/deploy/connect-chatgpt) informs refreshing tools, versioned resource URIs and a fresh test conversation. The existing bridge/server structure was retained after checking [official examples](https://developers.openai.com/plugins/build/examples).

## Running and curation

```sh
npm run build
RESEARCH_LINKS_ENABLED=1 HOST=127.0.0.1 npm start
```

Optional shell settings: `RESEARCH_DB` defaults to `private-data/forum-crawl.sqlite`; `RESEARCH_LINKS_MANIFEST` defaults to `private-data/research-links.json`. `.env.example` is documentation; the server does not auto-load it. Standalone preview is `http://127.0.0.1:8787/research`. The main property explorer is unchanged at `/`. HTTP research routes expose the same minimal projection, not the private operator preview on port 8790.

The current private seven-entry manifest is already prepared, mode 0600, and ignored by Git. Do not commit it or substitute the entire crawl export. For a replacement batch, review each original post and its dates, create a fresh own-authored label and short quantity expressions, select risk enums, and hash the exact `item.data` string with UTF-8 SHA-256. Use the exported `researchManifestSchema` as the authoritative shape: version 1, scope `research-source-links`, `curatedAt`, `expiresAt`, and `entries`. Each entry has `sourceItemId`, `fingerprint`, `label`, `priceExpressions` (`raw`, `basis`, `uncertain`), `areaExpressions`, `bedroomExpressions`, and `risks`. No extra fields are permitted. Set expiry no later than the earliest retained source expiry; review the candidate public projection locally before exposing it. Missing source values stay unknown.

Only the user-authorized minimal source-link integration is implemented. Permissioned inventory, author-update publication, exact unit/project verification, live reconfirmation and production hosting remain separate work. The unauthenticated demo MCP is unsuitable for private buyer data; a development tunnel is temporary.

## Validation and connection

The new automated cases exercise private-field exclusion, raw-rate/unknown handling, source date separation, session isolation, focus, query inheritance, comparison without typed IDs, expiry, withdrawal and content changes. HTTP/MCP coverage checks tool metadata, output schemas, app-only selection access, embedded resource, strict HTTP inputs, absent private-file routes, and separation from existing inventory. See the connection record for revision-specific counts and browser evidence.

Both widgets rebuilt, syntax checks passed and all 36 Node tests passed. Local browser checks covered seven-source rendering, rapid two-source selection, comparison, 390-pixel light/dark layouts, loading/empty states and offline recovery. The Python crawler was unchanged; its tests were not rerun for this integration.

The original ngrok endpoint expired. The user explicitly authorized a replacement public endpoint, then approved creating/connecting the new app and sharing relevant chats/enabled memories with their local server at its new URL. This resolved the earlier automatic-review block. Public initialization, discovery and seven-source search passed at `https://2c68-103-238-69-196.ngrok-free.app/mcp`. The old app was preserved.

Use [Nhà Hà Nội · Nguồn & Demo](https://chatgpt.com/plugins/plugin_asdk_app_6ae622f726fc8191929b62853ccd1773). In a fresh ChatGPT conversation, natural-language research routing rendered seven source cards; selecting Samsora and CT1A-ĐN1/Mỹ Đình synchronized successfully; a composer comparison without typed IDs identified the exact pair and cited original links/dates while keeping price rates and unknowns distinct. The contextual question button delivered the captured pair and produced a grounded verification answer. Expansion retained comparison and composer access. Details opened the original public source through ChatGPT's external-link confirmation. [The connection record](chatgpt-connection.md) retains the conversation URL and separate local/protocol/host evidence.

The actual-host check used accessibility state; local screenshots provide the visual layout evidence. A complete keyboard/screen-reader pass, physical mobile safe areas, minimum-width hosted visual inspection, forced hosted send failures/retry and broader tool-routing prompts remain unverified. The temporary tunnel requires both ngrok and the server to stay running and is not production hosting. Refresh tools after metadata changes, version changed widget resources and retest in a fresh conversation when reconnecting.
