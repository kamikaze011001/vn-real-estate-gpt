# Small-group pilot on separate personal accounts

Decision confirmed 1 November 2026: the next distribution is a small pilot using separate personal ChatGPT accounts. Public-directory submission is on hold. A public Vercel deployment or a private installed plugin profile is not a public-directory release, and sending an endpoint to a group does not make that endpoint invite-only.

Share **https://vn-real-estate-gpt.vercel.app/pilot** after deployment. It contains the current setup, copyable endpoint and a five-minute observed task. Testers need permission on their own ChatGPT account to add a custom MCP server. No supported-plan or universal-account-access claim is made. If the control is unavailable, the guide links to the standalone research workflow.

## Connection

Each tester opens ChatGPT Plugins → plus → Add custom MCP server, names it Nhà Hà Nội, enters **https://vn-real-estate-gpt.vercel.app/mcp** and chooses no authentication when prompted. They review and accept ChatGPT's data-sharing notice themselves, then create/install the plugin and select it in a fresh conversation. Do not share the operator's account, Supabase key, deployment tokens, browser cookies or private connection ID.

This is the same unauthenticated pilot service already deployed. Temporary selections and must-haves use separate unguessable session identifiers and expire after one hour of inactivity. It has no group membership check. An actual invite-only service would require a separate authentication/access-control change. The app serves minimal unverified source references and explicitly separate fictional inventory; this distribution grants no supplier permission or inventory approval.

## Icon and packages

The existing terracotta house/chat vector was refined for optical balance and larger small-size windows. `npm run export:icon` uses pinned resvg to export the committed 512px PNG and local 32/48/128px previews. The MCP icon URL carries `v=2` to avoid the old one-hour asset cache. Website SVG/PNG references carry the same version. The app's embedded widget code is unchanged, so its research-v6 and explorer-v12 resources stay unchanged.

`npm run package:plugin` produces **artifacts/nha-ha-noi-plugin.zip**, version 0.2.0, for updating the operator's existing branded private plugin. It intentionally retains that private registered `.app.json` dependency. **Do not distribute this archive as a cross-account installer.**

`npm run package:pilot` produces **artifacts/nha-ha-noi-pilot-plugin.zip**. It has root `plugin.json`, `mcp.json`, the same icon and the setup skill. The portable MCP file names the public streamable-HTTP endpoint and omits the operator's registered app ID. Archive tests allowlist all files and check PNG dimensions and connection boundaries; the manifests were validated against the canonical Agent Plugins schemas. The canonical portable transport schema rejects vendor-only `extensions`; the pilot file uses only `type` and `url`. This package contains no credentials, raw source files or execution hooks.

The portable archive is an optional distribution artifact, not a promised one-click install for every account. The primary pilot path is the documented personal custom-MCP connection. Cross-account installation and each tester's account policy must be checked by the testers; the operator's successful install does not establish their access.

The bundled onboarding now includes partial viewing briefs, captured `briefLeadIds`, inherited requirements, explicit-only clearing and the demo/research boundary. First-use prompts explicitly request unresolved source research so an empty usable catalogue does not turn into a questionnaire or fictional substitution.

## Validation and release

- Local: SVG/PNG exports inspected at 32px and full size; official manifest schemas, skill validator, package allowlist tests, syntax/build and 66 app tests pass (two hosted cases are separate CI jobs).
- Browser: Brave guide inspection and copy confirmation passed; a 250% zoom check covered the roughly 500-CSS-pixel layout and long endpoint. The browser was restored to 100% afterward. This is emulation, not physical mobile certification.
- Deployment, private-plugin update and actual-host results: [connection record](chatgpt-connection.md).
- Human pilot: run the [five-minute task](viewing-brief.md#five-minute-observed-task) separately with the three participants; outcomes remain pending until observed.

Sources checked: [OpenAI connection/testing workflow](https://developers.openai.com/plugins/deploy/connect-chatgpt), [workspace sharing permissions](https://learn.chatgpt.com/docs/enterprise/apps-and-connectors), [plugin packaging](https://developers.openai.com/plugins/build/plugins), [public submission as a separate process](https://developers.openai.com/plugins/deploy/submission), [canonical plugin schema](https://agent-plugins.org/schemas/1.0.0/plugin.schema.json), [canonical MCP schema](https://agent-plugins.org/schemas/1.0.0/mcp.schema.json). Preserve the established interactive-decoupled server/widget architecture; this work changes distribution metadata and static guides, not the server-backed selection mechanism.
