import type { QuizController } from "../useQuizController";
import { s, catStyle } from "../theme";

type Props = Pick<
  QuizController,
  "beginReview" | "phase" | "reviewQueue" | "saving" | "setPhase"
>;

export function ReviewScreen({
  beginReview,
  phase,
  reviewQueue,
  saving,
  setPhase,
}: Props) {
  return (
    <>
      {phase === "review_list" && (
        <div style={{ padding: 16 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 16,
            }}
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
            <span style={{ fontWeight: 600 }}>復習モード</span>
            <span style={{ fontSize: 13, color: s.sub }}>
              {reviewQueue?.total ?? 0}件
            </span>
          </div>
          {reviewQueue?.total > 0 && (
            <button
              onClick={beginReview}
              style={{
                width: "100%",
                padding: "16px",
                borderRadius: 12,
                border: "none",
                background: "linear-gradient(135deg,#fb923c,#f97316)",
                color: "#fff",
                fontSize: 16,
                fontWeight: 700,
                cursor: "pointer",
                marginBottom: 16,
              }}
            >
              🔥 復習を開始（{reviewQueue.total}件）
            </button>
          )}
          {reviewQueue?.total === 0 ? (
            <div style={{ textAlign: "center", padding: 40, color: s.sub }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>✅</div>
              <div>復習待ちの問題はありません</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {reviewQueue?.cards.map((c: any) => (
                <div
                  key={c.questionId}
                  style={{
                    background: s.card,
                    border: `1px solid ${s.border}`,
                    borderRadius: 10,
                    padding: "12px 14px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: 4,
                    }}
                  >
                    <span style={{ fontSize: 12, color: s.sub }}>
                      {c.year} Q{c.qnum}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        ...catStyle(c.category),
                        padding: "2px 6px",
                        borderRadius: 4,
                      }}
                    >
                      {c.category}
                    </span>
                  </div>
                  <div style={{ fontSize: 13 }}>{c.stem}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
