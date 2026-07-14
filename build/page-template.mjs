// build/page-template.mjs
// Renders full HTML documents for the static site.
import { href, absUrl, PATH_PREFIX } from './site-url.mjs';

function jsonForScript(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

export function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function sidebarHtml({ kategorier, amnenByKategori, activeSubjectId }) {
  const cats = kategorier.map((kat) => {
    const subs = amnenByKategori.get(kat.id) || [];
    const items = subs.map((a) => {
      const active = a.id === activeSubjectId;
      return '<li><a href="' + href('/amne/' + a.id + '/') + '" data-subject-id="' + a.id + '"' +
        (active ? ' class="active" aria-current="page"' : '') + '>' + escapeHtml(a.titel) + '</a></li>';
    }).join('');
    return (
      '<div class="sidebar-category" data-kat="' + kat.id + '">' +
        '<button class="sidebar-cat-toggle" type="button" aria-expanded="true">' +
          '<span class="chevron" aria-hidden="true">▾</span>' +
          '<span>' + escapeHtml(kat.titel) + '</span>' +
        '</button>' +
        '<ul class="sidebar-sub-list">' + items + '</ul>' +
      '</div>'
    );
  }).join('');
  return cats;
}

export function breadcrumbHtml(items) {
  const parts = items.map((it, i) => {
    const last = i === items.length - 1;
    if (last || !it.href) return '<span aria-current="page">' + escapeHtml(it.name) + '</span>';
    return '<a href="' + it.href + '">' + escapeHtml(it.name) + '</a>';
  }).join('<span class="crumb-sep" aria-hidden="true">›</span>');
  return '<nav class="breadcrumbs" aria-label="Brödsmulor">' + parts + '</nav>';
}

const THEME_SCRIPT =
  '(function(){try{var s=localStorage.getItem("handbok-theme");' +
  'if(s==="light"||s==="dark")document.documentElement.setAttribute("data-theme",s);}catch(e){}})();';

const FAVICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='.9em' font-size='90'%3E%F0%9F%8F%A0%3C/text%3E%3C/svg%3E";

function headerHtml() {
  return (
    '<header class="site-header"><div class="header-inner">' +
      '<button id="sidebar-toggle" class="icon-btn sidebar-toggle" type="button" ' +
        'aria-label="Visa eller dölj kategorier" aria-expanded="false" aria-controls="sidebar">' +
        '<span class="hamburger" aria-hidden="true"><span></span><span></span><span></span></span>' +
      '</button>' +
      '<a href="' + href('/') + '" class="brand">Husägarens <span>handbok</span></a>' +
      '<div class="search-wrap" role="search">' +
        '<label for="search-input" class="visually-hidden">Sök i handboken</label>' +
        '<svg class="search-icon" aria-hidden="true" viewBox="0 0 20 20" width="16" height="16">' +
          '<circle cx="8.5" cy="8.5" r="6" fill="none" stroke="currentColor" stroke-width="1.6"></circle>' +
          '<line x1="13.2" y1="13.2" x2="18" y2="18" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"></line>' +
        '</svg>' +
        '<input id="search-input" type="search" autocomplete="off" spellcheck="false" ' +
          'placeholder="Sök i handboken…  ( / )" role="combobox" aria-expanded="false" ' +
          'aria-controls="search-results" aria-autocomplete="list">' +
        '<ul id="search-results" class="search-results" role="listbox" aria-label="Sökresultat" hidden></ul>' +
      '</div>' +
      '<button id="theme-toggle" class="icon-btn" type="button" aria-label="Växla mellan ljust och mörkt tema">' +
        '<span id="theme-icon" aria-hidden="true">🌙</span>' +
      '</button>' +
    '</div></header>'
  );
}

export function pageHtml(opts) {
  const {
    title, description, canonicalPath, ogType, jsonLd = [],
    headExtra = '', sidebarHtml: sidebar, breadcrumbHtml: crumbs = '', mainHtml, tocHtml = '',
  } = opts;

  const canonical = absUrl(canonicalPath);
  const ogImage = absUrl('/assets/og-default.png');
  const siteConfig = 'window.SITE=' + jsonForScript({ prefix: PATH_PREFIX, searchIndexUrl: href('/search-index.js') }) + ';';
  const ldScripts = jsonLd.map((o) => '<script type="application/ld+json">' + jsonForScript(o) + '</script>').join('\n');

  const aside = tocHtml
    ? '<aside class="toc" id="toc" aria-label="På sidan">' + tocHtml + '</aside>'
    : '<aside class="toc" id="toc" aria-label="På sidan" hidden></aside>';

  return (
    '<!DOCTYPE html>\n<html lang="sv">\n<head>\n' +
    '<meta charset="UTF-8">\n' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
    '<title>' + escapeHtml(title) + '</title>\n' +
    '<meta name="description" content="' + escapeHtml(description) + '">\n' +
    '<meta name="robots" content="index,follow">\n' +
    '<link rel="canonical" href="' + canonical + '">\n' +
    '<meta property="og:type" content="' + ogType + '">\n' +
    '<meta property="og:title" content="' + escapeHtml(title) + '">\n' +
    '<meta property="og:description" content="' + escapeHtml(description) + '">\n' +
    '<meta property="og:url" content="' + canonical + '">\n' +
    '<meta property="og:site_name" content="Husägarens handbok">\n' +
    '<meta property="og:locale" content="sv_SE">\n' +
    '<meta property="og:image" content="' + ogImage + '">\n' +
    '<meta name="twitter:card" content="summary_large_image">\n' +
    '<meta name="twitter:title" content="' + escapeHtml(title) + '">\n' +
    '<meta name="twitter:description" content="' + escapeHtml(description) + '">\n' +
    '<meta name="twitter:image" content="' + ogImage + '">\n' +
    '<link rel="icon" href="' + FAVICON + '">\n' +
    '<script>' + THEME_SCRIPT + '</script>\n' +
    '<script>' + siteConfig + '</script>\n' +
    (headExtra ? headExtra + '\n' : '') +
    '<link rel="stylesheet" href="' + href('/styles.css') + '">\n' +
    ldScripts + '\n' +
    '</head>\n<body>\n' +
    '<a class="skip-link" href="#content">Hoppa till innehållet</a>\n' +
    headerHtml() + '\n' +
    '<div id="backdrop" class="backdrop" hidden></div>\n' +
    '<div class="app-layout" id="app-layout">\n' +
    '<nav class="sidebar" id="sidebar" aria-label="Kategorier">' + sidebar + '</nav>\n' +
    '<main class="content" id="content" tabindex="-1">' + crumbs + mainHtml + '</main>\n' +
    aside + '\n' +
    '</div>\n' +
    '<script src="' + href('/search.js') + '"></script>\n' +
    '<script src="' + href('/app.js') + '"></script>\n' +
    '</body>\n</html>\n'
  );
}
