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

// Builds a Map<id, Array<{id, titel}>> of cross-references from crossrefs.json's
// `relationer` map. Relations are made symmetric (if A lists B, B relates to A
// even if B's own list omits A), resolved to {id, titel} via the manifest, with
// unknown ids dropped and each amne's list sorted by manifest order.
function buildRelatedMap(manifest, crossrefs) {
  const relationer = (crossrefs && crossrefs.relationer) || {};
  const validIds = new Set(manifest.amnen.map((e) => e.id));
  const idToIndex = new Map(manifest.amnen.map((e, i) => [e.id, i]));
  const idToTitel = new Map(manifest.amnen.map((e) => [e.id, e.titel]));

  const relatedSets = new Map();
  for (const id of validIds) relatedSets.set(id, new Set());

  for (const [fromId, toIds] of Object.entries(relationer)) {
    if (!validIds.has(fromId)) continue;
    for (const toId of toIds || []) {
      if (!validIds.has(toId) || toId === fromId) continue;
      relatedSets.get(fromId).add(toId);
      relatedSets.get(toId).add(fromId);
    }
  }

  const result = new Map();
  for (const [id, set] of relatedSets) {
    const arr = [...set]
      .sort((a, b) => idToIndex.get(a) - idToIndex.get(b))
      .map((rid) => ({ id: rid, titel: idToTitel.get(rid) }));
    result.set(id, arr);
  }
  return result;
}

// Builds the HANDBOK data object from a subjects.json manifest and a
// Map<id, rawMarkdownString> of content files. Validates every file and
// throws an Error listing ALL validation errors (across all files) if any
// file is invalid — does not produce partial output in that case.
// `crossrefs` is the parsed crossrefs.json content ({relationer: {id: [id,...]}});
// defaults to no cross-references (every amne gets relaterade: []).
export function buildData(manifest, files, crossrefs) {
  const errorsByFile = [];
  const amnen = [];
  const relatedMap = buildRelatedMap(manifest, crossrefs);

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
      relaterade: relatedMap.get(entry.id) || [],
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

  let crossrefs;
  try {
    crossrefs = JSON.parse(readFileSync(join(root, 'crossrefs.json'), 'utf8'));
  } catch {
    crossrefs = { relationer: {} }; // absent/unreadable — no cross-references
  }

  let data;
  try {
    data = buildData(manifest, files, crossrefs);
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
