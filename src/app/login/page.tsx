"use client";
import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    if (res?.ok) {
      router.push("/quiz");
    } else {
      setError("メールアドレスまたはパスワードが違います");
    }
    setLoading(false);
  }

  return (
    <div style={{ minHeight:"100vh", background:"#0d1526", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Hiragino Kaku Gothic ProN','Yu Gothic',sans-serif" }}>
      <div style={{ background:"#111f36", borderRadius:20, padding:"40px 36px", width:"100%", maxWidth:380, border:"1px solid rgba(255,255,255,0.07)" }}>
        <h1 style={{ color:"#e2eaf4", fontSize:22, fontWeight:700, marginBottom:6 }}>麻酔科クイズ</h1>
        <p style={{ color:"#4a7fa5", fontSize:13, marginBottom:32 }}>サインインしてください</p>
        <form onSubmit={handleSubmit} style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <input type="email" required placeholder="メールアドレス" value={email} onChange={(e) => setEmail(e.target.value)}
            style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, padding:"13px 16px", color:"#e2eaf4", fontSize:15, outline:"none", width:"100%" }}/>
          <input type="password" required placeholder="パスワード" value={password} onChange={(e) => setPassword(e.target.value)}
            style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, padding:"13px 16px", color:"#e2eaf4", fontSize:15, outline:"none", width:"100%" }}/>
          {error && <div style={{ color:"#f87171", fontSize:13 }}>{error}</div>}
          <button type="submit" disabled={loading}
            style={{ background:"linear-gradient(135deg,#0ea5e9,#00b4a0)", border:"none", borderRadius:10, padding:"14px", color:"#fff", fontSize:15, fontWeight:700, cursor:"pointer", opacity:loading?0.7:1 }}>
            {loading ? "ログイン中..." : "ログイン"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}