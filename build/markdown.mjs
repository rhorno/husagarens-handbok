// Renders the allowed markdown subset (headings #-###, paragraphs, `-`/`1.` lists with
// one level of nesting, **bold**, *italic*, [text](url) links, GFM tables, footnote
// refs [^n]) to HTML. Node-only, build-time. No external dependencies.

const NIVA_LINE_RE = /^<!--\s*nivå:\s*(nybörjare|mellan|avancerad)\s*-->\s*$/;
const HEADING_LINE_RE = /^(#{1,3})\s+(.+)$/;
const SEPARATOR_ROW_RE = /^[\s|:-]+$/;

function stripNivaComments(md) {
  return md
    .split('\n')
    .filter((line) => !NIVA_LINE_RE.test(line))
    .join('\n');
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function inline(text) {
  let out = escapeHtml(text);
  out = out.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/\*(.+?)\*/g, '<em>$1</em>');
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  out = out.replace(/\[\^(\d+)\]/g, '<sup class="fotnot" data-n="$1"><a href="#kalla-$1">$1</a></sup>');
  return out;
}

function leadingSpaces(line) {
  return line.match(/^ */)[0].length;
}

function matchListMarker(line) {
  const t = line.trim();
  let m = t.match(/^-\s+(.*)$/);
  if (m) return { type: 'ul', content: m[1] };
  m = t.match(/^\d+\.\s+(.*)$/);
  if (m) return { type: 'ol', content: m[1] };
  return null;
}

function isListMarkerLine(line) {
  return matchListMarker(line) !== null;
}

function isTopLevelListLine(line) {
  return leadingSpaces(line) === 0 && isListMarkerLine(line);
}

function buildListTree(lines) {
  const items = [];
  let type = null;
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const marker = matchListMarker(line);
    if (!marker) {
      i++;
      continue;
    }
    if (type === null) type = marker.type;
    let j = i + 1;
    const childLines = [];
    while (j < lines.length && leadingSpaces(lines[j]) > 0) {
      childLines.push(lines[j].replace(/^ {1,2}/, ''));
      j++;
    }
    const child = childLines.length ? buildListTree(childLines) : null;
    items.push({ content: marker.content, child });
    i = j;
  }
  return { type, items };
}

function renderListTree(tree) {
  const tag = tree.type === 'ol' ? 'ol' : 'ul';
  const itemsHtml = tree.items
    .map((item) => {
      let html = `<li>${inline(item.content)}`;
      if (item.child) html += renderListTree(item.child);
      html += '</li>';
      return html;
    })
    .join('');
  return `<${tag}>${itemsHtml}</${tag}>`;
}

function splitTableRow(line) {
  let t = line.trim();
  if (t.startsWith('|')) t = t.slice(1);
  if (t.endsWith('|')) t = t.slice(0, -1);
  return t.split('|').map((cell) => cell.trim());
}

function renderTable(lines) {
  const headerCells = splitTableRow(lines[0]);
  const bodyRows = lines.slice(2).map(splitTableRow);
  const thead = `<thead><tr>${headerCells.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead>`;
  const tbody = `<tbody>${bodyRows
    .map((row) => `<tr>${row.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`)
    .join('')}</tbody>`;
  return `<table>${thead}${tbody}</table>`;
}

export function renderMarkdown(md) {
  const cleaned = stripNivaComments(md);
  const lines = cleaned.split('\n');
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === '') {
      i++;
      continue;
    }

    const heading = line.match(HEADING_LINE_RE);
    if (heading) {
      const level = heading[1].length; // 1-3
      const tag = `h${level + 1}`; // h2, h3, h4
      blocks.push(`<${tag}>${inline(heading[2].trim())}</${tag}>`);
      i++;
      continue;
    }

    if (line.includes('|') && i + 1 < lines.length && SEPARATOR_ROW_RE.test(lines[i + 1]) && lines[i + 1].includes('-')) {
      const tableLines = [lines[i], lines[i + 1]];
      let j = i + 2;
      while (j < lines.length && lines[j].trim() !== '' && lines[j].includes('|')) {
        tableLines.push(lines[j]);
        j++;
      }
      blocks.push(renderTable(tableLines));
      i = j;
      continue;
    }

    if (isTopLevelListLine(line)) {
      const listLines = [line];
      let j = i + 1;
      while (j < lines.length && lines[j].trim() !== '' && (leadingSpaces(lines[j]) > 0 || isTopLevelListLine(lines[j]))) {
        listLines.push(lines[j]);
        j++;
      }
      blocks.push(renderListTree(buildListTree(listLines)));
      i = j;
      continue;
    }

    // Paragraph: consume consecutive plain lines until blank / new block start.
    const paraLines = [line];
    let j = i + 1;
    while (
      j < lines.length &&
      lines[j].trim() !== '' &&
      !HEADING_LINE_RE.test(lines[j]) &&
      !isTopLevelListLine(lines[j]) &&
      !(lines[j].includes('|') && j + 1 < lines.length && SEPARATOR_ROW_RE.test(lines[j + 1]) && lines[j + 1].includes('-'))
    ) {
      paraLines.push(lines[j]);
      j++;
    }
    blocks.push(`<p>${inline(paraLines.join(' ').trim())}</p>`);
    i = j;
  }

  return blocks.join('\n');
}

export function stripToText(md) {
  let text = stripNivaComments(md);

  // Remove footnote refs entirely.
  text = text.replace(/\[\^\d+\]/g, '');
  // Links: keep the visible text only.
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1');
  // Bold / italic markers.
  text = text.replace(/\*\*(.+?)\*\*/g, '$1');
  text = text.replace(/\*(.+?)\*/g, '$1');

  const outLines = [];
  for (const rawLine of text.split('\n')) {
    const line = rawLine;
    if (line.trim() === '') continue;
    if (SEPARATOR_ROW_RE.test(line) && line.includes('-')) continue;

    let cleanedLine = line;
    const heading = cleanedLine.match(HEADING_LINE_RE);
    if (heading) {
      cleanedLine = heading[2];
    } else {
      const listMarker = matchListMarker(cleanedLine);
      if (listMarker) {
        cleanedLine = listMarker.content;
      } else if (cleanedLine.includes('|')) {
        cleanedLine = splitTableRow(cleanedLine).join(' ');
      }
    }
    outLines.push(cleanedLine);
  }

  return outLines
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}
