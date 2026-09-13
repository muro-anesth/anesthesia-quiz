import type { QuizController } from "../useQuizController";
import { s } from "../theme";

type Props = Pick<
  QuizController,
  "examAnswers" | "examPartACount" | "phase" | "startPartB"
>;

export function ExamTransitionScreen({
  examAnswers,
  examPartACount,
  phase,
  startPartB,
}: Props) {
  return (
    <>
      {phase === "exam_transition" && (
        <div
          style={{
            padding: 24,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "60vh",
          }}
        >
          <div style={{ fontSize: 40, marginBottom: 16 }}>✅</div>
          <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
            A問題終了
          </div>
          <div style={{ fontSize: 14, color: s.sub, marginBottom: 8 }}>
            {examPartACount}問中{examAnswers.filter((a) => a.correct).length}
            問正解
          </div>
          <div
            style={{
              fontSize: 28,
              fontWeight: 700,
              color: "#818cf8",
              marginBottom: 32,
            }}
          >
            {Math.round(
              (examAnswers.filter((a) => a.correct).length / examPartACount) *
                100,
            )}
            %
          </div>
          <button
            onClick={startPartB}
            style={{
              width: "100%",
              maxWidth: 300,
              padding: "18px",
              borderRadius: 14,
              border: "none",
              background: "linear-gradient(135deg,#6366f1,#818cf8)",
              color: "#fff",
              fontSize: 16,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            B問題へ進む →
          </button>
        </div>
      )}
    </>
  );
}
