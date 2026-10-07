# Vitty plugins

Claude Code and Codex plugins for Vitty staff. Each plugin connects your Claude Code or Codex
to the Vitty server. Its hooks run `start` when you send a message (also one you type while the AI is
working) and again after the conversation is compacted, and `stop` when the AI finishes its reply.
The plugins hold no server code.

- `plugins/vitty-ai-cc`: the Claude Code plugin
- `plugins/vitty-ai-codex`: the Codex plugin

## Install

### 1. Before you start (once)

1. Ask an admin to give your GitHub account read access to `vitty-ai/plugins`.
2. Install `git` and the GitHub CLI (`gh`).
3. Sign git in to GitHub, so Claude Code and Codex can download this private repo without asking for a password:

   ```bash
   gh auth login
   gh auth setup-git
   ```

   A GitHub SSH key loaded in `ssh-agent` also works.
4. Ask an admin to add your Google Workspace address (`you@vitty.ai`) to your staff row on the server.
   You sign in with it once in each app, below.

### 2. Claude Code

1. Add the Vitty marketplace (the catalog of our plugins):

   ```bash
   claude plugin marketplace add vitty-ai/plugins
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
5. Sign in: in a Claude Code session, run `/mcp`, select `plugin:vitty-ai-cc:vitty` and choose
   **Authenticate**. Your browser opens Google; pick your `vitty.ai` account. Claude Code keeps you signed
   in from then on. Until you sign in, the hooks do nothing and the Vitty tools are missing.

If the download fails on a machine with no GitHub SSH key, set `CLAUDE_CODE_PLUGIN_PREFER_HTTPS=1`
and run the add command again.

### 3. Codex

1. Add the Vitty marketplace:

   ```bash
   codex plugin marketplace add vitty-ai/plugins
   ```

   Codex 0.152.0 or later is needed for the plugin's answer-size setting (`codex --version`).
2. Start Codex, run `/plugins`, pick the `vitty-ai` marketplace and install **vitty-ai-codex**.
3. Trust the plugin's hooks. Codex skips hooks that come with a plugin until you approve them. Run
   `/hooks`, review the four Vitty hooks (two `start`, one `stop`, and one that reads a plan file into `delegate`)
   and trust them. If a later update changes a hook, Codex asks you to review it again.
4. Sign in: run `codex mcp login vitty`. Your browser opens Google; pick your `vitty.ai` account.
   Codex keeps you signed in from then on.
5. Restart Codex.

### Updating

- Claude Code: updates arrive on their own once auto-update is on. To update by hand, run
  `claude plugin marketplace update vitty-ai`.
- Codex: run `codex plugin marketplace upgrade vitty-ai`.

## For maintainers

- Marketplaces: `.claude-plugin/marketplace.json` (Claude Code), `.agents/plugins/marketplace.json` (Codex).
- Server URL:
  - Claude Code: `VITTY_MCP_URL` env var (default `https://gateway-130321581049.asia-south1.run.app/mcp`), set in the shell that launches `claude`.
  - Codex: `.mcp.json` does not expand env vars, so the URL is hardcoded in `plugins/vitty-ai-codex/.mcp.json`.
- Plans: both plugins have a before-tool hook (`hooks/plan-file.mjs`, run with `node`). When the agent hands in a
  plan to `delegate` as `plan_file` (a `.md` file inside the working folder), the hook reads the file into `plan`
  before the call is sent, so the server stores the file's own words. Codex accepts a rewritten call only with
  `permissionDecision: "allow"`, so its copy adds that; Claude Code's does not, so its permission prompt stays.
- Answer size: Codex cuts a tool's answer at about 10,000 tokens by default. The Codex plugin raises it to 50,000
  tokens for `collaborate`, `delegate` and `retrieve` (`tools.<tool>.output_token_limit` in `.mcp.json`; Codex
  0.152.0 or later; a person's own config can only lower it). Claude Code's limit is raised by the server, which
  marks those tools with `anthropic/maxResultSizeChars`.
- Both plugins use native `mcp_tool` hooks against the server in the plugin's `.mcp.json`. The tool's
  return value is the hook output.
  - UserPromptSubmit runs `start` with the message. It also fires for a message typed while the AI is
    working (tested on Claude Code 2.1.291, 6 Oct 2026; Codex source).
  - SessionStart with matcher `compact` runs `start` with `event: "compact"`: the server lists the
    session's open tasks again, because compaction drops the workflow text it handed down.
  - Stop runs `stop`. It holds the reply while a working task has a check without an accepted result, and
    after a compaction until each working task's workflow has been handed down again.
- Sign-in: the server is its own OAuth sign-in service and sends the person to Google for the login. It
  accepts a verified Workspace address that is some staff member's email on the server. Claude Code and Codex
  register themselves, keep the tokens and send them on every call, hooks included, so the plugins carry no
  name, key or header. An mcp_tool hook never starts a sign-in: the person signs in once with `/mcp`
  (Claude Code) or `codex mcp login vitty` (Codex). Whether `codex mcp login` reaches a server defined in a
  plugin is not confirmed yet.
- Bump the plugin `version` on every change, otherwise installed copies won't update.
- Every staff member who installs a plugin can read all of its files, so never put keys or secrets here.
- The server lives in `vitty-ai/mcp`. Staff don't need access to it.
