export interface DailyHistory {
  id: string;
  questionId: string;
  isCorrect: boolean;
  answeredAt: number;
}
export interface DailyProgress { questionId: string; due: number }
export interface DailySession {
  version: 2;
  date: string;
  token: string; // Random session nonce for idempotency, NOT an auth token.
  ids: string[];
  done: { id: string; correct: boolean }[];
}

// Explicit JST, independent of the device's time zone and DST.
export function dailyDate(now = Date.now()): string {
  return new Date(now + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
export function dailyStorageKey(uid: string, date: string): string {
  return `periop:daily:v2:${encodeURIComponent(uid)}:${date}`;
}
export function dailySeenKey(uid: string, date: string): string {
  return `${dailyStorageKey(uid, date)}:seen`;
}
export function dailyAttemptId(session: DailySession, id: string): string {
  return `daily-${session.date}-${session.token}-${id}`;
}

/** Pure, deterministic within a JST day; no Firestore or storage access. */
export function planDailyQuiz(
  ids: string[], progress: DailyProgress[], attempts: DailyHistory[], now: number,
  categoryById: Record<string, string> = {}, usedToday: string[] = [],
): string[] {
  const all = [...new Set(ids)].sort();
  // Rotate the fallback/new pool daily, so small daily sessions span all years.
  const offset = all.length ? Math.floor((now + 9 * 3600000) / 86400000) % all.length : 0;
  const pool = [...all.slice(offset), ...all.slice(0, offset)];
  const seen = new Set([...progress.map(p => p.questionId), ...attempts.map(a => a.questionId)]);
  const latest = new Map<string, DailyHistory>();
  for (const attempt of [...attempts].sort((a, b) => b.answeredAt - a.answeredAt || a.id.localeCompare(b.id))) {
    if (!latest.has(attempt.questionId)) latest.set(attempt.questionId, attempt);
  }
  const due = [...progress].filter(p => p.due <= now).sort((a, b) => a.due - b.due || a.questionId.localeCompare(b.questionId)).map(p => p.questionId);
  const unseen = pool.filter(id => !seen.has(id));
  const weak = [...latest.values()].filter(a => !a.isCorrect).map(a => a.questionId);
  const available = new Set(all), selected = new Set<string>();
  const used = new Set(usedToday), categoryCounts = new Map<string, number>();
  function take(candidates: string[], count: number) {
    const remaining = [...new Set(candidates)].filter(id => available.has(id) && !selected.has(id));
    for (let added = 0; added < count && selected.size < 20 && remaining.length; added++) {
      // Within a priority bucket, prefer the least represented category.
      // Ties retain overdue/recent-error order (or the rotated new-question order).
      let best = 0;
      const tally = (id: string) => categoryCounts.get(categoryById[id] || '未分類') ?? 0;
      for (let i = 1; i < remaining.length; i++) if (tally(remaining[i]) < tally(remaining[best])) best = i;
      const [id] = remaining.splice(best, 1), category = categoryById[id] || '未分類';
      selected.add(id);
      categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
    }
  }
  const fresh = (ids: string[]) => ids.filter(id => !used.has(id));
  take(fresh(due), 8); take(fresh(unseen), 8); take(fresh(weak), 4);
  take(fresh(due), 20); take(fresh(unseen), 20); take(fresh(weak), 20); take(fresh(pool), 20);
  // Reuse is allowed only after all still-unused daily candidates are exhausted.
  take(due, 20); take(unseen, 20); take(weak, 20); take(pool, 20);
  return [...selected];
}

export function parseDailySession(raw: string | null, date: string): DailySession | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    const id = (x: unknown) => typeof x === 'string' && /^[A-Za-z0-9_-]{1,150}$/.test(x);
    if (v.version !== 2 || v.date !== date || !id(v.token) || !Array.isArray(v.ids) || v.ids.length > 20 ||
        !v.ids.every(id) || new Set(v.ids).size !== v.ids.length || !Array.isArray(v.done) ||
        !v.done.every((d: { id: string; correct: boolean }) => d && v.ids.includes(d.id) && typeof d.correct === 'boolean') ||
        new Set(v.done.map((d: { id: string }) => d.id)).size !== v.done.length) return null;
    // Whitelist fields: never carry through question text or authentication data.
    return { version: 2, date, token: v.token, ids: v.ids, done: v.done.map((d: { id: string; correct: boolean }) => ({ id: d.id, correct: d.correct })) };
  } catch { return null; }
}

/** Reconcile a committed attempt after reload, including a lost save response. */
export function reconcileDailySession(session: DailySession, available: string[], attempts: DailyHistory[]): DailySession {
  const done = new Map(session.done.map(d => [d.id, d]));
  const byAttempt = new Map(attempts.map(a => [a.id, a]));
  for (const id of session.ids) {
    const saved = byAttempt.get(dailyAttemptId(session, id));
    if (saved?.questionId === id) done.set(id, { id, correct: saved.isCorrect });
  }
  const pool = new Set(available);
  const ids = session.ids.filter(id => done.has(id) || pool.has(id));
  return { ...session, ids, done: ids.flatMap(id => done.has(id) ? [done.get(id)!] : []) };
}
