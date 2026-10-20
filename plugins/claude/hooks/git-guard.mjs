// Before the agent runs a shell command: refuse `git push`, and `git commit` while the repository has main checked
// out, and point to Vitty's sync tool, which puts a task's commits on its pull request. It reads the command's text,
// so a command written in an unusual way can get past it. Node built-ins only; it runs no git.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PUSH = 'Vitty: the agent never pushes. Commit on the task\'s branch (its Branch line) and call sync with the task and repository: the server pushes the commits and opens the pull request.';
const ON_MAIN = 'Vitty: never commit on main. Switch to the task\'s branch (its Branch line) first, commit there, then call sync with the task and repository.';

// Words that can come before the command a shell segment runs.
const PREFIXES = new Set(['sudo', 'command', 'exec', 'time', 'nohup', 'env']);
// git's options that come before its command and take the next word as their value.
const VALUED = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--exec-path', '--config-env']);

export function refusal(command, cwd) {
  let folder = path.resolve(cwd || process.cwd());
  // A branch an earlier part of the same command switches to, which HEAD does not show yet.
  let switched = null;
  for (const segment of String(command ?? '').split(/&&|\|\||[;|\n]/)) {
    const words = segment.trim().split(/\s+/).filter(Boolean).map((w) => w.replace(/^['"]|['"]$/g, ''));
    if (words[0] === 'cd' && words[1]) {
      folder = path.resolve(folder, words[1].replace(/^~(?=$|\/)/, process.env.HOME ?? '~'));
      continue;
    }
    let at = 0;
    while (at < words.length && (PREFIXES.has(words[at]) || /^\w+=/.test(words[at]))) at++;
    if (words[at] !== 'git' && !words[at]?.endsWith('/git')) continue;
    let where = folder;
    let i = at + 1;
    for (; i < words.length && words[i].startsWith('-'); i++) {
      const option = words[i].split('=')[0];
      if (VALUED.has(option) && !words[i].includes('=')) {
        if (option === '-C') where = path.resolve(where, words[i + 1] ?? '');
        i++;
      }
    }
    const rest = words.slice(i + 1);
    if (words[i] === 'push') return PUSH;
    if (words[i] === 'switch' || words[i] === 'checkout') switched = switchedTo(rest) ?? switched;
    if (words[i] === 'commit' && (switched ?? branchOf(where)) === 'main') return ON_MAIN;
  }
  return null;
}

// The branch a `git switch` or `git checkout` goes to: the value of -c, -C, -b or -B, else its last word that is no
// option; null when it names files after `--`.
function switchedTo(rest) {
  if (rest.includes('--')) return null;
  const made = rest.findIndex((w) => ['-c', '-C', '-b', '-B', '--create', '--force-create'].includes(w));
  if (made >= 0) return rest[made + 1] ?? null;
  return rest.filter((w) => !w.startsWith('-')).at(-1) ?? null;
}

// The branch checked out in the repository around folder, from its HEAD file, or null.
function branchOf(folder) {
  for (let at = folder; ; at = path.dirname(at)) {
    const dotGit = path.join(at, '.git');
    let gitDir = null;
    try {
      gitDir = fs.statSync(dotGit).isDirectory()
        ? dotGit
        : path.resolve(at, fs.readFileSync(dotGit, 'utf8').match(/^gitdir:\s*(.+)$/m)[1].trim());
    } catch {
      gitDir = null;
    }
    if (gitDir) {
      try {
        const head = fs.readFileSync(path.join(gitDir, 'HEAD'), 'utf8').trim();
        return head.startsWith('ref: refs/heads/') ? head.slice('ref: refs/heads/'.length) : null;
      } catch {
        return null;
      }
    }
    if (path.dirname(at) === at) return null;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const input = JSON.parse(fs.readFileSync(0, 'utf8'));
  const why = refusal(input.tool_input?.command, input.cwd);
  if (why) {
    console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: why } }));
  }
}
