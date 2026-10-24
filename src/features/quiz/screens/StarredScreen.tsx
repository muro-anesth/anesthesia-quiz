import type { QuizController } from '../useQuizController';
import { s } from '../theme';
import { CHOICE_KEYS } from '../types';
import { QuestionText } from '../components/QuestionText';
import { StarControl } from '../components/StarControl';

type Props = Pick<QuizController, 'phase' | 'setPhase' | 'starredQuestions' | 'starLoading' | 'starSaving' | 'starError' | 'reloadStars' | 'toggleStar' | 'showStarred' | 'starListLoading' | 'starListError' | 'beginStarredQuiz'>;

export function StarredScreen(model: Props) {
  if (model.phase !== 'star_list') return null;
  const loading = model.starLoading || model.starListLoading;
  return <main style={{ padding: 16, overflowWrap: 'anywhere' }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
      <button type="button" onClick={() => model.setPhase('home')} style={{ minHeight: 44, padding: '8px 12px', borderRadius: 10, border: `1px solid ${s.border}`, color: s.text, background: s.card }}>← ホーム</button>
      <h1 style={{ fontSize: 20, color: '#fde68a', margin: 0 }}>★を振り返る</h1>
      {!loading && !model.starError && !model.starListError && <span>{model.starredQuestions.length}問</span>}
    </div>
    <p style={{ color: s.sub, fontSize: 14, lineHeight: 1.6 }}>問題を開くと正答・解説を確認できます。見るだけでは成績は変わりません。</p>
    {loading && <p role="status">★の問題を読み込み中...</p>}
    {model.starError && <StarControl starred={false} loading={model.starLoading} busy={model.starSaving} error={model.starError} onToggle={() => {}} onRetry={model.reloadStars} />}
    {model.starListError && <div role="alert">{model.starListError}<button type="button" onClick={model.showStarred} style={{ minHeight: 44 }}>もう一度読み込む</button></div>}
    {!loading && !model.starError && !model.starListError && <>
      {model.starredQuestions.length > 0 ? <button type="button" disabled={model.starSaving} onClick={model.beginStarredQuiz} style={{ width: '100%', minHeight: 48, padding: 12, borderRadius: 12, background: '#fbbf24', color: '#1c1917', fontSize: 16, fontWeight: 700, border: 'none', marginBottom: 16 }}>★の問題だけ解く（{model.starredQuestions.length}問）</button> : <p>★を付けた問題はまだありません。</p>}
      {model.starredQuestions.map(q => <article key={q.id} style={{ background: s.card, border: `1px solid ${s.border}`, borderRadius: 12, padding: 14, marginBottom: 12 }}>
        <details>
          <summary style={{ cursor: 'pointer', minHeight: 44, fontSize: 15, lineHeight: 1.7 }}>
            <strong>{q.year} Q{q.qnum}</strong><span style={{ display: 'block', color: s.sub, fontSize: 13 }}>{q.category}</span>
            {q.stem.slice(0, 75)}{q.stem.length > 75 ? '…' : ''}
          </summary>
          <div style={{ lineHeight: 1.8, fontSize: 15 }}>
            <p><QuestionText text={q.stem} /></p>
            {q.subitems && Object.entries(q.subitems).map(([key, value]) => <div key={key}>（{key}）{value}</div>)}
            {q.is_image_question && q.main_image && <img src={`/quiz-images/${q.year}/${q.main_image}`} alt="問題画像" style={{ maxWidth: '100%', borderRadius: 8 }} />}
            {CHOICE_KEYS.map(key => q.choices[key] && <p key={key} style={{ color: q.answer.includes(key) ? '#6ee7b7' : s.text }}>{key.toUpperCase()}. <QuestionText text={q.choices[key]} /></p>)}
            <strong style={{ color: '#6ee7b7' }}>正答：{q.answer.toUpperCase().split('').join('・')}</strong>
            <h2 style={{ fontSize: 16 }}>解説</h2>
            <div style={{ whiteSpace: 'pre-wrap' }}>{q.explanation || 'この問題には解説がありません。'}</div>
          </div>
        </details>
        <div style={{ marginTop: 10 }}><StarControl starred loading={model.starLoading} busy={model.starSaving} error="" onToggle={() => model.toggleStar(q.id)} onRetry={model.reloadStars} /></div>
      </article>)}
    </>}
  </main>;
}
