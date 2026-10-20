// Keeps the git repository the session's folder is in up to date with GitHub. At a fresh launch (the first argument
// `start`): fetch, then, when nothing is uncommitted, check out main and fast-forward it to origin/main, so the new
// session starts from main; with uncommitted work the folder stays as it is and the agent is told. At every message
// (`fetch`): fetch in the background and return at once; fetch changes no file. git runs with no terminal and no
// prompts and under a time limit, so a missing sign-in skips the refresh instead of hanging. Node built-ins only.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FETCH_SECONDS = 15;
const LOCAL_SECONDS = 10;
// No terminal (the process runs in a session of its own) and these, so git and ssh never wait for a person.
const NO_PROMPTS = { GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never' };
// What git keeps in its folder while a merge, rebase, cherry-pick, revert or bisect is under way.
const UNDER_WAY = ['MERGE_HEAD', 'rebase-merge', 'rebase-apply', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'BISECT_LOG'];

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

// At a fresh launch: what the agent is told about root, or null when there is nothing to tell. folder is the
// session's folder inside root.
export async function start(root, folder) {
  const fetched = (await git(root, ['fetch', '--quiet', 'origin'], FETCH_SECONDS)).ok;
  const status = await git(root, ['status', '--porcelain'], LOCAL_SECONDS);
  const branch = (await git(root, ['branch', '--show-current'], LOCAL_SECONDS)).out || 'a detached HEAD';
  if (!status.ok) return `Vitty: git could not read ${root}, so it was left on ${branch}.`;
  const gitDir = (await git(root, ['rev-parse', '--absolute-git-dir'], LOCAL_SECONDS)).out;
  if (gitDir && UNDER_WAY.some((name) => fs.existsSync(path.join(gitDir, name)))) {
    return `Vitty: ${root} is in the middle of a git operation on ${branch}, so it was left as it is. ` +
      'Read main as GitHub holds it from origin/main, not from these files.';
  }
  if (status.out) {
    return `Vitty: ${root} has uncommitted changes on ${branch}, so it was left as it is. ` +
      'Read main as GitHub holds it from origin/main, not from these files.';
  }
  const inside = path.relative(root, path.resolve(folder)).split(path.sep).join('/');
  if (branch !== 'main' && inside) {
    const local = (await git(root, ['rev-parse', '--verify', '--quiet', 'main'], LOCAL_SECONDS)).ok;
    const main = local ? 'main' : 'origin/main';
    if (!(await git(root, ['cat-file', '-e', `${main}:${inside}`], LOCAL_SECONDS)).ok) {
      return `Vitty: the session's folder is not on main, so ${root} was left on ${branch}. ` +
        'Read main from origin/main.';
    }
  }
  if (branch !== 'main' && !(await git(root, ['checkout', '--quiet', 'main'], LOCAL_SECONDS)).ok) {
    return `Vitty: ${root} could not check out main, so it was left on ${branch}. Read main from origin/main.`;
  }
  if (!fetched) {
    return `Vitty: ${root} is on main, but GitHub could not be reached, so main may be behind origin/main.`;
  }
  if (!(await git(root, ['merge', '--ff-only', '--quiet', 'origin/main'], LOCAL_SECONDS)).ok) {
    return `Vitty: ${root} is on main, but main holds commits origin/main lacks, so it was not brought up to ` +
      'date. Read main as GitHub holds it from origin/main.';
  }
  return null;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const step = process.argv[2];
  if (step === 'fetch-now') {
    await git(process.argv[3], ['fetch', '--quiet', 'origin'], FETCH_SECONDS);
  } else {
    let input = {};
    try {
      input = JSON.parse(fs.readFileSync(0, 'utf8'));
    } catch {
      input = {};
    }
    const folder = input.cwd || process.cwd();
    const root = repositoryRoot(folder);
    if (root && step === 'start') {
      const told = await start(root, folder);
      if (told) process.stdout.write(`${told}\n`);
    }
    if (root && step === 'fetch') {
      // A process of its own that outlives this one, so the message is not held up.
      const self = fileURLToPath(import.meta.url);
      spawn(process.execPath, [self, 'fetch-now', root], { detached: true, stdio: 'ignore' }).unref();
    }
  }
}
