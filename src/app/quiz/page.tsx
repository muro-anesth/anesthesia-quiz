"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import {
  logout, getUserProfile, getNextQuestion, getYears, getCategories,
  saveAttempt, getReviewQueue, getStats, getUsers, adminChangePassword,
  getQuestionsForYear, saveExamResult, getExamHistory
} from "@/lib/firebaseHelpers";
import { SRS_OPTIONS, type SrsRating } from "@/lib/srs";

// ─── サウンド ────────────────────────────────────────
const soundCache: Record<string, HTMLAudioElement> = {};
// BGM がオフのときは効果音（クリック・正誤）も鳴らさない
let sfxEnabled = false;
function playSound(type: "correct" | "incorrect" | "click") {
  if (typeof window === "undefined") return;
  if (!sfxEnabled) return;
  const urls: Record<string, string> = {
    correct: "/sounds/right.mp3",
    incorrect: "/sounds/wrong.mp3",
    click: "/sounds/click.mp3",
  };
  if (!soundCache[type]) soundCache[type] = new Audio(urls[type]);
  soundCache[type].currentTime = 0;
  soundCache[type].play().catch(() => {});
}

// ─── 型 ─────────────────────────────────────────────
interface Question {
  id: string; qnum: number; year: string; category: string;
  stem: string; choices: { a: string; b: string; c: string; d: string; e: string };
  answer: string; is_image_question: boolean; main_image: string | null;
  question_type: string;
  subitems: Record<string, string> | null;
  option_images: string[]; explanation: string | null;
}
type Phase = "home" | "loading" | "question" | "answered" | "summary" | "empty" | "stats" | "review_list" | "settings" | "exam_select" | "exam_question" | "exam_answered" | "exam_result" | "exam_history" | "exam_transition";
const CHOICE_KEYS = ["a", "b", "c", "d", "e"] as const;
type ChoiceKey = (typeof CHOICE_KEYS)[number];

const CAT_COLORS: Record<string, { bg: string; border: string; color: string }> = {
  "薬理・局所麻酔":        { bg:"rgba(16,185,129,0.12)",  border:"rgba(16,185,129,0.3)",  color:"#34d399" },
  "薬理・アナフィラキシー": { bg:"rgba(251,191,36,0.12)",  border:"rgba(251,191,36,0.3)",  color:"#fbbf24" },
  "薬理・筋弛緩":          { bg:"rgba(251,191,36,0.12)",  border:"rgba(251,191,36,0.3)",  color:"#fbbf24" },
  "薬理・オピオイド":      { bg:"rgba(251,191,36,0.12)",  border:"rgba(251,191,36,0.3)",  color:"#fbbf24" },
  "心肺蘇生":              { bg:"rgba(239,68,68,0.12)",   border:"rgba(239,68,68,0.3)",   color:"#f87171" },
  "モニタリング・ECG":     { bg:"rgba(14,165,233,0.12)",  border:"rgba(14,165,233,0.3)",  color:"#38bdf8" },
  "モニタリング・バイタル": { bg:"rgba(14,165,233,0.12)", border:"rgba(14,165,233,0.3)",  color:"#38bdf8" },
  "気道管理":              { bg:"rgba(168,85,247,0.12)",  border:"rgba(168,85,247,0.3)",  color:"#c084fc" },
  "区域麻酔":              { bg:"rgba(139,92,246,0.12)",  border:"rgba(139,92,246,0.3)",  color:"#a78bfa" },
  "産科麻酔":              { bg:"rgba(236,72,153,0.12)",  border:"rgba(236,72,153,0.3)",  color:"#f472b6" },
  "小児麻酔":              { bg:"rgba(236,72,153,0.12)",  border:"rgba(236,72,153,0.3)",  color:"#f472b6" },
  "輸血・出血管理":        { bg:"rgba(239,68,68,0.12)",   border:"rgba(239,68,68,0.3)",   color:"#f87171" },
  "術後管理":              { bg:"rgba(99,102,241,0.12)",  border:"rgba(99,102,241,0.3)",  color:"#818cf8" },
};
const catStyle = (cat: string) => CAT_COLORS[cat] ?? { bg:"rgba(100,100,100,0.1)", border:"rgba(100,100,100,0.2)", color:"#9ca3af" };

const s = { bg:"#0d1526", card:"#111f36", border:"rgba(255,255,255,0.07)", text:"#e2eaf4", sub:"#4a7fa5" };

