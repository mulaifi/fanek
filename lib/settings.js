import prisma from '@/lib/prisma';
let cache = null;
let cacheTime = 0;
const CACHE_TTL = 30000;
export async function getSettings() {
  const now = Date.now();
  if (cache && now - cacheTime < CACHE_TTL) return cache;
  const settings = await prisma.settings.findUnique({ where: { id: 'default' } });
  if (settings) {
    cache = settings;
    cacheTime = now;
  }
  return settings;
}
export function invalidateSettingsCache() {
  cache = null;
  cacheTime = 0;
}
