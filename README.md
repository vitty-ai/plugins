# Vitty plugins

Claude Code and Codex plugins for Vitty staff. Each plugin connects your Claude Code or Codex
to the Vitty server. Its hooks run `start` when you send a message (also one you type while the AI is
working) and again after the conversation is compacted, and `stop` when the AI finishes its reply.
The plugins hold no server code.

- `plugins/claude-code`: the Claude Code plugin
- `plugins/codex`: the Codex plugin

Both plugins are named `vitty`, with the same description and logo, and come from the marketplace `vitty-ai`.

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
   claude plugin install vitty
   ```

3. Check it loaded:

   ```bash
   claude plugin list
   ```

   `vitty@vitty-ai` should show `Status: ✔ enabled`.
4. Turn on automatic updates: in a Claude Code session, run `/plugin`, open **Marketplaces**, select
   `vitty-ai`, and choose **Enable auto-update**.
5. Sign in: in a Claude Code session, run `/mcp`, select `plugin:vitty:vitty` and choose
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
2. Start Codex, run `/plugins`, pick the `vitty-ai` marketplace and install **Vitty** (`vitty`).
3. Trust the plugin's hooks. Codex skips hooks that come with a plugin until you approve them. Run
   `/hooks`, review the four Vitty hooks (two `start`, one `stop`, and one before each Vitty tool call that adds the session
   and reads a plan file into `delegate`)
   and trust them. If a later update changes a hook, Codex asks you to review it again.
4. Sign in: run `codex mcp login vitty`. Your browser opens Google; pick your `vitty.ai` account.
   Codex keeps you signed in from then on.
5. Restart Codex.

### Moving from the old names

Before 0.10.0 the plugins were named `vitty-ai-cc` (Claude Code) and `vitty-ai-codex` (Codex).

- Claude Code: after the marketplace updates, the old plugin stops loading. Run `claude plugin install vitty`
  once, then sign in again with `/mcp` under `plugin:vitty:vitty`.
- Codex: in `/plugins`, uninstall `vitty-ai-codex` and install `vitty`, then trust its hooks again in `/hooks`.

### Updating

- Claude Code: updates arrive on their own once auto-update is on. To update by hand, run
  `claude plugin marketplace update vitty-ai`.
- Codex: run `codex plugin marketplace upgrade vitty-ai`.

## For maintainers

- Marketplaces: `.claude-plugin/marketplace.json` (Claude Code), `.agents/plugins/marketplace.json` (Codex).
- Name, description and logo are the same in both plugins. Claude Code shows no plugin logo; its `icon`
  field is read only by Anthropic's plugin directory. A Claude Code rename goes in the marketplace's `renames`
  map, which keeps every old name; Codex has no rename field, so its users reinstall.
- Server URL: both plugins write the gateway's `/mcp` address in their `.mcp.json`, with no env var. The Claude
  desktop app signs in to an org-installed plugin's server only when the session's copy of the plugin has the same
  address as the org copy, and an env var on one machine made the two differ.
- Before-tool hook: both plugins have one (`hooks/before-tool.mjs`, run with `node`) on retrieve, collaborate,
  delegate, calibrate and submit_validation_result. It adds the host's `session_id` to every call, so the server
  knows the session and finds a task by its number in it; the server refuses a call without it (plugins before
  Claude Code 0.8.0 and Codex 0.9.0). Before `delegate`, when the agent hands in a plan as `plan_file` (a `.md` file
  inside the working folder), it also reads the file into `plan`, so the server stores the file's own words. One
  hook does both, since two hooks on one tool cannot both rewrite its input. Codex accepts a rewritten call only
  with `permissionDecision: "allow"`, so its copy adds that, and Codex asks no permission for these tools; Claude
  Code's does not, so its permission prompt stays.
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
  - Stop runs `stop`. It holds the reply while a working task has a pending or failed check, and
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
