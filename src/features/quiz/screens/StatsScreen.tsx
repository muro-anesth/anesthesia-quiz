import type { QuizController } from "../useQuizController";
import { s, catStyle } from "../theme";
import type { LearningMetrics } from "../../../lib/learningMetrics";
import { categoryInitialResultLabel, type CategoryLearningMetrics } from "../../../lib/learningMetrics";

function LearningCards({ metrics: m }: { metrics: LearningMetrics }) {
  const unperformed = m.attemptedUnique === 0;
  return (
    <section aria-label="学習範囲と初回成績" style={{ marginBottom: 20 }}>
      <h2 style={{ fontSize: 15, margin: "0 0 10px" }}>学習範囲と初回成績</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
        {[
          {
            label: "取り組んだ問題（重複なし）",
            value: m.publicTotal === 0 ? "公開問題なし" : unperformed ? "未実施" : `${m.attemptedUnique} / ${m.publicTotal}問（${m.coverageRate}%）`,
            detail: "公開年度の実在する問題が分母。同じ問題を繰り返しても1問です。",
          },
          {
            label: "初回回答の正答率",
            value: unperformed ? "未実施" : m.firstRate === null ? "算出できません" : `${m.firstRate}%（${m.firstCorrect} / ${m.firstAnswered}問）`,
            detail: "問題ごとの最初の回答だけで集計。繰り返しの正解では増えません。",
          },
          {
            label: "初回誤答 → 直近正答",
            value: unperformed ? "未実施" : m.firstAnswered === 0 ? "算出できません" : `${m.changedToCorrect}問`,
            detail: "初回が不正解で、直近が正解の問題数。再び誤答すると対象外になります。",
          },
        ].map(item => (
          <div key={item.label} style={{ background: s.card, border: `1px solid ${s.border}`, borderRadius: 12, padding: 14 }}>
            <div style={{ fontSize: 12, color: s.sub }}>{item.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, margin: "6px 0" }}>{item.value}</div>
            <div style={{ fontSize: 12, lineHeight: 1.6, color: s.sub }}>{item.detail}</div>
          </div>
        ))}
      </div>
      <details style={{ fontSize: 12, color: s.sub, marginTop: 10, lineHeight: 1.7 }}>
        <summary>集計対象と判定できない履歴</summary>
        <p>保存済みの回答履歴を読み取り集計しています。削除済み・公開対象外・問題ID不明の回答は上の3指標と分野別集計から除外（{m.excludedAttempts}回答）。下の延べ集計には残ります。公開問題の追加・削除でカバレッジは変わります。</p>
        <p>初回・直近は回答日時順です。日時が欠損・不正・集計時点より未来の問題（{m.invalidDateQuestions}問）は、初回正答率と正答への変化から除外します。同時刻の正誤が競合、または正誤が欠ける場合も判定しません（初回{m.ambiguousFirstQuestions}問・直近{m.ambiguousLatestQuestions}問、重複あり）。取り組んだ問題数には含めます。</p>
        <p>同時刻でも正誤がすべて同じならその結果を使用します。初回正答率の分母は初回を判定できた問題だけです。直近を判定できない問題は正答への変化に含めません。これらは記録上の指標であり、能力を認定するものではありません。</p>
      </details>
    </section>
  );
}

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
          ) : stats.statsError ? (
            <div role="alert" style={{ padding: 24 }}>成績を読み込めませんでした。ホームに戻って再度お試しください。</div>
          ) : (
            <>
              {stats.learning ? <LearningCards metrics={stats.learning} /> : (
                <p style={{ color: s.sub }}>学習範囲・初回成績は未取得です。</p>
              )}
              <h2 style={{ fontSize: 15, margin: "0 0 10px" }}>回答履歴（繰り返しを含む延べ集計）</h2>
              <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
                {[
                  { label: "総回答数（延べ）", value: stats.total },
                  { label: "総正答率（延べ）", value: stats.total ? `${stats.rate}%` : "未実施" },
                  { label: "直近7日の回答数", value: stats.recentTotal },
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
                  分野ごとの進み具合と初回成績
                </div>
                <p style={{ fontSize: 12, color: s.sub, lineHeight: 1.6 }}>
                  棒は取り組んだ割合です。反復回答は1問として数え、現在の分類で集計します。初回回答5問未満の注意書きは表示上の目安で、能力の判定基準ではありません。
                </p>
                {!stats.categoryLearning ? <p style={{ color: s.sub }}>分野別の進み具合は未取得です。</p> : stats.categoryLearning.length === 0 && <p style={{ color: s.sub }}>公開問題なし</p>}
                {stats.categoryLearning?.map((cat: CategoryLearningMetrics) => (
                  <div key={cat.name} style={{ marginBottom: 18 }}>
                    <div
                      style={{
                        fontSize: 12,
                        marginBottom: 4,
                      }}
                    >
                      <span style={{ color: catStyle(cat.name).color }}>
                        {cat.name}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, marginBottom: 4 }}>取り組んだ問題 {cat.attemptedUnique}/{cat.publicTotal}問</div>
                    <div style={{ fontSize: 12, marginBottom: 6 }}>{categoryInitialResultLabel(cat)}</div>
                    {cat.unscoredInitialQuestions > 0 && <div style={{ fontSize: 12, color: s.sub, marginBottom: 6 }}>初回を判定できない{cat.unscoredInitialQuestions}問は初回成績から除外（日時・正誤の欠損や競合）。</div>}
                    <div
                      role="progressbar"
                      aria-label={`${cat.name}の取り組んだ割合`}
                      aria-valuemin={0}
                      aria-valuemax={cat.publicTotal}
                      aria-valuenow={cat.attemptedUnique}
                      aria-valuetext={`${cat.publicTotal}問中${cat.attemptedUnique}問に取り組み済み`}
                      style={{
                        background: "rgba(255,255,255,0.05)",
                        borderRadius: 4,
                        height: 6,
                      }}
                    >
                      <div
                        style={{
                          width: `${cat.attemptedUnique / cat.publicTotal * 100}%`,
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
