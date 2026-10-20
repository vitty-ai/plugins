// After the agent calls Vitty's sync: when the answer gives an upload address, bundle the commits after the answer's
// base in the repository's folder, post the bundle in pieces of the size the answer gives, then ask the address to take
// them, and put what the server said in the answer's place. The agent never runs the upload. Node built-ins only.
// Codex's copy of the Claude Code plugin's hook: Codex puts a PostToolUse hook's reason in the tool's answer's place
// only with decision "block" (learn.chatgpt.com/docs/hooks).
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { heldFolders } from './repositories.mjs';

// How many times a piece is sent before the upload gives up, and how long one request may take (nginx's limit).
const TRIES = 3;
const REQUEST_MS = 900_000;

// The text of a tool's answer, however the host passes it: a string, content blocks, or an object holding them.
export function textOf(response) {
  if (typeof response === 'string') return response;
  if (Array.isArray(response)) return response.map(textOf).join('');
  if (response && typeof response === 'object') {
    if (typeof response.text === 'string') return response.text;
    if (response.content !== undefined) return textOf(response.content);
    if (response.result !== undefined) return textOf(response.result);
  }
  return '';
}

// What the upload lines of sync's answer say; null when it gives no upload.
export function uploadOf(answer) {
  const url = answer.match(/^Upload: (\S+)$/m)?.[1];
  const base = answer.match(/^Upload base: (\S+)$/m)?.[1];
  const pieces = answer.match(/^Upload pieces: (\d+) bytes each, at most (\d+) bytes in all$/m);
  if (!url || !base || !pieces) return null;
  return { url, base, piece: Number(pieces[1]), most: Number(pieces[2]) };
}

function git(folder, ...args) {
  const done = spawnSync('git', args, {
    cwd: folder,
    encoding: 'utf8',
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
  });
  return done.status === 0 ? done.stdout.trim() : null;
}

async function post(url, body, headers) {
  let why = '';
  for (let attempt = 1; attempt <= TRIES; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream', ...headers },
        body,
        signal: AbortSignal.timeout(REQUEST_MS),
      });
      const text = await response.text();
      if (response.status < 500) return { ok: response.ok, text: text.trim() };
      why = `the server answered ${response.status}`;
    } catch (error) {
      why = error.message;
    }
  }
  return { ok: false, text: `Refused: the upload did not reach the server (${why}). Call sync again.` };
}

// Upload the commits of the folder's checked-out branch as sync's answer says: what the server said.
export async function uploaded(folder, upload) {
  const head = git(folder, 'rev-parse', 'HEAD') ?? '';
  const branch = git(folder, 'branch', '--show-current') ?? '';
  const base = git(folder, 'rev-parse', '-q', '--verify', `${upload.base}^{commit}`);
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'vitty-sync-'));
  const file = path.join(scratch, 'upload.bundle');
  try {
    // A copy that lacks base, or a bundle git cannot make, sends no commits, and the server says how to bring the
    // branch in.
    if (!base || base === head || git(folder, 'bundle', 'create', '-q', file, 'HEAD', `^${base}`) === null) {
      fs.writeFileSync(file, '');
    }
    const size = fs.statSync(file).size;
    const count = Math.ceil(size / upload.piece);
    const [address, query] = upload.url.split('?');
    const digest = crypto.createHash('sha256');
    // Over what one sync takes, no piece is sent: the server says so from the size alone.
    if (size <= upload.most) {
      const fd = fs.openSync(file, 'r');
      try {
        for (let n = 0; n < count; n++) {
          const piece = Buffer.alloc(Math.min(upload.piece, size - n * upload.piece));
          fs.readSync(fd, piece, 0, piece.length, n * upload.piece);
          digest.update(piece);
          const sent = await post(`${address}/pieces/${n}?${query}`, piece, {});
          if (!sent.ok) return sent.text;
        }
      } finally {
        fs.closeSync(fd);
      }
    }
    const done = await post(upload.url, '', {
      'X-Vitty-Head': head,
      'X-Vitty-Branch': branch,
      'X-Vitty-Pieces': String(count),
      'X-Vitty-Size': String(size),
      'X-Vitty-Sha256': digest.digest('hex'),
    });
    return done.text;
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
}

// The folder of the repository sync named, among those this device holds around the session's folder.
function folderOf(repository, cwd) {
  for (const [name, folder] of heldFolders(cwd)) {
    if (name.split('/').at(-1) === repository) return folder;
  }
  return null;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const input = JSON.parse(fs.readFileSync(0, 'utf8'));
  const answer = textOf(input.tool_response);
  const upload = uploadOf(answer);
  if (upload) {
    const repository = String(input.tool_input?.repository ?? '').trim();
    const folder = folderOf(repository, input.cwd);
    const said = folder
      ? await uploaded(folder, upload)
      : `Refused: this device holds no folder of ${repository} around ${input.cwd}, so nothing was uploaded.`;
    const text = answer
      .split('\n')
      .filter((line) => !line.startsWith('Upload'))
      .map((line) => (line.startsWith('Next: ') ? said : line))
      .join('\n');
    console.log(JSON.stringify({ decision: 'block', reason: text }));
  }
}
