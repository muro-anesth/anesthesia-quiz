import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  console.log("explanation API called, id:", params.id);
  const session = await auth();
  console.log("session:", session?.user?.id ?? "none");
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const questionId = parseInt(params.id);
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

  const prompt = `あなたは麻酔科専門医であり指導医です。
以下の麻酔科専門医試験の問題について、専攻医・後期研修医向けに解説してください。

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

以下の構成で、流れるような文章で250字程度に収めてください（箇条書き不可）：
まず正解の根拠を明確に述べ、次に間違えやすい選択肢があればその理由を説明し、最後に臨床的な要点を1文で締めてください。`;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY not set" }, { status: 500 });
  }

  const geminiRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:streamGenerateContent?alt=sse&key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 500 },
      }),
    }
  );

  if (!geminiRes.ok || !geminiRes.body) {
    const errText = await geminiRes.text();
    console.error("Gemini API error:", geminiRes.status, errText);
    return NextResponse.json({ error: "Gemini API error", detail: errText }, { status: 500 });
  }

  // Gemini SSE → プレーンテキストストリームに変換
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const reader = geminiRes.body!.getReader();
      const dec = new TextDecoder();
      let buf = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const json = line.slice(6).trim();
            if (!json) continue;
            try {
              const ev = JSON.parse(json);
              const text = ev.candidates?.[0]?.content?.parts?.[0]?.text;
              if (text) controller.enqueue(enc.encode(text));
            } catch {}
          }
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}