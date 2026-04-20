import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { scheduleCard, type SrsRating } from "@/lib/srs";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;
  const { questionId, selected, rating } = (await req.json()) as { questionId: number; selected: string; rating: SrsRating };
  const question = await db.question.findUnique({ where: { id: questionId } });
  if (!question) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const normalize = (s: string) => s.split("").sort().join("");
  const isCorrect = normalize(selected) === normalize(question.answer);
  const now = new Date();

  await db.attempt.create({ data: { userId, questionId, selected, isCorrect } });

  const existing = await db.srsCard.findUnique({ where: { userId_questionId: { userId, questionId } } });
  const { nextCard, nextDue } = scheduleCard(existing, rating, now);

  await db.srsCard.upsert({
    where: { userId_questionId: { userId, questionId } },
    create: { userId, questionId, due: nextDue, stability: nextCard.stability, difficulty: nextCard.difficulty, elapsedDays: nextCard.elapsed_days, scheduledDays: nextCard.scheduled_days, reps: nextCard.reps, lapses: nextCard.lapses, state: nextCard.state, lastReview: now },
    update: { due: nextDue, stability: nextCard.stability, difficulty: nextCard.difficulty, elapsedDays: nextCard.elapsed_days, scheduledDays: nextCard.scheduled_days, reps: nextCard.reps, lapses: nextCard.lapses, state: nextCard.state, lastReview: now },
  });

  return NextResponse.json({ isCorrect, nextDue });
}