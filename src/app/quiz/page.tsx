"use client";
import { useState, useEffect, useCallback } from "react";
import { signOut } from "next-auth/react";
import { SRS_OPTIONS, type SrsRating } from "@/lib/srs";

// ---------- 型 ----------
interface Question {
  id: number;
  qnum: number;
  year: string;
  category: string;
  stem: string;
  choiceA: string;
  choiceB: string;
  choiceC: string;
  choiceD: string;
  choiceE: string;
  answer: string;
  questionType: string; // single | combination | image_answers | image_only | x2
  hasImage: boolean;
  mainImage: string | null;
  optionImages: string; // JSON
}

type Phase = "loading" | "question" | "answered" | "empty";

const CHOICE_KEYS = ["a", "b", "c", "d", "e"] as const;
type ChoiceKey = (typeof CHOICE_KEYS)[number];

const CAT_COLORS: Record<string, { bg: string; border: string; color: string }> = {
  "薬理・局所麻酔":   { bg:"rgba(16,185,129,0.12)",  border:"rgba(16,185,129,0.3)",  color:"#34d399" },
  "薬理・アナフィラキシー": { bg:"rgba(251,191,36,0.12)", border:"rgba(251,191,36,0.3)", color:"#fbbf24" },
  "薬理・筋弛緩":     { bg:"rgba(251,191,36,0.12)",  border:"rgba(251,191,36,0.3)",  color:"#fbbf24" },
  "薬理・オピオイド": { bg:"rgba(251,191,36,0.12)",  border:"rgba(251,191,36,0.3)",  color:"#fbbf24" },
  "心肺蘇生":         { bg:"rgba(239,68,68,0.12)",   border:"rgba(239,68,68,0.3)",   color:"#f87171" },
  "モニタリング・ECG":{ bg:"rgba(14,165,233,0.12)",  border:"rgba(14,165,233,0.3)",  color:"#38bdf8" },
  "モニタリング・バイタル":{ bg:"rgba(14,165,233,0.12)", border:"rgba(14,165,233,0.3)", color:"#38bdf8" },
  "気道管理":         { bg:"rgba(168,85,247,0.12)",  border:"rgba(168,85,247,0.3)",  color:"#c084fc" },
  "区域麻酔":         { bg:"rgba(139,92,246,0.12)",  border:"rgba(139,92,246,0.3)",  color:"#a78bfa" },
  "産科麻酔":         { bg:"rgba(236,72,153,0.12)",  border:"rgba(236,72,153,0.3)",  color:"#f472b6" },
  "小児麻酔":         { bg:"rgba(236,72,153,0.12)",  border:"rgba(236,72,153,0.3)",  color:"#f472b6" },
  "輸血・出血管理":   { bg:"rgba(239,68,68,0.12)",   border:"rgba(239,68,68,0.3)",   color:"#f87171" },
  "術後管理":         { bg:"rgba(99,102,241,0.12)",  border:"rgba(99,102,241,0.3)",  color:"#818cf8" },
};

function getCatStyle(cat: string) {
  return CAT_COLORS[cat] ?? { bg:"rgba(100,100,100,0.1)", border:"rgba(100,100,100,0.2)", color:"#9ca3af" };
}

function getChoiceText(q: Question, ch: ChoiceKey): string {
  const map: Record<ChoiceKey, string> = {
    a: q.choiceA, b: q.choiceB, c: q.choiceC, d: q.choiceD, e: q.choiceE,
  };
  return map[ch];
}

function normalize(s: string) { return s.split("").sort().join(""); }

function isAnswerCorrect(q: Question, selected: string[]) {
  const sel = normalize(selected.join(""));
  const ans = normalize(q.answer);
  return sel === ans;
}

