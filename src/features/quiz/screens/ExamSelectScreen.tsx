import type { QuizController } from "../useQuizController";
import { s } from "../theme";

type Props = Pick<
  QuizController,
  "phase" | "saving" | "setPhase" | "startExam" | "years"
>;

export function ExamSelectScreen({
  phase,
  saving,
  setPhase,
  startExam,
  years,
}: Props) {
  return (
    <>
      {phase === "exam_select" && (
        <div style={{ padding: 24 }}>
          <div
            style={{ display: "flex", alignItems: "center", marginBottom: 24 }}
          >
            <button
              disabled={saving}
              onClick={() => setPhase("home")}
              style={{
                background: "rgba(255,255,255,0.05)",
                border: `1px solid ${s.border}`,
                borderRadius: 10,
                padding: "8px 16px",
                color: s.text,
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              ← ホーム
            </button>
            <span style={{ fontWeight: 600, marginLeft: 12 }}>
              試験モード - 年度選択
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[...new Set(years.map((y) => y.replace(/[ab]$/, "")))].map((y) => (
              <button
                key={y}
                onClick={() => startExam(y)}
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
                {y}年度
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
