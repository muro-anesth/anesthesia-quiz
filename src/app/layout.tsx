import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  // ⚠️ **ブラウザの自動翻訳を止める。**
  //    Google 翻訳や Safari の翻訳は本文のテキストノードを差し替える。React が
  //    同じ場所を書き換えようとすると insertBefore で落ち、画面がまっさらになる
  //    （暗い配色では真っ黒＝「ブラックアウト」に見える）。
  //    2026-08-03、K-REX で外国人利用者の端末に実際に起きた。
  other: {
    google: "notranslate",
    // Next.js emits mobile-web-app-capable; retain the Apple name for older iOS.
    "apple-mobile-web-app-capable": "yes",
  },
  title: "周術期クイズ",
  description: "周術期管理チーム試験対策",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "周術期クイズ",
    statusBarStyle: "default",
  },
  icons: {
    apple: "/apple-touch-icon.png",
    icon: "/icon.png",
  },
};

export const viewport: Viewport = { themeColor: "#0d1526" };

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