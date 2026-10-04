import { useEffect, useRef, useState } from 'react';
import { getDailyQuizQuestion, loadDailyQuizData } from '@/lib/dailyQuizData';
import { dailyAttemptId, dailyDate, dailyStorageKey, dailySeenKey, parseDailySession, planDailyQuiz, reconcileDailySession, type DailySession } from './dailyQuizPlanner';
import type { Phase, Question } from './types';

export function useDailyQuiz(uid: string | undefined, phase: Phase) {
  const [session, setSession] = useState<DailySession | null>(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState('');
  const current = useRef<DailySession | null>(null);
  const owner = useRef(uid);
  owner.current = uid;
  const cache = useRef<{ key: string; data: Awaited<ReturnType<typeof loadDailyQuizData>> } | null>(null);

  function read(date: string): DailySession | null {
    const raw = window.localStorage.getItem(dailyStorageKey(uid!, date));
    const value = parseDailySession(raw, date);
    if (raw && !value) throw new Error('端末の今日の20問の記録を読み取れません。');
    return value;
  }
  function seenToday(date: string): string[] {
    const raw = window.localStorage.getItem(dailySeenKey(uid!, date));
    if (!raw) return [];
    const ids: unknown = JSON.parse(raw);
    if (!Array.isArray(ids) || !ids.every(id => typeof id === 'string' && /^[A-Za-z0-9_-]{1,150}$/.test(id))) throw new Error('当日の出題記録を読み取れません。');
    return [...new Set(ids)];
  }
  function persist(next: DailySession, replaceToken?: string): DailySession {
    if (!uid || owner.current !== uid) throw new Error('ログイン状態が変わりました。');
    // Preserve another tab's completed items without writing any server data.
    let stored = read(next.date);
    if (stored && stored.token !== next.token) {
      if (stored.token !== replaceToken || stored.done.length !== stored.ids.length) throw new Error('別の画面で今日の20問が開始されました。ホームから開き直してください。');
      stored = null; // A completed set is replaced, never merged into the next set.
    }
    const completed = new Map([...next.done, ...(stored?.done ?? [])].map(d => [d.id, d]));
    const ids = [...new Set([...next.ids, ...(stored?.done.map(d => d.id) ?? [])])];
    const merged = { ...next, ids, done: ids.flatMap(id => completed.has(id) ? [completed.get(id)!] : []) };
    window.localStorage.setItem(dailyStorageKey(uid, next.date), JSON.stringify(merged));
    current.current = merged;
    setSession(merged);
    return merged;
  }

  useEffect(() => {
    cache.current = null;
    current.current = null;
    setSession(null);
    setActive(false);
  }, [uid]);

  useEffect(() => {
    if (!uid || phase !== 'home') return;
    setActive(false);
    const refresh = () => {
      try {
        const next = read(dailyDate());
        current.current = next;
        setSession(next);
      } catch {
        setError('端末の再開情報を利用できません。ブラウザの保存設定を確認してください。');
      }
    };
    let midnightTimer: number | undefined;
    const refreshAndSchedule = () => {
      refresh();
      window.clearTimeout?.(midnightTimer);
      const now = Date.now();
      const nextMidnight = (Math.floor((now + 9 * 3600000) / 86400000) + 1) * 86400000 - 9 * 3600000;
      midnightTimer = window.setTimeout?.(refreshAndSchedule, Math.max(1, nextMidnight - now));
    };
    refreshAndSchedule();
    window.addEventListener?.('focus', refreshAndSchedule);
    window.addEventListener?.('storage', refresh);
    return () => {
      window.clearTimeout?.(midnightTimer);
      window.removeEventListener?.('focus', refreshAndSchedule);
      window.removeEventListener?.('storage', refresh);
    };
    // Refresh on returning home and on focus (including a JST date change).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, phase]);

  async function nextQuestion(): Promise<Question | null> {
    let next = current.current;
    if (!next) return null;
    for (;;) {
      const id = next.ids.find(id => !next!.done.some(d => d.id === id));
      if (!id) return null;
      const question = await getDailyQuizQuestion(id);
      if (owner.current !== uid) throw new Error('ログイン状態が変わりました。');
      if (question) return question;
      // Deleted/unpublished items do not count as answered or as part of the total.
      next = persist({ ...next, ids: next.ids.filter(qid => qid !== id) });
    }
  }

  async function begin(): Promise<Question | null> {
    if (!uid) return null;
    const date = dailyDate(), baseKey = dailyStorageKey(uid, date);
    setError('');
    let saved = read(date);
    const previousToken = saved?.token;
    const requestNewSet = !saved || saved.done.length === saved.ids.length;
    const key = `${baseKey}:${saved?.token ?? 'new'}`;
    if (requestNewSet || !cache.current || cache.current.key !== key) {
      const data = await loadDailyQuizData(uid);
      if (owner.current !== uid) throw new Error('ログイン状態が変わりました。');
      cache.current = { key, data };
    }
    // Read again after the network await to avoid replacing a concurrent start.
    saved = read(date) ?? saved;
    const { questions, progress, attempts } = cache.current.data;
    const createNewSet = !saved || (requestNewSet && saved.token === previousToken && saved.done.length === saved.ids.length);
    if (createNewSet) {
      const used = [...new Set([...seenToday(date), ...(saved?.ids ?? [])])];
      const planned: DailySession = {
        version: 2, date, token: crypto.randomUUID(), done: [],
        ids: planDailyQuiz(questions.map(q => q.id), progress, attempts, Date.now(), Object.fromEntries(questions.map(q => [q.id, q.category])), used),
      };
      // Reserve IDs before replacing the completed set. If storage fails, no
      // question is displayed and no answer is written to the server.
      window.localStorage.setItem(dailySeenKey(uid, date), JSON.stringify([...new Set([...used, ...planned.ids])]));
      persist(planned, saved?.token);
    } else {
      persist(reconcileDailySession(saved!, questions.map(q => q.id), attempts));
    }
    cache.current.key = `${baseKey}:${current.current!.token}`;
    setActive(true);
    return nextQuestion();
  }

  function afterSave(id: string, correct: boolean): void {
    const value = current.current;
    if (!value || !value.ids.includes(id)) throw new Error('今日の20問の進捗を確認できません。');
    persist({ ...value, done: value.done.some(d => d.id === id) ? value.done : [...value.done, { id, correct }] });
  }

  return {
    active, session, error, setError, begin, afterSave, nextQuestion,
    stop: () => setActive(false),
    attemptId: (id: string) => dailyAttemptId(current.current!, id),
  };
}
