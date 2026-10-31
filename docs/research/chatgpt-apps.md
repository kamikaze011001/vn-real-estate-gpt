# ChatGPT Apps: architecture, development, and UX

Researched 25 October 2026 against current official OpenAI documentation. This is research, not an approved project specification or implementation.

## What a ChatGPT App is

A ChatGPT app gives the model specific capabilities inside an ongoing conversation: access data, perform actions, or display a useful interactive result. OpenAI's product guidance describes three sources of value: **know**, **do**, and **show**. Choose a small set of useful operations around the user's job; a full website navigation hierarchy is usually unnecessary. [What makes a great ChatGPT app](https://developers.openai.com/blog/what-makes-a-great-chatgpt-app)

Current documentation packages these capabilities as **plugins** for ChatGPT and Codex. A plugin can contain skills, an MCP server, or both; UI resources are optional additions to an MCP server. A skill supplies instructions; MCP tools supply controlled server capabilities. The directory is shared, while individual features can remain specific to a supported host. This is the current documentation vocabulary; avoid copying older Apps SDK tutorials without checking their API guidance. [Plugin architecture](https://developers.openai.com/plugins/concepts/plugins)

Conceptual architecture:

```text
User conversation
      ↕
ChatGPT selects tools
      ↕ MCP
Your server → data sources, business logic, authorization
      ↓ selected tool returns a UI resource
Sandboxed iframe ↔ host bridge ↔ ChatGPT
```

The component is an interface within ChatGPT. The server owns what the app can actually retrieve or change. [MCP server and UI quickstart](https://developers.openai.com/plugins/build/app-quickstart)

## How to create one

1. **Define user outcomes and tool contracts.** Give each tool a stable action-oriented name, precise input/output schema, trigger conditions, authorization requirements, and useful failure behavior. Return stable identifiers so follow-up requests can reference earlier results. Separate reads and writes when their permissions or consequences differ. Tool descriptions influence model selection; they are part of the product interface. Annotate actual behavior with `readOnlyHint`, `destructiveHint`, and `openWorldHint`; these hints do not enforce authorization. [Define tools](https://developers.openai.com/plugins/plan/tools)

2. **Implement the MCP server first.** OpenAI documents TypeScript (`@modelcontextprotocol/sdk`, `zod`) and Python (`mcp`) SDKs. Build useful tools before adding custom UI. Validate inputs and enforce access on the server. Use a transport supported by the target connection. [Build an MCP server](https://developers.openai.com/plugins/build/mcp-server)

3. **Add UI only where visual interaction helps.** New components should use the **MCP Apps standard**, not compatibility APIs as their foundation. Associate tools with a resource using `_meta.ui.resourceUri`; serve HTML as `text/html;profile=mcp-app`. The iframe exchanges JSON-RPC messages with its host over `postMessage`. Shared operations include `ui/initialize`, `ui/notifications/tool-result`, `tools/call`, and `ui/update-model-context`. Business data belongs on the server, temporary selection/display state in the component, and durable preferences in your storage. Keep model-visible context synchronized when selection affects follow-up questions. Separate data tools from render tools when computation or filtering should finish before a widget appears. Declare component network and asset domains in its CSP. [Add UI to your MCP server](https://developers.openai.com/plugins/build/chatgpt-ui)

   The current Node quickstart installs `@modelcontextprotocol/sdk`, `@modelcontextprotocol/ext-apps`, and `zod`; its MCP Apps server helpers include `registerAppResource`, `registerAppTool`, and `RESOURCE_MIME_TYPE`. React is optional. [MCP server and UI quickstart](https://developers.openai.com/plugins/build/app-quickstart)

4. **Use ChatGPT extensions deliberately.** `window.openai` remains supported for compatibility and ChatGPT-specific functions such as file handling, host modals, and widget persistence. New UI should prefer the shared bridge wherever it covers the same capability. Feature-detect optional extensions. For approval-gated calls, initial arguments can be absent until approval; render that state correctly. [Plugin UI reference](https://developers.openai.com/plugins/reference)

5. **Add account access when needed.** Anonymous read-only tools may be appropriate for public data. Customer-specific data and write actions should authenticate users. The documented authenticated MCP contract uses OAuth 2.1, discovery metadata, PKCE, and access-token verification by your resource server. Existing application identity infrastructure can be reused when it implements the required contract. [Authentication](https://developers.openai.com/plugins/build/auth)

6. **Connect and evaluate.** For a local public-endpoint workflow, run the server and expose it through HTTPS, then connect its `/mcp` URL. Current quickstart instructions use ChatGPT **Plugins → plus → Add custom MCP server**, configure authentication, create the plugin, install it, and invoke it in a new conversation through `@`. Workspace policies can limit access. This replaces assumptions about older settings menus. [MCP server and UI quickstart](https://developers.openai.com/plugins/build/app-quickstart)

## UX principles inside ChatGPT

- Start inline with a focused result. A card should support one decision with at most two primary actions, avoid deep navigation and nested scrolling, and fit its content.
- Use carousels for a small, visually rich shortlist; keep each item's metadata brief and give it one clear action.
- Expand to fullscreen for maps, editors, or exploration needing space. Design around ChatGPT's composer, which remains present. PiP serves ongoing activities that remain relevant as conversation continues.
- Match the surrounding interface. The optional `@openai/apps-sdk-ui` library supplies ChatGPT-aligned tokens and accessible components.
- Let the widget show structured content and let the assistant explain implications or next steps. Avoid repeating the card in the assistant response or recreating the host's inputs.

These are condensed from OpenAI's [UI guidelines](https://developers.openai.com/plugins/concepts/ui-guidelines).

## What to test

Test tools directly with MCP Inspector before testing the installed experience. A public HTTPS endpoint or Secure MCP Tunnel can support development; submission still requires a public HTTPS endpoint. Exercise direct/indirect requests, follow-ups, unsupported requests, empty results, invalid identifiers, authentication failures, and confirmation behavior. Record selected tools, arguments, outcomes, and errors. For UI, verify rendering, console errors, and restored state alongside the model-readable fallback. Refresh the custom connection after tool/schema/authentication/UI metadata changes, start a new chat, and repeat affected evaluations. Browser testing alone does not establish that the model selects the correct tools. [Connect and test your plugin](https://developers.openai.com/plugins/deploy/connect-chatgpt)

## Proposed starting point for this repository

Recommendation to discuss, **not a settled requirement**: start with one real-estate discovery journey using server-backed listing search and details, an inline shortlist, and a fullscreen map only if it improves a specific decision. Use stable listing IDs across the conversation, tool results, and selected cards. Make a follow-up such as “compare these two” work equally after a click or a conversational selection. Decide the target user, data source, distribution scope, and first measurable outcome before choosing more screens or tools.
