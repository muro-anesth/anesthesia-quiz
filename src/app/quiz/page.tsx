"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { signOut, useSession } from "next-auth/react";
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

type Phase = "loading" | "question" | "answered" | "empty" | "summary";

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

const soundCache: Record<string, HTMLAudioElement> = {};
if (typeof window !== "undefined") {
  const files: Record<string, string> = {
    click: "/sounds/click.mp3",
    correct: "/sounds/right.mp3",
    incorrect: "/sounds/wrong.mp3",
  };
  Object.entries(files).forEach(([key, src]) => {
    const a = new Audio(src);
    a.preload = "auto";
    soundCache[key] = a;
  });
}

function playSound(type: "click" | "correct" | "incorrect") {
  try {
    const audio = soundCache[type];
    if (!audio) return;
    audio.currentTime = 0;
    audio.play();
  } catch {}
}

function normalize(s: string) { return s.split("").sort().join(""); }

function isAnswerCorrect(q: Question, selected: string[]) {
  const sel = normalize(selected.join(""));
  const ans = normalize(q.answer);
  return sel === ans;
}

function StatsTab() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); });
  }, []);

  if (loading) return (
    <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", color:"#4a7fa5", fontSize:14 }}>読み込み中...</div>
  );

  if (!data || data.total === 0) return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:12, padding:24 }}>
      <div style={{ fontSize:36 }}>📊</div>
      <div style={{ color:"#e2eaf4", fontSize:16, fontWeight:700 }}>まだデータがありません</div>
      <div style={{ color:"#4a7fa5", fontSize:13 }}>クイズを解くと成績が表示されます</div>
    </div>
  );

  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", gap:16, padding:24, overflowY:"auto" }}>
      <div style={{ fontSize:18, fontWeight:700, color:"#e2eaf4", marginBottom:4 }}>成績</div>

      {/* 全体サマリー */}
      <div style={{ display:"flex", gap:10 }}>
        {[
          { label:"解答数", value:`${data.total}問`, color:"#e2eaf4" },
          { label:"正解数", value:`${data.correct}問`, color:"#34d399" },
          { label:"正答率", value:`${data.rate}%`, color:"#38bdf8" },
        ].map((item) => (
          <div key={item.label} style={{ flex:1, background:"#111f36", border:"1px solid rgba(255,255,255,0.07)", borderRadius:12, padding:"14px 10px", textAlign:"center" }}>
            <div style={{ fontSize:18, fontWeight:700, color:item.color }}>{item.value}</div>
            <div style={{ fontSize:11, color:"#4a7fa5", marginTop:4 }}>{item.label}</div>
          </div>
        ))}
      </div>

      {/* 直近7日 */}
      <div style={{ background:"#111f36", border:"1px solid rgba(255,255,255,0.07)", borderRadius:12, padding:16 }}>
        <div style={{ fontSize:13, color:"#4a7fa5", marginBottom:10 }}>直近7日間</div>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <span style={{ color:"#b8cfe0", fontSize:14 }}>{data.recentTotal}問 解答</span>
          <span style={{ color:"#34d399", fontSize:14, fontWeight:700 }}>
            {data.recentTotal > 0 ? Math.round((data.recentCorrect / data.recentTotal) * 100) : 0}% 正解
          </span>
        </div>
      </div>

      {/* カテゴリ別 */}
      <div style={{ background:"#111f36", border:"1px solid rgba(255,255,255,0.07)", borderRadius:12, padding:16 }}>
        <div style={{ fontSize:13, color:"#4a7fa5", marginBottom:12 }}>カテゴリ別正答率（低い順）</div>
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {data.categories.map((cat: any) => (
            <div key={cat.name}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                <span style={{ fontSize:12, color:"#b8cfe0" }}>{cat.name}</span>
                <span style={{ fontSize:12, color:"#94b4cc" }}>{cat.correct}/{cat.total} ({cat.rate}%)</span>
              </div>
              <div style={{ height:6, background:"rgba(255,255,255,0.07)", borderRadius:3, overflow:"hidden" }}>
                <div style={{
                  height:"100%",
                  width:`${cat.rate}%`,
                  background: cat.rate >= 80 ? "#34d399" : cat.rate >= 60 ? "#38bdf8" : "#f87171",
                  borderRadius:3,
                  transition:"width 0.4s ease",
                }}/>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AdminUserTab() {
  const [users, setUsers] = useState<any[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("user");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/admin/users")
      .then((r) => r.json())
      .then((d) => setUsers(d.users ?? []));
  }, [msg]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg("");
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, role }),
    });
    if (res.ok) {
      setMsg("✓ ユーザーを追加しました");
      setEmail("");
      setPassword("");
    } else {
      setMsg("エラーが発生しました");
    }
    setLoading(false);
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12, marginTop:16 }}>
      <div style={{ fontSize:13, color:"#4a7fa5" }}>ユーザー管理</div>

      {/* 追加フォーム */}
      <form onSubmit={handleAdd} style={{ background:"#0d1f38", border:"1px solid rgba(255,255,255,0.07)", borderRadius:12, padding:16, display:"flex", flexDirection:"column", gap:10 }}>
        <input type="text" required placeholder="ユーザー名" value={email} onChange={(e) => setEmail(e.target.value)}
          style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, padding:"10px 12px", color:"#e2eaf4", fontSize:14, outline:"none" }}/>
        <input type="password" required placeholder="パスワード" value={password} onChange={(e) => setPassword(e.target.value)}
          style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, padding:"10px 12px", color:"#e2eaf4", fontSize:14, outline:"none" }}/>
        <select value={role} onChange={(e) => setRole(e.target.value)}
          style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, padding:"10px 12px", color:"#e2eaf4", fontSize:14, outline:"none" }}>
          <option value="user">user</option>
          <option value="admin">admin</option>
        </select>
        {msg && <div style={{ fontSize:13, color: msg.startsWith("✓") ? "#34d399" : "#f87171" }}>{msg}</div>}
        <button type="submit" disabled={loading}
          style={{ padding:"10px", borderRadius:8, border:"none", background:"linear-gradient(135deg,#0ea5e9,#00b4a0)", color:"#fff", fontSize:14, fontWeight:700, cursor:"pointer", opacity:loading?0.7:1 }}>
          {loading ? "追加中..." : "ユーザーを追加"}
        </button>
      </form>

      {/* ユーザー一覧 */}
      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {users.map((u) => (
          <div key={u.id} style={{ background:"#111f36", border:"1px solid rgba(255,255,255,0.07)", borderRadius:10, padding:"10px 14px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <span style={{ fontSize:13, color:"#b8cfe0" }}>{u.email}</span>
            <span style={{ fontSize:11, padding:"2px 8px", borderRadius:10, background: u.role === "admin" ? "rgba(251,191,36,0.15)" : "rgba(100,100,100,0.2)", color: u.role === "admin" ? "#fbbf24" : "#94b4cc" }}>{u.role}</span>
            <button onClick={async () => {
              if (!confirm(`${u.email} を削除しますか？`)) return;
              await fetch("/api/admin/users", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: u.id }),
              });
              setUsers(prev => prev.filter(x => x.id !== u.id));
            }}
              style={{ fontSize:11, padding:"2px 8px", borderRadius:6, border:"1px solid rgba(239,68,68,0.3)", background:"rgba(239,68,68,0.1)", color:"#f87171", cursor:"pointer" }}>
              削除
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReviewTab({ onStart }: { onStart: () => void }) {
  const [cards, setCards] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/quiz/review")
      .then((r) => r.json())
      .then((data) => {
        setCards(data.cards ?? []);
        setTotal(data.total ?? 0);
        setLoading(false);
      });
  }, []);

  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", gap:16, padding:24 }}>
      <div style={{ fontSize:18, fontWeight:700, color:"#e2eaf4", marginBottom:4 }}>復習キュー</div>
      {loading ? (
        <div style={{ color:"#4a7fa5", fontSize:14 }}>読み込み中...</div>
      ) : total === 0 ? (
        <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:12 }}>
          <div style={{ fontSize:36 }}>✅</div>
          <div style={{ color:"#e2eaf4", fontSize:16, fontWeight:700 }}>今日の復習は完了！</div>
          <div style={{ color:"#4a7fa5", fontSize:13 }}>新しい問題に挑戦しましょう</div>
          <button onClick={onStart}
            style={{ marginTop:8, padding:"12px 28px", borderRadius:12, border:"none", background:"linear-gradient(135deg,#0ea5e9,#00b4a0)", color:"#fff", fontSize:14, fontWeight:700, cursor:"pointer" }}>
            クイズを始める
          </button>
        </div>
      ) : (
        <>
          <div style={{ background:"rgba(14,165,233,0.12)", border:"1px solid rgba(14,165,233,0.3)", borderRadius:10, padding:"12px 16px", fontSize:13, color:"#38bdf8" }}>
            🔁 復習待ち: <strong>{total} 問</strong>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:8, overflowY:"auto", maxHeight:"50vh" }}>
            {cards.map((c) => (
              <div key={c.questionId} style={{ background:"#111f36", border:"1px solid rgba(255,255,255,0.07)", borderRadius:12, padding:"12px 16px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                  <span style={{ fontSize:11, color:"#4a7fa5" }}>{c.year} Q{c.qnum}</span>
                  <span style={{ fontSize:11, background:"rgba(100,100,100,0.2)", padding:"2px 8px", borderRadius:10, color:"#94b4cc" }}>{c.category}</span>
                </div>
                <div style={{ fontSize:13, color:"#b8cfe0", lineHeight:1.5 }}>{c.stem}</div>
              </div>
            ))}
          </div>
          <button onClick={onStart}
            style={{ width:"100%", padding:"14px", borderRadius:12, border:"none", background:"linear-gradient(135deg,#0ea5e9,#00b4a0)", color:"#fff", fontSize:14, fontWeight:700, cursor:"pointer" }}>
            復習を始める
          </button>
        </>
      )}
    </div>
  );
}

