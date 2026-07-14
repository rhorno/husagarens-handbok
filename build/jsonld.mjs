// build/jsonld.mjs
// Schema.org JSON-LD builders. Return plain objects; serialized by the page template.
import { absUrl, subjectPath, categoryPath } from './site-url.mjs';

const PUBLISHER = { '@type': 'Organization', name: 'Husägarens handbok', url: absUrl('/') };

export function websiteJsonLd({ description }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Husägarens handbok',
    url: absUrl('/'),
    inLanguage: 'sv-SE',
    description,
    publisher: PUBLISHER,
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: absUrl('/') + '?q={search_term_string}' },
      'query-input': 'required name=search_term_string',
    },
  };
}

export function techArticleJsonLd(amne, { description, datePublished, dateModified }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: amne.titel,
    description,
    inLanguage: 'sv-SE',
    datePublished,
    dateModified,
    mainEntityOfPage: { '@type': 'WebPage', '@id': absUrl(subjectPath(amne.id)) },
    author: PUBLISHER,
    publisher: PUBLISHER,
    citation: (amne.sources || []).map((s) => ({ '@type': 'CreativeWork', name: s.titel, url: s.url })),
  };
}

export function breadcrumbJsonLd(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => {
      const el = { '@type': 'ListItem', position: i + 1, name: it.name };
      if (it.url) el.item = it.url;
      return el;
    }),
  };
}

export function collectionPageJsonLd(kat, subs) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${kat.titel} — Husägarens handbok`,
    url: absUrl(categoryPath(kat.id)),
    inLanguage: 'sv-SE',
    hasPart: subs.map((a) => ({ '@type': 'TechArticle', headline: a.titel, url: absUrl(subjectPath(a.id)) })),
  };
}
