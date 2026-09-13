import {
  useState,
  type Dispatch,
  type SetStateAction,
  type RefObject,
} from "react";
import type { User } from "firebase/auth";
import {
  getQuestionsForYear,
  saveExamResult,
  getExamHistory,
} from "@/lib/firebaseHelpers";
import type { Question, Phase, ChoiceKey } from "./types";
import { playSound } from "./sound";

type Options = {
  user: User | null;
  selected: ChoiceKey[];
  setSelected: Dispatch<SetStateAction<ChoiceKey[]>>;
  setQuestion: Dispatch<SetStateAction<Question | null>>;
  setIsCorrect: Dispatch<SetStateAction<boolean | null>>;
  setShowExplanation: Dispatch<SetStateAction<boolean>>;
  setPhase: Dispatch<SetStateAction<Phase>>;
  loadingRef: RefObject<boolean>;
};

export function useExamSession({
  user,
  selected,
  setSelected,
  setQuestion,
  setIsCorrect,
  setShowExplanation,
  setPhase,
  loadingRef,
}: Options) {
  const [examQuestions, setExamQuestions] = useState<Question[]>([]);
  const [examIndex, setExamIndex] = useState(0);
  const [examAnswers, setExamAnswers] = useState<
    {
      questionId: string;
      qnum: number;
      selected: string;
      answer: string;
      correct: boolean;
    }[]
  >([]);
  const [examResult, setExamResult] = useState<any>(null);
  const [examHistory, setExamHistory] = useState<any[]>([]);
  const [showExamWarning, setShowExamWarning] = useState(false);
  const [examBaseYear, setExamBaseYear] = useState<string>("");
  const [examPart, setExamPart] = useState<"a" | "b">("a");
  const [examStartTime, setExamStartTime] = useState<number>(0);
  const [examPartACount, setExamPartACount] = useState<number>(0);

  async function startExam(baseYear: string) {
    setPhase("loading");
    setExamBaseYear(baseYear);
    setExamPart("a");
    setExamAnswers([]);
    setExamIndex(0);
    setExamPartACount(0);
    setExamStartTime(Date.now());
    const qs = await getQuestionsForYear(`${baseYear}a`);
    setExamQuestions(qs);
    setQuestion(qs[0]);
    setSelected([]);
    setIsCorrect(null);
    setShowExplanation(false);
    setPhase("exam_question");
  }

  async function handleExamAnswer(key: ChoiceKey) {
    if (!examQuestions[examIndex]) return;
    const q = examQuestions[examIndex];
    const isX2 = q.answer.length === 2;

    if (isX2) {
      const next = selected.includes(key)
        ? selected.filter((k) => k !== key)
        : [...selected, key];
      setSelected(next);
      if (next.length === 2) {
        const normalize = (s: string) => s.split("").sort().join("");
        const correct = normalize(next.join("")) === normalize(q.answer);
        setIsCorrect(correct);
        setExamAnswers((prev) => [
          ...prev,
          {
            questionId: q.id,
            qnum: q.qnum,
            selected: next.join(""),
            answer: q.answer,
            correct,
          },
        ]);
        playSound(correct ? "correct" : "incorrect");
        setPhase("exam_answered");
      }
    } else {
      const normalize = (s: string) => s.split("").sort().join("");
      const correct = normalize(key) === normalize(q.answer);
      setIsCorrect(correct);
      setSelected([key]);
      setExamAnswers((prev) => [
        ...prev,
        {
          questionId: q.id,
          qnum: q.qnum,
          selected: key,
          answer: q.answer,
          correct,
        },
      ]);
      playSound(correct ? "correct" : "incorrect");
      setPhase("exam_answered");
    }
  }

  async function nextExamQuestion() {
    if (loadingRef.current) return;
    loadingRef.current = true;
    const next = examIndex + 1;
    if (next >= examQuestions.length) {
      if (examPart === "a") {
        setExamPartACount(examQuestions.length);
        setPhase("exam_transition");
      } else {
        if (!user) {
          loadingRef.current = false;
          return;
        }
        const elapsed = Math.floor((Date.now() - examStartTime) / 1000);
        const correct = examAnswers.filter((a) => a.correct).length;
        const result = {
          year: examBaseYear,
          totalQuestions: examAnswers.length,
          correctAnswers: correct,
          score: Math.round((correct / examAnswers.length) * 100),
          elapsedSeconds: elapsed,
          answers: examAnswers,
        };
        await saveExamResult(user.uid, result);
        setExamResult(result);
        setPhase("exam_result");
      }
    } else {
      setExamIndex(next);
      setQuestion(examQuestions[next]);
      setSelected([]);
      setIsCorrect(null);
      setShowExplanation(false);
      setPhase("exam_question");
    }
    loadingRef.current = false;
  }

  async function startPartB() {
    setPhase("loading");
    setExamPart("b");
    setExamIndex(0);
    const qs = await getQuestionsForYear(`${examBaseYear}b`);
    setExamQuestions(qs);
    setQuestion(qs[0]);
    setSelected([]);
    setIsCorrect(null);
    setShowExplanation(false);
    setPhase("exam_question");
  }

  async function handleShowExamHistory() {
    if (!user) return;
    setPhase("loading");
    try {
      const history = await getExamHistory(user.uid);
      console.log("examHistory取得件数:", history.length, history);
      setExamHistory(history);
      setPhase("exam_history");
    } catch (err) {
      console.error("examHistory取得エラー:", err);
      setExamHistory([]);
      setPhase("exam_history");
    }
  }

  return {
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
  };
}
