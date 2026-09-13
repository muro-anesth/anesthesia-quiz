import type { QuizController } from "../useQuizController";
import { s, catStyle } from "../theme";
import { CHOICE_KEYS } from "../types";
import {
  questionViewport,
  questionScroll,
  answerDock,
} from "../components/answerLayout";

type Props = Pick<
  QuizController,
  | "examBaseYear"
  | "examIndex"
  | "examPart"
  | "examQuestions"
  | "handleExamAnswer"
  | "isCorrect"
  | "nextExamQuestion"
  | "phase"
  | "question"
  | "selected"
  | "setPhase"
  | "setShowExamWarning"
  | "showExamWarning"
>;

export function ExamQuestionScreen({
  examBaseYear,
  examIndex,
  examPart,
  examQuestions,
  handleExamAnswer,
  isCorrect,
  nextExamQuestion,
  phase,
  question,
  selected,
  setPhase,
  setShowExamWarning,
  showExamWarning,
}: Props) {
  return (
    <>
      {(phase === "exam_question" || phase === "exam_answered") && question && (
        <div style={questionViewport}>
          <div
            key={question.id}
            style={questionScroll}
            aria-label="問題と選択肢"
          >
            {showExamWarning && (
              <div
                style={{
                  position: "fixed",
                  inset: 0,
                  background: "rgba(0,0,0,0.7)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 1000,
                }}
              >
                <div
                  style={{
                    background: s.card,
                    borderRadius: 16,
                    padding: 24,
                    width: "80%",
                    maxWidth: 320,
                    border: `1px solid ${s.border}`,
                  }}
                >
                  <div style={{ fontWeight: 600, marginBottom: 12 }}>
                    試験を終了しますか？
                  </div>
                  <div style={{ fontSize: 13, color: s.sub, marginBottom: 20 }}>
                    進捗は保存されません。
                  </div>
                  <div style={{ display: "flex", gap: 12 }}>
                    <button
                      onClick={() => setShowExamWarning(false)}
                      style={{
                        flex: 1,
                        padding: "10px",
                        borderRadius: 10,
                        border: `1px solid ${s.border}`,
                        background: "none",
                        color: s.text,
                        cursor: "pointer",
                      }}
                    >
                      続ける
                    </button>
                    <button
                      onClick={() => {
                        setShowExamWarning(false);
                        setPhase("home");
                      }}
                      style={{
                        flex: 1,
                        padding: "10px",
                        borderRadius: 10,
                        border: "none",
                        background: "rgba(239,68,68,0.2)",
                        color: "#f87171",
                        cursor: "pointer",
                      }}
                    >
                      終了する
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <button
                onClick={() => setShowExamWarning(true)}
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
              <span style={{ fontSize: 13, color: s.sub }}>
                {examBaseYear}年度 {examPart.toUpperCase()}問題 |{" "}
                {examIndex + 1}/{examQuestions.length}問
              </span>
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
                  Q{question.qnum}
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
                      style={{
                        fontSize: 13,
                        lineHeight: 1.7,
                        color: "#b8cfe0",
                      }}
                    >
                      （{k}）{v as string}
                    </div>
                  ))}
                </div>
              )}

              {question.is_image_question && question.main_image && (
                <img
                  src={`/quiz-images/${question.year}/${question.main_image}`}
                  alt="問題画像"
                  style={{
                    maxWidth: "100%",
                    borderRadius: 8,
                    marginBottom: 12,
                  }}
                />
              )}

              {question.answer.length === 2 && phase === "exam_question" && (
                <div
                  style={{ fontSize: 12, color: "#fbbf24", marginBottom: 8 }}
                >
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
                  if (phase === "exam_question" && isSelected) {
                    bg = "rgba(14,165,233,0.15)";
                    border = "rgba(14,165,233,0.4)";
                    color = "#38bdf8";
                  }
                  if (phase === "exam_answered") {
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
                      onClick={() => handleExamAnswer(key)}
                      disabled={phase === "exam_answered"}
                      style={{
                        background: bg,
                        border: `1px solid ${border}`,
                        borderRadius: 10,
                        padding: "12px 14px",
                        color,
                        fontSize: 14,
                        textAlign: "left",
                        cursor:
                          phase === "exam_answered" ? "default" : "pointer",
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
            </div>
          </div>
          {phase === "exam_answered" && (
            <section aria-label="回答結果と次の操作" style={answerDock}>
              <div
                role="status"
                aria-live="polite"
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: isCorrect ? "#34d399" : "#f87171",
                  marginBottom: 12,
                }}
              >
                {isCorrect ? "✓ 正解" : "✗ 不正解"}
                <span style={{ marginLeft: 12, fontSize: 13, color: s.text }}>
                  正答：{question.answer.toUpperCase().split("").join("・")}
                </span>
              </div>
              <button
                onClick={nextExamQuestion}
                style={{
                  width: "100%",
                  padding: "14px",
                  borderRadius: 12,
                  border: "none",
                  background: "linear-gradient(135deg,#6366f1,#818cf8)",
                  color: "#fff",
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {examIndex + 1 >= examQuestions.length
                  ? "結果を見る"
                  : "次の問題 →"}
              </button>
            </section>
          )}
        </div>
      )}
    </>
  );
}
