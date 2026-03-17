import { hashPassword, verifyPassword, checkStrength } from '@/lib/password';
describe('password', () => {
  test('hashes and verifies a password', async () => {
    const hash = await hashPassword('MyP@ssw0rd!');
    expect(hash).not.toBe('MyP@ssw0rd!');
    expect(await verifyPassword('MyP@ssw0rd!', hash)).toBe(true);
    expect(await verifyPassword('wrong', hash)).toBe(false);
  });
  test('checkStrength rejects weak passwords', () => {
    expect(checkStrength('short')).toEqual(expect.objectContaining({ valid: false }));
    expect(checkStrength('alllowercase1!')).toEqual(expect.objectContaining({ valid: false }));
    expect(checkStrength('ALLUPPERCASE1!')).toEqual(expect.objectContaining({ valid: false }));
  });
  test('checkStrength accepts valid passwords', () => {
    expect(checkStrength('MyStr0ng!Pass')).toEqual(expect.objectContaining({ valid: true }));
  });
  test('checkStrength scores short passwords as fair, not strong', () => {
    const result = checkStrength('Garoh-011');
    expect(result.valid).toBe(true); // passes all char checks
    expect(result.strength).not.toBe('strong'); // but scored as fair due to length
    expect(result.score).toBeLessThan(50);
  });
  test('checkStrength scores long passwords as strong', () => {
    const result = checkStrength('MyV3ry$ecure!Passw0rd');
    expect(result.strength).toBe('strong');
    expect(result.score).toBeGreaterThanOrEqual(75);
  });
});
