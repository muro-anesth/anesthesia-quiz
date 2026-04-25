import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const year = searchParams.get("year") ?? undefined;
  const category = searchParams.get("category") ?? undefined;
  const excludeParam = searchParams.get("exclude");
  const excludeIds = excludeParam ? excludeParam.split(",").map(Number) : [];

  const where = {
    deleted: false,
    ...(year ? { year } : {}),
    ...(category ? { category } : {}),
    ...(excludeIds.length > 0 ? { id: { notIn: excludeIds } } : {}),
  };

  const count = await db.question.count({ where });

  if (count === 0) {
    // 全問出題済み→リセットして最初から
    const totalCount = await db.question.count({
      where: { deleted: false, ...(year ? { year } : {}), ...(category ? { category } : {}) },
    });
    if (totalCount === 0) return NextResponse.json({ question: null, mode: "empty" });
    const skip = Math.floor(Math.random() * totalCount);
    const questions = await db.question.findMany({
      where: { deleted: false, ...(year ? { year } : {}), ...(category ? { category } : {}) },
      take: 1,
      skip,
    });
    return NextResponse.json({ question: questions[0], mode: "new", cycleComplete: true });
  }

  const skip = Math.floor(Math.random() * count);
  const questions = await db.question.findMany({ where, take: 1, skip });

  return NextResponse.json({ question: questions[0], mode: "new" });
}