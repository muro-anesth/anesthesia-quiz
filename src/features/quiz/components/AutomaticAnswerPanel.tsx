import { useRef } from 'react';
import type { QuizController } from '../useQuizController';
import { s } from '../theme';
import { answerDock } from './answerLayout';
import { ExplanationDialog } from './ExplanationDialog';
import { StarControl, type StarControlProps } from './StarControl';

type Props = Pick<QuizController, 'question' | 'isCorrect' | 'handleContinue' | 'saving' | 'saveError' | 'showExplanation' | 'setShowExplanation'> & { star: StarControlProps };

export function AnswerPanel({ question, isCorrect, handleContinue, saving, saveError, showExplanation, setShowExplanation, star }: Props) {
  const explanationButton = useRef<HTMLButtonElement>(null);
  const closeExplanation = () => { setShowExplanation(false); explanationButton.current?.focus(); };
  if (!question) return null;
  return <section aria-label="回答結果と次の操作" style={answerDock}>
    <div role="status" aria-live="polite" style={{ fontWeight: 700, fontSize: 18, color: isCorrect ? '#34d399' : '#f87171' }}>
      {isCorrect ? '✓ 正解' : '✗ 不正解'}
      <span style={{ marginLeft: 12, fontSize: 13, color: s.text }}>正答：{question.answer.toUpperCase().split('').join('・')}</span>
    </div>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-start', margin: '8px 0' }}>
      <StarControl {...star} />
      {question.explanation && <button ref={explanationButton} type="button" onClick={() => setShowExplanation(true)} style={{ minHeight: 44, padding: '8px 12px', borderRadius: 8, border: `1px solid ${s.border}`, background: 'transparent', color: '#38bdf8' }}>解説を見る</button>}
    </div>
    <p style={{ margin: '4px 0 10px', fontSize: 13, color: s.sub }}>{isCorrect ? '正誤と学習履歴から復習時期を自動調整します。' : '間違えた問題は、早めの復習に回します。'}</p>
    {saveError && <p role="alert" style={{ color: '#f87171', fontSize: 13 }}>{saveError}</p>}
    {saving && <p role="status" style={{ margin: '4px 0', fontSize: 13 }}>保存中...</p>}
    <button type="button" disabled={saving} onClick={() => handleContinue()} style={{ width: '100%', minHeight: 48, padding: '12px', borderRadius: 10, border: 'none', background: '#0284c7', color: '#fff', fontSize: 16, fontWeight: 700, cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.6 : 1 }}>次の問題 →</button>
    <button type="button" disabled={saving} onClick={() => handleContinue(true)} style={{ width: '100%', minHeight: 44, marginTop: 6, borderRadius: 8, border: `1px solid ${s.border}`, background: 'transparent', color: s.text, fontSize: 13 }}>保存して終了</button>
    {showExplanation && question.explanation && <ExplanationDialog text={question.explanation} onClose={closeExplanation} />}
  </section>;
}
