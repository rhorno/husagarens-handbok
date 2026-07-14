// build/render-pages.mjs
// Renders the <main> content + metadata for each page type and wraps it via pageHtml.
import { pageHtml, sidebarHtml, breadcrumbHtml, escapeHtml } from './page-template.mjs';
import { href, absUrl, subjectPath, categoryPath } from './site-url.mjs';
import { deriveDescription } from './describe.mjs';
import { websiteJsonLd, techArticleJsonLd, breadcrumbJsonLd, collectionPageJsonLd } from './jsonld.mjs';

const SITE_NAME = 'Husägarens handbok';
const LEVEL_LABELS = { 'nybörjare': 'Nybörjare', 'mellan': 'Mellan', 'avancerad': 'Avancerad' };
const HOME_DESCRIPTION =
  'En samlad, sökbar och faktagranskad guide till att äga och sköta ett hus i Sverige — ' +
  'ekonomi, juridik, husets skal, installationer, inomhus, trädgård, teknik, säkerhet och drift.';

function levelBadge(level) {
  const label = LEVEL_LABELS[level];
  return label ? ' <span class="level-badge level-' + level + '">' + label + '</span>' : '';
}

function overviewText(amne) {
  const o = (amne.sections || []).find((s) => s.title === 'Översikt');
  return o ? o.text : '';
}

function sectionHtml(section, idx) {
  if (section.title === 'Källor') {
    // Rendered from sources so the list carries id="kalla-N" anchors for footnotes.
    return '';
  }
  return (
    '<section class="doc-section" id="sec-' + idx + '" data-sec-idx="' + idx + '">' +
      '<h2>' + escapeHtml(section.title) + levelBadge(section.level) + '</h2>' +
      '<div class="section-body">' + section.html + '</div>' +
    '</section>'
  );
}

function kallorSectionHtml(amne, idx) {
  const items = (amne.sources || []).map((s) =>
    '<li id="kalla-' + s.n + '"><a href="' + escapeHtml(s.url) + '" target="_blank" rel="noopener">' +
    escapeHtml(s.titel) + '</a></li>').join('');
  return (
    '<section class="doc-section kallor-section" id="sec-' + idx + '" data-sec-idx="' + idx + '">' +
      '<h2>Källor</h2><ol class="kallor-list">' + items + '</ol>' +
    '</section>'
  );
}

function seAvenHtml(amne) {
  const related = amne.relaterade || [];
  if (!related.length) return '';
  const chips = related.map((r) =>
    '<li><a class="chip" href="' + href(subjectPath(r.id)) + '">' + escapeHtml(r.titel) + '</a></li>').join('');
  return '<section class="doc-section se-aven-section" id="se-aven"><h2>Se även</h2><ul class="chip-list">' + chips + '</ul></section>';
}

function tocHtml(amne) {
  const items = amne.sections.map((s, i) =>
    '<li><a href="#sec-' + i + '" data-sec-idx="' + i + '">' + escapeHtml(s.title) + '</a></li>').join('');
  return '<h2 class="toc-heading">På sidan</h2><ul class="toc-list">' + items + '</ul>';
}

export function renderSubjectPage(amne, dates, ctx) {
  const description = deriveDescription(overviewText(amne));
  const katTitel = ctx.katTitelById.get(amne.kategori) || '';
  const sections = amne.sections.map((s, i) => (s.title === 'Källor' ? kallorSectionHtml(amne, i) : sectionHtml(s, i))).join('');
  const mainHtml = '<article class="subject"><h1 tabindex="-1">' + escapeHtml(amne.titel) + '</h1>' + sections + seAvenHtml(amne) + '</article>';

  const crumbs = [
    { name: 'Hem', href: href('/') },
    { name: katTitel, href: href(categoryPath(amne.kategori)) },
    { name: amne.titel, href: null },
  ];

  return pageHtml({
    title: amne.titel + ' — ' + SITE_NAME,
    description,
    canonicalPath: subjectPath(amne.id),
    ogType: 'article',
    jsonLd: [
      techArticleJsonLd(amne, { description, datePublished: dates.datePublished, dateModified: dates.dateModified }),
      breadcrumbJsonLd([
        { name: 'Hem', url: absUrl('/') },
        { name: katTitel, url: absUrl(categoryPath(amne.kategori)) },
        { name: amne.titel, url: null },
      ]),
    ],
    sidebarHtml: sidebarHtml({ kategorier: ctx.kategorier, amnenByKategori: ctx.amnenByKategori, activeSubjectId: amne.id }),
    breadcrumbHtml: breadcrumbHtml(crumbs),
    mainHtml,
    tocHtml: tocHtml(amne),
  });
}

