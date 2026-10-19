// Localization: English (source text in the HTML), Arabic, Chinese, Russian.
// The page is translated in place — no navigation, so the visitor stays where they are.
// Dictionaries live in /assets/i18n/<code>.json and map the exact English text to its translation.
// Loaded synchronously in <head> so <html lang/dir> is set before the first paint.
(function () {
  var LANGS = [
    { code: 'en', label: 'English', dir: 'ltr' },
    { code: 'ar', label: 'العربية', dir: 'rtl' },
    { code: 'zh', label: '中文', dir: 'ltr' },
    { code: 'ru', label: 'Русский', dir: 'ltr' },
  ];
  var STORAGE_KEY = 'lang';
  var ATTRS = ['placeholder', 'aria-label', 'alt', 'title'];
  var META_SELECTOR = 'meta[name="description"], meta[property="og:title"], meta[property="og:description"], meta[name="twitter:title"], meta[name="twitter:description"]';
  var FONTS = {
    ar: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap',
    zh: 'https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700&display=swap',
  };

  var html = document.documentElement;
  var dictCache = {};
  var textOrig = new WeakMap();
  var current = 'en';
  var observer = null;

  function find(code) {
    for (var i = 0; i < LANGS.length; i++) if (LANGS[i].code === code) return LANGS[i];
    return null;
  }
  function norm(s) { return s.replace(/\s+/g, ' ').trim(); }

  function readStore() {
    try { return localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
  }
  function writeStore(value) {
    try { localStorage.setItem(STORAGE_KEY, value); } catch (e) { /* storage unavailable — language still applies for this page view */ }
  }

  // ?lang=xx is honoured once (shareable links), saved, then dropped from the URL.
  function initialLang() {
    try {
      var p = new URLSearchParams(location.search);
      var fromUrl = p.get('lang');
      if (fromUrl && find(fromUrl)) {
        writeStore(fromUrl);
        p.delete('lang');
        var q = p.toString();
        history.replaceState(null, '', location.pathname + (q ? '?' + q : '') + location.hash);
      }
    } catch (e) { /* ignore */ }
    var l = readStore();
    return find(l) ? l : 'en';
  }

  function setDocLang(code) {
    html.lang = code;
    html.dir = find(code).dir;
  }

  // Set lang/dir immediately; hide the page until the first translation pass so English never flashes.
  current = initialLang();
  setDocLang(current);
  if (current !== 'en') {
    html.setAttribute('data-i18n-pending', '');
    setTimeout(function () { html.removeAttribute('data-i18n-pending'); }, 2500);
  }

  function loadFont(code) {
    if (!FONTS[code] || document.querySelector('link[data-i18n-font="' + code + '"]')) return;
    var l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = FONTS[code];
    l.setAttribute('data-i18n-font', code);
    document.head.appendChild(l);
  }

  function loadDict(code) {
    if (code === 'en') return Promise.resolve(null);
    if (dictCache[code]) return Promise.resolve(dictCache[code]);
    return fetch('/assets/i18n/' + code + '.json')
      .then(function (r) { return r.ok ? r.json() : {}; })
      .catch(function () { return {}; })
      .then(function (d) { dictCache[code] = d; return d; });
  }

  function translateText(node, dict) {
    var orig = textOrig.has(node) ? textOrig.get(node) : node.nodeValue;
    var key = norm(orig);
    if (!key) return;
    var tr = dict ? dict[key] : null;
    if (tr) {
      if (!textOrig.has(node)) textOrig.set(node, orig);
      var next = orig.match(/^\s*/)[0] + tr + orig.match(/\s*$/)[0];
      if (node.nodeValue !== next) node.nodeValue = next;
    } else if (textOrig.has(node) && node.nodeValue !== orig) {
      node.nodeValue = orig;
    }
  }

  function translateAttrs(el, dict) {
    for (var i = 0; i < ATTRS.length; i++) {
      var a = ATTRS[i];
      var slot = 'data-i18n-orig-' + a;
      var cur = el.getAttribute(a);
      var saved = el.getAttribute(slot);
      var orig = saved !== null ? saved : cur;
      if (!orig) continue;
      var tr = dict ? dict[norm(orig)] : null;
      if (tr) {
        if (saved === null) el.setAttribute(slot, orig);
        if (cur !== tr) el.setAttribute(a, tr);
      } else if (saved !== null && cur !== orig) {
        el.setAttribute(a, orig);
      }
    }
  }

  function translateTree(root, dict) {
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
      acceptNode: function (n) {
        if (n.nodeType === 1) {
          var t = n.tagName;
          if (t === 'SCRIPT' || t === 'STYLE' || t === 'NOSCRIPT' || t === 'TEXTAREA' || n.hasAttribute('data-no-i18n')) return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    if (root.nodeType === 1) translateAttrs(root, dict);
    var n;
    while ((n = walker.nextNode())) {
      if (n.nodeType === 3) translateText(n, dict);
      else translateAttrs(n, dict);
    }
  }

  function translateHead(dict) {
    var titleNode = document.querySelector('title');
    if (titleNode && titleNode.firstChild) translateText(titleNode.firstChild, dict);
    var metas = document.querySelectorAll(META_SELECTOR);
    for (var i = 0; i < metas.length; i++) {
      var m = metas[i];
      var cur = m.getAttribute('content');
      var saved = m.getAttribute('data-i18n-orig-content');
      var orig = saved !== null ? saved : cur;
      var tr = dict && orig ? dict[norm(orig)] : null;
      if (tr) {
        if (saved === null) m.setAttribute('data-i18n-orig-content', orig);
        m.setAttribute('content', tr);
      } else if (saved !== null) {
        m.setAttribute('content', saved);
      }
    }
  }

  function syncSwipers(dir) {
    var els = document.querySelectorAll('.swiper');
    for (var i = 0; i < els.length; i++) {
      var s = els[i].swiper;
      if (s && s.changeLanguageDirection) { s.changeLanguageDirection(dir); s.update(); }
    }
  }

  function apply() {
    if (!document.body) return;
    var dict = dictCache[current] || null;
    translateHead(dict);
    translateTree(document.body, dict);
    html.removeAttribute('data-i18n-pending');
  }

  function watch() {
    if (observer || !window.MutationObserver) return;
    observer = new MutationObserver(function (muts) {
      var dict = dictCache[current];
      if (current === 'en' || !dict) return;
      for (var i = 0; i < muts.length; i++) {
        var added = muts[i].addedNodes;
        for (var j = 0; j < added.length; j++) {
          var n = added[j];
          if (n.nodeType === 3) translateText(n, dict);
          else if (n.nodeType === 1) translateTree(n, dict);
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function setLang(code) {
    var l = find(code);
    if (!l) return Promise.resolve();
    current = code;
    writeStore(code);
    setDocLang(code);
    loadFont(code);
    return loadDict(code).then(function () {
      apply();
      syncSwipers(l.dir);
      if (window.lucide) window.lucide.createIcons();
      document.dispatchEvent(new CustomEvent('languagechange', { detail: { lang: code, dir: l.dir } }));
    });
  }

  function onReady(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  window.FluentPathI18n = {
    LANGS: LANGS,
    getLang: function () { return current; },
    setLang: setLang,
  };

  loadFont(current);
  onReady(function () {
    watch();
    loadDict(current).then(function () { apply(); syncSwipers(find(current).dir); });
    // Header/footer partials arrive after DOMContentLoaded.
    document.addEventListener('includesLoaded', function () {
      loadDict(current).then(function () { apply(); syncSwipers(find(current).dir); });
    });
  });
})();
