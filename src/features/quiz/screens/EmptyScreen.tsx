import type { QuizController } from "../useQuizController";
import { s } from "../theme";

type Props = Pick<QuizController, "phase" | "saving" | "setPhase">;

export function EmptyScreen({ phase, saving, setPhase }: Props) {
  return (
    <>
      {phase === "empty" && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100vh",
            gap: 16,
          }}
        >
          <div style={{ color: s.sub }}>問題が見つかりません</div>
          <button
            disabled={saving}
            onClick={() => setPhase("home")}
            style={{
              padding: "10px 24px",
              borderRadius: 10,
              border: `1px solid ${s.border}`,
              background: s.card,
              color: s.text,
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
