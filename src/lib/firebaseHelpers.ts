import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc,
  query, where, orderBy, limit, Timestamp
} from 'firebase/firestore';
import {
  signInWithEmailAndPassword, signOut as firebaseSignOut
} from 'firebase/auth';
import app, { auth, db } from './firebase';
import { scheduleCard, type SrsRating } from './srs';
import { getFunctions, httpsCallable } from 'firebase/functions';

const DOMAIN = 'periop-quiz.app';

// ─── 認証 ───────────────────────────────────────────

export async function loginWithUsername(username: string, password: string) {
  const email = `${username}@${DOMAIN}`;
  return signInWithEmailAndPassword(auth, email, password);
}

export async function logout() {
  return firebaseSignOut(auth);
}

export async function getUserProfile(uid: string) {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? snap.data() : null;
}

// ─── 問題 ───────────────────────────────────────────

export async function fetchQuestions(years: string[], categories: string[]) {
  let q = query(collection(db, 'questions'));
  if (years.length > 0) q = query(q, where('year', 'in', years));
  const snap = await getDocs(q);
  let docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
  if (categories.length > 0) {
    docs = docs.filter(d => categories.includes(d.category));
  }
  return docs;
}

export async function getNextQuestion(
  years: string[],
  categories: string[],
  excludeIds: string[]
) {
  const all = await fetchQuestions(years, categories);
  const pool = all.filter(q => !excludeIds.includes(q.id));
  if (pool.length === 0) {
    if (all.length === 0) return { question: null, mode: 'empty', cycleComplete: false };
    const q = all[Math.floor(Math.random() * all.length)];
    return { question: q, mode: 'new', cycleComplete: true };
  }
  const q = pool[Math.floor(Math.random() * pool.length)];
  return { question: q, mode: 'new', cycleComplete: false };
}

export async function getYears(): Promise<string[]> {
  return ['2023a', '2023b', '2024a', '2024b', '2025a', '2025b'];
}

export async function getCategories(): Promise<string[]> {
  return [
    '薬理・局所麻酔', '薬理・アナフィラキシー', '薬理・筋弛緩', '薬理・オピオイド',
    '心肺蘇生', 'モニタリング・ECG', 'モニタリング・バイタル', '気道管理',
    '区域麻酔', '産科麻酔', '小児麻酔', '輸血・出血管理', '術後管理', '未分類',
  ];
}

// ─── SRS・成績 ──────────────────────────────────────

export async function saveAttempt(
  uid: string,
  questionId: string,
  selected: string,
  answer: string,
  rating: SrsRating
) {
  const normalize = (s: string) => s.split('').sort().join('');
  const isCorrect = normalize(selected) === normalize(answer);
  const now = new Date();

  // 成績記録
  const attemptRef = doc(collection(db, 'users', uid, 'attempts'));
  await setDoc(attemptRef, {
    questionId,
    selected,
    isCorrect,
    answeredAt: Timestamp.fromDate(now),
  });

  // SRSカード更新
  const cardRef = doc(db, 'users', uid, 'progress', questionId);
  const cardSnap = await getDoc(cardRef);
  const existing = cardSnap.exists() ? cardSnap.data() : null;

  const srsInput = existing ? {
    stability: existing.stability,
    difficulty: existing.difficulty,
    elapsedDays: existing.elapsedDays,
    scheduledDays: existing.scheduledDays,
    reps: existing.reps,
    lapses: existing.lapses,
    state: existing.state,
    lastReview: existing.lastReview?.toDate() ?? null,
    due: existing.due?.toDate() ?? now,
  } : null;

  const { nextCard, nextDue } = scheduleCard(srsInput, rating, now);

  await setDoc(cardRef, {
    due: Timestamp.fromDate(nextDue),
    stability: nextCard.stability,
    difficulty: nextCard.difficulty,
    elapsedDays: nextCard.elapsed_days,
    scheduledDays: nextCard.scheduled_days,
    reps: nextCard.reps,
    lapses: nextCard.lapses,
    state: nextCard.state,
    lastReview: Timestamp.fromDate(now),
  });

  return { isCorrect, nextDue };
}

