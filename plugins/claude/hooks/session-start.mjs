// At every session start, launch included: print a text the server serves for every agent, which the host
// adds to the agent's context. The first argument names it: definitions (the docs that define Vitty, tasks
// and jobs), or, when none is given, agent-guide (the guide to the Vitty tools). Two hooks keep each text
// under the host's limit for one hook. The server serves both with no sign-in, since they are the same for
// everyone, so this runs before the MCP connection exists, where an mcp_tool hook cannot. The guide's fetch
// also posts the host session's id and how it started (launch, compaction, clear or resume), so the server
// marks its next message as the conversation's first; the message's own signed-in hooks then send what goes
// once per conversation. Node built-ins only.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const { url } = JSON.parse(fs.readFileSync(path.join(root, '.mcp.json'), 'utf8')).mcpServers.vitty;
const text = process.argv[2] ?? 'agent-guide';
const { session_id, source } = JSON.parse(fs.readFileSync(0, 'utf8'));
const response = text === 'agent-guide'
  ? await fetch(`${url}/${text}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ client: 'claude-code', session_id, source }),
      signal: AbortSignal.timeout(8000),
    })
  : await fetch(`${url}/${text}`, { signal: AbortSignal.timeout(8000) });
if (!response.ok) throw new Error(`The Vitty server answered ${response.status} for ${text}.`);
process.stdout.write(await response.text());
