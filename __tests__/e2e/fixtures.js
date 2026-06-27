const base = require('@playwright/test');

// Extends the base test with automatic capture of CSP violations and console
// errors. Any spec can read `cspViolations` / `consoleErrors` to assert the page
// is clean. CSP violations surface both as a `securitypolicyviolation` DOM event
// and as a console error ("Refused to ... because it violates ... Content Security Policy").
const test = base.test.extend({
  cspViolations: async ({ page }, use) => {
    const violations = [];

    await page.addInitScript(() => {
      document.addEventListener('securitypolicyviolation', (e) => {
        (window.__cspViolations = window.__cspViolations || []).push({
          directive: e.violatedDirective,
          blockedURI: e.blockedURI,
        });
      });
    });

    // Only genuine CSP messages name the policy. (A bare "Refused to ..." can come
    // from unrelated checks such as X-Content-Type-Options: nosniff MIME enforcement.)
    page.on('console', (msg) => {
      const text = msg.text();
      if (/content security policy/i.test(text)) {
        violations.push(text);
      }
    });

    await use(violations);

    // Drain any violations recorded in-page (best effort; page may be closed).
    try {
      const inPage = await page.evaluate(() => window.__cspViolations || []);
      for (const v of inPage) violations.push(`${v.directive} blocked ${v.blockedURI}`);
    } catch {
      /* page already closed */
    }
  },

  consoleErrors: async ({ page }, use) => {
    const errors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', (err) => errors.push(err.message));
    await use(errors);
  },
});

const expect = base.expect;
module.exports = { test, expect };
