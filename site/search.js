// Classic script (no import/export) — works both as a browser <script> over file://
// and as a CommonJS-style module dynamically imported from Node tests. Sets
// globalThis.SearchLib.
(function () {
  function normalize(s) {
    if (s == null) return '';
    return String(s).toLowerCase().trim().replace(/\s+/g, ' ');
  }

  function tokenize(s) {
    const norm = normalize(s);
    if (!norm) return [];
    return norm.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  }

  function buildIndex(subjects) {
    const index = [];
    (subjects || []).forEach((subject) => {
      const titleTokens = tokenize(subject.titel);
      const keywordTokens = (subject.nyckelord || []).flatMap((kw) => tokenize(kw));
      (subject.sections || []).forEach((section, sectionIdx) => {
        const text = section.text || '';
        index.push({
          subjectId: subject.id,
          subjectTitle: subject.titel,
          sectionIdx,
          sectionTitle: section.title,
          level: section.level,
          tokens: tokenize(text),
          titleTokens,
          keywordTokens,
          text,
        });
      });
    });
    return index;
  }

  function buildSnippet(text, token) {
    const workingText = normalize(text);
    const wordRe = /[\p{L}\p{N}]+/gu;
    let m;
    while ((m = wordRe.exec(workingText)) !== null) {
      if (m[0].startsWith(token)) {
        const start = m.index;
        const end = start + m[0].length;
        return {
          before: workingText.slice(Math.max(0, start - 60), start),
          match: workingText.slice(start, end),
          after: workingText.slice(end, end + 60),
        };
      }
    }
    return { before: '', match: '', after: '' };
  }

  function search(index, query, limit) {
    const lim = limit == null ? 20 : limit;
    const queryTokens = tokenize(query);
    if (queryTokens.length === 0) return [];

    const results = [];
    index.forEach((entry, entryPos) => {
      let totalScore = 0;
      for (const qt of queryTokens) {
        let best = 0;
        if (entry.titleTokens.some((t) => t.startsWith(qt))) best = Math.max(best, 8);
        const sectionTitleTokens = tokenize(entry.sectionTitle);
        if (sectionTitleTokens.some((t) => t.startsWith(qt))) best = Math.max(best, 5);
        if (entry.keywordTokens.some((t) => t.startsWith(qt))) best = Math.max(best, 4);
        if (entry.tokens.some((t) => t.startsWith(qt))) best = Math.max(best, 1);
        if (best === 0) {
          totalScore = -1;
          break;
        }
        totalScore += best;
      }
      if (totalScore < 0) return;

      results.push({
        subjectId: entry.subjectId,
        subjectTitle: entry.subjectTitle,
        sectionIdx: entry.sectionIdx,
        sectionTitle: entry.sectionTitle,
        level: entry.level,
        score: totalScore,
        snippet: buildSnippet(entry.text, queryTokens[0]),
        __pos: entryPos,
      });
    });

    results.sort((a, b) => b.score - a.score || a.__pos - b.__pos);

    return results.slice(0, lim).map(({ __pos, ...rest }) => rest);
  }

  globalThis.SearchLib = { normalize, tokenize, buildIndex, search };
})();