export async function getReviewQueue(uid: string) {
  const now = Timestamp.now();
  const q = query(
    collection(db, 'users', uid, 'progress'),
    where('due', '<=', now),
    orderBy('due'),
    limit(50)
  );
  const snap = await getDocs(q);
  const cards = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));

  // 問題の詳細を取得
  const results = await Promise.all(cards.map(async card => {
    const qSnap = await getDoc(doc(db, 'questions', card.id));
    if (!qSnap.exists()) return null;
    const qData = qSnap.data();
    return {
      questionId: card.id,
      qnum: qData.qnum,
      year: qData.year,
      category: qData.category,
      stem: qData.stem.slice(0, 60) + '...',
      due: card.due?.toDate(),
    };
  }));

  const filtered = results.filter(Boolean);
  return { total: filtered.length, cards: filtered };
}

export async function getStats(uid: string) {
  try {
    const snap = await getDocs(
      query(collection(db, 'users', uid, 'attempts'), orderBy('answeredAt', 'desc'))
    );
    const attempts = snap.docs.map(d => d.data() as any);
    const total = attempts.length;
    const correct = attempts.filter(a => a.isCorrect).length;

    if (total === 0) {
      return { total: 0, correct: 0, rate: 0, categories: [], recentTotal: 0, recentCorrect: 0 };
    }

    // 問題IDの重複を排除して一括取得
    const uniqueIds = [...new Set(attempts.map(a => a.questionId))];
    const qMap: Record<string, string> = {};
    await Promise.all(
      uniqueIds.map(async id => {
        const qSnap = await getDoc(doc(db, 'questions', id));
        if (qSnap.exists()) qMap[id] = qSnap.data().category ?? '未分類';
      })
    );

    const categoryMap: Record<string, { correct: number; total: number }> = {};
    for (const a of attempts) {
      const cat = qMap[a.questionId] ?? '未分類';
      if (!categoryMap[cat]) categoryMap[cat] = { correct: 0, total: 0 };
      categoryMap[cat].total++;
      if (a.isCorrect) categoryMap[cat].correct++;
    }

    const categories = Object.entries(categoryMap).map(([name, s]) => ({
      name, correct: s.correct, total: s.total,
      rate: Math.round((s.correct / s.total) * 100),
    })).sort((a, b) => a.rate - b.rate);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recent = attempts.filter(a => a.answeredAt?.toDate() >= sevenDaysAgo);

    return {
      total, correct,
      rate: Math.round((correct / total) * 100),
      categories,
      recentTotal: recent.length,
      recentCorrect: recent.filter(a => a.isCorrect).length,
    };
  } catch (err) {
    console.error('getStats error:', err);
    return { total: 0, correct: 0, rate: 0, categories: [], recentTotal: 0, recentCorrect: 0 };
  }
}

// ─── 管理者 ─────────────────────────────────────────

export async function getUsers() {
  const snap = await getDocs(collection(db, 'users'));
  return snap.docs.map(d => ({ uid: d.id, ...d.data() }));
}

// ⚠️ **アカウントの作成はここ（Functions 経由）でしか行わない。**
//    ブラウザから `createUserWithEmailAndPassword` を呼ぶ作りだと、
//    サインアップを開けておくしかなく、誰でもアカウントを作って問題集を
//    全部読める状態になる。
export async function adminCreateUser(
  username: string, password: string, role: 'admin' | 'user'
) {
  const functions = getFunctions(app, 'us-central1');
  const fn = httpsCallable(functions, 'adminCreateUser');
  const res = await fn({ username, password, role });
  return res.data as { success: boolean; uid: string };
}

export async function adminChangePassword(targetUid: string, newPassword: string) {
  const functions = getFunctions(app, 'us-central1');
  const changeUserPassword = httpsCallable(functions, 'changeUserPassword');
  await changeUserPassword({ targetUid, newPassword });
}

// ─── 試験モード ──────────────────────────────────────

export async function getQuestionsForYear(year: string) {
  const snap = await getDocs(
    query(collection(db, 'questions'), where('year', '==', year))
  );
  const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
  return docs.sort((a: any, b: any) => a.qnum - b.qnum);
}

export async function saveExamResult(uid: string, result: {
  year: string;
  totalQuestions: number;
  correctAnswers: number;
  score: number;
  answers: { questionId: string; qnum: number; selected: string; answer: string; correct: boolean }[];
}) {
  const ref = doc(collection(db, 'users', uid, 'examHistory'));
  await setDoc(ref, {
    ...result,
    date: Timestamp.now(),
  });
}

export async function getExamHistory(uid: string) {
  const snap = await getDocs(collection(db, 'users', uid, 'examHistory'));
return snap.docs.map(d => ({ id: d.id, ...d.data() }))
  .sort((a: any, b: any) => (b.date?.seconds ?? 0) - (a.date?.seconds ?? 0));
}