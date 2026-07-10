// Validates a parsed subject document against the handbook's content rules.
// Never throws: always returns an array of human-readable error strings
// (empty array = valid).

const EXPECTED_SECTIONS = [
  'Översikt',
  'Grunderna',
  'Regler & lagkrav',
  'Praktisk vägledning',
  'Fördjupning',
  'Underhållsschema',
  'Vanliga misstag',
  'När ska du anlita proffs',
  'Källor',
];

const NIVA_BY_SECTION = {
  Grunderna: 'nybörjare',
  'Praktisk vägledning': 'mellan',
  Fördjupning: 'avancerad',
};

const FOOTNOTE_EXEMPT_SECTIONS = new Set(['När ska du anlita proffs', 'Källor']);

const NIVA_LINE_RE = /^<!--\s*nivå:\s*(nybörjare|mellan|avancerad)\s*-->\s*$/m;
const CODE_FENCE_RE = /```/;
const BLOCKQUOTE_RE = /^\s*>/m;
const IMAGE_RE = /!\[[^\]]*\]\([^)]*\)/;
const HTML_TAG_RE = /<[^>]+>/;
const FOOTNOTE_REF_RE = /\[\^(\d+)\]/g;

function checkFrontmatter(frontmatter, manifestEntry, errors) {
  const fm = frontmatter || {};
  for (const field of ['id', 'titel', 'kategori', 'nyckelord']) {
    const value = fm[field];
    const missing = value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0);
    if (missing) {
      errors.push(`Frontmatter saknar fältet "${field}"`);
    }
  }

  if (manifestEntry) {
    if (fm.id !== undefined && manifestEntry.id !== undefined && fm.id !== manifestEntry.id) {
      errors.push(`Frontmatter-fältet "id" ("${fm.id}") matchar inte manifestets id ("${manifestEntry.id}")`);
    }
    if (
      fm.kategori !== undefined &&
      manifestEntry.kategori !== undefined &&
      fm.kategori !== manifestEntry.kategori
    ) {
      errors.push(
        `Frontmatter-fältet "kategori" ("${fm.kategori}") matchar inte manifestets kategori ("${manifestEntry.kategori}")`
      );
    }
  }
}

function checkSectionsPresentAndOrdered(sections, errors) {
  const titles = sections.map((s) => s.title);

  const missing = EXPECTED_SECTIONS.filter((t) => !titles.includes(t));
  for (const title of missing) {
    errors.push(`Saknar sektionen "${title}"`);
  }

  if (missing.length === 0) {
    const actualOrderOfExpected = titles.filter((t) => EXPECTED_SECTIONS.includes(t));
    const inOrder = actualOrderOfExpected.every((t, i) => t === EXPECTED_SECTIONS[i]);
    if (!inOrder) {
      errors.push(
        `Sektionerna är i fel ordning. Förväntad ordning: ${EXPECTED_SECTIONS.join(', ')}`
      );
    }
  }
}

function checkNiva(sections, errors) {
  for (const [title, expectedLevel] of Object.entries(NIVA_BY_SECTION)) {
    const section = sections.find((s) => s.title === title);
    if (!section) continue; // already reported as a missing section
    if (section.level !== expectedLevel) {
      errors.push(
        `Sektionen "${title}" saknar eller har fel nivå-kommentar (förväntat "<!-- nivå: ${expectedLevel} -->")`
      );
    }
  }
}

function checkFootnotesPerSection(sections, errors) {
  for (const section of sections) {
    if (FOOTNOTE_EXEMPT_SECTIONS.has(section.title)) continue;
    if (!EXPECTED_SECTIONS.includes(section.title)) continue; // unknown section, not our concern here
    const hasRef = FOOTNOTE_REF_RE.test(section.markdown);
    FOOTNOTE_REF_RE.lastIndex = 0;
    if (!hasRef) {
      errors.push(`Sektionen "${section.title}" saknar fotnotsreferens ([^n])`);
    }
  }
}

function checkRefsAndSources(footnoteRefs, sources, errors) {
  const refSet = new Set(footnoteRefs || []);
  const sourceMap = new Map((sources || []).map((s) => [s.n, s]));

  for (const ref of refSet) {
    if (!sourceMap.has(ref)) {
      errors.push(`Fotnotsreferensen [^${ref}] saknar en motsvarande källa i Källor`);
    }
  }
  for (const source of sources || []) {
    if (!refSet.has(source.n)) {
      errors.push(`Källan ${source.n} är inte refererad av någon fotnot ([^${source.n}] saknas)`);
    }
  }
}

function checkSourceUrls(sources, errors) {
  for (const source of sources || []) {
    if (typeof source.url !== 'string' || !source.url.startsWith('https://')) {
      errors.push(`Källan ${source.n} har en url som inte börjar med https:// ("${source.url}")`);
    }
  }
}

function checkForbiddenMarkdown(sections, errors) {
  for (const section of sections) {
    const { title, markdown } = section;

    if (CODE_FENCE_RE.test(markdown)) {
      errors.push(`Sektionen "${title}" innehåller ett otillåtet kodblock (\`\`\`)`);
    }
    if (BLOCKQUOTE_RE.test(markdown)) {
      errors.push(`Sektionen "${title}" innehåller ett otillåtet citat (blockquote, ">")`);
    }
    if (IMAGE_RE.test(markdown)) {
      errors.push(`Sektionen "${title}" innehåller en otillåten bild (image)`);
    }

    const withoutNivaLine = markdown.replace(NIVA_LINE_RE, '');
    if (HTML_TAG_RE.test(withoutNivaLine)) {
      errors.push(`Sektionen "${title}" innehåller otillåten inline HTML`);
    }
  }
}

export function validateSubject(parsed, manifestEntry) {
  const errors = [];
  try {
    const safe = parsed || {};
    const sections = Array.isArray(safe.sections) ? safe.sections : [];

    checkFrontmatter(safe.frontmatter, manifestEntry, errors);
    checkSectionsPresentAndOrdered(sections, errors);
    checkNiva(sections, errors);
    checkFootnotesPerSection(sections, errors);
    checkRefsAndSources(safe.footnoteRefs, safe.sources, errors);
    checkSourceUrls(safe.sources, errors);
    checkForbiddenMarkdown(sections, errors);
  } catch (err) {
    errors.push(`Internt valideringsfel: ${err && err.message ? err.message : String(err)}`);
  }
  return errors;
}
