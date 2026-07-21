import type { Metadata } from "next";

export const metadata: Metadata = {
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
    <html lang="ja">
      <body style={{ margin: 0, padding: 0, background: "#0d1526" }}>
        {children}
      </body>
    </html>
  );
}