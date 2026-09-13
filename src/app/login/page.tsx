"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { loginWithUsername } from "@/lib/firebaseHelpers";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";

function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(true);

  useEffect(() => onAuthStateChanged(auth, (user) => {
    if (user) router.replace("/quiz");
    else setChecking(false);
  }, () => {
    setChecking(false);
    setError("ログイン状態を確認できませんでした。通信状態を確認してログインしてください。");
  }), [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await loginWithUsername(username, password);
      const audio = new Audio("/sounds/entry.mp3");
      audio.play().catch(() => {});
      // onAuthStateChanged also handles newly signed-in users.
    } catch {
      setError("ユーザー名またはパスワードが違います");
    }
    setLoading(false);
  }

  if (checking) return <p role="status" style={{ color: "#e2eaf4", textAlign: "center", padding: "40px 16px" }}>ログイン状態を確認しています…</p>;

  return (
    <div style={{ minHeight:"100vh", background:"#0d1526", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Hiragino Kaku Gothic ProN','Yu Gothic',sans-serif", padding:"0 16px", boxSizing:"border-box" as const }}>
      <div style={{ background:"#111f36", borderRadius:20, padding:"32px 24px", width:"100%", maxWidth:400, border:"1px solid rgba(255,255,255,0.07)", boxSizing:"border-box" as const }}>
        <h1 style={{ color:"#e2eaf4", fontSize:22, fontWeight:700, marginBottom:6 }}>周術期クイズ</h1>
        <p style={{ color:"#4a7fa5", fontSize:13, marginBottom:32 }}>サインインしてください</p>
        <form onSubmit={handleSubmit} style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <input type="text" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} required placeholder="ユーザー名" value={username} onChange={(e) => setUsername(e.target.value)}
            style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, padding:"13px 16px", color:"#e2eaf4", fontSize:15, outline:"none", width:"100%", boxSizing:"border-box" as const }}/>
          <input type="password" name="password" autoComplete="current-password" required placeholder="パスワード" value={password} onChange={(e) => setPassword(e.target.value)}
            style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, padding:"13px 16px", color:"#e2eaf4", fontSize:15, outline:"none", width:"100%", boxSizing:"border-box" as const }}/>
          {error && <div style={{ color:"#f87171", fontSize:13 }}>{error}</div>}
          <button type="submit" disabled={loading}
            style={{ background:"linear-gradient(135deg,#0ea5e9,#00b4a0)", border:"none", borderRadius:10, padding:"14px", color:"#fff", fontSize:15, fontWeight:700, cursor:"pointer", opacity:loading?0.7:1, boxSizing:"border-box" as const }}>
            {loading ? "ログイン中..." : "ログイン"}
          </button>
        </form>
        <p style={{ color:"#89a6be", fontSize:12, lineHeight:1.7, marginTop:20, marginBottom:0 }}>次回からはログイン状態を確認して自動でホームへ進みます。共用端末では使い終わったらログアウトしてください。</p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return <LoginForm />;
}
