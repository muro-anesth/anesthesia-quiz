import type { QuizController } from "../useQuizController";
import { s, catStyle } from "../theme";
import { CHOICE_KEYS } from "../types";
import { AnswerPanel } from "../components/AnswerPanel";
import { questionViewport, questionScroll } from "../components/answerLayout";

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
        <div style={questionViewport}>
          <div
            key={question.id}
            style={questionScroll}
            aria-label="問題と選択肢"
          >
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
                      style={{
                        fontSize: 13,
                        lineHeight: 1.7,
                        color: "#b8cfe0",
                      }}
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
                  style={{
                    maxWidth: "100%",
                    borderRadius: 8,
                    marginBottom: 12,
                  }}
                />
              )}

              {question.answer.length === 2 && phase === "question" && (
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
            </div>
          </div>
          {phase === "answered" && (
            <AnswerPanel
              question={question}
              isCorrect={isCorrect}
              finishAfterRating={finishAfterRating}
              setFinishAfterRating={setFinishAfterRating}
              handleRating={handleRating}
              saving={saving}
              saveError={saveError}
              showExplanation={showExplanation}
              setShowExplanation={setShowExplanation}
            />
          )}
        </div>
      )}
    </>
  );
}
