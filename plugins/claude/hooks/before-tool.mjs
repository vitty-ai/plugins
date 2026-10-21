// Before the agent calls a Vitty tool: add the session id, so the server knows the session and finds the
// task by its number in it, and the repositories this device holds, so the server knows which tasks only it can
// run. Before create, also: the text of the file the call names (create-file.mjs). Before sync, refuse the call
// when the device holds no repository around the session's folder, since there is nothing to sync. Node built-ins only.
import fs from 'node:fs';
import { readFile } from './create-file.mjs';
import { heldRepositories } from './repositories.mjs';

const input = JSON.parse(fs.readFileSync(0, 'utf8'));
const args = {
  ...(input.tool_input ?? {}),
  session_id: input.session_id ?? '',
  repositories: heldRepositories(input.cwd),
};

const NOTHING_TO_SYNC =
  'Vitty: this folder, its subfolders and its siblings hold no git repository, so there is nothing to sync.';

function deny(why) {
  console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: why } }));
  process.exit(0);
}

if (/__sync$/.test(input.tool_name ?? '') && args.repositories.length === 0) deny(NOTHING_TO_SYNC);

if (/__create$/.test(input.tool_name ?? '')) {
  const why = readFile(args, input.cwd);
  if (why) deny(why);
}
console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', updatedInput: args } }));
