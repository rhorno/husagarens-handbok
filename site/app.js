// Classic script (no import/export) — the whole app UI. Works over file:// with
// no server, no build step and no dependencies beyond data.js and search.js.
(function () {
  'use strict';

  var LEVEL_LABELS = {
    'nybörjare': 'Nybörjare',
    'mellan': 'Mellan',
    'avancerad': 'Avancerad',
  };

  var THEME_KEY = 'handbok-theme';
  var HEADER_H_FALLBACK = 64;

  // --- DOM refs -----------------------------------------------------------
  var sidebarEl = document.getElementById('sidebar');
  var contentEl = document.getElementById('content');
  var tocEl = document.getElementById('toc');
  var searchInput = document.getElementById('search-input');
  var searchResultsEl = document.getElementById('search-results');
  var themeToggleBtn = document.getElementById('theme-toggle');
  var themeIconEl = document.getElementById('theme-icon');
  var sidebarToggleBtn = document.getElementById('sidebar-toggle');
  var backdropEl = document.getElementById('backdrop');

  // --- state ----------------------------------------------------------------
  var amnenById = new Map();
  var amnenByKategori = new Map();
  var searchIndex = null;
  var searchResults = [];
  var searchActiveIdx = -1;
  var spyObserver = null;

  // --- helpers ----------------------------------------------------------------
  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function isTypingTarget(el) {
    if (!el) return false;
    var tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
  }

  function headerHeightPx() {
    var raw = getComputedStyle(document.documentElement).getPropertyValue('--header-h');
    var n = parseInt(raw, 10);
    return isNaN(n) ? HEADER_H_FALLBACK : n;
  }

  function flashHighlight(el) {
    if (!el) return;
    el.classList.remove('flash-highlight');
    void el.offsetWidth; // restart animation if it was already applied
    el.classList.add('flash-highlight');
    clearTimeout(el.__flashTimer);
    el.__flashTimer = setTimeout(function () {
      el.classList.remove('flash-highlight');
    }, 1800);
  }

  function levelBadgeHtml(level) {
    var label = LEVEL_LABELS[level];
    if (!label) return '';
    return ' <span class="level-badge level-' + level + '">' + label + '</span>';
  }

  // --- routing ----------------------------------------------------------------
  // Only `#/amne/<id>` and `#/amne/<id>/<sectionIdx>` are real routes (so
  // back/forward/reload restore the view). Footnote-to-källa jumps deliberately
  // do NOT rewrite location.hash — doing so would erase the `/amne/...` route
  // and leave a reload with nothing to render (see handleKallaClick below).
  function route() {
    var hash = window.location.hash || '';

    var amneMatch = hash.match(/^#\/amne\/([^/]+)(?:\/(\d+))?$/);
    if (amneMatch) {
      var sectionIdx = amneMatch[2] !== undefined ? Number(amneMatch[2]) : null;
      renderSubject(amneMatch[1], sectionIdx);
      return;
    }

    renderStartView();
  }

  // --- start view ----------------------------------------------------------------
  function categoryCardHtml(kat) {
    var subs = amnenByKategori.get(kat.id) || [];
    var items = subs.map(function (a) {
      return '<li><a href="#/amne/' + a.id + '">' + escapeHtml(a.titel) + '</a></li>';
    }).join('');
    return (
      '<section class="category-card">' +
        '<h2>' + escapeHtml(kat.titel) + '</h2>' +
        '<ul>' + items + '</ul>' +
      '</section>'
    );
  }

  function renderStartView() {
    document.title = 'Husägarens handbok';
    tocEl.hidden = true;
    tocEl.innerHTML = '';
    disconnectSpy();

    var cards = HANDBOK.kategorier.map(categoryCardHtml).join('');
    contentEl.innerHTML =
      '<div class="start-view">' +
        '<h1 tabindex="-1">Husägarens handbok</h1>' +
        '<p class="lead">En samlad, sökbar guide till att äga och sköta ett hus i Sverige — ' +
        'ekonomi &amp; juridik, husets skal, installationer, inomhus, utomhus &amp; trädgård, ' +
        'teknik &amp; säkerhet samt drift &amp; rutiner.</p>' +
        '<p class="meta-note">' + HANDBOK.amnen.length + ' ämnen fördelade på ' +
        HANDBOK.kategorier.length + ' kategorier. Använd sökfältet ovan eller bläddra i ' +
        'kategorierna till vänster.</p>' +
        '<div class="category-cards">' + cards + '</div>' +
      '</div>';

    setActiveSidebarLink(null);
    window.scrollTo({ top: 0 });
    focusMainHeading();
  }

  // --- subject view ----------------------------------------------------------------
  function sectionHtml(section, idx) {
    return (
      '<section class="doc-section" id="sec-' + idx + '" data-sec-idx="' + idx + '">' +
        '<h2>' + escapeHtml(section.title) + levelBadgeHtml(section.level) + '</h2>' +
        '<div class="section-body">' + section.html + '</div>' +
      '</section>'
    );
  }

  function kallorSectionHtml(amne, idx) {
    var sources = amne.sources || [];
    var items = sources.map(function (s) {
      return (
        '<li id="kalla-' + s.n + '">' +
          '<a href="' + escapeHtml(s.url) + '" target="_blank" rel="noopener">' + escapeHtml(s.titel) + '</a>' +
        '</li>'
      );
    }).join('');
    return (
      '<section class="doc-section kallor-section" id="sec-' + idx + '" data-sec-idx="' + idx + '">' +
        '<h2>Källor</h2>' +
        '<ol class="kallor-list">' + items + '</ol>' +
      '</section>'
    );
  }

  function seAvenHtml(amne) {
    var related = amne.relaterade || [];
    if (!related.length) return '';
    var chips = related.map(function (r) {
      return '<li><a class="chip" href="#/amne/' + r.id + '">' + escapeHtml(r.titel) + '</a></li>';
    }).join('');
    return (
      '<section class="doc-section se-aven-section" id="se-aven">' +
        '<h2>Se även</h2>' +
        '<ul class="chip-list">' + chips + '</ul>' +
      '</section>'
    );
  }

  function renderSubject(id, sectionIdx) {
    var amne = amnenById.get(id);
    if (!amne) {
      renderStartView();
      return;
    }

    document.title = amne.titel + ' — Husägarens handbok';

    var sectionsHtml = amne.sections.map(function (s, i) {
      return s.title === 'Källor' ? kallorSectionHtml(amne, i) : sectionHtml(s, i);
    }).join('');

    contentEl.innerHTML =
      '<article class="subject">' +
        '<h1 tabindex="-1">' + escapeHtml(amne.titel) + '</h1>' +
        sectionsHtml +
        seAvenHtml(amne) +
      '</article>';

    var tocItems = amne.sections.map(function (s, i) {
      return '<li><a href="#/amne/' + id + '/' + i + '" data-sec-idx="' + i + '">' + escapeHtml(s.title) + '</a></li>';
    }).join('');
    tocEl.hidden = false;
    tocEl.innerHTML =
      '<h2 class="toc-heading">På sidan</h2>' +
      '<ul class="toc-list">' + tocItems + '</ul>';

    setActiveSidebarLink(id);
    setupScrollSpy();

    var target = sectionIdx != null ? document.getElementById('sec-' + sectionIdx) : null;
    if (target) {
      requestAnimationFrame(function () {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        flashHighlight(target.querySelector('h2') || target);
      });
    } else {
      window.scrollTo({ top: 0 });
      focusMainHeading();
    }
  }

  function focusMainHeading() {
    var h = contentEl.querySelector('h1');
    if (h && typeof h.focus === 'function') h.focus({ preventScroll: true });
  }

  // --- scroll spy ----------------------------------------------------------------
  function disconnectSpy() {
    if (spyObserver) {
      spyObserver.disconnect();
      spyObserver = null;
    }
  }

  function setupScrollSpy() {
    disconnectSpy();
    var sectionEls = Array.prototype.slice.call(contentEl.querySelectorAll('[data-sec-idx]'));
    var tocLinks = Array.prototype.slice.call(tocEl.querySelectorAll('[data-sec-idx]'));
    if (!sectionEls.length) return;

    var linkByIdx = new Map(tocLinks.map(function (a) { return [a.dataset.secIdx, a]; }));
    var visible = new Set();
    var topOffset = headerHeightPx() + 24;

    spyObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var idx = entry.target.dataset.secIdx;
        if (entry.isIntersecting) visible.add(idx);
        else visible.delete(idx);
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

  // --- sidebar ----------------------------------------------------------------
  function renderSidebar() {
    sidebarEl.innerHTML = HANDBOK.kategorier.map(function (kat) {
      var subs = amnenByKategori.get(kat.id) || [];
      var items = subs.map(function (a) {
        return '<li><a href="#/amne/' + a.id + '" data-subject-id="' + a.id + '">' + escapeHtml(a.titel) + '</a></li>';
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
  }

  function setActiveSidebarLink(id) {
    var links = sidebarEl.querySelectorAll('a[data-subject-id]');
    links.forEach(function (a) {
      var active = a.dataset.subjectId === id;
      a.classList.toggle('active', active);
      if (active) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
  }

  sidebarEl.addEventListener('click', function (e) {
    var toggle = e.target.closest('.sidebar-cat-toggle');
    if (toggle) {
      var cat = toggle.closest('.sidebar-category');
      var collapsed = cat.classList.toggle('collapsed');
      toggle.setAttribute('aria-expanded', String(!collapsed));
      return;
    }
    var link = e.target.closest('a[data-subject-id]');
    if (link) {
      closeMobileSidebar();
    }
  });

  // --- mobile sidebar toggle ----------------------------------------------------------------
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
    if (document.body.classList.contains('sidebar-open')) closeMobileSidebar();
    else openMobileSidebar();
  });
  backdropEl.addEventListener('click', closeMobileSidebar);

  // --- footnote / källa anchors (delegated; contentEl node persists across renders) ---
  // Scrolls to and flash-highlights the target source, WITHOUT rewriting
  // location.hash (that would clobber the `#/amne/<id>/<n>` route and break
  // reload — see the routing comment above).
  contentEl.addEventListener('click', function (e) {
    var a = e.target.closest('a[href^="#kalla-"]');
    if (!a) return;
    e.preventDefault();
    var id = a.getAttribute('href').slice(1);
    var target = document.getElementById(id);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      flashHighlight(target);
    }
  });

  // --- theme ----------------------------------------------------------------
  function getSystemTheme() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  function currentTheme() {
    return document.documentElement.getAttribute('data-theme') || getSystemTheme();
  }
  function updateThemeIcon(theme) {
    themeIconEl.textContent = theme === 'dark' ? '☀️' : '🌙';
  }
  themeToggleBtn.addEventListener('click', function () {
    var next = currentTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
    updateThemeIcon(next);
  });
  updateThemeIcon(currentTheme());

  // --- search ----------------------------------------------------------------
  function renderSearchResults() {
    if (!searchResults.length) {
      searchResultsEl.innerHTML = '<li class="search-empty" role="presentation">Inga träffar</li>';
      searchResultsEl.hidden = false;
      searchInput.setAttribute('aria-expanded', 'true');
      return;
    }
    searchResultsEl.innerHTML = searchResults.map(function (r, i) {
      var badge = levelBadgeHtml(r.level);
      var snippet = r.snippet || { before: '', match: '', after: '' };
      var hasSnippet = Boolean(snippet.before || snippet.match || snippet.after);
      var snippetHtml = hasSnippet
        ? escapeHtml(snippet.before) + '<mark>' + escapeHtml(snippet.match) + '</mark>' + escapeHtml(snippet.after)
        : '<span class="search-result-snippet-fallback">Träff via nyckelord</span>';
      var activeClass = i === searchActiveIdx ? ' is-active' : '';
      return (
        '<li role="option" id="search-opt-' + i + '" class="search-result' + activeClass + '" ' +
            'aria-selected="' + (i === searchActiveIdx) + '" data-idx="' + i + '">' +
          '<div class="search-result-head">' +
            '<span class="search-result-title">' + escapeHtml(r.subjectTitle) + '</span>' +
            '<span class="search-result-section">' + escapeHtml(r.sectionTitle) + '</span>' +
            badge +
          '</div>' +
          '<p class="search-result-snippet">' + snippetHtml + '</p>' +
        '</li>'
      );
    }).join('');
    searchResultsEl.hidden = false;
    searchInput.setAttribute('aria-expanded', 'true');
    if (searchActiveIdx >= 0) searchInput.setAttribute('aria-activedescendant', 'search-opt-' + searchActiveIdx);
    else searchInput.removeAttribute('aria-activedescendant');
  }

  function closeSearchResults() {
    searchResultsEl.hidden = true;
    searchResultsEl.innerHTML = '';
    searchResults = [];
    searchActiveIdx = -1;
    searchInput.setAttribute('aria-expanded', 'false');
    searchInput.removeAttribute('aria-activedescendant');
  }

  function openSearchResult(i) {
    var r = searchResults[i];
    if (!r) return;
    closeSearchResults();
    searchInput.value = '';
    window.location.hash = '#/amne/' + r.subjectId + '/' + r.sectionIdx;
  }

  function scrollActiveIntoView() {
    var el = searchResultsEl.querySelector('.search-result.is-active');
    if (el) el.scrollIntoView({ block: 'nearest' });
  }

  searchInput.addEventListener('input', function () {
    var q = searchInput.value;
    if (!q.trim()) {
      closeSearchResults();
      return;
    }
    searchResults = SearchLib.search(searchIndex, q, 20);
    searchActiveIdx = -1;
    renderSearchResults();
  });

  searchInput.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown') {
      if (!searchResults.length) return;
      e.preventDefault();
      searchActiveIdx = Math.min(searchActiveIdx + 1, searchResults.length - 1);
      renderSearchResults();
      scrollActiveIntoView();
    } else if (e.key === 'ArrowUp') {
      if (!searchResults.length) return;
      e.preventDefault();
      searchActiveIdx = Math.max(searchActiveIdx - 1, 0);
      renderSearchResults();
      scrollActiveIntoView();
    } else if (e.key === 'Enter') {
      if (searchResults.length) {
        e.preventDefault();
        openSearchResult(searchActiveIdx >= 0 ? searchActiveIdx : 0);
      }
    } else if (e.key === 'Escape') {
      if (searchInput.value || searchResults.length) {
        e.preventDefault();
        searchInput.value = '';
        closeSearchResults();
      }
    }
  });

  searchResultsEl.addEventListener('click', function (e) {
    var li = e.target.closest('.search-result');
    if (!li) return;
    openSearchResult(Number(li.dataset.idx));
  });

  searchInput.addEventListener('blur', function () {
    // Delay so a click on a result is registered before the panel closes.
    setTimeout(closeSearchResults, 150);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === '/' && !isTypingTarget(document.activeElement)) {
      e.preventDefault();
      searchInput.focus();
      searchInput.select();
    }
  });

  // --- init ----------------------------------------------------------------
  function init() {
    amnenById = new Map(HANDBOK.amnen.map(function (a) { return [a.id, a]; }));
    HANDBOK.kategorier.forEach(function (k) { amnenByKategori.set(k.id, []); });
    HANDBOK.amnen.forEach(function (a) {
      if (!amnenByKategori.has(a.kategori)) amnenByKategori.set(a.kategori, []);
      amnenByKategori.get(a.kategori).push(a);
    });

    searchIndex = SearchLib.buildIndex(HANDBOK.amnen);

    renderSidebar();
    window.addEventListener('hashchange', route);
    route();
  }

  init();
})();
