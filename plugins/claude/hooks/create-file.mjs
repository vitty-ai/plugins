// Before create: when the call names a file, put the file's text into file_text, so the server reads the file's own
// words and the agent never retypes them. The file is in the session's folder or in the system's temporary folder,
// and is text of at most FILE_CHARS characters. Node built-ins only.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const FILE_CHARS = 200000;

// Why the call cannot go, or null once file_text holds the file's text or the call names no file. args is changed in
// place: a file_text the agent wrote itself never reaches the server.
export function readFile(args, cwd) {
  delete args.file_text;
  const named = typeof args.file === 'string' ? args.file.trim() : '';
  if (!named) return null;
  const folder = cwd || process.cwd();
  const file = path.resolve(folder, named);
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return `There is no file at ${named}. Write it first, then call create again.`;
  const real = fs.realpathSync(file);
  const inside = (root) => {
    try {
      const rel = path.relative(fs.realpathSync(root), real);
      return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
    } catch {
      return false;
    }
  };
  if (!inside(folder) && !inside(os.tmpdir())) return `The file ${named} is outside the working folder.`;
  const text = fs.readFileSync(real, 'utf8');
  if (text.length > FILE_CHARS) return `The file ${named} is longer than ${FILE_CHARS} characters.`;
  args.file_text = text;
  return null;
}
