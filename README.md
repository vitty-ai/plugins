# Vitty.ai plugins

Claude Code and Codex plugins for Vitty.ai staff. Each plugin connects your Claude Code or Codex
to the Vitty server and runs two hooks on every message: `start` when you send a message, and
`stop` when the AI finishes its reply. The plugins hold no server code.

- `plugins/vitty-ai-cc`: the Claude Code plugin
- `plugins/vitty-ai-codex`: the Codex plugin

## Install

### 1. Before you start (once)

1. Ask an admin to give your GitHub account read access to `vitty-ai/vitty-plugins`.
2. Install `git` and the GitHub CLI (`gh`).
3. Sign git in to GitHub, so Claude Code and Codex can download this private repo without asking for a password:

   ```bash
   gh auth login
   gh auth setup-git
   ```

   A GitHub SSH key loaded in `ssh-agent` also works.

### 2. Claude Code

1. Add the Vitty marketplace (the catalog of our plugins):

   ```bash
   claude plugin marketplace add vitty-ai/vitty-plugins
   ```

   It should print `Successfully added marketplace: vitty-ai`.
2. Install the plugin:

   ```bash
   claude plugin install vitty-ai-cc@vitty-ai
   ```

3. Check it loaded:

   ```bash
   claude plugin list
   ```

   `vitty-ai-cc@vitty-ai` should show `Status: ✔ enabled`.
4. Turn on automatic updates: in a Claude Code session, run `/plugin`, open **Marketplaces**, select
   `vitty-ai`, and choose **Enable auto-update**.

If the download fails on a machine with no GitHub SSH key, set `CLAUDE_CODE_PLUGIN_PREFER_HTTPS=1`
and run the add command again.

### 3. Codex

1. Add the Vitty marketplace:

   ```bash
   codex plugin marketplace add vitty-ai/vitty-plugins
   ```

2. Start Codex, run `/plugins`, pick the `vitty-ai` marketplace and install **vitty-ai-codex**.
3. Trust the plugin's hooks. Codex skips hooks that come with a plugin until you approve them. Run
   `/hooks`, review the two Vitty hooks (`start` and `stop`) and trust them. If a later update
   changes a hook, Codex asks you to review it again.
4. Restart Codex.

### Updating

- Claude Code: updates arrive on their own once auto-update is on. To update by hand, run
  `claude plugin marketplace update vitty-ai`.
- Codex: run `codex plugin marketplace upgrade vitty-ai`.

## For maintainers

- Marketplaces: `.claude-plugin/marketplace.json` (Claude Code), `.agents/plugins/marketplace.json` (Codex).
- Server URL:
  - Claude Code: `VITTY_MCP_URL` env var (default `http://127.0.0.1:8000/mcp`), set in the shell that launches `claude`.
  - Codex: `.mcp.json` does not expand env vars, so the URL is hardcoded in `plugins/vitty-ai-codex/.mcp.json`.
- Both plugins use native `mcp_tool` hooks (UserPromptSubmit runs `start`, Stop runs `stop`) against
  the server in the plugin's `.mcp.json`. The tool's return value is the hook output.
- Bump the plugin `version` on every change, otherwise installed copies won't update.
- Every staff member who installs a plugin can read all of its files, so never put keys or secrets here.
- The server lives in `vitty-ai/mcp-plugins`. Staff don't need access to it.
