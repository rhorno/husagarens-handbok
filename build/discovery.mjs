// Sitemap, robots, and llms.txt/llms-full.txt generators.

export function renderSitemap(urls) {
  const items = urls.map((u) =>
    '  <url>\n    <loc>' + u.loc + '</loc>\n    <lastmod>' + u.lastmod + '</lastmod>\n  </url>').join('\n');
  return '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + items + '\n</urlset>\n';
}

export function renderRobots(sitemapUrl) {
  return 'User-agent: *\nAllow: /\n\nSitemap: ' + sitemapUrl + '\n';
}

export function renderLlmsTxt({ title, summary, homeUrl, categories }) {
  let out = '# ' + title + '\n\n> ' + summary + '\n\nWebbplats: ' + homeUrl + '\n';
  for (const cat of categories) {
    out += '\n## ' + cat.titel + '\n\n';
    for (const s of cat.subjects) out += '- [' + s.titel + '](' + s.url + '): ' + s.description + '\n';
  }
  return out;
}

export function renderLlmsFullTxt({ title, subjects }) {
  let out = '# ' + title + '\n';
  for (const s of subjects) out += '\n\n# ' + s.titel + '\n' + s.url + '\n\n' + s.text + '\n';
  return out;
}