// ---------- コンポーネント ----------
export default function QuizPage() {
  const [question, setQuestion] = useState<Question | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [selected, setSelected] = useState<ChoiceKey[]>([]); // X2は2つ
  const [isCorrect, setIsCorrect] = useState(false);
  const [showExp, setShowExp] = useState(false);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [stats, setStats] = useState({ correct: 0, total: 0 });
  const [mode, setMode] = useState<"new" | "review">("new");
  const [navTab, setNavTab] = useState<"quiz" | "stats" | "review" | "settings">("quiz");

  const fetchNext = useCallback(async () => {
    setPhase("loading");
    setSelected([]);
    setShowExp(false);
    setExplanation(null);
    try {
      const res = await fetch("/api/quiz/next");
      const data = await res.json();
      if (data.question) {
        setQuestion(data.question);
        setMode(data.mode ?? "new");
        setPhase("question");
      } else {
        setQuestion(null);
        setPhase("empty");
      }
    } catch {
      setPhase("empty");
    }
  }, []);

  useEffect(() => { fetchNext(); }, [fetchNext]);

  function handleSelect(ch: ChoiceKey) {
    if (phase !== "question" || !question) return;
    const isX2 = question.questionType === "x2";

    if (isX2) {
      // X2：2つ選択したら確定
      setSelected((prev) => {
        if (prev.includes(ch)) return prev.filter((x) => x !== ch);
        const next = [...prev, ch];
        if (next.length === 2) confirmAnswer(next);
        return next;
      });
    } else {
      confirmAnswer([ch]);
    }
  }

  async function confirmAnswer(choices: ChoiceKey[]) {
    if (!question) return;
    const correct = isAnswerCorrect(question, choices);
    setSelected(choices);
    setIsCorrect(correct);
    setPhase("answered");
    setStats((s) => ({ correct: s.correct + (correct ? 1 : 0), total: s.total + 1 }));

    // 解説を取得（あれば）
    try {
      const res = await fetch(`/api/explanation/${question.id}`);
      if (res.ok) {
        const data = await res.json();
        setExplanation(data.body ?? null);
      }
    } catch { /* 解説なし */ }
  }

  async function handleSRS(rating: SrsRating) {
    if (!question) return;
    await fetch("/api/quiz/attempt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionId: question.id, selected: selected.join(""), rating }),
    });
    fetchNext();
  }

  // ---- 選択肢スタイル ----
  function choiceBorder(ch: ChoiceKey) {
    if (phase !== "answered") return "1.5px solid rgba(255,255,255,0.07)";
    const inAnswer = question && normalize(question.answer).includes(ch);
    if (inAnswer) return "1.5px solid #10b981";
    if (selected.includes(ch)) return "1.5px solid #ef4444";
    return "1.5px solid rgba(255,255,255,0.04)";
  }
  function choiceBg(ch: ChoiceKey) {
    if (phase !== "answered") return "rgba(255,255,255,0.03)";
    const inAnswer = question && normalize(question.answer).includes(ch);
    if (inAnswer) return "rgba(16,185,129,0.12)";
    if (selected.includes(ch)) return "rgba(239,68,68,0.1)";
    return "rgba(255,255,255,0.01)";
  }
  function labelBg(ch: ChoiceKey) {
    if (phase !== "answered") {
      if (selected.includes(ch)) return "rgba(14,165,233,0.3)"; // X2途中選択
      return "rgba(255,255,255,0.07)";
    }
    const inAnswer = question && normalize(question.answer).includes(ch);
    if (inAnswer) return "#10b981";
    if (selected.includes(ch)) return "#ef4444";
    return "rgba(255,255,255,0.04)";
  }
  function labelColor(ch: ChoiceKey) {
    if (phase !== "answered") return selected.includes(ch) ? "#fff" : "#7a9ab5";
    const inAnswer = question && normalize(question.answer).includes(ch);
    return (inAnswer || selected.includes(ch)) ? "#fff" : "#3d5a73";
  }
  function textColor(ch: ChoiceKey) {
    if (phase !== "answered") return "#b8cfe0";
    const inAnswer = question && normalize(question.answer).includes(ch);
    if (inAnswer) return "#d1fae5";
    if (selected.includes(ch)) return "#fee2e2";
    return "#3d5a73";
  }

  const optionImages: string[] = question ? JSON.parse(question.optionImages || "[]") : [];
  const isX2 = question?.questionType === "x2";
  const needsConfirm = isX2 && selected.length > 0 && selected.length < 2;
  const catStyle = question ? getCatStyle(question.category) : { bg: "", border: "", color: "" };

  const NAV = [
    { key: "quiz" as const, icon: "📋", label: "クイズ" },
    { key: "stats" as const, icon: "📊", label: "成績" },
    { key: "review" as const, icon: "🔁", label: "復習" },
    { key: "settings" as const, icon: "⚙️", label: "設定" },
  ];

  return (
    <div style={{ background:"#0d1526", minHeight:"100vh", maxWidth:430, margin:"0 auto", display:"flex", flexDirection:"column", color:"#e2eaf4", fontFamily:"'Hiragino Kaku Gothic ProN','Yu Gothic','Noto Sans JP',sans-serif" }}>

      {/* ---- Topbar ---- */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"18px 20px 10px" }}>
        <div>
          <div style={{ fontSize:11, color:"#4a7fa5", letterSpacing:"0.08em", textTransform:"uppercase" }}>
            {mode === "review" ? "🔁 復習" : "🆕 新問題"}
          </div>
          {question && (
            <div style={{ fontSize:14, fontWeight:600, color:"#8bbcda" }}>
              {question.year} — Q{question.qnum}
            </div>
          )}
        </div>
        <div style={{ background:"rgba(0,180,160,0.12)", border:"1px solid rgba(0,180,160,0.25)", borderRadius:20, padding:"5px 14px", fontSize:13, color:"#00d4bf", fontWeight:700 }}>
          ✓ {stats.correct} / {stats.total}
        </div>
      </div>

      {/* ---- Loading ---- */}
      {phase === "loading" && (
        <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", color:"#4a7fa5", fontSize:14 }}>
          読み込み中...
        </div>
      )}

      {/* ---- Empty ---- */}
      {phase === "empty" && (
        <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:16, padding:24 }}>
          <div style={{ fontSize:40 }}>🎉</div>
          <div style={{ fontSize:18, fontWeight:700, color:"#e2eaf4" }}>全問完了！</div>
          <div style={{ fontSize:13, color:"#4a7fa5", textAlign:"center" }}>
            すべての問題の復習が完了しています。<br/>また後で来てください。
          </div>
          <button onClick={fetchNext} style={{ marginTop:8, padding:"12px 28px", borderRadius:12, border:"none", background:"linear-gradient(135deg,#0ea5e9,#00b4a0)", color:"#fff", fontSize:14, fontWeight:700, cursor:"pointer" }}>
            もう一度
          </button>
        </div>
      )}

      {/* ---- Question ---- */}
      {(phase === "question" || phase === "answered") && question && (
        <>
          {/* Category */}
          <div style={{ padding:"0 20px 12px" }}>
            <span style={{ display:"inline-block", padding:"4px 10px", borderRadius:6, fontSize:11, fontWeight:700, letterSpacing:"0.04em", background:catStyle.bg, border:`1px solid ${catStyle.border}`, color:catStyle.color }}>
              {question.category}
            </span>
            {isX2 && (
              <span style={{ marginLeft:8, display:"inline-block", padding:"4px 10px", borderRadius:6, fontSize:11, fontWeight:700, background:"rgba(251,191,36,0.15)", border:"1px solid rgba(251,191,36,0.3)", color:"#fbbf24" }}>
                ✌️ 2つ選べ
              </span>
            )}
          </div>

          {/* Question card */}
          <div style={{ margin:"0 16px 14px", background:"#111f36", border:"1px solid rgba(255,255,255,0.07)", borderRadius:16, padding:18 }}>
            <div style={{ fontSize:15, lineHeight:1.75, fontWeight:500, marginBottom: question.stem.includes("（") ? 14 : 0 }}>
              {question.stem}
            </div>
            {/* 画像 */}
            {question.hasImage && question.mainImage && optionImages.length === 0 && (
              <img
                src={`/quiz-images/${question.year}/${question.mainImage}`}
                alt={`Q${question.qnum} 図`}
                style={{ width:"100%", borderRadius:8, marginTop:12 }}
              />
            )}
          </div>

          {/* Choices */}
          <div style={{ display:"flex", flexDirection:"column", gap:8, padding:"0 16px 14px" }}>
            {CHOICE_KEYS.map((ch) => {
              const text = getChoiceText(question, ch);
              const img = optionImages.find((f) => f.includes(`_${ch}.`) || f === `q${String(question.qnum).padStart(2,"0")}_${ch}.png`);
              return (
                <button key={ch} onClick={() => handleSelect(ch)} disabled={phase === "answered"}
                  style={{ display:"flex", alignItems:"flex-start", gap:10, padding:"13px 14px", borderRadius:12, border:choiceBorder(ch), background:choiceBg(ch), cursor:phase==="answered"?"default":"pointer", textAlign:"left", width:"100%", transition:"all 0.15s", opacity:phase==="answered" && !normalize(question.answer).includes(ch) && !selected.includes(ch) ? 0.35 : 1 }}>
                  <span style={{ minWidth:26, height:26, borderRadius:7, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700, flexShrink:0, marginTop:1, background:labelBg(ch), color:labelColor(ch), transition:"all 0.15s" }}>
                    {ch}
                  </span>
                  <span style={{ fontSize:13.5, lineHeight:1.65, color:textColor(ch), flex:1 }}>
                    {img ? (
                      <img src={`/quiz-images/${question.year}/${img}`} alt={`選択肢 ${ch}`} style={{ width:"100%", borderRadius:6 }}/>
                    ) : text || (
                      <span style={{ color:"#3d5a73", fontStyle:"italic" }}>（波形 {ch}）</span>
                    )}
                  </span>
                  {phase==="answered" && normalize(question.answer).includes(ch) && <span style={{ fontSize:16, marginTop:2, color:"#10b981" }}>✓</span>}
                  {phase==="answered" && selected.includes(ch) && !normalize(question.answer).includes(ch) && <span style={{ fontSize:16, marginTop:2, color:"#ef4444" }}>✗</span>}
                </button>
              );
            })}
          </div>

          {/* X2 途中の案内 */}
          {needsConfirm && (
            <div style={{ margin:"0 16px 12px", padding:"10px 14px", borderRadius:10, background:"rgba(14,165,233,0.1)", border:"1px solid rgba(14,165,233,0.25)", fontSize:13, color:"#38bdf8" }}>
              あと1つ選んでください（{selected.join(", ")} を選択中）
            </div>
          )}

          {/* Feedback */}
          {phase === "answered" && (
            <>
              <div style={{ margin:"0 16px 12px", padding:"12px 16px", borderRadius:10, display:"flex", alignItems:"center", gap:10, fontSize:13, ...(isCorrect ? { background:"rgba(16,185,129,0.12)", border:"1px solid rgba(16,185,129,0.3)", color:"#6ee7b7" } : { background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.25)", color:"#fca5a5" }) }}>
                <span style={{ fontSize:18 }}>{isCorrect ? "🎯" : "📖"}</span>
                {isCorrect
                  ? <span><strong style={{ color:"#fff" }}>正解！</strong></span>
                  : <span><strong style={{ color:"#fff" }}>不正解</strong> — 正解は <strong style={{ color:"#fff" }}>選択肢 {question.answer.toUpperCase()}</strong></span>
                }
              </div>

              {/* 解説トグル */}
              <div onClick={() => setShowExp(v=>!v)} style={{ margin:"0 16px 10px", padding:"10px 14px", borderRadius:10, background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", display:"flex", justifyContent:"space-between", alignItems:"center", cursor:"pointer", fontSize:13, color:"#4a7fa5" }}>
                <span>💡 解説{showExp ? "を閉じる" : "を見る"}</span>
                <span>{showExp ? "▲" : "▼"}</span>
              </div>
              {showExp && (
                <div style={{ margin:"0 16px 12px", padding:14, borderRadius:10, background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", fontSize:13, lineHeight:1.8, color:"#94b4cc" }}>
                  {explanation ?? "（解説未登録）"}
                </div>
              )}

              {/* SRS */}
              <div style={{ padding:"2px 16px 16px" }}>
                <div style={{ fontSize:10, textTransform:"uppercase", letterSpacing:"0.1em", color:"#2d4a60", marginBottom:8, textAlign:"center" }}>次の復習タイミング</div>
                <div style={{ display:"flex", gap:7 }}>
                  {SRS_OPTIONS.map((s) => (
                    <button key={s.key} onClick={() => handleSRS(s.key)}
                      style={{ flex:1, padding:"10px 0", borderRadius:10, border:`1px solid ${s.border}`, background:s.bg, color:s.color, fontSize:11, fontWeight:700, cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:2 }}>
                      {s.label}
                      <span style={{ fontSize:10, fontWeight:400, opacity:0.7 }}>{s.sub}</span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </>
      )}

      <div style={{ flex:1 }}/>

      {/* ---- Bottom nav ---- */}
      <div style={{ display:"flex", justifyContent:"space-around", padding:"14px 0 20px", borderTop:"1px solid rgba(255,255,255,0.05)", background:"rgba(0,0,0,0.25)" }}>
        {NAV.map((n) => (
          <div key={n.key} onClick={() => setNavTab(n.key)}
            style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:3, fontSize:10, color:navTab===n.key?"#38bdf8":"#2d4a60", cursor:"pointer", padding:"4px 18px" }}>
            <span style={{ fontSize:20 }}>{n.icon}</span>
            {n.label}
          </div>
        ))}
      </div>
    </div>
  );
}
