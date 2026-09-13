import type { QuizController } from "../useQuizController";
import { s } from "../theme";

import { logout } from "@/lib/firebaseHelpers";

type Props = Pick<
  QuizController,
  | "handleShowExamHistory"
  | "handleShowStats"
  | "phase"
  | "setPhase"
  | "setShowAdmin"
  | "startQuiz"
  | "startReview"
  | "userProfile"
>;

export function HomeScreen({
  handleShowExamHistory,
  handleShowStats,
  phase,
  setPhase,
  setShowAdmin,
  startQuiz,
  startReview,
  userProfile,
}: Props) {
  return (
    <>
      {phase === "home" && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "48px 24px 32px",
          }}
        >
          <h1
            style={{ fontSize: 24, fontWeight: 700, color: s.text, margin: 0 }}
          >
            周術期クイズ
          </h1>
          <p style={{ color: s.sub, fontSize: 14, margin: "8px 0 40px" }}>
            {userProfile?.username}
          </p>

          <div
            style={{
              width: "100%",
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <button
              onClick={startQuiz}
              style={{
                width: "100%",
                padding: "18px",
                borderRadius: 14,
                border: "none",
                background: "linear-gradient(135deg,#0ea5e9,#00b4a0)",
                color: "#fff",
                fontSize: 16,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              クイズ
            </button>
            <button
              onClick={() => setPhase("exam_select")}
              style={{
                width: "100%",
                padding: "18px",
                borderRadius: 14,
                border: "1px solid rgba(99,102,241,0.4)",
                background: "rgba(99,102,241,0.1)",
                color: "#818cf8",
                fontSize: 16,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              📝 試験モード
            </button>
            <button
              onClick={handleShowExamHistory}
              style={{
                width: "100%",
                padding: "18px",
                borderRadius: 14,
                border: `1px solid ${s.border}`,
                background: s.card,
                color: s.text,
                fontSize: 16,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              📋 試験履歴
            </button>
            <button
              onClick={startReview}
              style={{
                width: "100%",
                padding: "18px",
                borderRadius: 14,
                border: "1px solid rgba(251,146,60,0.4)",
                background: "rgba(251,146,60,0.1)",
                color: "#fb923c",
                fontSize: 16,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              🔥 復習モード
            </button>
            <button
              onClick={handleShowStats}
              style={{
                width: "100%",
                padding: "18px",
                borderRadius: 14,
                border: `1px solid ${s.border}`,
                background: s.card,
                color: s.text,
                fontSize: 16,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              📊 成績確認
            </button>
            <button
              onClick={() => setPhase("settings")}
              style={{
                width: "100%",
                padding: "18px",
                borderRadius: 14,
                border: `1px solid ${s.border}`,
                background: s.card,
                color: s.text,
                fontSize: 16,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              ⚙️ 設定
            </button>
            {userProfile?.role === "admin" && (
              <button
                onClick={() => setShowAdmin(true)}
                style={{
                  width: "100%",
                  padding: "18px",
                  borderRadius: 14,
                  border: `1px solid ${s.border}`,
                  background: s.card,
                  color: s.text,
                  fontSize: 16,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                🔧 管理者パネル
              </button>
            )}
            <button
              onClick={() =>
                logout().then(() => window.location.replace("/login"))
              }
              style={{
                width: "100%",
                padding: "14px",
                borderRadius: 14,
                border: "none",
                background: "none",
                color: s.sub,
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              ログアウト
            </button>
          </div>
        </div>
      )}
    </>
  );
}
