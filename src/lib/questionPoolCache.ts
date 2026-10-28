// Browser-memory cache for public teaching material only. Never store attempts,
// progress, stars, user profiles or the selected/excluded question IDs here.
export const QUESTION_POOL_TTL_MS = 5 * 60 * 1000;
const MAX_POOLS = 16;

export function createQuestionPoolCache<T>() {
  type Entry = { promise: Promise<T[]>; expiresAt: number };
  const entries = new Map<string, Entry>();
  const normalize = (values: string[]) => [...new Set(values)].sort();

  return {
    get(years: string[], categories: string[], load: () => Promise<T[]>): Promise<T[]> {
      const key = JSON.stringify([normalize(years), normalize(categories)]);
      const now = Date.now();
      for (const [id, entry] of entries) {
        if (entry.expiresAt <= now) entries.delete(id);
      }
      const cached = entries.get(key);
      if (cached) return cached.promise;

      // Share the in-flight read as well as the resolved pool. Expiry starts
      // after success, not while a slow read is still in progress.
      const entry: Entry = { promise: undefined!, expiresAt: Infinity };
      entry.promise = Promise.resolve().then(load).then(rows => {
        if (entries.get(key) === entry) entry.expiresAt = Date.now() + QUESTION_POOL_TTL_MS;
        return rows;
      }, error => {
        if (entries.get(key) === entry) entries.delete(key);
        throw error;
      });
      entries.set(key, entry);
      if (entries.size > MAX_POOLS) entries.delete(entries.keys().next().value!);
      return entry.promise;
    },
    // Call after a successful in-app question edit/import. Detached in-flight
    // reads may finish for their caller, but cannot repopulate this cache.
    invalidate() { entries.clear(); },
  };
}
