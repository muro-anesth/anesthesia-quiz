import { useQuizAudio } from "./useQuizAudio";
import { useExamSession } from "./useExamSession";
import { useState, useEffect, useCallback, useRef } from "react";
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
  const [reviewIds, setReviewIds] = useState<string[] | null>(null);
  const [finishAfterRating, setFinishAfterRating] = useState(false);

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
    setSelected,
    setQuestion,
    setIsCorrect,
    setShowExplanation,
    setPhase,
    loadingRef,
  });

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted) return;
    const unsub = onAuthStateChanged(auth, async (u) => {
      setAuthLoading(false);
      if (!u) {
        window.location.replace("/login");
        return;
      }
      setUser(u);
      const profile = await getUserProfile(u.uid);
      setUserProfile(profile);
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
      if (loadingRef.current) return;
      loadingRef.current = true;
      setPhase("loading");
      try {
        const res = await getNextQuestion(
          selectedYears,
          selectedCats,
          excluded,
        );
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
        loadingRef.current = false;
      }
    },
    [selectedYears, selectedCats, excludeIds],
  );

  async function startQuiz() {
    setReviewIds(null);
    setSaveError("");
    setFinishAfterRating(false);
    setExcludeIds([]);
    setCycleComplete(false);
    await loadQuestion([]);
  }

  async function startReview() {
    if (!user) return;
    setPhase("loading");
    const queue = await getReviewQueue(user.uid);
    setReviewQueue(queue);
    setPhase("review_list");
  }

  async function handleAnswer(key: ChoiceKey) {
    if (phase !== "question" || !question) return;
    const isX2 = question.answer.length === 2;

    if (isX2) {
      const next = selected.includes(key)
        ? selected.filter((k) => k !== key)
        : [...selected, key];
      setSelected(next);
      if (next.length === 2) {
        setPhase("answered");
        const normalize = (s: string) => s.split("").sort().join("");
        const correct = normalize(next.join("")) === normalize(question.answer);
        setIsCorrect(correct);
        setExcludeIds((prev) => [...prev, question.id]);
        playSound(correct ? "correct" : "incorrect");
      }
    } else {
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
    if (!question || !user || !selected.length || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setSaveError("");
    try {
      await saveAttempt(
        user.uid,
        question.id,
        selected.join(""),
        question.answer,
        rating,
        attemptIdRef.current,
      );
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
    } catch {
      setPhase("answered");
      setSaveError(
        "保存または次の問題の読み込みに失敗しました。同じボタンでもう一度お試しください。回答は重複して記録されません。",
      );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  async function handleShowStats() {
    if (!user) return;
    setPhase("loading");
    const s = await getStats(user.uid);
    setStats(s);
    setPhase("stats");
  }

  async function beginReview() {
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
    handleExamAnswer,
    handleRating,
    handleShowExamHistory,
    handleShowStats,
    isCorrect,
    mounted,
    nextExamQuestion,
    phase,
    question,
    reviewQueue,
    saveError,
    saving,
    selected,
    selectedCats,
    selectedYears,
    setBgmEnabled,
    setBgmTrack,
    setFinishAfterRating,
    setPhase,
    setSelectedCats,
    setSelectedYears,
    setShowAdmin,
    setShowExamWarning,
    setShowExplanation,
    showAdmin,
    showExamWarning,
    showExplanation,
    startExam,
    startPartB,
    startQuiz,
    startReview,
    stats,
    userProfile,
    years,
  };
}

export type QuizController = ReturnType<typeof useQuizController>;
