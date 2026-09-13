import { useRef } from "react";
import type { QuizController } from "../useQuizController";
import { SRS_OPTIONS } from "@/lib/srs";
import { s } from "../theme";
import { answerDock } from "./answerLayout";

type Props = Pick<
  QuizController,
  | "question"
  | "isCorrect"
  | "finishAfterRating"
  | "setFinishAfterRating"
  | "handleRating"
  | "saving"
  | "saveError"
  | "showExplanation"
  | "setShowExplanation"
>;

export function AnswerPanel({
  question,
  isCorrect,
  finishAfterRating,
  setFinishAfterRating,
  handleRating,
  saving,
  saveError,
  showExplanation,
  setShowExplanation,
}: Props) {
  const explanationButton = useRef<HTMLButtonElement>(null);
  const closeExplanation = () => {
    setShowExplanation(false);
    explanationButton.current?.focus();
  };
  if (!question) return null;
  return (
    <section aria-label="回答結果と次の操作" style={answerDock}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <div
          role="status"
          aria-live="polite"
          style={{
            fontWeight: 700,
            fontSize: 18,
            color: isCorrect ? "#34d399" : "#f87171",
          }}
        >
          {isCorrect ? "✓ 正解" : "✗ 不正解"}
          <span style={{ marginLeft: 12, fontSize: 13, color: s.text }}>
            正答：{question.answer.toUpperCase().split("").join("・")}
          </span>
        </div>
        {question.explanation && (
          <button
            ref={explanationButton}
            type="button"
            onClick={() => setShowExplanation(true)}
            style={{
              minHeight: 44,
              padding: "8px 12px",
              borderRadius: 8,
              border: `1px solid ${s.border}`,
              background: "transparent",
              color: "#38bdf8",
            }}
          >
            解説を見る
          </button>
        )}
      </div>
      <p style={{ margin: "8px 0 4px", fontSize: 14, fontWeight: 600 }}>
        どのくらい思い出せましたか？
      </p>
      <p
        style={{
          margin: "0 0 10px",
          fontSize: 12,
          lineHeight: 1.5,
          color: s.sub,
        }}
      >
        {finishAfterRating
          ? "下から選ぶと、この回答を保存して終了します。"
          : "下から選ぶと、回答を保存して次へ進みます。"}
        <br />
        選んだ手応えと学習履歴から、次の復習時期を調整します。
      </p>
      {saveError && (
        <p role="alert" style={{ color: "#f87171", fontSize: 13 }}>
          {saveError}
        </p>
      )}
      {saving && (
        <p role="status" style={{ margin: "4px 0", fontSize: 13 }}>
          保存中...
        </p>
      )}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: 8,
        }}
      >
        {SRS_OPTIONS.map((opt) => (
          <button
            type="button"
            key={opt.key}
            disabled={saving}
            onClick={() => handleRating(opt.key)}
            style={{
              minHeight: 52,
              padding: "8px 6px",
              borderRadius: 10,
              border: `1px solid ${opt.border}`,
              background: opt.bg,
              color: opt.color,
              fontSize: 14,
              fontWeight: 600,
              cursor: saving ? "wait" : "pointer",
              opacity: saving ? 0.6 : 1,
            }}
          >
            <div>{opt.label}</div>
            <div style={{ fontSize: 11, fontWeight: 400, marginTop: 2 }}>
              {opt.sub}
            </div>
          </button>
        ))}
      </div>
      <button
        type="button"
        disabled={saving}
        aria-pressed={finishAfterRating}
        onClick={() => setFinishAfterRating(!finishAfterRating)}
        style={{
          display: "block",
          width: "100%",
          minHeight: 44,
          marginTop: 8,
          borderRadius: 8,
          border: `1px solid ${s.border}`,
          background: "transparent",
          color: s.text,
          fontSize: 13,
        }}
      >
        {finishAfterRating
          ? "終了をやめて、続ける"
          : "今日はここまで（終了する）"}
      </button>
      {showExplanation && question.explanation && (
        <div
          onClick={closeExplanation}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            zIndex: 500,
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label="解説"
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.stopPropagation();
                closeExplanation();
              }
              // The close button is the only interactive control inside this dialog.
              if (e.key === "Tab") {
                e.preventDefault();
                e.currentTarget.querySelector("button")?.focus();
              }
            }}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: s.card,
              borderRadius: "20px 20px 0 0",
              padding:
                "20px 20px calc(20px + env(safe-area-inset-bottom, 0px))",
              width: "100%",
              maxWidth: 430,
              maxHeight: "80dvh",
              boxSizing: "border-box",
              display: "flex",
              flexDirection: "column",
              border: `1px solid ${s.border}`,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexShrink: 0,
              }}
            >
              <strong>解説</strong>
              <button
                type="button"
                autoFocus
                aria-label="解説を閉じる"
                onClick={closeExplanation}
                style={{
                  minWidth: 44,
                  minHeight: 44,
                  border: "none",
                  background: "transparent",
                  color: s.text,
                  fontSize: 22,
                }}
              >
                ×
              </button>
            </div>
            <div
              style={{
                overflowY: "auto",
                minHeight: 0,
                whiteSpace: "pre-wrap",
                fontSize: 14,
                lineHeight: 1.8,
              }}
            >
              {question.explanation}
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
