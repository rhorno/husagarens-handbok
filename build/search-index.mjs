// Slim, text-only search payload consumed by SearchLib.buildIndex on the client.

export function buildSearchIndex(handbok) {
  return handbok.amnen.map((a) => ({
    id: a.id,
    titel: a.titel,
    nyckelord: a.nyckelord,
    sections: a.sections.map((s) => ({ title: s.title, level: s.level, text: s.text })),
  }));
}

export function renderSearchIndexJs(handbok) {
  return `globalThis.HANDBOK_SEARCH = ${JSON.stringify(buildSearchIndex(handbok))};\n`;
}
