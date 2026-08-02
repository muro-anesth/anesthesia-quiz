import type { Metadata } from "next";

export const metadata: Metadata = {
  // ⚠️ **ブラウザの自動翻訳を止める。**
  //    Google 翻訳や Safari の翻訳は本文のテキストノードを差し替える。React が
  //    同じ場所を書き換えようとすると insertBefore で落ち、画面がまっさらになる
  //    （暗い配色では真っ黒＝「ブラックアウト」に見える）。
  //    2026-08-03、K-REX で外国人利用者の端末に実際に起きた。
  other: { google: "notranslate" },
  title: "周術期クイズ",
  description: "麻酔科専門医試験対策",
  icons: {
    apple: "/apple-touch-icon.png",
    icon: "/icon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja" translate="no">
      <body className="notranslate" translate="no" style={{ margin: 0, padding: 0, background: "#0d1526" }}>
        {children}
      </body>
    </html>
  );
}