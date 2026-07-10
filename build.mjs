// Build script: compiles researched markdown content (content/<kategori>/<id>.md)
// plus subjects.json into site/data.js, a classic script assigning
// globalThis.HANDBOK for the static site to consume over file://.
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSubjectFile } from './build/parse.mjs';
import { validateSubject } from './build/validate.mjs';
import { renderMarkdown, stripToText } from './build/markdown.mjs';

const root = dirname(fileURLToPath(import.meta.url));

// Builds the HANDBOK data object from a subjects.json manifest and a
// Map<id, rawMarkdownString> of content files. Validates every file and
// throws an Error listing ALL validation errors (across all files) if any
// file is invalid — does not produce partial output in that case.
export function buildData(manifest, files) {
  const errorsByFile = [];
  const amnen = [];

  for (const entry of manifest.amnen) {
    const raw = files.get(entry.id);
    if (raw === undefined) {
      errorsByFile.push(`${entry.id}: FILEN SAKNAS`);
      continue;
    }

    const parsed = parseSubjectFile(raw);
    const errors = validateSubject(parsed, entry);
    if (errors.length > 0) {
      for (const e of errors) errorsByFile.push(`${entry.id}: ${e}`);
      continue;
    }

    const sections = parsed.sections.map((s) => ({
      title: s.title,
      level: s.level,
      html: renderMarkdown(s.markdown),
      text: stripToText(s.markdown),
    }));

    amnen.push({
      id: entry.id,
      titel: entry.titel,
      kategori: entry.kategori,
      nyckelord: entry.nyckelord,
      sections,
      sources: parsed.sources,
    });
  }

  if (errorsByFile.length > 0) {
    throw new Error(`Valideringsfel:\n${errorsByFile.map((e) => `  - ${e}`).join('\n')}`);
  }

  return {
    kategorier: manifest.kategorier,
    amnen,
  };
}

function main() {
  const manifest = JSON.parse(readFileSync(join(root, 'subjects.json'), 'utf8'));

  const files = new Map();
  for (const entry of manifest.amnen) {
    const filePath = join(root, 'content', entry.kategori, `${entry.id}.md`);
    try {
      files.set(entry.id, readFileSync(filePath, 'utf8'));
    } catch {
      // Leave missing — buildData will report "FILEN SAKNAS".
    }
  }

  let data;
  try {
    data = buildData(manifest, files);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
    return;
  }

  const outPath = join(root, 'site', 'data.js');
  writeFileSync(outPath, `globalThis.HANDBOK = ${JSON.stringify(data)};\n`);
  console.log(`OK: ${data.amnen.length} ämnen`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
