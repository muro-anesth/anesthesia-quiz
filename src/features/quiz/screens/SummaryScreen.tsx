import type { QuizController } from "../useQuizController";

type Props = Pick<QuizController, "phase" | "setPhase" | "dailySession" | "dailyActive" | "startDailyQuiz" | "saving">;

export function SummaryScreen({ phase, setPhase, dailySession, dailyActive, startDailyQuiz, saving }: Props) {
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
          {dailyActive && dailySession && <div style={{ textAlign: "center", lineHeight: 1.8 }}>
            <div>今日の20問（{dailySession.date}・日本時間）</div>
            {dailySession.ids.length === 0 ? <p>現在、出題できる問題はありません。</p> : <>
              <div>{dailySession.done.length === dailySession.ids.length ? "完了" : "途中保存"}：{dailySession.done.length} / {dailySession.ids.length}問</div>
              <div>正解 {dailySession.done.filter(d => d.correct).length} / 回答済み {dailySession.done.length}問</div>
              {dailySession.done.length < dailySession.ids.length ? <p>続きから再開できます。日本時間で日付が変わった場合は新しいセットになります。</p> : <p>次のセットにも何回でも取り組めます。</p>}
            </>}
          </div>}
          {dailyActive && dailySession && <button
            onClick={startDailyQuiz}
            disabled={saving}
            style={{ padding: "14px 32px", borderRadius: 12, border: "1px solid #2dd4bf", background: "#134e4a", color: "#f0fdfa", fontSize: 16, fontWeight: 700, cursor: "pointer" }}
          >
            {dailySession.done.length < dailySession.ids.length ? "続きから" : "次の20問"}
          </button>}
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
