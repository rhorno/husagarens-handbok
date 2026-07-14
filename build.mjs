// Build script: compiles researched markdown content (content/<kategori>/<id>.md)
// plus subjects.json into site/data.js, a classic script assigning
// globalThis.HANDBOK for the static site to consume over file://.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSubjectFile } from './build/parse.mjs';
import { validateSubject } from './build/validate.mjs';
import { renderMarkdown, stripToText } from './build/markdown.mjs';
import { BASE_URL, absUrl, subjectPath, categoryPath } from './build/site-url.mjs';
import { renderHomePage, renderCategoryPage, renderSubjectPage, render404 } from './build/render-pages.mjs';
import { renderSearchIndexJs } from './build/search-index.mjs';
import { renderSitemap, renderRobots, renderLlmsTxt, renderLlmsFullTxt } from './build/discovery.mjs';
import { deriveDescription } from './build/describe.mjs';
import { gitDates } from './build/dates.mjs';

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

function buildContext(handbok) {
  const amnenByKategori = new Map(handbok.kategorier.map((k) => [k.id, []]));
  for (const a of handbok.amnen) {
    if (!amnenByKategori.has(a.kategori)) amnenByKategori.set(a.kategori, []);
    amnenByKategori.get(a.kategori).push(a);
  }
  const katTitelById = new Map(handbok.kategorier.map((k) => [k.id, k.titel]));
  return { kategorier: handbok.kategorier, amnenByKategori, katTitelById };
}

function writeFile(outDir, relPath, contents) {
  const full = join(outDir, relPath);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, contents);
}

export function generateSite(handbok, { outDir, contentDir, buildDate }) {
  const ctx = buildContext(handbok);
  let fileCount = 0;
  const write = (rel, c) => { writeFile(outDir, rel, c); fileCount++; };

  // Home
  write('index.html', renderHomePage(ctx));

  // Category pages
  for (const kat of handbok.kategorier) {
    const subs = ctx.amnenByKategori.get(kat.id) || [];
    write(join('kategori', kat.id, 'index.html'), renderCategoryPage(kat, subs, ctx));
  }

  // Subject pages
  const dateByAmne = new Map();
  for (const a of handbok.amnen) {
    const dates = gitDates(join(contentDir, a.kategori, a.id + '.md'), buildDate);
    dateByAmne.set(a.id, dates);
    write(join('amne', a.id, 'index.html'), renderSubjectPage(a, dates, ctx));
  }

  // Search index
  write('search-index.js', renderSearchIndexJs(handbok));

  // 404
  write('404.html', render404(ctx));

  // Sitemap
  const urls = [{ loc: absUrl('/'), lastmod: buildDate }];
  for (const kat of handbok.kategorier) urls.push({ loc: absUrl(categoryPath(kat.id)), lastmod: buildDate });
  for (const a of handbok.amnen) urls.push({ loc: absUrl(subjectPath(a.id)), lastmod: dateByAmne.get(a.id).dateModified });
  write('sitemap.xml', renderSitemap(urls));

  // robots.txt
  write('robots.txt', renderRobots(absUrl('/sitemap.xml')));

  // llms.txt
  write('llms.txt', renderLlmsTxt({
    title: 'Husägarens handbok',
    summary: 'Komplett, faktagranskad och sökbar guide för husägare i Sverige.',
    homeUrl: absUrl('/'),
    categories: handbok.kategorier.map((kat) => ({
      titel: kat.titel,
      subjects: (ctx.amnenByKategori.get(kat.id) || []).map((a) => ({
        titel: a.titel,
        url: absUrl(subjectPath(a.id)),
        description: deriveDescription((a.sections.find((s) => s.title === 'Översikt') || {}).text || ''),
      })),
    })),
  }));

  // llms-full.txt
  write('llms-full.txt', renderLlmsFullTxt({
    title: 'Husägarens handbok — fullständig text',
    subjects: handbok.amnen.map((a) => ({
      titel: a.titel,
      url: absUrl(subjectPath(a.id)),
      text: a.sections.map((s) => s.title + '\n' + s.text).join('\n\n'),
    })),
  }));

  return { fileCount };
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

  const buildDate = new Date().toISOString().slice(0, 10);
  const { fileCount } = generateSite(data, {
    outDir: join(root, 'site'),
    contentDir: join(root, 'content'),
    buildDate,
  });
  console.log(`OK: ${data.amnen.length} ämnen, ${fileCount} filer genererade (${BASE_URL})`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