// ─── UserRow ─────────────────────────────────────────
function UserRow({ user }: { user: any }) {
  const [newPw, setNewPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleChangePw() {
    if (newPw.length < 6) { setMsg("6文字以上必要です"); return; }
    setLoading(true);
    try {
      await adminChangePassword(user.uid, newPw);
      setMsg("✓ 変更しました");
      setNewPw(""); setShowPw(false);
    } catch (err: any) { setMsg("エラー: " + err.message); }
    setLoading(false);
  }

  return (
    <div style={{ background:"#0d1f38", border:`1px solid ${s.border}`, borderRadius:10, padding:"10px 14px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <span style={{ fontSize:13, color:"#b8cfe0" }}>{user.username}</span>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          <span style={{ fontSize:11, padding:"2px 8px", borderRadius:10,
            background: user.role==="admin" ? "rgba(251,191,36,0.15)" : "rgba(100,100,100,0.2)",
            color: user.role==="admin" ? "#fbbf24" : "#94b4cc" }}>{user.role}</span>
          <button onClick={() => { setShowPw(!showPw); setMsg(""); }}
            style={{ fontSize:11, padding:"2px 8px", borderRadius:6, border:"1px solid rgba(14,165,233,0.3)", background:"rgba(14,165,233,0.1)", color:"#38bdf8", cursor:"pointer" }}>
            PW変更
          </button>
        </div>
      </div>
      {showPw && (
        <div style={{ marginTop:8, display:"flex", gap:8 }}>
          <input type="password" placeholder="新しいパスワード" value={newPw} onChange={e => setNewPw(e.target.value)}
            style={{ flex:1, background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, padding:"8px 10px", color:s.text, fontSize:13, outline:"none" }}/>
          <button onClick={handleChangePw} disabled={loading}
            style={{ padding:"8px 12px", borderRadius:8, border:"none", background:"#0ea5e9", color:"#fff", fontSize:13, cursor:"pointer", opacity:loading?0.7:1 }}>
            {loading ? "..." : "変更"}
          </button>
        </div>
      )}
      {msg && <div style={{ fontSize:12, color: msg.startsWith("✓") ? "#34d399" : "#f87171", marginTop:4 }}>{msg}</div>}
    </div>
  );
}

// ─── AdminPanel ──────────────────────────────────────
const DOMAIN = 'periop-quiz.app';

function AdminPanel({ onClose }: { onClose: () => void }) {
  const [users, setUsers] = useState<any[]>([]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("user");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    getUsers().then(setUsers);
  }, [msg]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setMsg("");
    try {
      const { initializeApp, getApps } = await import('firebase/app');
      const { getAuth, createUserWithEmailAndPassword, signOut: fbSignOut } = await import('firebase/auth');
      const { getFirestore, doc, setDoc } = await import('firebase/firestore');
      const config = (await import('@/lib/firebase')).default.options;
      const secondary = getApps().find(a => a.name === 'secondary') ?? initializeApp(config, 'secondary');
      const secAuth = getAuth(secondary);
      const secDb = getFirestore(secondary);
      const email = `${username}@${DOMAIN}`;
      const cred = await createUserWithEmailAndPassword(secAuth, email, password);
      await setDoc(doc(secDb, 'users', cred.user.uid), { username, email, role, createdAt: new Date() });
      await fbSignOut(secAuth);
      setMsg("✓ ユーザーを追加しました");
      setUsername(""); setPassword("");
    } catch (err: any) { setMsg("エラー: " + err.message); }
    setLoading(false);
  }

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000 }}>
      <div style={{ background:s.card, borderRadius:16, padding:24, width:"90%", maxWidth:400, border:`1px solid ${s.border}`, maxHeight:"80vh", overflowY:"auto" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
          <span style={{ fontWeight:700, color:s.text }}>ユーザー管理</span>
          <button onClick={onClose} style={{ background:"none", border:"none", color:s.sub, fontSize:20, cursor:"pointer" }}>×</button>
        </div>
        <form onSubmit={handleAdd} style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:16 }}>
          <input type="text" required placeholder="ユーザー名" value={username} onChange={e => setUsername(e.target.value)}
            style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, padding:"10px 12px", color:s.text, fontSize:14, outline:"none" }}/>
          <input type="password" required placeholder="パスワード（6文字以上）" value={password} onChange={e => setPassword(e.target.value)}
            style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, padding:"10px 12px", color:s.text, fontSize:14, outline:"none" }}/>
          <select value={role} onChange={e => setRole(e.target.value)}
            style={{ background:"#0d1f38", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, padding:"10px 12px", color:s.text, fontSize:14, outline:"none" }}>
            <option value="user">user</option>
            <option value="admin">admin</option>
          </select>
          {msg && <div style={{ fontSize:13, color: msg.startsWith("✓") ? "#34d399" : "#f87171" }}>{msg}</div>}
          <button type="submit" disabled={loading}
            style={{ padding:"10px", borderRadius:8, border:"none", background:"linear-gradient(135deg,#0ea5e9,#00b4a0)", color:"#fff", fontSize:14, fontWeight:700, cursor:"pointer", opacity:loading?0.7:1 }}>
            {loading ? "追加中..." : "ユーザーを追加"}
          </button>
        </form>
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {users.map((u: any) => <UserRow key={u.uid} user={u} />)}
        </div>
      </div>
    </div>
  );
}

// ─── メインコンポーネント ─────────────────────────────
export default function QuizPage() {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState<Phase>("home");
  const [question, setQuestion] = useState<Question | null>(null);
  const [selected, setSelected] = useState<ChoiceKey[]>([]);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [excludeIds, setExcludeIds] = useState<string[]>([]);
  const [cycleComplete, setCycleComplete] = useState(false);
  const [years, setYears] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedYears, setSelectedYears] = useState<string[]>([]);
  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [reviewQueue, setReviewQueue] = useState<any>(null);
  const [showAdmin, setShowAdmin] = useState(false);
  const [examYear, setExamYear] = useState<string>("");
  const [examQuestions, setExamQuestions] = useState<Question[]>([]);
  const [examIndex, setExamIndex] = useState(0);
  const [examAnswers, setExamAnswers] = useState<{questionId:string; qnum:number; selected:string; answer:string; correct:boolean}[]>([]);
  const [examResult, setExamResult] = useState<any>(null);
  const [examHistory, setExamHistory] = useState<any[]>([]);
  const [showExamWarning, setShowExamWarning] = useState(false);
  const [examBaseYear, setExamBaseYear] = useState<string>("");
  const [examPart, setExamPart] = useState<"a"|"b">("a");
  const [examStartTime, setExamStartTime] = useState<number>(0);
  const [examPartACount, setExamPartACount] = useState<number>(0);
  const [bgmEnabled, setBgmEnabled] = useState(false);
  const [bgmTrack, setBgmTrack] = useState<"1"|"2"|"3">("1");
  const bgmRef = useRef<HTMLAudioElement | null>(null);
  const loadingRef = useRef(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted) return;
    const unsub = onAuthStateChanged(auth, async (u) => {
      setAuthLoading(false);
      if (!u) { window.location.replace("/login"); return; }
      setUser(u);
      const profile = await getUserProfile(u.uid);
      setUserProfile(profile);
    });
    return unsub;
  }, [mounted]);

  useEffect(() => {
    if (!user) return;
    getYears().then(setYears);
    getCategories().then(setCategories);
  }, [user]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    sfxEnabled = bgmEnabled;
    if (bgmEnabled) {
      if (!bgmRef.current || bgmRef.current.src !== window.location.origin + `/sounds/bgm${bgmTrack}.mp3`) {
        if (bgmRef.current) { bgmRef.current.pause(); bgmRef.current = null; }
        const a = new Audio(`/sounds/bgm${bgmTrack}.mp3`);
        a.loop = true; a.volume = 0.3;
        a.play().catch(() => {});
        bgmRef.current = a;
      }
    } else {
      if (bgmRef.current) { bgmRef.current.pause(); bgmRef.current = null; }
    }
  }, [bgmEnabled, bgmTrack]);

  const loadQuestion = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setPhase("loading");
    try {
      const res = await getNextQuestion(selectedYears, selectedCats, excludeIds);
      if (!res.question) { setPhase("empty"); return; }
      setQuestion(res.question);
      setCycleComplete(res.cycleComplete ?? false);
      setSelected([]); setIsCorrect(null); setShowExplanation(false);
      setPhase("question");
    } finally { loadingRef.current = false; }
  }, [selectedYears, selectedCats, excludeIds]);

  async function startQuiz() {
    setExcludeIds([]); setCycleComplete(false);
    await loadQuestion();
  }

