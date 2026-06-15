/* =========================================================
   SDL Page Transition v2.0
   Square Design Lab — Squarespace Plugin
   25 GPU-accelerated transition effects + random mode
   ========================================================= */
(function () {
  'use strict';

  var C = window.SDL_PAGE_TRANSITION_CONFIG || {};

  var ALL_TYPES = [
    'fade','slideUp','slideDown','slideLeft','slideRight',
    'curtain','splitH','splitV','diagonal','circle',
    'grid','zoom','stack','blinds','flip','noise',
    'scaleFade','blur','crossZoom','wave','pixelDissolve',
    'inkSpread','paperFold','staircase','doubleWipe'
  ];

  var S = {
    type:              C.type              || 'fade',
    duration:          C.duration          || 600,
    easing:            C.easing            || 'cubic-bezier(0.65,0,0.35,1)',
    bgColor:           C.bgColor           || '#000000',
    bgColor2:          C.bgColor2          || '',
    logoUrl:           C.logoUrl           || '',
    logoSize:          C.logoSize          || 80,
    logoSizeMobile:    C.logoSizeMobile    || 60,
    texts:             C.texts             || [],
    gridCols:          C.gridCols          || 4,
    gridRows:          C.gridRows          || 4,
    gridStagger:       C.gridStagger       || 'center',
    barCount:          C.barCount          || 5,
    stagger:           C.stagger           || 60,
    exclude:           C.exclude           || '',
    fromClick:         C.fromClick !== false,
    showOnLoad:        C.showOnLoad !== false,
    loadPages:         C.loadPages         || 'all',
    frequency:         C.frequency         || 'always',
    frequencyInterval: C.frequencyInterval || 30,
    mobileType:        C.mobileType        || '',
    randomTypes:       C.randomTypes       || ALL_TYPES
  };

  var KEY  = 'sdl-pt';
  var PRE  = 'sdl-pt-';
  var root = null;
  var busy = false;
  var cx   = 50;
  var cy   = 50;
  var activeType = S.type;

  /* ─── Helpers ─── */
  function mk(tag, cls, par) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (par) par.appendChild(e);
    return e;
  }

  function sv(el, k, v) { el.style.setProperty(k, v); }

  function isMobile() { return window.innerWidth <= 768; }

  function resolveType() {
    var t = S.type;
    if (S.mobileType && isMobile()) t = S.mobileType;
    if (t === 'random') {
      var pool = S.randomTypes && S.randomTypes.length ? S.randomTypes : ALL_TYPES;
      t = pool[Math.floor(Math.random() * pool.length)];
      if (t === 'random') t = 'fade';
    }
    activeType = t;
  }

  function isLocal(href) {
    try {
      var u = new URL(href, location.origin);
      return u.origin === location.origin &&
        u.pathname !== location.pathname &&
        !u.hash &&
        !/\.(pdf|zip|png|jpe?g|gif|svg|webp|mp4|mp3|doc|xls)$/i.test(u.pathname);
    } catch (e) { return false; }
  }

  function excluded(a) {
    if (a.hasAttribute('data-no-transition')) return true;
    if (a.target === '_blank') return true;
    if (S.exclude) { try { return a.matches(S.exclude); } catch (e) {} }
    return false;
  }

  function totalDur() {
    var t = activeType;
    if (t === 'grid') {
      var mr = (S.gridRows - 1) / 2;
      var mc = (S.gridCols - 1) / 2;
      var d  = Math.sqrt(mr * mr + mc * mc);
      return S.duration + Math.round(d * S.stagger);
    }
    if (t === 'pixelDissolve') {
      return S.duration + 59 * S.stagger;
    }
    if (t === 'stack' || t === 'blinds' || t === 'staircase') {
      return S.duration + (S.barCount - 1) * S.stagger;
    }
    if (t === 'paperFold') {
      return S.duration + 3 * S.stagger;
    }
    if (t === 'doubleWipe') {
      return S.duration + S.stagger;
    }
    return S.duration;
  }

  /* ─── Grid stagger calculation ─── */
  function gridDelay(r, c, rows, cols) {
    var mode = S.gridStagger;
    if (mode === 'random') {
      return Math.round(Math.random() * (rows * cols - 1) * S.stagger);
    }
    if (mode === 'leftToRight') {
      return Math.round((r * cols + c) * S.stagger);
    }
    if (mode === 'spiral') {
      var order = spiralOrder(rows, cols);
      var idx = 0;
      for (var i = 0; i < order.length; i++) {
        if (order[i][0] === r && order[i][1] === c) { idx = i; break; }
      }
      return Math.round(idx * S.stagger);
    }
    // center (default)
    var cr = (rows - 1) / 2;
    var cc = (cols - 1) / 2;
    var dist = Math.sqrt((r - cr) * (r - cr) + (c - cc) * (c - cc));
    return Math.round(dist * S.stagger);
  }

  var _spiralCache = {};
  function spiralOrder(rows, cols) {
    var key = rows + 'x' + cols;
    if (_spiralCache[key]) return _spiralCache[key];
    var order = [];
    var top = 0, bottom = rows - 1, left = 0, right = cols - 1;
    while (top <= bottom && left <= right) {
      for (var c = left; c <= right; c++) order.push([top, c]);
      top++;
      for (var r = top; r <= bottom; r++) order.push([r, right]);
      right--;
      if (top <= bottom) {
        for (var c2 = right; c2 >= left; c2--) order.push([bottom, c2]);
        bottom--;
      }
      if (left <= right) {
        for (var r2 = bottom; r2 >= top; r2--) order.push([r2, left]);
        left++;
      }
    }
    _spiralCache[key] = order;
    return order;
  }

  /* ─── Build Content Container (logo + texts) ─── */
  function buildContent() {
    var hasLogo = !!S.logoUrl;
    var hasTexts = S.texts && S.texts.length > 0;
    if (!hasLogo && !hasTexts) return;

    var mobile = isMobile();
    var container = mk('div', PRE + 'content', root);

    // Texts above logo
    if (hasTexts) {
      for (var i = 0; i < S.texts.length; i++) {
        var t = S.texts[i];
        if (t.position === 'aboveLogo') {
          buildTextEl(t, container, mobile);
        }
      }
    }

    // Logo
    if (hasLogo) {
      var logo = mk('img', PRE + 'logo', container);
      logo.src = S.logoUrl;
      logo.alt = '';
      var size = mobile ? S.logoSizeMobile : S.logoSize;
      sv(logo, 'width', size + 'px');
    }

    // Texts below logo
    if (hasTexts) {
      for (var j = 0; j < S.texts.length; j++) {
        var t2 = S.texts[j];
        if (t2.position === 'belowLogo') {
          buildTextEl(t2, container, mobile);
        }
      }
    }
  }

  function buildTextEl(cfg, parent, mobile) {
    var el = mk('div', PRE + 'text', parent);
    el.textContent = cfg.content || '';
    var fontSize = mobile ? (cfg.sizeMobile || cfg.size || 16) : (cfg.size || 16);
    el.style.fontSize = fontSize + 'px';
    if (cfg.color) el.style.color = cfg.color;
    if (cfg.font === 'heading') {
      el.style.fontFamily = 'var(--heading-font-font-family)';
    } else {
      el.style.fontFamily = 'var(--body-font-font-family)';
    }
  }

  /* ─── Build Overlay DOM ─── */
  function build() {
    root = mk('div', PRE + 'overlay ' + PRE + activeType);
    sv(root, '--pt-dur',     S.duration + 'ms');
    sv(root, '--pt-ease',    S.easing);
    sv(root, '--pt-bg',      S.bgColor);
    sv(root, '--pt-stagger', S.stagger + 'ms');
    sv(root, '--pt-cx',      cx + '%');
    sv(root, '--pt-cy',      cy + '%');

    if (S.bgColor2) {
      sv(root, '--pt-bg2', S.bgColor2);
    }

    var fn = dom[activeType];
    if (fn) fn();

    buildContent();

    document.body.appendChild(root);
  }

  var dom = {};

  // single-panel types
  var singles = [
    'fade','slideUp','slideDown','slideLeft','slideRight',
    'curtain','diagonal','circle','zoom','flip','noise',
    'scaleFade','blur','crossZoom','wave','inkSpread'
  ];
  singles.forEach(function (t) {
    dom[t] = function () { mk('div', PRE + 'panel', root); };
  });

  dom.splitH = function () {
    mk('div', PRE + 'half ' + PRE + 'left', root);
    mk('div', PRE + 'half ' + PRE + 'right', root);
  };

  dom.splitV = function () {
    mk('div', PRE + 'half ' + PRE + 'top', root);
    mk('div', PRE + 'half ' + PRE + 'bottom', root);
  };

  dom.grid = function () {
    var g    = mk('div', PRE + 'grid', root);
    var cols = S.gridCols;
    var rows = S.gridRows;
    sv(g, '--cols', cols);
    sv(g, '--rows', rows);
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var cell = mk('div', PRE + 'cell', g);
        var d = gridDelay(r, c, rows, cols);
        sv(cell, '--d', d + 'ms');
      }
    }
  };

  dom.stack = function () {
    sv(root, '--bars', S.barCount);
    for (var i = 0; i < S.barCount; i++) {
      var b = mk('div', PRE + 'bar', root);
      sv(b, '--i', i);
      sv(b, '--d', (i * S.stagger) + 'ms');
    }
  };

  dom.blinds = function () {
    sv(root, '--bars', S.barCount);
    for (var i = 0; i < S.barCount; i++) {
      var sl = mk('div', PRE + 'slat', root);
      sv(sl, '--i', i);
      sv(sl, '--d', (i * S.stagger) + 'ms');
    }
  };

  dom.noise = function () {
    mk('div', PRE + 'panel', root);
    var ns  = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('class', PRE + 'noise-svg');
    svg.setAttribute('width', '0');
    svg.setAttribute('height', '0');
    var flt = document.createElementNS(ns, 'filter');
    flt.setAttribute('id', 'sdlPtNoise');
    var turb = document.createElementNS(ns, 'feTurbulence');
    turb.setAttribute('type', 'fractalNoise');
    turb.setAttribute('baseFrequency', '0.65');
    turb.setAttribute('numOctaves', '3');
    turb.setAttribute('stitchTiles', 'stitch');
    var mat = document.createElementNS(ns, 'feColorMatrix');
    mat.setAttribute('type', 'saturate');
    mat.setAttribute('values', '0');
    flt.appendChild(turb);
    flt.appendChild(mat);
    svg.appendChild(flt);
    root.appendChild(svg);
  };

  /* ─── New v2.0 DOM builders ─── */

  dom.pixelDissolve = function () {
    var g    = mk('div', PRE + 'grid', root);
    var cols = 10;
    var rows = 6;
    sv(g, '--cols', cols);
    sv(g, '--rows', rows);
    var total = cols * rows;
    var indices = [];
    for (var i = 0; i < total; i++) indices.push(i);
    // Fisher-Yates shuffle for random stagger
    for (var n = total - 1; n > 0; n--) {
      var j = Math.floor(Math.random() * (n + 1));
      var tmp = indices[n];
      indices[n] = indices[j];
      indices[j] = tmp;
    }
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var cell = mk('div', PRE + 'cell', g);
        var idx = r * cols + c;
        var order = indices[idx];
        sv(cell, '--d', Math.round(order * S.stagger) + 'ms');
      }
    }
  };

  dom.paperFold = function () {
    var panels = 4;
    sv(root, '--bars', panels);
    for (var i = 0; i < panels; i++) {
      var p = mk('div', PRE + 'fold', root);
      sv(p, '--i', i);
      sv(p, '--d', (i * S.stagger) + 'ms');
    }
  };

  dom.staircase = function () {
    sv(root, '--bars', S.barCount);
    for (var i = 0; i < S.barCount; i++) {
      var b = mk('div', PRE + 'bar', root);
      sv(b, '--i', i);
      sv(b, '--d', (i * S.stagger) + 'ms');
    }
  };

  dom.doubleWipe = function () {
    var layer1 = mk('div', PRE + 'panel ' + PRE + 'layer1', root);
    var layer2 = mk('div', PRE + 'panel ' + PRE + 'layer2', root);
    sv(layer2, '--d', S.stagger + 'ms');
    if (S.bgColor2) {
      layer2.style.backgroundColor = S.bgColor2;
    }
  };

  /* ─── Page-level transforms ─── */
  function pageEl() {
    return document.querySelector('#siteWrapper') || document.documentElement;
  }

  function applyPageCover() {
    var p = pageEl();
    var t = activeType;
    if (t === 'zoom') {
      p.style.transition = 'transform ' + S.duration + 'ms ' + S.easing;
      p.style.transformOrigin = 'center center';
      p.style.transform = 'scale(0.92)';
    }
    if (t === 'flip') {
      p.style.perspective = '1200px';
      p.style.transition = 'transform ' + S.duration + 'ms ' + S.easing;
      p.style.transformOrigin = 'right center';
      p.style.transform = 'rotateY(-8deg) scale(0.95)';
    }
    if (t === 'scaleFade') {
      p.style.transition = 'transform ' + S.duration + 'ms ' + S.easing +
        ', opacity ' + S.duration + 'ms ' + S.easing;
      p.style.transformOrigin = 'center center';
      p.style.transform = 'scale(0.95)';
      p.style.opacity = '0';
    }
    if (t === 'blur') {
      p.style.transition = 'filter ' + S.duration + 'ms ' + S.easing +
        ', opacity ' + S.duration + 'ms ' + S.easing;
      p.style.filter = 'blur(12px)';
      p.style.opacity = '0';
    }
    if (t === 'crossZoom') {
      p.style.transition = 'transform ' + S.duration + 'ms ' + S.easing +
        ', opacity ' + S.duration + 'ms ' + S.easing;
      p.style.transformOrigin = 'center center';
      p.style.transform = 'scale(0.85)';
      p.style.opacity = '0';
    }
  }

  function applyPageReveal() {
    var p = pageEl();
    var t = activeType;
    if (t === 'zoom') {
      p.style.transform = 'scale(1.05)';
      p.style.transition = 'none';
      void p.offsetHeight;
      p.style.transition = 'transform ' + S.duration + 'ms ' + S.easing;
      requestAnimationFrame(function () { p.style.transform = 'scale(1)'; });
      setTimeout(function () {
        p.style.transform = '';
        p.style.transition = '';
        p.style.transformOrigin = '';
      }, S.duration + 100);
    }
    if (t === 'flip') {
      p.style.perspective = '1200px';
      p.style.transform = 'rotateY(8deg) scale(0.95)';
      p.style.transformOrigin = 'left center';
      p.style.transition = 'none';
      void p.offsetHeight;
      p.style.transition = 'transform ' + S.duration + 'ms ' + S.easing;
      requestAnimationFrame(function () { p.style.transform = 'rotateY(0) scale(1)'; });
      setTimeout(function () {
        p.style.transform = '';
        p.style.transition = '';
        p.style.perspective = '';
        p.style.transformOrigin = '';
      }, S.duration + 100);
    }
    if (t === 'scaleFade') {
      p.style.transform = 'scale(0.95)';
      p.style.opacity = '0';
      p.style.transition = 'none';
      void p.offsetHeight;
      p.style.transition = 'transform ' + S.duration + 'ms ' + S.easing +
        ', opacity ' + S.duration + 'ms ' + S.easing;
      requestAnimationFrame(function () {
        p.style.transform = 'scale(1)';
        p.style.opacity = '1';
      });
      setTimeout(function () {
        p.style.transform = '';
        p.style.opacity = '';
        p.style.transition = '';
        p.style.transformOrigin = '';
      }, S.duration + 100);
    }
    if (t === 'blur') {
      p.style.filter = 'blur(12px)';
      p.style.opacity = '0';
      p.style.transition = 'none';
      void p.offsetHeight;
      p.style.transition = 'filter ' + S.duration + 'ms ' + S.easing +
        ', opacity ' + S.duration + 'ms ' + S.easing;
      requestAnimationFrame(function () {
        p.style.filter = 'blur(0px)';
        p.style.opacity = '1';
      });
      setTimeout(function () {
        p.style.filter = '';
        p.style.opacity = '';
        p.style.transition = '';
      }, S.duration + 100);
    }
    if (t === 'crossZoom') {
      p.style.transform = 'scale(1.2)';
      p.style.opacity = '0';
      p.style.transformOrigin = 'center center';
      p.style.transition = 'none';
      void p.offsetHeight;
      p.style.transition = 'transform ' + S.duration + 'ms ' + S.easing +
        ', opacity ' + S.duration + 'ms ' + S.easing;
      requestAnimationFrame(function () {
        p.style.transform = 'scale(1)';
        p.style.opacity = '1';
      });
      setTimeout(function () {
        p.style.transform = '';
        p.style.opacity = '';
        p.style.transition = '';
        p.style.transformOrigin = '';
      }, S.duration + 100);
    }
  }

  function clearPageStyles() {
    var p = pageEl();
    p.style.transform = '';
    p.style.opacity = '';
    p.style.filter = '';
    p.style.transition = '';
    p.style.perspective = '';
    p.style.transformOrigin = '';
  }

  /* ─── Frequency / Intro Logic ─── */
  function shouldShowOnLoad() {
    if (!S.showOnLoad) return false;
    if (S.loadPages === 'homepage' && location.pathname !== '/') return false;
    if (S.frequency === 'timed') {
      var lastShown = localStorage.getItem('sdl-pt-last');
      if (lastShown) {
        var elapsed = (Date.now() - parseInt(lastShown, 10)) / 60000;
        if (elapsed < S.frequencyInterval) return false;
      }
    }
    localStorage.setItem('sdl-pt-last', Date.now());
    return true;
  }

  /* ─── Cover & Reveal ─── */
  function cover(url) {
    if (busy) return;
    busy = true;

    // Re-resolve type for each navigation (random picks a new one)
    resolveType();
    rebuild();

    sv(root, '--pt-cx', cx + '%');
    sv(root, '--pt-cy', cy + '%');

    root.classList.add(PRE + 'covering');
    applyPageCover();

    var dur = totalDur();
    setTimeout(function () {
      root.classList.remove(PRE + 'covering');
      root.classList.add(PRE + 'covered');

      sessionStorage.setItem(KEY, '1');
      sessionStorage.setItem(KEY + '-cx', cx);
      sessionStorage.setItem(KEY + '-cy', cy);
      sessionStorage.setItem(KEY + '-type', activeType);
      window.location.href = url;
    }, dur + 30);
  }

  function reveal() {
    root.classList.add(PRE + 'covered');
    void root.offsetHeight;

    requestAnimationFrame(function () {
      root.classList.add(PRE + 'revealing');
      applyPageReveal();

      var dur = totalDur();
      setTimeout(function () {
        root.classList.remove(PRE + 'covered', PRE + 'revealing');
        clearPageStyles();
        busy = false;
      }, dur + 30);
    });
  }

  /* ─── Rebuild overlay (for random type changes between navigations) ─── */
  function rebuild() {
    if (root && root.parentNode) {
      root.parentNode.removeChild(root);
    }
    build();
  }

  /* ─── Click Interception ─── */
  function onClick(e) {
    if (busy) return;
    var a = e.target.closest ? e.target.closest('a[href]') : null;
    if (!a) return;
    if (!isLocal(a.href)) return;
    if (excluded(a)) return;
    if (e.ctrlKey || e.metaKey || e.shiftKey) return;

    e.preventDefault();
    e.stopPropagation();

    if (S.fromClick) {
      cx = Math.round((e.clientX / window.innerWidth) * 100);
      cy = Math.round((e.clientY / window.innerHeight) * 100);
    } else {
      cx = 50;
      cy = 50;
    }

    cover(a.href);
  }

  /* ─── Init ─── */
  function init() {
    var pending = sessionStorage.getItem(KEY);

    if (pending) {
      // Use the same type that was used for the cover animation
      var savedType = sessionStorage.getItem(KEY + '-type');
      if (savedType) {
        activeType = savedType;
        sessionStorage.removeItem(KEY + '-type');
      } else {
        resolveType();
      }
    } else {
      resolveType();
    }

    build();

    if (pending) {
      sessionStorage.removeItem(KEY);
      cx = parseFloat(sessionStorage.getItem(KEY + '-cx')) || 50;
      cy = parseFloat(sessionStorage.getItem(KEY + '-cy')) || 50;
      sessionStorage.removeItem(KEY + '-cx');
      sessionStorage.removeItem(KEY + '-cy');
      sv(root, '--pt-cx', cx + '%');
      sv(root, '--pt-cy', cy + '%');
      reveal();
    } else if (shouldShowOnLoad()) {
      root.classList.add(PRE + 'covered');
      setTimeout(function () { reveal(); }, 200);
    }

    document.addEventListener('click', onClick, true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
