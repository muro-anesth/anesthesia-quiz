import { s } from '../theme';

export type StarControlProps = {
  starred: boolean;
  loading: boolean;
  busy: boolean;
  error: string;
  onToggle: () => void;
  onRetry: () => void;
};

export function StarControl({ starred, loading, busy, error, onToggle, onRetry }: StarControlProps) {
  return <div style={{ minWidth: 0, maxWidth: '100%' }}>
    <button type="button" aria-label={starred ? '★を外す' : '★を付ける'} aria-pressed={starred} disabled={loading || busy || !!error} onClick={onToggle} style={{ minHeight: 44, padding: '8px 12px', borderRadius: 10, border: `1px solid ${starred ? '#fbbf24' : s.border}`, background: starred ? '#49380f' : s.card, color: starred ? '#fde68a' : s.text, fontSize: 15, fontWeight: 600, opacity: loading || busy ? 0.6 : 1, cursor: 'pointer' }}>
      {loading ? '☆ 読込中' : busy ? '★ 保存中' : starred ? '★ チェック済み' : '☆ チェック'}
    </button>
    {error && <div role="alert" style={{ color: '#fca5a5', fontSize: 13, lineHeight: 1.6, overflowWrap: 'anywhere' }}>{error}<button type="button" onClick={onRetry} disabled={loading || busy} style={{ minHeight: 44, padding: '6px 10px', background: 'transparent', color: '#7dd3fc', border: `1px solid ${s.border}`, borderRadius: 8 }}>★を再読み込み</button></div>}
  </div>;
}