export function renderCategoryPage(kat, subs, ctx) {
  const description = deriveDescription('Alla ämnen i kategorin ' + kat.titel + ': ' + subs.map((a) => a.titel).join(', ') + '.');
  const items = subs.map((a) =>
    '<li><a href="' + href(subjectPath(a.id)) + '">' + escapeHtml(a.titel) + '</a></li>').join('');
  const mainHtml =
    '<div class="category-view"><h1 tabindex="-1">' + escapeHtml(kat.titel) + '</h1>' +
    '<ul class="category-subject-list">' + items + '</ul></div>';

  const crumbs = [{ name: 'Hem', href: href('/') }, { name: kat.titel, href: null }];

  return pageHtml({
    title: kat.titel + ' — ' + SITE_NAME,
    description,
    canonicalPath: categoryPath(kat.id),
    ogType: 'website',
    jsonLd: [
      collectionPageJsonLd(kat, subs),
      breadcrumbJsonLd([
        { name: 'Hem', url: absUrl('/') },
        { name: kat.titel, url: null },
      ]),
    ],
    sidebarHtml: sidebarHtml({ kategorier: ctx.kategorier, amnenByKategori: ctx.amnenByKategori, activeSubjectId: null }),
    breadcrumbHtml: breadcrumbHtml(crumbs),
    mainHtml,
    tocHtml: '',
  });
}

const HASH_REDIRECT =
  '<script>(function(){var m=(location.hash||"").match(/^#\\/amne\\/([^\\/]+)(?:\\/(\\d+))?$/);' +
  'if(m){var u=window.SITE.prefix+"/amne/"+m[1]+"/"+(m[2]!==undefined?"#sec-"+m[2]:"");location.replace(u);}})();</script>';

export function renderHomePage(ctx) {
  const cards = ctx.kategorier.map((kat) => {
    const subs = ctx.amnenByKategori.get(kat.id) || [];
    const items = subs.map((a) => '<li><a href="' + href(subjectPath(a.id)) + '">' + escapeHtml(a.titel) + '</a></li>').join('');
    return '<section class="category-card"><h2><a href="' + href(categoryPath(kat.id)) + '">' + escapeHtml(kat.titel) + '</a></h2><ul>' + items + '</ul></section>';
  }).join('');

  const total = [...ctx.amnenByKategori.values()].reduce((n, a) => n + a.length, 0);
  const mainHtml =
    '<div class="start-view"><h1 tabindex="-1">' + SITE_NAME + '</h1>' +
    '<p class="lead">' + escapeHtml(HOME_DESCRIPTION) + '</p>' +
    '<p class="meta-note">' + total + ' ämnen fördelade på ' + ctx.kategorier.length + ' kategorier. ' +
    'Använd sökfältet ovan eller bläddra i kategorierna till vänster.</p>' +
    '<div class="category-cards">' + cards + '</div></div>';

  return pageHtml({
    title: SITE_NAME + ' — komplett guide för husägare i Sverige',
    description: HOME_DESCRIPTION,
    canonicalPath: '/',
    ogType: 'website',
    jsonLd: [websiteJsonLd({ description: HOME_DESCRIPTION })],
    headExtra: HASH_REDIRECT,
    sidebarHtml: sidebarHtml({ kategorier: ctx.kategorier, amnenByKategori: ctx.amnenByKategori, activeSubjectId: null }),
    breadcrumbHtml: '',
    mainHtml,
    tocHtml: '',
  });
}

export function render404(ctx) {
  const mainHtml =
    '<div class="start-view"><h1 tabindex="-1">404 — sidan hittades inte</h1>' +
    '<p class="lead">Sidan du sökte finns inte. Gå till <a href="' + href('/') + '">startsidan</a> eller använd sökfältet ovan.</p></div>';
  return pageHtml({
    title: '404 — ' + SITE_NAME,
    description: 'Sidan kunde inte hittas.',
    canonicalPath: '/404.html',
    ogType: 'website',
    jsonLd: [],
    robots: 'noindex,follow',
    sidebarHtml: sidebarHtml({ kategorier: ctx.kategorier, amnenByKategori: ctx.amnenByKategori, activeSubjectId: null }),
    breadcrumbHtml: '',
    mainHtml,
    tocHtml: '',
  });
}