async function startExam(baseYear: string) {
  setPhase("loading");
  setExamBaseYear(baseYear);
  setExamPart("a");
  setExamAnswers([]);
  setExamIndex(0);
  setExamPartACount(0);
  setExamStartTime(Date.now());
  const qs = await getQuestionsForYear(`${baseYear}a`);
  setExamQuestions(qs);
  setQuestion(qs[0]);
  setSelected([]);
  setIsCorrect(null);
  setShowExplanation(false);
  setPhase("exam_question");
}

async function handleExamAnswer(key: ChoiceKey) {
  if (!examQuestions[examIndex]) return;
  const q = examQuestions[examIndex];
  const isX2 = q.answer.length === 2;

  if (isX2) {
    const next = selected.includes(key)
      ? selected.filter(k => k !== key)
      : [...selected, key];
    setSelected(next);
    if (next.length === 2) {
      const normalize = (s: string) => s.split("").sort().join("");
      const correct = normalize(next.join("")) === normalize(q.answer);
      setIsCorrect(correct);
      setExamAnswers(prev => [...prev, { questionId: q.id, qnum: q.qnum, selected: next.join(""), answer: q.answer, correct }]);
      playSound(correct ? "correct" : "incorrect");
      setPhase("exam_answered");
    }
  } else {
    const normalize = (s: string) => s.split("").sort().join("");
    const correct = normalize(key) === normalize(q.answer);
    setIsCorrect(correct);
    setSelected([key]);
    setExamAnswers(prev => [...prev, { questionId: q.id, qnum: q.qnum, selected: key, answer: q.answer, correct }]);
    playSound(correct ? "correct" : "incorrect");
    setPhase("exam_answered");
  }
}

async function nextExamQuestion() {
  if (loadingRef.current) return;
  loadingRef.current = true;
  const next = examIndex + 1;
  if (next >= examQuestions.length) {
    if (examPart === "a") {
      setExamPartACount(examQuestions.length);
      setPhase("exam_transition");
    } else {
      if (!user) { loadingRef.current = false; return; }
      const elapsed = Math.floor((Date.now() - examStartTime) / 1000);
      const correct = examAnswers.filter(a => a.correct).length;
      const result = {
        year: examBaseYear,
        totalQuestions: examAnswers.length,
        correctAnswers: correct,
        score: Math.round((correct / examAnswers.length) * 100),
        elapsedSeconds: elapsed,
        answers: examAnswers,
      };
      await saveExamResult(user.uid, result);
      setExamResult(result);
      setPhase("exam_result");
    }
  } else {
    setExamIndex(next);
    setQuestion(examQuestions[next]);
    setSelected([]);
    setIsCorrect(null);
    setShowExplanation(false);
    setPhase("exam_question");
  }
  loadingRef.current = false;
}

async function startPartB() {
  setPhase("loading");
  setExamPart("b");
  setExamIndex(0);
  const qs = await getQuestionsForYear(`${examBaseYear}b`);
  setExamQuestions(qs);
  setQuestion(qs[0]);
  setSelected([]);
  setIsCorrect(null);
  setShowExplanation(false);
  setPhase("exam_question");
}

