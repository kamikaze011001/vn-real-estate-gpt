# Vercel and Supabase deployment

The app is hosted at https://vn-real-estate-gpt.vercel.app with Supabase-backed sessions and seven minimal research source projections. The app remains an interactive-decoupled MCP app: existing tools, resource IDs, widgets and ChatGPT bridge behavior are retained. This work prepares stable hosting; it does not submit an app to the public directory or approve real inventory.

## Runtime boundary

`api/index.mjs` exports the Express app without starting a listener. Vercel routes requests to that Node 22 function, including `/mcp`, `/health`, `/research` and the standalone UI APIs. Both self-contained widgets are included in the function artifact. Vercel runs in Singapore (`sin1`), with a 60-second function limit. Git-triggered Vercel deployment is disabled; GitHub Actions owns deployment after checks.

Vercel must set `SESSION_BACKEND=supabase`, `INVENTORY_MODE=demo`, `RESEARCH_LINKS_ENABLED=1`, `SUPABASE_URL` and the server-only `SUPABASE_SECRET_KEY`. A hosted instance fails closed instead of using process-local sessions or creating a SQLite operator catalogue. No OpenAI API key is needed. Supabase keys never enter frontend variables or widgets.

Supabase holds two service-only tables: `app_sessions` and `research_sources`. Row Level Security is enabled; anonymous and authenticated browser roles have no table/function privileges. Modern backend keys travel in the `apikey` header; legacy local service-role JWTs additionally use Authorization. API failures produce generic errors; request redirects are rejected so keys cannot follow a redirect to another host.

The request runtime loads an isolated session snapshot, runs the existing synchronous domain logic and commits the result with a version check before replying. Conflicts retry against the latest version, preserving unrelated context changes. State survives process replacement, retains the existing one-hour inactivity limit, and stays separate for property and research sessions. Passive reads do not extend the lease. Expired sessions are inaccessible; creation opportunistically removes up to 100 expired rows. This is temporary app context, not permanent buyer/account storage.

Research storage accepts only the strict public projection. Raw crawl bodies, contacts, replies, operator notes, permission files and SQLite databases stay local and are excluded from Vercel uploads/artifacts. Published projections are snapshots: source expiry is enforced on each read, while local edits/removals require a fresh sync to reach Supabase. No scheduled crawler or automatic source re-publication is introduced.

## Account setup

```sh
npm ci
npm run setup:deploy
```

The five-stage setup uses the wizard skill's unchanged library and a Brave-only launcher. The user completes GitHub device login, creates scoped/expiring platform tokens and the new Supabase project, and supplies the backend key through hidden terminal input. `npm run vercel` and `npm run supabase` use pinned CLIs and load the ignored mode-0600 `.env.deployment` file without executing it as shell code. An expired injected GitHub token is removed only inside the wizard process so it cannot override the new CLI login. Do not paste credentials into chat or commit this file.

The wizard creates/links `vn-real-estate-gpt` on Vercel, configures its runtime variables and saves these GitHub repository secrets:

| Secret | Use |
| --- | --- |
| `VERCEL_TOKEN` | Deploy the Vercel project |
| `VERCEL_ORG_ID` | Project's owning account/team |
| `VERCEL_PROJECT_ID` | Linked Vercel project |
| `SUPABASE_ACCESS_TOKEN` | CLI linking; scope to this project with Project Settings, API Keys, API Key Secrets and Connection Pooling Read permissions |
| `SUPABASE_PROJECT_REF` | New Supabase project's reference |
| `SUPABASE_DB_PASSWORD` | Apply schema migrations |

The public repository variable `APP_BASE_URL` is set to `https://vn-real-estate-gpt.vercel.app`; the release smoke test uses it after the CLI deployment succeeds. Vercel sign-in methods must include the GitHub identity that authors commits, so its Hobby owner check can associate the author with this project.

`SUPABASE_SECRET_KEY` is stored in Vercel's secret environment settings and the local ignored setup file, not GitHub's deployment secrets or frontend assets. Prefer a modern `sb_secret_` key dedicated to this backend. The setup script neither deploys nor pushes Git, and never upgrades a plan. If the desired free capacity is unavailable, stop and resolve the project/plan choice before creating paid resources.

## Checks and release

The single workflow `.github/workflows/ci.yml` runs app and database jobs for pull requests and pushes. App checks build both widgets, run Node/Python tests and audit runtime dependencies. The database job starts an isolated local Supabase stack, applies migrations, checks table/function permissions and compare-and-set behavior, then exercises MCP against independent Node instances backed by the real API/database. Local Auth remains enabled because the current CLI omits test API keys when Auth is disabled; no buyer signup flow is added.

