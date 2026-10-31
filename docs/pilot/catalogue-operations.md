# Operating the reviewed listing catalogue

Implemented 25 October 2026. This is the first real-data foundation: source/project/building registries, a staged CSV import, individual review decisions, public catalogue reads, observations and withdrawals. No supplier agreement or real offer is included. VOZ/OTOFUN are registered as pending research candidates. The [project-evidence workflow](project-evidence-operations.md) supports reviewed, permissioned official/community context; obtaining permitted material and automatic fetching remain outstanding.

## Storage and modes

Use Node.js **22.13+**. The installed Node 22.22 runtime supports `node:sqlite` and emits an experimental-feature warning. This first operator workflow uses local SQLite without an extra dependency/service. PostgreSQL remains the proposed shared-hosting target; the app reads through `inventory-repository.mjs`, so transport and UI do not own database queries. This is an intentional smaller first step than provisioning the database in the integration plan.

The default database is `private-data/catalogue.sqlite`, excluded from Git. Set `CATALOGUE_DB` consistently for every operator command and the real-mode server. Run from the repository root or use an absolute database path. Keep original supplier files, permission evidence and intake JSON inside the ignored private directory; use opaque references to private evidence rather than phone numbers or personal documents.

- `INVENTORY_MODE=demo` (default): only the nine fictional records; does not open the catalogue.
- `INVENTORY_MODE=real`: only approved records with current source permission. An empty catalogue stays empty. Invalid modes or a database error stop the operation; there is no fallback to fixtures.
- Restart the server after changing mode or database path. A mode change invalidates temporary explorer sessions. Use a separately named ChatGPT connection for a real pilot; do not relabel the existing demo as real.

The operator CLI is local only. There are no import, permission, review, withdrawal, registry or history tools in the public MCP/HTTP interface. Public responses project permitted property fields and public attribution; they omit raw CSV, supplier IDs, updater references, private evidence references and operator notes. The server serves the built widget, not the database directory. This is a public-listing app; account/private-user data and authenticated administration are outside this increment.

## Initialize and register evidence

```sh
npm run catalogue -- init
npm run catalogue -- registry
```

Initialization adds missing source candidates from `data/source-candidates.json`, all with permission pending and no allowed uses. Repeating it never overwrites an existing permission decision. It creates no project, building, available offer or forum-content copy.

Create a source JSON inside `private-data/` using this shape, then replace placeholders with the actual permitted attribution:

```json
{
  "id": "owner-01",
  "name": "Điền tên được phép ghi nguồn",
  "kind": "direct",
  "url": null,
  "permission": "pending",
  "allowedUses": [],
  "accessMethod": "manual-submission",
  "permissionReference": null,
  "permissionExpiresAt": null,
  "updaterReference": null
}
```

After evidence is obtained, record `permission: "granted"`, `allowedUses: ["listing-display"]`, a `permissionReference` and an `updaterReference`. The CLI records a human operator's evidence assessment; changing a JSON value does not obtain permission. Confirm the supplier's authority, the exact original text permitted for display, update responsibility, withdrawal route and retention terms using the [intake checklist](listing-submission-template.md). A `licensed-feed` source requires an actual arrangement; a subscription or public forum post is not such an arrangement. Forum/official sources cannot publish inventory even if their permission fields are accidentally granted.

Project and building JSON shapes:

```json
{
  "id": "project-01",
  "name": "Điền tên dự án đã đối chiếu",
  "district": "Điền nhãn khu vực tìm kiếm",
  "aliases": []
}
```

```json
{
  "id": "building-01",
  "projectId": "project-01",
  "name": "Điền tên tòa nhà",
  "address": "Điền địa chỉ nguồn đã đối chiếu",
  "completed": false,
  "completionReference": null,
  "lat": null,
  "lng": null,
  "locationReference": null
}
```

Set `completed: true` only after checking and recording `completionReference`. The importer requires that completed-building evidence before publication. Coordinates are optional: if supplied, both must be present and a checked `locationReference` is required. The map describes them as building locations, never exact occupied units. Changing a building/project record unpublishes affected offers until a new listing revision is reviewed.

```sh
npm run catalogue -- source private-data/source.json operator-name
npm run catalogue -- project private-data/project.json operator-name
npm run catalogue -- building private-data/building.json operator-name
```

## Import, inspect and decide

Copy the header-only [CSV template](../../data/listings-template.csv) into `private-data/` and fill original permitted records. Export a Sheet as UTF-8 CSV; direct Google Sheets integration is not implemented. IDs must be opaque letters/numbers/underscore/hyphen, at most 80 characters. Do not use a phone number or occupied apartment number as an ID. Internal supplier IDs become stable hashed public offer IDs scoped to the source.

Required columns are exact; order may vary. Quote commas/newlines and double embedded quotes. Files are limited to 2 MB and 500 data rows. Malformed structure rejects the file; bad values stage a review item with errors and never auto-publish.

