import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

function deriveKey(secret: string): Buffer {
  return createHash('sha256').update(secret).digest();
}

export function encrypt(plaintext: string, secret: string): string {
  const key: Buffer = deriveKey(secret);
  const iv: Buffer = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted: Buffer = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag: Buffer = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

export function decrypt(ciphertext: string, secret: string): string {
  const key: Buffer = deriveKey(secret);
  const buf: Buffer = Buffer.from(ciphertext, 'base64');
  const iv: Buffer = buf.subarray(0, IV_LENGTH);
  const tag: Buffer = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const encrypted: Buffer = buf.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted) + decipher.final('utf8');
}
