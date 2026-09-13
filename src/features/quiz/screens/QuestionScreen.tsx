import type { QuizController } from "../useQuizController";
import { s, catStyle } from "../theme";
import { CHOICE_KEYS } from "../types";
import { SRS_OPTIONS } from "@/lib/srs";

type Props = Pick<
  QuizController,
  | "cycleComplete"
  | "finishAfterRating"
  | "handleAnswer"
  | "handleRating"
  | "isCorrect"
  | "phase"
  | "question"
  | "saveError"
  | "saving"
  | "selected"
  | "setFinishAfterRating"
  | "setPhase"
  | "setShowExplanation"
  | "showExplanation"
>;

export function QuestionScreen({
  cycleComplete,
  finishAfterRating,
  handleAnswer,
  handleRating,
  isCorrect,
  phase,
  question,
  saveError,
  saving,
  selected,
  setFinishAfterRating,
  setPhase,
  setShowExplanation,
  showExplanation,
}: Props) {
  return (
    <>
      {(phase === "question" || phase === "answered") && question && (
        <div style={{ padding: 16 }}>
          {/* 上部ナビ */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            <button
              disabled={saving}
              onClick={() =>
                phase === "answered"
                  ? setFinishAfterRating(true)
                  : setPhase("home")
              }
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
            {cycleComplete && (
              <span style={{ fontSize: 12, color: "#fbbf24" }}>
                🎉 全問完了
              </span>
            )}
          </div>

          <div
            style={{
              background: s.card,
              borderRadius: 16,
              padding: 20,
              border: `1px solid ${s.border}`,
            }}
          >
            <div
              style={{
                display: "flex",
                gap: 8,
                marginBottom: 12,
                flexWrap: "wrap",
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  padding: "3px 8px",
                  borderRadius: 6,
                  ...catStyle(question.category),
                }}
              >
                {question.category}
              </span>
              <span
                style={{
                  fontSize: 11,
                  padding: "3px 8px",
                  borderRadius: 6,
                  background: "rgba(255,255,255,0.05)",
                  color: s.sub,
                }}
              >
                {question.year} Q{question.qnum}
              </span>
            </div>

            <p style={{ fontSize: 15, lineHeight: 1.7, marginBottom: 16 }}>
              {question.stem}
            </p>
            {question.subitems && (
              <div
                style={{
                  background: "rgba(255,255,255,0.03)",
                  borderRadius: 8,
                  padding: "10px 14px",
                  marginBottom: 12,
                }}
              >
                {Object.entries(question.subitems).map(([k, v]) => (
                  <div
                    key={k}
                    style={{ fontSize: 13, lineHeight: 1.7, color: "#b8cfe0" }}
                  >
                    （{k}）{v}
                  </div>
                ))}
              </div>
            )}

            {question.is_image_question && question.main_image && (
              <img
                src={`/quiz-images/${question.year}/${question.main_image}`}
                alt="問題画像"
                style={{ maxWidth: "100%", borderRadius: 8, marginBottom: 12 }}
              />
            )}

            {question.answer.length === 2 && phase === "question" && (
              <div style={{ fontSize: 12, color: "#fbbf24", marginBottom: 8 }}>
                ※ 2つ選んでください（{selected.length}/2）
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {CHOICE_KEYS.map((key) => {
                const choiceText = question.choices[key];
                if (!choiceText) return null;
                const isAnswer = question.answer.includes(key);
                const isSelected = selected.includes(key);
                let bg = "rgba(255,255,255,0.03)";
                let border = "rgba(255,255,255,0.08)";
                let color = s.text;
                if (phase === "question" && isSelected) {
                  bg = "rgba(14,165,233,0.15)";
                  border = "rgba(14,165,233,0.4)";
                  color = "#38bdf8";
                }
                if (phase === "answered") {
                  if (isAnswer) {
                    bg = "rgba(16,185,129,0.15)";
                    border = "rgba(16,185,129,0.4)";
                    color = "#34d399";
                  } else if (isSelected) {
                    bg = "rgba(239,68,68,0.15)";
                    border = "rgba(239,68,68,0.4)";
                    color = "#f87171";
                  }
                }
                return (
                  <button
                    key={key}
                    onClick={() => handleAnswer(key)}
                    disabled={phase === "answered"}
                    style={{
                      background: bg,
                      border: `1px solid ${border}`,
                      borderRadius: 10,
                      padding: "12px 14px",
                      color,
                      fontSize: 14,
                      textAlign: "left",
                      cursor: phase === "answered" ? "default" : "pointer",
                      display: "flex",
                      gap: 10,
                    }}
                  >
                    <span style={{ fontWeight: 700, minWidth: 18 }}>
                      {key.toUpperCase()}.
                    </span>
                    <span>{choiceText}</span>
                  </button>
                );
              })}
            </div>

            {phase === "answered" && (
              <div style={{ marginTop: 16 }}>
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    color: isCorrect ? "#34d399" : "#f87171",
                    marginBottom: 12,
                  }}
                >
                  {isCorrect ? "✓ 正解" : "✗ 不正解"}
                </div>

                {question.explanation && (
                  <>
                    <button
                      onClick={() => setShowExplanation(true)}
                      style={{
                        background: "rgba(14,165,233,0.1)",
                        border: "1px solid rgba(14,165,233,0.2)",
                        borderRadius: 8,
                        padding: "6px 12px",
                        color: "#38bdf8",
                        fontSize: 13,
                        cursor: "pointer",
                        marginBottom: 12,
                      }}
                    >
                      解説を見る
                    </button>
                    {showExplanation && (
                      <div
                        onClick={() => setShowExplanation(false)}
                        style={{
                          position: "fixed",
                          inset: 0,
                          background: "rgba(0,0,0,0.7)",
                          display: "flex",
                          alignItems: "flex-end",
                          justifyContent: "center",
                          zIndex: 500,
                          padding: "0 0 0 0",
                        }}
                      >
                        <div
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            background: s.card,
                            borderRadius: "20px 20px 0 0",
                            padding: 24,
                            width: "100%",
                            maxWidth: 430,
                            maxHeight: "70vh",
                            overflowY: "auto",
                            border: `1px solid ${s.border}`,
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              marginBottom: 16,
                            }}
                          >
                            <span style={{ fontWeight: 600, fontSize: 15 }}>
                              解説
                            </span>
                            <button
                              onClick={() => setShowExplanation(false)}
                              style={{
                                background: "none",
                                border: "none",
                                color: s.sub,
                                fontSize: 22,
                                cursor: "pointer",
                                lineHeight: 1,
                              }}
                            >
                              ×
                            </button>
                          </div>
                          <div
                            style={{
                              fontSize: 13,
                              lineHeight: 1.8,
                              whiteSpace: "pre-wrap",
                              color: s.text,
                            }}
                          >
                            {question.explanation}
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}

                <div style={{ textAlign: "center", marginBottom: 8 }}>
                  <button
                    disabled={saving}
                    onClick={() => setFinishAfterRating(true)}
                    style={{
                      background: "transparent",
                      border: "1px solid rgba(255,255,255,0.15)",
                      borderRadius: 10,
                      padding: "10px 24px",
                      color: s.sub,
                      fontSize: 13,
                      cursor: "pointer",
                    }}
                  >
                    今日はここまで
                  </button>
                </div>

                {finishAfterRating && (
                  <p role="status" style={{ fontSize: 13 }}>
                    回答の手応えを選ぶと、この回答を保存して終了します。
                  </p>
                )}
                {saveError && (
                  <p role="alert" style={{ color: "#f87171", fontSize: 13 }}>
                    {saveError}
                  </p>
                )}
                {saving && <p role="status">保存中...</p>}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {SRS_OPTIONS.map((opt) => (
                    <button
                      key={opt.key}
                      disabled={saving}
                      onClick={() => handleRating(opt.key)}
                      style={{
                        flex: 1,
                        minWidth: 70,
                        background: opt.bg,
                        border: `1px solid ${opt.border}`,
                        borderRadius: 10,
                        padding: "10px 8px",
                        color: opt.color,
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      <div>{opt.label}</div>
                      <div style={{ fontSize: 10, opacity: 0.7 }}>
                        {opt.sub}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
