import { useQuizAudio } from "./useQuizAudio";
import { useExamSession } from "./useExamSession";
import { createElement, useState, useEffect, useCallback, useRef } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import {
  getUserProfile,
  getNextQuestion,
  getYears,
  getCategories,
  saveAttempt,
  getReviewQueue,
  getStats,
} from "@/lib/firebaseHelpers";
import { type SrsRating } from "@/lib/srs";

import type { Question, Phase, ChoiceKey } from "./types";
import { playSound } from "./sound";
import { StaleDailySessionError, useDailyQuiz } from "./useDailyQuiz";

export function useQuizController() {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState<Phase>("home");
  const [question, setQuestion] = useState<Question | null>(null);
  const [selected, setSelected] = useState<ChoiceKey[]>([]);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [excludeIds, setExcludeIds] = useState<string[]>([]);
  const [cycleComplete, setCycleComplete] = useState(false);
  const [years, setYears] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedYears, setSelectedYears] = useState<string[]>([]);
  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [reviewQueue, setReviewQueue] = useState<any>(null);
  const [showAdmin, setShowAdmin] = useState(false);
  const loadingRef = useRef(false);
  const savingRef = useRef(false);
  const attemptIdRef = useRef("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [staleDaily, setStaleDaily] = useState(false);
  // Changed synchronously by the auth observer, before React commits a render.
  // An epoch also invalidates A -> B -> A promises and captured event handlers.
  const identity = useRef({ uid: undefined as string | undefined, epoch: 0 });
  const epoch = identity.current.epoch;
  const ownsUI = () => identity.current.epoch === epoch &&
    identity.current.uid === user?.uid && auth.currentUser?.uid === user?.uid;
  const guardSetter = <T,>(setter: React.Dispatch<React.SetStateAction<T>>): React.Dispatch<React.SetStateAction<T>> =>
    value => { if (ownsUI()) setter(value); };
  const ownedAction = <A extends unknown[], R,>(action: (...args: A) => R) =>
    (...args: A) => { if (ownsUI()) return action(...args); };
  const [reviewIds, setReviewIds] = useState<string[] | null>(null);
  const [finishAfterRating, setFinishAfterRating] = useState(false);
  const daily = useDailyQuiz(user?.uid, phase);
  const dailyRenderedAttemptId = daily.active && daily.session && question ? daily.attemptId(question.id) : null;
  const answerLockRef = useRef(false);
  const dailyQuestionIdRef = useRef<string | null>(null);
  const dailySelectedRef = useRef<ChoiceKey[]>([]);

  function showDailyQuestion(next: Question | null) {
    dailyQuestionIdRef.current = next?.id ?? null;
    if (!next) { setPhase("summary"); return; }
    setQuestion(next);
    attemptIdRef.current = daily.attemptId(next.id);
    answerLockRef.current = false;
    dailySelectedRef.current = [];
    setSelected([]);
    setIsCorrect(null);
    setShowExplanation(false);
    setPhase("question");
  }

  async function startDailyQuiz() {
    if (!user || !ownsUI() || loadingRef.current || savingRef.current) return;
    loadingRef.current = true;
    setReviewIds(null);
    setSaveError("");
    setStaleDaily(false);
    setFinishAfterRating(false);
    setCycleComplete(false);
    setPhase("loading");
    try { const next = await daily.begin(); if (ownsUI()) showDailyQuestion(next); }
    catch {
      if (!ownsUI()) return;
      daily.setError("今日の20問を開始できませんでした。通信とブラウザの保存設定を確認し、もう一度お試しください。");
      setPhase("home");
    } finally { if (ownsUI()) loadingRef.current = false; }
  }

  const { bgmEnabled, setBgmEnabled, bgmTrack, setBgmTrack } = useQuizAudio();
  const {
    examQuestions,
    examIndex,
    examAnswers,
    examResult,
    examHistory,
    showExamWarning,
    setShowExamWarning,
    examBaseYear,
    examPart,
    examPartACount,
    startExam,
    handleExamAnswer,
    nextExamQuestion,
    startPartB,
    handleShowExamHistory,
  } = useExamSession({
    user,
    selected,
    setSelected: guardSetter(setSelected),
    setQuestion: guardSetter(setQuestion),
    setIsCorrect: guardSetter(setIsCorrect),
    setShowExplanation: guardSetter(setShowExplanation),
    setPhase: guardSetter(setPhase),
    loadingRef,
  });

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted) return;
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (identity.current.uid !== u?.uid) {
        identity.current = { uid: u?.uid, epoch: identity.current.epoch + 1 };
        attemptIdRef.current = "";
        dailyQuestionIdRef.current = null;
        dailySelectedRef.current = [];
        answerLockRef.current = true;
        loadingRef.current = false;
        savingRef.current = false;
        setSaving(false);
        setQuestion(null);
        setSelected([]);
        setIsCorrect(null);
        setShowExplanation(false);
        setShowExamWarning(false);
        setCycleComplete(false);
        setFinishAfterRating(false);
        setReviewIds(null);
        setReviewQueue(null);
        setExcludeIds([]);
        setStats(null);
        setUserProfile(null);
        setShowAdmin(false);
        setSaveError("");
        setStaleDaily(false);
        setPhase("home");
      }
      setAuthLoading(false);
      setUser(u);
      if (!u) {
        window.location.replace("/login");
        return;
      }
      const requestEpoch = identity.current.epoch;
      const profile = await getUserProfile(u.uid);
      if (identity.current.epoch === requestEpoch && auth.currentUser?.uid === u.uid) setUserProfile(profile);
    });
    return unsub;
  }, [mounted]);

  useEffect(() => {
    if (!user) return;
    getYears().then(setYears);
    getCategories().then(setCategories);
  }, [user]);

  const loadQuestion = useCallback(
    async (excluded = excludeIds) => {
      if (!ownsUI() || loadingRef.current) return;
      loadingRef.current = true;
      setPhase("loading");
      try {
        const res = await getNextQuestion(
          selectedYears,
          selectedCats,
          excluded,
        );
        if (!ownsUI()) return;
        if (!res.question) {
          setPhase("empty");
          return;
        }
        setQuestion(res.question);
        attemptIdRef.current = crypto.randomUUID();
        setCycleComplete(res.cycleComplete ?? false);
        setSelected([]);
        setIsCorrect(null);
        setShowExplanation(false);
        setPhase("question");
      } finally {
        if (ownsUI()) loadingRef.current = false;
      }
    },
    [selectedYears, selectedCats, excludeIds, user, epoch],
  );

  async function startQuiz() {
    if (!ownsUI()) return;
    daily.stop();
    setReviewIds(null);
    setSaveError("");
    setFinishAfterRating(false);
    setExcludeIds([]);
    setCycleComplete(false);
    await loadQuestion([]);
  }

  async function startReview() {
    if (!ownsUI()) return;
    daily.stop();
    if (!user) return;
    setPhase("loading");
    const queue = await getReviewQueue(user.uid);
    if (!ownsUI()) return;
    setReviewQueue(queue);
    setPhase("review_list");
  }

  async function handleAnswer(key: ChoiceKey) {
    if (!ownsUI()) return;
    if (phase !== "question" || !question) return;
    if (daily.active && answerLockRef.current) return;
    const isX2 = question.answer.length === 2;

    if (isX2) {
      const currentSelected = daily.active ? dailySelectedRef.current : selected;
      const next = currentSelected.includes(key)
        ? currentSelected.filter((k) => k !== key)
        : [...currentSelected, key];
      if (daily.active) dailySelectedRef.current = next;
      setSelected(next);
      if (next.length === 2) {
        answerLockRef.current = true;
        setPhase("answered");
        const normalize = (s: string) => s.split("").sort().join("");
        const correct = normalize(next.join("")) === normalize(question.answer);
        setIsCorrect(correct);
        setExcludeIds((prev) => [...prev, question.id]);
        playSound(correct ? "correct" : "incorrect");
      }
    } else {
      answerLockRef.current = true;
      setSelected([key]);
      setPhase("answered");
      const normalize = (s: string) => s.split("").sort().join("");
      const correct = normalize(key) === normalize(question.answer);
      setIsCorrect(correct);
      setExcludeIds((prev) => [...prev, question.id]);
      playSound(correct ? "correct" : "incorrect");
    }
  }

  async function handleRating(rating: SrsRating) {
    if (!ownsUI() || staleDaily || !attemptIdRef.current) return;
    if (phase !== "answered" || !question || !user || !selected.length || savingRef.current) return;
    if (daily.active && (dailyQuestionIdRef.current !== question.id || dailyRenderedAttemptId !== attemptIdRef.current)) return;
    savingRef.current = true;
    setSaving(true);
    setSaveError("");
    try {
      if (daily.active) daily.validateCurrentSet();
      const saved = await saveAttempt(
        user.uid,
        question.id,
        selected.join(""),
        question.answer,
        rating,
        attemptIdRef.current,
      );
      if (!ownsUI()) return;
      if (daily.active) {
        await daily.afterSave(question.id, saved?.isCorrect ?? isCorrect === true);
        if (!ownsUI()) return;
        if (finishAfterRating) {
          dailyQuestionIdRef.current = null;
          setFinishAfterRating(false);
          setPhase("summary");
        } else {
          const next = await daily.nextQuestion();
          if (ownsUI()) showDailyQuestion(next);
        }
        return;
      }
      if (finishAfterRating) {
        setFinishAfterRating(false);
        setPhase("summary");
        return;
      }
      if (reviewIds !== null) {
        const remaining = reviewIds.filter((id) => id !== question.id);
        if (!remaining.length) {
          setReviewIds([]);
          setPhase("summary");
          return;
        }
        const { getDoc, doc } = await import("firebase/firestore");
        const { db } = await import("@/lib/firebase");
        const snap = await getDoc(doc(db, "questions", remaining[0]));
        if (!ownsUI()) return;
        if (!snap.exists())
          throw new Error(
            "復習問題が見つかりません。ホームから復習一覧を開き直してください。",
          );
        setReviewIds(remaining);
        setQuestion({ id: snap.id, ...snap.data() } as Question);
        attemptIdRef.current = crypto.randomUUID();
        setSelected([]);
        setIsCorrect(null);
        setShowExplanation(false);
        setPhase("question");
      } else {
        await loadQuestion();
      }
    } catch (error) {
      if (!ownsUI()) return;
      if (error instanceof StaleDailySessionError) {
        setStaleDaily(true);
        setSaveError("別のタブでセットが変更されました。ホームから現在のセットを開き直してください。");
        return;
      }
      setPhase("answered");
      setSaveError(
        "保存または次の問題の読み込みに失敗しました。同じボタンでもう一度お試しください。回答は重複して記録されません。",
      );
    } finally {
      if (ownsUI()) {
        savingRef.current = false;
        setSaving(false);
      }
    }
  }

  async function handleShowStats() {
    if (!ownsUI()) return;
    if (!user) return;
    setPhase("loading");
    const s = await getStats(user.uid);
    if (!ownsUI()) return;
    setStats(s);
    setPhase("stats");
  }

  async function beginReview() {
    if (!ownsUI()) return;
    daily.stop();
    if (!reviewQueue?.cards?.length) return;
    setPhase("loading");
    setReviewIds(
      reviewQueue.cards.map((c: { questionId: string }) => c.questionId),
    );
    setSaveError("");
    setFinishAfterRating(false);
    setCycleComplete(false);
    const reviewQ = reviewQueue.cards[0];
    const { getDoc, doc } = await import("firebase/firestore");
    const { db } = await import("@/lib/firebase");
    const qSnap = await getDoc(doc(db, "questions", reviewQ.questionId));
    if (!ownsUI()) return;
    if (qSnap.exists()) {
      setQuestion({ id: qSnap.id, ...qSnap.data() } as any);
      attemptIdRef.current = crypto.randomUUID();
      setSelected([]);
      setIsCorrect(null);
      setShowExplanation(false);
      setPhase("question");
    }
  }

  return {
    startDailyQuiz,
    dailySession: daily.session,
    dailyActive: daily.active,
    dailyError: daily.error,
    authLoading,
    beginReview,
    bgmEnabled,
    bgmTrack,
    categories,
    cycleComplete,
    examAnswers,
    examBaseYear,
    examHistory,
    examIndex,
    examPart,
    examPartACount,
    examQuestions,
    examResult,
    finishAfterRating,
    handleAnswer,
    handleExamAnswer: ownedAction(handleExamAnswer),
    handleRating,
    handleShowExamHistory: ownedAction(handleShowExamHistory),
    handleShowStats,
    isCorrect,
    mounted,
    nextExamQuestion: ownedAction(nextExamQuestion),
    phase,
    question,
    reviewQueue,
    saveError: staleDaily ? createElement("span", null, saveError, " ", createElement("button", {
      type: "button",
      onClick: () => { if (!ownsUI()) return; daily.stop(); setStaleDaily(false); setSaveError(""); setPhase("home"); },
    }, "ホームに戻る")) : saveError,
    saving,
    selected,
    selectedCats,
    selectedYears,
    setBgmEnabled,
    setBgmTrack,
    setFinishAfterRating,
    setPhase: guardSetter(setPhase),
    setSelectedCats,
    setSelectedYears,
    setShowAdmin,
    setShowExamWarning,
    setShowExplanation,
    showAdmin,
    showExamWarning,
    showExplanation,
    startExam: ownedAction(startExam),
    startPartB: ownedAction(startPartB),
    startQuiz,
    startReview,
    stats,
    userProfile,
    years,
  };
}

export type QuizController = ReturnType<typeof useQuizController>;
