/* =========================================================
   SDL Page Transition v1.0
   Square Design Lab — Squarespace Plugin
   16 GPU-accelerated transition effects
   ========================================================= */
(function () {
  'use strict';

  var C = window.SDL_PAGE_TRANSITION_CONFIG || {};

  var S = {
    type:      C.type      || 'fade',
    duration:  C.duration  || 600,
    easing:    C.easing    || 'cubic-bezier(0.65,0,0.35,1)',
    bgColor:   C.bgColor   || '#000000',
    logoUrl:   C.logoUrl   || '',
    logoSize:  C.logoSize  || 80,
    gridCols:  C.gridCols  || 4,
    gridRows:  C.gridRows  || 4,
    barCount:  C.barCount  || 5,
    stagger:   C.stagger   || 60,
    exclude:   C.exclude   || '',
    fromClick: C.fromClick !== false
  };

  var KEY  = 'sdl-pt';
  var PRE  = 'sdl-pt-';
  var root = null;
  var busy = false;
  var cx   = 50;
  var cy   = 50;

  /* ─── Helpers ─── */
  function mk(tag, cls, par) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (par) par.appendChild(e);
    return e;
  }

  function sv(el, k, v) { el.style.setProperty(k, v); }

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
    if (S.type === 'grid') {
      var mr = (S.gridRows - 1) / 2;
      var mc = (S.gridCols - 1) / 2;
      var d  = Math.sqrt(mr * mr + mc * mc);
      return S.duration + Math.round(d * S.stagger);
    }
    if (S.type === 'stack' || S.type === 'blinds') {
      return S.duration + (S.barCount - 1) * S.stagger;
    }
    return S.duration;
  }

  /* ─── Build Overlay DOM ─── */
  function build() {
    root = mk('div', PRE + 'overlay ' + PRE + S.type);
    sv(root, '--pt-dur',     S.duration + 'ms');
    sv(root, '--pt-ease',    S.easing);
    sv(root, '--pt-bg',      S.bgColor);
    sv(root, '--pt-stagger', S.stagger + 'ms');
    sv(root, '--pt-cx',      cx + '%');
    sv(root, '--pt-cy',      cy + '%');

    var fn = dom[S.type];
    if (fn) fn();

    if (S.logoUrl) {
      var logo = mk('img', PRE + 'logo', root);
      logo.src = S.logoUrl;
      logo.alt = '';
      sv(logo, 'width', S.logoSize + 'px');
    }

    document.body.appendChild(root);
  }

  var dom = {};

  // single-panel types
  var singles = ['fade','slideUp','slideDown','slideLeft','slideRight',
                 'curtain','diagonal','circle','zoom','flip','noise'];
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
    var cr = (rows - 1) / 2;
    var cc = (cols - 1) / 2;
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var cell = mk('div', PRE + 'cell', g);
        var dist = Math.sqrt((r - cr) * (r - cr) + (c - cc) * (c - cc));
        sv(cell, '--d', Math.round(dist * S.stagger) + 'ms');
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

  /* ─── Zoom / Flip: page-level transforms ─── */
  function pageEl() {
    return document.querySelector('#siteWrapper') || document.documentElement;
  }

  function applyPageCover() {
    var p = pageEl();
    if (S.type === 'zoom') {
      p.style.transition = 'transform ' + S.duration + 'ms ' + S.easing;
      p.style.transformOrigin = 'center center';
      p.style.transform = 'scale(0.92)';
    }
    if (S.type === 'flip') {
      p.style.perspective = '1200px';
      p.style.transition = 'transform ' + S.duration + 'ms ' + S.easing;
      p.style.transformOrigin = 'right center';
      p.style.transform = 'rotateY(-8deg) scale(0.95)';
    }
  }

  function applyPageReveal() {
    var p = pageEl();
    if (S.type === 'zoom') {
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
    if (S.type === 'flip') {
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
  }

  /* ─── Cover & Reveal ─── */
  function cover(url) {
    if (busy) return;
    busy = true;

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
        busy = false;
      }, dur + 30);
    });
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
    build();

    var pending = sessionStorage.getItem(KEY);
    if (pending) {
      sessionStorage.removeItem(KEY);
      cx = parseFloat(sessionStorage.getItem(KEY + '-cx')) || 50;
      cy = parseFloat(sessionStorage.getItem(KEY + '-cy')) || 50;
      sessionStorage.removeItem(KEY + '-cx');
      sessionStorage.removeItem(KEY + '-cy');
      sv(root, '--pt-cx', cx + '%');
      sv(root, '--pt-cy', cy + '%');
      reveal();
    }

    document.addEventListener('click', onClick, true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
