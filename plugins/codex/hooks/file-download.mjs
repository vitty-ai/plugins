// After the agent calls Vitty's retrieve: for each file the answer sends whole (not text, or text too big for the
// index), fetch it from the address the answer gives, check it against the hash in that address, save it under the
// system's temporary folder, and put where it was saved in place of the answer's Save as and Download lines. The
// file's bytes never enter the agent's context: it opens the saved file with its own tools. Node built-ins only.
// Codex's copy of the Claude Code plugin's hook: Codex puts a PostToolUse hook's reason in the tool's answer's place
// only with decision "block" (learn.chatgpt.com/docs/hooks).
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { textOf } from './sync-upload.mjs';

// How long one file may take to arrive.
const REQUEST_MS = 600_000;

// The origin of the Vitty server this plugin calls, from its .mcp.json: the only one a file is fetched from, so text
// in a file that reads like these lines fetches nothing.
export function serverOrigin() {
  try {
    const mcp = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.mcp.json'), 'utf8'));
    return new URL(mcp.mcpServers.vitty.url).origin;
  } catch {
    return null;
  }
}

// Where the files of one session are saved.
export function folderFor(sessionId) {
  return path.join(os.tmpdir(), 'vitty-files', String(sessionId || 'session').replace(/[^\w.-]/g, '_'));
}

// Fetch one file into folder/name: the line that takes the place of its Save as and Download lines.
export async function saved(folder, name, url, origin = serverOrigin()) {
  let address;
  try {
    address = new URL(url);
  } catch {
    return `Not saved: ${url} is not an address.`;
  }
  if (address.origin !== origin || !/^\/mcp\/files\/[0-9a-f-]{36}$/.test(address.pathname)) {
    return `Not saved: ${url} is not an address of the Vitty server this plugin calls.`;
  }
  const file = path.resolve(folder, name);
  if (!file.startsWith(path.resolve(folder) + path.sep)) return `Not saved: ${name} is not a path inside a folder.`;
  const wanted = address.searchParams.get('hash') ?? '';
  let response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_MS) });
  } catch (error) {
    return `Not saved: the file did not arrive (${error.message}). Call retrieve for it again.`;
  }
  if (!response.ok) return `Not saved: ${(await response.text()).trim()}`;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const part = `${file}.${process.pid}.part`;
  const digest = crypto.createHash('sha256');
  const out = fs.createWriteStream(part);
  try {
    for await (const chunk of response.body) {
      digest.update(chunk);
      if (!out.write(chunk)) await new Promise((done) => out.once('drain', done));
    }
    await new Promise((done, failed) => out.end((error) => (error ? failed(error) : done())));
  } catch (error) {
    out.destroy();
    fs.rmSync(part, { force: true });
    return `Not saved: the file did not arrive whole (${error.message}). Call retrieve for it again.`;
  }
  if (digest.digest('hex') !== wanted) {
    fs.rmSync(part, { force: true });
    return 'Not saved: what arrived is not the file the index read. Call retrieve for it again.';
  }
  fs.renameSync(part, file);
  return `Saved: ${file}`;
}

// The answer with each file it sends whole saved, and its Save as and Download lines replaced by where it was saved;
// null when the answer sends none.
export async function withSaved(answer, sessionId, origin = serverOrigin()) {
  const lines = answer.split('\n');
  if (!lines.some((line) => line.startsWith('Download: '))) return null;
  const folder = folderFor(sessionId);
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const name = lines[i].match(/^Save as: (.+)$/)?.[1];
    const url = lines[i + 1]?.match(/^Download: (\S+)$/)?.[1];
    if (name && url) {
      out.push(await saved(folder, name, url, origin));
      i++;
    } else {
      out.push(lines[i]);
    }
  }
  return out.join('\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const input = JSON.parse(fs.readFileSync(0, 'utf8'));
  const text = await withSaved(textOf(input.tool_response), input.session_id);
  if (text !== null) {
    console.log(JSON.stringify({ decision: 'block', reason: text }));
  }
}
