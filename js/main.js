/**
 * Syndicate Systems — Main JavaScript
 * IntersectionObserver reveals, header scroll state, reduced motion
 */

(function () {
  'use strict';

  var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function initReveals() {
    if (prefersReducedMotion) {
      document.querySelectorAll('.reveal').forEach(function (el) {
        el.classList.add('is-visible');
      });
      return;
    }

    var reveals = document.querySelectorAll('.reveal');
    if (!reveals.length) return;

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
          }
        });
      },
      {
        threshold: 0.12,
        rootMargin: '0px 0px -40px 0px'
      }
    );

    reveals.forEach(function (el) {
      observer.observe(el);
    });
  }

  function initHeaderScroll() {
    var header = document.getElementById('header');
    var outcomesSection = document.getElementById('outcomes');
    if (!header) return;

    var scrollThreshold = 60;

    function updateHeader() {
      if (window.scrollY > scrollThreshold) {
        header.classList.add('is-scrolled');
      } else {
        header.classList.remove('is-scrolled');
      }

      if (outcomesSection) {
        var rect = outcomesSection.getBoundingClientRect();
        var inPhase3 = rect.top < window.innerHeight * 0.5;
        document.body.classList.toggle('in-phase-3', inPhase3);
      }
    }

    window.addEventListener('scroll', function () {
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(updateHeader);
      } else {
        updateHeader();
      }
    }, { passive: true });

    updateHeader();
  }

  function initSmoothAnchor() {
    document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
      var href = anchor.getAttribute('href');
      if (href === '#') return;

      var target = document.querySelector(href);
      if (!target) return;

      anchor.addEventListener('click', function (e) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth' });
      });
    });
  }

  function init() {
    initReveals();
    initHeaderScroll();
    initSmoothAnchor();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
