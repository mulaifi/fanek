import { encrypt, decrypt } from '@/lib/encryption';
describe('encryption', () => {
  const key = 'a'.repeat(64);
  test('encrypts and decrypts a string', () => {
    const plaintext = 'my-secret-value';
    const encrypted = encrypt(plaintext, key);
    expect(encrypted).not.toBe(plaintext);
    expect(decrypt(encrypted, key)).toBe(plaintext);
  });
  test('produces different ciphertext each time (random IV)', () => {
    const plaintext = 'same-input';
    const a = encrypt(plaintext, key);
    const b = encrypt(plaintext, key);
    expect(a).not.toBe(b);
  });
  test('fails to decrypt with wrong key', () => {
    const encrypted = encrypt('secret', key);
    const wrongKey = 'b'.repeat(64);
    expect(() => decrypt(encrypted, wrongKey)).toThrow();
  });
});
