// Before the agent calls a Vitty tool: add the session id, so the server knows the session and finds the
// task by its number in it, and the repositories this device holds, so the server knows which tasks only it can
// run. Node built-ins only.
// Codex's copy of the Claude Code plugin's hook: Codex takes a rewritten input only with
// permissionDecision "allow" (codex-rs hooks/src/engine/output_parser.rs).
import fs from 'node:fs';
import { heldRepositories } from './repositories.mjs';

const input = JSON.parse(fs.readFileSync(0, 'utf8'));
const args = {
  ...(input.tool_input ?? {}),
  session_id: input.session_id ?? '',
  repositories: heldRepositories(input.cwd),
};

console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'allow', updatedInput: args } }));
