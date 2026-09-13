import type { QuizController } from "../useQuizController";

type Props = Pick<QuizController, "phase" | "setPhase">;

export function SummaryScreen({ phase, setPhase }: Props) {
  return (
    <>
      {phase === "summary" && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100vh",
            gap: 16,
            padding: 24,
          }}
        >
          <div style={{ fontSize: 48 }}>🎉</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>お疲れさまでした</div>
          <button
            onClick={() => setPhase("home")}
            style={{
              padding: "14px 32px",
              borderRadius: 12,
              border: "none",
              background: "linear-gradient(135deg,#0ea5e9,#00b4a0)",
              color: "#fff",
              fontSize: 16,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            ホームに戻る
          </button>
        </div>
      )}
    </>
  );
}
