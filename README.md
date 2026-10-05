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
4. Not needed yet; skip this until staff access is turned on. Then, set `VITTY_STAFF` to your staff
   name, exactly as an admin added you to the server. The plugin sends it with every message, so the
   server knows who is asking. Add this line to `~/.zshrc` or
   `~/.bashrc` (with your own name), then open a new terminal:

   ```bash
   export VITTY_STAFF=alice
   ```

   If you start Claude Code from the desktop app or an IDE rather than a terminal, put it in
   `~/.claude/settings.json` instead:

   ```json
   { "env": { "VITTY_STAFF": "alice" } }
   ```

   The plugins work without it.

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
  - Claude Code: `VITTY_MCP_URL` env var (default `https://gateway-130321581049.asia-south1.run.app/mcp`), set in the shell that launches `claude`.
  - Codex: `.mcp.json` does not expand env vars, so the URL is hardcoded in `plugins/vitty-ai-codex/.mcp.json`.
- Both plugins use native `mcp_tool` hooks (UserPromptSubmit runs `start`, Stop runs `stop`) against
  the server in the plugin's `.mcp.json`. The tool's return value is the hook output.
- Staff name: both plugins send `X-Vitty-Staff` from the person's `VITTY_STAFF` env var. An admin must
  first add each person as a row in `agent.staff` on the server, with the same name. Optional for now
  (5 Oct 2026): the server doesn't require it while staff access isn't being tested. Until sign-in
  exists the server trusts this header, so anyone can claim any staff name.
  - Claude Code: `"headers"` with `${VITTY_STAFF:-}`. The empty default keeps the server loading when
    the variable is unset; the server then replies that no name was sent.
  - Codex: `"env_http_headers"`, whose value is the env var's name, not `${...}`. Codex documents this
    field for `config.toml`; whether it works in a plugin's own MCP file is not confirmed yet.
- Bump the plugin `version` on every change, otherwise installed copies won't update.
- Every staff member who installs a plugin can read all of its files, so never put keys or secrets here.
- The server lives in `vitty-ai/mcp-plugins`. Staff don't need access to it.