Only passing `main` pushes or a manual run on `main` deploy production. Required secrets must exist, and a stale revision is rejected before migration. The deployment job links Supabase, applies migrations with explicit `--linked`, pulls Vercel production configuration, builds and uploads the artifact, then checks health, tool discovery, resources and selection comparison against `APP_BASE_URL`. Deployment JSON output is retained only in the runner temporary directory; the pipeline does not rely on its platform-specific shape. Production jobs serialize; schema changes must stay compatible with the previous app until deployment finishes. Fork pull requests receive no deployment secrets, and there is no production-backed preview environment.

The initial account setup, repository publication and first production deployment are complete. For each release, confirm repository contents exclude private/credential files, merge a reviewed feature branch, and observe both check jobs and production deployment. A failed smoke check marks the release failed but does not automatically undo schema changes or traffic promotion.

The machine's global pre-push guard blocks remote `main`/`master` pushes and explicitly reserves its bypass for a human by hand. Respect that guard: publish/check a setup branch first. Bootstrapping an empty repository's `main` requires the user to perform the one-time main push themselves; do not bypass it through another API or alter the hook. The secret scan must pass before handoff. For credential corrections, `npm run setup:supabase-token` checks the additional Connection Pooling Read permission needed for IPv4 discovery, and `npm run setup:supabase-password` verifies the project database password with a dry run before updating its CI secret.

The initial schema and seven-source projection are deployed. For later reviewed source updates, publish from this operator machine:

```sh
npm run research:sync
npm run research:sync -- --apply
npm run deploy:smoke -- https://YOUR-PRODUCTION-HOST
```

The dry run validates the local manifest/database projection; `--apply` atomically replaces the hosted batch, including removal of withdrawn IDs. An empty valid batch clears the hosted research batch. Expired or fingerprint-changed local records are excluded. This operation grants no inventory or forum-content publication permission. Supabase never receives the private manifest or source text. The CI pipeline does not seed private/local data.

Use the stable public `/mcp` URL in ChatGPT. New Vercel projects may protect preview deployment URLs; the production MCP URL must be reachable by ChatGPT. Do not disable protection for unrelated projects. The optional `VERCEL_AUTOMATION_BYPASS_SECRET` CI secret can test intentionally protected deployment URLs, but does not make them reachable by ChatGPT. Add/refresh the custom connection using Brave, use a fresh conversation, and repeat source selection → comparison without typed IDs and the existing demo card/map comparison. Record hosted behavior in [the connection record](chatgpt-connection.md); local and protocol checks do not replace that test.

## Rollback and data changes

Use Vercel's deployment rollback/promotion flow to restore the last healthy app artifact. Keep migrations additive so the previous version still works; do not automatically run a down migration on a shared database. Withdraw a source through the next reviewed source sync. Keep a separate database for any future preview/staging deployment instead of sharing production write credentials with branch code. Cloud approved-listing imports require a new reviewed inventory adapter; the existing SQLite operator workflow stays local.

## Official references

[OpenAI MCP hosting guidance](https://developers.openai.com/plugins/build/mcp-server) establishes the stable HTTPS/Streamable HTTP endpoint and resource-versioning requirements. [UI bridge guidance](https://developers.openai.com/plugins/build/chatgpt-ui) and [connection testing](https://developers.openai.com/plugins/deploy/connect-chatgpt) inform preserved integration behavior and hosted regression checks.

[Vercel Express hosting](https://vercel.com/docs/frameworks/backend/express), [function configuration](https://vercel.com/docs/project-configuration/vercel-json), and [GitHub Actions deployment](https://vercel.com/kb/guide/how-can-i-use-github-actions-with-vercel) inform the exported app, bundled assets and prebuilt release flow. [Vercel token guidance](https://vercel.com/kb/guide/how-do-i-use-a-vercel-api-access-token) informs scoped access.

[Supabase CLI setup](https://supabase.com/docs/guides/local-development/cli/getting-started), [environment/migration CI](https://supabase.com/docs/guides/deployment/managing-environments), [scoped tokens](https://supabase.com/docs/guides/platform/personal-access-tokens), and [API key handling](https://supabase.com/docs/guides/getting-started/api-keys) inform pinned tools, migration ordering, CI credentials and server-only keys.
