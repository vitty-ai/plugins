// At every session start, launch included: print the guide to the Vitty tools, which the host adds to the
// agent's context. The server serves it with no sign-in, since it is the same for everyone, so this runs
// before the MCP connection exists, where an mcp_tool hook cannot. Its address is the server's in
// .mcp.json plus /agent-guide. Node built-ins only.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const { url } = JSON.parse(fs.readFileSync(path.join(root, '.mcp.json'), 'utf8')).mcpServers.vitty;
const response = await fetch(`${url}/agent-guide`, { signal: AbortSignal.timeout(8000) });
if (!response.ok) throw new Error(`The Vitty server answered ${response.status} for the agent guide.`);
process.stdout.write(await response.text());
