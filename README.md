# Vitty plugins

Claude Code and Codex plugins that connect Vitty staff to the Vitty server.

- `plugins/claude`: the Claude Code plugin, `vitty`, shown as **Vitty.ai**.
- `plugins/codex`: the Codex plugin, `vitty`, shown as **Vitty.ai**.

## Install

Before you start, ask an admin to add your Google Workspace address (`you@vitty.ai`) to your staff row on the
server. You sign in with it once in each app, below.

### Claude Code

1. Add the Vitty marketplace (the catalog of our plugins):

   ```bash
   claude plugin marketplace add vitty-ai/plugins
   ```

   It should print `Successfully added marketplace: vitty-ai`.
2. Install the plugin:

   ```bash
   claude plugin install vitty@vitty-ai
   ```

3. Check it loaded:

   ```bash
   claude plugin list
   ```

   It lists `vitty@vitty-ai` with `Status: ✔ enabled`.
4. Turn on automatic updates: in a Claude Code session, run `/plugin`, open **Marketplaces**, select
   `vitty-ai`, and choose **Enable auto-update**.
5. Sign in: in a Claude Code session, run `/mcp`, select `plugin:vitty:vitty` and choose
   **Authenticate**. Your browser opens Google; pick your `vitty.ai` account. Claude Code keeps you signed
   in from then on. Until you sign in, the hooks do nothing and the Vitty tools are missing.

If the download fails on a machine with no GitHub SSH key, set `CLAUDE_CODE_PLUGIN_PREFER_HTTPS=1`
and run the add command again.

### Codex

1. Add the Vitty marketplace:

   ```bash
   codex plugin marketplace add vitty-ai/plugins
   ```

   Codex 0.152.0 or later is needed for the plugin's answer-size setting (`codex --version`).
2. Start Codex, run `/plugins`, pick the `vitty-ai` marketplace and install **Vitty.ai**.
3. Trust the plugin's hooks. Codex skips hooks that come with a plugin until you approve them. Run
   `/hooks`, review the Vitty hooks and trust them. If a later update changes a hook, Codex asks you to review it
   again.
4. Sign in: run `codex mcp login vitty`. Your browser opens Google; pick your `vitty.ai` account.
   Codex keeps you signed in from then on.
5. Restart Codex.

### Updating

- Claude Code: updates arrive on their own once auto-update is on. To update by hand, run
  `claude plugin marketplace update vitty-ai`.
- Codex: run `codex plugin marketplace upgrade vitty-ai`.
- Moving from the old plugin names `vitty-ai-cc` and `vitty-ai-codex` to `vitty`: uninstall the old plugin, then install and sign in again as above.
  - Claude Code: run `claude plugin uninstall vitty-ai-cc@vitty-ai`.
  - Codex: uninstall **vitty-ai-codex** in `/plugins`.
