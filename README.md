# Vitty.ai plugins

Claude Code and Codex plugins for Vitty.ai staff. They hold no server code: each plugin only
names the Vitty MCP server and wires the `start` and `stop` tools to hooks. The server lives in
`vitty-ai/mcp-plugins`, which staff don't need access to.

- `plugins/vitty-ai-cc` – Claude Code plugin
- `plugins/vitty-ai-codex` – Codex plugin

Both plugins use native `mcp_tool` hooks (UserPromptSubmit → `start`, Stop → `stop`) against an
MCP server bundled in the plugin's `.mcp.json`. The tool's return value is the hook output.

## Install (needs read access to this repo)

- Claude Code: `/plugin marketplace add vitty-ai/vitty-plugins`, then `/plugin install vitty-ai-cc@vitty-ai`
- Codex: `codex plugin marketplace add vitty-ai/vitty-plugins`, then install `vitty-ai-codex`

Server URL:
- Claude Code: `VITTY_MCP_URL` env var (default `http://127.0.0.1:8000/mcp`), set in the shell that launches `claude`.
- Codex: `.mcp.json` does not expand env vars; the URL is hardcoded in `plugins/vitty-ai-codex/.mcp.json`.

Marketplaces: `.claude-plugin/marketplace.json` (CC), `.agents/plugins/marketplace.json` (Codex).
Bump the plugin `version` on every change, otherwise installed copies won't update.
Everything here is readable by every staff member who installs it, so never put keys or secrets in it.