async function handleShowExamHistory() {
  if (!user) return;
  setPhase("loading");
  try {
    const history = await getExamHistory(user.uid);
    console.log('examHistory取得件数:', history.length, history);
    setExamHistory(history);
    setPhase("exam_history");
  } catch (err) {
    console.error('examHistory取得エラー:', err);
    setExamHistory([]);
    setPhase("exam_history");
  }
}

  async function startReview() {
    if (!user) return;
    setPhase("loading");
    const queue = await getReviewQueue(user.uid);
    setReviewQueue(queue);
    setPhase("review_list");
  }

  async function handleAnswer(key: ChoiceKey) {
  if (phase !== "question" || !question) return;
  const isX2 = question.answer.length === 2;

  if (isX2) {
    const next = selected.includes(key)
      ? selected.filter(k => k !== key)
      : [...selected, key];
    setSelected(next);
    if (next.length === 2) {
      setPhase("answered");
      const normalize = (s: string) => s.split("").sort().join("");
      const correct = normalize(next.join("")) === normalize(question.answer);
      setIsCorrect(correct);
      setExcludeIds(prev => [...prev, question.id]);
      playSound(correct ? "correct" : "incorrect");
    }
  } else {
    setSelected([key]);
    setPhase("answered");
    const normalize = (s: string) => s.split("").sort().join("");
    const correct = normalize(key) === normalize(question.answer);
    setIsCorrect(correct);
    setExcludeIds(prev => [...prev, question.id]);
    playSound(correct ? "correct" : "incorrect");
  }
}

  async function handleRating(rating: SrsRating) {
    if (!question || !user || !selected) return;
    await saveAttempt(user.uid, question.id, selected.join(""), question.answer, rating);
    await loadQuestion();
  }

  async function handleShowStats() {
    if (!user) return;
    setPhase("loading");
    const s = await getStats(user.uid);
    setStats(s);
    setPhase("stats");
  }

  if (!mounted || authLoading) return null;

  return (
    <div style={{ minHeight:"100vh", background:s.bg, color:s.text, fontFamily:"'Hiragino Kaku Gothic ProN','Yu Gothic',sans-serif", maxWidth:430, margin:"0 auto" }}>

      {showAdmin && <AdminPanel onClose={() => setShowAdmin(false)} />}

      {/* ホーム画面 */}
      {phase === "home" && (
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", padding:"48px 24px 32px" }}>
          <h1 style={{ fontSize:24, fontWeight:700, color:s.text, margin:0 }}>周術期クイズ</h1>
          <p style={{ color:s.sub, fontSize:14, margin:"8px 0 40px" }}>{userProfile?.username}</p>

          <div style={{ width:"100%", display:"flex", flexDirection:"column", gap:12 }}>
            <button onClick={startQuiz}
              style={{ width:"100%", padding:"18px", borderRadius:14, border:"none", background:"linear-gradient(135deg,#0ea5e9,#00b4a0)", color:"#fff", fontSize:16, fontWeight:700, cursor:"pointer" }}>
              クイズ
            </button>
<button onClick={() => setPhase("exam_select")}
  style={{ width:"100%", padding:"18px", borderRadius:14, border:"1px solid rgba(99,102,241,0.4)", background:"rgba(99,102,241,0.1)", color:"#818cf8", fontSize:16, fontWeight:700, cursor:"pointer" }}>
  📝 試験モード
</button>
<button onClick={handleShowExamHistory}
  style={{ width:"100%", padding:"18px", borderRadius:14, border:`1px solid ${s.border}`, background:s.card, color:s.text, fontSize:16, fontWeight:600, cursor:"pointer" }}>
  📋 試験履歴
</button>
            <button onClick={startReview}
              style={{ width:"100%", padding:"18px", borderRadius:14, border:"1px solid rgba(251,146,60,0.4)", background:"rgba(251,146,60,0.1)", color:"#fb923c", fontSize:16, fontWeight:700, cursor:"pointer" }}>
              🔥 復習モード
            </button>
            <button onClick={handleShowStats}
              style={{ width:"100%", padding:"18px", borderRadius:14, border:`1px solid ${s.border}`, background:s.card, color:s.text, fontSize:16, fontWeight:600, cursor:"pointer" }}>
              📊 成績確認
            </button>
            <button onClick={() => setPhase("settings")}
              style={{ width:"100%", padding:"18px", borderRadius:14, border:`1px solid ${s.border}`, background:s.card, color:s.text, fontSize:16, fontWeight:600, cursor:"pointer" }}>
              ⚙️ 設定
            </button>
            {userProfile?.role === "admin" && (
              <button onClick={() => setShowAdmin(true)}
                style={{ width:"100%", padding:"18px", borderRadius:14, border:`1px solid ${s.border}`, background:s.card, color:s.text, fontSize:16, fontWeight:600, cursor:"pointer" }}>
                🔧 管理者パネル
              </button>
            )}
            <button onClick={() => logout().then(() => window.location.replace("/login"))}
              style={{ width:"100%", padding:"14px", borderRadius:14, border:"none", background:"none", color:s.sub, fontSize:14, cursor:"pointer" }}>
              ログアウト
            </button>
          </div>
        </div>
      )}

      {/* ローディング */}
      {phase === "loading" && (
        <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh" }}>
          <div style={{ color:s.sub }}>読み込み中...</div>
        </div>
      )}

      {/* 問題なし */}
      {phase === "empty" && (
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100vh", gap:16 }}>
          <div style={{ color:s.sub }}>問題が見つかりません</div>
          <button onClick={() => setPhase("home")} style={{ padding:"10px 24px", borderRadius:10, border:`1px solid ${s.border}`, background:s.card, color:s.text, cursor:"pointer" }}>ホームに戻る</button>
        </div>
      )}

      {/* クイズ画面 */}
      {(phase === "question" || phase === "answered") && question && (
        <div style={{ padding:16 }}>
          {/* 上部ナビ */}
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
            <button onClick={() => setPhase("home")} style={{ background:"rgba(255,255,255,0.05)", border:`1px solid ${s.border}`, borderRadius:10, padding:"8px 16px", color:s.text, fontSize:14, cursor:"pointer" }}>← ホーム</button>
            {cycleComplete && <span style={{ fontSize:12, color:"#fbbf24" }}>🎉 全問完了</span>}
          </div>

          <div style={{ background:s.card, borderRadius:16, padding:20, border:`1px solid ${s.border}` }}>
            <div style={{ display:"flex", gap:8, marginBottom:12, flexWrap:"wrap" }}>
              <span style={{ fontSize:11, padding:"3px 8px", borderRadius:6, ...catStyle(question.category) }}>{question.category}</span>
              <span style={{ fontSize:11, padding:"3px 8px", borderRadius:6, background:"rgba(255,255,255,0.05)", color:s.sub }}>{question.year} Q{question.qnum}</span>
            </div>

            <p style={{ fontSize:15, lineHeight:1.7, marginBottom:16 }}>{question.stem}</p>
{question.subitems && (
  <div style={{ background:"rgba(255,255,255,0.03)", borderRadius:8, padding:"10px 14px", marginBottom:12 }}>
    {Object.entries(question.subitems).map(([k, v]) => (
      <div key={k} style={{ fontSize:13, lineHeight:1.7, color:"#b8cfe0" }}>
        （{k}）{v}
      </div>
    ))}
  </div>
)}

            {question.is_image_question && question.main_image && (
              <img src={`/quiz-images/${question.year}/${question.main_image}`} alt="問題画像" style={{ maxWidth:"100%", borderRadius:8, marginBottom:12 }} />
            )}

{question.answer.length === 2 && phase === "question" && (
  <div style={{ fontSize:12, color:"#fbbf24", marginBottom:8 }}>
    ※ 2つ選んでください（{selected.length}/2）
  </div>
)}
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {CHOICE_KEYS.map(key => {
                const choiceText = question.choices[key];
                if (!choiceText) return null;
                const isAnswer = question.answer.includes(key);
                const isSelected = selected.includes(key);
                let bg = "rgba(255,255,255,0.03)";
let border = "rgba(255,255,255,0.08)";
let color = s.text;
if (phase === "question" && isSelected) {
  bg="rgba(14,165,233,0.15)"; border="rgba(14,165,233,0.4)"; color="#38bdf8";
}
if (phase === "answered") {
  if (isAnswer) { bg="rgba(16,185,129,0.15)"; border="rgba(16,185,129,0.4)"; color="#34d399"; }
  else if (isSelected) { bg="rgba(239,68,68,0.15)"; border="rgba(239,68,68,0.4)"; color="#f87171"; }
}
                return (
                  <button key={key} onClick={() => handleAnswer(key)} disabled={phase==="answered"}
                    style={{ background:bg, border:`1px solid ${border}`, borderRadius:10, padding:"12px 14px", color, fontSize:14, textAlign:"left", cursor:phase==="answered"?"default":"pointer", display:"flex", gap:10 }}>
                    <span style={{ fontWeight:700, minWidth:18 }}>{key.toUpperCase()}.</span>
                    <span>{choiceText}</span>
                  </button>
                );
              })}
            </div>

            {phase === "answered" && (
              <div style={{ marginTop:16 }}>
                <div style={{ fontSize:18, fontWeight:700, color:isCorrect?"#34d399":"#f87171", marginBottom:12 }}>
                  {isCorrect ? "✓ 正解" : "✗ 不正解"}
                </div>

                {question.explanation && (
  <>
    <button onClick={() => setShowExplanation(true)}
      style={{ background:"rgba(14,165,233,0.1)", border:"1px solid rgba(14,165,233,0.2)", borderRadius:8, padding:"6px 12px", color:"#38bdf8", fontSize:13, cursor:"pointer", marginBottom:12 }}>
      解説を見る
    </button>
    {showExplanation && (
      <div onClick={() => setShowExplanation(false)}
        style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", display:"flex", alignItems:"flex-end", justifyContent:"center", zIndex:500, padding:"0 0 0 0" }}>
        <div onClick={e => e.stopPropagation()}
          style={{ background:s.card, borderRadius:"20px 20px 0 0", padding:24, width:"100%", maxWidth:430, maxHeight:"70vh", overflowY:"auto", border:`1px solid ${s.border}` }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
            <span style={{ fontWeight:600, fontSize:15 }}>解説</span>
            <button onClick={() => setShowExplanation(false)}
              style={{ background:"none", border:"none", color:s.sub, fontSize:22, cursor:"pointer", lineHeight:1 }}>×</button>
          </div>
          <div style={{ fontSize:13, lineHeight:1.8, whiteSpace:"pre-wrap", color:s.text }}>
            {question.explanation}
          </div>
        </div>
      </div>
    )}
  </>
)}

                <div style={{ textAlign:"center", marginBottom:8 }}>
                  <button onClick={() => setPhase("summary")}
                    style={{ background:"transparent", border:"1px solid rgba(255,255,255,0.15)", borderRadius:10, padding:"10px 24px", color:s.sub, fontSize:13, cursor:"pointer" }}>
                    今日はここまで
                  </button>
                </div>

                <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                  {SRS_OPTIONS.map(opt => (
                    <button key={opt.key} onClick={() => handleRating(opt.key)}
                      style={{ flex:1, minWidth:70, background:opt.bg, border:`1px solid ${opt.border}`, borderRadius:10, padding:"10px 8px", color:opt.color, fontSize:13, fontWeight:600, cursor:"pointer" }}>
                      <div>{opt.label}</div>
                      <div style={{ fontSize:10, opacity:0.7 }}>{opt.sub}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* サマリー */}
      {phase === "summary" && (
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100vh", gap:16, padding:24 }}>
          <div style={{ fontSize:48 }}>🎉</div>
          <div style={{ fontSize:20, fontWeight:700 }}>お疲れさまでした</div>
          <button onClick={() => setPhase("home")}
            style={{ padding:"14px 32px", borderRadius:12, border:"none", background:"linear-gradient(135deg,#0ea5e9,#00b4a0)", color:"#fff", fontSize:16, fontWeight:700, cursor:"pointer" }}>
            ホームに戻る
          </button>
        </div>
      )}

{/* 年度選択 */}
{phase === "exam_select" && (
  <div style={{ padding:24 }}>
    <div style={{ display:"flex", alignItems:"center", marginBottom:24 }}>
      <button onClick={() => setPhase("home")} style={{ background:"rgba(255,255,255,0.05)", border:`1px solid ${s.border}`, borderRadius:10, padding:"8px 16px", color:s.text, fontSize:14, cursor:"pointer" }}>← ホーム</button>
      <span style={{ fontWeight:600, marginLeft:12 }}>試験モード - 年度選択</span>
    </div>
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
      {[...new Set(years.map(y => y.replace(/[ab]$/, '')))].map(y => (
  <button key={y} onClick={() => startExam(y)}
    style={{ width:"100%", padding:"18px", borderRadius:14, border:"1px solid rgba(99,102,241,0.4)", background:"rgba(99,102,241,0.1)", color:"#818cf8", fontSize:16, fontWeight:700, cursor:"pointer" }}>
    {y}年度
  </button>
))}
    </div>
  </div>
)}

{/* 試験問題 */}
{(phase === "exam_question" || phase === "exam_answered") && question && (
  <div style={{ padding:16 }}>
    {showExamWarning && (
      <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000 }}>
        <div style={{ background:s.card, borderRadius:16, padding:24, width:"80%", maxWidth:320, border:`1px solid ${s.border}` }}>
          <div style={{ fontWeight:600, marginBottom:12 }}>試験を終了しますか？</div>
          <div style={{ fontSize:13, color:s.sub, marginBottom:20 }}>進捗は保存されません。</div>
          <div style={{ display:"flex", gap:12 }}>
            <button onClick={() => setShowExamWarning(false)}
              style={{ flex:1, padding:"10px", borderRadius:10, border:`1px solid ${s.border}`, background:"none", color:s.text, cursor:"pointer" }}>
              続ける
            </button>
            <button onClick={() => { setShowExamWarning(false); setPhase("home"); }}
              style={{ flex:1, padding:"10px", borderRadius:10, border:"none", background:"rgba(239,68,68,0.2)", color:"#f87171", cursor:"pointer" }}>
              終了する
            </button>
          </div>
        </div>
      </div>
    )}

    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
      <button onClick={() => setShowExamWarning(true)}
        style={{ background:"rgba(255,255,255,0.05)", border:`1px solid ${s.border}`, borderRadius:10, padding:"8px 16px", color:s.text, fontSize:14, cursor:"pointer" }}>← ホーム</button>
      <span style={{ fontSize:13, color:s.sub }}>
  {examBaseYear}年度 {examPart.toUpperCase()}問題 | {examIndex + 1}/{examQuestions.length}問
</span>
    </div>

    <div style={{ background:s.card, borderRadius:16, padding:20, border:`1px solid ${s.border}` }}>
      <div style={{ display:"flex", gap:8, marginBottom:12, flexWrap:"wrap" }}>
        <span style={{ fontSize:11, padding:"3px 8px", borderRadius:6, ...catStyle(question.category) }}>{question.category}</span>
        <span style={{ fontSize:11, padding:"3px 8px", borderRadius:6, background:"rgba(255,255,255,0.05)", color:s.sub }}>Q{question.qnum}</span>
      </div>

      <p style={{ fontSize:15, lineHeight:1.7, marginBottom:16 }}>{question.stem}</p>

      {question.subitems && (
        <div style={{ background:"rgba(255,255,255,0.03)", borderRadius:8, padding:"10px 14px", marginBottom:12 }}>
          {Object.entries(question.subitems).map(([k, v]) => (
            <div key={k} style={{ fontSize:13, lineHeight:1.7, color:"#b8cfe0" }}>（{k}）{v as string}</div>
          ))}
        </div>
      )}

      {question.is_image_question && question.main_image && (
        <img src={`/quiz-images/${question.year}/${question.main_image}`} alt="問題画像" style={{ maxWidth:"100%", borderRadius:8, marginBottom:12 }} />
      )}

      {question.answer.length === 2 && phase === "exam_question" && (
        <div style={{ fontSize:12, color:"#fbbf24", marginBottom:8 }}>※ 2つ選んでください（{selected.length}/2）</div>
      )}

      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {CHOICE_KEYS.map(key => {
          const choiceText = question.choices[key];
          if (!choiceText) return null;
          const isAnswer = question.answer.includes(key);
          const isSelected = selected.includes(key);
          let bg = "rgba(255,255,255,0.03)";
          let border = "rgba(255,255,255,0.08)";
          let color = s.text;
          if (phase === "exam_question" && isSelected) {
            bg="rgba(14,165,233,0.15)"; border="rgba(14,165,233,0.4)"; color="#38bdf8";
          }
          if (phase === "exam_answered") {
            if (isAnswer) { bg="rgba(16,185,129,0.15)"; border="rgba(16,185,129,0.4)"; color="#34d399"; }
            else if (isSelected) { bg="rgba(239,68,68,0.15)"; border="rgba(239,68,68,0.4)"; color="#f87171"; }
          }
          return (
            <button key={key} onClick={() => handleExamAnswer(key)} disabled={phase==="exam_answered"}
              style={{ background:bg, border:`1px solid ${border}`, borderRadius:10, padding:"12px 14px", color, fontSize:14, textAlign:"left", cursor:phase==="exam_answered"?"default":"pointer", display:"flex", gap:10 }}>
              <span style={{ fontWeight:700, minWidth:18 }}>{key.toUpperCase()}.</span>
              <span>{choiceText}</span>
            </button>
          );
        })}
      </div>

      {phase === "exam_answered" && (
        <div style={{ marginTop:16 }}>
          <div style={{ fontSize:18, fontWeight:700, color:isCorrect?"#34d399":"#f87171", marginBottom:12 }}>
            {isCorrect ? "✓ 正解" : "✗ 不正解"}
          </div>
          <button onClick={nextExamQuestion}
            style={{ width:"100%", padding:"14px", borderRadius:12, border:"none", background:"linear-gradient(135deg,#6366f1,#818cf8)", color:"#fff", fontSize:15, fontWeight:700, cursor:"pointer" }}>
            {examIndex + 1 >= examQuestions.length ? "結果を見る" : "次の問題 →"}
          </button>
        </div>
      )}
    </div>
  </div>
)}

{/* A問題終了 移行画面 */}
{phase === "exam_transition" && (
  <div style={{ padding:24, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", minHeight:"60vh" }}>
    <div style={{ fontSize:40, marginBottom:16 }}>✅</div>
    <div style={{ fontSize:20, fontWeight:700, marginBottom:8 }}>A問題終了</div>
    <div style={{ fontSize:14, color:s.sub, marginBottom:8 }}>
      {examPartACount}問中{examAnswers.filter(a => a.correct).length}問正解
    </div>
    <div style={{ fontSize:28, fontWeight:700, color:"#818cf8", marginBottom:32 }}>
      {Math.round((examAnswers.filter(a => a.correct).length / examPartACount) * 100)}%
    </div>
    <button onClick={startPartB}
      style={{ width:"100%", maxWidth:300, padding:"18px", borderRadius:14, border:"none", background:"linear-gradient(135deg,#6366f1,#818cf8)", color:"#fff", fontSize:16, fontWeight:700, cursor:"pointer" }}>
      B問題へ進む →
    </button>
  </div>
)}

{/* 試験結果 */}
{phase === "exam_result" && examResult && (
  <div style={{ padding:24 }}>
    <div style={{ textAlign:"center", marginBottom:24 }}>
      <div style={{ fontSize:48, marginBottom:8 }}>
        {examResult.score >= 80 ? "🎉" : examResult.score >= 60 ? "👍" : "📚"}
      </div>
      <div style={{ fontSize:20, fontWeight:700, marginBottom:4 }}>{examResult.year} 試験結果</div>
      <div style={{ fontSize:48, fontWeight:700, color: examResult.score >= 80 ? "#34d399" : examResult.score >= 60 ? "#fbbf24" : "#f87171" }}>
        {examResult.score}%
      </div>
      <div style={{ fontSize:14, color:s.sub, marginTop:4 }}>
        {examResult.correctAnswers} / {examResult.totalQuestions} 問正解
      </div>
<div style={{ fontSize:14, color:"#fbbf24", marginTop:4, fontWeight:600 }}>
  ⏱ 経過時間: {examResult.elapsedSeconds != null ? `${Math.floor(examResult.elapsedSeconds / 60)}分${examResult.elapsedSeconds % 60}秒` : "計測なし"}
</div>
    </div>

    <div style={{ background:s.card, border:`1px solid ${s.border}`, borderRadius:12, padding:16, marginBottom:16 }}>
      <div style={{ fontSize:13, fontWeight:600, marginBottom:12 }}>問題別結果</div>
      <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
        {examResult.answers.map((a: any) => (
          <div key={a.questionId} style={{ width:36, height:36, borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:600,
            background: a.correct ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)",
            color: a.correct ? "#34d399" : "#f87171",
            border: `1px solid ${a.correct ? "rgba(16,185,129,0.4)" : "rgba(239,68,68,0.4)"}` }}>
            {a.qnum}
          </div>
        ))}
      </div>
    </div>

    <div style={{ display:"flex", gap:12 }}>
      <button onClick={handleShowExamHistory}
        style={{ flex:1, padding:"14px", borderRadius:12, border:`1px solid ${s.border}`, background:s.card, color:s.text, fontSize:14, cursor:"pointer" }}>
        履歴を見る
      </button>
      <button onClick={() => setPhase("home")}
        style={{ flex:1, padding:"14px", borderRadius:12, border:"none", background:"linear-gradient(135deg,#0ea5e9,#00b4a0)", color:"#fff", fontSize:14, fontWeight:700, cursor:"pointer" }}>
        ホームへ
      </button>
    </div>
  </div>
)}

{/* 試験履歴 */}
{phase === "exam_history" && (
  <div style={{ padding:16 }}>
    <div style={{ display:"flex", alignItems:"center", marginBottom:16 }}>
      <button onClick={() => setPhase("home")} style={{ background:"rgba(255,255,255,0.05)", border:`1px solid ${s.border}`, borderRadius:10, padding:"8px 16px", color:s.text, fontSize:14, cursor:"pointer" }}>← ホーム</button>
      <span style={{ fontWeight:600, marginLeft:12 }}>試験履歴</span>
    </div>

    {examHistory.length === 0 ? (
      <div style={{ textAlign:"center", padding:40, color:s.sub }}>試験履歴がありません</div>
    ) : (
      <>
        {/* 年度別グラフ */}
        {[...new Set(years.map(y => y.replace(/[ab]$/, '')))].map(y => {
  const results = examHistory.filter((h: any) => h.year === y).reverse();
          if (results.length === 0) return null;
          const maxScore = 100;
          const w = 280; const h2 = 120;
          const pts = results.map((r: any, i: number) => ({
            x: results.length === 1 ? w/2 : (i / (results.length - 1)) * w,
            y: h2 - (r.score / maxScore) * h2,
            score: r.score,
          }));
          const polyline = pts.map(p => `${p.x},${p.y}`).join(" ");

          return (
            <div key={y} style={{ background:s.card, border:`1px solid ${s.border}`, borderRadius:12, padding:16, marginBottom:16 }}>
              <div style={{ fontSize:13, fontWeight:600, marginBottom:12 }}>{y}</div>
              <svg width="100%" viewBox={`0 0 ${w} ${h2+20}`} style={{ overflow:"visible" }}>
                {[0,25,50,75,100].map(v => (
                  <g key={v}>
                    <line x1={0} y1={h2-(v/100)*h2} x2={w} y2={h2-(v/100)*h2} stroke="rgba(255,255,255,0.05)" strokeWidth={1}/>
                    <text x={-4} y={h2-(v/100)*h2+4} fontSize={9} fill="#4a7fa5" textAnchor="end">{v}</text>
                  </g>
                ))}
                {results.length > 1 && <polyline points={polyline} fill="none" stroke="#6366f1" strokeWidth={2}/>}
                {pts.map((p, i) => (
                  <g key={i}>
                    <circle cx={p.x} cy={p.y} r={5} fill="#6366f1"/>
                    <text x={p.x} y={p.y-10} fontSize={10} fill="#818cf8" textAnchor="middle">{p.score}%</text>
                  </g>
                ))}
              </svg>
              <div style={{ display:"flex", flexDirection:"column", gap:6, marginTop:8 }}>
                {[...results].reverse().map((r: any, i: number) => (
                  <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:s.sub }}>
  <span>{r.date?.toDate?.()?.toLocaleDateString('ja-JP') ?? "-"}</span>
  <span style={{ color: r.score >= 80 ? "#34d399" : r.score >= 60 ? "#fbbf24" : "#f87171", fontWeight:600 }}>
    {r.score}%　{r.correctAnswers}/{r.totalQuestions}問
    {r.elapsedSeconds != null && ` / ${Math.floor(r.elapsedSeconds/60)}分${r.elapsedSeconds%60}秒`}
  </span>
</div>
                ))}
              </div>
            </div>
          );
        })}
      </>
    )}
  </div>
)}

      {/* 復習一覧 */}
      {phase === "review_list" && (
        <div style={{ padding:16 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
            <button onClick={() => setPhase("home")} style={{ background:"rgba(255,255,255,0.05)", border:`1px solid ${s.border}`, borderRadius:10, padding:"8px 16px", color:s.text, fontSize:14, cursor:"pointer" }}>← ホーム</button>
            <span style={{ fontWeight:600 }}>復習モード</span>
            <span style={{ fontSize:13, color:s.sub }}>{reviewQueue?.total ?? 0}件</span>
          </div>
{reviewQueue?.total > 0 && (
  <button onClick={async () => {
    if (!reviewQueue?.cards?.length) return;
    setPhase("loading");
    const reviewQ = reviewQueue.cards[0];
    const { getDoc, doc } = await import('firebase/firestore');
    const { db } = await import('@/lib/firebase');
    const qSnap = await getDoc(doc(db, 'questions', reviewQ.questionId));
    if (qSnap.exists()) {
      setQuestion({ id: qSnap.id, ...qSnap.data() } as any);
      setSelected([]); setIsCorrect(null); setShowExplanation(false);
      setPhase("question");
    }
  }} style={{ width:"100%", padding:"16px", borderRadius:12, border:"none", background:"linear-gradient(135deg,#fb923c,#f97316)", color:"#fff", fontSize:16, fontWeight:700, cursor:"pointer", marginBottom:16 }}>
    🔥 復習を開始（{reviewQueue.total}件）
  </button>
)}
          {reviewQueue?.total === 0 ? (
            <div style={{ textAlign:"center", padding:40, color:s.sub }}>
              <div style={{ fontSize:32, marginBottom:12 }}>✅</div>
              <div>復習待ちの問題はありません</div>
            </div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {reviewQueue?.cards.map((c: any) => (
                <div key={c.questionId} style={{ background:s.card, border:`1px solid ${s.border}`, borderRadius:10, padding:"12px 14px" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                    <span style={{ fontSize:12, color:s.sub }}>{c.year} Q{c.qnum}</span>
                    <span style={{ fontSize:11, ...catStyle(c.category), padding:"2px 6px", borderRadius:4 }}>{c.category}</span>
                  </div>
                  <div style={{ fontSize:13 }}>{c.stem}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 成績 */}
      {phase === "stats" && (
        <div style={{ padding:16 }}>
          <div style={{ display:"flex", alignItems:"center", marginBottom:16 }}>
            <button onClick={() => setPhase("home")} style={{ background:"rgba(255,255,255,0.05)", border:`1px solid ${s.border}`, borderRadius:10, padding:"8px 16px", color:s.text, fontSize:14, cursor:"pointer" }}>← ホーム</button>
            <span style={{ fontWeight:600, marginLeft:12 }}>成績確認</span>
          </div>
          {!stats ? <div style={{ textAlign:"center", padding:40, color:s.sub }}>読み込み中...</div> : (
            <>
              <div style={{ display:"flex", gap:12, marginBottom:16 }}>
                {[{ label:"総回答数", value:stats.total }, { label:"正答率", value:`${stats.rate}%` }, { label:"直近7日", value:stats.recentTotal }].map(item => (
                  <div key={item.label} style={{ flex:1, background:s.card, border:`1px solid ${s.border}`, borderRadius:12, padding:"14px 10px", textAlign:"center" }}>
                    <div style={{ fontSize:22, fontWeight:700 }}>{item.value}</div>
                    <div style={{ fontSize:11, color:s.sub, marginTop:4 }}>{item.label}</div>
                  </div>
                ))}
              </div>
              <div style={{ background:s.card, border:`1px solid ${s.border}`, borderRadius:12, padding:16 }}>
                <div style={{ fontSize:13, fontWeight:600, marginBottom:12 }}>カテゴリー別正答率（低い順）</div>
                {stats.categories.map((cat: any) => (
                  <div key={cat.name} style={{ marginBottom:10 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:4 }}>
                      <span style={{ color:catStyle(cat.name).color }}>{cat.name}</span>
                      <span>{cat.correct}/{cat.total} ({cat.rate}%)</span>
                    </div>
                    <div style={{ background:"rgba(255,255,255,0.05)", borderRadius:4, height:6 }}>
                      <div style={{ width:`${cat.rate}%`, height:"100%", borderRadius:4, background:catStyle(cat.name).color }} />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* 設定 */}
      {phase === "settings" && (
        <div style={{ padding:16 }}>
          <div style={{ display:"flex", alignItems:"center", marginBottom:16 }}>
            <button onClick={() => setPhase("home")} style={{ background:"rgba(255,255,255,0.05)", border:`1px solid ${s.border}`, borderRadius:10, padding:"8px 16px", color:s.text, fontSize:14, cursor:"pointer" }}>← ホーム</button>
            <span style={{ fontWeight:600, marginLeft:12 }}>設定</span>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            <div style={{ background:s.card, border:`1px solid ${s.border}`, borderRadius:12, padding:16 }}>
              <div style={{ fontSize:13, fontWeight:600, marginBottom:12 }}>BGM</div>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
                <span style={{ fontSize:14 }}>BGM {bgmEnabled ? "オン" : "オフ"}</span>
                <div onClick={() => setBgmEnabled(v => !v)} style={{ width:44, height:24, borderRadius:12, background:bgmEnabled?"#0ea5e9":"rgba(255,255,255,0.1)", cursor:"pointer", position:"relative", transition:"background 0.2s" }}>
                  <div style={{ position:"absolute", top:2, left:bgmEnabled?22:2, width:20, height:20, borderRadius:10, background:"#fff", transition:"left 0.2s" }}/>
                </div>
              </div>
              {bgmEnabled && (
                <div style={{ display:"flex", gap:8 }}>
                  {(["1","2","3"] as const).map(t => (
                    <button key={t} onClick={() => setBgmTrack(t)}
                      style={{ flex:1, padding:"8px 0", borderRadius:8, border:`1px solid ${bgmTrack===t?"#0ea5e9":"rgba(255,255,255,0.1)"}`, background:bgmTrack===t?"rgba(14,165,233,0.2)":"transparent", color:bgmTrack===t?"#38bdf8":s.sub, fontSize:13, cursor:"pointer" }}>
                      BGM {t}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div style={{ background:s.card, border:`1px solid ${s.border}`, borderRadius:12, padding:16 }}>
              <div style={{ fontSize:13, fontWeight:600, marginBottom:12 }}>年度フィルター</div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                {years.map(y => (
                  <button key={y} onClick={() => setSelectedYears(prev => prev.includes(y) ? prev.filter(x=>x!==y) : [...prev,y])}
                    style={{ padding:"6px 12px", borderRadius:8, border:"1px solid", fontSize:13, cursor:"pointer",
                      background: selectedYears.includes(y) ? "rgba(14,165,233,0.2)" : "rgba(255,255,255,0.03)",
                      borderColor: selectedYears.includes(y) ? "rgba(14,165,233,0.5)" : "rgba(255,255,255,0.1)",
                      color: selectedYears.includes(y) ? "#38bdf8" : s.sub }}>
                    {y}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ background:s.card, border:`1px solid ${s.border}`, borderRadius:12, padding:16 }}>
              <div style={{ fontSize:13, fontWeight:600, marginBottom:12 }}>カテゴリーフィルター</div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                {categories.map(c => (
                  <button key={c} onClick={() => setSelectedCats(prev => prev.includes(c) ? prev.filter(x=>x!==c) : [...prev,c])}
                    style={{ padding:"6px 12px", borderRadius:8, border:"1px solid", fontSize:12, cursor:"pointer",
                      background: selectedCats.includes(c) ? catStyle(c).bg : "rgba(255,255,255,0.03)",
                      borderColor: selectedCats.includes(c) ? catStyle(c).border : "rgba(255,255,255,0.1)",
                      color: selectedCats.includes(c) ? catStyle(c).color : s.sub }}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}