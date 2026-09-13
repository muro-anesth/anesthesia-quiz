import type { QuizController } from "../useQuizController";
import { s } from "../theme";

type Props = Pick<
  QuizController,
  "examHistory" | "phase" | "saving" | "setPhase" | "years"
>;

export function ExamHistoryScreen({
  examHistory,
  phase,
  saving,
  setPhase,
  years,
}: Props) {
  return (
    <>
      {phase === "exam_history" && (
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
            <span style={{ fontWeight: 600, marginLeft: 12 }}>試験履歴</span>
          </div>

          {examHistory.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, color: s.sub }}>
              試験履歴がありません
            </div>
          ) : (
            <>
              {/* 年度別グラフ */}
              {[...new Set(years.map((y) => y.replace(/[ab]$/, "")))].map(
                (y) => {
                  const results = examHistory
                    .filter((h: any) => h.year === y)
                    .reverse();
                  if (results.length === 0) return null;
                  const maxScore = 100;
                  const w = 280;
                  const h2 = 120;
                  const pts = results.map((r: any, i: number) => ({
                    x:
                      results.length === 1
                        ? w / 2
                        : (i / (results.length - 1)) * w,
                    y: h2 - (r.score / maxScore) * h2,
                    score: r.score,
                  }));
                  const polyline = pts.map((p) => `${p.x},${p.y}`).join(" ");

                  return (
                    <div
                      key={y}
                      style={{
                        background: s.card,
                        border: `1px solid ${s.border}`,
                        borderRadius: 12,
                        padding: 16,
                        marginBottom: 16,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          marginBottom: 12,
                        }}
                      >
                        {y}
                      </div>
                      <svg
                        width="100%"
                        viewBox={`0 0 ${w} ${h2 + 20}`}
                        style={{ overflow: "visible" }}
                      >
                        {[0, 25, 50, 75, 100].map((v) => (
                          <g key={v}>
                            <line
                              x1={0}
                              y1={h2 - (v / 100) * h2}
                              x2={w}
                              y2={h2 - (v / 100) * h2}
                              stroke="rgba(255,255,255,0.05)"
                              strokeWidth={1}
                            />
                            <text
                              x={-4}
                              y={h2 - (v / 100) * h2 + 4}
                              fontSize={9}
                              fill="#4a7fa5"
                              textAnchor="end"
                            >
                              {v}
                            </text>
                          </g>
                        ))}
                        {results.length > 1 && (
                          <polyline
                            points={polyline}
                            fill="none"
                            stroke="#6366f1"
                            strokeWidth={2}
                          />
                        )}
                        {pts.map((p, i) => (
                          <g key={i}>
                            <circle cx={p.x} cy={p.y} r={5} fill="#6366f1" />
                            <text
                              x={p.x}
                              y={p.y - 10}
                              fontSize={10}
                              fill="#818cf8"
                              textAnchor="middle"
                            >
                              {p.score}%
                            </text>
                          </g>
                        ))}
                      </svg>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 6,
                          marginTop: 8,
                        }}
                      >
                        {[...results].reverse().map((r: any, i: number) => (
                          <div
                            key={r.id}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              fontSize: 12,
                              color: s.sub,
                            }}
                          >
                            <span>
                              {r.date
                                ?.toDate?.()
                                ?.toLocaleDateString("ja-JP") ?? "-"}
                            </span>
                            <span
                              style={{
                                color:
                                  r.score >= 80
                                    ? "#34d399"
                                    : r.score >= 60
                                      ? "#fbbf24"
                                      : "#f87171",
                                fontWeight: 600,
                              }}
                            >
                              {r.score}%　{r.correctAnswers}/{r.totalQuestions}
                              問
                              {r.elapsedSeconds != null &&
                                ` / ${Math.floor(r.elapsedSeconds / 60)}分${r.elapsedSeconds % 60}秒`}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                },
              )}
            </>
          )}
        </div>
      )}
    </>
  );
}
