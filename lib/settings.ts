import prisma from '@/lib/prisma';
import type { Settings } from '@prisma/client';

let cache: Settings | null = null;
let cacheTime: number = 0;
let cachePopulated: boolean = false;
const CACHE_TTL = 30000;

export async function getSettings(): Promise<Settings | null> {
  const now = Date.now();
  if (cachePopulated && now - cacheTime < CACHE_TTL) return cache;
  const settings = await prisma.settings.findUnique({ where: { id: 'default' } });
  cache = settings;
  cacheTime = now;
  cachePopulated = true;
  return settings;
}

export function invalidateSettingsCache(): void {
  cache = null;
  cacheTime = 0;
  cachePopulated = false;
}
