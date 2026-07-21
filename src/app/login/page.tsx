"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { loginWithUsername } from "@/lib/firebaseHelpers";

function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await loginWithUsername(username, password);
      const audio = new Audio("/sounds/entry.mp3");
      audio.play().catch(() => {});
      router.push("/quiz");
    } catch {
      setError("ユーザー名またはパスワードが違います");
    }
    setLoading(false);
  }

  if (!mounted) return null;

  return (
    <div style={{ minHeight:"100vh", background:"#0d1526", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Hiragino Kaku Gothic ProN','Yu Gothic',sans-serif", padding:"0 16px", boxSizing:"border-box" as const }}>
      <div style={{ background:"#111f36", borderRadius:20, padding:"32px 24px", width:"100%", maxWidth:400, border:"1px solid rgba(255,255,255,0.07)", boxSizing:"border-box" as const }}>
        <h1 style={{ color:"#e2eaf4", fontSize:22, fontWeight:700, marginBottom:6 }}>周術期クイズ</h1>
        <p style={{ color:"#4a7fa5", fontSize:13, marginBottom:32 }}>サインインしてください</p>
        <form onSubmit={handleSubmit} style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <input type="text" required placeholder="ユーザー名" value={username} onChange={(e) => setUsername(e.target.value)}
            style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, padding:"13px 16px", color:"#e2eaf4", fontSize:15, outline:"none", width:"100%", outline:"none", width:"100%", boxSizing:"border-box" as const }}/>
          <input type="password" required placeholder="パスワード" value={password} onChange={(e) => setPassword(e.target.value)}
            style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, padding:"13px 16px", color:"#e2eaf4", fontSize:15, outline:"none", width:"100%", outline:"none", width:"100%", boxSizing:"border-box" as const }}/>
          {error && <div style={{ color:"#f87171", fontSize:13 }}>{error}</div>}
          <button type="submit" disabled={loading}
            style={{ background:"linear-gradient(135deg,#0ea5e9,#00b4a0)", border:"none", borderRadius:10, padding:"14px", color:"#fff", fontSize:15, fontWeight:700, cursor:"pointer", opacity:loading?0.7:1, cursor:"pointer", opacity:loading?0.7:1, boxSizing:"border-box" as const }}>
            {loading ? "ログイン中..." : "ログイン"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return <LoginForm />;
}