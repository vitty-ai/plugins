// Before the agent calls the Vitty delegate tool: when the hand-in names a plan_file, put that file's
// text into `plan`, so the server stores the file's own words and the agent never retypes the plan.
// The file must be a .md file inside the working folder. Node built-ins only.
import fs from 'node:fs';
import path from 'node:path';

const input = JSON.parse(fs.readFileSync(0, 'utf8'));
const args = input.tool_input ?? {};
const result = args.result;
if (!result || typeof result !== 'object' || !result.plan_file) process.exit(0);

function deny(reason) {
  console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason } }));
  process.exit(0);
}

const cwd = input.cwd || process.cwd();
const file = path.resolve(cwd, result.plan_file);
const inside = path.relative(cwd, file);
if (inside.startsWith('..') || path.isAbsolute(inside)) deny(`The plan file ${result.plan_file} is outside the working folder.`);
if (path.extname(file) !== '.md') deny(`The plan file ${result.plan_file} is not a .md file.`);
if (!fs.existsSync(file)) deny(`There is no plan file at ${result.plan_file}. Write the plan there first.`);
if (path.relative(fs.realpathSync(cwd), fs.realpathSync(file)).startsWith('..')) deny(`The plan file ${result.plan_file} links outside the working folder.`);
const plan = fs.readFileSync(file, 'utf8');
if (!plan.trim()) deny(`The plan file ${result.plan_file} is empty.`);

const updatedInput = { ...args, result: { ...result, plan_file: inside.split(path.sep).join('/'), plan } };
console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', updatedInput } }));
