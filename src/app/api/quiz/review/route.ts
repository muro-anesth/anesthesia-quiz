import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;
  const now = new Date();

  const dueCards = await db.srsCard.findMany({
    where: {
      userId,
      due: { lte: now },
      question: { deleted: false },
    },
    orderBy: { due: "asc" },
    include: { question: true },
    take: 50,
  });

  return NextResponse.json({
    total: dueCards.length,
    cards: dueCards.map((c) => ({
      questionId: c.questionId,
      qnum: c.question.qnum,
      year: c.question.year,
      category: c.question.category,
      stem: c.question.stem.slice(0, 60) + "...",
      due: c.due,
    })),
  });
}