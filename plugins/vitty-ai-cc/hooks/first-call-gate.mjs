// Experiment (9 Oct 2026): before a tool call that may change something, stop the agent once and ask it to check
// its workflow. A call that is plainly a read goes through. Any other call is denied on its first attempt, and a
// hash of the call is stored, so the same call retried right after goes through. No server and no model call.
//
// The read-only patterns are those of vitty-ai/mcp PR #15 (services/before_tool.py, only_reads), ported to
// Node, with two holes closed: a `#` inside a word no longer hides the rest of the line, and sed flags after a
// file name count, since GNU sed reads them anywhere. Read, Grep and Glob never reach this hook (hooks.json
// matcher). Set VITTY_FIRST_CALL_GATE=off to turn it off. Any error lets the call through. Node built-ins only.
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const MESSAGE = 'Have you ensured that you have followed all steps of the active workflows/procedures that might gate '
  + 'this step? If yes then retry this exact tool invocation. If no, evaluate.';

// Vitty's own tools, as both hosts name them: mcp__<server>__<tool>, the server's name holding "vitty".
const VITTY_TOOL = /^mcp__.*vitty.*__/;
const READ_TOOLS = new Set(['Read', 'Grep', 'Glob']);
const SHELL_TOOLS = new Set(['Bash']);
// Shell commands that only read, list or search. Each part of a command must start with one of them.
const READ_COMMANDS = new Set(['ls', 'cat', 'head', 'tail', 'wc', 'grep', 'find', 'pwd', 'cd', 'tree', 'stat', 'file']);
// ripgrep options that run another program: --pre runs one on each file, --hostname-bin runs one for links.
const RG_RUNS = ['--pre', '--hostname-bin'];
// git commands that only list files.
const GIT_READS = new Set(['ls-files', 'ls-tree']);
// A sed script that only prints: each command is p or =, after at most two addresses (a line, $ or /regex/).
const SED_ADDRESS = String.raw`(\d+|\$|/[^/]*/)`;
const SED_PRINT = String.raw`\s*(${SED_ADDRESS}(\s*,\s*${SED_ADDRESS})?)?\s*[p=]\s*`;
const SED_PRINT_ONLY = new RegExp(`^${SED_PRINT}(;${SED_PRINT})*;?$`);
// The find options that run a command, delete or write a file.
const FIND_WRITES = new Set(['-exec', '-execdir', '-ok', '-okdir', '-delete', '-fprint', '-fprint0', '-fprintf', '-fls']);
// What joins the parts of a command. Every other shell operator (redirection, a subshell, a background job) makes
// the command not a plain read.
const JOINS = new Set(['&&', '||', ';', '|']);
const PUNCTUATION = '();<>|&';
// Error output thrown away or joined to the output: no file is written, so these are cut before the split.
const QUIET = /\s2>(\/dev\/null|&1)(?=\s|$)/g;
// Text that runs another command inside a word, which the split below does not see.
const SUBSTITUTIONS = ['`', '$(', '<(', '>('];

// The words of a shell line, split as Python's shlex.shlex(posix=True, punctuation_chars=True) with
// whitespace_split does, but with no comments: a run of ();<>|& is a word of its own. Throws on an unclosed quote.
export function words(command) {
  const out = [];
  let state = ' ', token = '', quoted = false, escaped = 'a';
  for (let i = 0; i <= command.length; i++) {
    const end = i === command.length;
    const ch = command[i];
    if (state === '\\') {
      if (end) throw new Error('No escaped character');
      if (escaped === '"' && ch !== '"' && ch !== '\\') token += '\\';
      token += ch;
      state = escaped;
      continue;
    }
    if (state === "'" || state === '"') {
      quoted = true;
      if (end) throw new Error('No closing quotation');
      if (ch === state) state = 'a';
      else if (state === '"' && ch === '\\') { escaped = '"'; state = '\\'; }
      else token += ch;
      continue;
    }
    if (state === 'c') {
      if (!end && PUNCTUATION.includes(ch)) { token += ch; continue; }
      out.push(token); token = ''; quoted = false; state = ' ';
    }
    if (end) break;
    const space = ' \t\r\n'.includes(ch);
    if (state === 'a' && (space || PUNCTUATION.includes(ch))) {
      out.push(token); token = ''; quoted = false; state = ' ';
    }
    if (space) continue;
    if (PUNCTUATION.includes(ch)) { token = ch; state = 'c'; }
    else if (ch === "'" || ch === '"') state = ch;
    else if (ch === '\\') { escaped = 'a'; state = '\\'; }
    else { token += ch; state = 'a'; }
  }
  if (state === 'a' && (token || quoted)) out.push(token);
  return out;
}

