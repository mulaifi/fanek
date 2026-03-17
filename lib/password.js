import bcrypt from 'bcryptjs';
const SALT_ROUNDS = 12;
const MIN_LENGTH = 8;
export async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}
export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}
export function checkStrength(password) {
  const errors = [];
  if (password.length < MIN_LENGTH) errors.push(`Must be at least ${MIN_LENGTH} characters`);
  if (!/[a-z]/.test(password)) errors.push('Must contain a lowercase letter');
  if (!/[A-Z]/.test(password)) errors.push('Must contain an uppercase letter');
  if (!/[0-9]/.test(password)) errors.push('Must contain a number');
  if (!/[^a-zA-Z0-9]/.test(password)) errors.push('Must contain a special character');

  // Score-based strength (0-100)
  let score = 0;
  // Length scoring: 8=20, 12=40, 16=60 (capped at 60)
  score += Math.min(60, Math.max(0, (password.length - 4) * 5));
  // Character variety bonus
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const hasSpecial = /[^a-zA-Z0-9]/.test(password);
  const varieties = [hasLower, hasUpper, hasDigit, hasSpecial].filter(Boolean).length;
  score += varieties * 10;
  // Penalty for short passwords even if they pass all checks
  if (password.length < 12) score = Math.min(score, 50);
  if (password.length < 10) score = Math.min(score, 30);
  // Clamp
  score = Math.min(100, Math.max(0, score));

  // Strength label
  let strength;
  if (score < 25) strength = 'weak';
  else if (score < 50) strength = 'fair';
  else if (score < 75) strength = 'good';
  else strength = 'strong';

  return { valid: errors.length === 0, errors, score, strength };
}
export function generateTempPassword() {
  const upper = 'ABCDEFGHJKMNPQRSTUVWXYZ';
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  const special = '!@#$%';
  const all = upper + lower + digits + special;
  let password = [
    upper[Math.floor(Math.random() * upper.length)],
    lower[Math.floor(Math.random() * lower.length)],
    digits[Math.floor(Math.random() * digits.length)],
    special[Math.floor(Math.random() * special.length)],
  ];
  for (let i = 4; i < 16; i++) {
    password.push(all[Math.floor(Math.random() * all.length)]);
  }
  for (let i = password.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [password[i], password[j]] = [password[j], password[i]];
  }
  return password.join('');
}
