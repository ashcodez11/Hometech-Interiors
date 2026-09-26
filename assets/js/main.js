/* ==========================================================================
   Hometech Interiors — site behaviour
   Vanilla JS, no dependencies. Everything here is progressive enhancement:
   with JS disabled the site still navigates, reads and submits.
   ========================================================================== */
(function () {
  'use strict';

  var doc = document;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function $(selector, scope) {
    return (scope || doc).querySelector(selector);
  }

  function $$(selector, scope) {
    return Array.prototype.slice.call((scope || doc).querySelectorAll(selector));
  }

  /* ------------------------------------------------------------- header */

  var header = $('.site-header');

  if (header) {
    var setStuck = function (stuck) {
      header.classList.toggle('is-stuck', stuck);
    };

    // Scroll events alone are not enough: browsers restore a scroll position on
    // reload without firing one, which used to leave the header transparent on
    // top of light content. A 32px sentinel at the top of the document reports
    // the real state the moment it is observed.
    var STUCK_AT = 32;
    var sentinel = doc.createElement('span');
    sentinel.setAttribute('aria-hidden', 'true');
    sentinel.style.cssText =
      'position:absolute;top:0;left:0;width:1px;height:' +
      STUCK_AT +
      'px;pointer-events:none;visibility:hidden';
    doc.body.insertBefore(sentinel, doc.body.firstChild);

    if ('IntersectionObserver' in window) {
      // Held in a variable on purpose: an unreferenced observer can be garbage
      // collected and silently stop reporting.
      var headerObserver = new IntersectionObserver(function (entries) {
        setStuck(!entries[0].isIntersecting);
      });
      headerObserver.observe(sentinel);
    }

    var onScroll = function () {
      setStuck(window.scrollY > STUCK_AT);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('load', onScroll);
    window.addEventListener('pageshow', onScroll);
  }

  /* ------------------------------------------------------- mobile drawer */

  var drawer = $('#site-drawer');
  var burger = $('.burger');
  var lastFocused = null;

  function drawerOpen() {
    if (!drawer || !burger) return;
    lastFocused = doc.activeElement;
    drawer.classList.add('is-open');
    drawer.removeAttribute('hidden');
    drawer.setAttribute('aria-hidden', 'false');
    burger.setAttribute('aria-expanded', 'true');
    doc.body.classList.add('is-locked');
    var first = drawer.querySelector('a[href], button:not([disabled])');
    if (first) first.focus();
    doc.addEventListener('keydown', drawerKeys);
  }

  function drawerClose() {
    if (!drawer || !burger) return;
    drawer.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
    burger.setAttribute('aria-expanded', 'false');
    doc.body.classList.remove('is-locked');
    doc.removeEventListener('keydown', drawerKeys);
    if (lastFocused && lastFocused.focus) lastFocused.focus();
  }

  function drawerKeys(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      drawerClose();
      return;
    }
    if (event.key !== 'Tab' || !drawer) return;
    var focusable = $$(
      'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
      drawer
    ).filter(function (el) {
      return el.offsetParent !== null;
    });
    if (!focusable.length) return;
    var first = focusable[0];
    var last = focusable[focusable.length - 1];
    if (event.shiftKey && doc.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && doc.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  if (burger && drawer) {
    burger.addEventListener('click', function () {
      if (burger.getAttribute('aria-expanded') === 'true') drawerClose();
      else drawerOpen();
    });

    $$('[data-drawer-close]', drawer).forEach(function (el) {
      el.addEventListener('click', drawerClose);
    });

    // Close the drawer if the viewport grows into desktop layout.
    window.addEventListener('resize', function () {
      if (window.innerWidth >= 1000 && drawer.classList.contains('is-open')) drawerClose();
    });
  }

  /* -------------------------------------------------------- scroll reveal */

  var revealTargets = $$('[data-reveal]');

  if (revealTargets.length) {
    if (reduceMotion || !('IntersectionObserver' in window)) {
      revealTargets.forEach(function (el) {
        el.classList.add('is-visible');
      });
    } else {
      var observer = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            var el = entry.target;
            var delay = Number(el.getAttribute('data-reveal-delay') || 0);
            window.setTimeout(function () {
              el.classList.add('is-visible');
            }, delay);
            observer.unobserve(el);
          });
        },
        { rootMargin: '0px 0px -8% 0px', threshold: 0.12 }
      );

      revealTargets.forEach(function (el) {
        el.classList.add('reveal');
        observer.observe(el);
      });
    }
  }

  /* ------------------------------------------------------- gallery filter */

  var filterBar = $('[data-filters]');

  if (filterBar) {
    var chips = $$('.filter', filterBar);
    var tiles = $$('[data-category]');
    var empty = $('[data-gallery-empty]');

    filterBar.addEventListener('click', function (event) {
      var chip = event.target.closest ? event.target.closest('.filter') : null;
      if (!chip) return;
      var value = chip.getAttribute('data-filter');

      chips.forEach(function (c) {
        c.setAttribute('aria-pressed', String(c === chip));
      });

      var shown = 0;
      tiles.forEach(function (tile) {
        var match = value === 'all' || tile.getAttribute('data-category') === value;
        tile.hidden = !match;
        if (match) shown += 1;
      });

      if (empty) empty.hidden = shown > 0;
    });
  }

  /* ------------------------------------------------------------- lightbox */

  var lightbox = $('#lightbox');

  if (lightbox) {
    var lbImage = $('[data-lightbox-image]', lightbox);
    var lbTitle = $('[data-lightbox-title]', lightbox);
    var lbCaption = $('[data-lightbox-caption]', lightbox);
    var lbCount = $('[data-lightbox-count]', lightbox);
    var triggers = $$('[data-lightbox-trigger]');
    var current = 0;
    var lightboxFocused = null;

    function paint(index) {
      if (!triggers.length) return;
      current = (index + triggers.length) % triggers.length;
      var trigger = triggers[current];
      var img = $('img', trigger);
      lbImage.src = trigger.getAttribute('data-full') || (img ? img.currentSrc || img.src : '');
      lbImage.alt = img ? img.alt : '';
      lbTitle.textContent = trigger.getAttribute('data-title') || '';
      lbCaption.textContent = trigger.getAttribute('data-caption') || '';
      lbCount.textContent = current + 1 + ' / ' + triggers.length;
    }

    function openLightbox(index) {
      lightboxFocused = doc.activeElement;
      paint(index);
      lightbox.classList.add('is-open');
      lightbox.removeAttribute('hidden');
      lightbox.setAttribute('aria-hidden', 'false');
      doc.body.classList.add('is-locked');
      $('[data-lightbox-close]', lightbox).focus();
      doc.addEventListener('keydown', lightboxKeys);
    }

    function closeLightbox() {
      lightbox.classList.remove('is-open');
      lightbox.setAttribute('aria-hidden', 'true');
      doc.body.classList.remove('is-locked');
      doc.removeEventListener('keydown', lightboxKeys);
      lbImage.removeAttribute('src');
      if (lightboxFocused && lightboxFocused.focus) lightboxFocused.focus();
    }

    function lightboxKeys(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeLightbox();
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        paint(current + 1);
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        paint(current - 1);
      }
    }

    triggers.forEach(function (trigger, index) {
      trigger.addEventListener('click', function () {
        openLightbox(index);
      });
    });

    $$('[data-lightbox-close]', lightbox).forEach(function (el) {
      el.addEventListener('click', closeLightbox);
    });
    $$('[data-lightbox-prev]', lightbox).forEach(function (el) {
      el.addEventListener('click', function () {
        paint(current - 1);
      });
    });
    $$('[data-lightbox-next]', lightbox).forEach(function (el) {
      el.addEventListener('click', function () {
        paint(current + 1);
      });
    });
    lightbox.addEventListener('click', function (event) {
      if (event.target === lightbox) closeLightbox();
    });
  }

  /* ---------------------------------------------------------- enquiry form */

  var form = $('#enquiry-form');

  if (form) {
    var status = $('[data-form-status]', form);
    var rules = [
      { name: 'name', test: function (v) { return v.trim().length >= 2; }, message: 'Please enter your name.' },
      {
        name: 'phone',
        test: function (v) { return /^[+]?[\d][\d\s\-()]{8,17}$/.test(v.trim()); },
        message: 'Please enter a valid phone number so we can call you back.'
      },
      {
        name: 'email',
        optional: true,
        test: function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()); },
        message: 'Please check the email address format.'
      },
      { name: 'service', test: function (v) { return v.trim().length > 0; }, message: 'Please choose a service.' }
    ];

    function errorEl(field) {
      return form.querySelector('[data-error-for="' + field.name + '"]');
    }

    function validateField(field, rule) {
      var input = form.elements[field];
      var value = input ? input.value : '';
      var ok = rule.optional && !value.trim() ? true : rule.test(value);
      var target = errorEl(rule);
      if (input) input.setAttribute('aria-invalid', ok ? 'false' : 'true');
      if (target) target.textContent = ok ? '' : rule.message;
      return ok;
    }

    function validateForm() {
      var firstInvalid = null;
      rules.forEach(function (rule) {
        if (!validateField(rule.name, rule) && !firstInvalid) {
          firstInvalid = form.elements[rule.name];
        }
      });
      return firstInvalid;
    }

    rules.forEach(function (rule) {
      var input = form.elements[rule.name];
      if (!input) return;
      input.addEventListener('blur', function () {
        if (input.value.trim()) validateField(rule.name, rule);
      });
      input.addEventListener('input', function () {
        if (input.getAttribute('aria-invalid') === 'true') validateField(rule.name, rule);
      });
    });

    function summary() {
      var data = new FormData(form);
      var lines = ['New enquiry from the website', ''];
      lines.push('Name: ' + (data.get('name') || '-'));
      lines.push('Phone: ' + (data.get('phone') || '-'));
      if (data.get('email')) lines.push('Email: ' + data.get('email'));
      lines.push('Service interested in: ' + (data.get('service') || '-'));
      if (data.get('message')) lines.push('', 'Message: ' + data.get('message'));
      return lines.join('\n');
    }

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var invalid = validateForm();
      if (invalid) {
        invalid.focus();
        if (status) {
          status.hidden = false;
          status.textContent = 'Please complete the highlighted fields and try again.';
        }
        return;
      }

      var endpoint = form.getAttribute('data-endpoint');
      var base = (form.getAttribute('data-thanks') || 'thank-you.html').split('#')[0];

      // Production path: POST the enquiry to a form backend (see README).
      if (endpoint) {
        var button = $('[type="submit"]', form);
        if (button) {
          button.disabled = true;
          button.textContent = 'Sending…';
        }
        fetch(endpoint, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } })
          .then(function (response) {
            if (!response.ok) throw new Error('Request failed');
            window.location.href = base + '#enquiry-sent';
          })
          .catch(function () {
            if (button) {
              button.disabled = false;
              button.textContent = 'Send Enquiry';
            }
            if (status) {
              status.hidden = false;
              status.textContent =
                'We could not send that just now. Please call or WhatsApp us on 08460229951 and we will help right away.';
            }
          });
        return;
      }

      // Demo path: hand the completed enquiry straight to WhatsApp, and offer a
      // copyable summary in case the visitor prefers to call instead.
      var number = form.getAttribute('data-whatsapp') || '';
      var text = summary();
      if (status) {
        status.hidden = false;
        status.innerHTML =
          '<strong>Your enquiry is ready to send.</strong><br>' +
          'Tap “Continue in WhatsApp” to send it to Hometech Interiors, or call ' +
          '<a href="tel:+918460229951">08460229951</a> directly. ' +
          'This demo stores nothing on a server.';
      }
      if (number) {
        window.open('https://wa.me/' + number + '?text=' + encodeURIComponent(text), '_blank', 'noopener');
      }
    });
  }

  /* ------------------------------------------------------- current year tag */

  $$('[data-year]').forEach(function (el) {
    el.textContent = String(new Date().getFullYear());
  });
})();
