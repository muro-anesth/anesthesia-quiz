import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const years = searchParams.get("years")?.split(",").filter(Boolean) ?? [];
  const categories = searchParams.get("categories")?.split(",").filter(Boolean) ?? [];
  const excludeParam = searchParams.get("exclude");
  const excludeIds = excludeParam ? excludeParam.split(",").map(Number) : [];

  const where = {
    deleted: false,
    ...(years.length > 0 ? { year: { in: years } } : {}),
    ...(categories.length > 0 ? { category: { in: categories } } : {}),
    ...(excludeIds.length > 0 ? { id: { notIn: excludeIds } } : {}),
  };

  const count = await db.question.count({ where });

  if (count === 0) {
    const totalWhere = {
      deleted: false,
      ...(years.length > 0 ? { year: { in: years } } : {}),
      ...(categories.length > 0 ? { category: { in: categories } } : {}),
    };
    const totalCount = await db.question.count({ where: totalWhere });
    if (totalCount === 0) return NextResponse.json({ question: null, mode: "empty" });
    const skip = Math.floor(Math.random() * totalCount);
    const questions = await db.question.findMany({ where: totalWhere, take: 1, skip });
    return NextResponse.json({ question: questions[0], mode: "new", cycleComplete: true });
  }

  const skip = Math.floor(Math.random() * count);
  const questions = await db.question.findMany({ where, take: 1, skip });
  return NextResponse.json({ question: questions[0], mode: "new" });
}