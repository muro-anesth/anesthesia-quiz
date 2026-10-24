import { s, catStyle } from '../theme';
import { StarControl, type StarControlProps } from './StarControl';

export function QuestionCardHeader({ category, identifier, star }: { category: string; identifier: string; star: StarControlProps }) {
  return <div aria-label="問題情報とチェック" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 12 }}>
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, flex: '1 1 0', minWidth: 0 }}>
      <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, maxWidth: '100%', overflowWrap: 'anywhere', ...catStyle(category) }}>{category}</span>
      <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.05)', color: s.sub }}>{identifier}</span>
    </div>
    <div style={{ flex: '0 1 auto', minWidth: 0, maxWidth: '60%' }}><StarControl {...star} /></div>
  </div>;
}
