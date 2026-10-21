// The git repositories this device holds around the session's folder, as owner/name from each one's origin remote:
// the repository the folder is in (or the folder itself), the repositories one level inside it, and its siblings.
// The server runs a task on the server when its repository is not among them. Node built-ins only; it reads each
// repository's git config, so it runs no git.
import fs from 'node:fs';
import path from 'node:path';

// At most this many folders are looked at in one place, so a home folder with thousands of entries stays quick.
const MOST_FOLDERS = 500;

export function heldRepositories(folder) {
  return [...heldFolders(folder).keys()].sort();
}

// The same repositories, each with the folder that holds it: the first found, in the order above.
export function heldFolders(folder) {
  const start = path.resolve(folder || process.cwd());
  const base = repositoryRoot(start) ?? start;
  const places = [base, ...children(base), ...children(path.dirname(base))];
  const found = new Map();
  for (const place of places) {
    const name = originName(place);
    if (name && !found.has(name)) found.set(name, place);
  }
  return found;
}

function repositoryRoot(folder) {
  for (let at = folder; ; at = path.dirname(at)) {
    if (fs.existsSync(path.join(at, '.git'))) return at;
    if (path.dirname(at) === at) return null;
  }
}

function children(folder) {
  try {
    return fs.readdirSync(folder, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
      .slice(0, MOST_FOLDERS)
      .map((entry) => path.join(folder, entry.name));
  } catch {
    return [];
  }
}

// owner/name of a repository's origin remote, or of its first remote when it has no origin; null when the folder is
// not a repository or its remote names none.
function originName(folder) {
  const config = configOf(folder);
  if (!config) return null;
  let text;
  try {
    text = fs.readFileSync(config, 'utf8');
  } catch {
    return null;
  }
  const urls = {};
  let remote = null;
  for (const line of text.split('\n')) {
    const section = line.match(/^\s*\[\s*remote\s+"([^"]+)"\s*\]/);
    if (section) remote = section[1];
    else if (/^\s*\[/.test(line)) remote = null;
    else if (remote && !(remote in urls)) {
      const url = line.match(/^\s*url\s*=\s*(.+?)\s*$/);
      if (url) urls[remote] = url[1];
    }
  }
  const url = urls.origin ?? Object.values(urls)[0];
  const parts = url?.replace(/\.git\/?$/, '').replace(/\/+$/, '').split(/[/:]/).filter(Boolean);
  return parts && parts.length >= 2 ? `${parts.at(-2)}/${parts.at(-1)}` : null;
}

// The config file of the repository at folder: .git/config, or for a worktree or submodule, whose .git is a file
// naming its git folder, the config of the repository that folder belongs to.
function configOf(folder) {
  const dotGit = path.join(folder, '.git');
  let stat;
  try {
    stat = fs.statSync(dotGit);
  } catch {
    return null;
  }
  if (stat.isDirectory()) return path.join(dotGit, 'config');
  try {
    const gitDir = path.resolve(folder, fs.readFileSync(dotGit, 'utf8').match(/^gitdir:\s*(.+)$/m)[1].trim());
    const common = path.join(gitDir, 'commondir');
    const root = fs.existsSync(common) ? path.resolve(gitDir, fs.readFileSync(common, 'utf8').trim()) : gitDir;
    return path.join(root, 'config');
  } catch {
    return null;
  }
}
