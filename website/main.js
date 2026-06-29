/* Fanek landing page — theme toggle, logo swap, copy-to-clipboard */
(function () {
  'use strict';

  var root = document.documentElement;
  var toggle = document.getElementById('theme-toggle');

  // Theme-aware logo variants. Both ship in /assets.
  var LOGO = {
    dark: 'assets/Fanek_logo_light.svg', // light-filled mark reads on dark bg
    light: 'assets/Fanek_logo_dark.svg', // darker mark reads on light bg
  };

  function applyLogo(theme) {
    var src = LOGO[theme] || LOGO.dark;
    document.querySelectorAll('.brand-logo, .hero-logo').forEach(function (img) {
      img.setAttribute('src', src);
    });
  }

  function syncToggle(theme) {
    if (toggle) {
      toggle.setAttribute('aria-pressed', theme === 'light' ? 'true' : 'false');
    }
  }

  function setTheme(theme) {
    root.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('fanek-theme', theme);
    } catch (e) {}
    applyLogo(theme);
    syncToggle(theme);
  }

  // Initial sync (inline head script already set data-theme to avoid flash)
  var current = root.getAttribute('data-theme') || 'dark';
  applyLogo(current);
  syncToggle(current);

  if (toggle) {
    toggle.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      setTheme(next);
    });
  }

  // Copy-to-clipboard for the quick-start block
  document.querySelectorAll('.copy-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var text = btn.getAttribute('data-copy') || '';
      var done = function () {
        var original = btn.textContent;
        btn.textContent = 'Copied!';
        btn.classList.add('copied');
        setTimeout(function () {
          btn.textContent = original;
          btn.classList.remove('copied');
        }, 1800);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done).catch(function () {});
      } else {
        var ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        try {
          document.execCommand('copy');
          done();
        } catch (e) {}
        document.body.removeChild(ta);
      }
    });
  });
})();
