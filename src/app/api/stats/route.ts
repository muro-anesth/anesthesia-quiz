import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  // 全体の成績
  const attempts = await db.attempt.findMany({
    where: { userId },
    include: { question: { select: { category: true } } },
    orderBy: { answeredAt: "desc" },
  });

  const total = attempts.length;
  const correct = attempts.filter((a) => a.isCorrect).length;

  // カテゴリ別集計
  const categoryMap: Record<string, { correct: number; total: number }> = {};
  for (const a of attempts) {
    const cat = a.question.category;
    if (!categoryMap[cat]) categoryMap[cat] = { correct: 0, total: 0 };
    categoryMap[cat].total++;
    if (a.isCorrect) categoryMap[cat].correct++;
  }

  const categories = Object.entries(categoryMap)
    .map(([name, s]) => ({
      name,
      correct: s.correct,
      total: s.total,
      rate: Math.round((s.correct / s.total) * 100),
    }))
    .sort((a, b) => a.rate - b.rate); // 正答率低い順

  // 直近7日の履歴
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const recent = attempts.filter((a) => a.answeredAt >= sevenDaysAgo);

  return NextResponse.json({
    total,
    correct,
    rate: total > 0 ? Math.round((correct / total) * 100) : 0,
    categories,
    recentTotal: recent.length,
    recentCorrect: recent.filter((a) => a.isCorrect).length,
  });
}