// Whether a shell command is only plain reads joined by &&, ||, ; or |. Anything it cannot split cleanly is not.
export function onlyReads(command) {
  if (!command.trim() || SUBSTITUTIONS.some(s => command.includes(s))) return false;
  let list;
  try {
    list = words(command.replace(QUIET, ' ').replaceAll('\n', ' ; '));
  } catch {
    return false; // an unclosed quote
  }
  const parts = [[]];
  for (const word of list) {
    if (JOINS.has(word)) parts.push([]);
    else if ([...word].every(c => PUNCTUATION.includes(c))) return false; // redirection, a subshell or a background job
    else parts.at(-1).push(word);
  }
  const filled = parts.filter(p => p.length);
  return filled.length > 0 && filled.every(partReads);
}

// Whether one command of a shell line only reads: a listed read command, git ls-files or ls-tree, or sed that only
// prints.
function partReads([name, ...args]) {
  if (name === 'find') return !args.some(a => FIND_WRITES.has(a));
  if (name === 'git') {
    while (args[0] === '-C') args = args.slice(2); // git -C <folder> runs in that folder
    return args.length > 0 && GIT_READS.has(args[0]);
  }
  if (name === 'sed') return sedPrintsOnly(args);
  if (name === 'rg') return !args.some(a => RG_RUNS.some(r => a.startsWith(r)));
  if (name === 'tree') return !args.some(a => a === '-o' || a.startsWith('--output')); // tree -o writes a file
  return READ_COMMANDS.has(name);
}

// sed with no in-place edit and no script file, whose every script only prints lines.
function sedPrintsOnly(args) {
  const scripts = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '-e' || arg === '--expression') scripts.push(args[++i] ?? '');
    else if (arg.startsWith('--expression=')) scripts.push(arg.slice('--expression='.length));
    else if (arg.startsWith('--in-place') || arg.startsWith('--file=') || arg === '-f' || arg === '--file') return false;
    else if (arg.startsWith('-') && !arg.startsWith('--')) {
      if (/[iIfe]/.test(arg.slice(1))) return false; // in place, a script file, or a script stuck to its flag
    } else if (arg.startsWith('--')) continue;
    else if (!scripts.length) scripts.push(arg);
  }
  return scripts.length > 0 && scripts.every(s => SED_PRINT_ONLY.test(s));
}

export function isReadOnly(toolName, toolInput) {
  if (READ_TOOLS.has(toolName) || VITTY_TOOL.test(toolName)) return true;
  return SHELL_TOOLS.has(toolName) && onlyReads(String(toolInput?.command ?? ''));
}

// The same JSON for the same call, whatever order the host wrote its keys in.
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

const sha = text => crypto.createHash('sha256').update(text).digest('hex');

// One file per blocked call, under a folder per session: creating and removing a file is safe when the host runs
// several hooks at once.
export function seen(sessionId, toolName, toolInput, dir = path.join(os.tmpdir(), 'vitty-first-call-gate')) {
  const folder = path.join(dir, sha(String(sessionId || 'no-session')).slice(0, 32));
  const file = path.join(folder, sha(`${toolName}\n${canonical(toolInput ?? {})}`));
  try {
    fs.unlinkSync(file); // the retry: let it through once, and ask again next time
    return true;
  } catch {
    fs.mkdirSync(folder, { recursive: true });
    fs.writeFileSync(file, '');
    return false;
  }
}

function main() {
  if (/^(off|0|false)$/i.test(process.env.VITTY_FIRST_CALL_GATE ?? '')) return;
  const input = JSON.parse(fs.readFileSync(0, 'utf8'));
  if (isReadOnly(input.tool_name ?? '', input.tool_input)) return;
  if (seen(input.session_id, input.tool_name ?? '', input.tool_input)) return;
  console.log(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: MESSAGE },
  }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    main();
  } catch {
    // Let the call through, as the hosts do when a hook fails.
  }
}
