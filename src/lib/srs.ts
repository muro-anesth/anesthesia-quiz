import { createEmptyCard, fsrs, generatorParameters, Rating } from "ts-fsrs";

export { Rating };

const f = fsrs(generatorParameters({ enable_fuzz: true, maximum_interval: 365 }));

export type SrsRating = "again" | "hard" | "good" | "easy";

const RATING_MAP: Record<SrsRating, Rating> = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
};

export function scheduleCard(
  dbCard: {
    stability: number;
    difficulty: number;
    elapsedDays: number;
    scheduledDays: number;
    reps: number;
    lapses: number;
    state: number;
    lastReview: Date | null;
    due: Date;
  } | null,
  rating: SrsRating,
  now: Date = new Date()
): { nextCard: any; nextDue: Date; scheduledDays: number } {
  const card = dbCard
    ? {
        due: dbCard.due,
        stability: dbCard.stability,
        difficulty: dbCard.difficulty,
        elapsed_days: dbCard.elapsedDays,
        scheduled_days: dbCard.scheduledDays,
        reps: dbCard.reps,
        lapses: dbCard.lapses,
        state: dbCard.state as 0 | 1 | 2 | 3,
        last_review: dbCard.lastReview ?? new Date(0),
        learning_steps: 0,
      }
    : createEmptyCard(now);

  const r = RATING_MAP[rating];
  const scheduling = f.repeat(card, now);
  const result = (scheduling as any)[r];
  const nextCard = result.card;

  return {
    nextCard,
    nextDue: nextCard.due,
    scheduledDays: nextCard.scheduled_days,
  };
}

export const SRS_OPTIONS: {
  key: SrsRating;
  label: string;
  sub: string;
  color: string;
  border: string;
  bg: string;
}[] = [
  { key: "again", label: "もう一度", sub: "すぐ",  color: "#f87171", border: "rgba(239,68,68,0.3)",   bg: "rgba(239,68,68,0.15)"  },
  { key: "hard",  label: "難しい",   sub: "1日後", color: "#fb923c", border: "rgba(249,115,22,0.3)",  bg: "rgba(249,115,22,0.15)" },
  { key: "good",  label: "良い",     sub: "3日後", color: "#38bdf8", border: "rgba(14,165,233,0.3)",  bg: "rgba(14,165,233,0.15)" },
  { key: "easy",  label: "簡単",     sub: "7日後", color: "#34d399", border: "rgba(16,185,129,0.3)",  bg: "rgba(16,185,129,0.15)" },
];