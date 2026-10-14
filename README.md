# Vitty plugins

Claude Code and Codex plugins for Vitty staff. Each plugin connects your Claude Code or Codex
to the Vitty server. Its hooks run `start` when a conversation starts, is resumed, cleared or compacted, and when
you send a message (also one you type while the AI is working), `always_remember` when you send a message, and `stop`
when the AI finishes its reply.
The plugins hold no server code.

- `plugins/claude`: the Claude Code plugin. Its plugin name is `vitty` and its display name is **Claude (Vitty.AI)**.
- `plugins/codex`: the Codex plugin. Its plugin name is `vitty` and its display name is **Codex (Vitty.AI)**.

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

### 3. Codex

1. Add the Vitty marketplace:

   ```bash
   codex plugin marketplace add vitty-ai/plugins
   ```

   Codex 0.152.0 or later is needed for the plugin's answer-size setting (`codex --version`).
2. Start Codex, run `/plugins`, pick the `vitty-ai` marketplace and install **Codex (Vitty.AI)**.
3. Trust the plugin's hooks. Codex skips hooks that come with a plugin until you approve them. Run
   `/hooks`, review the six Vitty hooks (two `start`, one `always_remember`, one that prints the guide at session start, one `stop`, and one before each Vitty tool call that adds the session)
   and trust them. If a later update changes a hook, Codex asks you to review it again.
4. Sign in: run `codex mcp login vitty`. Your browser opens Google; pick your `vitty.ai` account.
   Codex keeps you signed in from then on.
5. Restart Codex.

### Updating

- Claude Code: updates arrive on their own once auto-update is on. To update by hand, run
  `claude plugin marketplace update vitty-ai`.
- Codex: run `codex plugin marketplace upgrade vitty-ai`.
- Moving from the old plugin names `vitty-ai-cc` and `vitty-ai-codex` to `vitty`: uninstall the old plugin, then install and sign in again as sections 2 and 3 say.
  - Claude Code: run `claude plugin uninstall vitty-ai-cc@vitty-ai`.
  - Codex: uninstall **vitty-ai-codex** in `/plugins`.

## For maintainers

- Marketplaces: `.claude-plugin/marketplace.json` (Claude Code), `.agents/plugins/marketplace.json` (Codex).
- Server URL: both plugins write the server's `/mcp` address, `https://api.vitty.ai/mcp`, in their `.mcp.json`, with no env var. The Claude
  desktop app signs in to an org-installed plugin's server only when the session's copy of the plugin has the same
  address as the org copy, and an env var on one machine made the two differ.
- Before-tool hook: both plugins have one (`hooks/before-tool.mjs`, run with `node`) on retrieve,
  register and create. It adds the host's `session_id` to every call, so the server knows the session and finds a task by its
  number in it; the server refuses a call without it (plugins before Claude Code 0.8.0 and Codex 0.9.0). Codex
  accepts a rewritten call only with `permissionDecision: "allow"`, so its copy adds that, and Codex asks no
  permission for these tools; Claude Code's does not, so its permission prompt stays.
  It also adds `repositories`, the git repositories the device holds (`hooks/repositories.mjs`): the one the
  session's folder is in, those one level inside that repository or folder, and its siblings, each as `owner/name`
  from its `origin` remote, read from the git config files with no `git` process. A task for a repository the device
  does not hold runs on the server.
- Answer size: Codex cuts a tool's answer at about 10,000 tokens by default. The Codex plugin raises it to 50,000
  tokens for `register`, `retrieve` and `create` (`tools.<tool>.output_token_limit` in `.mcp.json`; Codex
  0.152.0 or later; a person's own config can only lower it). Claude Code's limit is raised by the server, which
  marks those tools with `anthropic/maxResultSizeChars`.
- Both plugins use native `mcp_tool` hooks against the server in the plugin's `.mcp.json`. The tool's
  return value is the hook output.
  - UserPromptSubmit runs two hooks, which the hosts run in parallel, each with its own cap on the text it adds. It
    also fires for a message typed while the AI is working (tested on Claude Code 2.1.291, 6 Oct 2026; Codex source).
    - `start` with the message.
    - `always_remember`, whose only job is the person's always-on memory: what they want remembered in every session.
      The server sends it on the session's first message and on the first after each compaction, and nothing on any
      other message, so the AI never has to fetch it. Text past a hook's cap (10,000 characters on Claude Code, 2,500
      tokens on Codex, which an `mcp_tool` hook cannot raise) is saved by the host to a file the AI is shown the path
      of; the agent guide tells it to read that file in full.
  - SessionStart, on startup, resume, clear and compact, runs two hooks. A command hook
    (`hooks/session-start.mjs`) prints the guide to the Vitty tools, which the server serves with no sign-in at
    `/mcp/agent-guide` (the address in `.mcp.json` plus `/agent-guide`); it is the same for everyone, and a command
    hook runs at launch too, before the MCP connection exists. An `mcp_tool` hook runs `start` with the source as
    `event`: the server sends who the person is and, after a compaction, the session's open tasks again, because
    compaction drops the workflow text it handed down. Claude Code skips `mcp_tool` hooks when a session launches
    (startup, and resume with `--resume` or `--continue`; its hooks docs, checked 13 Oct 2026), and Codex runs one
    only once the server is ready, so when no session-start call reached the server, the first message carries who
    the person is instead. Otherwise `start` on UserPromptSubmit carries only what the message brings.
  - Stop runs `stop`. After a reply has gone to the person, it gives once a turn the validations of what was
    registered on the turn's tasks, for the AI to run on that reply and report on, then any post-validation
    steps. When nothing is left, the server reads the turn and closes the tasks whose goal is reached.
- Sign-in: the server is its own OAuth sign-in service and sends the person to Google for the login. It
  accepts a verified Workspace address that is some staff member's email on the server. Claude Code and Codex
  register themselves, keep the tokens and send them on every call, hooks included, so the plugins carry no
  name, key or header. An mcp_tool hook never starts a sign-in: the person signs in once with `/mcp`
  (Claude Code) or `codex mcp login vitty` (Codex). Whether `codex mcp login` reaches a server defined in a
  plugin is not confirmed yet.
- Bump the plugin `version` on every change, otherwise installed copies won't update. Versions are x.y.z, and
  both plugins always have the same x.y.
  - x or y: a change to what the plugins do, such as what a hook sends or when it runs. Both plugins get it, with
    the same new x.y.
  - z: a change only one host needs, such as Codex's `permissionDecision`, or a shared change that alters nothing a
    hook sends or does, such as a comment or this README. Only the plugins it touches bump z.
- Every staff member who installs a plugin can read all of its files, so never put keys or secrets here.
- The server lives in `vitty-ai/full-stack-engineer` (`backend/server`). Staff don't need access to it.
