# ChatGPT Apps development skill selection

Observed 25 October 2026. Stars below belong to entire repositories, **not individual skills**; they indicate community attention, not correctness or install counts.

## Recommendation

Use OpenAI's curated **`chatgpt-apps`** skill with **`openai-docs`**. A suitable first-party skill already exists, so a custom replacement is unnecessary. It covers tool contracts, MCP Apps bridge integration, UI resources/CSP, upstream example selection, scaffolding, and validation. It explicitly prefers the MCP Apps bridge for new UI, with `window.openai` compatibility/extensions layered on afterward. [Skill source](https://github.com/openai/skills/blob/main/skills/.curated/chatgpt-apps/SKILL.md)

The enclosing [OpenAI skills catalog](https://github.com/openai/skills) has **28,288 stars**, **1,954 forks**, is not archived, and reports a repository push at **2026-09-08 20:35:26 UTC** in the [GitHub API](https://api.github.com/repos/openai/skills). These are catalog-level metrics and repository timestamps; they do not establish the skill's last modification date.

One caveat: this skill still contains older Developer Mode / Apps & Connectors menu instructions. Its own mandatory docs-first workflow says to follow current official documentation over older patterns. Apply that rule: current [connection guidance](https://developers.openai.com/plugins/deploy/connect-chatgpt) uses **Plugins → Add custom MCP server**, with public HTTPS or Secure MCP Tunnel. The stale menu text is a reason to verify instructions, not to discard an otherwise useful skill.

Suggested invocation after installation:

```text
Use $chatgpt-apps with $openai-docs to plan the tools and UI for this
project, using current MCP Apps APIs and official UX guidelines.
```

## Framework-specific alternative: Skybridge

[Alpic's Skybridge](https://github.com/alpic-ai/skybridge) displays **2.2k stars** and **143 forks** on the fetched GitHub repository page; the star figure is rounded. Its current README recommends the skill named **`skybridge`**:

```bash
npx skills add alpic-ai/skybridge -s skybridge
```

The framework offers React abstractions, a local emulator, hot reload, example apps, and deployment support. This is an alternative when we deliberately choose the Skybridge framework; it is a larger architectural commitment than installing general guidance. [Current README](https://github.com/alpic-ai/skybridge/blob/main/README.md)

The [current skill](https://raw.githubusercontent.com/alpic-ai/skybridge/main/skills/skybridge/SKILL.md) describes discovery/specification, architecture, tools/views, state/context, OAuth, CSP, evaluation, and publishing workflows. The repository also retains a [chatgpt-app-builder skill](https://raw.githubusercontent.com/alpic-ai/skybridge/main/skills/chatgpt-app-builder/SKILL.md). Prefer the current README's install name over older blog names such as `chatgpt-apps-builder`.

The latest fetched [release page](https://github.com/alpic-ai/skybridge/releases) lists **v2.1.0**, dated **23 October**, and explicitly moves the framework to `@modelcontextprotocol/ext-apps` v2. It documents MCP Apps host behavior plus capability-detected ChatGPT extensions. That supports current compatibility rather than relying solely on the older Apps SDK branding.

Before installing Skybridge, verify the selected revision's complete skill directory: two raw reference URLs beneath `skills/skybridge/references/` returned 404 during this research, while the corresponding `skills/chatgpt-app-builder/references/` files were retrievable. This may reflect a rename or retrieval/cache mismatch; it is not proof that every installation is broken. The older local-run reference also retains an outdated ChatGPT connection menu. [Retrieved local-run reference](https://raw.githubusercontent.com/alpic-ai/skybridge/main/skills/chatgpt-app-builder/references/run-locally.md)

## Decision

**Install the curated OpenAI skill first.** It is first-party, explicitly aligned with current MCP Apps patterns, and leaves our framework choice open. Keep Skybridge as a researched alternative if its emulator and React abstractions justify adopting its runtime. No custom skill needs to be created unless a project-specific workflow later exposes a concrete gap. This note records selection research only; installation is handled separately.
