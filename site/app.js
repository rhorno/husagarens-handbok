// Classic script (no import/export) — client behaviour for the pre-rendered site.
// Content, sidebar and TOC are already in the HTML; this handles theme, sidebar
// interaction, scroll-spy, footnote jumps and (lazily-loaded) search.
(function () {
  'use strict';

  var LEVEL_LABELS = { 'nybörjare': 'Nybörjare', 'mellan': 'Mellan', 'avancerad': 'Avancerad' };
  var THEME_KEY = 'handbok-theme';
  var HEADER_H_FALLBACK = 64;

  var sidebarEl = document.getElementById('sidebar');
  var contentEl = document.getElementById('content');
  var tocEl = document.getElementById('toc');
  var searchInput = document.getElementById('search-input');
  var searchResultsEl = document.getElementById('search-results');
  var themeToggleBtn = document.getElementById('theme-toggle');
  var themeIconEl = document.getElementById('theme-icon');
  var sidebarToggleBtn = document.getElementById('sidebar-toggle');
  var backdropEl = document.getElementById('backdrop');

  var SITE = window.SITE || { prefix: '', searchIndexUrl: 'search-index.js' };

  // --- helpers ---
  function escapeHtml(v) {
    return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function isTypingTarget(el) {
    if (!el) return false;
    var t = el.tagName;
    return t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT' || el.isContentEditable;
  }
  function headerHeightPx() {
    var raw = getComputedStyle(document.documentElement).getPropertyValue('--header-h');
    var n = parseInt(raw, 10);
    return isNaN(n) ? HEADER_H_FALLBACK : n;
  }
  function flashHighlight(el) {
    if (!el) return;
    el.classList.remove('flash-highlight');
    void el.offsetWidth;
    el.classList.add('flash-highlight');
    clearTimeout(el.__flashTimer);
    el.__flashTimer = setTimeout(function () { el.classList.remove('flash-highlight'); }, 1800);
  }
  function levelBadgeHtml(level) {
    var label = LEVEL_LABELS[level];
    return label ? ' <span class="level-badge level-' + level + '">' + label + '</span>' : '';
  }

  // --- scroll spy (operates on pre-rendered sections + toc links) ---
  var spyObserver = null;
  function setupScrollSpy() {
    var sectionEls = Array.prototype.slice.call(contentEl.querySelectorAll('[data-sec-idx]'));
    var tocLinks = Array.prototype.slice.call(tocEl.querySelectorAll('[data-sec-idx]'));
    if (!sectionEls.length || !tocLinks.length) return;
    var linkByIdx = new Map(tocLinks.map(function (a) { return [a.dataset.secIdx, a]; }));
    var visible = new Set();
    var topOffset = headerHeightPx() + 24;
    spyObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var idx = e.target.dataset.secIdx;
        if (e.isIntersecting) visible.add(idx); else visible.delete(idx);
      });
      tocLinks.forEach(function (a) { a.classList.remove('active'); });
      if (visible.size) {
        var activeIdx = Array.from(visible).sort(function (a, b) { return Number(a) - Number(b); })[0];
        var link = linkByIdx.get(activeIdx);
        if (link) link.classList.add('active');
      }
    }, { root: null, rootMargin: '-' + topOffset + 'px 0px -60% 0px', threshold: 0 });
    sectionEls.forEach(function (el) { spyObserver.observe(el); });
  }

  // --- sidebar interactions (links are pre-rendered) ---
  sidebarEl.addEventListener('click', function (e) {
    var toggle = e.target.closest('.sidebar-cat-toggle');
    if (toggle) {
      var cat = toggle.closest('.sidebar-category');
      var collapsed = cat.classList.toggle('collapsed');
      toggle.setAttribute('aria-expanded', String(!collapsed));
      return;
    }
    if (e.target.closest('a[data-subject-id]')) closeMobileSidebar();
  });

  function openMobileSidebar() {
    document.body.classList.add('sidebar-open');
    sidebarToggleBtn.setAttribute('aria-expanded', 'true');
    backdropEl.hidden = false;
  }
  function closeMobileSidebar() {
    document.body.classList.remove('sidebar-open');
    sidebarToggleBtn.setAttribute('aria-expanded', 'false');
    backdropEl.hidden = true;
  }
  sidebarToggleBtn.addEventListener('click', function () {
    if (document.body.classList.contains('sidebar-open')) closeMobileSidebar(); else openMobileSidebar();
  });
  backdropEl.addEventListener('click', closeMobileSidebar);

  // --- footnote / källa jumps (no hash rewrite) ---
  contentEl.addEventListener('click', function (e) {
    var a = e.target.closest('a[href^="#kalla-"]');
    if (!a) return;
    e.preventDefault();
    var target = document.getElementById(a.getAttribute('href').slice(1));
    if (target) { target.scrollIntoView({ behavior: 'smooth', block: 'center' }); flashHighlight(target); }
  });

  // --- theme ---
  function getSystemTheme() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  function currentTheme() { return document.documentElement.getAttribute('data-theme') || getSystemTheme(); }
  function updateThemeIcon(theme) { themeIconEl.textContent = theme === 'dark' ? '☀️' : '🌙'; }
  themeToggleBtn.addEventListener('click', function () {
    var next = currentTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
    updateThemeIcon(next);
  });
  updateThemeIcon(currentTheme());

  // --- lazy search index ---
  var searchIndex = null, searchLoading = false, searchLoadCbs = [];
  function ensureSearchIndex(cb) {
    if (searchIndex) { cb(); return; }
    searchLoadCbs.push(cb);
    if (searchLoading) return;
    searchLoading = true;
    var s = document.createElement('script');
    s.src = SITE.searchIndexUrl;
    s.onload = function () {
      searchIndex = SearchLib.buildIndex(globalThis.HANDBOK_SEARCH || []);
      var cbs = searchLoadCbs; searchLoadCbs = [];
      cbs.forEach(function (f) { f(); });
    };
    s.onerror = function () { searchLoading = false; };
    document.head.appendChild(s);
  }

  // --- search UI ---
  var searchResults = [], searchActiveIdx = -1;
  function renderSearchResults() {
    if (!searchResults.length) {
      searchResultsEl.innerHTML = '<li class="search-empty" role="presentation">Inga träffar</li>';
      searchResultsEl.hidden = false;
      searchInput.setAttribute('aria-expanded', 'true');
      return;
    }
    searchResultsEl.innerHTML = searchResults.map(function (r, i) {
      var badge = levelBadgeHtml(r.level);
      var sn = r.snippet || { before: '', match: '', after: '' };
      var has = Boolean(sn.before || sn.match || sn.after);
      var snHtml = has
        ? escapeHtml(sn.before) + '<mark>' + escapeHtml(sn.match) + '</mark>' + escapeHtml(sn.after)
        : '<span class="search-result-snippet-fallback">Träff via nyckelord</span>';
      var active = i === searchActiveIdx ? ' is-active' : '';
      return '<li role="option" id="search-opt-' + i + '" class="search-result' + active + '" ' +
        'aria-selected="' + (i === searchActiveIdx) + '" data-idx="' + i + '">' +
        '<div class="search-result-head">' +
          '<span class="search-result-title">' + escapeHtml(r.subjectTitle) + '</span>' +
          '<span class="search-result-section">' + escapeHtml(r.sectionTitle) + '</span>' + badge +
        '</div><p class="search-result-snippet">' + snHtml + '</p></li>';
    }).join('');
    searchResultsEl.hidden = false;
    searchInput.setAttribute('aria-expanded', 'true');
    if (searchActiveIdx >= 0) searchInput.setAttribute('aria-activedescendant', 'search-opt-' + searchActiveIdx);
    else searchInput.removeAttribute('aria-activedescendant');
  }
  function closeSearchResults() {
    searchResultsEl.hidden = true; searchResultsEl.innerHTML = '';
    searchResults = []; searchActiveIdx = -1;
    searchInput.setAttribute('aria-expanded', 'false');
    searchInput.removeAttribute('aria-activedescendant');
  }
  function runSearch(q) {
    ensureSearchIndex(function () {
      searchResults = SearchLib.search(searchIndex, q, 20);
      searchActiveIdx = -1;
      renderSearchResults();
    });
  }
  function openSearchResult(i) {
    var r = searchResults[i];
    if (!r) return;
    window.location.href = SITE.prefix + '/amne/' + r.subjectId + '/#sec-' + r.sectionIdx;
  }
  function scrollActiveIntoView() {
    var el = searchResultsEl.querySelector('.search-result.is-active');
    if (el) el.scrollIntoView({ block: 'nearest' });
  }

  searchInput.addEventListener('focus', function () { ensureSearchIndex(function () {}); });
  searchInput.addEventListener('input', function () {
    var q = searchInput.value;
    if (!q.trim()) { closeSearchResults(); return; }
    runSearch(q);
  });
  searchInput.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown') {
      if (!searchResults.length) return;
      e.preventDefault();
      searchActiveIdx = Math.min(searchActiveIdx + 1, searchResults.length - 1);
      renderSearchResults(); scrollActiveIntoView();
    } else if (e.key === 'ArrowUp') {
      if (!searchResults.length) return;
      e.preventDefault();
      searchActiveIdx = Math.max(searchActiveIdx - 1, 0);
      renderSearchResults(); scrollActiveIntoView();
    } else if (e.key === 'Enter') {
      if (searchResults.length) { e.preventDefault(); openSearchResult(searchActiveIdx >= 0 ? searchActiveIdx : 0); }
    } else if (e.key === 'Escape') {
      if (searchInput.value || searchResults.length) { e.preventDefault(); searchInput.value = ''; closeSearchResults(); }
    }
  });
  searchResultsEl.addEventListener('click', function (e) {
    var li = e.target.closest('.search-result');
    if (li) openSearchResult(Number(li.dataset.idx));
  });
  searchInput.addEventListener('blur', function () { setTimeout(closeSearchResults, 150); });
  document.addEventListener('keydown', function (e) {
    if (e.key === '/' && !isTypingTarget(document.activeElement)) { e.preventDefault(); searchInput.focus(); searchInput.select(); }
  });

  // --- ?q= deep link (makes the WebSite SearchAction real) ---
  function handleQueryParam() {
    var m = window.location.search.match(/[?&]q=([^&]*)/);
    if (!m) return;
    var q = decodeURIComponent(m[1].replace(/\+/g, ' '));
    if (!q.trim()) return;
    searchInput.value = q;
    searchInput.focus();
    runSearch(q);
  }

  // --- init ---
  setupScrollSpy();
  handleQueryParam();
})();
