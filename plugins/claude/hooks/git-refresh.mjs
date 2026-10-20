// At session start and at every message: fetch the git repository the session's folder is in, and keep its main
// branch equal to GitHub's. When main is checked out, it is fast-forwarded; when it is not, the branch alone is moved
// forward, with no checkout. Nothing switches a branch or makes a merge, and git refuses rather than overwrite
// uncommitted changes. git runs with no terminal and no prompts and under a time limit, so a missing sign-in skips
// the refresh instead of hanging. The agent is told only when main could not be brought up to date. Node built-ins
// only.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FETCH_SECONDS = 15;
const LOCAL_SECONDS = 10;
// No terminal (the process runs in a session of its own) and these, so git and ssh never wait for a person.
const NO_PROMPTS = { GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never' };

// git with args in folder, killed after seconds: { ok, out }.
export function git(folder, args, seconds) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn('git', args, {
        cwd: folder,
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, ...NO_PROMPTS },
      });
    } catch {
      resolve({ ok: false, out: '' });
      return;
    }
    let out = '';
    child.stdout.on('data', (data) => { out += data; });
    child.stderr.on('data', () => {});
    const timer = setTimeout(() => {
      try {
        process.kill(-child.pid, 'SIGKILL');
      } catch {
        child.kill('SIGKILL');
      }
    }, seconds * 1000);
    child.on('error', () => {
      clearTimeout(timer);
      resolve({ ok: false, out: '' });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ ok: code === 0, out: out.trim() });
    });
  });
}

// The folder of the git repository folder is in, or null.
export function repositoryRoot(folder) {
  for (let at = path.resolve(folder); ; at = path.dirname(at)) {
    if (fs.existsSync(path.join(at, '.git'))) return at;
    if (path.dirname(at) === at) return null;
  }
}

// What the agent is told about root, or null when there is nothing to tell. A repository with no origin remote, or
// whose origin has no main, is left alone.
export async function refresh(root) {
  if (!(await git(root, ['remote', 'get-url', 'origin'], LOCAL_SECONDS)).ok) return null;
  if (!(await git(root, ['fetch', '--quiet', 'origin'], FETCH_SECONDS)).ok) {
    return `Vitty: GitHub could not be reached from ${root}, so its main may be behind GitHub's.`;
  }
  if (!(await git(root, ['rev-parse', '--verify', '--quiet', 'origin/main'], LOCAL_SECONDS)).ok) return null;
  const branch = (await git(root, ['branch', '--show-current'], LOCAL_SECONDS)).out;
  const moved = branch === 'main'
    ? await git(root, ['merge', '--ff-only', '--quiet', 'origin/main'], LOCAL_SECONDS)
    : await git(root, ['fetch', '--quiet', '.', 'origin/main:main'], LOCAL_SECONDS);
  if (moved.ok) return null;
  return `Vitty: main in ${root} could not be fast-forwarded to GitHub's, so it is not up to date. ` +
    'GitHub\'s main is origin/main.';
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let input = {};
  try {
    input = JSON.parse(fs.readFileSync(0, 'utf8'));
  } catch {
    input = {};
  }
  const root = repositoryRoot(input.cwd || process.cwd());
  const told = root ? await refresh(root) : null;
  if (told) process.stdout.write(`${told}\n`);
}
