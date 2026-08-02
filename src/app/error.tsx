"use client";

// 描画中の例外をここで受け止める。
//
// ⚠️ **これが無いと、例外が出た瞬間に画面がまっさらになる。**
//    暗い配色のアプリでは真っ黒に見えるので、利用者は「ブラックアウト」としか
//    報告できず、原因にたどり着けない（2026-08-03、K-REX で実際に起きた）。
//
// ⚠️ **見た目は CSS に頼らず直書きする。** スタイルが読めていない状況でも
//    エラー画面だけは出したいため。

export default function ErrorScreen({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const msg = String(error?.message || error);
  // ⚠️ insertBefore / removeChild は**ブラウザの自動翻訳**が本文を差し替えた
  //    ときの定番のエラー。原因を名指しできるので、そう伝える。
  const translated = /insertBefore|removeChild|not a child of this node/i.test(msg);
  const content = (
    <div style={{ padding: 16 }}>
      <div style={{
        maxWidth: 420, margin: "15vh auto", padding: 20, borderRadius: 16,
        background: "#fff", color: "#1a1d23", border: "1px solid #e3e6ec",
        font: '15px/1.7 -apple-system, BlinkMacSystemFont, "Hiragino Sans", sans-serif',
      }}>
        <p style={{ fontWeight: 700, margin: "0 0 8px" }}>問題が起きました</p>
        {translated ? (
          <p style={{ fontSize: 14, margin: "0 0 12px" }}>
            <b>ブラウザの自動翻訳が原因です。</b>
            ページの翻訳を切ってから、下の「やり直す」を押してください。
            iPhone の Safari はアドレスバー左の「ぁあ」→「翻訳を止める」、
            Chrome は右上の「⋮」→「翻訳」から切れます。
          </p>
        ) : (
          <p style={{ fontSize: 14, margin: "0 0 12px" }}>
            画面を表示できませんでした。下の「やり直す」で戻れます。
            直らないときは、この文面をそのまま管理者に伝えてください。
          </p>
        )}
        <pre style={{
          fontSize: 11, background: "#f6f7f9", color: "#dc2626", borderRadius: 8,
          padding: 8, margin: "0 0 16px", whiteSpace: "pre-wrap", overflowX: "auto",
        }}>{msg}</pre>
        <button onClick={() => reset()} style={{
          width: "100%", padding: 12, borderRadius: 10, border: "none",
          background: "#2563eb", color: "#fff", fontWeight: 700, fontSize: 15,
        }}>やり直す</button>
      </div>
    </div>
  );
  // global-error は <html>/<body> ごと差し替える必要がある
  return false ? <html lang="ja" translate="no"><body>{content}</body></html> : content;
}
