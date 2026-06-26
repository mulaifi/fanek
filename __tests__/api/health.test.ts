import handler from '../../pages/api/health';

jest.mock('@/lib/auth/guard', () => ({
  methodNotAllowed: (
    res: { setHeader: (k: string, v: string) => void; status: (n: number) => { json: (b: unknown) => void } },
    allowed: string[]
  ) => {
    res.setHeader('Allow', allowed.join(', '));
    res.status(405).json({ error: 'Method not allowed' });
  },
}));

function mockReqRes({ method = 'GET' } = {}) {
  const req = { method };
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    setHeader: jest.fn(),
  };
  return { req, res };
}

describe('/api/health', () => {
  test('GET returns 200 with status ok, timestamp and version', () => {
    const { req, res } = mockReqRes({ method: 'GET' });
    handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0] as { status: string; timestamp: string; version: string };
    expect(body.status).toBe('ok');
    expect(typeof body.version).toBe('string');
    expect(body.version.length).toBeGreaterThan(0);
    expect(() => new Date(body.timestamp)).not.toThrow();
    expect(Number.isNaN(new Date(body.timestamp).getTime())).toBe(false);
  });

  test('non-GET returns 405 with Allow header', () => {
    const { req, res } = mockReqRes({ method: 'POST' });
    handler(req as never, res as never);

    expect(res.setHeader).toHaveBeenCalledWith('Allow', 'GET');
    expect(res.status).toHaveBeenCalledWith(405);
  });
});
