// CLI gate: validates subject markdown files against subjects.json.
// Usage: node build/check-content.mjs [file...]  (no args = all subjects in manifest)
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSubjectFile } from './parse.mjs';
import { validateSubject } from './validate.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(join(root, 'subjects.json'), 'utf8'));
const byId = new Map(manifest.amnen.map((a) => [a.id, a]));

let files = process.argv.slice(2);
if (files.length === 0) {
  files = manifest.amnen.map((a) => join(root, 'content', a.kategori, `${a.id}.md`));
}

let failed = 0;
for (const file of files) {
  let raw;
  try {
    raw = readFileSync(file, 'utf8');
  } catch {
    failed++;
    console.error(`${file}: FILEN SAKNAS`);
    continue;
  }
  const parsed = parseSubjectFile(raw);
  const entry = byId.get(parsed.frontmatter?.id);
  const errors = validateSubject(parsed, entry ?? { id: '(okänt id)', kategori: '(okänd)' });
  if (!entry) errors.unshift(`frontmatter-id "${parsed.frontmatter?.id}" finns inte i subjects.json`);
  if (errors.length > 0) {
    failed++;
    console.error(`${file}:`);
    for (const e of errors) console.error(`  - ${e}`);
  }
}

if (failed > 0) {
  console.error(`\n${failed} av ${files.length} filer har fel`);
  process.exit(1);
}
console.log(`OK: ${files.length} filer validerade`);
