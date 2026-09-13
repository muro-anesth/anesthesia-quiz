import type { QuizController } from "../useQuizController";
import { s } from "../theme";

type Props = Pick<
  QuizController,
  "examResult" | "handleShowExamHistory" | "phase" | "setPhase"
>;

export function ExamResultScreen({
  examResult,
  handleShowExamHistory,
  phase,
  setPhase,
}: Props) {
  return (
    <>
      {phase === "exam_result" && examResult && (
        <div style={{ padding: 24 }}>
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>
              {examResult.score >= 80
                ? "🎉"
                : examResult.score >= 60
                  ? "👍"
                  : "📚"}
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>
              {examResult.year} 試験結果
            </div>
            <div
              style={{
                fontSize: 48,
                fontWeight: 700,
                color:
                  examResult.score >= 80
                    ? "#34d399"
                    : examResult.score >= 60
                      ? "#fbbf24"
                      : "#f87171",
              }}
            >
              {examResult.score}%
            </div>
            <div style={{ fontSize: 14, color: s.sub, marginTop: 4 }}>
              {examResult.correctAnswers} / {examResult.totalQuestions} 問正解
            </div>
            <div
              style={{
                fontSize: 14,
                color: "#fbbf24",
                marginTop: 4,
                fontWeight: 600,
              }}
            >
              {"⏱ 経過時間: "}
              {examResult.elapsedSeconds != null
                ? `${Math.floor(examResult.elapsedSeconds / 60)}分${examResult.elapsedSeconds % 60}秒`
                : "計測なし"}
            </div>
          </div>

          <div
            style={{
              background: s.card,
              border: `1px solid ${s.border}`,
              borderRadius: 12,
              padding: 16,
              marginBottom: 16,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>
              問題別結果
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {examResult.answers.map((a: any) => (
                <div
                  key={a.questionId}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 11,
                    fontWeight: 600,
                    background: a.correct
                      ? "rgba(16,185,129,0.2)"
                      : "rgba(239,68,68,0.2)",
                    color: a.correct ? "#34d399" : "#f87171",
                    border: `1px solid ${a.correct ? "rgba(16,185,129,0.4)" : "rgba(239,68,68,0.4)"}`,
                  }}
                >
                  {a.qnum}
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <button
              onClick={handleShowExamHistory}
              style={{
                flex: 1,
                padding: "14px",
                borderRadius: 12,
                border: `1px solid ${s.border}`,
                background: s.card,
                color: s.text,
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              履歴を見る
            </button>
            <button
              onClick={() => setPhase("home")}
              style={{
                flex: 1,
                padding: "14px",
                borderRadius: 12,
                border: "none",
                background: "linear-gradient(135deg,#0ea5e9,#00b4a0)",
                color: "#fff",
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              ホームへ
            </button>
          </div>
        </div>
      )}
    </>
  );
}
