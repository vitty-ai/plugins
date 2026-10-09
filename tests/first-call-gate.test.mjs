// Run with: node --test (from the repository root)
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { isReadOnly, onlyReads, seen } from '../plugins/vitty-ai-cc/hooks/first-call-gate.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const hook = path.join(root, 'plugins/vitty-ai-cc/hooks/first-call-gate.mjs');

// The plain reads and the non-reads of vitty-ai/mcp PR #15 (tests/test_before_tool.py).
const READS = [
  'ls', 'ls -la src', 'cd server && ls vitty', 'cat a.py | head -20',
  "grep -rn 'def start' vitty; wc -l vitty/services/start.py", "find . -name '*.md' 2>/dev/null | head",
  'ls missing 2>&1', 'pwd\nls', 'tree -L 2 server', "rg -n 'def start' server | head", "rg --files -g '*.md'",
  'git ls-files | grep before_tool', 'git -C server ls-tree -r HEAD --name-only', "sed -n '1,80p' vitty/services/start.py",
  "sed -n -e '/^def /p' -e '$=' a.py", "cat a.py | sed -n '10,20p'",
];
const NOT_READS = [
  '', 'rm -rf build', 'ls > files.txt', 'cat a >> b', 'cat $(rm x)', 'cat `rm x`', "find . -name '*.pyc' -delete",
  'find . -exec rm {} ;', 'ls && git commit -m x', '(cd x && ls)', 'sleep 1 &', "sed -i 's/a/b/' a.py",
  "sed -n 's/a/b/w out.txt' a.py", "sed -ni '1p' a.py", "sed --in-place=.bak '1d' a.py", 'sed -f script.sed a.py',
  "sed '1d' a.py", 'tree -o listing.txt', 'rg --pre ./run.sh foo', 'rg --pre=./run.sh foo', 'rg --hostname-bin ./h foo',
  'git status', 'git checkout -- a.py', 'FOO=1 ls', "cat 'unclosed", 'cat <<EOF\nx\nEOF',
  // The two holes closed here: PR #15 passes these.
  'cat a#b; rm -rf x', 'ls # x\nrm y', 'sed -n 1p a.py -i', "sed -n --expression='w out' p",
];

test('plain reads are read-only', () => {
  for (const command of READS) assert.ok(onlyReads(command), command);
});

test('anything else is not', () => {
  for (const command of NOT_READS) assert.ok(!onlyReads(command), command);
});

test('file reads, Vitty tools and plain read commands are read-only; other calls are not', () => {
  assert.ok(isReadOnly('Read', { file_path: 'a.py' }));
  assert.ok(isReadOnly('mcp__plugin_vitty-ai-cc_vitty__delegate', { task_id: 1 }));
  assert.ok(isReadOnly('mcp__vitty__retrieve', {}));
  assert.ok(isReadOnly('Bash', { command: 'ls -la', description: 'List files' }));
  assert.ok(!isReadOnly('Bash', { command: 'git diff' }));
  assert.ok(!isReadOnly('Edit', { file_path: 'a.py' }));
  assert.ok(!isReadOnly('apply_patch', { input: '*** Begin Patch' }));
  assert.ok(!isReadOnly('mcp__github__create_pull_request', {}));
});

test('a call is blocked once, its exact retry goes through, and the next attempt is blocked again', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-'));
  const call = { command: 'npm test', description: 'Run tests' };
  assert.equal(seen('s1', 'Bash', call, dir), false);
  assert.equal(seen('s1', 'Bash', { description: 'Run tests', command: 'npm test' }, dir), true);
  assert.equal(seen('s1', 'Bash', call, dir), false);
  assert.equal(seen('s2', 'Bash', call, dir), false, 'another session');
  assert.equal(seen('s1', 'Bash', { ...call, command: 'npm test -- -x' }, dir), false, 'a different call');
});

function run(input, env = {}) {
  const result = spawnSync('node', [hook], { input: JSON.stringify(input), env: { ...process.env, TMPDIR: tmp, ...env } });
  return result.stdout.toString().trim();
}
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-run-'));

test('the hook denies the first attempt with the message, then lets the retry through', () => {
  const input = { session_id: `s-${Date.now()}`, tool_name: 'Write', tool_input: { file_path: 'a.md', content: 'x' } };
  const out = JSON.parse(run(input)).hookSpecificOutput;
  assert.equal(out.hookEventName, 'PreToolUse');
  assert.equal(out.permissionDecision, 'deny');
  assert.match(out.permissionDecisionReason, /^Have you ensured that you have followed all steps/);
  assert.equal(run(input), '');
});

test('reads, the off switch and bad input all go through', () => {
  assert.equal(run({ session_id: 'r', tool_name: 'Bash', tool_input: { command: 'cat a | head' } }), '');
  assert.equal(run({ session_id: 'o', tool_name: 'Edit', tool_input: {} }, { VITTY_FIRST_CALL_GATE: 'off' }), '');
  const result = spawnSync('node', [hook], { input: 'not json' });
  assert.equal(result.status, 0);
  assert.equal(result.stdout.toString(), '');
});

test('the Codex plugin carries the same script', () => {
  const codex = path.join(root, 'plugins/vitty-ai-codex/hooks/first-call-gate.mjs');
  assert.equal(fs.readFileSync(codex, 'utf8'), fs.readFileSync(hook, 'utf8'));
});
