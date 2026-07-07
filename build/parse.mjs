// Plain line-based parser for subject markdown files. No external dependencies.

const NIVA_RE = /^<!--\s*nivå:\s*(nybörjare|mellan|avancerad)\s*-->\s*$/;
const HEADING_RE = /^## (.+)$/gm;
const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n?/;
const FOOTNOTE_REF_RE = /\[\^(\d+)\]/g;
const SOURCE_LINE_RE = /^\s*(\d+)\.\s+\[(.+?)\]\((\S+?)\)\s*$/;

function parseFrontmatter(block) {
  const frontmatter = {};
  for (const line of block.split('\n')) {
    if (!line.trim()) continue;
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const rawValue = line.slice(idx + 1).trim();
    if (rawValue.startsWith('[') && rawValue.endsWith(']')) {
      const inner = rawValue.slice(1, -1).trim();
      frontmatter[key] = inner === '' ? [] : inner.split(',').map((s) => s.trim());
    } else {
      frontmatter[key] = rawValue;
    }
  }
  return frontmatter;
}

function parseSources(markdown) {
  const sources = [];
  for (const line of markdown.split('\n')) {
    const m = line.match(SOURCE_LINE_RE);
    if (m) {
      sources.push({ n: Number(m[1]), titel: m[2], url: m[3] });
    }
  }
  return sources;
}

export function parseSubjectFile(raw) {
  const fmMatch = raw.match(FRONTMATTER_RE);
  const frontmatter = fmMatch ? parseFrontmatter(fmMatch[1]) : {};
  const body = fmMatch ? raw.slice(fmMatch[0].length) : raw;

  const headingMatches = [...body.matchAll(HEADING_RE)];
  const sections = headingMatches.map((m, i) => {
    const title = m[1].trim();
    const contentStart = m.index + m[0].length;
    const contentEnd = i + 1 < headingMatches.length ? headingMatches[i + 1].index : body.length;
    const markdown = body.slice(contentStart, contentEnd).replace(/^\n+/, '').replace(/\s+$/, '');

    let level = null;
    const firstLine = markdown.split('\n', 1)[0] ?? '';
    const nivaMatch = firstLine.match(NIVA_RE);
    if (nivaMatch) level = nivaMatch[1];

    return { title, level, markdown };
  });

  const sourcesSection = sections.find((s) => s.title === 'Källor');
  const sources = sourcesSection ? parseSources(sourcesSection.markdown) : [];

  const nonSourceBody = sections
    .filter((s) => s.title !== 'Källor')
    .map((s) => s.markdown)
    .join('\n');
  const footnoteRefsSet = new Set();
  for (const m of nonSourceBody.matchAll(FOOTNOTE_REF_RE)) {
    footnoteRefsSet.add(Number(m[1]));
  }
  const footnoteRefs = [...footnoteRefsSet].sort((a, b) => a - b);

  return { frontmatter, sections, sources, footnoteRefs };
}
