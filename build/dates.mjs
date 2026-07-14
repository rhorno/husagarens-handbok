// Publish/modified dates for a content file, from git history, with a build-date fallback.
import { execFileSync } from 'node:child_process';

export function normalizeDates(createdRaw, modifiedRaw, fallback) {
  const created = String(createdRaw || '').trim() || fallback;
  const modified = String(modifiedRaw || '').trim() || created;
  return { datePublished: created, dateModified: modified };
}

function gitRun(args) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
}

export function gitDates(absPath, fallback) {
  let created = '';
  let modified = '';
  try {
    const adds = gitRun(['log', '--diff-filter=A', '--follow', '--format=%cs', '--', absPath])
      .trim().split('\n').filter(Boolean);
    created = adds.length ? adds[adds.length - 1] : '';
    modified = gitRun(['log', '-1', '--format=%cs', '--', absPath]).trim();
  } catch {
    // git unavailable or file untracked — fall through to fallback.
  }
  return normalizeDates(created, modified, fallback);
}
