import { useState, useEffect } from "react";
import {
  adminCreateUser,
  adminChangePassword,
  getUsers,
} from "@/lib/firebaseHelpers";
import { s } from "./theme";

function UserRow({ user }: { user: any }) {
  const [newPw, setNewPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleChangePw() {
    if (newPw.length < 6) {
      setMsg("6文字以上必要です");
      return;
    }
    setLoading(true);
    try {
      await adminChangePassword(user.uid, newPw);
      setMsg("✓ 変更しました");
      setNewPw("");
      setShowPw(false);
    } catch (err: any) {
      setMsg("エラー: " + err.message);
    }
    setLoading(false);
  }

  return (
    <div
      style={{
        background: "#0d1f38",
        border: `1px solid ${s.border}`,
        borderRadius: 10,
        padding: "10px 14px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span style={{ fontSize: 13, color: "#b8cfe0" }}>{user.username}</span>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span
            style={{
              fontSize: 11,
              padding: "2px 8px",
              borderRadius: 10,
              background:
                user.role === "admin"
                  ? "rgba(251,191,36,0.15)"
                  : "rgba(100,100,100,0.2)",
              color: user.role === "admin" ? "#fbbf24" : "#94b4cc",
            }}
          >
            {user.role}
          </span>
          <button
            onClick={() => {
              setShowPw(!showPw);
              setMsg("");
            }}
            style={{
              fontSize: 11,
              padding: "2px 8px",
              borderRadius: 6,
              border: "1px solid rgba(14,165,233,0.3)",
              background: "rgba(14,165,233,0.1)",
              color: "#38bdf8",
              cursor: "pointer",
            }}
          >
            PW変更
          </button>
        </div>
      </div>
      {showPw && (
        <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
          <input
            type="password"
            placeholder="新しいパスワード"
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
            style={{
              flex: 1,
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8,
              padding: "8px 10px",
              color: s.text,
              fontSize: 13,
              outline: "none",
            }}
          />
          <button
            onClick={handleChangePw}
            disabled={loading}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "none",
              background: "#0ea5e9",
              color: "#fff",
              fontSize: 13,
              cursor: "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "..." : "変更"}
          </button>
        </div>
      )}
      {msg && (
        <div
          style={{
            fontSize: 12,
            color: msg.startsWith("✓") ? "#34d399" : "#f87171",
            marginTop: 4,
          }}
        >
          {msg}
        </div>
      )}
    </div>
  );
}

// ─── AdminPanel ──────────────────────────────────────
const DOMAIN = "periop-quiz.app";

export function AdminPanel({ onClose }: { onClose: () => void }) {
  const [users, setUsers] = useState<any[]>([]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    getUsers().then(setUsers);
  }, [msg]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg("");
    try {
      // ⚠️ **ブラウザから作らない。** 以前は別インスタンスを立てて
      //    `createUserWithEmailAndPassword` を呼んでいたが、その方式では
      //    サインアップを開けておくしかなく、誰でもアカウントを作れてしまう。
      //    作成は Functions（Admin SDK）へ移し、サインアップ自体を閉じた。
      await adminCreateUser(username, password, "user");
      setMsg("✓ ユーザーを追加しました");
      setUsername("");
      setPassword("");
    } catch (err: any) {
      setMsg("エラー: " + (err?.message || err));
    }
    setLoading(false);
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
    >
      <div
        style={{
          background: s.card,
          borderRadius: 16,
          padding: 24,
          width: "90%",
          maxWidth: 400,
          border: `1px solid ${s.border}`,
          maxHeight: "80vh",
          overflowY: "auto",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <span style={{ fontWeight: 700, color: s.text }}>ユーザー管理</span>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: s.sub,
              fontSize: 20,
              cursor: "pointer",
            }}
          >
            ×
          </button>
        </div>
        <form
          onSubmit={handleAdd}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            marginBottom: 16,
          }}
        >
          <input
            type="text"
            required
            placeholder="ユーザー名"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8,
              padding: "10px 12px",
              color: s.text,
              fontSize: 14,
              outline: "none",
            }}
          />
          <input
            type="password"
            required
            placeholder="パスワード（6文字以上）"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8,
              padding: "10px 12px",
              color: s.text,
              fontSize: 14,
              outline: "none",
            }}
          />
          {msg && (
            <div
              style={{
                fontSize: 13,
                color: msg.startsWith("✓") ? "#34d399" : "#f87171",
              }}
            >
              {msg}
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "10px",
              borderRadius: 8,
              border: "none",
              background: "linear-gradient(135deg,#0ea5e9,#00b4a0)",
              color: "#fff",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "追加中..." : "ユーザーを追加"}
          </button>
        </form>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {users.map((u: any) => (
            <UserRow key={u.uid} user={u} />
          ))}
        </div>
      </div>
    </div>
  );
}
