# Project guidance

## Skills first

Before substantive work, select the applicable skills from the session catalog, read their `SKILL.md` files, and briefly name the skills being used. Follow their workflows through validation; naming a skill alone is insufficient. Report an unavailable required skill rather than silently skipping it.

| Task | Required skill workflow |
| --- | --- |
| ChatGPT app UX, UI, tools, MCP, state, metadata, or connection changes | Use `openai-docs` for current official guidance, then `chatgpt-apps` before implementation. Fetch the pages relevant to the change and cite design/API decisions. |
| Bug diagnosis or a failed integration | Use `mattpocock-skills:diagnosing-bugs`; reproduce the failure in the affected environment and verify the fix there. |
| Requested research | Use `mattpocock-skills:research`; retain sources and findings in the repo. |
| Editing agent instructions or skills | Use `mattpocock-skills:writing-for-agents`; also use `skill-creator` for creating or updating a skill. |

Apply other skills when their stated triggers match. Resolve installed paths from the session catalog instead of assuming a machine-specific plugin version.

## Product context

Read [the pilot specification](docs/pilot/specification.md) when changing user journeys, matching, listing evidence, or scope. The first audience is Vietnamese-speaking people buying a completed resale apartment to live in, starting in Hanoi. The three-person pilot uses short observed tasks; optional questions should lead quickly to useful results.

All current inventory is fictional. Keep demo labels visible, preserve unknown values, and distinguish asking prices, availability, and legal-document claims. Hard constraints stay fixed until the user changes them. Real inventory requires permission and traceable evidence.

## ChatGPT experience

Design around the existing conversation and system composer. Use compact inline results and expand for spatial exploration or detailed comparison. Adapt to host theme and available space; keep brand expression in restrained accents and content. Treat chat, cards, map, and selections as one workflow with stable property IDs.

Keep the MCP Apps bridge as the primary integration, with documented ChatGPT extensions where useful. Preserve the temporary server-backed selection mechanism until a replacement passes the same hosted comparison test: context updates alone failed in the actual host despite passing local checks.

## Verification and handoff

Use **Brave** for browser computer use, UI automation and ChatGPT-host checks. Chrome is the user's personal browser; leave it untouched unless the user explicitly requests Chrome for the current task. If Brave needs a ChatGPT login, ask the user to sign in there or report the hosted check as blocked; continue other work without switching to Chrome.

Use the scripts and setup in [README.md](README.md). Rebuild the embedded widget after frontend changes. Refresh the ChatGPT app when tool/resource metadata changes, version changed UI resources, and test in a fresh conversation.

For integration changes, verify inside ChatGPT that a user can search, select cards or map items, and ask to compare those selections without typing IDs. Check narrow layouts, theme, keyboard access, loading/error/empty states, and composer clearance when affected. Report local, protocol, and actual-host results separately.

Read and update [the connection record](docs/pilot/chatgpt-connection.md) when changing setup or hosted behavior. Keep temporary tunnel instructions there; never describe a development tunnel or demo inventory as production-ready.
