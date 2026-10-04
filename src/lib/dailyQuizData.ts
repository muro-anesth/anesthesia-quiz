import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { db } from './firebase';
import publishedYears from './questionYears.json';
import type { Question } from '@/features/quiz/types';
import type { DailyHistory, DailyProgress } from '@/features/quiz/dailyQuizPlanner';

function millis(value: { toMillis?: () => number } | undefined, fallback: number): number {
  return typeof value?.toMillis === 'function' ? value.toMillis() : fallback;
}

// Read only. The existing saveAttempt remains the sole daily write path.
export async function loadDailyQuizData(uid: string): Promise<{
  questions: Question[]; progress: DailyProgress[]; attempts: DailyHistory[];
}> {
  const [questions, progress, attempts] = await Promise.all([
    getDocs(collection(db, 'questions')),
    getDocs(collection(db, 'users', uid, 'progress')),
    getDocs(collection(db, 'users', uid, 'attempts')),
  ]);
  return {
    questions: questions.docs.map(d => ({ ...d.data(), id: d.id } as Question)).filter(q => publishedYears.includes(q.year)),
    progress: progress.docs.map(d => ({ questionId: d.id, due: millis(d.data().due, Infinity) })),
    attempts: attempts.docs.map(d => ({ id: d.id, questionId: d.data().questionId, isCorrect: d.data().isCorrect === true, answeredAt: millis(d.data().answeredAt, 0) })),
  };
}

// A single-document read before displaying each item detects deleted questions.
export async function getDailyQuizQuestion(id: string): Promise<Question | null> {
  const snap = await getDoc(doc(db, 'questions', id));
  if (!snap.exists() || !publishedYears.includes(snap.data().year)) return null;
  return { ...snap.data(), id: snap.id } as Question;
}
