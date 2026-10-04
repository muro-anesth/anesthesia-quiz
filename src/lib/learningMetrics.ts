/** Read-only metrics. The caller supplies actual question documents in published years.
 * Coverage includes any recorded attempt, even if its date/result is unusable.
 * Missing/invalid/future dates make that question's chronological metrics unknown.
 * At an identical timestamp, unanimous boolean results are usable; conflicting or
 * missing results are unknown. Document IDs and input order never decide correctness.
 * Firestore seconds/nanoseconds are compared separately (no millisecond rounding).
 */
export type LearningAttempt = {
  questionId?: unknown;
  isCorrect?: unknown;
  answeredAt?: unknown;
};

type Instant = { seconds: number; nanoseconds: number };
const compare = (a: Instant, b: Instant) =>
  a.seconds - b.seconds || a.nanoseconds - b.nanoseconds;

export function readAnswerInstant(value: unknown): Instant | null {
  if (value instanceof Date) {
    const ms = value.getTime();
    if (!Number.isFinite(ms)) return null;
    const seconds = Math.floor(ms / 1000);
    return readAnswerInstant({ seconds, nanoseconds: (ms - seconds * 1000) * 1e6 });
  }
  if (!value || typeof value !== 'object') return null;
  const v = value as { seconds?: unknown; nanoseconds?: unknown; toDate?: () => Date };
  // A malformed Timestamp must not be silently repaired via a lossy toDate().
  if ('seconds' in v || 'nanoseconds' in v) {
    const { seconds, nanoseconds } = v;
    if (typeof seconds !== 'number' || !Number.isInteger(seconds) ||
        seconds < -62135596800 || seconds > 253402300799 ||
        typeof nanoseconds !== 'number' || !Number.isInteger(nanoseconds) ||
        nanoseconds < 0 || nanoseconds >= 1e9) return null;
    return { seconds, nanoseconds };
  }
  try {
    const date = typeof v.toDate === 'function' ? v.toDate() : null;
    return date instanceof Date ? readAnswerInstant(date) : null;
  } catch {
    return null;
  }
}

export function calculateLearningMetrics(
  publicQuestionIds: readonly string[],
  attempts: readonly LearningAttempt[],
  asOf: Date,
) {
  const now = readAnswerInstant(asOf);
  if (!now) throw new Error('Invalid metrics reference date');
  const publicIds = new Set(publicQuestionIds.filter(id => id.length > 0));
  const grouped = new Map<string, LearningAttempt[]>();
  let excludedAttempts = 0;
  for (const a of attempts) {
    if (typeof a.questionId !== 'string' || !publicIds.has(a.questionId)) {
      excludedAttempts++;
      continue;
    }
    const group = grouped.get(a.questionId) ?? [];
    group.push(a);
    grouped.set(a.questionId, group);
  }
  let firstAnswered = 0, firstCorrect = 0, changedToCorrect = 0;
  let invalidDateQuestions = 0, ambiguousFirstQuestions = 0, ambiguousLatestQuestions = 0;
  for (const group of grouped.values()) {
    const dated = group.map(a => ({ at: readAnswerInstant(a.answeredAt), result: a.isCorrect }));
    if (dated.some(a => !a.at || compare(a.at, now) > 0)) {
      invalidDateQuestions++;
      continue;
    }
    dated.sort((a, b) => compare(a.at!, b.at!));
    const consensus = (at: Instant): boolean | null => {
      const results = dated.filter(a => compare(a.at!, at) === 0).map(a => a.result);
      if (results.every(r => r === true)) return true;
      if (results.every(r => r === false)) return false;
      return null;
    };
    const first = consensus(dated[0].at!);
    const latest = consensus(dated[dated.length - 1].at!);
    if (first === null) ambiguousFirstQuestions++;
    else {
      firstAnswered++;
      if (first) firstCorrect++;
    }
    if (latest === null) ambiguousLatestQuestions++;
    if (first === false && latest === true) changedToCorrect++;
  }
  return {
    publicTotal: publicIds.size,
    attemptedUnique: grouped.size,
    coverageRate: publicIds.size ? Math.round(grouped.size / publicIds.size * 100) : null,
    firstAnswered,
    firstCorrect,
    firstRate: firstAnswered ? Math.round(firstCorrect / firstAnswered * 100) : null,
    changedToCorrect,
    excludedAttempts,
    invalidDateQuestions,
    ambiguousFirstQuestions,
    ambiguousLatestQuestions,
  };
}

export type LearningMetrics = ReturnType<typeof calculateLearningMetrics>;

export type PublicLearningQuestion = { id: string; category?: unknown };

/** Uses current question categories, never category values recorded on attempts.
 * Only categories with actual public documents are emitted, including untouched ones.
 */
export function calculateCategoryLearningMetrics(
  publicQuestions: readonly PublicLearningQuestion[],
  attempts: readonly LearningAttempt[],
  asOf: Date,
) {
  const categoryById = new Map<string, string>();
  const idsByCategory = new Map<string, string[]>();
  for (const q of publicQuestions) {
    if (!q.id) continue;
    const category = typeof q.category === 'string' && q.category.trim() ? q.category : '未分類';
    if (categoryById.has(q.id)) {
      if (categoryById.get(q.id) !== category) throw new Error('Conflicting current question categories');
      continue;
    }
    categoryById.set(q.id, category);
    const ids = idsByCategory.get(category) ?? [];
    ids.push(q.id);
    idsByCategory.set(category, ids);
  }
  const attemptsByCategory = new Map<string, LearningAttempt[]>();
  for (const a of attempts) {
    const category = typeof a.questionId === 'string' ? categoryById.get(a.questionId) : undefined;
    if (category === undefined) continue;
    const group = attemptsByCategory.get(category) ?? [];
    group.push(a);
    attemptsByCategory.set(category, group);
  }
  return [...idsByCategory].map(([name, ids]) => {
    const m = calculateLearningMetrics(ids, attemptsByCategory.get(name) ?? [], asOf);
    return {
      name, publicTotal: m.publicTotal, attemptedUnique: m.attemptedUnique,
      coverageRate: m.coverageRate!, firstAnswered: m.firstAnswered,
      firstCorrect: m.firstCorrect, firstRate: m.firstRate,
      unscoredInitialQuestions: m.attemptedUnique - m.firstAnswered,
    };
  }).sort((a, b) => a.name.localeCompare(b.name, 'ja'));
}

export type CategoryLearningMetrics = ReturnType<typeof calculateCategoryLearningMetrics>[number];

// A UI presentation guideline only, NOT a statistical confidence or ability threshold.
export const SMALL_INITIAL_SAMPLE_DISPLAY_COUNT = 5;

export function categoryInitialResultLabel(m: CategoryLearningMetrics): string {
  if (m.attemptedUnique === 0) return '未着手';
  if (m.firstAnswered === 0) return '初回の正解：判定できる履歴なし';
  const counts = `初回の正解 ${m.firstCorrect}/${m.firstAnswered}問`;
  return m.firstAnswered < SMALL_INITIAL_SAMPLE_DISPLAY_COUNT
    ? `${counts}　まだ回答が少ない`
    : `${counts}（${m.firstRate}%）`;
}
