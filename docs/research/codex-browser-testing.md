# Browser UI testing with Codex

Research checked: 2026-10-25. This document records findings and setup instructions; no software was installed or configuration changed.

## Recommendation

Use the existing Chrome DevTools MCP connection for immediate browser inspection. Add Playwright MCP only if we need its particular browser workflow or existing-tab extension. Once the product has stable journeys, use Playwright Test for repeatable regression checks in the repository and CI. This is our recommendation, based on the capabilities below, rather than a requirement of any vendor.

## Three different tools

| Tool | Purpose | How Codex uses it |
| --- | --- | --- |
| Chrome DevTools MCP | Inspect and control live Chrome; investigate console, network, and performance | Calls browser tools during development and exploratory QA |
| Playwright MCP | Agent-directed navigation and interaction using structured accessibility snapshots | Calls browser tools to inspect and exercise journeys |
| Playwright Test | Saved end-to-end tests with assertions and repeatable runs | Writes test files, runs the test runner, investigates failures |

Chrome DevTools MCP is a browser-control/debugging server, not a required Chrome extension. It can launch its own Chrome instance. [Chrome DevTools project](https://github.com/ChromeDevTools/chrome-devtools-mcp)

Playwright MCP uses the accessibility tree for interaction and supports persistent browser profiles, isolated sessions, and connection to an existing browser. Its current README also points coding agents toward Playwright CLI with skills when token efficiency is the priority; MCP remains useful for sustained exploratory sessions. [Playwright MCP project](https://github.com/microsoft/playwright-mcp)

Playwright Test separately supplies a test runner, assertions, browser isolation, parallel execution, and Chromium/Firefox/WebKit support. Installing an MCP connection does not create a regression suite. [Playwright Test installation](https://playwright.dev/docs/intro)

## What is already available here

Local observations reported by the primary agent on 2026-10-25:

- Node.js: `v22.22.1`; Codex CLI: `0.164.0`.
- The user's Codex configuration already enables `chrome-devtools`, launching `chrome-devtools-mcp@latest` through `npx`.
- The exposed browser page-list operation succeeded and returned one `about:blank` tab.
- Playwright MCP was absent from that configuration.

This verifies the Chrome connection. It does not establish that an application journey, screenshot, console, or network check has passed.

## Codex setup

Codex reads MCP servers from `~/.codex/config.toml`; trusted projects can use `.codex/config.toml`. Desktop, CLI, and IDE clients share this configuration. Existing configured servers should be reused, avoiding duplicate registrations. The CLI provides `codex mcp list`, while `/mcp` shows active servers in the terminal UI. Restart the relevant client after setup. [Official Codex MCP documentation](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)

For a machine without Chrome DevTools MCP, the vendor documents this Codex command:

```bash
codex mcp add chrome-devtools -- npx chrome-devtools-mcp@latest
```

Equivalent TOML using noninteractive package execution:

```toml
[mcp_servers.chrome-devtools]
command = "npx"
args = ["-y", "chrome-devtools-mcp@latest"]
```

Prerequisites are Node LTS, npm, and current stable Chrome. [Vendor Codex setup](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/client-configurations.md), [requirements](https://github.com/ChromeDevTools/chrome-devtools-mcp)

Optional Playwright MCP setup with an isolated testing session:

```bash
codex mcp add playwright -- npx -y @playwright/mcp@latest --isolated
codex mcp list
```

Equivalent TOML:

```toml
[mcp_servers.playwright]
command = "npx"
args = ["-y", "@playwright/mcp@latest", "--isolated"]
```

`--isolated` discards session storage when the browser closes. Without it, Playwright MCP uses a persistent profile. A storage-state file can seed an isolated context when authentication is needed. [Playwright MCP configuration](https://github.com/microsoft/playwright-mcp)

## Testing an existing signed-in browser

**Playwright extension:** install the official Playwright Extension linked from Microsoft's documentation, configure the MCP server with `--extension` instead of `--isolated`, and select the browser tab when prompted. It can use that browser's existing cookies and login state. Connection approval is enabled by default. [Official extension setup](https://github.com/microsoft/playwright/tree/main/packages/extension)

**Chrome DevTools alternative:** Chrome 144+ supports enabling remote debugging at `chrome://inspect/#remote-debugging` and adding `--autoConnect` to the server arguments. Chrome must already be running, and it presents a connection permission dialog. The connection can access the selected profile's open windows. This is optional; the default dedicated testing profile remains sufficient for ordinary local testing. [Running-Chrome setup](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/advanced-usage.md)

## How to use it

After the app has a local URL, give Codex a concrete journey and expected outcomes, for example:

> Open our local app. Search for apartments under the chosen budget, select two results, and compare them. Check that prices and selected IDs remain consistent after changing filters. Repeat at a narrow viewport. Capture screenshots and report console errors, failed requests, and any step you could not verify.

This is a proposed QA prompt, not a claim that those product features already exist. A useful result includes the URL, actual steps, expected versus observed behavior, and screenshots or logs supporting failures.

For saved regressions, initialize Playwright Test later with `npm init playwright@latest`, then run `npx playwright test`. Commit meaningful user-journey tests and use its HTML report to investigate failures. [Playwright Test setup](https://playwright.dev/docs/intro)

## ChatGPT app testing requires the real host too

Use three layers: call tools directly with MCP Inspector, test widget behavior locally, then test the connected app inside ChatGPT. OpenAI's current connection flow supports public HTTPS or Secure MCP Tunnel, followed by adding a custom MCP server through ChatGPT Plugins. Test direct, indirect, follow-up, unsupported, and write requests; inspect both the UI and model-readable output. Refresh discovered metadata and rerun affected tests after schema or UI-resource changes. [Official connection and testing guide](https://developers.openai.com/plugins/deploy/connect-chatgpt)

Our inference: a local widget harness can validate rendering and interactions quickly, but cannot prove ChatGPT tool selection, host permissions, composer behavior, or host display-mode integration. Keep actual-host acceptance checks even when local automated tests pass.
