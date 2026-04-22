import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rows = await db.question.findMany({
    where: { deleted: false },
    select: { year: true },
    distinct: ["year"],
    orderBy: { year: "asc" },
  });
  const years = rows.map((r) => r.year);
  return NextResponse.json({ years });
}