// ---------- コンポーネント ----------
export default function QuizPage() {
  const [question, setQuestion] = useState<Question | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [selected, setSelected] = useState<ChoiceKey[]>([]); // X2は2つ
  const [isCorrect, setIsCorrect] = useState(false);
  const [showExp, setShowExp] = useState(false);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [expLoading, setExpLoading] = useState(false);
  const [stats, setStats] = useState({ correct: 0, total: 0 });
  const [sessionStart] = useState(() => Date.now());
  const [mode, setMode] = useState<"new" | "review">("new");
  const [navTab, setNavTab] = useState<"quiz" | "stats" | "review" | "settings">("quiz");
  const [yearFilter, setYearFilter] = useState("");
  const [years, setYears] = useState<string[]>([]);
  const [seEnabled, setSeEnabled] = useState(true);
  const [bgmEnabled, setBgmEnabled] = useState(false);
  const [bgmTrack, setBgmTrack] = useState<"1"|"2"|"3">("1");
  const bgmRef = useRef<HTMLAudioElement | null>(null);
  function playSoundSE(type: "click" | "correct" | "incorrect") {
    if (!seEnabled) return;
    playSound(type);
  }

  useEffect(() => {
    if (bgmEnabled) {
      if (!bgmRef.current || bgmRef.current.src !== window.location.origin + `/sounds/bgm${bgmTrack}.mp3`) {
        if (bgmRef.current) { bgmRef.current.pause(); bgmRef.current = null; }
        const a = new Audio(`/sounds/bgm${bgmTrack}.mp3`);
        a.loop = true;
        a.volume = 0.3;
        a.play().catch(() => {});
        bgmRef.current = a;
      }
    } else {
      if (bgmRef.current) { bgmRef.current.pause(); bgmRef.current = null; }
    }
  }, [bgmEnabled, bgmTrack]);
  const [displayOrder, setDisplayOrder] = useState<ChoiceKey[]>(["a","b","c","d","e"]);

  function shuffleChoices() {
    const arr: ChoiceKey[] = ["a","b","c","d","e"];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    setDisplayOrder(arr);
  }
  const { data: session } = useSession();

  const fetchNext = useCallback(async () => {
    setPhase("loading");
    setSelected([]);
    setShowExp(false);
    setExplanation(null);
    setExpLoading(false);
    // single タイプのみシャッフル
    try {
      const params = new URLSearchParams();
      if (yearFilter) params.set("year", yearFilter);
      const res = await fetch(`/api/quiz/next?${params.toString()}`);
      const data = await res.json();
      if (data.question) {
        setQuestion(data.question);
        setMode(data.mode ?? "new");
        if (data.question.questionType === "single") {
          shuffleChoices();
        } else {
          setDisplayOrder(["a","b","c","d","e"]);
        }
        setPhase("question");
      } else {
        setQuestion(null);
        setPhase("empty");
      }
    } catch {
      setPhase("empty");
    }
  }, [yearFilter]);

useEffect(() => {
    fetch("/api/quiz/years")
      .then((r) => r.json())
      .then((d) => setYears(d.years ?? []));
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
    playSoundSE(correct ? "correct" : "incorrect");
    setStats((s) => ({ correct: s.correct + (correct ? 1 : 0), total: s.total + 1 }));
  }

  async function fetchExplanation(qid: number) {
    if (expLoading || explanation !== null) return;
    setExpLoading(true);
    setExplanation(null);
    try {
      const res = await fetch(`/api/explanation/${qid}`);
      if (!res.ok) { setExplanation(null); return; }
      const data = await res.json();
      setExplanation(data.text ?? null);
    } catch (err) {
      console.error("fetchExplanation error:", err);
      setExplanation(null);
    } finally {
      setExpLoading(false);
    }
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
      {navTab === "quiz" && phase === "loading" && (
        <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", color:"#4a7fa5", fontSize:14 }}>
          読み込み中...
        </div>
      )}

{/* ---- Stats ---- */}
      {navTab === "stats" && phase !== "summary" && (
        <StatsTab />
      )}

{/* ---- Review ---- */}
      {navTab === "review" && phase !== "summary" && (
        <ReviewTab onStart={() => setNavTab("quiz")} />
      )}

{/* ---- Settings ---- */}
      {navTab === "settings" && phase !== "summary" && (
        <div style={{ flex:1, display:"flex", flexDirection:"column", gap:16, padding:24 }}>
          <div style={{ fontSize:18, fontWeight:700, color:"#e2eaf4", marginBottom:8 }}>設定</div>

          {/* 年度絞り込み */}
          <div style={{ background:"#111f36", borderRadius:12, padding:16, border:"1px solid rgba(255,255,255,0.07)" }}>
            <div style={{ fontSize:13, color:"#4a7fa5", marginBottom:10 }}>年度で絞り込む</div>
            <select onChange={(e) => setYearFilter(e.target.value)} value={yearFilter}
              style={{ width:"100%", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, padding:"10px 12px", color:"#e2eaf4", fontSize:14, outline:"none" }}>
              <option value="">すべての年度</option>
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {/* SE設定 */}
          <div style={{ background:"#111f36", borderRadius:12, padding:16, border:"1px solid rgba(255,255,255,0.07)" }}>
            <div style={{ fontSize:13, color:"#4a7fa5", marginBottom:12 }}>効果音（SE）</div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span style={{ fontSize:14, color:"#b8cfe0" }}>SE {seEnabled ? "オン" : "オフ"}</span>
              <div onClick={() => setSeEnabled(v => !v)} style={{ width:44, height:24, borderRadius:12, background:seEnabled ? "#0ea5e9" : "rgba(255,255,255,0.1)", cursor:"pointer", position:"relative", transition:"background 0.2s" }}>
                <div style={{ position:"absolute", top:2, left:seEnabled ? 22 : 2, width:20, height:20, borderRadius:10, background:"#fff", transition:"left 0.2s" }}/>
              </div>
            </div>
          </div>

          {/* BGM設定 */}
          <div style={{ background:"#111f36", borderRadius:12, padding:16, border:"1px solid rgba(255,255,255,0.07)" }}>
            <div style={{ fontSize:13, color:"#4a7fa5", marginBottom:12 }}>BGM</div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
              <span style={{ fontSize:14, color:"#b8cfe0" }}>BGM {bgmEnabled ? "オン" : "オフ"}</span>
              <div onClick={() => setBgmEnabled(v => !v)} style={{ width:44, height:24, borderRadius:12, background:bgmEnabled ? "#0ea5e9" : "rgba(255,255,255,0.1)", cursor:"pointer", position:"relative", transition:"background 0.2s" }}>
                <div style={{ position:"absolute", top:2, left:bgmEnabled ? 22 : 2, width:20, height:20, borderRadius:10, background:"#fff", transition:"left 0.2s" }}/>
              </div>
            </div>
            {bgmEnabled && (
              <div style={{ display:"flex", gap:8 }}>
                {(["1","2","3"] as const).map((t) => (
                  <button key={t} onClick={() => setBgmTrack(t)}
                    style={{ flex:1, padding:"8px 0", borderRadius:8, border:`1px solid ${bgmTrack===t ? "#0ea5e9" : "rgba(255,255,255,0.1)"}`, background:bgmTrack===t ? "rgba(14,165,233,0.2)" : "transparent", color:bgmTrack===t ? "#38bdf8" : "#4a7fa5", fontSize:13, cursor:"pointer" }}>
                    BGM {t}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* サインアウト */}
          <div style={{ background:"#111f36", borderRadius:12, padding:16, border:"1px solid rgba(255,255,255,0.07)" }}>
            <div style={{ fontSize:13, color:"#4a7fa5", marginBottom:10 }}>アカウント</div>
            <button onClick={() => signOut({ callbackUrl: "/login" })}
              style={{ width:"100%", padding:"12px", borderRadius:10, border:"1px solid rgba(239,68,68,0.3)", background:"rgba(239,68,68,0.1)", color:"#f87171", fontSize:14, fontWeight:600, cursor:"pointer" }}>
              サインアウト
            </button>
          </div>
          {/* ユーザー管理（adminのみ） */}
          {(session as any)?.user?.role === "admin" && <AdminUserTab />}
        </div>
      )}

{/* ---- Summary ---- */}
      {phase === "summary" && (
        <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:20, padding:24 }}>
          <div style={{ fontSize:40 }}>📊</div>
          <div style={{ fontSize:20, fontWeight:700, color:"#e2eaf4" }}>今日の結果</div>
          <div style={{ background:"#111f36", borderRadius:16, padding:"24px 32px", border:"1px solid rgba(255,255,255,0.07)", display:"flex", flexDirection:"column", gap:16, width:"100%", maxWidth:320 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span style={{ color:"#4a7fa5", fontSize:14 }}>解答問題数</span>
              <span style={{ color:"#e2eaf4", fontSize:20, fontWeight:700 }}>{stats.total} 問</span>
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span style={{ color:"#4a7fa5", fontSize:14 }}>正解数</span>
              <span style={{ color:"#34d399", fontSize:20, fontWeight:700 }}>{stats.correct} 問</span>
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span style={{ color:"#4a7fa5", fontSize:14 }}>正答率</span>
              <span style={{ color:"#38bdf8", fontSize:20, fontWeight:700 }}>
                {stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0}%
              </span>
            </div>
            <div style={{ height:1, background:"rgba(255,255,255,0.07)" }}/>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span style={{ color:"#4a7fa5", fontSize:14 }}>学習時間</span>
              <span style={{ color:"#e2eaf4", fontSize:16, fontWeight:600 }}>
                {Math.round((Date.now() - sessionStart) / 60000)} 分
              </span>
            </div>
          </div>
          <button onClick={fetchNext} style={{ width:"100%", maxWidth:320, padding:"14px", borderRadius:12, border:"none", background:"linear-gradient(135deg,#0ea5e9,#00b4a0)", color:"#fff", fontSize:14, fontWeight:700, cursor:"pointer" }}>
            続きを学習する
          </button>
        </div>
      )}

      {/* ---- Empty ---- */}
      {navTab === "quiz" && phase === "empty" && (
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
      {navTab === "quiz" && (phase === "question" || phase === "answered") && question && (
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
            <div style={{ fontSize:15, lineHeight:1.75, fontWeight:500, marginBottom: question.stem.includes("（") ? 14 : 0, whiteSpace:"pre-wrap" }}>
              {question.stem}
            </div>
            {/* 画像 */}
            {question.hasImage && !!question.mainImage && <img
  src={`/quiz-images/${question.year}/${question.mainImage}`}
  alt={`Q${question.qnum} 図`}
  style={{ width:"100%", borderRadius:8, marginTop:12 }}
/>}
          </div>

          {/* Choices */}
          <div style={{ display:"flex", flexDirection:"column", gap:8, padding:"0 16px 14px" }}>
            {displayOrder.map((ch) => {
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
              <div onClick={() => {
                if (!showExp && explanation === null && question) fetchExplanation(question.id);
                setShowExp(v=>!v);
              }} style={{ margin:"0 16px 10px", padding:"10px 14px", borderRadius:10, background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", display:"flex", justifyContent:"space-between", alignItems:"center", cursor:"pointer", fontSize:13, color:"#4a7fa5" }}>
                <span>💡 解説{showExp ? "を閉じる" : "を見る"}</span>
                <span>{showExp ? "▲" : "▼"}</span>
              </div>
              {showExp && (
                <div style={{ margin:"0 16px 12px", padding:14, borderRadius:10, background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", fontSize:13, lineHeight:1.8, color:"#94b4cc" }}>
                  {expLoading && !explanation
                    ? <span style={{ color:"#4a7fa5" }}>解説を生成中…</span>
                    : explanation
                    ? explanation
                    : "（解説を取得できませんでした）"}
                </div>
              )}

              {/* SRS */}
<div style={{ padding:"0 16px 8px", textAlign:"center" }}>
            <button onClick={() => setPhase("summary")}
              style={{ background:"transparent", border:"1px solid rgba(255,255,255,0.15)", borderRadius:10, padding:"10px 24px", color:"#4a7fa5", fontSize:13, cursor:"pointer" }}>
              今日はここまで
            </button>
          </div>
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
          <div key={n.key} onClick={() => { setNavTab(n.key); playSoundSE("click"); }}
            style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:3, fontSize:10, color:navTab===n.key?"#38bdf8":"#2d4a60", cursor:"pointer", padding:"4px 18px" }}>
            <span style={{ fontSize:20 }}>{n.icon}</span>
            {n.label}
          </div>
        ))}
      </div>
    </div>
  );
}
