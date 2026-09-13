import type { QuizController } from "../useQuizController";
import { s } from "../theme";

type Props = Pick<QuizController, "phase">;

export function LoadingScreen({ phase }: Props) {
  return (
    <>
      {phase === "loading" && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "100vh",
          }}
        >
          <div style={{ color: s.sub }}>読み込み中...</div>
        </div>
      )}
    </>
  );
}
