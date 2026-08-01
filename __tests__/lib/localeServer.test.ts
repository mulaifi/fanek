jest.mock('@/lib/prisma', () => ({ __esModule: true, default: {} }));
jest.mock('@/lib/settings', () => ({ getSettings: jest.fn() }));
jest.mock('next-auth/jwt', () => ({ getToken: jest.fn() }));

type LocaleServer = typeof import('@/lib/localeServer');

// TRUST_PROXY is read once at module load, matching the pattern in
// pages/api/auth/[...nextauth].ts:14, so each case loads the module fresh.
// NEXTAUTH_URL is read per call, so the environment has to stay in place for the
// duration of the test rather than only for the load.
const savedEnv = { ...process.env };
afterEach(() => {
  process.env = { ...savedEnv };
});

function loadWith(env: Record<string, string | undefined>): LocaleServer {
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  let mod!: LocaleServer;
  jest.isolateModules(() => {
    mod = require('@/lib/localeServer') as LocaleServer;
  });
  return mod;
}

function mockReq({
  cookie,
  headers = {},
  encrypted = false,
}: { cookie?: string; headers?: Record<string, string | string[]>; encrypted?: boolean } = {}) {
  return {
    headers: { ...(cookie ? { cookie } : {}), ...headers },
    socket: { encrypted },
  } as never;
}

function mockRes({ headersSent = false, existing }: { headersSent?: boolean; existing?: string | string[] } = {}) {
  const store: Record<string, string | string[]> = {};
  if (existing !== undefined) store['Set-Cookie'] = existing;
  return {
    headersSent,
    getHeader: (k: string) => store[k],
    setHeader: (k: string, v: string | string[]) => {
      store[k] = v;
    },
    written: () => store['Set-Cookie'],
  };
}

function cookiesFrom(res: ReturnType<typeof mockRes>): string[] {
  const v = res.written();
  return v === undefined ? [] : Array.isArray(v) ? v : [String(v)];
}

describe('isSecureRequest', () => {
  test('ignores a spoofed X-Forwarded-Proto when TRUST_PROXY is unset', () => {
    const { isSecureRequest } = loadWith({ TRUST_PROXY: undefined, NEXTAUTH_URL: 'http://app.example.com' });
    expect(isSecureRequest(mockReq({ headers: { 'x-forwarded-proto': 'https' } }))).toBe(false);
  });

  test('honours X-Forwarded-Proto when TRUST_PROXY is set', () => {
    const { isSecureRequest } = loadWith({ TRUST_PROXY: 'true', NEXTAUTH_URL: 'http://app.example.com' });
    expect(isSecureRequest(mockReq({ headers: { 'x-forwarded-proto': 'https' } }))).toBe(true);
  });

  test('reads only the first hop of a chained X-Forwarded-Proto', () => {
    const { isSecureRequest } = loadWith({ TRUST_PROXY: '1', NEXTAUTH_URL: 'http://app.example.com' });
    expect(isSecureRequest(mockReq({ headers: { 'x-forwarded-proto': 'https, http' } }))).toBe(true);
    expect(isSecureRequest(mockReq({ headers: { 'x-forwarded-proto': 'http, https' } }))).toBe(false);
  });

  test('trusts an https NEXTAUTH_URL without any header', () => {
    const { isSecureRequest } = loadWith({ TRUST_PROXY: undefined, NEXTAUTH_URL: 'https://app.example.com' });
    expect(isSecureRequest(mockReq())).toBe(true);
  });

  test('trusts a TLS socket when Node terminates HTTPS itself', () => {
    const { isSecureRequest } = loadWith({ TRUST_PROXY: undefined, NEXTAUTH_URL: 'http://app.example.com' });
    expect(isSecureRequest(mockReq({ encrypted: true }))).toBe(true);
  });

  test('plain HTTP with no signals is not secure', () => {
    const { isSecureRequest } = loadWith({ TRUST_PROXY: undefined, NEXTAUTH_URL: 'http://app.example.com' });
    expect(isSecureRequest(mockReq())).toBe(false);
  });
});

