import prisma from '@/lib/prisma';
import type { Settings } from '@prisma/client';

let cache: Settings | null = null;
let cacheTime: number = 0;
const CACHE_TTL = 30000;

export async function getSettings(): Promise<Settings | null> {
  const now = Date.now();
  if (cache && now - cacheTime < CACHE_TTL) return cache;
  const settings = await prisma.settings.findUnique({ where: { id: 'default' } });
  if (settings) {
    cache = settings;
    cacheTime = now;
  }
  return settings;
}

export function invalidateSettingsCache(): void {
  cache = null;
  cacheTime = 0;
}
