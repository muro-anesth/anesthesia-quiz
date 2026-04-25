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

  const count = await db.question.count({
    where: {
      deleted: false,
      ...(year ? { year } : {}),
      ...(category ? { category } : {}),
    },
  });

  if (count === 0) {
    return NextResponse.json({ question: null, mode: "empty" });
  }

  const skip = Math.floor(Math.random() * count);
  const questions = await db.question.findMany({
    where: {
      deleted: false,
      ...(year ? { year } : {}),
      ...(category ? { category } : {}),
    },
    take: 1,
    skip,
  });

  if (questions.length === 0) {
    return NextResponse.json({ question: null, mode: "empty" });
  }

  return NextResponse.json({ question: questions[0], mode: "new" });
}