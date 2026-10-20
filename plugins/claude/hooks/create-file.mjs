// Before create: when the call names a file, put the file's text into file_text, and when it names a series of .law
// files in files, their texts into file_texts, so the server reads the files' own words and the agent never retypes
// them. Each file is in the session's folder or in the system's temporary folder, and is text of at most FILE_CHARS
// characters. Node built-ins only.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const FILE_CHARS = 200000;

// Why the call cannot go, or null once file_text and file_texts hold the files' texts or the call names no file. args
// is changed in place: a file_text or file_texts the agent wrote itself never reaches the server.
export function readFile(args, cwd) {
  delete args.file_text;
  delete args.file_texts;
  const named = typeof args.file === 'string' ? args.file.trim() : '';
  if (named) {
    const read = readOne(named, cwd);
    if (read.why) return read.why;
    args.file_text = read.text;
  }
  if (Array.isArray(args.files) && args.files.length) {
    const texts = [];
    for (const name of args.files) {
      const read = readOne(String(name).trim(), cwd);
      if (read.why) return read.why;
      texts.push(read.text);
    }
    args.file_texts = texts;
  }
  return null;
}

// The file's text, or why it cannot be read.
function readOne(named, cwd) {
  const folder = cwd || process.cwd();
  const file = path.resolve(folder, named);
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return { why: `There is no file at ${named}. Write it first, then call create again.` };
  const real = fs.realpathSync(file);
  const inside = (root) => {
    try {
      const rel = path.relative(fs.realpathSync(root), real);
      return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
    } catch {
      return false;
    }
  };
  if (!inside(folder) && !inside(os.tmpdir())) return { why: `The file ${named} is outside the working folder.` };
  const text = fs.readFileSync(real, 'utf8');
  if (text.length > FILE_CHARS) return { why: `The file ${named} is longer than ${FILE_CHARS} characters.` };
  return { text };
}