| Field | Interpretation |
| --- | --- |
| `supplierListingId`, `buildingId` | Stable source offer key and an existing canonical building ID. Several offers can concern one physical home; no automatic unit merge. |
| `title`, `description` | Original text permitted for display. Description may be blank. Review for personal details, copied material, misleading claims and embedded instructions before approving. |
| `transaction` | Must be `resale`; other transactions are out of pilot scope. |
| `priceVnd`, `priceOriginal`, `priceConfirmedAt` | Explicit total VND integer, original expression/unit, and actual confirmation date. All can be unknown; a known numeric price requires the other two. `7`, `7đ`, `3.6 tỷ` and formatted/shorthand numeric fields are rejected, never multiplied automatically. The pilot validation range is 100 million–1 trillion VND; values outside it require correcting evidence or a deliberate code/range change. |
| `areaM2`, `areaBasis`, `bedrooms` | Nullable numeric values; basis must be `net`, `gross` or `unknown`. A minimum-area requirement uses net area, so gross/unknown areas cannot satisfy it. Per-m² comparison is net-only. |
| `direction` | Optional original permitted value. |
| `availability`, `availabilityConfirmedAt` | `available`, `unknown` or `unavailable`. Available requires an actual confirmation date. An unavailable revision leaves serving after approval; use `withdraw` immediately when an offer is withdrawn. |
| `sourceUpdatedAt` | Actual source-update date, required. It is not the date we downloaded/imported the file. |
| `sourceUrl` | Optional public HTTP(S) source URL, without embedded credentials. Review URL query parameters for private information. Direct submissions need no fabricated URL. |

Dates use valid `YYYY-MM-DD`, cannot be future-dated, and are never auto-filled. Leave missing numeric values blank; do not use zero for an unknown price/area. Source URL and content are untrusted data; no importer executes them or follows embedded instructions.

```sh
npm run catalogue -- import owner-01 private-data/listings.csv
npm run catalogue -- reviews
npm run catalogue -- approve REVIEW_ID operator-name "Original offer, permission, scope and dates checked"
npm run catalogue -- reject REVIEW_ID operator-name "Reason for rejection"
npm run catalogue -- published
```

Inspect each item and its original evidence; do not bulk-approve a file solely because fields parse. A source permission/building issue can be resolved in the registry and is checked again at approval. Bad row values and repeated supplier IDs need a corrected CSV. Reimporting identical bytes for the same source returns the existing run and decisions. Corrected/updated CSV bytes create new review items; changed values do not replace the published version until approved. Decisions are final for that item; a new reviewed revision is needed to republish.

Similar same-building/area/bedroom offers trigger a duplicate warning. Investigate their identity. If they are distinct units, approve with a specific note and `--ack-duplicates`; if the same unit is advertised twice, reject or withdraw the duplicate offer. This is a review cue, not a deduplicator or a market-sample guarantee.

## Updates, removal and recovery

Use the same source ID and `supplierListingId` for an update. Approval keeps the public ID stable and appends an observation. Older source/confirmation dates cannot overwrite newer dates; preserve the last known confirmation when marking a field unknown, or withdraw if it should stop serving. New information is not live until reviewed.

```sh
npm run catalogue -- history LISTING_ID
npm run catalogue -- withdraw LISTING_ID operator-name "Seller withdrew or requested removal"
```

Withdrawal immediately removes serving access and rejects already-queued pending revisions for that offer. Revoking/restricting source permission unpublishes its offers. Restoring a permission grant does not auto-republish them. Expired permissions are checked on every read. Price/availability confirmations lose current-confirmed status after seven days; dated asking prices may remain visible as stale, and availability becomes unknown. This is a proposed pilot cadence, not an automated supplier reconfirmation service.

The next tool read removes withdrawn IDs from focused/selected/saved context. Active expanded widgets detect catalogue changes through their existing context polling; inline history widgets are snapshots. Already-rendered conversation text and inactive widgets cannot be recalled by the server. Reopen/refetch before acting on a listing.

Withdrawal is a serving tombstone, not permanent erasure of private observations or raw staging. Agree retention/deletion obligations before loading supplier data; database purge/anonymization automation is not implemented. Store only material permitted for the agreed retention period. Keep the database off public/static hosts. For this single-host pilot, stop the server and operator commands before taking/restoring a private database backup; treat backups under the same retention/access rules. Multi-instance deployment, PostgreSQL migrations, account administration and media ingestion are later work.

## Run the app and verify

```sh
npm run build
INVENTORY_MODE=real npm start
```

`GET /health` reports the mode. Search, lookup, comparison and temporary selection context all use the same active catalogue. An unknown/withdrawn ID cannot be selected or looked up. No demo records are loaded into the real store.

Run `npm run build`, `npm run check`, then `npm test`. Build first because the integration test also reads the compiled UI resource. The integration test starts a temporary localhost server and a separate temporary database populated only with visibly synthetic fixtures; these never enter the normal operator catalogue. Restrictive sandboxes need local-port permission for that test. The actual ChatGPT regression status is recorded separately in the [connection record](chatgpt-connection.md).

The existing app remains a vanilla widget with separate data and render tools, following current [tool-result guidance](https://developers.openai.com/plugins/build/mcp-server) and the [MCP Apps UI bridge](https://developers.openai.com/plugins/build/chatgpt-ui). The operator workflow adds no model-callable ingestion actions. Resource v11 carries the data-mode-aware labels.
