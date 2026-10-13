# Vitty plugins

Claude Code and Codex plugins for Vitty staff. Each plugin connects your Claude Code or Codex
to the Vitty server. Its hooks run `start` when a conversation starts, is resumed, cleared or compacted, and when
you send a message (also one you type while the AI is working), and `stop` when the AI finishes its reply.
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
   `/hooks`, review the five Vitty hooks (two `start`, one that prints the guide at session start, one `stop`, and one before each Vitty tool call that adds the session
   and reads a plan file into `delegate`)
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
- Server URL: both plugins write the gateway's `/mcp` address in their `.mcp.json`, with no env var. The Claude
  desktop app signs in to an org-installed plugin's server only when the session's copy of the plugin has the same
  address as the org copy, and an env var on one machine made the two differ.
- Before-tool hook: both plugins have one (`hooks/before-tool.mjs`, run with `node`) on retrieve, collaborate,
  delegate and calibrate. It adds the host's `session_id` to every call, so the server
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
  - SessionStart, on startup, resume, clear and compact, runs two hooks. A command hook
    (`hooks/session-start.mjs`) prints the guide to the Vitty tools, which the server serves with no sign-in at
    `/mcp/agent-guide` (the address in `.mcp.json` plus `/agent-guide`); it is the same for everyone, and a command
    hook runs at launch too, before the MCP connection exists. An `mcp_tool` hook runs `start` with the source as
    `event`: the server sends who the person is and, after a compaction, the session's open tasks again, because
    compaction drops the workflow text it handed down. Claude Code skips `mcp_tool` hooks when a session launches
    (startup, and resume with `--resume` or `--continue`; its hooks docs, checked 13 Oct 2026), and Codex runs one
    only once the server is ready, so when no session-start call reached the server, the first message carries who
    the person is instead. UserPromptSubmit carries only what the message brings.
  - Stop runs `stop`. After a reply has gone to the person, it gives the working tasks' validations once a
    turn for the AI to run on that reply and report on, and again after a hand-in. It also holds after a
    compaction until each working task's workflow has been handed down again.
- Sign-in: the server is its own OAuth sign-in service and sends the person to Google for the login. It
  accepts a verified Workspace address that is some staff member's email on the server. Claude Code and Codex
  register themselves, keep the tokens and send them on every call, hooks included, so the plugins carry no
  name, key or header. An mcp_tool hook never starts a sign-in: the person signs in once with `/mcp`
  (Claude Code) or `codex mcp login vitty` (Codex). Whether `codex mcp login` reaches a server defined in a
  plugin is not confirmed yet.
- Bump the plugin `version` on every change, otherwise installed copies won't update.
- Every staff member who installs a plugin can read all of its files, so never put keys or secrets here.
- The server lives in `vitty-ai/full-stack-engineer` (`backend/server`). Staff don't need access to it.
