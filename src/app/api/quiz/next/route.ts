import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;
  const { searchParams } = new URL(req.url);
  const year = searchParams.get("year") ?? undefined;
  const category = searchParams.get("category") ?? undefined;
  const now = new Date();

  const dueCard = await db.srsCard.findFirst({
    where: { userId, due: { lte: now }, question: { deleted: false, ...(year ? { year } : {}), ...(category ? { category } : {}) } },
    orderBy: { due: "asc" },
    include: { question: true },
  });
  if (dueCard) return NextResponse.json({ question: dueCard.question, mode: "review" });

  const seen = await db.srsCard.findMany({ where: { userId }, select: { questionId: true } });
  const seenIds = seen.map((s) => s.questionId);
  const unseenCount = await db.question.count({
    where: { deleted: false, id: { notIn: seenIds }, ...(year ? { year } : {}), ...(category ? { category } : {}) },
  });
  const skip = unseenCount > 0 ? Math.floor(Math.random() * unseenCount) : 0;
  const unseen = await db.question.findMany({
    where: { deleted: false, id: { notIn: seenIds }, ...(year ? { year } : {}), ...(category ? { category } : {}) },
    take: 1,
    skip,
  });
  if (unseen.length > 0) {
    const q = unseen[Math.floor(Math.random() * unseen.length)];
    return NextResponse.json({ question: q, mode: "new" });
  }

  return NextResponse.json({ question: null, mode: "empty" });
}