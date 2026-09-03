/* lmiller.io
   Three jobs: theme toggle, mobile menu, scroll-driven reveal + nav state.
   No scroll listeners; IntersectionObserver only. */

(function () {
  'use strict';

  var root = document.documentElement;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* --- Theme ----------------------------------------------------- */

  var toggle = document.getElementById('theme-toggle');

  function activeTheme() {
    if (root.dataset.theme) return root.dataset.theme;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function labelToggle() {
    if (!toggle) return;
    var next = activeTheme() === 'dark' ? 'light' : 'dark';
    toggle.setAttribute('aria-label', 'Switch to ' + next + ' theme');
  }

  if (toggle) {
    labelToggle();
    toggle.addEventListener('click', function () {
      var next = activeTheme() === 'dark' ? 'light' : 'dark';
      root.dataset.theme = next;
      try { localStorage.setItem('theme', next); } catch (e) {}
      labelToggle();
    });
  }

  // Follow the OS while the visitor has not made an explicit choice.
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () {
    if (!root.dataset.theme) labelToggle();
  });

  /* --- Mobile menu ----------------------------------------------- */

  var burger = document.getElementById('burger');
  var menu = document.getElementById('site-nav');

  function setMenu(open) {
    menu.classList.toggle('is-open', open);
    burger.classList.toggle('is-open', open);
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  }

  if (burger && menu) {
    burger.addEventListener('click', function () {
      setMenu(!menu.classList.contains('is-open'));
    });
    menu.addEventListener('click', function (e) {
      if (e.target.closest('a')) setMenu(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menu.classList.contains('is-open')) {
        setMenu(false);
        burger.focus();
      }
    });
  }

  /* --- Reveal on entry -------------------------------------------- */
  /* Communicates reading order: each block resolves as it arrives. */

  if (!reduced.matches && 'IntersectionObserver' in window) {
    var groups = [].slice.call(document.querySelectorAll(
      '.sec__h2, .role, .work, .stack__row, .about__prose, .facts, ' +
      '.contact__lead, .contact__mail, .contact__list, .hero__text, .hero__portrait'
    ));

    // Only hide what starts below the fold. Anything already on screen renders
    // as-is, so a missed observer can never leave the first screen blank.
    var pending = groups.filter(function (el) {
      return el.getBoundingClientRect().top > window.innerHeight * 0.9;
    });
    pending.forEach(function (el) { el.classList.add('reveal'); });

    var show = function (el) {
      if (!el.classList.contains('reveal') || el.classList.contains('is-in')) return;
      var peers = Array.prototype.filter.call(el.parentElement.children, function (c) {
        return c.classList.contains('reveal') && !c.classList.contains('is-in');
      });
      el.style.setProperty('--d', Math.min(Math.max(peers.indexOf(el), 0), 4) * 70 + 'ms');
      el.classList.add('is-in');
    };

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        show(entry.target);
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });

    pending.forEach(function (el) { io.observe(el); });

    // Escape hatch for tools that render the whole page without scrolling
    // (print, screenshot capture, "save as image"). Real visitors never hit it.
    window.revealAll = function () {
      pending.forEach(function (el) {
        el.style.setProperty('--d', '0ms');
        el.classList.add('is-in');
        io.unobserve(el);
      });
    };
    window.addEventListener('beforeprint', window.revealAll);
  }

  /* --- Nav: mark the section being read --------------------------- */

  var links = Array.prototype.slice.call(document.querySelectorAll('.nav__list a[href^="#"]'));
  // Sorted by document position, not link order, so reordering the nav cannot
  // break which section counts as "topmost" below.
  var sections = links
    .map(function (a) { return document.querySelector(a.getAttribute('href')); })
    .filter(Boolean)
    .sort(function (a, b) {
      return (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) ? -1 : 1;
    });

  if (sections.length && 'IntersectionObserver' in window) {
    var visible = new Set();

    var navIo = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) visible.add(entry.target.id);
        else visible.delete(entry.target.id);
      });

      // Highest section still in the band wins, so the state never flickers.
      // At the end of the document the page cannot scroll any further, so the
      // final section never reaches the band on its own; claim it explicitly.
      var atBottom = window.innerHeight + window.scrollY >=
                     document.documentElement.scrollHeight - 4;
      var current = atBottom
        ? sections[sections.length - 1]
        : sections.filter(function (s) { return visible.has(s.id); })[0];
      links.forEach(function (a) {
        a.classList.toggle('is-active', !!current && a.getAttribute('href') === '#' + current.id);
      });
    }, { rootMargin: '-68px 0px -55% 0px' });

    sections.forEach(function (s) { navIo.observe(s); });
  }
})();
