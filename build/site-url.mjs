// build/site-url.mjs
// Single source of truth for every URL the site emits. Switching to a custom
// domain is a one-line change to BASE_URL.

export const BASE_URL = 'https://rhorno.github.io/husagarens-handbok';

export function createUrls(baseUrl) {
  const trimmed = baseUrl.replace(/\/+$/, '');
  const PATH_PREFIX = new URL(trimmed).pathname.replace(/\/+$/, ''); // '' for root domains
  const HOME_PATH = '/';
  const href = (path) => PATH_PREFIX + path;      // root-relative, path-prefixed
  const absUrl = (path) => trimmed + path;         // absolute
  const subjectPath = (id) => `/amne/${id}/`;
  const categoryPath = (id) => `/kategori/${id}/`;
  return { PATH_PREFIX, HOME_PATH, href, absUrl, subjectPath, categoryPath };
}

const _default = createUrls(BASE_URL);
export const PATH_PREFIX = _default.PATH_PREFIX;
export const HOME_PATH = _default.HOME_PATH;
export const href = _default.href;
export const absUrl = _default.absUrl;
export const subjectPath = _default.subjectPath;
export const categoryPath = _default.categoryPath;
