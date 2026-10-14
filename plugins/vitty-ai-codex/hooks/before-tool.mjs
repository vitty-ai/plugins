// Before the agent calls a Vitty tool: add the session id, so the server knows the session and finds the
// task by its number in it. Node built-ins only.
// Codex's copy of the Claude Code plugin's hook: Codex takes a rewritten input only with
// permissionDecision "allow" (codex-rs hooks/src/engine/output_parser.rs).
import fs from 'node:fs';

const input = JSON.parse(fs.readFileSync(0, 'utf8'));
const args = { ...(input.tool_input ?? {}), session_id: input.session_id ?? '' };

console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'allow', updatedInput: args } }));
