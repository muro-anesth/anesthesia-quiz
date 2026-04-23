import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const questionId = parseInt(id);
  if (isNaN(questionId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  const q = await db.question.findUnique({ where: { id: questionId } });
  if (!q) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const choiceMap: Record<string, string> = {
    a: q.choiceA, b: q.choiceB, c: q.choiceC, d: q.choiceD, e: q.choiceE,
  };
  const answerLetters = q.answer.toUpperCase().split("").join("・");
  const correctTexts = q.answer
    .split("")
    .map((k) => `${k.toUpperCase()}: ${choiceMap[k] ?? ""}`)
    .join("\n");

  const prompt = `あなたは麻酔科専門医であり指導医です。以下の麻酔科専門医試験の問題について、専攻医・後期研修医向けに解説してください。

【問題】
${q.stem}

【選択肢】
a: ${q.choiceA}
b: ${q.choiceB}
c: ${q.choiceC}
d: ${q.choiceD}
e: ${q.choiceE}

【正解】${answerLetters}
${correctTexts}

正解の根拠を明確に述べ、間違えやすい選択肢があればその理由を説明し、最後に臨床的な要点を1文で締めてください。300字程度でお願いします。`;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY not set" }, { status: 500 });
  }

  const geminiRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 2048 },
      }),
    }
  );

  if (!geminiRes.ok) {
    const errText = await geminiRes.text();
    console.error("Gemini API error:", geminiRes.status, errText);
    return NextResponse.json({ error: "Gemini API error" }, { status: 500 });
  }

  const data = await geminiRes.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
  return NextResponse.json({ text });
}