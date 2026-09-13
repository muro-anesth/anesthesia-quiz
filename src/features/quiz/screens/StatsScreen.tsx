import type { QuizController } from "../useQuizController";
import { s, catStyle } from "../theme";

type Props = Pick<
  QuizController,
  "phase" | "saving" | "setPhase" | "stats"
>;

export function StatsScreen({
  phase,
  saving,
  setPhase,
  stats,
}: Props) {
  return (
    <>
      {phase === "stats" && (
        <div style={{ padding: 16 }}>
          <div
            style={{ display: "flex", alignItems: "center", marginBottom: 16 }}
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
            <span style={{ fontWeight: 600, marginLeft: 12 }}>成績確認</span>
          </div>
          {!stats ? (
            <div style={{ textAlign: "center", padding: 40, color: s.sub }}>
              読み込み中...
            </div>
          ) : (
            <>
              <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
                {[
                  { label: "総回答数", value: stats.total },
                  { label: "正答率", value: `${stats.rate}%` },
                  { label: "直近7日", value: stats.recentTotal },
                ].map((item) => (
                  <div
                    key={item.label}
                    style={{
                      flex: 1,
                      background: s.card,
                      border: `1px solid ${s.border}`,
                      borderRadius: 12,
                      padding: "14px 10px",
                      textAlign: "center",
                    }}
                  >
                    <div style={{ fontSize: 22, fontWeight: 700 }}>
                      {item.value}
                    </div>
                    <div style={{ fontSize: 11, color: s.sub, marginTop: 4 }}>
                      {item.label}
                    </div>
                  </div>
                ))}
              </div>
              <div
                style={{
                  background: s.card,
                  border: `1px solid ${s.border}`,
                  borderRadius: 12,
                  padding: 16,
                }}
              >
                <div
                  style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}
                >
                  カテゴリー別正答率（低い順）
                </div>
                {stats.categories.map((cat: any) => (
                  <div key={cat.name} style={{ marginBottom: 10 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 12,
                        marginBottom: 4,
                      }}
                    >
                      <span style={{ color: catStyle(cat.name).color }}>
                        {cat.name}
                      </span>
                      <span>
                        {cat.correct}/{cat.total} ({cat.rate}%)
                      </span>
                    </div>
                    <div
                      style={{
                        background: "rgba(255,255,255,0.05)",
                        borderRadius: 4,
                        height: 6,
                      }}
                    >
                      <div
                        style={{
                          width: `${cat.rate}%`,
                          height: "100%",
                          borderRadius: 4,
                          background: catStyle(cat.name).color,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
