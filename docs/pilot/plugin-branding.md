# Nhà Hà Nội identity and onboarding

Prepared 1 November 2026 for the existing stable development plugin; this is not a public-directory submission.

## Identity

Original apartment/conversation mark: [SVG source](../../site/assets/icon.svg), [512 × 512 PNG](../../site/assets/icon-512.png). Four windows keep the apartment recognizable at small sizes; the lower corner forms a conversation tail. Terracotta `#A54F39`, cream `#FFF8EF`, warm paper and restrained olive support the approved approachable direction. The mark is drawn in SVG and raster-exported with macOS Quick Look; no stock image or generated bitmap is used. Preserve its square proportions and internal clear space. The host already shows the app identity, so no logo was added inside the embedded widget.

## Website and copy

Public website: https://vn-real-estate-gpt.vercel.app/ . The root is a Vietnamese landing page with the app link, three-step guide, copyable prompts, data distinctions and FAQ. `/demo` retains the standalone property explorer; `/research`, `/mcp` and tool routes remain available as before. No external font, analytics, lead form or new account is introduced.

Canonical editable copy: [plugin-profile.json](../../data/plugin-profile.json). `description` is the concise current settings copy; `longDescription`, `subtitle` and `starterPrompts` retain fuller onboarding for later listing metadata. A comparison prompt requires users to select items first. Demo budgets are examples, not global acquisition filters. Do not promise current available inventory, verified title, complete Hanoi coverage or a market-price feed.

The MCP initialization response includes the title, description, public `websiteUrl` and a sized PNG `icons` entry. These are client-discoverable identity fields, not a guarantee that every host will display them. Refresh the existing ChatGPT app and inspect its rendered Information section; keep app-setting outcomes separate from the protocol result. The existing custom app's settings also expose an editable app description. No tool schema or embedded UI resource URI changed.

## Validation and publishing

Build/check both existing widgets and verify `/`, `/demo`, PNG assets, MCP identity and selection comparison. The HTTP/MCP integration and production smoke check now cover the public landing/guide and branding asset as part of deployment packaging. Local Brave checks passed for desktop and 390/320-pixel layouts, prompt-copy confirmation and keyboard FAQ toggling. These are emulated layouts, not a physical mobile-device or full screen-reader certification. Update [the connection record](chatgpt-connection.md) with hosted outcomes after refreshing metadata. Preserve Vercel hosting and the existing connection; do not create a second Sites deployment or silently replace the app.

Guidance used: [OpenAI plugin names/descriptions/prompts](https://developers.openai.com/plugins/plugin-guidelines), [metadata optimization](https://developers.openai.com/plugins/guides/optimize-metadata), [UI branding](https://developers.openai.com/plugins/concepts/ui-guidelines), [MCP Implementation schema](https://modelcontextprotocol.io/specification/2025-11-25/schema#implementation) and [MCP icon support](https://ruby.sdk.modelcontextprotocol.io/server/icons/). Submission-specific fields and limits follow [the current submission error reference](https://developers.openai.com/plugins/deploy/submission-errors); preparing these assets does not make demo inventory eligible for directory submission.

## Static output routing

The first hosted smoke caught Vercel serving the compiled widget `dist/index.html` at `/` before the Express rewrite. Cache-busted requests were CDN misses and new assets were present, ruling out a stale cache or missing landing files. Set `outputDirectory: "site"` explicitly so the public static root is the landing page; retain both compiled widgets in the function for MCP resources and `/demo`. A pre-upload `check-vercel-output.mjs` assertion now checks the static landing root, PNG and both embedded resource files/mappings; the public root/guide assertion remains the end-to-end release check. This uses Vercel’s documented [output-directory override](https://vercel.com/docs/project-configuration/vercel-json#outputdirectory).
