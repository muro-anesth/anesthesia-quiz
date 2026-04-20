import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "麻酔科クイズ",
  description: "麻酔科専門医試験対策",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body style={{ margin: 0, padding: 0, background: "#0d1526" }}>
        {children}
      </body>
    </html>
  );
}