describe('publishLocaleCookie', () => {
  test('writes the locale with the attributes the client writer uses', () => {
    const { publishLocaleCookie } = loadWith({ TRUST_PROXY: undefined, NEXTAUTH_URL: 'http://app.example.com' });
    const res = mockRes();
    publishLocaleCookie(mockReq(), res as never, 'ar');

    const [cookie] = cookiesFrom(res);
    expect(cookie).toContain('NEXT_LOCALE=ar');
    expect(cookie).toContain('Path=/');
    expect(cookie).toContain(`Max-Age=${60 * 60 * 24 * 365}`);
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).not.toContain('Secure');
  });

  test('a spoofed header cannot make the cookie Secure on a plain-HTTP deployment', () => {
    // A Secure cookie here would never be sent back, so the language would
    // silently stop persisting for that visitor.
    const { publishLocaleCookie } = loadWith({ TRUST_PROXY: undefined, NEXTAUTH_URL: 'http://app.example.com' });
    const res = mockRes();
    publishLocaleCookie(mockReq({ headers: { 'x-forwarded-proto': 'https' } }), res as never, 'ar');
    expect(cookiesFrom(res)[0]).not.toContain('Secure');
  });

  test('marks the cookie Secure on an https deployment', () => {
    const { publishLocaleCookie } = loadWith({ TRUST_PROXY: undefined, NEXTAUTH_URL: 'https://app.example.com' });
    const res = mockRes();
    publishLocaleCookie(mockReq(), res as never, 'ar');
    expect(cookiesFrom(res)[0]).toContain('Secure');
  });

  test('appends rather than replacing cookies another writer already set', () => {
    // NextAuth sets its session cookies on this same response.
    const { publishLocaleCookie } = loadWith({ TRUST_PROXY: undefined, NEXTAUTH_URL: 'http://app.example.com' });
    const res = mockRes({ existing: ['next-auth.session-token=abc; Path=/'] });
    publishLocaleCookie(mockReq(), res as never, 'ar');

    const all = cookiesFrom(res);
    expect(all).toHaveLength(2);
    expect(all[0]).toContain('next-auth.session-token=abc');
    expect(all[1]).toContain('NEXT_LOCALE=ar');
  });

  test('appends when the existing header is a bare string', () => {
    const { publishLocaleCookie } = loadWith({ TRUST_PROXY: undefined, NEXTAUTH_URL: 'http://app.example.com' });
    const res = mockRes({ existing: 'other=1; Path=/' });
    publishLocaleCookie(mockReq(), res as never, 'ar');

    const all = cookiesFrom(res);
    expect(all).toHaveLength(2);
    expect(all[0]).toContain('other=1');
  });

  test('writes nothing when the request already carries the same locale', () => {
    const { publishLocaleCookie } = loadWith({ TRUST_PROXY: undefined, NEXTAUTH_URL: 'http://app.example.com' });
    const res = mockRes();
    publishLocaleCookie(mockReq({ cookie: 'NEXT_LOCALE=ar' }), res as never, 'ar');
    expect(cookiesFrom(res)).toHaveLength(0);
  });

  test('overwrites when the request carries a different locale', () => {
    const { publishLocaleCookie } = loadWith({ TRUST_PROXY: undefined, NEXTAUTH_URL: 'http://app.example.com' });
    const res = mockRes();
    publishLocaleCookie(mockReq({ cookie: 'NEXT_LOCALE=en' }), res as never, 'ar');
    expect(cookiesFrom(res)[0]).toContain('NEXT_LOCALE=ar');
  });

  test('writes nothing once the headers have gone out', () => {
    const { publishLocaleCookie } = loadWith({ TRUST_PROXY: undefined, NEXTAUTH_URL: 'http://app.example.com' });
    const res = mockRes({ headersSent: true });
    publishLocaleCookie(mockReq(), res as never, 'ar');
    expect(cookiesFrom(res)).toHaveLength(0);
  });

  test('writes nothing without a request or a response, as during a static prerender', () => {
    const { publishLocaleCookie } = loadWith({ TRUST_PROXY: undefined, NEXTAUTH_URL: 'http://app.example.com' });
    const res = mockRes();
    publishLocaleCookie(undefined, res as never, 'ar');
    expect(cookiesFrom(res)).toHaveLength(0);
    expect(() => publishLocaleCookie(mockReq(), undefined, 'ar')).not.toThrow();
  });
});
